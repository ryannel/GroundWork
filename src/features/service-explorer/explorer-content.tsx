import { explorerDrawing } from '@/application/explorer-drawing';
import type { ExplorerPage } from '@/domain/service-explorer';
import { ExplorerCanvas } from '@/ui/explorer-canvas';

import { ExplorerIndex } from './explorer-index';
import { ExplorerSchema } from './explorer-schema';

export function ExplorerContent({
  page,
  selected,
  onSelect,
  onOpen,
}: {
  readonly page: ExplorerPage;
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
  readonly onOpen: (file: string) => void;
}) {
  if (page.kind === 'data') return <ExplorerSchema onOpen={onOpen} page={page} />;
  const index =
    page.links.length === 0 &&
    page.kind !== 'flow' &&
    !page.nodes.some((item) => item.kind === 'component');
  if (index) return <ExplorerIndex onOpen={onOpen} page={page} />;
  return (
    <ExplorerCanvas
      drawing={explorerDrawing(page)}
      fit
      label={page.title}
      onSelect={onSelect}
      selected={selected}
    />
  );
}
