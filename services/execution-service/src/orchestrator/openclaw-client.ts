import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';

// ──────────────────────────────────────────────────────────────────────────────
// Protocol types — OpenClaw Gateway JSON-RPC-style protocol
// ──────────────────────────────────────────────────────────────────────────────

interface RpcRequest {
  type: 'req';
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface RpcResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

interface GatewayEvent {
  type: 'event';
  event: string;
  payload: Record<string, unknown>;
  seq?: number;
}

type InboundMessage = RpcResponse | GatewayEvent | { type: string; [key: string]: unknown };

// ──────────────────────────────────────────────────────────────────────────────
// OpenClawClient
// ──────────────────────────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2_000;
const CONNECT_TIMEOUT_MS = 10_000;

/**
 * WebSocket client for OpenClaw Gateway.
 *
 * Connects to the OpenClaw Gateway running on a bot VM and dispatches tasks
 * via the Gateway JSON-RPC protocol:
 *   - Request:  { type: "req", id, method, params }
 *   - Response: { type: "res", id, ok, payload?, error? }
 *   - Event:    { type: "event", event, payload, seq? }
 *
 * Usage:
 *   const client = new OpenClawClient('ws://10.0.0.5:18789', token);
 *   await client.connect();         // authenticates via connect RPC
 *   const sessionId = await client.sendTask('Write a summary of...');
 *   client.onComplete((result) => console.log(result));
 */
export class OpenClawClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private completionCallbacks: Array<(result: string) => void> = [];
  private failureCallbacks: Array<(error: string) => void> = [];
  private _isConnected = false;
  private pendingRequests = new Map<
    string,
    { resolve: (res: RpcResponse) => void; reject: (err: Error) => void }
  >();

  constructor(
    private readonly wsUrl: string,
    private readonly token?: string,
  ) {}

  // ── RPC helpers ─────────────────────────────────────────────────────────────

