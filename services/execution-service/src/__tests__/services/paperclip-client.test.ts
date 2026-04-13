import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listCompaniesForUser,
  createCompanyForUser,
  createAgentInCompany,
} from '../../services/paperclip-client.js';

vi.mock('@claw/db', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
  };
  return {
    db: mockDb,
    companies: { id: 'id', name: 'name', status: 'status', budgetMonthlyCents: 'budget_monthly_cents', description: 'description', issuePrefix: 'issue_prefix' },
    companyMemberships: { id: 'id', companyId: 'company_id', principalType: 'principal_type', principalId: 'principal_id', status: 'status', membershipRole: 'membership_role' },
    paperclipAgents: { id: 'id', companyId: 'company_id', name: 'name', role: 'role', title: 'title', status: 'status', metadata: 'metadata' },
    instanceUserRoles: { id: 'id', userId: 'user_id', role: 'role' },
    projects: { id: 'id', companyId: 'company_id', name: 'name', description: 'description', status: 'status' },
  };
});

const mockDb = vi.mocked(await import('@claw/db')).db;

describe('paperclip-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCompaniesForUser', () => {
    it('returns empty array when user has no memberships', async () => {
      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await listCompaniesForUser('user-123');

      expect(result).toEqual([]);
    });

    it('returns companies filtered by membership and active status', async () => {
      const mockMemberships = [
        { companyId: 'company-1' },
        { companyId: 'company-2' },
      ];

      const mockCompanies = [
        { id: 'company-1', name: 'Acme', status: 'active', budgetMonthlyCents: 1000 },
        { id: 'company-2', name: 'Beta', status: 'active', budgetMonthlyCents: 2000 },
        { id: 'company-3', name: 'Gamma', status: 'active', budgetMonthlyCents: 3000 },
      ];

      let callCount = 0;
      vi.mocked(mockDb.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockMemberships),
            }),
          } as any;
        } else {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockCompanies),
            }),
          } as any;
        }
      });

      const result = await listCompaniesForUser('user-123');

      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toContain('company-1');
      expect(result.map(c => c.id)).toContain('company-2');
      expect(result.map(c => c.id)).not.toContain('company-3');
    });
  });

  describe('createCompanyForUser', () => {
    it('creates a company and membership for user', async () => {
      const mockCompany = {
        id: 'company-new',
        name: 'New Company',
        status: 'active',
        budgetMonthlyCents: 500,
      };

      let insertCallCount = 0;
      vi.mocked(mockDb.insert).mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockCompany]),
            }),
          } as any;
        }
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        } as any;
      });

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await createCompanyForUser('user-123', {
        name: 'New Company',
        description: 'A new company',
        budgetMonthlyCents: 500,
      });

      expect(result.id).toBe('company-new');
      expect(result.name).toBe('New Company');
      expect(result.status).toBe('active');
      expect(result.budgetMonthlyCents).toBe(500);
    });

    it('throws error when company insert returns no rows', async () => {
      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await expect(
        createCompanyForUser('user-123', { name: 'Fail Company' }),
      ).rejects.toThrow('Failed to insert company');
    });

    it('does not create instance_admin role if user already has it', async () => {
      const mockCompany = {
        id: 'company-new',
        name: 'New Company',
        status: 'active',
        budgetMonthlyCents: 0,
      };

      let insertCallCount = 0;
      vi.mocked(mockDb.insert).mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockCompany]),
            }),
          } as any;
        }
        return {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        } as any;
      });

      vi.mocked(mockDb.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'existing-role' }]),
        }),
      } as any);

      await createCompanyForUser('user-123', { name: 'New Company' });

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('createAgentInCompany', () => {
    it('creates an agent and company membership', async () => {
      const mockAgent = {
        id: 'agent-new',
        companyId: 'company-1',
        name: 'New Agent',
        role: 'general',
        title: 'AI Agent',
        status: 'idle',
      };

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAgent]),
        }),
      } as any);

      const result = await createAgentInCompany('company-1', {
        name: 'New Agent',
        role: 'general',
        title: 'AI Agent',
      });

      expect(result.id).toBe('agent-new');
      expect(result.companyId).toBe('company-1');
      expect(result.name).toBe('New Agent');
      expect(result.role).toBe('general');
      expect(result.status).toBe('idle');
    });

    it('throws error when agent insert returns no rows', async () => {
      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      await expect(
        createAgentInCompany('company-1', {
          name: 'Fail Agent',
          role: 'general',
          title: 'Fail',
        }),
      ).rejects.toThrow('Failed to insert agent');
    });

    it('includes metadata when provided', async () => {
      const mockAgent = {
        id: 'agent-new',
        companyId: 'company-1',
        name: 'New Agent',
        role: 'general',
        title: 'AI Agent',
        status: 'idle',
      };

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockAgent]),
        }),
      } as any);

      const metadata = { customField: 'value' };

      await createAgentInCompany('company-1', {
        name: 'New Agent',
        role: 'general',
        title: 'AI Agent',
        metadata,
      });

      const insertMock = vi.mocked(mockDb.insert);
      expect(insertMock).toHaveBeenCalled();
    });
  });
});
