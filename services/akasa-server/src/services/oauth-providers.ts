// ─── Types ────────────────────────────────────────────────────────────────────

export interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Extra query params to append to the authorization URL */
  extraAuthorizeParams?: Record<string, string>;
}

// ─── Provider Configurations ─────────────────────────────────────────────────

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  hubspot: {
    authorizeUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
    ],
    clientIdEnv: 'HUBSPOT_CLIENT_ID',
    clientSecretEnv: 'HUBSPOT_CLIENT_SECRET',
  },
  slack: {
    authorizeUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'channels:read'],
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
  },
  'google-sheets': {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    extraAuthorizeParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'read:user', 'read:org'],
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Looks up an OAuth provider config by toolId.
 * Returns undefined if the toolId is not a known OAuth provider.
 */
export function getOAuthProvider(toolId: string): OAuthProviderConfig | undefined {
  return OAUTH_PROVIDERS[toolId];
}
