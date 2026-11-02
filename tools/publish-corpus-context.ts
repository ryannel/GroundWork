import { visualContext } from '@/application/scan-explorer/visual-context';
import type { VisualContext, VisualInput } from '@/application/scan-explorer/visual-types';
import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { ExplorerService } from '@/domain/service-explorer';

import { corpusPageFile } from './publish-explorer-pages';

export function corpusVisualContext(
  document: ScanDocument,
  selected: {
    readonly repo: string;
    readonly commit: string;
    readonly snapshot: string;
    readonly purpose: ExplorerService['purpose'];
  },
): VisualContext {
  const input: VisualInput = {
    snapshot: selected.snapshot,
    records: [
      ...document.sources,
      ...document.contracts,
      ...document.gaps,
      ...document.summaries,
      ...(document.semantic ?? []),
      ...(document.framework ?? []),
      ...(document.bindings ?? []),
    ],
    sources: document.sources,
    binding: {
      component: {
        id: `repository:${selected.repo}`,
        logicalId: selected.repo.split('/').at(-1) ?? selected.repo,
        label: selected.repo,
      },
      repo: selected.repo,
      commit: selected.commit,
      declarations: [],
      modulePaths: [''],
      limitations: [
        'Captured repository scope; a repository is not assumed to be one deployed service.',
      ],
    },
    coverage: [
      'Pinned source capture. Complete source extraction does not establish complete framework semantics or runtime execution.',
    ],
  };
  if (
    document.sources.some(
      (source) => source.repo !== selected.repo || source.commit !== selected.commit,
    )
  ) {
    throw new Error('Corpus source revision mismatch');
  }
  const fileFor = (id: string) => corpusPageFile(selected.repo, id);
  return {
    ...visualContext(input, {
      snapshot: selected.snapshot,
      purpose: selected.purpose,
      fileFor,
      externalSources: [],
    }),
    fileFor,
  };
}
