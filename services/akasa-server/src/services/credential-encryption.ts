import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// ─── Key loading ─────────────────────────────────────────────────────────────

function loadEncryptionKey(): Buffer {
  const toolKey = process.env['TOOL_ENCRYPTION_KEY'];
  if (toolKey && toolKey.trim().length > 0) {
    const decoded = Buffer.from(toolKey.trim(), 'base64');
    if (decoded.length === 32) return decoded;
    // Try hex
    if (/^[A-Fa-f0-9]{64}$/.test(toolKey.trim())) {
      return Buffer.from(toolKey.trim(), 'hex');
    }
    // Try raw UTF-8 (32 chars)
    if (Buffer.byteLength(toolKey.trim(), 'utf8') === 32) {
      return Buffer.from(toolKey.trim(), 'utf8');
    }
  }

  const fallbackKey = process.env['PAPERCLIP_SECRETS_MASTER_KEY'];
  if (fallbackKey && fallbackKey.trim().length > 0) {
    const decoded = Buffer.from(fallbackKey.trim(), 'base64');
    if (decoded.length === 32) return decoded;
    if (/^[A-Fa-f0-9]{64}$/.test(fallbackKey.trim())) {
      return Buffer.from(fallbackKey.trim(), 'hex');
    }
    if (Buffer.byteLength(fallbackKey.trim(), 'utf8') === 32) {
      return Buffer.from(fallbackKey.trim(), 'utf8');
    }
  }

  throw new Error(
    'TOOL_ENCRYPTION_KEY (or PAPERCLIP_SECRETS_MASTER_KEY fallback) is not set or invalid. ' +
    'Expected 32-byte base64-encoded string.',
  );
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface EncryptedCredential {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

// ─── Encryption ──────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext credential using AES-256-GCM.
 * Reads the key from TOOL_ENCRYPTION_KEY (or PAPERCLIP_SECRETS_MASTER_KEY fallback).
 *
 * Returns ciphertext, iv, and tag all as hex strings, plus a keyVersion for future key rotation.
 */
export function encryptCredential(plaintext: string): EncryptedCredential {
  const key = loadEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes

  return {
    ciphertext: ciphertext.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    keyVersion: 1,
  };
}

// ─── Decryption ──────────────────────────────────────────────────────────────

/**
 * Decrypts a credential encrypted by encryptCredential().
 * Throws if the ciphertext has been tampered with (AES-GCM auth tag mismatch).
 */
export function decryptCredential(data: { ciphertext: string; iv: string; tag: string }): string {
  const key = loadEncryptionKey();
  const iv = Buffer.from(data.iv, 'hex');
  const tag = Buffer.from(data.tag, 'hex');
  const ciphertext = Buffer.from(data.ciphertext, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
