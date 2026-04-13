export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'chat' | 'execution' | 'danger';

export interface Toast {
  id: string;
  type: ToastType;
  text: string;
  retry?: () => void;
}

let toasts: Toast[] = $state([]);

const MAX_TOASTS = 5;

export function addToast(text: string, type: ToastType = 'info', retry?: () => void): string {
  const id = crypto.randomUUID();
  toasts = [{ id, type, text, retry }, ...toasts].slice(0, MAX_TOASTS);
  setTimeout(() => removeToast(id), 4000);
  return id;
}

export function removeToast(id: string): void {
  toasts = toasts.filter(t => t.id !== id);
}

export function getToasts(): Toast[] {
  return toasts;
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
