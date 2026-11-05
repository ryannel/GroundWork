// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkCardVM } from '@/application/workspace-work/work-card';

import { WorkCard } from './work-card';

afterEach(cleanup);

const PARTNER: WorkCardVM = {
  id: 'wi:quote',
  key: 'order-change/wi:quote',
  plan: 'order-change',
  href: '/acme/plans/order-change/things/?id=wi-quote',
  title: 'Provide the order-change quote',
  team: { id: 'team:ziklo', name: 'Ziklo', partner: true },
  ownership: 'we depend on this',
  milestone: { id: 'ms:m3', label: 'M3' },
  issue: null,
  commitment: {
    state: 'accepted',
    promisedFor: '2027-03-01',
    confidence: 'medium',
    saidBy: 'Louise A. Zieme',
  },
  progress: { state: 'in progress', at: '2027-01-12' },
  dates: {
    neededBy: '2027-02-15',
    promisedFor: '2027-03-01',
    gapDays: 14,
    gapText: '14 days after we need',
  },
  lastHeard: { at: '2026-11-04', by: 'Louise A. Zieme', source: 'meeting' },
  blockers: [
    {
      id: 'q:shape',
      label: 'Open question: What shape is the quote?',
      href: '/acme/plans/order-change/things/?id=q-shape',
    },
  ],
  done: false,
};

const OURS: WorkCardVM = {
  ...PARTNER,
  id: 'wi:revise',
  title: 'Track revisions',
  team: { id: 'team:orders', name: 'Orders', partner: false },
  ownership: 'Orders owns',
  issue: { number: 41, url: 'https://github.com/acme/orders/issues/41', state: 'open' },
  dates: { neededBy: '2027-02-15', promisedFor: null, gapDays: null, gapText: null },
  blockers: [],
};

const TODAY = new Date('2026-11-04');

describe('WorkCard', () => {
  it('draws a partner’s work: we depend on it, what they promised against what we need, and Record update', () => {
    render(<WorkCard card={PARTNER} today={TODAY} workspace="acme" />);
    const card = screen.getByRole('article', { name: 'Provide the order-change quote' });
    expect(card.textContent).toContain('Ziklo · we depend on this · M3');
    expect(card.textContent).toContain('accepted, medium confidence, for 1 Mar 2027');
    expect(card.textContent).toContain('in progress');
    expect(card.textContent).toContain('15 Feb 2027');
    expect(card.textContent).toContain('14 days after we need');
    expect(card.textContent).toContain('4 Nov · Louise A. Zieme · meeting');
    expect(screen.getByRole('button', { name: 'Record update' })).toBeDefined();
    expect(within(card).queryByText(/GitHub issue/u)).toBeNull();
    const blocker = screen.getByRole('link', { name: 'Open question: What shape is the quote?' });
    expect(blocker.getAttribute('href')).toMatch(
      /^\/acme\/plans\/order-change\/things\/?\?id=q-shape$/u,
    );
  });

  it('draws our work the same way, with its GitHub issue in place of Record update', () => {
    render(<WorkCard card={OURS} today={TODAY} workspace="acme" />);
    const card = screen.getByRole('article', { name: 'Track revisions' });
    expect(card.textContent).toContain('Orders owns · M3');
    expect(card.textContent).not.toContain('after we need');
    expect(card.textContent).not.toContain('Blocked by');
    const issue = screen.getByRole('link', { name: 'GitHub issue #41 · open' });
    expect(issue.getAttribute('href')).toBe('https://github.com/acme/orders/issues/41');
    expect(screen.queryByRole('button', { name: 'Record update' })).toBeNull();
  });

  it('says when nothing is promised, recorded or heard, and when no issue is filed', () => {
    render(
      <WorkCard
        card={{
          ...OURS,
          issue: null,
          commitment: null,
          progress: null,
          lastHeard: null,
          milestone: null,
          dates: { neededBy: null, promisedFor: null, gapDays: null, gapText: null },
        }}
        workspace="acme"
      />,
    );
    const card = screen.getByRole('article', { name: 'Track revisions' });
    expect(card.textContent).toContain('nothing promised yet');
    expect(card.textContent).toContain('nothing recorded');
    expect(card.textContent).toContain('nothing heard yet');
    expect(card.textContent).toContain('No GitHub issue yet');
    expect(card.textContent).not.toContain('Needed by');
  });

  it('opens the inspector from its title when asked, and links to the page otherwise', () => {
    const { unmount } = render(<WorkCard card={OURS} inspect workspace="acme" />);
    expect(document.querySelector('[data-inspect="wi:revise"]')).not.toBeNull();
    unmount();
    render(<WorkCard card={OURS} workspace="acme" />);
    expect(screen.getByRole('link', { name: 'Track revisions' }).getAttribute('href')).toMatch(
      /things\/?\?id=wi-quote$/u,
    );
  });
});

const change = (name: string, value: string) => {
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
};

describe('Record update', () => {
  it('drafts the event and gives the exact command and an agent prompt, writing nothing', () => {
    render(<WorkCard card={PARTNER} workspace="volvo-cars" />);
    fireEvent.click(screen.getByRole('button', { name: 'Record update' }));
    const form = screen.getByRole('form', { name: 'Record update' });
    expect(screen.getByLabelText<HTMLSelectElement>('Subject').value).toBe('wi:quote');
    change('State', 'accepted');
    change('Promised for', '2027-03-01');
    change('Confidence', 'medium');
    change('Said by', 'Louise A. Zieme');
    change('Source', 'meeting');
    change('Evidence link', 'https://notion.so/quote');
    change('When', '2026-11-04');
    change('Note', 'Agreed in the call');
    const blocks = within(form).getAllByRole('figure');
    expect(blocks.map((b) => b.querySelector('figcaption')?.textContent)).toEqual([
      'The event',
      'CommandCopy command',
      'Agent promptCopy prompt',
    ]);
    expect(blocks[1]?.querySelector('pre')?.textContent).toBe(
      "npm run progress -- add volvo-cars order-change --subject wi:quote --kind commitment --state accepted --promised-for 2027-03-01 --confidence medium --said-by 'Louise A. Zieme' --source-kind meeting --url https://notion.so/quote --note 'Agreed in the call' --at 2026-11-04",
    );
    expect(blocks[0]?.querySelector('pre')?.textContent).toContain('  said_by: Louise A. Zieme');
    expect(blocks[2]?.querySelector('pre')?.textContent).toContain(
      'Append this event to plans/order-change/progress.yaml in workspace volvo-cars using npm run progress',
    );
  });

  it('switches the states with the kind, offers the milestone as a subject, and closes again', () => {
    render(<WorkCard card={PARTNER} workspace="acme" />);
    const toggle = screen.getByRole('button', { name: 'Record update' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    change('Kind', 'work');
    expect(screen.queryByLabelText('Promised for')).toBeNull();
    expect(screen.getByLabelText<HTMLSelectElement>('State').value).toBe('not_started');
    change('Subject', 'ms:m3');
    change('Kind', 'note');
    expect(screen.queryByLabelText('State')).toBeNull();
    const command = screen.getAllByRole('figure')[1]?.querySelector('pre')?.textContent ?? '';
    expect(command).toMatch(
      /^npm run progress -- add acme order-change --subject ms:m3 --kind note/u,
    );
    fireEvent.click(toggle);
    expect(screen.queryByRole('form', { name: 'Record update' })).toBeNull();
  });
});
