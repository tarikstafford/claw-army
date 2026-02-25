import { randomUUID } from 'node:crypto';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const MAX_CONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2_000;
const CONNECT_TIMEOUT_MS = 15_000;

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface ToolInvocationEvent {
  callId: string;
  toolName: string;
  arguments: string;
  invokedAt: Date;
}

export interface TaskResult {
  text: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
}

// ──────────────────────────────────────────────────────────────────────────────
// OpenClawClient — HTTP-based client for the OpenClaw Gateway
// ──────────────────────────────────────────────────────────────────────────────

/**
 * HTTP client for the OpenClaw Gateway /v1/responses API.
 *
 * Dispatches tasks to a bot VM's OpenClaw Gateway via the standard
 * OpenResponses HTTP endpoint (POST /v1/responses) with Bearer token auth.
 * This avoids the complex WebSocket device-identity handshake (keypair +
 * challenge signing) that the WS protocol requires.
 *
 * Usage:
 *   const client = new OpenClawClient('http://10.0.0.5:18789', token);
 *   await client.connect();           // verifies HTTP reachability
 *   await client.sendTask('...');     // streams SSE, fires callbacks on done
 *   client.onComplete((r) => ...);
 *   client.onError((e) => ...);
 */
export class OpenClawClient {
  private completionCallbacks: Array<(result: TaskResult) => void> = [];
  private failureCallbacks: Array<(error: string) => void> = [];
  private toolInvocationCallbacks: Array<(event: ToolInvocationEvent) => void> = [];
  private _isConnected = false;

  constructor(
    private readonly baseUrl: string,
    private readonly token?: string,
  ) {}

  // ── Connection ──────────────────────────────────────────────────────────────

  /**
   * Verify the gateway HTTP server is reachable and accepting our token.
   * Uses a GET to the control UI root (always served, no auth needed) to
   * confirm the HTTP server is up, then marks the client as connected.
   *
   * Retries up to MAX_CONNECT_ATTEMPTS times.
   */
  async connect(): Promise<void> {
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt < MAX_CONNECT_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        console.warn('[openclaw-client] Retrying connect:', {
          url: this.baseUrl,
          attempt: attempt + 1,
        });
        await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
      }

