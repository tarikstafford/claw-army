import { createAuthClient } from 'better-auth/client';

const baseURL = typeof window !== 'undefined'
  ? `${window.location.origin}/api/auth`
  : 'http://localhost/api/auth';

export const authClient = createAuthClient({
  baseURL,
});
