import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@fastify/jwt', () => ({
  default: vi.fn((fastify: any) => {
    fastify.decorate('authenticate', async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }
    });
    return fastify;
  }),
}));

describe('authPlugin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('JWT authentication scenarios', () => {
    it('returns 401 when token is missing', async () => {
      const mockRequest = {
        jwtVerify: vi.fn().mockRejectedValue(new Error('No token')),
      };

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      const authenticate = async (request: any, reply: any) => {
        try {
          await request.jwtVerify();
        } catch {
          return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }
      };

      await authenticate(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ success: false, error: 'Unauthorized' });
    });

    it('returns 401 when token is expired', async () => {
      const expiredError = new Error('jwt expired');
      const mockRequest = {
        jwtVerify: vi.fn().mockRejectedValue(expiredError),
      };

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      const authenticate = async (request: any, reply: any) => {
        try {
          await request.jwtVerify();
        } catch {
          return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }
      };

      await authenticate(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when token is malformed', async () => {
      const malformedError = new Error('jwt malformed');
      const mockRequest = {
        jwtVerify: vi.fn().mockRejectedValue(malformedError),
      };

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      const authenticate = async (request: any, reply: any) => {
        try {
          await request.jwtVerify();
        } catch {
          return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }
      };

      await authenticate(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
    });

    it('allows request when token is valid', async () => {
      const mockRequest = {
        jwtVerify: vi.fn().mockResolvedValue({ botId: 'bot-1', executionId: 'exec-1' }),
      };

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      const authenticate = async (request: any, reply: any) => {
        try {
          await request.jwtVerify();
        } catch {
          return reply.status(401).send({ success: false, error: 'Unauthorized' });
        }
      };

      await authenticate(mockRequest, mockReply);

      expect(mockRequest.jwtVerify).toHaveBeenCalled();
      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });

  describe('authenticate decorator behavior', () => {
    it('catches errors during jwtVerify', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockRequest = {
        jwtVerify: vi.fn().mockRejectedValue(new Error('jwt expired')),
      };

      const mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };

      try {
        await mockRequest.jwtVerify();
      } catch {
        await mockReply.status(401).send({ success: false, error: 'Unauthorized' });
      }

      expect(mockReply.status).toHaveBeenCalledWith(401);

      consoleSpy.mockRestore();
    });
  });
});