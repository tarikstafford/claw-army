import { browser } from '$app/environment';
import type { ActivityEvent } from './types';

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
