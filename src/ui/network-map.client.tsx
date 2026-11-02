'use client';

import Link from 'next/link';
import { useId, useState } from 'react';

import { CanvasNavigation } from './connected-canvas-toolbar';
import { Legend } from './legend';
import styles from './network-map.module.css';
import { useCanvasFullscreen } from './use-canvas-fullscreen';
import { useExplorerViewport } from './use-explorer-viewport';

interface NetworkNode {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly string[];
  readonly purpose: string;
  readonly purposeLines: readonly string[];
  readonly href: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
interface NetworkEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly path: string;
  readonly label: string;
  readonly kind: 'exchange' | 'transition' | 'support';
  readonly x: number;
  readonly y: number;
}
interface NetworkView {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly NetworkNode[];
  readonly edges: readonly NetworkEdge[];
}

const LEGEND = [
  { label: 'Information exchange', line: 'solid' },
  { label: 'Activity continues', line: 'dashed' },
  { label: 'Shared support', line: 'dotted' },
] as const;

function connected(view: NetworkView, focused: string | null): ReadonlySet<string> {
  if (focused === null) return new Set();
  return new Set([
    focused,
    ...view.edges.flatMap((edge) =>
      edge.from === focused || edge.to === focused ? [edge.from, edge.to] : [],
    ),
  ]);
}

/** A linked network that reads whole before any node is opened. */
export function NetworkMap({
  view,
  label,
}: {
  readonly view: NetworkView;
  readonly label: string;
}) {
  const marker = useId().replaceAll(':', '');
  const [focused, setFocused] = useState<string | null>(null);
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
  const lit = connected(view, focused);
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
          role="img"
          width={view.width * zoom}
          height={view.height * zoom}
          viewBox={`0 0 ${String(view.width)} ${String(view.height)}`}
        >
          <defs>
            <marker id={marker} markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <path className={styles.arrow} d="M0,0 L8,4 L0,8 Z" />
            </marker>
          </defs>
          {view.edges.map((edge) => (
            <g
              className={styles.edge}
              data-kind={edge.kind}
              data-muted={
                focused !== null && edge.from !== focused && edge.to !== focused ? '' : undefined
              }
              key={edge.id}
            >
              <path d={edge.path} markerEnd={`url(#${marker})`} />
              <text textAnchor="middle" x={edge.x} y={edge.y}>
                {edge.label}
              </text>
            </g>
          ))}
          {view.nodes.map((node) => (
            <Link
              aria-label={`${node.name}. ${node.purpose}`}
              className={styles.node}
              data-muted={focused !== null && !lit.has(node.id) ? '' : undefined}
              href={node.href}
              key={node.id}
              onBlur={() => {
                setFocused(null);
              }}
              onFocus={() => {
                setFocused(node.id);
              }}
              onMouseEnter={() => {
                setFocused(node.id);
              }}
              onMouseLeave={() => {
                setFocused(null);
              }}
            >
              <title>{node.purpose}</title>
              <rect height={node.height} rx="14" width={node.width} x={node.x} y={node.y} />
              <text textAnchor="middle" x={node.x + node.width / 2} y={node.y + 34}>
                {node.lines.map((line, index) => (
                  <tspan dy={index === 0 ? 0 : 24} key={line} x={node.x + node.width / 2}>
                    {line}
                  </tspan>
                ))}
              </text>
              <text
                className={styles.purpose}
                textAnchor="middle"
                x={node.x + node.width / 2}
                y={node.y + 88}
              >
                {node.purposeLines.map((line, index) => (
                  <tspan dy={index === 0 ? 0 : 18} key={line} x={node.x + node.width / 2}>
                    {line}
                  </tspan>
                ))}
              </text>
              <text
                className={styles.open}
                textAnchor="middle"
                x={node.x + node.width / 2}
                y={node.y + node.height - 18}
              >
                Open area →
              </text>
            </Link>
          ))}
        </svg>
      </div>
      <figcaption className={styles.caption}>
        <Legend items={LEGEND} />
        <span>
          Follow information from left to right. Each branch is a distinct purpose. Select an area
          to explore its systems; drag to pan and pinch to zoom.
        </span>
      </figcaption>
    </figure>
  );
}
