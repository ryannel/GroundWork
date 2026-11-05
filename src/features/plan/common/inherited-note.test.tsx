// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LISTING } from '@/../test/fixtures/plan-index';
import { derive } from '@/application/plan/derive';

import { InheritedNote } from './inherited-note';

afterEach(cleanup);

const TODAY = new Date('2026-11-04');

describe('InheritedNote', () => {
  it('labels what a plan below added or changed once per group, readable and with what it covers', () => {
    const model = derive(LISTING, {
      status: {},
      today: TODAY,
      inherited: {
        'svc:status': { plan: 'financing', title: 'Financing status', kind: 'added' },
        'svc:events': { plan: 'financing', title: 'Financing status', kind: 'added' },
        'svc:tool': { plan: 'sales-tool', title: 'Sales tool', kind: 'modified' },
      },
    });
    render(
      <InheritedNote ids={['svc:status', 'svc:events', 'svc:tool', 'svc:own']} model={model} />,
    );
    const note = screen.getByLabelText('Not live yet');
    expect(note.textContent).toContain('Added by Financing status · not live yet');
    expect(note.textContent).toContain('Changed by Sales tool · not live yet');
    expect(screen.getAllByText(/not live yet/u)).toHaveLength(2);
    expect(note.textContent).toContain('svc:status, svc:events');
  });

  it('says nothing when the plan inherits none of it, as when its base has landed', () => {
    const model = derive(LISTING, { status: {}, today: TODAY });
    const { container } = render(<InheritedNote ids={['svc:status']} model={model} />);
    expect(container.textContent).toBe('');
  });
});
