import { compactDecrypt } from 'jose';
import crypto from 'node:crypto';

/**
 * Verifies an Auth.js JWE session token from the Authorization header.
 *
 * Auth.js v5 stores sessions as JWE (JSON Web Encryption, A256CBC-HS512),
 * not plain signed JWTs. compactDecrypt decrypts the encrypted token.
 * jwt.verify only validates signatures on plain JWTs and would fail with a JWE.
 *
 * The HKDF key is derived from AUTH_SECRET using the cookie name as the salt.
 * In dev (HTTP), the cookie is 'authjs.session-token'.
 * In prod (HTTPS), the cookie is '__Secure-authjs.session-token'.
 * We try both salts so the backend works in both environments.
 *
 * A256CBC-HS512 requires a 512-bit (64-byte) key, hence keylen=64.
 */
export async function verifyAuthToken(authHeader: string | undefined): Promise<boolean> {
  // 1. Reject missing or malformed Authorization header
  if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  // 2. Extract the token
  const token = authHeader.slice(7); // strip 'Bearer ' (7 chars)
  if (token === '') {
    return false;
  }

  // 3. Read AUTH_SECRET from environment — never hardcoded
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET not configured');
  }

  // 4. Try both cookie name salts (dev HTTP and prod HTTPS)
  const salts = ['authjs.session-token', '__Secure-authjs.session-token'];

  for (const salt of salts) {
    try {
      // a. Build the HKDF info string used by Auth.js
      const info = `Auth.js Generated Encryption Key (${salt})`;

      // b. Derive 64-byte key using HKDF-SHA256
      //    - algorithm: 'sha256'
      //    - ikm (keying material): AUTH_SECRET string
      //    - salt: cookie name string
      //    - info: context string
      //    - keylen: 64 bytes (512 bits required for A256CBC-HS512)
      const keyBuffer = crypto.hkdfSync('sha256', secret, salt, info, 64);

      // c. Wrap as Uint8Array for jose
      const key = new Uint8Array(keyBuffer);

      // d. Decrypt the JWE token
      const { plaintext } = await compactDecrypt(token, key);

      // e. Parse the decrypted payload
      const payload = JSON.parse(Buffer.from(plaintext).toString('utf8')) as Record<string, unknown>;

      // f. A valid Auth.js session payload has an email or sub field
      if (payload['email'] || payload['sub']) {
        return true;
      }
    } catch {
      // This salt didn't work — try the next one
      continue;
    }
  }

  // Neither salt produced a valid session payload
  return false;
}
