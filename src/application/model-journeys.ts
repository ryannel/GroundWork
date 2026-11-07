import { modelJourneyRecordsOf, type JourneyRecord } from '@/application/model-domain';
import { modelFlowOf, type ModelFlowView } from '@/application/model-flow';
import type { ModelIndex } from '@/application/model-index';
import { modelInspectionOf, type ModelInspection } from '@/application/model-inspection';
import { keyOf } from '@/application/plan-pages-key';
import type { JourneyIndex, JourneyRow } from '@/application/today-journey-index';
import { journeyClaim, type TodayJourney } from '@/application/today-journeys';
import { journeyHref } from '@/application/today-reader';
import { tokenToId } from '@/domain/ids';
import { plain } from '@/domain/plain-text';
import type { ModelData, ModelGap } from '@/domain/workspace-model';

function crossed(index: ModelIndex, record: JourneyRecord): readonly string[] {
  return [
    ...new Set(
      [...record.steps.flatMap((step) => [step.from, step.to]), ...record.interactions].flatMap(
        (id) => {
          const node = index.get(id);
          return node?.kind === 'system' ? [node.id] : (node?.place.system ?? []);
        },
      ),
    ),
  ];
}
/** Authored order and declared flow membership stay independent of execution and ownership. */
export function modelJourneysOf(index: ModelIndex): readonly TodayJourney[] {
  return modelJourneyRecordsOf(index).map((record) => ({
    key: keyOf(record.id),
    id: record.id,
    kind: record.kind,
    title: record.name,
    actor: record.actor === '' ? '' : index.label(record.actor),
    trigger: plain(record.trigger, index.label),
    outcome: plain(record.outcome, index.label),
    flows: record.flows,
    systems: crossed(index, record),
    steps: record.steps.length,
  }));
}
export function modelJourneyIndexOf(index: ModelIndex): JourneyIndex {
  const journeys = modelJourneysOf(index);
  const rows = journeys.map((journey): JourneyRow => {
    const domains = [
      ...new Set(journey.systems.flatMap((id) => index.get(id)?.place.domain ?? [])),
    ];
    const through = journey.systems.map(index.label).join(', ');
    return {
      key: journey.key,
      href: journeyHref(index.model.id, journey.key),
      kind: journey.kind,
      title: journey.title,
      actor: journey.actor,
      claim: journeyClaim(journey),
      through,
      domains,
      terms: [
        journey.title,
        journey.actor,
        journey.trigger,
        journey.outcome,
        through,
        ...domains.map(index.label),
      ]
        .join(' ')
        .toLowerCase(),
    };
  });
  const groups = [
    { id: 'journeys', title: 'User journeys', rows: rows.filter((row) => row.kind === 'journey') },
    { id: 'flows', title: 'Authored flows', rows: rows.filter((row) => row.kind === 'flow') },
  ].filter((group) => group.rows.length > 0);
  const touched = new Set(rows.flatMap((row) => row.domains));
  return {
    total: rows.length,
    groups,
    domains: index.model.domains
      .filter((domain) => touched.has(domain.id))
      .map(({ id, name }) => ({ id, name })),
  };
}
export interface ModelJourneyWalk {
  readonly journey: TodayJourney;
  readonly source: ModelData<'JourneyFile'> | null;
  readonly flows: readonly ModelFlowView[];
  readonly interactions: readonly ModelInspection[];
  readonly gaps: readonly ModelGap[];
}
/** Bookmarks using a retired identity resolve through the same explicit alias as other model links. */
export function modelJourneyAt(index: ModelIndex, key: string): TodayJourney | null {
  const resolved = index.get(tokenToId(key) ?? key)?.id;
  return (
    modelJourneysOf(index).find((record) => record.key === key || record.id === resolved) ?? null
  );
}
export function modelJourneyWalkOf(index: ModelIndex, key: string): ModelJourneyWalk | null {
  const journey = modelJourneyAt(index, key);
  if (journey === null) return null;
  const context = { plan: null, profile: null, beforeIndex: index, afterIndex: index };
  const source = index.model.journeys.find((record) => record.id === journey.id) ?? null;
  return {
    journey,
    source,
    flows: journey.flows.flatMap((id) => modelFlowOf(index, id) ?? []),
    interactions: (source?.interactions ?? []).flatMap(
      (id) => modelInspectionOf(context, id) ?? [],
    ),
    gaps: index.gaps(journey.id),
  };
}
