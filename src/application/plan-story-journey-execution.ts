import type { Model } from '@/application/plan/derive';
import { journeyGroups } from '@/application/plan-story-journey-groups';
import { firstSentence } from '@/application/plan-viz-text';
import { plain } from '@/shared/plain-text';

// How the plan plays out, in the plan's own words: each path as a list of steps, and where a step cites a flow,
// the page of the journey chapter that walks it.

export interface ExecutionStep {
  readonly label: string;
  readonly detail: string;
  /** The page that walks the flow this step cites, when there is one. */
  readonly page: string | null;
}

export interface ExecutionPath {
  readonly name: string;
  readonly summary: string;
  readonly steps: readonly ExecutionStep[];
}

export interface ExecutionStory {
  readonly headline: string;
  readonly paths: readonly ExecutionPath[];
}

const FLOW_CITATION = /\[\[(flow:[^\]]+)\]\]/;

export function executionStory(model: Model): ExecutionStory | null {
  const { execution } = model.plan;
  if (execution === undefined) return null;
  const groups = journeyGroups(model);
  const pageOf = (detail: string): string | null => {
    const flow = FLOW_CITATION.exec(detail)?.[1];
    return groups.find((g) => flow !== undefined && g.flows.includes(flow))?.key ?? null;
  };
  const headline = firstSentence(plain(execution.summary, (id) => model.label(id)));
  return {
    headline: headline === '' ? 'The plan follows these paths.' : headline,
    paths: execution.paths.map((path) => ({
      name: path.name,
      summary: path.summary ?? '',
      steps: path.steps.map((step) => ({
        label: step.label,
        detail: step.detail,
        page: pageOf(step.detail),
      })),
    })),
  };
}
