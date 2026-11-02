import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('node:child_process'));
vi.mock(import('node:fs'));

const argv = process.argv;
const exitCode = process.exitCode;

function result(stdout = '', status = 0, stderr = '') {
  return { pid: 1, output: [], stdout, stderr, status, signal: null };
}

async function lint(...files: readonly string[]): Promise<void> {
  process.argv = [process.execPath, 'tools/lint-changed.ts', ...files];
  await import('./lint-changed');
}

beforeEach(() => {
  vi.resetModules();
  vi.mocked(spawnSync).mockReset().mockReturnValue(result());
  vi.mocked(existsSync).mockImplementation((file) => !file.toString().includes('absent'));
  process.exitCode = 0;
});

afterEach(() => {
  process.argv = argv;
  process.exitCode = exitCode;
  vi.restoreAllMocks();
});

describe('focused lint', () => {
  it('passes quoted, Unicode and newline-containing Git paths without splitting or decoding them', async () => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce(result('src/ui/a b.tsx\0src/ui/colours-é.tsx\0src/ui/a\nb.tsx\0'))
      .mockReturnValueOnce(result('src/ui/new.tsx\0'));
    await lint();
    expect(spawnSync).toHaveBeenNthCalledWith(
      1,
      'git',
      ['diff', '--name-only', '--diff-filter=d', '-z', 'HEAD'],
      { encoding: 'utf8' },
    );
    expect(spawnSync).toHaveBeenLastCalledWith(
      process.execPath,
      expect.arrayContaining([
        '--',
        'src/ui/a b.tsx',
        'src/ui/colours-é.tsx',
        'src/ui/a\nb.tsx',
        'src/ui/new.tsx',
      ]),
      { stdio: 'inherit' },
    );
  });

  it('fails visibly rather than reporting nothing to lint when Git fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(vi.fn<typeof console.error>());
    vi.mocked(spawnSync).mockReturnValueOnce(result('', 128, 'not a Git repository'));
    await lint();
    expect(process.exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith('not a Git repository');
    expect(spawnSync).toHaveBeenCalledOnce();
  });

  it('bypasses stale component cache entries when only their CSS changed', async () => {
    await lint('src/ui/card.module.css');
    expect(spawnSync).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(['--no-cache', '--', 'src/ui/card.tsx', 'src/ui/card.client.tsx']),
      { stdio: 'inherit' },
    );
    expect(spawnSync).not.toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(['--cache']),
      expect.anything(),
    );
  });

  it.each(['eslint.config.mjs', 'eslint/css-modules-rule.mjs', 'tsconfig.json', 'package.json'])(
    'checks the whole repository without cached results when %s changes',
    async (file) => {
      await lint(file);
      expect(spawnSync).toHaveBeenCalledWith(
        process.execPath,
        expect.arrayContaining(['--no-cache', '--', '.']),
        { stdio: 'inherit' },
      );
    },
  );

  it('deduplicates explicit paths and keeps warm lint cached', async () => {
    await lint('src/ui/card.tsx', 'src/ui/card.tsx', 'src/ui/absent.tsx', 'README.md');
    expect(spawnSync).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(['--cache', '--', 'src/ui/card.tsx']),
      { stdio: 'inherit' },
    );
    const args = vi.mocked(spawnSync).mock.calls[0]?.[1];
    expect(args?.filter((arg) => arg === 'src/ui/card.tsx')).toHaveLength(1);
  });

  it('propagates lint failures', async () => {
    vi.mocked(spawnSync).mockReturnValueOnce(result('', 2));
    await lint('src/ui/card.tsx');
    expect(process.exitCode).toBe(2);
  });
});
