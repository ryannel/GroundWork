import type { JourneyRow } from '@/application/plan/journey';
import type { Evidence } from '@/application/plan/journey-evidence';
import type { StepNode } from '@/domain/plan/plan-graph';

// The words a journey uses to say how a step differs between today and the plan.

export type JourneyMode = 'asIs' | 'toBe';

/** Today, or the plan; any name for the plan reads as the plan. */
export const modeOf = (mode: string): JourneyMode =>
  ['toBe', 'planned', 'plan'].includes(mode) ? 'toBe' : 'asIs';

export const MODE_NAMES: Readonly<Record<JourneyMode, string>> = {
  asIs: 'Today',
  toBe: 'With this plan',
};

/** The step as it runs in the chosen view, or null where the view does not have it. */
export const stepIn = (row: JourneyRow | null | undefined, mode: JourneyMode): StepNode | null =>
  (mode === 'asIs' ? row?.before : row?.after) ?? null;

/** What a row is called: its action in the chosen view, else in the other, else its id. */
export const rowTitle = (row: JourneyRow, mode: JourneyMode): string =>
  stepIn(row, mode)?.action ?? row.after?.action ?? row.before?.action ?? row.id;

const KIND_WORDS: Readonly<Partial<Record<JourneyRow['kind'], string>>> = {
  changed: 'Works differently',
  added: 'New step',
  removed: 'Removed with this plan',
  deprecated: 'Deprecated · still works',
};

const PROPS: Readonly<Record<string, string>> = {
  action: 'Action',
  logic: 'Behaviour',
  fails: 'If it fails',
  screen: 'Linked screen',
  shows: 'What appears',
  reads: 'Reads',
  writes: 'Writes',
  from: 'From',
  to: 'To',
  via: 'Interface',
  request: 'Request',
  response: 'Response',
  payload: 'Event data',
  fields: 'Fields',
  type: 'Type',
  required: 'Required',
  optional: 'Optional',
  summary: 'Meaning',
  name: 'Name',
  outcome: 'Outcome',
  at: 'Region position',
  image: 'Screen picture',
  order: 'Position in the flow',
  note: 'Meaning',
  notes: 'Notes',
  returns: 'Returns',
};

/** A property named for a reader; one the plan has no word for keeps its own name. */
export const propLabel = (property: string | null): string =>
  property === null ? '' : (PROPS[property] ?? property);

const isPicture = (e: Evidence): boolean => e.kind === 'screen' && e.property === 'image';

function indirectMarker(evidence: readonly Evidence[]): string {
  const screens = evidence.filter((e) => e.kind === 'screen-context');
  if (screens.length > 0) {
    return screens.every((e) => e.property === 'image')
      ? 'Screen picture changes'
      : 'Screen context changes';
  }
  return evidence.length > 0 ? 'Related data changes' : '';
}

const isLayout = (e: Evidence): boolean => e.kind === 'screen-layout';

function directMarker(direct: readonly Evidence[]): string {
  if (direct.every((e) => isLayout(e) || isPicture(e))) {
    return 'Screen layout changes';
  }
  if (direct.every((e) => e.kind === 'screen' || isLayout(e))) {
    return 'Screen changes';
  }
  if (direct.every((e) => e.kind === 'order')) return 'Step order changes';
  if (direct.every((e) => e.kind === 'field')) return 'Data changes';
  return 'Works differently';
}

/** The short marker for a step: what kind of difference the plan makes to it. Empty when it runs as today. */
export function journeyMarkerText(row: JourneyRow | null | undefined, mode: JourneyMode): string {
  if (row === null || row === undefined) return '';
  if (row.kind === 'deprecated' && mode === 'asIs') {
    return 'Deprecated with this plan · still works';
  }
  const word = KIND_WORDS[row.kind];
  if (word !== undefined && row.kind !== 'changed') return word;
  const direct = row.evidence.filter((e) => !e.indirect);
  return direct.length === 0 ? indirectMarker(row.evidence) : directMarker(direct);
}

const STEP_PROPS = ['logic', 'action', 'fails'];

/** How plainly a piece of evidence says what the step does; lower comes first. */
export function evidenceRank(e: Evidence): number {
  if (e.indirect) return 100;
  if (e.kind === 'step' && e.property !== null && STEP_PROPS.includes(e.property)) {
    return STEP_PROPS.indexOf(e.property);
  }
  if (e.kind === 'screen' && (e.property === 'shows' || e.property === null)) return 3;
  if (e.kind === 'order') return 5;
  if (isLayout(e) || e.kind === 'screen-context' || e.property === 'image') {
    return 50;
  }
  return 10;
}
