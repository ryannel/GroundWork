// Plans for the workspace plan index, read without the disk: a care programme of three plans, one stacked on
// another and one overlapping it, with ours and a partner's work, and what each team has said about it.
import { NO_BASE, type BaseInfo } from '@/application/plan/plan-base';
import type { Overlap } from '@/application/plan/plan-stack';
import { standingOf } from '@/application/plan/work-standing';
import type {
  IndexPlanInput,
  IndexTeam,
  PlanIndexInput,
} from '@/application/workspace-work/workspace-plan-index';
import type { Plan, Programme, ProgressEvent } from '@/domain/plan/plan.generated';

export const TEAMS: readonly IndexTeam[] = [
  { id: 'team:orders', name: 'Orders', partner: false, contacts: [] },
  {
    id: 'team:ziklo',
    name: 'Ziklo',
    partner: true,
    contacts: [{ name: 'Louise A. Zieme', role: 'product' }],
  },
];

const PLAN_TEAMS = TEAMS.map((t) => ({ id: t.id, name: t.name }));

export const FINANCING: Plan = {
  meta: { id: 'financing', title: 'Financing status', programme: 'care' },
  problem: { summary: 'Statuses are lost.' },
  teams: PLAN_TEAMS,
  services: [],
  changes: [
    {
      id: 'chg:status-api',
      title: 'A status API',
      ops: [
        {
          add: 'service',
          value: {
            id: 'svc:status',
            name: 'Status',
            kind: 'service',
            team: 'team:orders',
            system: 'sys:finance',
          },
        },
      ],
    },
    {
      id: 'chg:events',
      title: 'Status events',
      ops: [{ modify: 'svc:events', set: { summary: 'Sends statuses' } }],
    },
  ],
  milestones: [{ id: 'ms:m1', name: 'Statuses flow', due: '2027-01-31', serves: 'care/ms:one' }],
  work_items: [
    {
      id: 'wi:status',
      title: 'Build the status API',
      team: 'team:orders',
      milestone: 'ms:m1',
      github_issue: 12,
      repo: 'acme/finance',
      implements: ['chg:status-api'],
    },
    {
      id: 'wi:events',
      title: 'Send status events',
      team: 'team:orders',
      milestone: 'ms:m1',
      implements: ['chg:events'],
      depends_on: ['wi:status'],
    },
  ],
};

export const ORDER_CHANGE: Plan = {
  meta: { id: 'order-change', title: 'Change an order', programme: 'care' },
  problem: { summary: 'Orders cannot change.' },
  builds_on: ['financing'],
  teams: PLAN_TEAMS,
  services: [],
  changes: [
    {
      id: 'chg:quote',
      title: 'Ziklo quotes a change',
      ops: [{ modify: 'svc:status', set: { summary: 'Quotes changes too' } }],
    },
    {
      id: 'chg:revision',
      title: 'Revisions are tracked',
      ops: [{ add: 'system', value: { id: 'sys:revisions', name: 'Revisions' } }],
    },
  ],
  milestones: [
    { id: 'ms:quote', name: 'Ziklo can quote', due: '2027-02-28', serves: 'care/ms:one' },
  ],
  questions: [{ id: 'q:shape', question: 'What shape is the quote?', status: 'open' }],
  work_items: [
    {
      id: 'wi:quote',
      title: 'Provide the order-change quote',
      team: 'team:ziklo',
      milestone: 'ms:quote',
      needed_by: '2027-02-15',
      implements: ['chg:quote'],
      depends_on: ['financing/wi:status'],
    },
    {
      id: 'wi:revise',
      title: 'Track revisions',
      team: 'team:orders',
      milestone: 'ms:quote',
      github_issue: 41,
      repo: 'acme/orders',
      implements: ['chg:revision'],
      depends_on: ['wi:quote'],
      blocked_by: ['q:shape'],
    },
  ],
};

