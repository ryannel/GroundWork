import type { Model } from '@/application/plan/derive';

import { type AskLine, askLines } from './plan-story-cover-standing';

// The cover: what ships and why, what the room is asked to do now, how it moves the numbers, and a door to each
// team's part.

export interface Stat {
  readonly name: string;
  /** Left out when the plan only says "today". */
  readonly today: string | null;
  readonly after: string;
}

const STAT_MAX = 4;

const isToday = (text: string): boolean => /^today\b/iu.test(text);

/** The plan's measures: up to four, each with where it is today and where it should be after. */
export function statsOf(model: Model): Stat[] {
  return (model.plan.problem.metrics ?? []).slice(0, STAT_MAX).map((m) => {
    const today = (m.today ?? '').trim();
    return {
      name: m.name,
      today: today === '' || isToday(today) ? null : today,
      after: m.target ?? '',
    };
  });
}

/** Teams that have something to do in the plan: a work item, a service, or a question they decide. */
export function teamsWithWork(model: Model): string[] {
  const owners = new Set([
    ...(model.plan.work_items ?? []).map((w) => w.team),
    ...model.toBe.services.map((s) => s.team),
    ...(model.plan.questions ?? []).flatMap((q) =>
      q.decider?.startsWith('team:') === true ? [q.decider] : [],
    ),
  ]);
  return model.plan.teams.map((t) => t.id).filter((id) => owners.has(id));
}

export interface Cover {
  readonly title: string;
  readonly summary: string;
  readonly ask: readonly AskLine[];
  readonly stats: readonly Stat[];
  readonly teams: readonly string[];
}

/** The cover, with today as an ISO date (YYYY-MM-DD). */
export function coverOf(model: Model, today: string): Cover {
  return {
    title: model.plan.meta.title,
    summary: model.plan.problem.summary,
    ask: askLines(model, today),
    stats: statsOf(model),
    teams: teamsWithWork(model),
  };
}