  /**
   * Send a JSON-RPC request and await the matching response.
   * Rejects if the response has ok:false or the send itself fails.
   */
  private rpc(method: string, params: Record<string, unknown>): Promise<RpcResponse> {
    return new Promise<RpcResponse>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('[openclaw-client] Cannot send RPC: WebSocket not open'));
        return;
      }

      const id = randomUUID();
      const request: RpcRequest = { type: 'req', id, method, params };

      this.pendingRequests.set(id, { resolve, reject });

      this.ws.send(JSON.stringify(request), (err) => {
        if (err) {
          this.pendingRequests.delete(id);
          reject(new Error(`[openclaw-client] RPC send failed (${method}): ${err.message}`));
        }
      });
    });
  }

  // ── Connection ──────────────────────────────────────────────────────────────

  /**
   * Connect to the OpenClaw Gateway WebSocket and authenticate.
   * Retries up to MAX_RECONNECT_ATTEMPTS times on failure.
   * Throws if all attempts are exhausted.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const attempt = () => {
        console.log('[openclaw-client] Connecting:', {
          url: this.wsUrl,
          attempt: this.reconnectAttempts + 1,
        });

        const ws = new WebSocket(this.wsUrl);
        const connectTimeout = setTimeout(() => {
          ws.terminate();
          this.handleReconnect(resolve, reject);
        }, CONNECT_TIMEOUT_MS);

        ws.on('open', () => {
          this.ws = ws;
          this._isConnected = true;
          this.reconnectAttempts = 0;

          // Authenticate via in-connection RPC if a token was provided
          if (this.token) {
            this.rpc('connect', { auth: { token: this.token } })
              .then((res) => {
                clearTimeout(connectTimeout);
                if (!res.ok) {
                  ws.terminate();
                  reject(new Error(`[openclaw-client] Auth rejected: ${res.error ?? 'unknown'}`));
                } else {
                  console.log('[openclaw-client] Authenticated:', this.wsUrl);
                  resolve();
                }
              })
              .catch((err: unknown) => {
                clearTimeout(connectTimeout);
                ws.terminate();
                reject(err instanceof Error ? err : new Error(String(err)));
              });
          } else {
            clearTimeout(connectTimeout);
            console.log('[openclaw-client] Connected (no auth):', this.wsUrl);
            resolve();
          }
        });

        ws.on('message', (data: Buffer) => {
          this.handleMessage(data);
        });

        ws.on('error', (err) => {
          clearTimeout(connectTimeout);
          console.error('[openclaw-client] WebSocket error:', err.message);
          this._isConnected = false;
        });

        ws.on('close', (code, reason) => {
          clearTimeout(connectTimeout);
          this._isConnected = false;
          console.warn('[openclaw-client] Connection closed:', {
            code,
            reason: reason.toString(),
            url: this.wsUrl,
          });

          // Reject all pending RPCs so callers don't hang
          for (const [id, { reject: rej }] of this.pendingRequests) {
            rej(new Error(`[openclaw-client] Connection closed (code=${code}) — RPC ${id} aborted`));
          }
          this.pendingRequests.clear();

          // Notify failure callbacks so pending tasks don't hang
          this.failureCallbacks.forEach((cb) => cb(`Connection closed (code=${code})`));
          this.failureCallbacks = [];
        });
      };

      attempt();
    });
  }

  private handleReconnect(
    resolve: () => void,
    reject: (err: Error) => void,
  ): void {
    this.reconnectAttempts++;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      const err = new Error(
        `[openclaw-client] Failed to connect after ${MAX_RECONNECT_ATTEMPTS} attempts: ${this.wsUrl}`,
      );
      console.error(err.message);
      reject(err);
      return;
    }
    console.warn('[openclaw-client] Reconnecting in', RECONNECT_DELAY_MS, 'ms...', {
      attempt: this.reconnectAttempts,
    });
    setTimeout(() => this.connect().then(resolve).catch(reject), RECONNECT_DELAY_MS);
  }

  // ── Message handling ────────────────────────────────────────────────────────

  private handleMessage(data: Buffer): void {
    let msg: InboundMessage;
    try {
      msg = JSON.parse(data.toString()) as InboundMessage;
    } catch {
      console.error('[openclaw-client] Received non-JSON message:', data.toString().slice(0, 200));
      return;
    }

    if (msg.type === 'res') {
      const res = msg as RpcResponse;
      const pending = this.pendingRequests.get(res.id);
      if (pending) {
        this.pendingRequests.delete(res.id);
        if (res.ok) {
          pending.resolve(res);
        } else {
          pending.reject(new Error(`[openclaw-client] RPC error: ${res.error ?? 'unknown'}`));
        }
      } else {
        console.warn('[openclaw-client] Received res for unknown id:', res.id);
      }
    } else if (msg.type === 'event') {
      const evt = msg as GatewayEvent;
      console.log('[openclaw-client] Gateway event:', evt.event, evt.seq ?? '');
      // ── Future: decision_annotation handler ────────────────────────────────
      // OpenClaw does not currently emit 'decision_annotation' messages from agent
      // reasoning (confirmed Feb 2026 — GitHub Issues #6467, #8901 closed without
      // implementing structured annotation events).
      //
      // When OpenClaw adds decision_annotation support, add a handler here:
      //   if (evt.event === 'decision_annotation') {
      //     // Write directly to decision_traces table — this becomes the primary path.
      //     // The post-hoc attribution compiler (attribution-compiler.ts) can then be
      //     // deprecated or used as a fallback for older OpenClaw versions.
      //   }
      //
      // OpenClaw tool streaming events (stream:'tool') are display-only metadata
      // bubbles (tool name + argument prefix). They do NOT carry directive attribution
      // fields (directiveText, confidence, outcome). Do not use them for traces.
      // ───────────────────────────────────────────────────────────────────────
    } else {
      console.warn('[openclaw-client] Unknown message type:', (msg as { type: string }).type);
    }
  }

  // ── Task dispatch ───────────────────────────────────────────────────────────

  /**
   * Send a task to the OpenClaw Gateway using the agent.request + agent.wait protocol.
   *
   * 1. Calls `agent.request` to queue the message for the main agent session.
   * 2. Calls `agent.wait` (fire-and-forget) which blocks until the agent finishes;
   *    on resolve → fires completionCallbacks; on reject → fires failureCallbacks.
   *
   * @param taskDescription - The plain-text task prompt for OpenClaw to execute
   * @returns sessionId — a UUID for dispatcher tracing (not used in the protocol)
   */
  async sendTask(taskDescription: string): Promise<string> {
    if (!this.ws || !this._isConnected) {
      throw new Error('[openclaw-client] Cannot send task: not connected');
    }

    const sessionId = randomUUID();
    const sessionKey = 'agent:main:main';

    console.log('[openclaw-client] Sending agent.request:', {
      sessionId,
      promptPreview: taskDescription.slice(0, 80),
    });

    await this.rpc('agent.request', {
      agentId: 'main',
      sessionKey,
      message: taskDescription,
    });

    // Fire-and-forget: agent.wait blocks until the agent finishes
    this.rpc('agent.wait', { sessionKey })
      .then((res) => {
        const payload = res.payload as Record<string, unknown> | undefined;
        const result = String(payload?.result ?? JSON.stringify(payload));
        console.log('[openclaw-client] Task complete:', { sessionId, resultPreview: result.slice(0, 80) });
        this.completionCallbacks.forEach((cb) => cb(result));
        this.completionCallbacks = [];
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[openclaw-client] Task failed:', { sessionId, error: message });
        this.failureCallbacks.forEach((cb) => cb(message));
        this.failureCallbacks = [];
      });

    return sessionId;
  }

  // ── Callbacks ───────────────────────────────────────────────────────────────

  /**
   * Register a callback for when the current task completes successfully.
   * The callback is called once and then deregistered.
   */
  onComplete(cb: (result: string) => void): void {
    this.completionCallbacks.push(cb);
  }

  /**
   * Register a callback for when the current task fails.
   * The callback is called once and then deregistered.
   */
  onError(cb: (error: string) => void): void {
    this.failureCallbacks.push(cb);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  disconnect(): void {
    this._isConnected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this._isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}
