import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockOperation = {
  name: 'operation-123',
  status: 'DONE',
  error: undefined,
};

vi.mock('@google-cloud/compute', () => {
  const mockInstancesClient = {
    insert: vi.fn().mockResolvedValue([mockOperation]),
    delete: vi.fn().mockResolvedValue([{ name: 'delete-op-123' }]),
  };
  const mockZoneOperationsClient = {
    get: vi.fn().mockResolvedValue([mockOperation]),
  };

  class MockInstancesClient {
    insert = mockInstancesClient.insert;
    delete = mockInstancesClient.delete;
  }

  class MockZoneOperationsClient {
    get = mockZoneOperationsClient.get;
  }

  return {
    InstancesClient: MockInstancesClient,
    ZoneOperationsClient: MockZoneOperationsClient,
  };
});

const {
  launchBotVM,
  terminateBotVM,
} = await import('../../orchestrator/gce-bot-launcher.js');

interface LaunchBotVMOptions {
  botId: string;
  executionId: string;
  projectId: string;
  zone: string;
  network: string;
  subnet: string;
  toolGatewayUrl: string;
  executionServiceUrl: string;
  llmApiKeySecretName: string;
  llmProvider?: string;
  botServiceAccount: string;
  gatewayToken: string;
  soulContent: string;
}

interface TerminateBotVMOptions {
  projectId: string;
  zone: string;
  instanceName: string;
}

describe('gce-bot-launcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('launchBotVM', () => {
    it('creates a GCE instance and returns the instance name', async () => {
      const opts: LaunchBotVMOptions = {
        botId: '12345678-abcd-efgh-ijkl-123456789abc',
        executionId: 'exec-001',
        projectId: 'test-project',
        zone: 'us-central1-a',
        network: 'default',
        subnet: 'default',
        toolGatewayUrl: 'http://tool-gateway:3002',
        executionServiceUrl: 'http://localhost:3001',
        llmApiKeySecretName: 'llm-api-key',
        llmProvider: 'anthropic',
        botServiceAccount: 'test@project.iam.gserviceaccount.com',
        gatewayToken: 'test-token',
        soulContent: '# Test SOUL',
      };

      const result = await launchBotVM(opts);

      expect(result.instanceName).toMatch(/^bot-12345678-\d+$/);
    });

    it('throws when GCE insert operation fails', async () => {
      const { InstancesClient } = await import('@google-cloud/compute');
      const client = new InstancesClient() as Record<string, unknown>;
      (client.insert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('GCE quota exceeded'));

      const opts: LaunchBotVMOptions = {
        botId: '12345678-abcd-efgh-ijkl-123456789abc',
        executionId: 'exec-001',
        projectId: 'test-project',
        zone: 'us-central1-a',
        network: 'default',
        subnet: 'default',
        toolGatewayUrl: 'http://tool-gateway:3002',
        executionServiceUrl: 'http://localhost:3001',
        llmApiKeySecretName: 'llm-api-key',
        botServiceAccount: 'test@project.iam.gserviceaccount.com',
        gatewayToken: 'test-token',
        soulContent: '# Test SOUL',
      };

      await expect(launchBotVM(opts)).rejects.toThrow();
    });

    it('waits for operation to complete before returning', async () => {
      const { ZoneOperationsClient } = await import('@google-cloud/compute');
      const client = new ZoneOperationsClient() as Record<string, unknown>;

      const opts: LaunchBotVMOptions = {
        botId: '12345678-abcd-efgh-ijkl-123456789abc',
        executionId: 'exec-001',
        projectId: 'test-project',
        zone: 'us-central1-a',
        network: 'default',
        subnet: 'default',
        toolGatewayUrl: 'http://tool-gateway:3002',
        executionServiceUrl: 'http://localhost:3001',
        llmApiKeySecretName: 'llm-api-key',
        botServiceAccount: 'test@project.iam.gserviceaccount.com',
        gatewayToken: 'test-token',
        soulContent: '# Test SOUL',
      };

      await launchBotVM(opts);

      expect(client.get).toHaveBeenCalled();
    });
  });

  describe('terminateBotVM', () => {
    it('deletes the GCE instance', async () => {
      const { InstancesClient } = await import('@google-cloud/compute');
      const client = new InstancesClient() as Record<string, unknown>;

      const opts: TerminateBotVMOptions = {
        projectId: 'test-project',
        zone: 'us-central1-a',
        instanceName: 'bot-test-123',
      };

      await terminateBotVM(opts);

      expect(client.delete).toHaveBeenCalledWith({
        project: 'test-project',
        zone: 'us-central1-a',
        instance: 'bot-test-123',
      });
    });

    it('ignores 404 errors (instance already deleted)', async () => {
      const { InstancesClient } = await import('@google-cloud/compute');
      const client = new InstancesClient() as Record<string, unknown>;
      (client.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ code: 404, message: 'Not found' });

      const opts: TerminateBotVMOptions = {
        projectId: 'test-project',
        zone: 'us-central1-a',
        instanceName: 'already-deleted',
      };

      await expect(terminateBotVM(opts)).resolves.toBeUndefined();
    });

    it('throws for non-404 errors', async () => {
      const { InstancesClient } = await import('@google-cloud/compute');
      const client = new InstancesClient() as Record<string, unknown>;
      (client.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Access denied'));

      const opts: TerminateBotVMOptions = {
        projectId: 'test-project',
        zone: 'us-central1-a',
        instanceName: 'protected',
      };

      await expect(terminateBotVM(opts)).rejects.toThrow('Access denied');
    });
  });
});