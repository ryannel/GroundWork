// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Neighbours } from '@/application/plan-pages';

import { ThingPage } from './thing-page';

vi.mock('server-only', () => ({}));

const shell = vi.hoisted(() => {
  const seen: { neighbours: Neighbours | undefined } = { neighbours: undefined };
  return seen;
});
vi.mock('@/features/plan/plan-shell', () => ({
  PlanShell: ({ children, neighbours }: { children: ReactNode; neighbours?: Neighbours }) => {
    shell.neighbours = neighbours;
    return <main>{children}</main>;
  },
}));

const { derive } = await import('@/application/plan/derive');
const { outlineOf } = await import('@/application/plan-pages');
const { loadFixture } = await import('@/infrastructure/plan-fixture');
const plan = await loadFixture('mini.yaml');
const model = derive(plan, { status: {} });
const outline = outlineOf(model, { workspace: 'shop', slug: 'mini' });

afterEach(cleanup);

const open = (id: string) =>
  render(<ThingPage id={id} model={model} outline={outline} workspaceName="Shop" />);

describe('ThingPage', () => {
  it('shows the thing under its name, among the others of its kind', () => {
    open('svc:subs');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Subscriptions');
    const register = screen.getByRole('navigation', { name: 'Components' });
    const current = register.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe('Subscriptions');
    expect(register.querySelectorAll('a')).toHaveLength(4);
    expect(screen.getByText(/2 of 4$/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Back to Components' }).getAttribute('href')).toBe(
      '/shop/plans/mini/ref/services',
    );
    expect(screen.getByRole('button', { name: 'Copy a link to this page' })).toBeTruthy();
  });

  it('steps to its siblings with the pager and the keys', () => {
    open('svc:subs');
    const near = shell.neighbours;
    expect(near?.previous?.href).toBe('/shop/plans/mini/things/svc-web/');
    expect(near?.next?.href).toBe('/shop/plans/mini/things/svc-billing/');
  });

  it('switches between today and with the plan', () => {
    open('flow:cancel');
    expect(screen.getByText('The flow with this plan')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'today' }));
    expect(screen.getByText('The flow as it runs today')).toBeTruthy();
  });

  it('has no switch for a thing only the plan has, and nothing for an unknown id', () => {
    open('chg:pause-api');
    expect(screen.queryByRole('radio')).toBeNull();
    cleanup();
    const { container } = open('svc:nope');
    expect(container.textContent).toBe('');
  });
});
