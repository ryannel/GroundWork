// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConnectedCanvasEdge } from '@/ui/connected-canvas-types';
import { ConnectedCanvas } from '@/ui/connected-canvas.client';

import { CanvasEdge, RaisedEdge } from './canvas-edge';

afterEach(cleanup);

describe('canvas arrow semantics', () => {
  it('highlights a chosen flow without needing hover and yields to component focus', () => {
    const edge: ConnectedCanvasEdge = {
      id: 'flow',
      from: 'a',
      to: 'b',
      kind: 'api',
      label: 'Read model details',
      detail: 'The product page requests model information.',
      path: 'M 10,10 L 200,10',
      x: 100,
      y: 10,
      highlighted: true,
    };
    const chart = (selected?: string) => (
      <ConnectedCanvas width={500} height={400} label="Models" edges={[edge]} selected={selected}>
        {null}
      </ConnectedCanvas>
    );
    const { container, rerender } = render(chart());
    expect(container.querySelector('[data-edge][data-flow][data-lit]')).not.toBeNull();
    expect(container.querySelector('[data-edge-label][data-flow][data-lit]')).not.toBeNull();
    expect(container.querySelector('[data-edge] path')?.getAttribute('marker-end')).toContain(
      '-lit',
    );
    rerender(chart('other'));
    expect(container.querySelector('[data-edge][data-lit]')).toBeNull();
    expect(container.querySelector('[data-edge][data-muted]')).not.toBeNull();
  });
  it('paints all labels after crossing base routes while retaining focus and visibility states', () => {
    const edges: ConnectedCanvasEdge[] = [
      {
        id: 'first',
        from: 'a',
        to: 'b',
        kind: 'api',
        label: 'Read retailer details',
        detail: 'First request',
        path: 'M 10,50 L 300,50',
        x: 150,
        y: 40,
        quiet: true,
        context: true,
        supporting: true,
      },
      {
        id: 'crossing',
        from: 'c',
        to: 'd',
        kind: 'api',
        label: 'Read delivery destinations',
        detail: 'Second request',
        path: 'M 150,10 L 150,100',
        x: 160,
        y: 60,
      },
    ];
    const { container } = render(
      <ConnectedCanvas width={500} height={400} label="Requests" edges={edges} selected="a">
        {null}
      </ConnectedCanvas>,
    );
    const routes = [...container.querySelectorAll<SVGGElement>('[data-edge]')];
    const labels = [...container.querySelectorAll<SVGGElement>('[data-edge-label]')];
    expect(routes).toHaveLength(2);
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      for (const route of routes) {
        expect(route.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
        expect(route.querySelector('text')).toBeNull();
      }
      const route = routes.find((item) => item.dataset.edge === label.dataset.edgeLabel)!;
      for (const attribute of [
        'data-lit',
        'data-muted',
        'data-quiet',
        'data-context',
        'data-supporting',
      ]) {
        expect(label.getAttribute(attribute)).toBe(route.getAttribute(attribute));
      }
      expect(label.getAttribute('aria-hidden')).toBe('true');
      expect(label.getAttribute('tabindex')).toBeNull();
    }
    expect(labels[0]?.hasAttribute('data-lit')).toBe(true);
    expect(labels[1]?.hasAttribute('data-muted')).toBe(true);
    expect(screen.getAllByRole('img')).toHaveLength(2);
    fireEvent.focus(routes[0]!);
    expect(container.querySelector('[role="tooltip"]')?.textContent).toBe('First request');
  });

  it('exposes a descriptive edge to keyboard focus, shows its caveat and dismisses it with Escape or blur', () => {
    const edge: ConnectedCanvasEdge = {
      id: 'member',
      from: 'a',
      to: 'b',
      kind: 'membership',
      directed: false,
      label: 'Recorded membership',
      detail: 'Not live composition. Disabled locally.',
      path: 'M 10,10 L 200,200',
      x: 100,
      y: 100,
    };
    const { container } = render(
      <ConnectedCanvas width={500} height={400} label="Graph" edges={[edge]}>
        {null}
      </ConnectedCanvas>,
    );
    const connection = screen.getByRole('img', { name: edge.detail });
    expect(connection.getAttribute('tabindex')).toBe('0');
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    fireEvent.focus(connection);
    expect(container.querySelector('[role="tooltip"]')?.textContent).toBe(edge.detail);
    expect(container.querySelector('path[marker-end]')).toBeNull();
    fireEvent.keyDown(connection, { key: 'Escape' });
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    fireEvent.blur(connection);
    fireEvent.focus(connection);
    expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
    fireEvent.blur(connection);
    expect(container.querySelector('[role="tooltip"]')).toBeNull();
  });
  it.each(['api', 'message', 'data', 'membership'] as const)(
    'retains %s semantics when raised',
    (kind) => {
      const edge: ConnectedCanvasEdge = {
        id: kind,
        from: 'a',
        to: 'b',
        kind,
        label: kind,
        detail: kind,
        path: 'M 0,0 L 10,10',
        x: 5,
        y: 5,
        ...(kind === 'membership' ? { directed: false, supporting: true } : {}),
      };
      const { container } = render(
        <svg>
          <CanvasEdge
            edge={edge}
            marker="arrow"
            lit={false}
            muted={false}
            onEnter={vi.fn<() => void>()}
            onLeave={vi.fn<() => void>()}
            onSelect={undefined}
          />
          <RaisedEdge edge={edge} marker="arrow" />
        </svg>,
      );
      const arrows = container.querySelectorAll('path[marker-end]');
      expect(arrows).toHaveLength(kind === 'membership' ? 0 : 2);
    },
  );
});
