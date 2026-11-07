import { codeCitationResolver } from '@/domain/model-cite-resolution';
import {
  modelText,
  type ModelCite,
  type ModelGap,
  type ModelSystem,
} from '@/domain/workspace-model';

import type { ModelEdge, ModelIndex } from './model-index';

type Narrative = NonNullable<ModelSystem['narratives']>['stories'][number];
interface Reading {
  readonly index: ModelIndex;
  readonly components: ReadonlySet<string>;
  readonly resolve: ReturnType<typeof codeCitationResolver>;
  readonly report: (reference: string, message: string) => void;
}
function edgeKind(kind: ModelEdge['kind']): string | null {
  if (kind === 'call') return 'api';
  if (kind === 'publish' || kind === 'consume') return 'message';
  return kind === 'read' || kind === 'write' ? 'data' : null;
}
function backingSites(index: ModelIndex, id: string): readonly string[] {
  const handler = modelText(index.get(id)?.data.handler_step);
  return handler === null ? [id] : [id, handler];
}
function checkEvidence(
  cites: readonly ModelCite[],
  backs: readonly string[] | undefined,
  reference: string,
  reading: Reading,
): void {
  if (reading.resolve(cites).length === 0) {
    reading.report(reference, 'The interpretation has no resolvable pinned code citation.');
  }
  if ((backs?.length ?? 0) === 0) {
    reading.report(reference, 'The interpretation has no recorded model backing.');
  }
  for (const id of backs ?? []) {
    if (reading.index.get(id) === null) {
      reading.report(id, 'A recorded narrative backing is absent from the current model.');
    }
  }
}
function checkConnection(
  connection: NonNullable<Narrative['connections']>[number],
  story: string,
  reading: Reading,
): void {
  for (const id of [connection.from, connection.to]) {
    if (reading.index.get(id) === null) {
      reading.report(id, 'A narrative connection names an absent current target.');
    }
  }
  checkEvidence(connection.cites, connection.backs, story, reading);
  const sites = new Set((connection.backs ?? []).flatMap((id) => backingSites(reading.index, id)));
  const backed = reading.index
    .edges()
    .some(
      (edge) =>
        sites.has(edge.site) &&
        edge.from === connection.from &&
        edge.to === connection.to &&
        edgeKind(edge.kind) === connection.kind,
    );
  if (!backed) {
    reading.report(
      story,
      'The narrative connection has no matching recorded execution backing; its wording remains an unverified interpretation.',
    );
  }
}
function checkStory(story: Narrative, reading: Reading): void {
  const placed = new Set<string>();
  for (const id of story.stages.flatMap((stage) => [stage.component, ...stage.supporting])) {
    if (!reading.components.has(id)) {
      reading.report(id, 'A narrative stage names no component of its containing system.');
    }
    if (placed.has(id)) reading.report(id, 'A component appears in more than one narrative stage.');
    placed.add(id);
  }
  for (const stage of story.stages) checkEvidence(stage.cites, stage.backs, story.id, reading);
  for (const id of story.relatedSystems ?? []) {
    if (reading.index.get(id)?.kind !== 'system') {
      reading.report(id, 'A related system is absent from the current model.');
    }
  }
  for (const connection of story.connections ?? []) checkConnection(connection, story.id, reading);
}
/** Model references discuss facts; only an exact recorded exchange can back an exchange summary. */
export function modelNarrativeProblems(
  index: ModelIndex,
  system: ModelSystem,
  resolve: ReturnType<typeof codeCitationResolver> = codeCitationResolver(index.model.evidence),
): readonly ModelGap[] {
  const narratives = system.narratives;
  if (narratives === null) return [];
  const problems: ModelGap[] = [];
  const reading: Reading = {
    index,
    resolve,
    components: new Set(system.components.map((component) => component.id)),
    report: (reference, message) => {
      problems.push({ id: system.id, kind: 'narrative_review', reference, message });
    },
  };
  for (const story of narratives.stories) checkStory(story, reading);
  return problems;
}
