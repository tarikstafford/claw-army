import { createAuthClient } from 'better-auth/client';

const baseURL = typeof window !== 'undefined'
  ? `${window.location.origin}/api`
  : 'http://localhost/api';

export const authClient = createAuthClient({
  baseURL,
});
