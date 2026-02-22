import { browser } from '$app/environment';
import type { ActivityEvent, BotLogEntry, LifecycleNotification } from './types';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

const EVENT_TYPES = [
  'execution_status_changed',
  'task_claimed',
  'task_completed',
  'bot_started',
  'bot_stopped',
  'guardrail_triggered',
  'billing_event',
  'budget_exceeded',
] as const;

export function connectSSE(
  executionId: string,
  onEvent: (event: ActivityEvent) => void,
  onError?: (err: Event) => void,
): (() => void) | null {
  if (!browser) return null;

  const es = new EventSource(`${BASE}/executions/${executionId}/events`);

  for (const type of EVENT_TYPES) {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as Record<string, unknown>;
        const isAlert = type === 'guardrail_triggered' || type === 'budget_exceeded';
        onEvent({ ...payload, type, isAlert } as ActivityEvent);
      } catch {
        // ignore malformed events
      }
    });
  }

  if (onError) es.onerror = onError;

  return () => es.close();
}

const BOT_LOG_EVENTS = [
  'bot_started',
  'bot_stopped',
  'task_claimed',
  'task_completed',
  'guardrail_triggered',
  'tool_invocation',
] as const;

export function connectBotLogs(
  botId: string,
  onEvent: (entry: BotLogEntry) => void,
  onError?: (err: Event) => void,
): (() => void) | null {
  if (!browser) return null;

  const es = new EventSource(`${BASE}/bots/${botId}/logs`);

  for (const type of BOT_LOG_EVENTS) {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as Record<string, unknown>;
        onEvent({ ...payload, type } as BotLogEntry);
      } catch {
        // ignore malformed events
      }
    });
  }

  if (onError) es.onerror = onError;

  return () => es.close();
}

const LIFECYCLE_EVENT_TYPES = [
  'soul_promoted',
  'soul_demoted',
  'soul_retired',
  'pioneer_detected',
] as const;

export function connectLifecycleSSE(
  onEvent: (event: LifecycleNotification) => void,
  onError?: (err: Event) => void,
): (() => void) | null {
  if (!browser) return null;

  const es = new EventSource(`${BASE}/events/lifecycle`);

  for (const type of LIFECYCLE_EVENT_TYPES) {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as Record<string, unknown>;
        onEvent({ ...payload, type } as LifecycleNotification);
      } catch {
        // ignore malformed events
      }
    });
  }

  if (onError) es.onerror = onError;

  return () => es.close();
}
