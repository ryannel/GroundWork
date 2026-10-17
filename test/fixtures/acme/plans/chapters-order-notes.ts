// A plan for the story chapters that is approved: an overlay on Acme's today that lets a customer leave a delivery
// note. Every choice is accepted, every call it walks has a contract test, and its five work items are on GitHub, so
// the status of those issues moves it from approved to in delivery to delivered.
// Its records show a new field beside a deprecated one, two notes, a renamed summary, a type change nobody reads, and
// a required field whose writer nobody moves.
import { planOnAcme, type PlanOverlay } from '@/../test/plan-kit';
import type { IssueStatus } from '@/domain/plan/plan-status';
import type { Plan } from '@/domain/plan/plan.generated';

/** The overlay as it would be written in plans/order-notes/plan.yaml. */
function orderNotesOverlay(): PlanOverlay {
  return {
    meta: {
      id: 'order-notes',
      title: 'Leave a note for the courier',
      version: '1.0',
      date: '2026-03-20',
      status: 'approved',
      authors: ['Web'],
      appetite: '4 weeks',
      repos: ['acme/ordering', 'acme/shop'],
      revisions: [
        {
          version: '1.0',
          status: 'approved',
          date: '2026-03-20',
          approved_on: '2026-03-25',
          approved_by: 'Orders',
        },
      ],
    },
    problem: {
      summary: 'A courier cannot tell where to leave an order.',
      why: 'One order in twenty brings a call to support about where to leave it. Those calls come to 5% of orders.',
      goals: [
        'A note the customer writes reaches the courier',
        'The note shows on the confirmation',
      ],
      non_goals: ['Notes on returns'],
      metrics: [
        {
          name: 'Calls about where to leave an order',
          today: '5% of orders',
          target: '1% of orders',
        },
      ],
      scenarios: [
        {
          id: 'sc:leave-note',
          title: 'A customer asks for the parcel to go next door',
          story: 'The customer writes “next door, number 12” and places the order.',
          flows: ['flow:place-order'],
        },
      ],
      glossary: [{ term: 'Delivery note', means: 'What the customer tells the courier.' }],
    },
    story: {
      chapters: {
        prove: {
          headline: 'Two contract tests and two end-to-end walks prove the note.',
        },
      },
    },
    changes: [
      {
        id: 'chg:note-field',
        title: 'Orders keep the customer’s note',
        decisions: ['dec:free-text'],
        ops: [{ add: 'field', into: 'sch:order', value: { name: 'note', type: 'string' } }],
      },
      {
        id: 'chg:note-on-basket',
        title: 'The basket asks for a note',
        decisions: ['dec:note-length'],
        ops: [
          {
            modify: 'flow:place-order#submit',
            set: { action: 'Send the basket and the note' },
          },
        ],
      },
      {
        id: 'chg:cancel-keeps-note',
        title: 'A cancelled order keeps its note',
        ops: [
          {
            modify: 'flow:cancel-order#cancel',
            set: { writes: ['sch:order#status', 'sch:order#note'] },
          },
        ],
      },
      {
        id: 'chg:tidy-records',
        title: 'Tidy the records the note passes through',
        ops: [
          { deprecate: 'sch:order#total_cents' },
          {
            add: 'field',
            into: 'sch:search-doc',
            value: { name: 'note', type: 'string', required: true },
          },
          { modify: 'sch:product#sku', set: { note: 'Printed on the label.' } },
          { modify: 'sch:product#name', set: { note: 'Shown to the courier.' } },
          { modify: 'sch:order-placed-v1', set: { summary: 'What the mailer hears.' } },
          { modify: 'sch:product-changed-v1#sku', set: { type: 'uuid' } },
        ],
      },
    ],
    tests: [
      {
        id: 'tst:create-contract',
        level: 'contract',
        name: 'The order API takes the note and the payment',
        proves: ['chg:note-field'],
        walks: ['flow:place-order#create', 'flow:place-order#charge'],
        owner: 'team:orders',
        env: 'ci',
      },
      {
        id: 'tst:cancel-contract',
        level: 'contract',
        name: 'The order desk cancels and the note stays',
        proves: ['chg:cancel-keeps-note'],
        walks: ['flow:cancel-order#cancel'],
        owner: 'team:orders',
        env: 'ci',
      },
      {
        id: 'tst:note-e2e',
        level: 'e2e',
        name: 'A customer leaves a note',
        proves: ['chg:note-field', 'chg:note-on-basket'],
        walks: ['flow:place-order#submit', 'flow:place-order#create'],
        owner: 'team:web',
        env: 'staging',
      },
      {
        id: 'tst:records-e2e',
        level: 'e2e',
        name: 'The note survives a cancel and a re-index',
        proves: ['chg:cancel-keeps-note', 'chg:tidy-records'],
        owner: 'team:orders',
        env: 'staging',
      },
    ],
    milestones: [
      { id: 'ms:m1', name: 'M1 · The note is taken', due: '2026-06-12' },
      { id: 'ms:m2', name: 'M2 · The note is kept', due: '2026-06-26' },
    ],
    work_items: [
      {
        id: 'wi:note-field',
        title: 'Keep the note on the order',
        team: 'team:orders',
        size: 'M',
        milestone: 'ms:m1',
        implements: ['chg:note-field'],
        verified_by: ['tst:create-contract'],
        repo: 'acme/ordering',
        github_issue: 101,
      },
      {
        id: 'wi:note-api',
        title: 'Take the note through the order API',
        team: 'team:orders',
        size: 'S',
        milestone: 'ms:m1',
        implements: ['chg:note-field', 'chg:tidy-records'],
        depends_on: ['wi:note-field'],
        repo: 'acme/ordering',
        github_issue: 102,
      },
      {
        id: 'wi:basket-note',
        title: 'Ask for the note on the basket',
        team: 'team:web',
        size: 'M',
        milestone: 'ms:m1',
        implements: ['chg:note-on-basket'],
        verified_by: ['tst:note-e2e'],
        depends_on: ['wi:note-api'],
        repo: 'acme/shop',
        github_issue: 103,
      },
      {
        id: 'wi:cancel-note',
        title: 'Keep the note when an order is cancelled',
        team: 'team:orders',
        size: 'S',
        milestone: 'ms:m2',
        implements: ['chg:cancel-keeps-note'],
        verified_by: ['tst:cancel-contract'],
        depends_on: ['wi:note-field'],
        repo: 'acme/ordering',
        github_issue: 104,
      },
      {
        id: 'wi:confirm-note',
        title: 'Show the note on the confirmation',
        team: 'team:web',
        size: 'S',
        milestone: 'ms:m2',
        implements: ['chg:note-on-basket'],
        depends_on: ['wi:basket-note'],
        repo: 'acme/shop',
        github_issue: 105,
      },
    ],
    decisions: [
      {
        id: 'dec:free-text',
        title: 'Take the note as free text',
        status: 'accepted',
        decider: 'team:orders',
        decided_on: '2026-03-18',
        reversibility: 'one-way',
        options: [{ name: 'Pick from a list', why_not: 'No list covers every doorstep.' }],
      },
      {
        id: 'dec:note-length',
        title: 'Cap the note at 200 characters',
        status: 'accepted',
        decider: 'team:web',
        decided_on: '2026-03-19',
        reversibility: 'two-way',
      },
    ],
    risks: [
      {
        id: 'risk:rude-notes',
        statement: 'A note is rude to the courier.',
        likelihood: 'low',
        impact: 'med',
        roam: 'mitigated',
        owner: 'team:web',
        mitigation: 'Notes are checked against a word list.',
      },
    ],
    commitment: [
      { team: 'team:orders', confidence: 4 },
      { team: 'team:web', confidence: 4 },
    ],
  };
}

