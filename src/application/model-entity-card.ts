import { modelInspectionOf } from '@/application/model-inspection';
import type { ModelQueryContext } from '@/application/model-reader';
import type { EntityCard } from '@/application/plan-pages-entity-card';
import { kindOf } from '@/domain/ids';
import { plain } from '@/domain/plain-text';
import { cutAtWord } from '@/shared/plain-text';
import { plural } from '@/shared/text';

/** The existing hover-card presentation reads the same native inspection as the expanded panel. */
export function modelEntityCard(context: ModelQueryContext, id: string): EntityCard | null {
  const inspection = modelInspectionOf(context, id);
  if (inspection === null) return null;
  const { view } = inspection;
  const owner = view.owner.find((ref) => kindOf(ref.id) === 'team');
  const summary = plain(view.text, (target) => context.afterIndex.label(target));
  return {
    glyph: view.glyph,
    type: view.type,
    name: view.name,
    status: view.status,
    team: owner?.label ?? null,
    lines: view.changes
      .slice(0, 4)
      .map((change) => ({ change: change.kind, summary: change.summary })),
    inPlan: view.changes.length === 0 ? null : plural(view.changes.length, 'change'),
    summary: summary === '' || summary === view.name ? null : cutAtWord(summary, 180),
  };
}
