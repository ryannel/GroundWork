import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  affectsConfiguration,
  changed,
  maintained,
  needsScanner,
  parseSnapshot,
  snapshot,
} from './scope';

describe('task verification scope', () => {
  it('fingerprints file contents and directory symlinks without following them', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'groundwork-check-'));
    try {
      const file = path.join(root, 'example.ts');
      const link = path.join(root, 'linked-folder');
      writeFileSync(file, 'before');
      symlinkSync(root, link);
      const before = snapshot([file, link]);
      writeFileSync(file, 'after');
      expect(changed(before, snapshot([file, link]))).toEqual([file]);
      rmSync(file);
      expect(changed(before, snapshot([file, link]))).toEqual([file]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a corrupt checkpoint rather than silently dropping checks', () => {
    expect(parseSnapshot({ 'src/example.ts': 'hash' })).toEqual({ 'src/example.ts': 'hash' });
    for (const value of [null, [], 'text', { file: 3 }]) {
      expect(() => parseSnapshot(value)).toThrow('Invalid task checkpoint');
    }
  });

  it('finds edits, additions and removals without treating existing work as new', () => {
    expect(
      changed(
        { existing: 'a', edited: 'b', removed: 'c' },
        { existing: 'a', edited: 'd', added: 'e' },
      ),
    ).toEqual(['edited', 'removed', 'added']);
  });

  it('keeps maintained documentation but excludes generated trial output', () => {
    expect(maintained('docs/architecture.md')).toBe(true);
    expect(maintained('docs/scan-trials/output.ts')).toBe(false);
    expect(maintained('artifacts/report.json')).toBe(false);
  });

  it('runs scanner tests for shared logic and scanner changes, but not a UI-only change', () => {
    expect(needsScanner(['src/features/workspace/system-page.tsx'])).toBe(false);
    expect(needsScanner(['src/application/reference/query.ts'])).toBe(true);
    expect(needsScanner(['src/infrastructure/scan/parse.ts'])).toBe(true);
    expect(needsScanner(['tools/checks/scope.ts'])).toBe(true);
    expect(needsScanner(['src/infrastructure/disk.ts'])).toBe(true);
  });

  it('requires broad verification for configuration changes', () => {
    expect(affectsConfiguration(['eslint.config.mjs'])).toBe(true);
    expect(affectsConfiguration(['eslint/structure-rules.mjs'])).toBe(true);
    expect(affectsConfiguration(['src/ui/text.tsx'])).toBe(false);
    expect(affectsConfiguration(['README.md'])).toBe(false);
    expect(affectsConfiguration(['tsconfig.web.json'])).toBe(true);
    expect(affectsConfiguration(['vitest.mutation.config.ts'])).toBe(true);
  });
});
