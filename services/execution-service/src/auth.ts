import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@claw/db';
import { authUsers, authSessions, authAccounts, authVerifications } from '@claw/db';

const secret = process.env['AUTH_SECRET'] ?? 'dev-secret-change-me';

const publicUrl = process.env['PUBLIC_URL'];

export const auth = betterAuth({
  ...(publicUrl ? { baseURL: publicUrl } : {}),
  basePath: '/auth',
  secret,
  trustedOrigins: process.env['TRUSTED_ORIGINS']
    ? process.env['TRUSTED_ORIGINS'].split(',').map((o) => o.trim())
    : ['http://localhost:5173'],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authUsers,
      session: authSessions,
      account: authAccounts,
      verification: authVerifications,
    },
  }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    },
  },
  ...(publicUrl?.startsWith('http://') ? { advanced: { useSecureCookies: false } } : {}),
});
