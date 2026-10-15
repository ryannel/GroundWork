// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { derive } from '@/application/plan/derive';
import { ApiGroups } from '@/features/plan/viz/endpoint/api-groups';
import { CopyPath } from '@/features/plan/viz/endpoint/copy-path.client';
import { InterfaceGroup } from '@/features/plan/viz/endpoint/interface-group';

vi.mock('server-only', () => ({}));

afterEach(cleanup);

async function load() {
  const { readPlan } = await import('@/infrastructure/plan-store');
  const loaded = await readPlan('alder-finch', 'delivery-promise');
  return derive(loaded.plan!);
}

describe('endpoint', () => {
  it('draws an interface with its head and one row per endpoint', async () => {
    const model = await load();
    const ifc = model.toBe.interfaces.find((i) => i.id === 'if:pim-rest')!;
    const { container } = render(<InterfaceGroup ifc={ifc} mode="diff" model={model} />);
    expect(container.querySelectorAll('details')).toHaveLength(2);
    expect(container.textContent).toContain('products');
    expect(container.textContent).toContain('2 endpoints');
    expect(container.textContent).toContain('staff SSO');
  });

  it('opens every row when asked, and says what it shows in the open row', async () => {
    const model = await load();
    const ifc = model.toBe.interfaces.find((i) => i.id === 'if:pim-rest')!;
    const { container } = render(<InterfaceGroup head={false} ifc={ifc} model={model} open />);
    expect(container.querySelector('details[open]')).not.toBeNull();
    expect(container.textContent).toContain('Path');
    expect(container.textContent).toContain('Open endpoint');
  });

  it('filters endpoints by the words typed once there are many', async () => {
    const model = await load();
    render(<ApiGroups ifcs={model.toBe.interfaces} model={model} />);
    const box = screen.getByRole('searchbox', { name: 'Filter endpoints' });
    const before = document.querySelectorAll('details').length;
    fireEvent.change(box, { target: { value: 'checkoutStep' } });
    expect(document.querySelectorAll('details').length).toBeLessThan(before);
    expect(document.querySelectorAll('details')).toHaveLength(1);
    fireEvent.change(box, { target: { value: 'zzzz' } });
    expect(screen.getByText('No endpoint matches.')).toBeDefined();
  });

  it('copies a path', () => {
    const writeText = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CopyPath text="/a/{id}" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy path' }));
    expect(writeText).toHaveBeenCalledWith('/a/{id}');
  });
});
