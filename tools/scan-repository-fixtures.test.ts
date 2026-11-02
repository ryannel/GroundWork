import { describe, expect, it, vi } from 'vitest';

import { canonicalDataFixtures } from './scan-repository-fixtures';
import type { RepositoryFile } from './scan-repository-inventory';

vi.mock(import('server-only'), () => ({}));
const configPath = 'apps/catalog/.storybook/main.ts';
const fixturePath = 'apps/catalog/.storybook/mocks/finance.ts';
const config = "import type { StorybookConfig } from '@storybook/react'; export default {};";
function classify(contents: Readonly<Record<string, Buffer>>, mode = '100644') {
  const files: RepositoryFile[] = Object.keys(contents).map((filename) => ({
    path: filename,
    blob: filename,
    kind: 'blob',
    mode,
    category: 'source',
    language: 'typescript',
    selectedForParsing: true,
    reason: 'original',
  }));
  return canonicalDataFixtures({
    files,
    commit: 'pinned-commit',
    read: (blob, sizeOnly) => {
      const body = contents[blob] ?? Buffer.alloc(0);
      return sizeOnly ? Buffer.from(String(body.length)) : body;
    },
  }).find((file) => file.path === fixturePath);
}
describe('source-backed Storybook fixture routing', () => {
  it('routes proven data to full canonical retention and keeps test classification', () => {
    const result = classify({
      [configPath]: Buffer.from(config),
      [fixturePath]: Buffer.from('export default {offers:[{amount:1}]};'),
    });
    expect(result).toMatchObject({
      category: 'test',
      selectedForParsing: false,
      language: null,
      canonicalData: {
        classification: 'canonical_data_fixture',
        canonicalTextLimitBytes: 8 * 1024 * 1024,
        commit: 'pinned-commit',
        storybookConfig: { path: configPath, blob: configPath },
      },
    });
  });
  it.each([
    { [fixturePath]: Buffer.from('export default {};') },
    {
      [configPath]: Buffer.from('// Storybook mentioned only'),
      [fixturePath]: Buffer.from('export default {};'),
    },
    { [configPath]: Buffer.from(config), [fixturePath]: Buffer.from('export default factory();') },
    { [configPath]: Buffer.from(config), [fixturePath]: Buffer.from([255]) },
    { [configPath]: Buffer.alloc(65_537, 32), [fixturePath]: Buffer.from('export default {};') },
    { [configPath]: Buffer.from(config), [fixturePath]: Buffer.alloc(8 * 1024 * 1024 + 1, 32) },
  ])('retains executable selection for unproven candidate %#', (contents) => {
    expect(classify(contents)?.selectedForParsing).toBe(true);
  });
  it('rejects non-regular source and config entries', () => {
    expect(
      classify(
        { [configPath]: Buffer.from(config), [fixturePath]: Buffer.from('export default {};') },
        '120000',
      )?.selectedForParsing,
    ).toBe(true);
  });
});
