import type { Model } from '@/application/plan/derive';
import type { Deciding } from '@/application/plan-viz-decision';
import { andList, msShort } from '@/application/plan-viz-ladder-order';
import { buildSummary } from '@/application/plan-viz-milestone';
import { shortDate } from '@/application/plan-viz-state';
import { teamName } from '@/application/plan-viz-teams';
import { numWord } from '@/application/plan-viz-text';
import type { WorkItem } from '@/domain/plan/plan.generated';

import {
  asClause,
  gateTitle,
  isApproved,
  planStage,
  possessive,
  reasonOf,
} from './plan-story-cover-standing';
import { teamPart, type TeamPart } from './plan-story-part';

// The words a team's page opens with, and the one line per team on the page for everyone.

const byDate = (date: string | undefined, sep = ''): string =>
  date === undefined ? '' : `${sep} by ${shortDate(date)}`;
const items = (n: number): string => (n === 1 ? 'work item' : 'work items');

function forMilestone(model: Model, w: WorkItem | undefined): string {
  const ms = (model.plan.milestones ?? []).find((m) => m.id === w?.milestone);
  if (ms === undefined) return '';
  const due = ms.due === undefined ? '' : ` (due ${shortDate(ms.due)})`;
  return `, for ${msShort(model, ms.id)}${due}`;
}

function criticalWords(onPath: number, n: number): string {
  if (onPath === 0) return '';
  if (onPath < n) return `, ${numWord(onPath)} on the critical path`;
  return n === 1 ? ', on the critical path' : ', all on the critical path';
}

function leftSentence(model: Model, name: string, p: TeamPart): string {
  const n = p.work.length;
  const open = p.left.length;
  if (open === 0) {
    const which = n === 1 ? 'work item is' : `${numWord(n)} work items are`;
    return `${possessive(name)} ${which} done.`;
  }
  const forMs = forMilestone(model, p.left[0]);
  if (open < n)
    return `${name} has ${numWord(open)} of ${numWord(n)} work items still to do${forMs}.`;
  if (n === 1) return `${possessive(name)} work item is still to do${forMs}.`;
  return `${name} has all ${numWord(n)} work items still to do${forMs}.`;
}

function buildsSentence(model: Model, team: string, p: TeamPart): string {
  const name = teamName(model, team);
  const n = p.work.length;
  if (p.started) return leftSentence(model, name, p);
  return `${name} builds ${numWord(n)} ${items(n)}${criticalWords(p.onPath.length, n)}.`;
}

const firstDated = (gates: readonly Deciding[]): Deciding | undefined =>
  gates.find((e) => e.decide_by !== undefined) ?? gates[0];

function decidesSentence(name: string, decides: readonly Deciding[]): string {
  const first = firstDated(decides);
  if (first === undefined) return '';
  if (decides.length === 1) {
    return `${name} decides one thing the plan waits on${byDate(first.decide_by, ',')}: ${asClause(gateTitle(first))}`;
  }
  const when = first.decide_by === undefined ? '' : `; the first${byDate(first.decide_by)}`;
  return `${name} decides ${numWord(decides.length)} things the plan waits on${when}.`;
}

function listed(model: Model, ids: readonly string[]): string {
  const names = andList(ids.slice(0, 2).map((id) => model.label(id)));
  return ids.length > 2 ? `${names} and ${numWord(ids.length - 2)} more` : names;
}

function nothingChanges(model: Model, name: string, p: TeamPart): string {
  const [first] = p.steps;
  if (first?.caller !== null && first?.caller !== undefined && first.via !== null) {
    const caller = model.label(first.caller);
    const route = `${caller} still calls ${model.label(first.via)} the same way`;
    return `Nothing in ${name} changes: ${route}; only what ${caller} does around the call changes.`;
  }
  const same = p.connections.dependsOnYou.filter((r) => r.status === 'existing');
  const callers = [...new Set(same.filter((r) => r.kind === 'api').map((r) => r.other))];
  const listeners = [...new Set(same.filter((r) => r.kind === 'msg').map((r) => r.other))];
  if (callers.length > 0) {
    const verb = callers.length === 1 ? 'calls' : 'call';
    return `Nothing in ${name} changes: ${listed(model, callers)} still ${verb} it through the same endpoints.`;
  }
  if (listeners.length > 0) {
    const verb = listeners.length === 1 ? 'listens' : 'listen';
    return `Nothing in ${name} changes: ${listed(model, listeners)} still ${verb} to the same events.`;
  }
  return `This plan asks nothing of ${name}.`;
}

function lowHeadline(name: string, p: TeamPart): string {
  const why = reasonOf(p.vote?.note);
  const reason = why === '' ? '' : `: ${why}`;
  return `${name} is not confident (${String(p.vote?.confidence)} of 5)${reason}.`;
}

