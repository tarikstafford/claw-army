import { describe, it, expect } from 'vitest';
import { OAUTH_PROVIDERS, getOAuthProvider } from '../services/oauth-providers.js';

describe('oauth-providers', () => {
  describe('OAUTH_PROVIDERS', () => {
    it('contains all expected providers', () => {
      const expectedProviders = [
        'hubspot', 'slack', 'google-sheets', 'github', 'stripe',
        'linear', 'notion', 'gmail', 'google-calendar',
      ];
      for (const provider of expectedProviders) {
        expect(OAUTH_PROVIDERS).toHaveProperty(provider);
      }
    });

    it('every provider has required fields', () => {
      for (const [name, config] of Object.entries(OAUTH_PROVIDERS)) {
        expect(config.authorizeUrl).toBeTruthy();
        expect(config.tokenUrl).toBeTruthy();
        expect(config.scopes.length).toBeGreaterThan(0);
        expect(config.clientIdEnv).toBeTruthy();
        expect(config.clientSecretEnv).toBeTruthy();
      }
    });

    it('google-sheets has access_type=offline in extraAuthorizeParams', () => {
      const gs = OAUTH_PROVIDERS['google-sheets']!;
      expect(gs.extraAuthorizeParams?.access_type).toBe('offline');
      expect(gs.extraAuthorizeParams?.prompt).toBe('consent');
    });
  });

  describe('getOAuthProvider', () => {
    it('returns config for a known provider', () => {
      const config = getOAuthProvider('hubspot');
      expect(config).toBeDefined();
      expect(config!.authorizeUrl).toContain('hubspot.com');
    });

    it('returns undefined for unknown provider', () => {
      expect(getOAuthProvider('unknown-provider')).toBeUndefined();
    });
  });
});
