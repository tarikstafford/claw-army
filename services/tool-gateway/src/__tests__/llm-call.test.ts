import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGenerateText = vi.fn();
const mockOpenai = vi.fn();
const mockAnthropic = vi.fn();
const mockGoogle = vi.fn();

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: mockOpenai,
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: mockAnthropic,
}));

vi.mock('@ai-sdk/google', () => ({
  google: mockGoogle,
}));

describe('executeLlmCall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves OpenAI model for gpt-* prefix', async () => {
    mockOpenai.mockReturnValue('mocked-openai-model');
    mockGenerateText.mockResolvedValue({
      text: 'Hello world',
      response: { modelId: 'gpt-4' },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const { executeLlmCall } = await import('../tools/llm-call.js');

    const result = await executeLlmCall({
      toolName: 'llm_call',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    expect(mockOpenai).toHaveBeenCalledWith('gpt-4');
    expect(result.content).toBe('Hello world');
    expect(result.totalTokens).toBe(15);
  });

  it('resolves OpenAI model for o1* prefix', async () => {
    mockOpenai.mockReturnValue('mocked-openai-model');
    mockGenerateText.mockResolvedValue({
      text: 'Reasoning response',
      response: { modelId: 'o1-preview' },
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    const { executeLlmCall } = await import('../tools/llm-call.js');

    await executeLlmCall({
      toolName: 'llm_call',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        model: 'o1-preview',
        messages: [{ role: 'user', content: 'Think' }],
      },
    });

    expect(mockOpenai).toHaveBeenCalledWith('o1-preview');
  });

  it('resolves Anthropic model for claude-* prefix', async () => {
    mockAnthropic.mockReturnValue('mocked-anthropic-model');
    mockGenerateText.mockResolvedValue({
      text: 'Claude response',
      response: { modelId: 'claude-3-5-sonnet' },
      usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
    });

    const { executeLlmCall } = await import('../tools/llm-call.js');

    await executeLlmCall({
      toolName: 'llm_call',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'Hello Claude' }],
      },
    });

    expect(mockAnthropic).toHaveBeenCalledWith('claude-3-5-sonnet');
  });

  it('resolves Google model for gemini-* prefix', async () => {
    mockGoogle.mockReturnValue('mocked-google-model');
    mockGenerateText.mockResolvedValue({
      text: 'Gemini response',
      response: { modelId: 'gemini-2.0-flash' },
      usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75 },
    });

    const { executeLlmCall } = await import('../tools/llm-call.js');

    await executeLlmCall({
      toolName: 'llm_call',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hello Gemini' }],
      },
    });

    expect(mockGoogle).toHaveBeenCalledWith('gemini-2.0-flash');
  });

  it('defaults to OpenAI for unknown model prefixes', async () => {
    mockOpenai.mockReturnValue('mocked-openai-model');
    mockGenerateText.mockResolvedValue({
      text: 'Default response',
      response: { modelId: 'unknown-model' },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const { executeLlmCall } = await import('../tools/llm-call.js');

    await executeLlmCall({
      toolName: 'llm_call',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        model: 'unknown-model',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    expect(mockOpenai).toHaveBeenCalledWith('unknown-model');
  });

  it('returns correct token counts from AI SDK usage', async () => {
    mockOpenai.mockReturnValue('mocked-openai-model');
    mockGenerateText.mockResolvedValue({
      text: 'Response text',
      response: { modelId: 'gpt-4' },
      usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
    });

    const { executeLlmCall } = await import('../tools/llm-call.js');

    const result = await executeLlmCall({
      toolName: 'llm_call',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        model: 'gpt-4',
        messages: [{ role: 'system', content: 'You are helpful' }, { role: 'user', content: 'Hi' }],
        maxTokens: 1000,
        temperature: 0.7,
      },
    });

    expect(result.promptTokens).toBe(1000);
    expect(result.completionTokens).toBe(500);
    expect(result.totalTokens).toBe(1500);
    expect(result.model).toBe('gpt-4');
  });

  it('passes maxOutputTokens and temperature to generateText', async () => {
    mockOpenai.mockReturnValue('mocked-openai-model');
    mockGenerateText.mockResolvedValue({
      text: 'Response',
      response: { modelId: 'gpt-4' },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const { executeLlmCall } = await import('../tools/llm-call.js');

    await executeLlmCall({
      toolName: 'llm_call',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 500,
        temperature: 0.9,
      },
    });

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 500,
        temperature: 0.9,
      }),
    );
  });

  it('handles undefined token counts gracefully', async () => {
    mockOpenai.mockReturnValue('mocked-openai-model');
    mockGenerateText.mockResolvedValue({
      text: 'Response',
      response: { modelId: 'gpt-4' },
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
    });

    const { executeLlmCall } = await import('../tools/llm-call.js');

    const result = await executeLlmCall({
      toolName: 'llm_call',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    });

    expect(result.promptTokens).toBe(0);
    expect(result.completionTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
  });
});