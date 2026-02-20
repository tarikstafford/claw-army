/**
 * HTTP Forward Proxy for OpenClaw bot VM egress traffic.
 *
 * Bot VMs are configured with HTTP_PROXY=http://tool-gateway:3002 so all outbound
 * HTTP/HTTPS traffic is routed through this gateway. This enables:
 *   - Domain allowlisting (restrict which hosts bots can contact)
 *   - Egress logging to console (botId unavailable at proxy level)
 *   - Rate limiting per source IP
 *
 * Two proxy modes:
 *   1. CONNECT tunneling — for HTTPS (bot establishes TLS tunnel through gateway)
 *   2. HTTP forward proxy — for plain HTTP (rare; most LLM APIs use HTTPS)
 *
 * The CONNECT handler is attached directly to the Node.js HTTP server because
 * Fastify does not process CONNECT requests — they arrive before any HTTP body
 * is parsed and require raw TCP socket handling.
 *
 * The HTTP forward proxy is handled via Fastify's setNotFoundHandler, which is
 * invoked when Fastify receives an absolute-URL request (no matching route).
 */

import net from 'node:net';
import http from 'node:http';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

// ──────────────────────────────────────────────────────────────────────────────
// Domain allowlist
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Comma-separated list of allowed proxy destinations.
 * Empty = allow all (development default; restrict in production).
 *
 * Example: "api.anthropic.com,api.openai.com,generativelanguage.googleapis.com"
 */
const PROXY_DOMAIN_ALLOWLIST: string[] =
  (process.env.PROXY_DOMAIN_ALLOWLIST ?? '').split(',').map((d) => d.trim()).filter(Boolean);

function isDomainAllowed(hostname: string): boolean {
  if (PROXY_DOMAIN_ALLOWLIST.length === 0) return true; // allow all if unconfigured
  return PROXY_DOMAIN_ALLOWLIST.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// CONNECT handler (HTTPS tunneling)
// ──────────────────────────────────────────────────────────────────────────────

function handleConnect(
  req: http.IncomingMessage,
  socket: net.Socket,
  head: Buffer,
): void {
  const requestId = randomUUID().slice(0, 8);
  const target = req.url ?? '';
  const [hostname, portStr] = target.split(':');
  const port = parseInt(portStr ?? '443', 10);
  const srcIp = req.socket.remoteAddress ?? 'unknown';

  if (!hostname || isNaN(port)) {
    console.warn(`[proxy/connect] ${requestId} Bad CONNECT target: ${target}`);
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  if (!isDomainAllowed(hostname)) {
    console.warn(`[proxy/connect] ${requestId} BLOCKED ${hostname}:${port} from ${srcIp}`);
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  console.log(`[proxy/connect] ${requestId} CONNECT ${hostname}:${port} from ${srcIp}`);

  const targetSocket = net.connect(port, hostname, () => {
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length > 0) targetSocket.write(head);
    targetSocket.pipe(socket, { end: true });
    socket.pipe(targetSocket, { end: true });
    console.log(`[proxy/connect] ${requestId} Tunnel established ${hostname}:${port}`);
  });

  targetSocket.on('error', (err) => {
    console.error(`[proxy/connect] ${requestId} Target error ${hostname}:${port}:`, err.message);
    socket.write(`HTTP/1.1 502 Bad Gateway\r\n\r\n`);
    socket.destroy();
  });

  socket.on('error', (err) => {
    console.error(`[proxy/connect] ${requestId} Client socket error:`, err.message);
    targetSocket.destroy();
  });

  targetSocket.on('end', () => socket.destroy());
  socket.on('end', () => targetSocket.destroy());
}

// ──────────────────────────────────────────────────────────────────────────────
// HTTP forward proxy handler (plain HTTP requests)
// ──────────────────────────────────────────────────────────────────────────────

function handleHttpForwardProxy(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  const requestId = randomUUID().slice(0, 8);
  const rawUrl = req.url ?? '';
  const srcIp = req.socket.remoteAddress ?? 'unknown';

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    console.warn(`[proxy/http] ${requestId} Invalid URL: ${rawUrl}`);
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const hostname = targetUrl.hostname;
  const port = parseInt(targetUrl.port || '80', 10);

  if (!isDomainAllowed(hostname)) {
    console.warn(`[proxy/http] ${requestId} BLOCKED ${hostname} from ${srcIp}`);
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  console.log(`[proxy/http] ${requestId} ${req.method} ${targetUrl.hostname}${targetUrl.pathname} from ${srcIp}`);

  // Forward the request to the target
  const proxyReq = http.request(
    {
      hostname,
      port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: hostname,
        // Remove proxy-specific headers
        'proxy-connection': undefined,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on('error', (err) => {
    console.error(`[proxy/http] ${requestId} Proxy request error:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502);
    }
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq, { end: true });
}

// ──────────────────────────────────────────────────────────────────────────────
// attachProxyHandlers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Attach proxy handlers to the Fastify HTTP server.
 *
 * Call this after `buildApp()` returns but BEFORE `fastify.listen()`.
 *
 * - CONNECT handler: attached at the raw Node.js server level (bypasses Fastify)
 * - HTTP forward proxy: registered as Fastify's not-found handler
 */
export function attachProxyHandlers(fastify: FastifyInstance): void {
  // 1. CONNECT handler for HTTPS tunneling — must be at raw server level
  fastify.server.on('connect', handleConnect);

  // 2. HTTP forward proxy — intercepted via not-found handler
  //    Fastify receives absolute-URL GET/POST requests (e.g. GET http://example.com/ HTTP/1.1)
  //    but cannot match them to any route. The not-found handler catches them.
  fastify.setNotFoundHandler((request, reply) => {
    const rawUrl = request.raw.url ?? '';
    if (rawUrl.startsWith('http://')) {
      handleHttpForwardProxy(request.raw, reply.raw);
      return reply;
    }
    // Standard 404 for unmatched non-proxy requests
    return reply.code(404).send({ error: 'Not Found' });
  });

  console.log('[proxy] Proxy handlers attached (CONNECT + HTTP forward)');

  if (PROXY_DOMAIN_ALLOWLIST.length > 0) {
    console.log('[proxy] Domain allowlist:', PROXY_DOMAIN_ALLOWLIST);
  } else {
    console.warn('[proxy] PROXY_DOMAIN_ALLOWLIST is empty — all domains are allowed (not safe for production)');
  }
}
