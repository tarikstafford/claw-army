import { describe, it, expect, vi, beforeEach } from 'vitest';

const compactDecrypt = vi.fn();

vi.mock('jose', () => ({
  compactDecrypt,
}));

const hkdfSync = vi.fn().mockReturnValue(new ArrayBuffer(64));

vi.mock('node:crypto', () => ({
  default: { hkdfSync },
  hkdfSync,
}));

describe('verify-auth-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('header validation', () => {
    it('returns false when Authorization header is undefined', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      const result = await verifyAuthToken(undefined);

      expect(result).toBe(false);
    });

    it('returns false when Authorization header does not start with Bearer', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      const result = await verifyAuthToken('Basic abc123');

      expect(result).toBe(false);
    });

    it('returns false when token is empty after stripping Bearer prefix', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      const result = await verifyAuthToken('Bearer ');

      expect(result).toBe(false);
    });
  });

  describe('AUTH_SECRET validation', () => {
    it('throws when AUTH_SECRET is not configured', async () => {
      vi.stubEnv('AUTH_SECRET', '');
      // Clear the module cache to re-evaluate with empty AUTH_SECRET
      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      await expect(verifyAuthToken('Bearer some-token')).rejects.toThrow(
        'AUTH_SECRET not configured',
      );
    });
  });

  describe('successful decryption', () => {
    it('returns true when decrypted payload contains email', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      const payload = JSON.stringify({ email: 'user@example.com', sub: 'user-1' });
      compactDecrypt.mockResolvedValue({
        plaintext: Buffer.from(payload),
      });

      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      const result = await verifyAuthToken('Bearer valid-jwe-token');

      expect(result).toBe(true);
      expect(hkdfSync).toHaveBeenCalledWith(
        'sha256',
        'test-secret',
        'authjs.session-token',
        'Auth.js Generated Encryption Key (authjs.session-token)',
        64,
      );
    });

    it('returns true when decrypted payload contains sub but no email', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      const payload = JSON.stringify({ sub: 'user-1' });
      compactDecrypt.mockResolvedValue({
        plaintext: Buffer.from(payload),
      });

      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      const result = await verifyAuthToken('Bearer valid-jwe-token');

      expect(result).toBe(true);
    });

    it('tries second salt when first salt fails', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      const payload = JSON.stringify({ email: 'user@example.com' });

      // First call (dev salt) fails, second call (prod salt) succeeds
      compactDecrypt
        .mockRejectedValueOnce(new Error('decryption failed'))
        .mockResolvedValueOnce({ plaintext: Buffer.from(payload) });

      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      const result = await verifyAuthToken('Bearer valid-jwe-token');

      expect(result).toBe(true);
      expect(compactDecrypt).toHaveBeenCalledTimes(2);
      // Second call should use the prod salt
      expect(hkdfSync).toHaveBeenCalledWith(
        'sha256',
        'test-secret',
        '__Secure-authjs.session-token',
        'Auth.js Generated Encryption Key (__Secure-authjs.session-token)',
        64,
      );
    });
  });

  describe('decryption failure', () => {
    it('returns false when both salts fail to decrypt', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      compactDecrypt
        .mockRejectedValueOnce(new Error('decryption failed'))
        .mockRejectedValueOnce(new Error('decryption failed'));

      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      const result = await verifyAuthToken('Bearer invalid-jwe-token');

      expect(result).toBe(false);
      expect(compactDecrypt).toHaveBeenCalledTimes(2);
    });

    it('returns false when decrypted payload lacks email and sub', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      const payload = JSON.stringify({ name: 'Some User', role: 'admin' });
      compactDecrypt.mockResolvedValue({
        plaintext: Buffer.from(payload),
      });

      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      const result = await verifyAuthToken('Bearer valid-jwe-token');

      expect(result).toBe(false);
    });
  });

  describe('HKDF key derivation', () => {
    it('derives 64-byte key using SHA-256 with correct parameters', async () => {
      vi.stubEnv('AUTH_SECRET', 'my-auth-secret');
      const payload = JSON.stringify({ email: 'test@test.com' });
      compactDecrypt.mockResolvedValue({
        plaintext: Buffer.from(payload),
      });

      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      await verifyAuthToken('Bearer some-token');

      expect(hkdfSync).toHaveBeenCalledWith(
        'sha256',
        'my-auth-secret',
        'authjs.session-token',
        'Auth.js Generated Encryption Key (authjs.session-token)',
        64,
      );
    });

    it('passes derived key as Uint8Array to compactDecrypt', async () => {
      vi.stubEnv('AUTH_SECRET', 'test-secret');
      const keyBuffer = new ArrayBuffer(64);
      hkdfSync.mockReturnValue(keyBuffer);

      const payload = JSON.stringify({ email: 'test@test.com' });
      compactDecrypt.mockResolvedValue({
        plaintext: Buffer.from(payload),
      });

      const { verifyAuthToken } = await import('../../lib/verify-auth-token.js');

      await verifyAuthToken('Bearer some-token');

      const passedKey = compactDecrypt.mock.calls[0]![1];
      expect(passedKey).toBeInstanceOf(Uint8Array);
      expect(passedKey.byteLength).toBe(64);
    });
  });
});
