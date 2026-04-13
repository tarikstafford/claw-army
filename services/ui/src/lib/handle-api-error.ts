import { goto } from '$app/navigation';
import { error as toastError, warning } from './toast-store';

export interface ApiErrorOptions {
  /** User-friendly message to display */
  message?: string;
  /** Whether to show a retry option for network errors */
  showRetry?: boolean;
  /** Custom retry handler - if not provided, no retry option is shown */
  onRetry?: () => void;
  /** Whether to suppress toast (just return the error) */
  suppressToast?: boolean;
}

export interface ApiErrorResult {
  message: string;
  status: number;
  isNetworkError: boolean;
  isUnauthorized: boolean;
}

function getFriendlyMessage(status: number, body?: string): string {
  if (body && body.length < 100) {
    return body;
  }

  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'A conflict occurred. Please try again.';
    case 422:
      return 'Validation failed. Please check your input.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Something went wrong on our end. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export function isUnauthorized(status: number): boolean {
  return status === 401;
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return true;
  }
  if (err instanceof Error && err.message.includes('network')) {
    return true;
  }
  return false;
}

export async function handleApiError(
  err: unknown,
  response?: Response,
  options: ApiErrorOptions = {}
): Promise<ApiErrorResult> {
  const { message, showRetry = false, onRetry, suppressToast = false } = options;

  let status = 0;
  let body: string | undefined;
  let isNetwork = false;

  if (err instanceof TypeError && err.message.includes('fetch')) {
    isNetwork = true;
  } else if (response) {
    status = response.status;
    body = await response.text().catch(() => undefined);
  } else if (err instanceof Error) {
    const match = err.message.match(/API error (\d+)/);
    if (match) {
      status = parseInt(match[1], 10);
    }
    body = err.message;
  }

  const isUnauthorized = status === 401;
  const friendlyMessage = message ?? getFriendlyMessage(status, body);

  if (isUnauthorized) {
    await goto('/auth');
    return { message: friendlyMessage, status, isNetworkError: isNetwork, isUnauthorized: true };
  }

  if (!suppressToast) {
    if (isNetwork && showRetry && onRetry) {
      toastError(friendlyMessage, onRetry);
    } else if (isNetwork) {
      toastError(friendlyMessage);
      warning('Check your connection and try again.');
    } else {
      toastError(friendlyMessage);
    }
  }

  return { message: friendlyMessage, status, isNetworkError: isNetwork, isUnauthorized: false };
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return 'An unexpected error occurred';
}
