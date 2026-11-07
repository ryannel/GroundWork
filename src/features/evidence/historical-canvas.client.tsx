'use client';

import { useRouter } from 'next/navigation';

import { historicalEntryHref } from '@/application/entry-history';
import type { ExplorerDrawing } from '@/shared/explorer-drawing';
import { ExplorerCanvas } from '@/ui/explorer-canvas';

export function HistoricalCanvas({
  workspace,
  scope,
  file,
  drawing,
  label,
  selected,
}: {
  readonly workspace: string;
  readonly scope: string;
  readonly file: string;
  readonly drawing: ExplorerDrawing;
  readonly label: string;
  readonly selected: string | null;
}) {
  const router = useRouter();
  return (
    <ExplorerCanvas
      drawing={drawing}
      fit
      label={label}
      onSelect={(node) => {
        router.push(historicalEntryHref(workspace, { scope, page: file, node }), { scroll: false });
      }}
      selected={selected}
    />
  );
}
