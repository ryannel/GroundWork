// Acme with work across plans, as files: Payments is a partner whose code we cannot read, the "pausing" programme
// gathers two stacked plans (pause-reasons builds on pause-orders), and both record what has happened so far.
// Write it with writeWorkspace and read it back to see the partner, programme and impact pages with real data.
import { acmeModel } from '@/../test/fixtures/acme/model';
import { pauseOrdersOverlay } from '@/../test/fixtures/acme/plans/pause-orders';
import { acmeWorkspace } from '@/../test/fixtures/acme/workspace';
import { filesOf } from '@/../test/workspace-kit';

const PAUSING = {
  id: 'pausing',
  title: 'Paused orders',
  outcome: 'An order clerk can pause an order, and everyone can see why.',
  milestones: [{ id: 'ms:explained', name: 'Every pause is explained', due: '2026-08-01' }],
  decisions: [
    {
      id: 'dec:reason-codes',
      title: 'Pause reasons are a fixed list of codes',
      status: 'proposed',
      decide_by: '2026-06-15',
    },
  ],
  questions: [
    { id: 'q:refund', question: 'Does a paused order hold the payment?', status: 'open' },
  ],
};

const PAUSE_REASONS = {
  meta: {
    id: 'pause-reasons',
    title: 'Say why an order is paused',
    version: '0.1',
    date: '2026-06-01',
    status: 'draft',
    authors: ['Orders'],
    appetite: '1 week',
    programme: 'pausing',
  },
  builds_on: ['pause-orders'],
  problem: {
    summary: 'A paused order does not say why; see [[api:orders-pause]].',
    why: 'The desk cannot tell a late-stock pause from a customer request.',
  },
  changes: [
    {
      id: 'chg:pause-reason',
      title: 'The pause endpoint takes a reason',
      ops: [{ modify: 'api:orders-pause', set: { sig: 'POST /orders/{id}/pause?reason' } }],
    },
  ],
  milestones: [
    {
      id: 'ms:reasons',
      name: 'Pauses say why',
      due: '2026-07-15',
      serves: 'pausing/ms:explained',
    },
  ],
  work_items: [
    {
      id: 'wi:hold-codes',
      title: 'Hold the payment while an order is paused',
      team: 'team:payments',
      milestone: 'ms:reasons',
      needed_by: '2026-07-01',
      depends_on: ['pause-orders/wi:pause-api'],
    },
    {
      id: 'wi:reason-api',
      title: 'Take a reason on the pause endpoint',
      team: 'team:orders',
      milestone: 'ms:reasons',
      implements: ['chg:pause-reason'],
      depends_on: ['wi:hold-codes'],
      repo: 'acme/ordering',
      github_issue: 7,
    },
  ],
};

const PROGRESS = {
  'pause-orders': [
    { at: '2026-06-02', subject: 'wi:pause-api', kind: 'work', state: 'in_progress' },
  ],
  'pause-reasons': [
    {
      at: '2026-06-03',
      subject: 'wi:hold-codes',
      kind: 'commitment',
      state: 'accepted',
      promised_for: '2026-07-20',
      confidence: 'medium',
      said_by: 'Priya Natarajan',
      source: { kind: 'meeting', url: 'https://notes.example/payments-pause' },
    },
    {
      at: '2026-06-10',
      subject: 'wi:hold-codes',
      kind: 'work',
      state: 'in_progress',
      said_by: 'Priya Natarajan',
      source: { kind: 'partner-update' },
    },
  ],
};

/** Acme's files with Payments as a partner, the pausing programme, its two stacked plans and their progress. */
export function pausingFiles(): Record<string, unknown> {
  const workspace = acmeWorkspace();
  const teams = workspace.teams.map((team) =>
    team.id === 'team:payments'
      ? { ...team, partner: true, contacts: [{ name: 'Priya Natarajan', role: 'product' }] }
      : team,
  );
  return {
    ...filesOf({ ...workspace, teams }, acmeModel()),
    'programmes/pausing/programme.yaml': PAUSING,
    'plans/pause-orders/plan.yaml': {
      ...pauseOrdersOverlay(),
      meta: { ...pauseOrdersOverlay().meta, programme: 'pausing' },
    },
    'plans/pause-reasons/plan.yaml': PAUSE_REASONS,
    'plans/pause-orders/progress.yaml': { events: PROGRESS['pause-orders'] },
    'plans/pause-reasons/progress.yaml': { events: PROGRESS['pause-reasons'] },
  };
}
