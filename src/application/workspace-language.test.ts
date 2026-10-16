import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { languageWarnings } from './workspace-language';
import { systemModelOf } from './workspace-model';

vi.mock('server-only', () => ({}));

const { readWorkspaces } = await import('@/infrastructure/workspace-store');
const { readWorkspaceModel } = await import('@/infrastructure/workspace-model');

const root = path.resolve(import.meta.dirname, '../../workspaces');
const workspaces = await readWorkspaces(root);
const workspace = workspaces.find(({ id }) => id === 'alder-finch')!;
const read = await readWorkspaceModel(workspace, root);

describe('a domain language', () => {
  it('is read per domain and joins today', () => {
    expect(read.languages.map(({ domain }) => domain)).toEqual([
      'commercial-backbone',
      'order-to-delivery',
      'website',
    ]);
    const words = systemModelOf(workspace, read).plan.domain?.concepts?.map(({ id }) => id);
    expect(words).toContain('con:product');
    expect(words).toContain('con:reservation');
  });

  it('keeps each word in the domain where it is born', () => {
    expect(languageWarnings(workspace, read)).toEqual([]);
    const [first, ...rest] = read.languages;
    const moved = { ...read, languages: [{ ...first!, domain: 'website' }, ...rest] };
    expect(languageWarnings(workspace, moved)).toEqual([
      "con:product is born in svc:pim, in commercial-backbone; write it in domains/commercial-backbone/language.yaml, not website's",
    ]);
  });
});
