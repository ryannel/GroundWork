// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { queryModel } from '@/../test/fixtures/model-queries';
import { indexOf } from '@/application/model-index';
import { NO_BASE } from '@/application/plan/plan-base';

import { ModelPlanBasisNotice } from './model-plan-basis';

afterEach(cleanup);
const index = indexOf(queryModel());
it('keeps the previous-format check date visible without claiming its drift hashes describe the native model', () => {
  render(
    <ModelPlanBasisNotice
      index={index}
      basis={{
        base: { ...NO_BASE, mode: 'live', previousCheckedOn: '2026-10-16' },
        readsAfter: [
          {
            id: 'plan:upstream',
            title: 'An actual upstream plan',
            href: '/queries/plans/actual-folder/',
            stage: 'Review',
          },
        ],
      }}
    />,
  );
  expect(screen.getByText(/Previously checked on 2026-10-16/u)).toBeTruthy();
  expect(screen.getByText(/Recheck this plan/u).textContent).toContain(
    'earlier hashes do not establish current drift',
  );
  expect(screen.getByText(/Their effects remain unverified/u)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'An actual upstream plan' }).getAttribute('href')).toBe(
    '/queries/plans/actual-folder',
  );
  expect(screen.queryByText(/never been checked/u)).toBeNull();
});
it('shows an actual native check and its changed facts', () => {
  const base = { ...NO_BASE, mode: 'live' as const, checkedOn: '2026-11-07' };
  const { rerender } = render(
    <ModelPlanBasisNotice index={index} basis={{ base, readsAfter: [] }} />,
  );
  expect(screen.getByText(/it last fitted/u)).toBeTruthy();
  rerender(
    <ModelPlanBasisNotice
      index={index}
      basis={{ base: { ...base, edited: true, drift: ['api:a'] }, readsAfter: [] }}
    />,
  );
  expect(screen.getByText(/plan has been edited/u).textContent).toContain(
    'Today has changed one thing',
  );
});
it('names the retained landed basis without treating it as live current facts', () => {
  render(
    <ModelPlanBasisNotice
      index={index}
      basis={{ base: { ...NO_BASE, mode: 'landed', landedOn: '2026-11-07' }, readsAfter: [] }}
    />,
  );
  expect(screen.getByText(/kept with the plan/u)).toBeTruthy();
  expect(screen.queryByText(/Reads today live/u)).toBeNull();
});
