import { browser } from '$app/environment';

export interface LiveEvent {
  id: number;
  companyId: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface SoulPromotedPayload {
  type: 'soul_promoted';
  botId: string;
  executionId: string;
  taskCategory: string;
  fromClass: 'Novice' | 'Understudy';
  toClass: 'Understudy' | 'Artisan';
  description: string;
  timestamp: string;
}

export interface SoulDemotedPayload {
  type: 'soul_demoted';
  botId: string;
  executionId: string;
  taskCategory: string;
  fromClass: 'Understudy' | 'Artisan';
  toClass: 'Novice' | 'Understudy';
  description: string;
  timestamp: string;
}

export interface SoulRetiredPayload {
  type: 'soul_retired';
  botId: string;
  executionId: string;
  taskCategory: string;
  fromClass: 'Novice' | 'Understudy' | 'Artisan';
  description: string;
  timestamp: string;
}

export interface PioneerDetectedPayload {
  type: 'pioneer_detected';
  botId: string;
  executionId: string;
  taskCategory: string;
  description: string;
  timestamp: string;
}

export type FleetLifecycleEvent = SoulPromotedPayload | SoulDemotedPayload | SoulRetiredPayload | PioneerDetectedPayload;

export function isFleetLifecycleEvent(event: LiveEvent): event is LiveEvent & { payload: FleetLifecycleEvent } {
  return ['soul_promoted', 'soul_demoted', 'soul_retired', 'pioneer_detected'].includes(event.type);
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
