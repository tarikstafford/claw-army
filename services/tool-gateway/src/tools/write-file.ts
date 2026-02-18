import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { WriteFileRequest } from '@claw/tool-contracts';

export interface WriteFileResult {
  artifactId: string;
  path: string;
  sizeBytes: number;
}

/**
 * Execute the write_file tool.
 * Sanitizes the requested path using path.basename() to prevent path traversal.
 * Writes to ARTIFACT_ROOT/<artifactId>/<sanitized-filename>.
 */
export async function executeWriteFile(req: WriteFileRequest): Promise<WriteFileResult> {
  const artifactId = randomUUID();

  // Strip all directory separators — prevents ../../etc/passwd traversal attacks.
  // path.basename handles both / and \ separators.
  const safeFilename = path.basename(req.args.path);

  const artifactRoot = process.env['ARTIFACT_ROOT'] ?? '/tmp/claw-artifacts';
  const artifactDir = path.join(artifactRoot, artifactId);

  await mkdir(artifactDir, { recursive: true });

  const targetPath = path.join(artifactDir, safeFilename);

  let content: Buffer;
  if (req.args.encoding === 'base64') {
    content = Buffer.from(req.args.content, 'base64');
  } else {
    content = Buffer.from(req.args.content, 'utf-8');
  }

  await writeFile(targetPath, content);

  return {
    artifactId,
    path: targetPath,
    sizeBytes: content.byteLength,
  };
}
