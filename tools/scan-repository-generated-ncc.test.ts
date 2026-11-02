import { describe, expect, it, vi } from 'vitest';

import { generatedActionBundles } from './scan-repository-generated';
import type { RepositoryFile } from './scan-repository-inventory';

vi.mock(import('server-only'), () => ({}));

// OIP metadata at 7de383d5e19b84ee9610a9a51a7d8872aac395d4; source bodies below are synthetic.
const folder = '.github/actions/github-app';
const bundle = `${folder}/dist/index.js`;
const declarations: Readonly<Record<string, string>> = {
  [`${folder}/action.yml`]: "runs:\n  using: 'node20'\n  main: 'dist/index.js'\n",
  [`${folder}/package.json`]: JSON.stringify({
    scripts: { build: 'ncc build index.ts -o dist' },
    dependencies: { '@vercel/ncc': '0.45.0' },
  }),
  [`${folder}/index.ts`]: 'export const original = true;',
  [bundle]: 'bundled code',
};

function classify(contents: Readonly<Record<string, string>>, overrides?: Partial<RepositoryFile>) {
  const files: RepositoryFile[] = Object.keys(contents).map((filename) => ({
    path: filename,
    blob: filename,
    mode: '100644',
    kind: 'blob',
    category: 'source',
    language: filename.endsWith('.ts') ? 'typescript' : 'javascript',
    selectedForParsing: true,
    reason: 'original',
    ...(filename === `${folder}/index.ts` ? overrides : {}),
  }));
  return generatedActionBundles({
    files,
    read: (blob, sizeOnly) =>
      Buffer.from(
        sizeOnly ? String(Buffer.byteLength(contents[blob] ?? '')) : (contents[blob] ?? ''),
      ),
  });
}
function selected(contents: Readonly<Record<string, string>>, overrides?: Partial<RepositoryFile>) {
  return classify(contents, overrides).find((file) => file.path === bundle)?.selectedForParsing;
}
function recipe(build: string): string {
  return JSON.stringify({ scripts: { build }, devDependencies: { '@vercel/ncc': '0.45.0' } });
}

describe('source-backed NCC action declaration', () => {
  it('keeps every tree entry and original source without parsing the declared duplicate bundle', () => {
    const files = classify(declarations);
    expect(files).toHaveLength(4);
    expect(files.find((file) => file.path === bundle)).toMatchObject({
      language: null,
      category: 'ancillary',
      selectedForParsing: false,
    });
    expect(files.find((file) => file.path === bundle)?.reason).toContain(`${folder}/index.ts@`);
    expect(files.find((file) => file.path.endsWith('/index.ts'))?.selectedForParsing).toBe(true);
  });
  it.each(['action.yml', 'package.json', 'index.ts'])('needs the pinned %s proof', (missing) => {
    const contents = Object.fromEntries(
      Object.entries(declarations).filter(([filename]) => filename !== `${folder}/${missing}`),
    );
    expect(selected(contents)).toBe(true);
  });
  it.each([
    'ncc build ../other.ts -o dist',
    'ncc build /tmp/other.ts -o dist',
    'ncc build dist/original.ts -o dist',
    'ncc build index.ts -o different',
    'ncc build index.ts -o dist && node patch.js',
    'ncc build $ENTRY -o dist',
    'cp handwritten.js dist/index.js',
  ])('does not reinterpret an unsupported recipe: %s', (build) => {
    expect(selected({ ...declarations, [`${folder}/package.json`]: recipe(build) })).toBe(true);
  });
  it.each([
    ['runs: {using: node16, main: dist/index.js}', recipe('ncc build index.ts -o dist')],
    ['runs: {using: node20, main: dist/other.js}', recipe('ncc build index.ts -o dist')],
    [declarations[`${folder}/action.yml`]!, '{invalid'],
    [declarations[`${folder}/action.yml`]!, '{"scripts":{"build":"ncc build index.ts -o dist"}}'],
    [
      declarations[`${folder}/action.yml`]!,
      '{"scripts":{"build":"ncc build index.ts -o dist"},"dependencies":{"@vercel/ncc":"^0.45.0"}}',
    ],
  ])('requires matching runtime and pinned builder declarations', (action, manifest) => {
    expect(
      selected({
        ...declarations,
        [`${folder}/action.yml`]: action,
        [`${folder}/package.json`]: manifest,
      }),
    ).toBe(true);
  });
  it('rejects option-like input even when a selected source with that name exists', () => {
    expect(
      selected({
        ...declarations,
        [`${folder}/--unknown.ts`]: 'export const original = true;',
        [`${folder}/package.json`]: recipe('ncc build --unknown.ts -o dist'),
      }),
    ).toBe(true);
  });
  it('does not drop the bundle when its original source is excluded or non-regular', () => {
    expect(selected(declarations, { selectedForParsing: false })).toBe(true);
    expect(selected(declarations, { mode: '120000' })).toBe(true);
    expect(selected(declarations, { language: null })).toBe(true);
  });
});
