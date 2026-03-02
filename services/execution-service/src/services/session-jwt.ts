import * as jose from 'jose';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEV_SECRET = 'claw-dev-secret-do-not-use-in-prod';

// 5-minute buffer added to runtimeLimitSeconds for JWT expiration
const EXPIRATION_BUFFER_SECONDS = 300;

// ─── Secret key helper ────────────────────────────────────────────────────────

/**
 * Encoded JWT secret key.
 * Reads BOT_JWT_SECRET from the environment.
 * Falls back to a hardcoded dev secret with a console.warn — never use this in production.
 *
 * NOTE: This is intentionally independent from orchestrator/jwt.ts — different concern,
 * kept as separate module so either can evolve without coupling.
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.BOT_JWT_SECRET;
  if (!secret) {
    console.warn(
      '[session-jwt] BOT_JWT_SECRET is not set — using insecure dev secret. ' +
        'Set BOT_JWT_SECRET in production.',
    );
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

// ─── Public Types ─────────────────────────────────────────────────────────────

/**
 * Session JWT payload encoding per-agent grants and execution constraints.
 *
 * Encodes all 7 SPAWN-01 fields required for Ring Leader agent sessions:
 *  - soulId: identity of the assigned soul
 *  - taskId: task this agent is executing within the run
 *  - toolAllowlist: tools the agent is permitted to call
 *  - thirdPartyGrants: third-party service access grants
 *  - budgetAllocationCents: spending cap for this agent in cents
 *  - runtimeLimitSeconds: wall-clock limit for this agent session
 *  - ringLeaderRunId: parent run ID for attribution and coordination
 */
export interface SessionJwtPayload {
  soulId: string;
  taskId: string;
  toolAllowlist: string[];
  thirdPartyGrants: string[];
  budgetAllocationCents: number;
  runtimeLimitSeconds: number;
  ringLeaderRunId: string;
}

// ─── JWT minting ──────────────────────────────────────────────────────────────

/**
 * Mint an HS256 JWT for a Ring Leader agent session.
 *
 * Subject: `session:{soulId}:{taskId}` — unique and traceable per agent assignment.
 * Expiration: runtimeLimitSeconds + 300s buffer so the JWT remains valid for
 *             cleanup/callback operations after the agent completes.
 *
 * All 7 SPAWN-01 fields are encoded directly in JWT claims.
 *
 * @param payload - Agent session grants and constraints
 * @returns Signed JWT string
 */
export async function mintSessionJwt(payload: SessionJwtPayload): Promise<string> {
  const expirationSeconds = payload.runtimeLimitSeconds + EXPIRATION_BUFFER_SECONDS;

  return new jose.SignJWT({
    soulId: payload.soulId,
    taskId: payload.taskId,
    toolAllowlist: payload.toolAllowlist,
    thirdPartyGrants: payload.thirdPartyGrants,
    budgetAllocationCents: payload.budgetAllocationCents,
    runtimeLimitSeconds: payload.runtimeLimitSeconds,
    ringLeaderRunId: payload.ringLeaderRunId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(`session:${payload.soulId}:${payload.taskId}`)
    .setExpirationTime(`${expirationSeconds}s`)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

// ─── JWT verification ─────────────────────────────────────────────────────────

/**
 * Verify and decode a Ring Leader session JWT.
 * Throws if the token is invalid, expired, or tampered with.
 * Throws if any required SPAWN-01 field is missing from the payload.
 *
 * @param token - JWT string from agent session
 * @returns Decoded and validated SessionJwtPayload
 */
export async function verifySessionJwt(token: string): Promise<SessionJwtPayload> {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET, {
    algorithms: ['HS256'],
  });

  const soulId = payload.soulId as string | undefined;
  const taskId = payload.taskId as string | undefined;
  const toolAllowlist = payload.toolAllowlist as string[] | undefined;
  const thirdPartyGrants = payload.thirdPartyGrants as string[] | undefined;
  const budgetAllocationCents = payload.budgetAllocationCents as number | undefined;
  const runtimeLimitSeconds = payload.runtimeLimitSeconds as number | undefined;
  const ringLeaderRunId = payload.ringLeaderRunId as string | undefined;

  if (!soulId) {
    throw new Error('Invalid session JWT: missing soulId in payload');
  }
  if (!taskId) {
    throw new Error('Invalid session JWT: missing taskId in payload');
  }
  if (!toolAllowlist) {
    throw new Error('Invalid session JWT: missing toolAllowlist in payload');
  }
  if (!thirdPartyGrants) {
    throw new Error('Invalid session JWT: missing thirdPartyGrants in payload');
  }
  if (budgetAllocationCents === undefined || budgetAllocationCents === null) {
    throw new Error('Invalid session JWT: missing budgetAllocationCents in payload');
  }
  if (runtimeLimitSeconds === undefined || runtimeLimitSeconds === null) {
    throw new Error('Invalid session JWT: missing runtimeLimitSeconds in payload');
  }
  if (!ringLeaderRunId) {
    throw new Error('Invalid session JWT: missing ringLeaderRunId in payload');
  }

  return {
    soulId,
    taskId,
    toolAllowlist,
    thirdPartyGrants,
    budgetAllocationCents,
    runtimeLimitSeconds,
    ringLeaderRunId,
  };
}
