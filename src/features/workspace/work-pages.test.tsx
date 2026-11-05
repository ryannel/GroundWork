// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { careInput } from '@/../test/fixtures/plan-index';
import { impactRowsOf, impactVM } from '@/application/workspace-work/impact';
import { partnerPageVM } from '@/application/workspace-work/partner-page';
import { partnersVM } from '@/application/workspace-work/partners';
import {
  landingOf,
  programmePageVM,
  programmeRowsOf,
} from '@/application/workspace-work/programme-page';
import { workspacePlanIndexOf } from '@/application/workspace-work/workspace-plan-index';

import { PartnerPage, PartnersPage, ProgrammePage, ProgrammesPage } from './index';
import { PlanParts } from './plan-parts';

vi.mock(import('next/navigation'), () => ({ usePathname: () => '/acme/' }));

afterEach(cleanup);

const index = workspacePlanIndexOf(careInput());
const today = new Date('2026-11-18T12:00:00Z');

const section = (name: string): HTMLElement => screen.getByRole('region', { name });
const hrefOf = (link: HTMLElement): string => link.getAttribute('href')?.replace(/\/$/u, '') ?? '';

describe('ProgrammesPage', () => {
  it('lists each programme with its plans, how many are held up and the next', () => {
    render(<ProgrammesPage rows={programmeRowsOf(index)} />);
    expect(screen.getByText('1 programme, 1 with a plan held up')).toBeTruthy();
    expect(hrefOf(screen.getByRole('link', { name: 'Care in Sweden' }))).toBe(
      '/acme/programmes/care',
    );
    expect(screen.getByText('One Care deal from sale to change.')).toBeTruthy();
    expect(screen.getByText(/2 plans · 1 held up · next held up:/u)).toBeTruthy();
    expect(hrefOf(screen.getByRole('link', { name: 'Change an order' }))).toBe(
      '/acme/plans/order-change',
    );
  });

  it('says where programmes live when there are none', () => {
    render(<ProgrammesPage rows={[]} />);
    expect(screen.getByText('No programmes yet')).toBeTruthy();
  });
});

describe('ProgrammePage', () => {
  const page = programmePageVM(index, 'care')!;
  const landing = landingOf(
    'acme',
    ['financing', 'order-change'],
    [
      {
        id: 'financing',
        title: 'Financing status',
        href: '/acme/plans/financing/',
        summary: '',
        stage: 'draft',
        date: null,
        domains: ['finance'],
        workItems: 2,
        done: 1,
        programme: 'care',
        check: null,
      },
    ],
    [{ id: 'finance', name: 'Finance' }],
  );

  it('opens on its outcome and where it stands, then its plans in landing order', () => {
    render(<ProgrammePage landing={landing} page={page} today={today} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Care in Sweden');
    expect(
      screen.getByText('0 of 2 plans landed; Change an order is the next held up.'),
    ).toBeTruthy();
    const plans = within(section('Plans'));
    expect(plans.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringMatching(
        /^1\. Financing status.*Ready.*Builds on today.*1 of 2 work items done/u,
      ),
      expect.stringMatching(
        /^2\. Change an order.*Held up: 1 of 2 work items blocked.*Builds on Financing status \(work still to do\)/u,
      ),
    ]);
  });

  it('shows its milestones with what serves them, its decisions, questions, landing and partner work', () => {
    render(<ProgrammePage landing={landing} page={page} today={today} />);
    const milestones = within(section('Milestones'));
    expect(milestones.getByText('One deal')).toBeTruthy();
    expect(
      milestones.getByText(
        'needed by 20 Feb 2027 · promised for 1 Mar 2027 · 9 days after we need',
      ),
    ).toBeTruthy();
    expect(milestones.getByText(/Served by/u).textContent).toBe(
      'Served by Statuses flow in Financing status, Ziklo can quote in Change an order',
    );
    const decisions = within(section('Decisions'));
    expect(decisions.getByText('How long a reservation lasts')).toBeTruthy();
    expect(decisions.getByText('by 1 Dec')).toBeTruthy();
    expect(decisions.getByText('proposed')).toBeTruthy();
    expect(within(section('Questions')).getByText(/partial Vista completion/u)).toBeTruthy();
    expect(within(section('Where it lands')).getByText('(1 plan)')).toBeTruthy();
    const partners = within(section('Partner dependencies'));
    expect(partners.getByText('Provide the order-change quote')).toBeTruthy();
    expect(partners.getByText('Ziklo owns · we depend on this · Ziklo can quote')).toBeTruthy();
    expect(
      partners.getByText('needed by 15 Feb 2027 · promised for 1 Mar 2027 · 14 days after we need'),
    ).toBeTruthy();
    expect(partners.getByText(/Holds up first/u).textContent).toBe(
      'Holds up first: Change an order',
    );
  });

  it('says so where it has nothing yet', () => {
    const bare = workspacePlanIndexOf({
      ...careInput(),
      plans: [],
      programmes: [{ id: 'care', title: 'Care', outcome: 'One deal.' }],
    });
    render(<ProgrammePage landing={[]} page={programmePageVM(bare, 'care')!} today={today} />);
    for (const words of [
      'No plan has joined it yet.',
      'It names no milestones.',
      'It records no decisions.',
      'It records no questions.',
      'Its plans change no domain yet.',
      'No partner work is still to come.',
    ]) {
      expect(screen.getByText(words)).toBeTruthy();
    }
  });
});

