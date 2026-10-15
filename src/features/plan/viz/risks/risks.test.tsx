// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import {
  bySeverity,
  handlingOf,
  levelsText,
  riskFacts,
  riskGrid,
  risksOf,
  sev,
  shade,
} from '@/application/plan-viz-risks';
import { RiskMatrix } from '@/features/plan/viz/risks/risk-matrix';
import { RiskRegister } from '@/features/plan/viz/risks/risk-register';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function withRisks() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  const plan = loaded.plan!;
  const team = plan.work_items![0]!.team;
  const model = derive({
    ...plan,
    decisions: [{ id: 'dec:open', title: 'Open one', status: 'proposed' }],
    risks: [
      { id: 'risk:small', statement: 'A small worry.', likelihood: 'low', impact: 'low' },
      {
        id: 'risk:big',
        statement: 'A **big** one.',
        likelihood: 'high',
        impact: 'high',
        owner: team,
        roam: 'accepted',
        accepted_by: 'dec:open',
      },
      {
        id: 'risk:gone',
        statement: 'Gone now.',
        likelihood: 'med',
        impact: 'high',
        roam: 'resolved',
      },
    ],
  });
  return { model, team };
}

describe('risk reading', () => {
  it('scores, shades and words a risk', async () => {
    const { model } = await withRisks();
    const [small, big, gone] = model.plan.risks!;
    expect([sev(small!), sev(big!), sev(gone!)]).toEqual([1, 9, 6]);
    expect([1, 3, 6, 9].map(shade)).toEqual([1, 2, 3, 4]);
    expect(levelsText(gone!)).toBe('medium × high');
    expect(bySeverity([small!, gone!, big!]).map((r) => r.id)).toEqual([
      'risk:big',
      'risk:gone',
      'risk:small',
    ]);
    expect(risksOf(model, ['risk:gone', 'dec:open', 'nope']).map((r) => r.id)).toEqual([
      'risk:gone',
    ]);
  });

  it('holds acceptance until its decision is approved', async () => {
    const { model, team } = await withRisks();
    const [small, big] = model.plan.risks!;
    expect(handlingOf(model, small!)).toBe('owned');
    expect(handlingOf(model, big!)).toBe('accepted if D1 is approved');
    expect(riskFacts(model, big!)).toBe(
      `R2|high x high|accepted if D1 is approved|${model.label(team)}`,
    );
  });

  it('puts each risk in its cell, likeliest at the top', async () => {
    const { model } = await withRisks();
    const grid = riskGrid(model.plan.risks!);
    expect(grid).toHaveLength(3);
    expect(grid[0]![2]!.risks.map((r) => r.id)).toEqual(['risk:big']);
    expect(grid[1]![2]!.risks.map((r) => r.id)).toEqual(['risk:gone']);
    expect(grid[2]![0]!.risks.map((r) => r.id)).toEqual(['risk:small']);
  });
});

describe('RiskMatrix', () => {
  it('draws a numbered dot per risk and says what a hollow one is', async () => {
    const { model } = await withRisks();
    const ids = model.plan.risks!.map((r) => r.id);
    const { container } = render(<RiskMatrix ids={ids} model={model} />);
    const dots = [...container.querySelectorAll<HTMLElement>('button[data-inspect]')];
    expect(dots.map((d) => d.textContent)).toEqual(['R2', 'R3', 'R1']);
    expect(dots.find((d) => d.dataset.inspect === 'risk:gone')?.hasAttribute('data-resolved')).toBe(
      true,
    );
    expect(container.textContent).toContain('A hollow dot is a resolved risk.');
  });

  it('fills the focus dot, fades the rest and drops the note when small', async () => {
    const { model } = await withRisks();
    const ids = model.plan.risks!.map((r) => r.id);
    const { container } = render(<RiskMatrix focus="risk:big" ids={ids} model={model} size="sm" />);
    expect(container.querySelectorAll('[data-focus="self"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-focus="faint"]')).toHaveLength(2);
    expect(container.textContent).not.toContain('hollow');
  });

  it('draws nothing for a single risk', async () => {
    const { model } = await withRisks();
    const { container } = render(<RiskMatrix ids={['risk:big']} model={model} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('RiskRegister', () => {
  it('lists open risks biggest first and folds the resolved ones', async () => {
    const { model } = await withRisks();
    const ids = model.plan.risks!.map((r) => r.id);
    const { container } = render(<RiskRegister ids={ids} model={model} />);
    const tables = container.querySelectorAll('table');
    expect(tables).toHaveLength(2);
    const open = [...tables[0]!.querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect(open).toHaveLength(2);
    expect(open[0]).toContain('A big one.');
    expect(open[0]).toContain('accepted if D1 is approved');
    expect(container.querySelector('details')?.textContent).toContain('Gone now.');
  });

  it('shows no folds when nothing is resolved', async () => {
    const { model } = await withRisks();
    const { container } = render(<RiskRegister ids={['risk:big']} model={model} />);
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelectorAll('table')).toHaveLength(1);
  });
});
