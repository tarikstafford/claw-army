import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';

// ─── Setup ────────────────────────────────────────────────────────────────────

const TEST_KEY = Buffer.from('a'.repeat(32), 'utf8').toString('base64');

beforeAll(() => {
  process.env['TOOL_ENCRYPTION_KEY'] = TEST_KEY;
});

beforeEach(() => {
  // Set required OAuth env vars
  process.env['HUBSPOT_CLIENT_ID'] = 'test-hub-id';
  process.env['HUBSPOT_CLIENT_SECRET'] = 'test-hub-secret';
  process.env['SLACK_CLIENT_ID'] = 'test-slack-id';
  process.env['SLACK_CLIENT_SECRET'] = 'test-slack-secret';
  process.env['GOOGLE_CLIENT_ID'] = 'test-google-id';
  process.env['GOOGLE_CLIENT_SECRET'] = 'test-google-secret';
  process.env['AKASA_BASE_URL'] = 'http://localhost:5173';
});

// ─── Mock @claw/db ────────────────────────────────────────────────────────────

const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn().mockResolvedValue([{ id: 'conn-1', toolId: 'hubspot' }]);
const mockInsertChain = { returning: mockInsertReturning };
mockInsertValues.mockReturnValue(mockInsertChain);

const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn().mockResolvedValue([{ id: 'conn-1', toolId: 'hubspot' }]);
const mockUpdateWhereChain = { returning: mockUpdateReturning };
mockUpdateWhere.mockReturnValue(mockUpdateWhereChain);
const mockUpdateSetChain = { where: mockUpdateWhere };
mockUpdateSet.mockReturnValue(mockUpdateSetChain);

vi.mock('@claw/db', () => {
  return {
    db: {
      insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
      update: vi.fn().mockReturnValue({ set: mockUpdateSet }),
    },
    toolConnections: {
      id: 'id',
      userId: 'user_id',
      toolId: 'tool_id',
      connectionType: 'connection_type',
      status: 'status',
      encryptedAccessToken: 'encrypted_access_token',
      encryptedRefreshToken: 'encrypted_refresh_token',
      encryptedApiKey: 'encrypted_api_key',
      tokenIv: 'token_iv',
      tokenTag: 'token_tag',
      refreshIv: 'refresh_iv',
      refreshTag: 'refresh_tag',
      apiKeyIv: 'api_key_iv',
      apiKeyTag: 'api_key_tag',
      tokenExpiresAt: 'token_expires_at',
      keyVersion: 'key_version',
      scopes: 'scopes',
      displayLabel: 'display_label',
      updatedAt: 'updated_at',
    },
    eq: vi.fn((a: unknown, b: unknown) => ({ eq: a, val: b })),
    and: vi.fn((...args: unknown[]) => ({ and: args })),
  };
});

// ─── App setup ────────────────────────────────────────────────────────────────