describe('PartnersPage', () => {
  it('lists each partner with what they own, their work and when we last heard', () => {
    const rows = partnersVM(
      index,
      [{ id: 'quotes', name: 'Quotes', href: '/acme/finance/quotes/', team: 'team:ziklo' }],
      '2026-11-18',
    );
    render(<PartnersPage rows={rows} today={today} />);
    expect(hrefOf(screen.getByRole('link', { name: 'Ziklo' }))).toBe('/acme/partners/ziklo');
    expect(screen.getByText(/^Owns/u).textContent).toBe('Owns Quotes');
    expect(screen.getByText('1 work item in 1 plan · 1 still to do')).toBeTruthy();
    expect(screen.getByText('Last heard 4 Nov · 2 weeks ago')).toBeTruthy();
  });

  it('says when a partner has nothing in the map, no work and no word, and how to mark one', () => {
    render(
      <PartnersPage
        rows={[
          {
            id: 'team:vcrs',
            name: 'TACDIS',
            href: '/acme/partners/vcrs/',
            systems: [],
            work: { total: 0, open: 0, blocked: 0, plans: 0 },
            lastHeard: null,
          },
        ]}
      />,
    );
    expect(screen.getByText('No system of theirs is in the map yet')).toBeTruthy();
    expect(screen.getByText('No work in any plan')).toBeTruthy();
    expect(screen.getByText('Nothing heard yet')).toBeTruthy();
    cleanup();
    render(<PartnersPage rows={[]} />);
    expect(screen.getByText('No partners yet')).toBeTruthy();
  });
});

describe('PartnerPage', () => {
  const page = partnerPageVM(index, 'team:ziklo')!;
  const cards = new Map([['order-change/wi:quote', <p key="quote">the quote card</p>]]);

  it('names who to talk to and when we last heard, then their milestones with each item’s card', () => {
    render(<PartnerPage cards={cards} page={page} today={today} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ziklo');
    expect(
      screen.getByText('Last heard 4 Nov (2 weeks ago) · Louise A. Zieme · partner update'),
    ).toBeTruthy();
    expect(within(section('Contacts')).getByText('product')).toBeTruthy();
    const milestones = within(section('Milestones'));
    expect(milestones.getByRole('link', { name: 'Ziklo can quote' })).toBeTruthy();
    expect(
      milestones.getByText('needed by 28 Feb 2027 · promised for 1 Mar 2027 · 1 day after we need'),
    ).toBeTruthy();
    expect(milestones.getByText('the quote card')).toBeTruthy();
    expect(screen.queryByText(/overdue/iu)).toBeNull();
  });

  it('keeps their evidence with links, and everything that happened, newest first', () => {
    render(<PartnerPage cards={cards} page={page} today={today} />);
    const evidence = within(section('Evidence'));
    expect(
      hrefOf(evidence.getByRole('link', { name: 'meeting: Provide the order-change quote' })),
    ).toBe('https://notes.example/quote');
    const history = within(section('History'));
    expect(history.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('work in progress'),
      expect.stringContaining('commitment accepted'),
    ]);
  });

  it('says so when nothing is known of them yet', () => {
    const quiet = workspacePlanIndexOf({
      ...careInput(),
      plans: [],
      teams: [{ id: 'team:vcrs', name: 'TACDIS', partner: true, contacts: [] }],
    });
    render(
      <PartnerPage cards={new Map()} page={partnerPageVM(quiet, 'team:vcrs')!} today={today} />,
    );
    for (const words of [
      'Nothing heard yet',
      'No one is named yet: add contacts to the team in workspace.yaml.',
      'None of their work is still to come.',
      'No evidence with a link yet.',
      'Nothing recorded yet.',
    ]) {
      expect(screen.getByText(words)).toBeTruthy();
    }
  });
});

describe('PlanParts', () => {
  it('puts the work across plans still to do here first, grouped by when it can happen', () => {
    const impact = impactVM(index, { kind: 'team', id: 'team:orders' })!;
    render(
      <PlanParts
        impact={impactRowsOf(index, impact)}
        name="Finance"
        parts={[
          {
            id: 'p',
            title: 'Financing status',
            href: '/acme/plans/financing/',
            workItems: 2,
            done: 1,
          },
        ]}
      />,
    );
    const pending = within(screen.getByRole('generic', { name: 'Pending work' }));
    expect(pending.getByText(/^Now:/u)).toBeTruthy();
    expect(pending.getByText(/^Blocked:/u)).toBeTruthy();
    expect(pending.getByRole('link', { name: 'Track revisions' })).toBeTruthy();
    expect(pending.getByText('Open question: What shape is the quote?')).toBeTruthy();
    expect(pending.getAllByText(/^Orders owns · /u)).toHaveLength(3);
    expect(pending.getByText(/^Orders owns · in progress · in/u)).toBeTruthy();
    expect(screen.getByText('1 of 2 work items done')).toBeTruthy();
  });

  it('says a partner owns the work we depend on', () => {
    const impact = impactVM(index, { kind: 'team', id: 'team:ziklo' })!;
    render(<PlanParts impact={impactRowsOf(index, impact)} name="Quotes" parts={[]} />);
    expect(screen.getByText(/^Ziklo owns · we depend on this · in progress · in/u)).toBeTruthy();
    expect(screen.queryByText('No plan changes Quotes yet')).toBeNull();
  });
});
