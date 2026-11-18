'use client';

import { type ReactNode, useId } from 'react';

import { CanvasCaption } from './canvas/canvas-edge';
import { useSteadyHover } from './canvas/use-steady-hover';
import { CanvasSystemScope } from './connected-canvas-parts';
import { CanvasNavigation } from './connected-canvas-toolbar';
import type { ConnectedCanvasFocus } from './connected-canvas-types';
import { Legend } from './legend';
import styles from './network-map.module.css';
import { useCanvasFocus } from './use-canvas-focus';
import { useCanvasFullscreen } from './use-canvas-fullscreen';
import { useExplorerViewport } from './use-explorer-viewport';

interface NetworkNode {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly colour: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
interface NetworkEdge {
  readonly caption?: string;
  readonly labelHidden?: boolean;
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly path: string;
  readonly label: string;
  readonly kind: 'exchange' | 'transition' | 'support';
  readonly x: number;
  readonly y: number;
}
interface NetworkView<Node extends NetworkNode> {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly Node[];
  readonly edges: readonly NetworkEdge[];
}

const LEGEND = [
  { label: 'Information exchange', line: 'solid' },
  { label: 'Activity continues', line: 'dashed' },
  { label: 'Shared support', line: 'dotted' },
] as const;

function connected(
  view: Pick<NetworkView<NetworkNode>, 'edges'>,
  focused: string | null,
): ReadonlySet<string> {
  if (focused === null) return new Set();
  return new Set([
    focused,
    ...view.edges.flatMap((edge) =>
      edge.from === focused || edge.to === focused ? [edge.from, edge.to] : [],
    ),
  ]);
}

function AuthoredEdge({
  edge,
  marker,
  bidirectional,
  lit,
  muted,
  interactive,
  labelHidden,
  hidden,
  onEdge,
}: {
  readonly edge: NetworkEdge;
  readonly marker: string;
  readonly bidirectional: boolean;
  readonly lit: boolean;
  readonly muted: boolean;
  readonly interactive: boolean;
  /** Left off a crowded map: the caption shows while the line is lit, pointed at or focused. */
  readonly labelHidden: boolean;
  /** No caption at all, as when every line is muted. */
  readonly hidden: boolean;
  readonly onEdge: (id: string) => void;
}) {
  const select = (): void => {
    onEdge(edge.id);
  };
  return (
    <g
      className={styles.edge}
      data-edge={edge.id}
      data-kind={edge.kind}
      data-lit={lit ? '' : undefined}
      data-muted={muted ? '' : undefined}
      data-label-hidden={labelHidden ? '' : undefined}
      key={edge.id}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Explore ${edge.label}` : undefined}
      aria-description={edge.caption}
      onClick={interactive ? select : undefined}
      onKeyDown={(event) => {
        if (interactive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          select();
        }
      }}
    >
      {interactive ? <path className={styles.hit} d={edge.path} /> : null}
      <path
        d={edge.path}
        markerStart={bidirectional ? `url(#${marker})` : undefined}
        markerEnd={`url(#${marker})`}
      />
      {hidden ? null : (
        <CanvasCaption edge={{ x: edge.x, y: edge.y, label: edge.caption ?? edge.label }} />
      )}
    </g>
  );
}

/** A linked network that reads whole before any node is opened. */
export function NetworkMap<Node extends NetworkNode>({
  view,
  label,
  renderNode,
  renderExpanded,
  interactiveEdges,
  bidirectionalEdges,
  muteEdges,
  filtering,
  onEdge,
  renderOverlay,
  hoverEdges,
  focus,
}: {
  readonly view: NetworkView<Node>;
  readonly renderExpanded: (node: Node) => ReactNode;
  readonly renderNode: (node: Node, muted: boolean) => ReactNode;
  readonly label: string;
  readonly interactiveEdges: ReadonlySet<string>;
  readonly bidirectionalEdges: ReadonlySet<string>;
  readonly muteEdges: boolean;
  readonly filtering: boolean;
  readonly onEdge: (id: string) => void;
  readonly renderOverlay: (lit: ReadonlySet<string> | null) => ReactNode;
  readonly hoverEdges: (id: string) => ReadonlySet<string>;
  readonly focus: ConnectedCanvasFocus | null;
}) {
  const marker = useId().replaceAll(':', '');
  const { component: focused, settle, clear } = useSteadyHover();
  const { fullscreen, toggle } = useCanvasFullscreen();
  const {
    viewportRef,
    zoom,
    changeZoom,
    handleFit,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useExplorerViewport(view.width, view.height, { fit: true, minimumFit: 0.65 });
  useCanvasFocus(focus, viewportRef, { zoom, changeZoom });
  const lit = connected(view, focused);
  const highlighted = focused === null ? null : hoverEdges(focused);
  return (
    <figure className={styles.figure} data-fullscreen={fullscreen ? '' : undefined}>
      <CanvasNavigation
        zoom={zoom}
        fullscreen={fullscreen}
        handleZoom={changeZoom}
        handleFit={handleFit}
        handleFullscreen={toggle}
      />
      <div
        aria-label={label}
        className={styles.scroll}
        role="region"
        ref={viewportRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
      >
        <svg
          aria-label={label}
          className={styles.canvas}
          onPointerOver={(event) => {
            settle(event.target);
          }}
          onPointerLeave={clear}
          onFocusCapture={(event) => {
            settle(event.target);
          }}
          onBlurCapture={(event) => {
            settle(event.relatedTarget);
          }}
          role="group"
          width={view.width * zoom}
          height={view.height * zoom}
          viewBox={`0 0 ${String(view.width)} ${String(view.height)}`}
        >
          <defs>
            <marker
              id={marker}
              markerHeight="8"
              markerWidth="8"
              orient="auto-start-reverse"
              refX="7"
              refY="4"
            >
              <path className={styles.arrow} d="M0,0 L8,4 L0,8 Z" />
            </marker>
          </defs>
          {view.edges.map((edge) => {
            const endpoints = new Set([edge.from, edge.to]);
            const areaMatch = focused !== null && endpoints.has(focused) && !filtering;
            const hoveredElsewhere =
              highlighted !== null && !highlighted.has(edge.id) && !areaMatch;
            return (
              <AuthoredEdge
                key={edge.id}
                edge={edge}
                marker={marker}
                bidirectional={bidirectionalEdges.has(edge.id)}
                lit={!muteEdges && (areaMatch || highlighted?.has(edge.id) === true)}
                muted={muteEdges || hoveredElsewhere}
                interactive={interactiveEdges.has(edge.id)}
                labelHidden={edge.labelHidden === true}
                hidden={muteEdges}
                onEdge={onEdge}
              />
            );
          })}
          {view.nodes.map((node) => (
            <CanvasSystemScope key={node.id} colour={node.colour}>
              {renderExpanded(node) ?? (
                <foreignObject
                  height={node.height}
                  data-component={node.id}
                  width={node.width}
                  x={node.x}
                  y={node.y}
                >
                  <div className={styles.node} data-network-node={node.id}>
                    {renderNode(node, !filtering && lit.size > 1 && !lit.has(node.id))}
                  </div>
                </foreignObject>
              )}
            </CanvasSystemScope>
          ))}
          {renderOverlay(highlighted)}
        </svg>
      </div>
      <figcaption className={styles.caption}>
        <Legend items={LEGEND} />
        <span>Select cards to filter connections. Drag to pan and pinch to zoom.</span>
      </figcaption>
    </figure>
  );
}
