import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyHubSpotSignature, verifySlackSignature } from '../services/webhook-verifier.js';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeHubSpotSignature(params: {
  clientSecret: string;
  requestMethod: string;
  requestUrl: string;
  rawBody: string;
  timestamp: string;
}): string {
  const sourceString =
    params.requestMethod + params.requestUrl + params.rawBody + params.timestamp;
  return createHmac('sha256', params.clientSecret).update(sourceString).digest('base64');
}

function makeSlackSignature(params: {
  signingSecret: string;
  timestamp: string;
  rawBody: string;
}): string {
  const sigBasestring = `v0:${params.timestamp}:${params.rawBody}`;
  return 'v0=' + createHmac('sha256', params.signingSecret).update(sigBasestring).digest('hex');
}

// ─── HubSpot signature tests ──────────────────────────────────────────────────

describe('verifyHubSpotSignature', () => {
  const clientSecret = 'test-client-secret-hubspot';
  const requestMethod = 'POST';
  const requestUrl = 'https://example.com/akasa/webhooks/hubspot/abc123';
  const rawBody = JSON.stringify({ event: 'contact.creation', objectId: 42 });
  const timestamp = '1711234567890';

  it('returns true for a valid HMAC-SHA256 signature', () => {
    const signature = makeHubSpotSignature({
      clientSecret,
      requestMethod,
      requestUrl,
      rawBody,
      timestamp,
    });

    expect(
      verifyHubSpotSignature({
        rawBody,
        signature,
        timestamp,
        clientSecret,
        requestMethod,
        requestUrl,
      }),
    ).toBe(true);
  });

  it('returns false when the body has been tampered with', () => {
    const signature = makeHubSpotSignature({
      clientSecret,
      requestMethod,
      requestUrl,
      rawBody,
      timestamp,
    });

    expect(
      verifyHubSpotSignature({
        rawBody: rawBody + ' tampered',
        signature,
        timestamp,
        clientSecret,
        requestMethod,
        requestUrl,
      }),
    ).toBe(false);
  });

  it('returns false when the signature header is missing/empty', () => {
    expect(
      verifyHubSpotSignature({
        rawBody,
        signature: '',
        timestamp,
        clientSecret,
        requestMethod,
        requestUrl,
      }),
    ).toBe(false);
  });
});

// ─── Slack signature tests ────────────────────────────────────────────────────

describe('verifySlackSignature', () => {
  const signingSecret = 'test-signing-secret-slack';
  const rawBody = 'payload=%7B%22type%22%3A%22event_callback%22%7D';
  // Current unix timestamp in seconds
  const validTimestamp = String(Math.floor(Date.now() / 1000));

  it('returns true for a valid v0 HMAC-SHA256 signature with current timestamp', () => {
    const signature = makeSlackSignature({
      signingSecret,
      timestamp: validTimestamp,
      rawBody,
    });

    expect(
      verifySlackSignature({
        rawBody,
        signature,
        timestamp: validTimestamp,
        signingSecret,
      }),
    ).toBe(true);
  });

  it('returns false when the body has been tampered with', () => {
    const signature = makeSlackSignature({
      signingSecret,
      timestamp: validTimestamp,
      rawBody,
    });

    expect(
      verifySlackSignature({
        rawBody: rawBody + '&extra=true',
        signature,
        timestamp: validTimestamp,
        signingSecret,
      }),
    ).toBe(false);
  });

  it('returns false when the timestamp is older than 5 minutes', () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 400); // 400s > 300s threshold
    const signature = makeSlackSignature({
      signingSecret,
      timestamp: oldTimestamp,
      rawBody,
    });

    expect(
      verifySlackSignature({
        rawBody,
        signature,
        timestamp: oldTimestamp,
        signingSecret,
      }),
    ).toBe(false);
  });
});
