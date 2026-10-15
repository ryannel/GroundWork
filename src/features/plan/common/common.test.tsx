// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';

import { EntityChip, EntityChips } from './entity-chip';
import { ModelInline, ModelText } from './model-text';

vi.mock('server-only', () => ({}));

const { loadFixture } = await import('@/infrastructure/plan-fixture');

const model = derive(await loadFixture('mini.yaml'));

afterEach(cleanup);

describe('EntityChip', () => {
  it('is a chip the inspector opens, with the plan label and status', () => {
    render(<EntityChip id="sch:pause-request" model={model} />);
    const chip = screen.getByRole('button');
    expect(chip.dataset.inspect).toBe('sch:pause-request');
    expect(chip.dataset.status).toBe('added');
  });

  it('numbers a risk and takes a label and status when given', () => {
    render(<EntityChip id="risk:v1-consumer" model={model} />);
    expect(screen.getByRole('button').textContent).toContain('R1 A v1 consumer');
    cleanup();
    render(<EntityChip id="svc:subs" label="Subs" model={model} status="removed" />);
    expect(screen.getByRole('button').dataset.status).toBe('removed');
    expect(screen.getByRole('button').textContent).toContain('Subs');
  });
});

describe('EntityChips', () => {
  it('draws each id once and nothing for none', () => {
    render(<EntityChips ids={['svc:subs', { id: 'svc:web' }, 'svc:subs', '']} model={model} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    const { container } = render(<EntityChips ids={[]} model={model} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('ModelText', () => {
  it('draws citations as chips', () => {
    render(<ModelText model={model} text={'Moves [[svc:subs]].\n\n- and [[svc:web]]'} />);
    expect(screen.getAllByRole('button').map((b) => b.dataset.inspect)).toEqual([
      'svc:subs',
      'svc:web',
    ]);
    cleanup();
    render(<ModelInline model={model} text="Only [[svc:web]]" />);
    expect(screen.getByRole('button').dataset.inspect).toBe('svc:web');
  });
});
