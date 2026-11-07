// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { modelOp } from '@/../test/fixtures/model-op';
import { queryModel } from '@/../test/fixtures/model-queries';
import { modelContextOf, selectedPlanPayload } from '@/application/model-reader';
import { selectedPlanProjection } from '@/application/plans-index';
import type { ModelPlan } from '@/domain/workspace-model';

import { ChangesAhead } from './changes-ahead.client';
import { addPins, clearPins, pinsOf, setTrayOpen } from './tray-store';

const overlay: ModelPlan = {
  meta: { id: 'plan:actual-id', title: 'Qualify the request' },
  problem: { summary: 'Show the real change.' },
  changes: [
    {
      id: 'chg:approval',
      title: 'Require approval',
      ops: [modelOp({ modify: 'h:a#call', set: { when: 'Approved' } })],
    },
  ],
};
const native = modelContextOf(
  selectedPlanPayload(selectedPlanProjection(overlay, [overlay], queryModel())),
);
const readyNative = Object.assign(Promise.resolve(native), { status: 'fulfilled', value: native });
vi.mock(import('@/features/plan/plan-model'), () => ({
  pendingNativeModel: () => ({ model: readyNative }),
}));
const plan = { workspace: 'queries', slug: 'actual-folder' };
afterEach(() => {
  cleanup();
  setTrayOpen(false);
  clearPins('queries/actual-folder');
});

it('links native pins to the actual change screen and marks only that screen seen', async () => {
  addPins('queries/actual-folder', ['h:a#call'], '/queries/plans/actual-folder/story/');
  const view = render(<ChangesAhead plan={plan} here="/other/" src="plan.json" />);
  fireEvent.click(screen.getByRole('button', { name: '◇ 1 change ahead' }));
  await act(async () => {
    await readyNative;
  });
  const link = screen.getByRole('link', { name: /Require approval/u });
  expect(link.getAttribute('href')).toBe('/queries/plans/actual-folder/changes/chg-approval');
  expect(pinsOf('queries/actual-folder')[0]?.seen).toBe(false);
  view.rerender(
    <ChangesAhead
      plan={plan}
      here="/queries/plans/actual-folder/changes/chg-approval/"
      src="plan.json"
    />,
  );
  await act(async () => {
    await readyNative;
  });
  await waitFor(() => {
    expect(pinsOf('queries/actual-folder')[0]?.seen).toBe(true);
  });
});
