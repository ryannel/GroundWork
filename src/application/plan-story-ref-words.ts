import type { Model } from '@/application/plan/derive';
import { type RegisterGroupKey, registerCounts } from '@/application/plan-story-ref-register';
import { buildSummary } from '@/application/plan-viz-milestone';
import { isResolved } from '@/application/plan-viz-risks';
import { countWord, numWord } from '@/application/plan-viz-text';

import { poolOf } from './plan-story-ref';

// The headline and lede of each reference catalogue: what is true of the whole plan, then what the page is for.

export interface RefHead {
  readonly headline: string;
  readonly lede: string;
}

const diff = <T extends { readonly id: string }>(
  pick: (g: Model['asIs']) => readonly T[],
  model: Model,
): readonly T[] => poolOf(pick(model.asIs), pick(model.toBe), 'diff');

const sentence = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;

function services(model: Model): RefHead {
  const list = diff((g) => g.services, model);
  const builders = new Set(list.map((s) => s.team)).size;
  return {
    headline: sentence(
      `${countWord(list.length, 'component')} run the system, built by ${countWord(builders, 'team')}`,
    ),
    lede: 'Everything that runs, grouped by the team that owns it.',
  };
}

function stores(model: Model): RefHead {
  const list = diff((g) => g.stores, model);
  const pipes = list.filter((s) => s.kind === 'topic' || s.kind === 'queue').length;
  const data = countWord(list.length - pipes, 'data store');
  const carry =
    pipes === 0
      ? ''
      : ` and ${countWord(pipes, 'topic or queue', 'topics and queues')} carry its events`;
  return {
    headline: sentence(`${data} hold the system's records${carry}`),
    lede: 'Databases, warehouses and caches, with who owns each and who else reads or writes it. Topics and queues are listed apart: they only carry events.',
  };
}

function apis(model: Model): RefHead {
  const list = diff((g) => g.interfaces, model);
  const n = list.reduce((sum, i) => sum + i.endpoints.length, 0);
  return {
    headline: sentence(
      `${countWord(n, 'endpoint')} sit behind ${countWord(list.length, 'interface')}`,
    ),
    lede: 'Every endpoint, grouped by the interface that serves it: signature, who calls it, and, opened, what it takes and returns.',
  };
}

function schemas(model: Model): RefHead {
  const list = diff((g) => g.schemas, model);
  const records = list.filter((s) => s.kind === 'record').length;
  return {
    headline: sentence(
      `${countWord(list.length, 'schema')} define the data, ${numWord(records)} of them stored records`,
    ),
    lede: 'Records grouped by the store that holds them; request bodies and event data on their own; the graph’s types with the subgraphs that own their fields.',
  };
}

function events(model: Model): RefHead {
  const list = diff((g) => g.messages, model);
  const topics = new Set(list.map((m) => m.topic)).size;
  return {
    headline: sentence(
      `${countWord(list.length, 'event')} travel over ${countWord(topics, 'topic')}`,
    ),
    lede: 'Messages on topics: who publishes, who listens, how it is delivered, and which version replaces which.',
  };
}

function flows(model: Model): RefHead {
  const list = diff((g) => g.flows, model);
  return {
    headline: sentence(`${countWord(list.length, 'flow')} run through the system`),
    lede: 'Every flow, step by step. Open one to see its steps.',
  };
}

function screens(model: Model): RefHead {
  const list = diff((g) => g.screens, model);
  const apps = new Set(list.map((s) => s.service)).size;
  return {
    headline: sentence(
      `${countWord(list.length, 'screen')} are shown by ${countWord(apps, 'app')}`,
    ),
    lede: 'What people see: pages, modals, emails and prints, grouped by the app that serves them, with the regions this plan names outlined.',
  };
}

function operations(model: Model): RefHead {
  const list = diff((g) => g.operations, model);
  return {
    headline: sentence(`The front end sends ${countWord(list.length, 'operation')} to the graph`),
    lede: 'What the front end asks the graph for, by screen: which teams own the answer and where it is cached.',
  };
}

function ledger(model: Model): RefHead {
  const n = (model.plan.changes ?? []).length;
  return {
    headline:
      n === 0
        ? 'This plan makes no changes.'
        : sentence(`This plan makes ${countWord(n, 'change')}`),
    lede: 'Every change in this plan, in order. Open one to see its edits.',
  };
}

function tests(model: Model): RefHead {
  const n = (model.plan.tests ?? []).length;
  return {
    headline:
      n === 0 ? 'This plan names no tests.' : sentence(`${countWord(n, 'test')} prove the changes`),
    lede: 'What proves each change, by level: who owns the test and where it runs.',
  };
}

function work(model: Model): RefHead {
  const sum = buildSummary(model, model.today);
  const done = sum.started ? `, ${String(sum.done)} done` : '';
  return {
    headline:
      sum.total === 0
        ? 'This plan has no work items yet.'
        : sentence(`${countWord(sum.total, 'work item')} to build${done}`),
    lede: 'Everything to build, by milestone, in build order. Needs are what must be done first; blocks are what is waiting for it.',
  };
}

function milestones(model: Model): RefHead {
  const n = (model.plan.milestones ?? []).length;
  return {
    headline:
      n === 0
        ? 'This plan has no milestones.'
        : sentence(`The build lands in ${countWord(n, 'milestone')}`),
    lede: 'What works when each milestone is done, and the work that gets it there.',
  };
}

function risks(model: Model): RefHead {
  const all = model.plan.risks ?? [];
  const open = all.filter((r) => !isResolved(r)).length;
  const tail = open === all.length ? '' : `, ${numWord(open)} still open`;
  return {
    headline:
      all.length === 0
        ? 'This plan records no risks.'
        : sentence(`${countWord(all.length, 'risk')} could hurt the plan${tail}`),
    lede: 'What could go wrong. The grid places every risk by likelihood and impact; the register lists them, biggest first.',
  };
}

function teams(model: Model): RefHead {
  return {
    headline: sentence(`${countWord(model.plan.teams.length, 'team')} own the system`),
    lede: 'Who owns what: components, interfaces and events, the changes, work items and tests each team carries, and what it decides. A count opens the names.',
  };
}

function decisions(model: Model): RefHead {
  const { total, counts } = registerCounts(model);
  const key = (k: RegisterGroupKey): number => counts[k];
  return {
    headline:
      total === 0
        ? 'This plan records no decisions or questions.'
        : sentence(
            `${String(key('decide'))} to decide, ${String(key('decided'))} decided, ${String(total)} in all`,
          ),
    lede: 'Every decision and question in the plan, numbered D for a decision and Q for a question. To decide must be settled before the plan is approved; Decided is what it is built on. A question appears on the card of the decision that answers it. The folded groups block nothing.',
  };
}

const HEADS: Readonly<Record<string, (model: Model) => RefHead>> = {
  services,
  stores,
  apis,
  schemas,
  events,
  flows,
  screens,
  operations,
  ledger,
  tests,
  work,
  milestones,
  risks,
  teams,
  decisions,
};

/** The headline and lede of one catalogue, by its screen key. */
export function refHead(model: Model, key: string): RefHead {
  return HEADS[key]?.(model) ?? { headline: 'Reference', lede: '' };
}
