import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Message sent to OpenClaw Gateway to start a task session.
 * NOTE: The exact OpenClaw sessions API message schema is pending verification
 * from the OpenClaw Gateway source. Adjust `type` and field names once confirmed.
 */
interface RunTaskMessage {
  type: 'run_task';
  sessionId: string;
  prompt: string;
}

/**
 * Completion message received from OpenClaw Gateway when a task finishes.
 */
interface TaskCompleteMessage {
  type: 'task_complete';
  sessionId: string;
  result: string;
}

/**
 * Error message received from OpenClaw Gateway when a task fails.
 */
interface TaskFailedMessage {
  type: 'task_failed';
  sessionId: string;
  error: string;
}

type InboundMessage = TaskCompleteMessage | TaskFailedMessage | { type: string; [key: string]: unknown };

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
 * via the sessions WebSocket API. Handles reconnection up to MAX_RECONNECT_ATTEMPTS
 * before marking the bot as failed.
 *
 * Usage:
 *   const client = new OpenClawClient('ws://10.0.0.5:18789');
 *   await client.connect();
 *   await client.sendTask('Write a summary of...');
 *   client.onComplete((result) => console.log(result));
 */
export class OpenClawClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private completionCallbacks: Array<(result: string) => void> = [];
  private failureCallbacks: Array<(error: string) => void> = [];
  private _isConnected = false;

  constructor(
    private readonly wsUrl: string,
    private readonly token?: string,
  ) {}

  // ── Connection ──────────────────────────────────────────────────────────────

  /**
   * Connect to the OpenClaw Gateway WebSocket.
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

        const wsOptions = this.token
          ? { headers: { 'OpenClaw-Token': this.token } }
          : undefined;
        const ws = new WebSocket(this.wsUrl, wsOptions);
        const connectTimeout = setTimeout(() => {
          ws.terminate();
          this.handleReconnect(resolve, reject);
        }, CONNECT_TIMEOUT_MS);

        ws.on('open', () => {
          clearTimeout(connectTimeout);
          this.ws = ws;
          this._isConnected = true;
          this.reconnectAttempts = 0;
          console.log('[openclaw-client] Connected:', this.wsUrl);
          resolve();
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
          // Notify failure callbacks so pending tasks don't hang
          this.failureCallbacks.forEach((cb) =>
            cb(`Connection closed (code=${code})`),
          );
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

    if (msg.type === 'task_complete') {
      const completion = msg as TaskCompleteMessage;
      this.completionCallbacks.forEach((cb) => cb(completion.result));
      this.completionCallbacks = [];
    } else if (msg.type === 'task_failed') {
      const failure = msg as TaskFailedMessage;
      this.failureCallbacks.forEach((cb) => cb(failure.error));
      this.failureCallbacks = [];
    }
    // Other message types (progress, logs, etc.) are forwarded to onMessage handlers if added later
  }

  // ── Task dispatch ───────────────────────────────────────────────────────────

  /**
   * Send a task to the OpenClaw Gateway.
   * The task runs asynchronously; listen for results via onComplete / onError.
   *
   * @param taskDescription - The plain-text task prompt for OpenClaw to execute
   * @returns sessionId — the unique identifier for this task session
   */
  async sendTask(taskDescription: string): Promise<string> {
    if (!this.ws || !this._isConnected) {
      throw new Error('[openclaw-client] Cannot send task: not connected');
    }

    const sessionId = randomUUID();
    const message: RunTaskMessage = {
      type: 'run_task',
      sessionId,
      prompt: taskDescription,
    };

    return new Promise<string>((resolve, reject) => {
      this.ws!.send(JSON.stringify(message), (err) => {
        if (err) {
          reject(new Error(`[openclaw-client] Failed to send task: ${err.message}`));
        } else {
          console.log('[openclaw-client] Task sent:', { sessionId, promptPreview: taskDescription.slice(0, 80) });
          resolve(sessionId);
        }
      });
    });
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
