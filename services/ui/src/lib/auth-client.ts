import { createAuthClient } from 'better-auth/client';

const baseURL = typeof window !== 'undefined'
  ? `${window.location.origin}/auth`
  : 'http://localhost/auth';

export const authClient = createAuthClient({
  baseURL,
});
