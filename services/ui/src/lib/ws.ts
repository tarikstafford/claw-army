import { browser } from '$app/environment';

export interface LiveEvent {
  id: number;
  companyId: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export type HeartbeatRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out';

export interface HeartbeatRunPayload {
  runId: string;
  status: HeartbeatRunStatus;
  agentId?: string;
  finishedAt?: string;
}

export interface HeartbeatLogPayload {
  runId: string;
  chunk: string;
  stream?: 'stdout' | 'stderr' | 'system';
  ts?: string;
}

export interface HeartbeatEventPayload {
  runId: string;
  eventType?: string;
  message?: string;
  seq?: number;
}

type EventListener = (event: LiveEvent) => void;

let ws: WebSocket | null = null;
let listeners: EventListener[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnected = false;

export function connectWebSocket(companyId: string): (() => void) | undefined {
  if (!browser) return;
  if (ws && isConnected) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/api/companies/${companyId}/events/ws`;

  ws = new WebSocket(url);

  ws.onopen = () => { isConnected = true; };

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as LiveEvent;
      for (const listener of listeners) listener(event);
    } catch { /* ignore malformed */ }
  };

  ws.onclose = () => {
    isConnected = false;
    reconnectTimer = setTimeout(() => connectWebSocket(companyId), 3000);
  };

  ws.onerror = () => {
    ws?.close();
  };

  return () => {
    ws?.close();
    ws = null;
    isConnected = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}

export function subscribeWS(fn: EventListener): () => void {
  listeners = [...listeners, fn];
  return () => { listeners = listeners.filter(l => l !== fn); };
}

export function getConnectionStatus(): boolean {
  return isConnected;
}
