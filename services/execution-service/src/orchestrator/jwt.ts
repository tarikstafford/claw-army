import * as jose from 'jose';

const DEV_SECRET = 'claw-dev-secret-do-not-use-in-prod';

/**
 * Encoded JWT secret key.
 * Reads BOT_JWT_SECRET from the environment.
 * Falls back to a hardcoded dev secret with a console.warn — never use this in production.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.BOT_JWT_SECRET;
  if (!secret) {
    console.warn(
      '[jwt] BOT_JWT_SECRET is not set — using insecure dev secret. ' +
        'Set BOT_JWT_SECRET in production.',
    );
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

/**
 * Mint a short-lived HS256 JWT for a bot to authenticate against the execution service.
 *
 * Payload: { botId, executionId }
 * Subject: botId
 * Algorithm: HS256
 * Expiry: 15 minutes
 *
 * The token is injected into the container environment as BOT_JWT before spawn.
 * Bots present this token when claiming tasks or reporting results.
 *
 * @param botId - UUID of the bot being spawned
 * @param executionId - UUID of the execution this bot belongs to
 * @returns Signed JWT string
 */
export async function mintBotJwt(
  botId: string,
  executionId: string,
): Promise<string> {
  return new jose.SignJWT({ botId, executionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(botId)
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a bot JWT.
 * Throws if the token is invalid, expired, or tampered with.
 *
 * @param token - JWT string from Authorization header or BOT_JWT env var
 * @returns Decoded payload with botId and executionId
 */
export async function verifyBotJwt(
  token: string,
): Promise<{ botId: string; executionId: string }> {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
    algorithms: ['HS256'],
  });

  const botId = payload.botId as string | undefined;
  const executionId = payload.executionId as string | undefined;

  if (!botId || !executionId) {
    throw new Error('Invalid bot JWT: missing botId or executionId in payload');
  }

  return { botId, executionId };
}
