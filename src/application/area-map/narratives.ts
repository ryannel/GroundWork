import type { Model } from '@/application/plan/derive';
import { buildId } from '@/domain/ids';
import type { SystemNarratives } from '@/domain/system-narrative';
import type { System } from '@/domain/workspace';

export interface AreaNarratives {
  readonly stories: SystemNarratives['stories'];
  readonly notice: string | null;
}

/** References establish what the interpretation discusses, never a new execution edge. */
export function areaNarratives(system: System, model?: Model): AreaNarratives {
  const narrative = system.narratives;
  if (narrative === undefined) return { stories: [], notice: null };
  if (narrative.status === 'stale') {
    return { stories: [], notice: 'Story needs review: its system or flow evidence has changed.' };
  }
  const components = new Set(system.components.map((component) => component.id));
  const invalid = narrative.stories.some(
    (story) =>
      (story.connections ?? []).some((connection) =>
        [connection.from, connection.to, ...connection.evidence].some(
          (id) => model?.asIs.get(id) === undefined,
        ),
      ) ||
      (story.relatedSystems ?? []).some(
        (id) => model?.asIs.get(buildId('sys', id)) === undefined,
      ) ||
      story.stages.some(
        (stage) =>
          [stage.component, ...stage.supporting].some((id) => !components.has(id)) ||
          stage.evidence.some((id) => model?.asIs.get(id) === undefined),
      ),
  );
  if (invalid) {
    return {
      stories: [],
      notice: 'Story needs review: a component or evidence reference is missing.',
    };
  }
  return { stories: narrative.stories, notice: null };
}
