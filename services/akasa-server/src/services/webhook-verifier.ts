import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify HubSpot webhook signature (v3 — HMAC-SHA256).
 * HubSpot sends X-HubSpot-Signature-v3 header containing
 * HMAC-SHA256(clientSecret, requestMethod + requestUrl + rawBody + timestamp)
 *
 * @param rawBody - Raw request body as string
 * @param signature - Value of X-HubSpot-Signature-v3 header (base64-encoded)
 * @param timestamp - Value of X-HubSpot-Request-Timestamp header
 * @param clientSecret - HubSpot app client secret (from env: HUBSPOT_CLIENT_SECRET)
 * @param requestMethod - HTTP method (e.g. 'POST')
 * @param requestUrl - Full request URL
 * @returns true if signature is valid
 */
export function verifyHubSpotSignature(params: {
  rawBody: string;
  signature: string;
  timestamp: string;
  clientSecret: string;
  requestMethod: string;
  requestUrl: string;
}): boolean {
  if (!params.signature || !params.timestamp || !params.clientSecret) return false;

  const sourceString =
    params.requestMethod + params.requestUrl + params.rawBody + params.timestamp;
  const expectedSignature = createHmac('sha256', params.clientSecret)
    .update(sourceString)
    .digest('base64');

  try {
    return timingSafeEqual(
      Buffer.from(params.signature, 'base64'),
      Buffer.from(expectedSignature, 'base64'),
    );
  } catch {
    return false;
  }
}

/**
 * Verify Slack webhook signature (v0 — HMAC-SHA256).
 * Slack sends X-Slack-Signature header containing v0=HMAC-SHA256(signingSecret, v0:timestamp:rawBody)
 * and X-Slack-Request-Timestamp header.
 *
 * Rejects timestamps older than 5 minutes to prevent replay attacks.
 *
 * @param rawBody - Raw request body as string
 * @param signature - Value of X-Slack-Signature header (v0=hex)
 * @param timestamp - Value of X-Slack-Request-Timestamp header (unix seconds)
 * @param signingSecret - Slack app signing secret (from env: SLACK_SIGNING_SECRET)
 * @returns true if signature is valid and timestamp is within 5 minutes
 */
export function verifySlackSignature(params: {
  rawBody: string;
  signature: string;
  timestamp: string;
  signingSecret: string;
}): boolean {
  if (!params.signature || !params.timestamp || !params.signingSecret) return false;

  // Reject timestamps older than 5 minutes to prevent replay attacks
  const timestampSec = parseInt(params.timestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > 300) return false;

  const sigBasestring = `v0:${params.timestamp}:${params.rawBody}`;
  const expectedSignature =
    'v0=' + createHmac('sha256', params.signingSecret).update(sigBasestring).digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(params.signature),
      Buffer.from(expectedSignature),
    );
  } catch {
    return false;
  }
}

/**
 * Verify Stripe webhook signature (HMAC-SHA256).
 * Stripe sends Stripe-Signature header containing timestamp=t+scheme=version+signature
 *
 * @param rawBody - Raw request body as string
 * @param signature - Value of Stripe-Signature header
 * @param webhookSecret - Stripe webhook secret (from env: STRIPE_WEBHOOK_SECRET)
 * @returns true if signature is valid
 */
export function verifyStripeSignature(params: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  if (!params.signature || !params.webhookSecret) return false;

  const parts = params.signature.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) return false;

  const timestamp = timestampPart.slice(2);
  const signature = signaturePart.slice(3);

  // Reject timestamps older than 5 minutes to prevent replay attacks
  const timestampSec = parseInt(timestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > 300) return false;

  const sigBasestring = `${timestamp}.${params.rawBody}`;
  const expectedSignature = createHmac('sha256', params.webhookSecret)
    .update(sigBasestring)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    return false;
  }
}

/**
 * Verify GitHub webhook signature (HMAC-SHA256).
 * GitHub sends X-Hub-Signature-256 header containing sha256=HMAC-SHA256(secret, rawBody)
 *
 * @param rawBody - Raw request body as string
 * @param signature - Value of X-Hub-Signature-256 header (sha256=hex)
 * @param webhookSecret - GitHub webhook secret (from env: GITHUB_WEBHOOK_SECRET)
 * @returns true if signature is valid
 */
export function verifyGitHubSignature(params: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  if (!params.signature || !params.webhookSecret) return false;

  const expectedSignature =
    'sha256=' +
    createHmac('sha256', params.webhookSecret).update(params.rawBody).digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(params.signature),
      Buffer.from(expectedSignature),
    );
  } catch {
    return false;
  }
}

/**
 * Verify Linear webhook signature (HMAC-SHA256).
 * Linear sends X-Linear-Signature header containing HMAC-SHA256(secret, rawBody)
 *
 * @param rawBody - Raw request body as string
 * @param signature - Value of X-Linear-Signature header (hex)
 * @param webhookSecret - Linear webhook secret (from env: LINEAR_WEBHOOK_SECRET)
 * @returns true if signature is valid
 */
export function verifyLinearSignature(params: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  if (!params.signature || !params.webhookSecret) return false;

  const expectedSignature = createHmac('sha256', params.webhookSecret)
    .update(params.rawBody)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(params.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    return false;
  }
}
