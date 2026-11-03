// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';

import { ConnectedCanvas } from './connected-canvas.client';

afterEach(cleanup);

it('keeps camera controls before the same focused flow selector when its explanation appears or disappears', () => {
  const chart = (selected: boolean) => (
    <ConnectedCanvas
      width={1000}
      height={600}
      label="Work"
      edges={[]}
      controls={
        <select aria-label="Follow a value flow" defaultValue="all">
          <option value="all">All value flows</option>
          <option value="prepare">Prepare products</option>
        </select>
      }
      context={selected ? <p>Prepare products for later readers.</p> : undefined}
    >
      {null}
    </ConnectedCanvas>
  );
  const { rerender } = render(chart(false));
  const selector = screen.getByRole('combobox', { name: 'Follow a value flow' });
  const zoom = screen.getByRole('button', { name: 'Zoom out' });
  selector.focus();
  for (const selected of [true, false, true]) {
    rerender(chart(selected));
    expect(screen.getByRole('combobox', { name: 'Follow a value flow' })).toBe(selector);
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBe(zoom);
    expect(document.activeElement).toBe(selector);
    expect(zoom.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  }
});
