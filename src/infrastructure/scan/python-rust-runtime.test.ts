import { afterEach, describe, expect, it, vi } from 'vitest';

import { pythonRustIdentity } from './python-rust-runtime';
import { indexSource } from './source-index';

const state = vi.hoisted(() => ({ missing: false }));
vi.mock(import('server-only'), () => ({}));
vi.mock(import('node:fs'), async (original) => {
  const actual = await original();
  return {
    ...actual,
    existsSync: (file: Parameters<typeof actual.existsSync>[0]) => {
      if (state.missing && String(file).includes('python-tree-sitter')) return false;
      return actual.existsSync(file);
    },
  };
});
afterEach(() => {
  state.missing = false;
});
describe('native parser dependency availability', () => {
  it('stops fingerprint preflight with an actionable setup command when Rust wheels are absent', () => {
    state.missing = true;
    expect(() =>
      pythonRustIdentity({ language: 'rust', path: 'fixture.rs', content: 'fn main() {}' }),
    ).toThrow('tools/scan-python-rust-setup.ts');
    const index = indexSource({ language: 'rust', path: 'fixture.rs', content: 'fn main() {}' });
    expect(index.parser).toBe('rust/unavailable');
    expect(index.nodes).toEqual([]);
    expect(index.diagnostics[0]).toContain('tools/scan-python-rust-setup.ts');
  });
});
