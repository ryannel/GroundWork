import { modelKindPresentation } from '@/application/model-chip';
import { modelInspectionRecords } from '@/application/model-inspection';
import type { ModelQueryContext } from '@/application/model-reader';
import type { PaletteEntry } from '@/application/plan-pages-search';
import { modelText } from '@/domain/workspace-model';

const PARTS = new Set(['field', 'step', 'region', 'failure']);

/** Search the supplied native facts and plan reasoning, including identities removed by the selected plan. */
export function modelPaletteEntries(
  context: ModelQueryContext,
  screens: readonly PaletteEntry[],
): readonly PaletteEntry[] {
  return [
    ...screens,
    ...modelInspectionRecords(context).map((record): PaletteEntry => {
      const index =
        context.afterIndex.get(record.id) === null ? context.beforeIndex : context.afterIndex;
      const node = index.get(record.id);
      const place = node?.place.system;
      const presentation = modelKindPresentation(record.kind);
      const parent = node?.parent;
      const part = PARTS.has(record.kind);
      const owner = part ? parent : place;
      const where = typeof owner === 'string' ? index.label(owner) : '';
      const hint = [presentation.word, where].filter(Boolean).join(' · ');
      const words = [
        'sig',
        'method',
        'path',
        'rpc',
        'signature',
        'call',
        'summary',
        'does',
        'description',
        'question',
      ]
        .map((key) => modelText(record.data[key]) ?? '')
        .join(' ');
      return {
        kind: part ? 'part' : 'thing',
        group: record.kind,
        target: record.id,
        label: record.label,
        hint,
        glyph: presentation.glyph,
        haystack: `${record.label} ${record.id} ${hint} ${words}`.toLowerCase(),
      };
    }),
  ];
}
