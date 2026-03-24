// Shared utility types for the Akasa SvelteKit UI (v6.0 Paperclip Foundation)
// Domain entity types are co-located in api.ts

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface Toast {
  id: string;
  type: string;
  text: string;
}