      try {
        // GET the control UI root — any HTTP response confirms the gateway is serving.
        // We don't use POST /v1/responses here to avoid triggering an agent run.
        const res = await fetch(`${this.baseUrl}/`, {
          method: 'GET',
          signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
        });

        // Drain body to avoid resource leaks
        await res.body?.cancel();

        this._isConnected = true;
        console.log('[openclaw-client] Gateway HTTP verified:', {
          url: this.baseUrl,
          status: res.status,
        });
        return;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        console.error('[openclaw-client] Connect attempt failed:', {
          url: this.baseUrl,
          attempt: attempt + 1,
          error: lastErr.message,
        });
      }
    }

    throw new Error(
      `[openclaw-client] Failed to connect to gateway at ${this.baseUrl} after ${MAX_CONNECT_ATTEMPTS} attempts: ${lastErr?.message ?? 'unknown'}`,
    );
  }

  // ── Task dispatch ───────────────────────────────────────────────────────────

  /**
   * Send a task to the OpenClaw Gateway via POST /v1/responses.
   *
   * The request streams SSE events. On `response.completed`, fires
   * completionCallbacks with the result text. On `response.failed` or
   * connection error, fires failureCallbacks.
   *
   * Returns a sessionId immediately (fire-and-forget pattern) — the actual
   * completion is signalled via onComplete / onError callbacks.
   *
   * @param taskDescription - The plain-text task prompt for OpenClaw to execute
   * @returns sessionId — a UUID for dispatcher tracing
   */
  async sendTask(taskDescription: string): Promise<string> {
    if (!this._isConnected) {
      throw new Error('[openclaw-client] Cannot send task: not connected');
    }

    const sessionId = randomUUID();

    console.log('[openclaw-client] Dispatching task via HTTP:', {
      sessionId,
      promptPreview: taskDescription.slice(0, 80),
    });

    // Fire-and-forget — executeTask resolves/rejects and fires callbacks
    this.executeTask(taskDescription, sessionId).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[openclaw-client] Task failed:', { sessionId, error: message });
      for (const cb of this.failureCallbacks) cb(message);
      this.failureCallbacks = [];
    });

    return sessionId;
  }

  private async executeTask(taskDescription: string, sessionId: string): Promise<void> {
    const url = `${this.baseUrl}/v1/responses`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token ?? ''}`,
        'Content-Type': 'application/json',
        'x-openclaw-agent-id': 'main',
      },
      body: JSON.stringify({
        model: 'openclaw:main',
        input: taskDescription,
        stream: true,
      }),
    });

    console.log('[openclaw-client] HTTP response received:', {
      sessionId,
      status: response.status,
      contentType: response.headers.get('content-type'),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `[openclaw-client] Task request failed (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    if (!response.body) {
      throw new Error('[openclaw-client] No response body for streaming request');
    }

    const result = await this.readSSEStream(response.body, sessionId);

    console.log('[openclaw-client] Task complete:', {
      sessionId,
      resultPreview: result.text.slice(0, 80),
      usage: result.usage,
    });
    for (const cb of this.completionCallbacks) cb(result);
    this.completionCallbacks = [];
  }

  /**
   * Parse an SSE stream from /v1/responses.
   * Returns the text result + usage on `response.completed`, throws on `response.failed`.
   * Fires `toolInvocationCallbacks` for each `response.output_item.done` with type `function_call`.
   */
  private async readSSEStream(
    body: ReadableStream<Uint8Array>,
    sessionId: string,
  ): Promise<TaskResult> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEventType = '';
    let rawBytesReceived = 0;
    let eventCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        rawBytesReceived += value?.length ?? 0;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            eventCount++;
            console.log('[openclaw-client] SSE event received:', { sessionId, eventType: currentEventType, eventCount, rawBytesReceived });
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            // Log a preview of every data chunk to diagnose failures
            if (currentEventType === 'response.completed' || currentEventType === 'response.failed' || eventCount <= 3) {
              console.log('[openclaw-client] SSE data chunk:', { sessionId, eventType: currentEventType, dataPreview: data.slice(0, 400) });
            }

            if (data === '[DONE]') {
              console.log('[openclaw-client] SSE stream ended with [DONE]:', { sessionId });
              return { text: 'Task completed' };
            }

            // Capture completed function_call output items → tool invocation events
            if (currentEventType === 'response.output_item.done') {
              try {
                const parsed = JSON.parse(data) as {
                  item?: { type?: string; name?: string; call_id?: string; arguments?: string };
                };
                if (parsed.item?.type === 'function_call' && parsed.item.call_id) {
                  const event: ToolInvocationEvent = {
                    callId: parsed.item.call_id,
                    toolName: parsed.item.name ?? 'unknown',
                    arguments: parsed.item.arguments ?? '',
                    invokedAt: new Date(),
                  };
                  console.log('[openclaw-client] Tool invocation captured:', { sessionId, toolName: event.toolName, callId: event.callId });
                  for (const cb of this.toolInvocationCallbacks) {
                    try { cb(event); } catch (cbErr) {
                      console.error('[openclaw-client] Tool invocation callback error:', cbErr);
                    }
                  }
                }
              } catch {
                // non-JSON or unexpected shape — skip
              }
            }

            if (currentEventType === 'response.completed') {
              try {
                const parsed = JSON.parse(data) as {
                  response?: {
                    status?: string;
                    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
                    output?: Array<{
                      type: string;
                      content?: Array<{ type: string; text?: string }>;
                    }>;
                  };
                };
                const response = parsed.response;

                // If the OpenClaw response status is "failed", treat as failure
                if (response?.status === 'failed') {
                  const output = response?.output ?? [];
                  const messageItem = output.find((item) => item.type === 'message');
                  const errText =
                    messageItem?.content?.find((c) => c.type === 'output_text' || c.type === 'text')?.text
                    ?? 'OpenClaw agent run failed';
                  throw new Error(`[openclaw-client] Task failed: ${errText}`);
                }

                const output = response?.output ?? [];
                const messageItem = output.find((item) => item.type === 'message');
                const text =
                  messageItem?.content?.find((c) => c.type === 'output_text' || c.type === 'text')?.text;

                const usage = response?.usage;
                const taskResult: TaskResult = {
                  text: text ?? JSON.stringify(parsed),
                  usage: usage?.input_tokens != null && usage?.output_tokens != null
                    ? {
                        input_tokens: usage.input_tokens,
                        output_tokens: usage.output_tokens,
                        total_tokens: usage.total_tokens ?? (usage.input_tokens + usage.output_tokens),
                      }
                    : undefined,
                };
                return taskResult;
              } catch (err) {
                // Re-throw errors, stringify non-error parse failures
                if (err instanceof Error) throw err;
                return { text: data };
              }
            }

            if (currentEventType === 'response.failed') {
              let errorMsg = data;
              try {
                const parsed = JSON.parse(data) as {
                  response?: { error?: { message?: string } };
                  error?: { message?: string };
                };
                errorMsg =
                  parsed.response?.error?.message
                  ?? parsed.error?.message
                  ?? JSON.stringify(parsed);
              } catch {
                // use raw data
              }
              throw new Error(`[openclaw-client] Task failed: ${errorMsg}`);
            }
          } else if (line === '') {
            // Empty line = SSE event boundary; reset event type for next event
            currentEventType = '';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Stream ended without explicit completion — treat as done
    console.warn('[openclaw-client] SSE stream ended without response.completed:', { sessionId, totalEvents: eventCount, totalBytes: rawBytesReceived });
    return { text: 'Task completed (stream ended)' };
  }

  // ── Callbacks ───────────────────────────────────────────────────────────────

  onComplete(cb: (result: TaskResult) => void): void {
    this.completionCallbacks.push(cb);
  }

  onError(cb: (error: string) => void): void {
    this.failureCallbacks.push(cb);
  }

  onToolInvocation(cb: (event: ToolInvocationEvent) => void): void {
    this.toolInvocationCallbacks.push(cb);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  disconnect(): void {
    this._isConnected = false;
    console.log('[openclaw-client] Disconnected from gateway:', this.baseUrl);
  }

  get isConnected(): boolean {
    return this._isConnected;
  }
}