async function buildApp() {
  const { oauthFlowRouter } = await import('../routes/oauth-flow.js');
  const app = express();
  app.use(express.json());
  app.use('/akasa/tool-connections', oauthFlowRouter());
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /akasa/tool-connections/oauth/:toolId/start', () => {
  it('Test 1: redirects to HubSpot authorize URL with correct params', async () => {
    const app = await buildApp();
    const res = await supertest(app)
      .get('/akasa/tool-connections/oauth/hubspot/start?userId=user-123')
      .redirects(0);

    expect(res.status).toBe(302);
    const location = res.headers['location'] as string;
    expect(location).toContain('https://app.hubspot.com/oauth/authorize');
    expect(location).toContain('client_id=test-hub-id');
    expect(location).toContain('response_type=code');
    // state should contain userId and toolId
    const url = new URL(location);
    const state = url.searchParams.get('state');
    expect(state).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(state!, 'base64url').toString('utf8')) as {
      userId: string;
      toolId: string;
    };
    expect(decoded.userId).toBe('user-123');
    expect(decoded.toolId).toBe('hubspot');
  });

  it('Test 2: returns 400 when userId is missing', async () => {
    const app = await buildApp();
    const res = await supertest(app)
      .get('/akasa/tool-connections/oauth/hubspot/start')
      .redirects(0);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('userId');
  });

  it('Test 3: returns 404 for unknown provider', async () => {
    const app = await buildApp();
    const res = await supertest(app)
      .get('/akasa/tool-connections/oauth/unknown-tool/start?userId=user-123')
      .redirects(0);

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Unknown OAuth provider');
  });

  it('Test 4: returns 500 when HUBSPOT_CLIENT_ID env var is missing', async () => {
    delete process.env['HUBSPOT_CLIENT_ID'];
    const app = await buildApp();
    const res = await supertest(app)
      .get('/akasa/tool-connections/oauth/hubspot/start?userId=user-123')
      .redirects(0);

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('OAuth not configured');
  });

  it('Test 7: redirects to Slack authorize URL', async () => {
    const app = await buildApp();
    const res = await supertest(app)
      .get('/akasa/tool-connections/oauth/slack/start?userId=user-456')
      .redirects(0);

    expect(res.status).toBe(302);
    const location = res.headers['location'] as string;
    expect(location).toContain('https://slack.com/oauth/v2/authorize');
    expect(location).toContain('client_id=test-slack-id');
  });

  it('Test 8: redirects to Google Sheets authorize URL with access_type=offline', async () => {
    const app = await buildApp();
    const res = await supertest(app)
      .get('/akasa/tool-connections/oauth/google-sheets/start?userId=user-789')
      .redirects(0);

    expect(res.status).toBe(302);
    const location = res.headers['location'] as string;
    expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location).toContain('client_id=test-google-id');
    expect(location).toContain('access_type=offline');
    expect(location).toContain('prompt=consent');
  });
});

describe('GET /akasa/tool-connections/oauth/:toolId/callback', () => {
  it('Test 5: exchanges code for tokens, persists, and redirects to success URL', async () => {
    // Mock global fetch for token exchange
    const mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expires_in: 3600,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const app = await buildApp();

    // Build state param
    const statePayload = JSON.stringify({
      userId: 'user-123',
      toolId: 'hubspot',
      redirectUri: 'http://localhost:5173/tools/callback',
    });
    const state = Buffer.from(statePayload).toString('base64url');

    const res = await supertest(app)
      .get(`/akasa/tool-connections/oauth/hubspot/callback?code=auth-code-123&state=${state}`)
      .redirects(0);

    expect(res.status).toBe(302);
    const location = res.headers['location'] as string;
    expect(location).toContain('connected=hubspot');
    expect(location).toContain('http://localhost:5173/tools');

    vi.unstubAllGlobals();
  });

  it('Test 6: returns 400 when code is missing', async () => {
    const app = await buildApp();

    const statePayload = JSON.stringify({
      userId: 'user-123',
      toolId: 'hubspot',
      redirectUri: 'http://localhost:5173/tools/callback',
    });
    const state = Buffer.from(statePayload).toString('base64url');

    const res = await supertest(app)
      .get(`/akasa/tool-connections/oauth/hubspot/callback?state=${state}`)
      .redirects(0);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('code');
  });

  it('exchanges Slack code for tokens with ok:true response format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        ok: true,
        access_token: 'slack-access-token',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const app = await buildApp();

    const statePayload = JSON.stringify({
      userId: 'user-456',
      toolId: 'slack',
      redirectUri: 'http://localhost:5173/tools/callback',
    });
    const state = Buffer.from(statePayload).toString('base64url');

    const res = await supertest(app)
      .get(`/akasa/tool-connections/oauth/slack/callback?code=slack-code&state=${state}`)
      .redirects(0);

    expect(res.status).toBe(302);
    const location = res.headers['location'] as string;
    expect(location).toContain('connected=slack');

    vi.unstubAllGlobals();
  });
});
