import { describe, it, expect } from 'vitest';
import { extractEventType, evaluateRoutingRules } from '../routes/webhooks.js';

describe('extractEventType', () => {
  it('Test 1: extracts subscriptionType from HubSpot events array', () => {
    const result = extractEventType('hubspot', {
      events: [{ subscriptionType: 'contact.creation' }],
    });
    expect(result).toBe('contact.creation');
  });

  it('Test 2: extracts event.type from Slack payload', () => {
    const result = extractEventType('slack', {
      event: { type: 'message' },
    });
    expect(result).toBe('message');
  });

  it('Test 3: extracts top-level type from Slack url_verification payload', () => {
    const result = extractEventType('slack', {
      type: 'url_verification',
    });
    expect(result).toBe('url_verification');
  });

  it('Test 4: extracts top-level type for unknown tools', () => {
    const result = extractEventType('unknown-tool', { type: 'some_event' });
    expect(result).toBe('some_event');
  });

  it('Test 5: returns "unknown" when HubSpot events array is empty/missing', () => {
    const result = extractEventType('hubspot', {});
    expect(result).toBe('unknown');
  });
});

describe('evaluateRoutingRules', () => {
  const makeRule = (eventType: string, id = 'rule-1', assignToAgentId: string | null = 'agent-1') => ({
    id,
    eventType,
    assignToAgentId,
  });

  it('Test 6: returns matched rule when eventType exactly matches', () => {
    const rules = [makeRule('contact.creation')];
    const result = evaluateRoutingRules(rules, 'contact.creation');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('rule-1');
  });

  it('Test 7: wildcard "*" eventType matches any event', () => {
    const rules = [makeRule('*', 'wildcard-rule')];
    const result = evaluateRoutingRules(rules, 'deal.closed');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('wildcard-rule');
  });

  it('Test 8: returns null when no rules match', () => {
    const rules = [makeRule('contact.creation')];
    const result = evaluateRoutingRules(rules, 'deal.closed');
    expect(result).toBeNull();
  });

  it('exact match takes precedence over wildcard when listed first', () => {
    const rules = [makeRule('contact.creation', 'exact-rule'), makeRule('*', 'wildcard-rule')];
    const result = evaluateRoutingRules(rules, 'contact.creation');
    expect(result?.id).toBe('exact-rule');
  });

  it('returns null for empty rules array', () => {
    const result = evaluateRoutingRules([], 'contact.creation');
    expect(result).toBeNull();
  });
});
