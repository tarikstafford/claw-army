import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('test-artifact-id-1234'),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('executeWriteFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates artifact directory and writes file with utf-8 content', async () => {
    const { executeWriteFile } = await import('../tools/write-file.js');

    const result = await executeWriteFile({
      toolName: 'write_file',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        path: 'test.txt',
        content: 'Hello world',
        encoding: 'utf-8',
      },
    });

    expect(randomUUID).toHaveBeenCalled();
    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('test-artifact-id-1234'),
      { recursive: true },
    );
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('test.txt'),
      expect.any(Buffer),
    );
    expect(result.artifactId).toBe('test-artifact-id-1234');
    expect(result.sizeBytes).toBe(Buffer.from('Hello world', 'utf-8').byteLength);
  });

  it('writes base64 encoded content when encoding is base64', async () => {
    const { executeWriteFile } = await import('../tools/write-file.js');

    const base64Content = Buffer.from('binary data').toString('base64');

    const result = await executeWriteFile({
      toolName: 'write_file',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        path: 'data.bin',
        content: base64Content,
        encoding: 'base64',
      },
    });

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('data.bin'),
      expect.any(Buffer),
    );
    expect(result.sizeBytes).toBe(Buffer.from('binary data').byteLength);
  });

  it('sanitizes path using basename to prevent directory traversal', async () => {
    const { executeWriteFile } = await import('../tools/write-file.js');

    await executeWriteFile({
      toolName: 'write_file',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        path: '../../../etc/passwd',
        content: 'malicious',
        encoding: 'utf-8',
      },
    });

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('passwd'),
      expect.any(Buffer),
    );
    expect(writeFile).not.toHaveBeenCalledWith(
      expect.stringContaining('..'),
      expect.any(Buffer),
    );
  });

  it('handles path with forward slashes correctly', async () => {
    const { executeWriteFile } = await import('../tools/write-file.js');

    await executeWriteFile({
      toolName: 'write_file',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        path: 'subdir/nested/file.txt',
        content: 'nested content',
        encoding: 'utf-8',
      },
    });

    const writeCall = vi.mocked(writeFile).mock.calls[0][0];
    expect(writeCall).toContain('file.txt');
    expect(writeCall).not.toContain('subdir');
  });

  it('returns correct artifactId and size', async () => {
    const { executeWriteFile } = await import('../tools/write-file.js');

    const result = await executeWriteFile({
      toolName: 'write_file',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        path: 'output.json',
        content: '{"key": "value"}',
        encoding: 'utf-8',
      },
    });

    expect(result.artifactId).toBe('test-artifact-id-1234');
    expect(result.path).toContain('test-artifact-id-1234');
    expect(result.path).toContain('output.json');
    expect(result.sizeBytes).toBe(Buffer.from('{"key": "value"}', 'utf-8').byteLength);
  });

  it('uses default artifact root when ARTIFACT_ROOT is not set', async () => {
    const originalArtifactRoot = process.env['ARTIFACT_ROOT'];
    delete process.env['ARTIFACT_ROOT'];

    const { executeWriteFile } = await import('../tools/write-file.js');

    await executeWriteFile({
      toolName: 'write_file',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        path: 'test.txt',
        content: 'Hello',
        encoding: 'utf-8',
      },
    });

    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('/tmp/claw-artifacts/'),
      { recursive: true },
    );

    if (originalArtifactRoot) {
      process.env['ARTIFACT_ROOT'] = originalArtifactRoot;
    }
  });

  it('uses custom ARTIFACT_ROOT when set', async () => {
    process.env['ARTIFACT_ROOT'] = '/custom/artifacts/path';

    const { executeWriteFile } = await import('../tools/write-file.js');

    await executeWriteFile({
      toolName: 'write_file',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        path: 'test.txt',
        content: 'Hello',
        encoding: 'utf-8',
      },
    });

    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('/custom/artifacts/path/'),
      { recursive: true },
    );
  });

  it('handles empty content', async () => {
    const { executeWriteFile } = await import('../tools/write-file.js');

    const result = await executeWriteFile({
      toolName: 'write_file',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: {
        path: 'empty.txt',
        content: '',
        encoding: 'utf-8',
      },
    });

    expect(result.sizeBytes).toBe(0);
  });

  it('generates unique artifactId for each call', async () => {
    vi.mocked(randomUUID)
      .mockReturnValueOnce('first-id')
      .mockReturnValueOnce('second-id');

    const { executeWriteFile } = await import('../tools/write-file.js');

    const result1 = await executeWriteFile({
      toolName: 'write_file',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-1',
      timestamp: new Date().toISOString(),
      args: { path: 'a.txt', content: 'A', encoding: 'utf-8' },
    });

    const result2 = await executeWriteFile({
      toolName: 'write_file',
      botId: 'bot-1',
      executionId: 'exec-1',
      invocationId: 'inv-2',
      timestamp: new Date().toISOString(),
      args: { path: 'b.txt', content: 'B', encoding: 'utf-8' },
    });

    expect(result1.artifactId).toBe('first-id');
    expect(result2.artifactId).toBe('second-id');
  });
});