export const LISTING: Plan = {
  meta: { id: 'listing', title: 'Listing page' },
  problem: { summary: 'Stock cars are hidden.' },
  teams: PLAN_TEAMS,
  services: [],
  changes: [
    {
      id: 'chg:status-copy',
      title: 'Listing reads the status',
      ops: [{ modify: 'svc:status', set: { summary: 'Read by the listing' } }],
    },
  ],
  work_items: [
    {
      id: 'wi:listing',
      title: 'Show stock cars',
      team: 'team:orders',
      implements: ['chg:status-copy'],
    },
  ],
};

export const PROGRAMME: Programme = {
  id: 'care',
  title: 'Care in Sweden',
  outcome: 'One Care deal from sale to change.',
  milestones: [{ id: 'ms:one', name: 'One deal', due: '2027-02-20' }],
  decisions: [
    { id: 'dec:replace', title: 'A revised contract replaces the old one', status: 'accepted' },
    {
      id: 'dec:reserve',
      title: 'How long a reservation lasts',
      status: 'proposed',
      decide_by: '2026-12-01',
    },
  ],
  questions: [
    {
      id: 'q:partial',
      question: 'Who recovers a partial Vista completion after [[care/dec:replace]]?',
      status: 'open',
    },
  ],
};

export const EVENTS: Readonly<Record<string, readonly ProgressEvent[]>> = {
  financing: [
    {
      at: '2026-10-01',
      subject: 'wi:status',
      kind: 'work',
      state: 'done',
      source: { kind: 'github', repo: 'acme/finance', issue: 12 },
    },
    { at: '2026-10-02', subject: 'wi:events', kind: 'work', state: 'in_progress' },
  ],
  'order-change': [
    {
      at: '2026-10-20',
      subject: 'wi:quote',
      kind: 'commitment',
      state: 'accepted',
      promised_for: '2027-03-01',
      confidence: 'medium',
      said_by: 'Louise A. Zieme',
      source: { kind: 'meeting', url: 'https://notes.example/quote' },
    },
    {
      at: '2026-11-04',
      subject: 'wi:quote',
      kind: 'work',
      state: 'in_progress',
      said_by: 'Louise A. Zieme',
      source: { kind: 'partner-update' },
    },
  ],
  listing: [],
};

/** order-change and listing both change svc:status, and neither builds on the other. */
export const OVERLAP: Overlap = {
  kind: 'modify-modify',
  target: 'svc:status',
  plans: ['listing', 'order-change'],
  changes: ['listing/chg:status-copy', 'order-change/chg:quote'],
};

export const STACKED_BASE: BaseInfo = {
  ...NO_BASE,
  mode: 'live',
  checkedOn: '2026-10-25',
  builtOn: [{ slug: 'financing', title: 'Financing status', changed: false }],
};

export function inputOf(
  slug: string,
  plan: Plan,
  options: { readonly base?: BaseInfo; readonly overlaps?: readonly Overlap[] } = {},
): IndexPlanInput {
  const events = EVENTS[slug] ?? [];
  return {
    slug,
    plan,
    standing: { ...standingOf(plan, { events: [...events] }, { teams: TEAMS }), changes: [] },
    events,
    status: {},
    base: options.base ?? { ...NO_BASE, mode: 'live' },
    inherited: {},
    overlaps: options.overlaps ?? [],
  };
}

const SYSTEMS: Readonly<Record<string, string>> = {
  'svc:status': 'sys:finance',
  'svc:events': 'sys:finance',
};

/** The three plans and the programme, as the loader hands them over. */
export function careInput(
  overrides: { readonly orderBase?: BaseInfo; readonly listingLanded?: boolean } = {},
): PlanIndexInput {
  return {
    workspace: 'acme',
    plans: [
      inputOf('order-change', ORDER_CHANGE, {
        base: overrides.orderBase ?? STACKED_BASE,
        overlaps: [OVERLAP],
      }),
      inputOf('financing', FINANCING),
      inputOf('listing', LISTING, {
        overlaps: [OVERLAP],
        ...(overrides.listingLanded === true ? { base: { ...NO_BASE, mode: 'landed' } } : {}),
      }),
    ],
    programmes: [PROGRAMME],
    teams: TEAMS,
    systemOf: (id) => SYSTEMS[id] ?? null,
  };
}
