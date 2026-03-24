import { describe, it, expect, beforeAll, afterEach } from 'vitest';

// ─── Setup ────────────────────────────────────────────────────────────────────
// 32-byte test key (base64-encoded)
const TEST_KEY = Buffer.from('a'.repeat(32), 'utf8').toString('base64');

beforeAll(() => {
  process.env['TOOL_ENCRYPTION_KEY'] = TEST_KEY;
});

afterEach(() => {
  // Reset the module cache so the key is re-read between tests
  // (not needed here but good practice)
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('credential-encryption', () => {
  it('encryptCredential returns object with ciphertext, iv, tag, keyVersion', async () => {
    const { encryptCredential } = await import('../services/credential-encryption.js');
    const result = encryptCredential('my-secret-token');
    expect(result).toHaveProperty('ciphertext');
    expect(result).toHaveProperty('iv');
    expect(result).toHaveProperty('tag');
    expect(result).toHaveProperty('keyVersion');
    expect(result.ciphertext).toBeTruthy();
    expect(result.iv).toBeTruthy();
    expect(result.tag).toBeTruthy();
    expect(result.keyVersion).toBe(1);
  });

  it('round-trips: decryptCredential(encryptCredential(x)) === x', async () => {
    const { encryptCredential, decryptCredential } = await import('../services/credential-encryption.js');
    const plaintext = 'hello world secret';
    const encrypted = encryptCredential(plaintext);
    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('decryptCredential with tampered ciphertext throws Error', async () => {
    const { encryptCredential, decryptCredential } = await import('../services/credential-encryption.js');
    const encrypted = encryptCredential('sensitive data');
    const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -2) + 'ff' };
    expect(() => decryptCredential(tampered)).toThrow();
  });

  it('decryptCredential with wrong iv throws Error', async () => {
    const { encryptCredential, decryptCredential } = await import('../services/credential-encryption.js');
    const encrypted = encryptCredential('another secret');
    // Generate a different IV by slightly modifying
    const wrongIv = '000000000000000000000000'; // 12-byte zero IV as hex
    const tampered = { ...encrypted, iv: wrongIv };
    expect(() => decryptCredential(tampered)).toThrow();
  });

  it('encryptCredential produces different ciphertext for same input (random IV)', async () => {
    const { encryptCredential } = await import('../services/credential-encryption.js');
    const plaintext = 'same text every time';
    const result1 = encryptCredential(plaintext);
    const result2 = encryptCredential(plaintext);
    // With random IV, ciphertexts will differ even for same input
    expect(result1.ciphertext).not.toBe(result2.ciphertext);
    expect(result1.iv).not.toBe(result2.iv);
  });
});
