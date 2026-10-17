// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { dispatchDate } from '@/../test/fixtures/acme/plans/work-dispatch';
import { modelOf } from '@/../test/plan-kit';

import { CompatBadge, CompatLines } from './compat';

const model = modelOf(dispatchDate());

afterEach(cleanup);

describe('CompatBadge', () => {
  it('says breaking, with the service this plan leaves alone', () => {
    const { container } = render(<CompatBadge id="sch:search-doc#words" model={model} />);
    const badge = container.querySelector('[data-compat]');
    expect(badge instanceof HTMLElement && badge.dataset.compat).toBe('breaking');
    expect(badge?.textContent).toContain('breaking');
    expect(badge?.getAttribute('title')).toContain('svc:search-api');
  });

  it('says needs migration when the plan moves every reader', () => {
    const { container } = render(<CompatBadge id="sch:product#price_cents" model={model} />);
    expect(container.querySelector('[data-compat]')?.textContent).toContain('needs migration');
  });

  it('draws nothing for what the plan does not touch, or for a safe verdict when quiet', () => {
    const { container } = render(<CompatBadge id="sch:order-placed-v1" model={model} />);
    expect(container.innerHTML).toBe('');
    expect(model.compat('sch:product-changed-v2')?.verdict).toBe('safe');
    cleanup();
    const loud = render(<CompatBadge id="sch:product-changed-v2" model={model} />);
    expect(loud.container.querySelector<HTMLElement>('[data-compat]')?.dataset.compat).toBe('safe');
    cleanup();
    const quiet = render(<CompatBadge id="sch:product-changed-v2" model={model} quiet />);
    expect(quiet.container.innerHTML).toBe('');
  });
});

describe('CompatLines', () => {
  it('names who breaks and who moves, as chips', () => {
    render(<CompatLines id="sch:search-doc#words" model={model} />);
    expect(screen.getByText('Breaks')).toBeTruthy();
    expect(screen.getAllByRole('button').map((b) => b.dataset.inspect)).toContain('svc:search-api');
  });

  it('names only the services in its brief form', () => {
    render(<CompatLines brief id="sch:product#price_cents" model={model} />);
    expect(screen.getByText('Moves')).toBeTruthy();
    expect(screen.queryByText('through')).toBeNull();
  });

  it('draws nothing when the plan does not touch it', () => {
    const { container } = render(<CompatLines id="sch:order-placed-v1" model={model} />);
    expect(container.innerHTML).toBe('');
  });
});
