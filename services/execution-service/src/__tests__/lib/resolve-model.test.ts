import { describe, it, expect, vi, beforeEach } from 'vitest';

const openai = vi.fn().mockReturnValue({ modelId: 'openai-model' });
const anthropic = vi.fn().mockReturnValue({ modelId: 'anthropic-model' });
const google = vi.fn().mockReturnValue({ modelId: 'google-model' });

vi.mock('@ai-sdk/openai', () => ({ openai }));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic }));
vi.mock('@ai-sdk/google', () => ({ google }));

describe('resolve-model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OpenAI models', () => {
    it('resolves gpt-4 to openai provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      const result = resolveModel('gpt-4');

      expect(openai).toHaveBeenCalledWith('gpt-4');
      expect(result).toEqual({ modelId: 'openai-model' });
    });

    it('resolves gpt-4o to openai provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('gpt-4o');

      expect(openai).toHaveBeenCalledWith('gpt-4o');
    });

    it('resolves gpt-3.5-turbo to openai provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('gpt-3.5-turbo');

      expect(openai).toHaveBeenCalledWith('gpt-3.5-turbo');
    });

    it('resolves o1 models to openai provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('o1');

      expect(openai).toHaveBeenCalledWith('o1');
    });

    it('resolves o1-preview to openai provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('o1-preview');

      expect(openai).toHaveBeenCalledWith('o1-preview');
    });

    it('resolves o1-mini to openai provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('o1-mini');

      expect(openai).toHaveBeenCalledWith('o1-mini');
    });

    it('resolves o3 models to openai provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('o3');

      expect(openai).toHaveBeenCalledWith('o3');
    });

    it('resolves o3-mini to openai provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('o3-mini');

      expect(openai).toHaveBeenCalledWith('o3-mini');
    });
  });

  describe('Anthropic models', () => {
    it('resolves claude-3-opus to anthropic provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      const result = resolveModel('claude-3-opus-20240229');

      expect(anthropic).toHaveBeenCalledWith('claude-3-opus-20240229');
      expect(result).toEqual({ modelId: 'anthropic-model' });
    });

    it('resolves claude-3-sonnet to anthropic provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('claude-3-sonnet-20240229');

      expect(anthropic).toHaveBeenCalledWith('claude-3-sonnet-20240229');
    });

    it('resolves claude-3-haiku to anthropic provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('claude-3-haiku-20240307');

      expect(anthropic).toHaveBeenCalledWith('claude-3-haiku-20240307');
    });

    it('resolves claude-3-5-sonnet to anthropic provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('claude-3-5-sonnet-20241022');

      expect(anthropic).toHaveBeenCalledWith('claude-3-5-sonnet-20241022');
    });
  });

  describe('Google models', () => {
    it('resolves gemini-pro to google provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      const result = resolveModel('gemini-pro');

      expect(google).toHaveBeenCalledWith('gemini-pro');
      expect(result).toEqual({ modelId: 'google-model' });
    });

    it('resolves gemini-1.5-pro to google provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('gemini-1.5-pro');

      expect(google).toHaveBeenCalledWith('gemini-1.5-pro');
    });

    it('resolves gemini-1.5-flash to google provider', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('gemini-1.5-flash');

      expect(google).toHaveBeenCalledWith('gemini-1.5-flash');
    });
  });

  describe('default fallback', () => {
    it('falls back to openai for unrecognized model names', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      const result = resolveModel('some-unknown-model');

      expect(openai).toHaveBeenCalledWith('some-unknown-model');
      expect(result).toEqual({ modelId: 'openai-model' });
    });

    it('falls back to openai for empty string', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('');

      expect(openai).toHaveBeenCalledWith('');
    });
  });

  describe('provider isolation', () => {
    it('does not call anthropic or google for gpt models', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('gpt-4');

      expect(anthropic).not.toHaveBeenCalled();
      expect(google).not.toHaveBeenCalled();
    });

    it('does not call openai or google for claude models', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('claude-3-opus-20240229');

      expect(openai).not.toHaveBeenCalled();
      expect(google).not.toHaveBeenCalled();
    });

    it('does not call openai or anthropic for gemini models', async () => {
      const { resolveModel } = await import('../../lib/resolve-model.js');

      resolveModel('gemini-pro');

      expect(openai).not.toHaveBeenCalled();
      expect(anthropic).not.toHaveBeenCalled();
    });
  });
});
