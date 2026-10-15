// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { CompatBadge, CompatLines } from './compat';

vi.mock('server-only', () => ({}));

const { readPlan } = await import('@/infrastructure/plan-store');

const loaded = await readPlan('alder-finch', 'delivery-promise');
const model = derive(loaded.plan!);

afterEach(cleanup);

describe('CompatBadge', () => {
  it('says breaking, with the service this plan leaves alone', () => {
    const { container } = render(<CompatBadge id="sch:product#lead_time_text" model={model} />);
    const badge = container.querySelector('[data-compat]');
    expect(badge instanceof HTMLElement && badge.dataset.compat).toBe('breaking');
    expect(badge?.textContent).toContain('breaking');
    expect(badge?.getAttribute('title')).not.toBeNull();
  });

  it('says needs migration when the plan moves every reader', () => {
    const { container } = render(<CompatBadge id="sch:product#weight_g" model={model} />);
    expect(container.querySelector('[data-compat]')?.textContent).toContain('needs migration');
  });

  it('draws nothing for what the plan does not touch, or for a safe verdict when quiet', () => {
    const { container } = render(<CompatBadge id="sch:shipment" model={model} />);
    expect(container.innerHTML).toBe('');
    const safe = model.toBe.schemas
      .map((s) => s.id)
      .find((id) => model.compat(id)?.verdict === 'safe');
    if (safe !== undefined) {
      cleanup();
      const quiet = render(<CompatBadge id={safe} model={model} quiet />);
      expect(quiet.container.innerHTML).toBe('');
    }
  });
});

describe('CompatLines', () => {
  it('names who breaks and who moves, as chips', () => {
    render(<CompatLines id="sch:product#lead_time_text" model={model} />);
    expect(screen.getByText('Breaks')).toBeTruthy();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('names only the services in its brief form', () => {
    render(<CompatLines brief id="sch:product#weight_g" model={model} />);
    expect(screen.getByText('Moves')).toBeTruthy();
    expect(screen.queryByText('through')).toBeNull();
  });

  it('draws nothing when the plan does not touch it', () => {
    const { container } = render(<CompatLines id="sch:shipment" model={model} />);
    expect(container.innerHTML).toBe('');
  });
});
