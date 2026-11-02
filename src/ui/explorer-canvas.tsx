import { useId } from 'react';

import type { ExplorerDrawing, ExplorerDrawingNode } from '@/shared/explorer-drawing';

import { Button } from './button';
import styles from './explorer-canvas.module.css';
import { Cluster, Stack } from './stack';
import { Text } from './text';
import { useExplorerViewport } from './use-explorer-viewport';

function NodeShape({ node }: { readonly node: ExplorerDrawingNode }) {
  const { x, y, width, height } = node;
  if (node.shape === 'diamond') {
    return (
      <path
        d={`M${String(x + width / 2)},${String(y)} L${String(x + width)},${String(y + height / 2)} L${String(x + width / 2)},${String(y + height)} L${String(x)},${String(y + height / 2)} Z`}
      />
    );
  }
  if (node.shape === 'ellipse') {
    return <ellipse cx={x + width / 2} cy={y + height / 2} rx={width / 2} ry={height / 2} />;
  }
  return <rect height={height} rx={node.shape === 'store' ? 20 : 10} width={width} x={x} y={y} />;
}

function Drawing({
  drawing,
  label,
  zoom,
  selected,
  onSelect,
}: {
  readonly drawing: ExplorerDrawing;
  readonly label: string;
  readonly zoom: number;
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
}) {
  const marker = useId().replaceAll(':', '');
  return (
    <svg
      aria-label={label}
      className={styles.canvas}
      height={drawing.height * zoom}
      role="group"
      viewBox={`0 0 ${String(drawing.width)} ${String(drawing.height)}`}
      width={drawing.width * zoom}
    >
      <defs>
        <marker id={marker} markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
          <path className={styles.arrow} d="M0,0 L8,4 L0,8 Z" />
        </marker>
      </defs>
      {drawing.groups?.map((group) => (
        <g aria-label={group.label} className={styles.boundary} key={group.id}>
          <title>{group.label}</title>
          <rect height={group.height} rx="14" width={group.width} x={group.x} y={group.y} />
        </g>
      ))}
      {drawing.edges.map((edge) => (
        <g
          className={styles.edge}
          data-contained={edge.contained === true ? '' : undefined}
          data-dashed={edge.dashed ? '' : undefined}
          key={edge.id}
        >
          <title>{edge.detail ?? edge.label}</title>
          <path d={edge.path} markerEnd={`url(#${marker})`} />
          <text textAnchor="middle" x={edge.x} y={edge.y}>
            {edge.label}
          </text>
        </g>
      ))}
      {drawing.nodes.map((node) => (
        <g
          aria-label={`${node.note}: ${node.detail ?? node.lines.join(' ')}`}
          aria-pressed={selected === node.id}
          className={styles.node}
          data-selected={selected === node.id ? '' : undefined}
          data-tone={node.tone}
          data-shape={node.shape}
          key={node.id}
          onClick={() => {
            onSelect(node.id);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(node.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <title>{node.detail ?? node.lines.join(' ')}</title>
          <NodeShape node={node} />
          <text
            className={styles.note}
            textAnchor="middle"
            x={node.x + node.width / 2}
            y={node.y + 24}
          >
            {node.note}
          </text>
          {node.lines.map((line, index) => (
            <text
              className={styles.name}
              key={`${String(index)}-${line}`}
              textAnchor="middle"
              x={node.x + node.width / 2}
              y={node.y + 47 + index * 18}
            >
              {line}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}

/** A readable, keyboard-selectable graph. Geometry and source semantics are supplied by the caller. */
export function ExplorerCanvas({
  drawing,
  label,
  selected,
  onSelect,
  fit = false,
}: {
  readonly fit?: boolean;
  readonly drawing: ExplorerDrawing;
  readonly label: string;
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
}) {
  const {
    viewportRef,
    zoom,
    changeZoom,
    handleFit,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useExplorerViewport(drawing.width, drawing.height, fit);
  return (
    <Stack gap={2}>
      <Cluster label="Diagram navigation" spread>
        <Cluster gap={1}>
          <Button
            label="Zoom out"
            onClick={() => {
              changeZoom(1 / 1.2);
            }}
            size="sm"
          >
            −
          </Button>
          <Text size="sm" mono>
            {Math.round(zoom * 100)}%
          </Text>
          <Button
            label="Zoom in"
            onClick={() => {
              changeZoom(1.2);
            }}
            size="sm"
          >
            +
          </Button>
          <Button onClick={handleFit} size="sm">
            Fit map
          </Button>
        </Cluster>
        <Text size="sm" tone="faint">
          Drag or scroll to explore · opened detail stays visible
        </Text>
      </Cluster>
      <div
        aria-label={`${label} canvas`}
        className={styles.viewport}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={viewportRef}
        role="region"
      >
        <Drawing
          drawing={drawing}
          label={label}
          zoom={zoom}
          selected={selected}
          onSelect={onSelect}
        />
      </div>
    </Stack>
  );
}
