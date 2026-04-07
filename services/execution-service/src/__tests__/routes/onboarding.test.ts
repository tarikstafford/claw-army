import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { onboardingRoutes } from '../../routes/onboarding.js';

vi.mock('../../services/paperclip-client.js', () => ({
  listCompaniesForUser: vi.fn(),
  createCompanyForUser: vi.fn(),
  createAgentInCompany: vi.fn(),
}));

vi.mock('../../auth.js', () => ({
  auth: {
    handler: vi.fn(),
  },
}));

describe('onboardingRoutes', () => {
  let app: Awaited<ReturnType<typeof Fastify>>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(onboardingRoutes, { prefix: '/onboarding' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('GET /onboarding/status', () => {
    it('returns 401 when not authenticated (no cookie)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/onboarding/status',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Not authenticated');
    });

    it('returns 401 when auth handler returns non-ok', async () => {
      const { auth } = await import('../../auth.js');
      vi.mocked(auth.handler).mockResolvedValue(new Response('Unauthorized', { status: 401 }));

      const res = await app.inject({
        method: 'GET',
        url: '/onboarding/status',
        headers: { cookie: 'session=test' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns onboarded: true when user has companies', async () => {
      const { auth } = await import('../../auth.js');
      const { listCompaniesForUser } = await import('../../services/paperclip-client.js');

      vi.mocked(auth.handler).mockResolvedValue(
        new Response(JSON.stringify({ session: { userId: 'user-123' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.mocked(listCompaniesForUser).mockResolvedValue([
        { id: 'company-1', name: 'Test Corp' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/onboarding/status',
        headers: { cookie: 'session=test' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.onboarded).toBe(true);
      expect(body.companyId).toBe('company-1');
    });

    it('returns onboarded: false when user has no companies', async () => {
      const { auth } = await import('../../auth.js');
      const { listCompaniesForUser } = await import('../../services/paperclip-client.js');

      vi.mocked(auth.handler).mockResolvedValue(
        new Response(JSON.stringify({ session: { userId: 'user-123' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.mocked(listCompaniesForUser).mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/onboarding/status',
        headers: { cookie: 'session=test' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.onboarded).toBe(false);
      expect(body.companyId).toBeNull();
    });

    it('returns onboarded: false when paperclip client throws', async () => {
      const { auth } = await import('../../auth.js');
      const { listCompaniesForUser } = await import('../../services/paperclip-client.js');

      vi.mocked(auth.handler).mockResolvedValue(
        new Response(JSON.stringify({ session: { userId: 'user-123' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.mocked(listCompaniesForUser).mockRejectedValue(new Error('Network error'));

      const res = await app.inject({
        method: 'GET',
        url: '/onboarding/status',
        headers: { cookie: 'session=test' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.onboarded).toBe(false);
    });
  });

  describe('POST /onboarding/summon', () => {
    const validBody = {
      businessType: 'SaaS',
      firstGoal: 'Increase sales',
      budget: '50-200',
      companyName: 'Acme Corp',
    };

    it('returns 401 when not authenticated', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/onboarding/summon',
        payload: validBody,
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 500 when company creation fails', async () => {
      const { auth } = await import('../../auth.js');
      const { createCompanyForUser } = await import('../../services/paperclip-client.js');

      vi.mocked(auth.handler).mockResolvedValue(
        new Response(JSON.stringify({ session: { userId: 'user-123' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.mocked(createCompanyForUser).mockRejectedValue(new Error('Creation failed'));

      const res = await app.inject({
        method: 'POST',
        url: '/onboarding/summon',
        headers: { cookie: 'session=test' },
        payload: validBody,
      });

      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Failed to create company');
    });

    it('returns company and agents on success with budget 50-200', async () => {
      const { auth } = await import('../../auth.js');
      const { createCompanyForUser, createAgentInCompany } = await import('../../services/paperclip-client.js');

      vi.mocked(auth.handler).mockResolvedValue(
        new Response(JSON.stringify({ session: { userId: 'user-123' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.mocked(createCompanyForUser).mockResolvedValue({
        id: 'company-new',
        name: 'Acme Corp',
      });
      vi.mocked(createAgentInCompany).mockResolvedValue({ id: 'agent-new' });

      const res = await app.inject({
        method: 'POST',
        url: '/onboarding/summon',
        headers: { cookie: 'session=test' },
        payload: validBody,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.companyId).toBe('company-new');
      expect(body.companyName).toBe('Acme Corp');
      expect(body.agents).toBeDefined();
      expect(body.agents.length).toBeGreaterThan(0);
    });

    it('includes finance agent when budget is not <50', async () => {
      const { auth } = await import('../../auth.js');
      const { createCompanyForUser, createAgentInCompany } = await import('../../services/paperclip-client.js');

      vi.mocked(auth.handler).mockResolvedValue(
        new Response(JSON.stringify({ session: { userId: 'user-123' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.mocked(createCompanyForUser).mockResolvedValue({
        id: 'company-new',
        name: 'Acme Corp',
      });
      vi.mocked(createAgentInCompany).mockResolvedValue({ id: 'agent-new' });

      await app.inject({
        method: 'POST',
        url: '/onboarding/summon',
        headers: { cookie: 'session=test' },
        payload: validBody,
      });

      const calls = vi.mocked(createAgentInCompany).mock.calls;
      const financeCall = calls.find((call) => {
        const meta = call[1] as { metadata?: { archetype?: string } };
        return meta?.metadata?.archetype === 'Cautious Verifier';
      });
      expect(financeCall).toBeDefined();
    });

    it('does not include finance agent when budget is <50', async () => {
      const { auth } = await import('../../auth.js');
      const { createCompanyForUser, createAgentInCompany } = await import('../../services/paperclip-client.js');

      vi.mocked(auth.handler).mockResolvedValue(
        new Response(JSON.stringify({ session: { userId: 'user-123' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.mocked(createCompanyForUser).mockResolvedValue({
        id: 'company-new',
        name: 'Acme Corp',
      });
      vi.mocked(createAgentInCompany).mockResolvedValue({ id: 'agent-new' });

      await app.inject({
        method: 'POST',
        url: '/onboarding/summon',
        headers: { cookie: 'session=test' },
        payload: { ...validBody, budget: '<50' },
      });

      const calls = vi.mocked(createAgentInCompany).mock.calls;
      const financeCall = calls.find((call) => {
        const meta = call[1] as { metadata?: { archetype?: string } };
        return meta?.metadata?.archetype === 'Cautious Verifier';
      });
      expect(financeCall).toBeUndefined();
    });

    it('maps budget <50 to haiku tier', async () => {
      const { auth } = await import('../../auth.js');
      const { createCompanyForUser, createAgentInCompany } = await import('../../services/paperclip-client.js');

      vi.mocked(auth.handler).mockResolvedValue(
        new Response(JSON.stringify({ session: { userId: 'user-123' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.mocked(createCompanyForUser).mockResolvedValue({
        id: 'company-new',
        name: 'Acme Corp',
      });
      vi.mocked(createAgentInCompany).mockResolvedValue({ id: 'agent-new' });

      await app.inject({
        method: 'POST',
        url: '/onboarding/summon',
        headers: { cookie: 'session=test' },
        payload: { ...validBody, budget: '<50' },
      });

      const marketingCall = vi.mocked(createAgentInCompany).mock.calls.find((call) => {
        return call[1] && (call[1] as { role?: string }).role === 'marketing';
      });
      expect(marketingCall).toBeDefined();
      const tier = (marketingCall![1] as { metadata?: { tier?: string } }).metadata?.tier;
      expect(tier).toBe('haiku');
    });

    it('maps budget 50-200 to sonnet tier', async () => {
      const { auth } = await import('../../auth.js');
      const { createCompanyForUser, createAgentInCompany } = await import('../../services/paperclip-client.js');

      vi.mocked(auth.handler).mockResolvedValue(
        new Response(JSON.stringify({ session: { userId: 'user-123' } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.mocked(createCompanyForUser).mockResolvedValue({
        id: 'company-new',
        name: 'Acme Corp',
      });
      vi.mocked(createAgentInCompany).mockResolvedValue({ id: 'agent-new' });

      await app.inject({
        method: 'POST',
        url: '/onboarding/summon',
        headers: { cookie: 'session=test' },
        payload: validBody,
      });

      const marketingCall = vi.mocked(createAgentInCompany).mock.calls.find((call) => {
        return call[1] && (call[1] as { role?: string }).role === 'marketing';
      });
      expect(marketingCall).toBeDefined();
      const tier = (marketingCall![1] as { metadata?: { tier?: string } }).metadata?.tier;
      expect(tier).toBe('sonnet');
    });
  });
});
