import { corpusIndexPages } from '@/application/scan-explorer/corpus-index-pages';
import type { ExplorerService } from '@/domain/service-explorer';
import type { CorpusClaim } from '@/infrastructure/scan-explorer/corpus-purpose';

import { corpusPageFile } from './publish-explorer-pages';
import type { refinementStore } from './refine-explorer-store';

export async function refineInterpretation(
  store: Awaited<ReturnType<typeof refinementStore>>,
  claims: readonly CorpusClaim[],
  identity: { readonly service: ExplorerService; readonly snapshot: string },
): Promise<ExplorerService> {
  const fileFor = (id: string) => corpusPageFile(identity.service.repo, id);
  const pages = corpusIndexPages({
    id: 'interpretation',
    title: 'Inferred context',
    snapshot: identity.snapshot,
    fileFor,
    nodes: claims.map((claim) => ({
      id: claim.id,
      label: `Inferred ${claim.kind} · ${claim.confidence} confidence. ${claim.statement}`,
      detail: `${claim.reasoning} Limitations: ${claim.limitations.join(' ')}`,
      kind: 'entry',
      sourceIds: [],
      target: null,
    })),
  });
  for (const page of pages) {
    await store.write(page.file, {
      ...page.page,
      description:
        'Reviewed interpretations of purpose, actors, activities, proposed journeys and relationships. These are inferences, not observed runtime flows.',
      completeSelection: false,
    });
  }
  return { ...identity.service, interpretationIndex: fileFor('interpretation:0') };
}
