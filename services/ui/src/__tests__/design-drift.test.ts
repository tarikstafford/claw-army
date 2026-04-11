import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = [
  resolve('src/routes'),
  resolve('src/lib/components'),
];

const FORBIDDEN_PATTERNS = [
  'fonts.googleapis.com',
  'fontshare.com',
  "'Clash Display'",
  "'JetBrains Mono'",
  'font-family: Inter',
  "font-family: 'Inter'",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return walk(fullPath);
    }

    return fullPath.endsWith('.svelte') || fullPath.endsWith('.ts') || fullPath.endsWith('.css') || fullPath.endsWith('.html')
      ? [fullPath]
      : [];
  });
}

describe('design drift', () => {
  it('does not reintroduce banned font sources or families', () => {
    const files = ROOTS.flatMap(walk);

    for (const file of files) {
      const content = readFileSync(file, 'utf8');

      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(content, `${file} should not contain ${pattern}`).not.toContain(pattern);
      }
    }
  });
});