/** The headline: the team's single most important fact (vote under 3, decides a gate, builds, its steps change, nothing). */
export function headlineOf(model: Model, team: string, p: TeamPart): string {
  const name = teamName(model, team);
  if (p.low) return lowHeadline(name, p);
  if (p.decides.length > 0) return decidesSentence(name, p.decides);
  if (p.work.length > 0) return buildsSentence(model, team, p);
  const touched = p.steps.filter((s) => s.kind !== 'differently' || !s.sameCall);
  if (touched.length === 0) return nothingChanges(model, name, p);
  const flows = [...new Set(touched.map((s) => model.label(s.flow)))].slice(0, 2);
  return `${possessive(name)} part of ${andList(flows)} changes, with nothing for ${name} to build.`;
}

function waitsSentence(model: Model, name: string, p: TeamPart): string {
  const gate = p.waitsOn[0]?.gate;
  if (gate === undefined) return '';
  const decider = gate.decider === undefined ? '' : `${possessive(teamName(model, gate.decider))} `;
  const by = gate.decide_by === undefined ? '' : ` (decide by ${shortDate(gate.decide_by)})`;
  const more = p.waitsOn.length > 1 ? ` and ${numWord(p.waitsOn.length - 1)} more` : '';
  return `${possessive(name)} part waits on ${decider}decision${by}${more}.`;
}

/** The next one or two facts after the headline, in plain sentences. */
export function ledeOf(model: Model, team: string, p: TeamPart): string {
  const bits: string[] = [];
  if (p.low) bits.push('The plan is rethought before its owner approves it.');
  if ((p.low || p.decides.length > 0) && p.work.length > 0)
    bits.push(buildsSentence(model, team, p));
  bits.push(waitsSentence(model, teamName(model, team), p));
  return bits.filter((b) => b !== '').join(' ');
}

export interface Bit {
  readonly tone: 'warn' | 'quiet' | 'plain';
  readonly text: string;
}

function buildBit(p: TeamPart): string {
  const n = p.work.length;
  const open = p.left.length;
  if (!p.started) return `builds ${numWord(n)}${criticalWords(p.onPath.length, n)}`;
  if (open === 0) return 'all its work done';
  if (open === n) return n === 1 ? 'one work item to do' : `all ${numWord(n)} work items to do`;
  return `${numWord(open)} of ${numWord(n)} work items to do`;
}

function quiet(p: TeamPart): Bit {
  const involved = p.steps.length > 0 || p.connections.dependsOnYou.length > 0;
  return { tone: 'quiet', text: involved ? 'nothing changes for it' : 'has no part in this plan' };
}

/** "builds three, on the critical path · decides one by 16 Oct" as plain bits, the loud one first. */
function partLine(model: Model, team: string): readonly Bit[] {
  const p = teamPart(model, team);
  const first = firstDated(p.decides);
  const unrated = p.vote !== null && p.vote.confidence === undefined && !isApproved(p.stage);
  const bits: Bit[] = [
    ...(p.low
      ? [{ tone: 'warn', text: `not confident (${String(p.vote?.confidence)} of 5)` } as const]
      : []),
    ...(first === undefined
      ? []
      : [
          {
            tone: 'plain',
            text: `decides ${numWord(p.decides.length)}${byDate(first.decide_by)}`,
          } as const,
        ]),
    ...(p.work.length > 0 ? [{ tone: 'plain', text: buildBit(p) } as const] : []),
    ...(p.work.length === 0 && p.steps.some((s) => !s.sameCall)
      ? [{ tone: 'plain', text: 'its steps change, nothing to build' } as const]
      : []),
    ...(unrated ? [{ tone: 'plain', text: 'has not rated its confidence' } as const] : []),
  ];
  return bits.length > 0 ? bits : [quiet(p)];
}

export interface TeamLine {
  readonly team: string;
  readonly bits: readonly Bit[];
}

function everyoneHeadline(model: Model, low: readonly TeamLine[]): string {
  const path = buildSummary(model).pathTeams.map((id) => teamName(model, id));
  const [lead = ''] = path;
  if (low.length > 0) {
    const names = andList(low.map((l) => teamName(model, l.team)));
    return `${names} ${low.length === 1 ? 'blocks' : 'block'} the plan: not confident yet.`;
  }
  if (planStage(model) === 'delivered') return 'Every team’s work in this plan is done.';
  if (path.length === 1) return `${lead} carries the critical path.`;
  if (path.length === 2) return `${andList(path)} carry the critical path.`;
  return path.length > 2
    ? `${lead} carries most of the critical path.`
    : 'What this plan asks of each team.';
}

/** One line per team, the team holding the plan up first. */
export function everyone(model: Model): { headline: string; lines: TeamLine[] } {
  const lines = model.plan.teams.map((t) => ({ team: t.id, bits: partLine(model, t.id) }));
  const low = lines.filter((l) => l.bits.some((b) => b.tone === 'warn'));
  return {
    headline: everyoneHeadline(model, low),
    lines: [...low, ...lines.filter((l) => !low.includes(l))],
  };
}
