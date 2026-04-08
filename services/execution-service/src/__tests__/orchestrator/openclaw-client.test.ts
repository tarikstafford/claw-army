import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenClawClient } from '../../orchestrator/openclaw-client.js';

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

describe('openclaw-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('resolves successfully when gateway responds with 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: { cancel: vi.fn() },
      });

      const client = new OpenClawClient('http://10.0.0.5:18789', 'test-token');
      await client.connect();

      expect(client.isConnected).toBe(true);
    });

    it('throws after MAX_CONNECT_ATTEMPTS when fetch throws', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const client = new OpenClawClient('http://10.0.0.5:18789', 'test-token');
      await expect(client.connect()).rejects.toThrow(/Failed to connect/);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('sets isConnected to false when connection fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const client = new OpenClawClient('http://10.0.0.5:18789', 'test-token');
      await expect(client.connect()).rejects.toThrow();
      expect(client.isConnected).toBe(false);
    });
  });

  describe('sendTask', () => {
    it('throws when not connected', async () => {
      const client = new OpenClawClient('http://10.0.0.5:18789', 'test-token');
      await expect(client.sendTask('do something')).rejects.toThrow('not connected');
    });

    it('returns a sessionId when dispatched successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: {
          cancel: vi.fn(),
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true, value: new Uint8Array() }),
            releaseLock: vi.fn(),
          }),
        },
      });

      const client = new OpenClawClient('http://10.0.0.5:18789', 'test-token');
      await client.connect();

      const sessionId = await client.sendTask('do something');
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('disconnect', () => {
    it('sets isConnected to false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: { cancel: vi.fn() },
      });

      const client = new OpenClawClient('http://10.0.0.5:18789', 'test-token');
      await client.connect();
      expect(client.isConnected).toBe(true);

      client.disconnect();
      expect(client.isConnected).toBe(false);
    });
  });
});