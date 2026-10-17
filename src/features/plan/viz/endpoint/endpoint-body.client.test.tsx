// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { deliveryTime } from '@/../test/fixtures/acme/plans/contracts-delivery-time';
import { derive } from '@/application/plan/derive';
import { InterfaceGroup } from '@/features/plan/viz/endpoint/interface-group';

const plan = deliveryTime();
const model = derive(plan);
const ifc = model.toBe.interfaces.find((i) => i.id === 'if:products-rest')!;
const fetched = vi.fn<() => Promise<Response>>(async () => {
  await Promise.resolve();
  return Response.json({ plan });
});

beforeAll(() => {
  vi.stubGlobal('fetch', fetched);
});

afterEach(cleanup);

async function settle() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

describe('an endpoint drawn when opened', () => {
  it('leaves a closed row’s body out of the page and draws it from the model when the row opens', async () => {
    const { container } = render(<InterfaceGroup ifc={ifc} model={model} src="plan.json" />);
    const row = container.querySelector('details')!;
    expect(row.textContent).not.toContain('Path');
    expect(row.textContent).toContain('Open endpoint');
    row.dispatchEvent(new Event('pointerenter'));
    expect(fetched).toHaveBeenCalledOnce();
    await act(async () => {
      row.open = true;
      row.dispatchEvent(new Event('toggle'));
      await Promise.resolve();
    });
    await settle();
    expect(row.textContent).toContain('Path');
    expect(fetched).toHaveBeenCalledOnce();
  });

  it('draws an open row in the page, as it is seen at once', () => {
    const { container } = render(<InterfaceGroup ifc={ifc} model={model} open src="plan.json" />);
    expect(container.querySelector('details')!.textContent).toContain('Path');
  });
});