/** The approved plan, before any of its issues is touched. */
export function orderNotes(): Plan {
  return planOnAcme(orderNotesOverlay()).plan;
}

/** The approved plan before its work items are filed as issues: approved, not yet started. */
export function orderNotesUnfiled(): Plan {
  const overlay = orderNotesOverlay();
  const work = (overlay.work_items ?? []).map(({ github_issue: _issue, ...w }) => w);
  return planOnAcme({ ...overlay, work_items: work }).plan;
}

/** Two of the five issues are closed: the plan is in delivery, with M1 still open. */
export const ORDER_NOTES_UNDER_WAY: IssueStatus = {
  'wi:note-field': { state: 'closed', closed_at: '2026-04-08' },
  'wi:note-api': { state: 'closed', closed_at: '2026-04-15' },
};

/** Every issue is closed: the plan is delivered, the last on 27 May. */
export const ORDER_NOTES_DONE: IssueStatus = {
  'wi:note-field': { state: 'closed', closed_at: '2026-04-08' },
  'wi:note-api': { state: 'closed', closed_at: '2026-04-15' },
  'wi:basket-note': { state: 'closed', closed_at: '2026-05-06' },
  'wi:cancel-note': { state: 'closed', closed_at: '2026-05-20' },
  'wi:confirm-note': { state: 'closed', closed_at: '2026-05-27' },
};
