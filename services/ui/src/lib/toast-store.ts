import { SvelteMap } from 'svelte';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'chat' | 'execution' | 'danger';

export interface Toast {
  id: string;
  type: ToastType;
  text: string;
  retry?: () => void;
}

const toasts = new SvelteMap<string, Toast>();

export function addToast(text: string, type: ToastType = 'info', retry?: () => void): string {
  const id = crypto.randomUUID();
  toasts.set(id, { id, type, text, retry });
  setTimeout(() => removeToast(id), 4000);
  return id;
}

export function removeToast(id: string): void {
  toasts.delete(id);
}

export function getToasts(): Iterable<Toast> {
  return toasts.values();
}

export function toast(text: string, type?: ToastType): string {
  return addToast(text, type);
}

export function success(text: string): string {
  return addToast(text, 'success');
}

export function error(text: string, retry?: () => void): string {
  return addToast(text, 'error', retry);
}

export function warning(text: string): string {
  return addToast(text, 'warning');
}

export function info(text: string): string {
  return addToast(text, 'info');
}
