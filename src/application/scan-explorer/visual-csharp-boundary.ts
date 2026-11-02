import type { CsharpSymbolBinding } from '@/domain/scan/scan.generated';
import type { ExplorerNode, ExplorerPage, ExplorerField } from '@/domain/service-explorer';

import { visualFile } from './visual-file';
import { visualPage } from './visual-page';
import type { VisualContext } from './visual-types';

export function csharpBoundaryNode(
  context: VisualContext,
  record: CsharpSymbolBinding,
  id: string,
): ExplorerNode {
  const member = record.symbol.split('(')[0]?.split('.').slice(-2).join('.') ?? record.symbol;
  return {
    id,
    label: `${record.boundary} · ${member}`,
    detail: [record.symbol, ...record.limitations].join('. '),
    kind: record.boundary === 'storage' ? 'storage' : 'call',
    sourceIds: [record.source],
    target: visualFile(context, record.id),
  };
}
export function csharpBoundaryPage(
  context: VisualContext,
  record: CsharpSymbolBinding,
): ExplorerPage {
  return visualPage(context, {
    kind: 'data',
    title: `${record.boundary} boundary`,
    description:
      'Compiler-bound source call. Argument declarations and observed completion remain separate from provider wire contracts and persisted formats.',
    nodes:
      record.target === null
        ? []
        : [
            {
              id: record.target,
              label: 'Declared target implementation',
              detail: record.symbol,
              kind: 'call',
              sourceIds: [record.source],
              target: visualFile(context, record.target),
            },
          ],
    links: [],
    fields: boundaryFields(record),
    gaps: [
      ...record.limitations,
      ...record.conditions,
      'Effective remote schemas, applied storage state and delivery are unverified.',
    ],
    completeSelection: false,
  });
}

function boundaryFields(record: CsharpSymbolBinding): readonly ExplorerField[] {
  return [
    {
      name: 'Target signature',
      type: record.symbol,
      required: 'unknown',
      nullable: 'unknown',
      sourceIds: [record.source],
    },
    {
      name: 'Dispatch',
      type: record.dispatch,
      required: 'unknown',
      nullable: 'unknown',
      sourceIds: [record.source],
    },
    {
      name: 'Completion in source',
      type: record.completion,
      required: 'unknown',
      nullable: 'unknown',
      sourceIds: [record.source],
    },
    ...record.arguments.map((argument, index) => ({
      name: `Argument ${String(index + 1)}`,
      type: argument.parameter ?? 'Unresolved formal parameter',
      required: 'unknown' as const,
      nullable: 'unknown' as const,
      sourceIds: [argument.source],
    })),
  ];
}
