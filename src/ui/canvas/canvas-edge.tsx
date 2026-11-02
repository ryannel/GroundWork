import type { ConnectedCanvasEdge } from '@/ui/connected-canvas-types';
import { Panel } from '@/ui/panel';
import { Text } from '@/ui/text';

import styles from './canvas-edge.module.css';

function edgeLabel(label: string): string {
  const [method, path] = label.split(/\s+/u);
  if (
    path?.startsWith('/') !== true ||
    !/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(?:\|[A-Z]+)*$/u.test(method ?? '')
  ) {
    return label.length > 36 ? `${label.slice(0, 33)}…` : label;
  }
  const operation =
    path
      .split('?')[0]
      ?.split('/')
      .findLast((part) => part.length > 0 && !part.startsWith('{')) ?? path;
  const concise = `${method ?? ''} ${operation}`;
  return concise.length > 36 ? `${concise.slice(0, 33)}…` : concise;
}

export function Markers({ marker }: { readonly marker: string }) {
  return (
    <defs>
      {(['', '-lit'] as const).map((suffix) => (
        <marker
          id={`${marker}${suffix}`}
          key={suffix}
          markerHeight="10"
          markerUnits="userSpaceOnUse"
          markerWidth="10"
          orient="auto"
          refX="8"
          refY="5"
        >
          <path className={suffix === '' ? styles.arrow : styles.arrowLit} d="M0,0 L10,5 L0,10 Z" />
        </marker>
      ))}
    </defs>
  );
}

/** One line. Only its wide, undashed hit path takes the pointer, so dotted lines are as easy to point at. */
export function CanvasEdge({
  edge,
  marker,
  lit,
  muted,
  onEnter,
  onLeave,
  onSelect,
}: {
  readonly edge: ConnectedCanvasEdge;
  readonly marker: string;
  readonly lit: boolean;
  readonly muted: boolean;
  readonly onEnter: () => void;
  readonly onLeave: () => void;
  readonly onSelect: ((id: string) => void) | undefined;
}) {
  const emphasis = lit || (!muted && edge.highlighted === true);
  const arrow = `url(#${marker}${emphasis ? '-lit' : ''})`;
  return (
    <g
      aria-label={edge.detail}
      className={styles.edge}
      data-edge={edge.id}
      data-kind={edge.kind}
      data-pattern={edge.pattern}
      data-lit={emphasis ? '' : undefined}
      data-flow={edge.highlighted === true ? '' : undefined}
      data-muted={muted ? '' : undefined}
      data-quiet={edge.quiet === true ? '' : undefined}
      data-context={edge.context === true ? '' : undefined}
      data-supporting={edge.supporting === true ? '' : undefined}
      onBlur={onLeave}
      onClick={() => {
        onSelect?.(edge.id);
      }}
      onFocus={onEnter}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSelect?.(edge.id);
      }}
      role={onSelect === undefined ? 'img' : 'button'}
      tabIndex={0}
    >
      <title>{edge.detail}</title>
      <path
        className={styles.line}
        d={edge.path}
        markerEnd={edge.directed === false ? undefined : arrow}
      />
      <path
        className={styles.edgeHit}
        d={edge.path}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      />
    </g>
  );
}

/** Labels follow every base path so another route cannot paint over their text halo. */
export function CanvasEdgeLabel({
  edge,
  lit,
  muted,
}: {
  readonly edge: ConnectedCanvasEdge;
  readonly lit: boolean;
  readonly muted: boolean;
}) {
  return (
    <g
      aria-hidden="true"
      className={[styles.edge, styles.edgeLabel].join(' ')}
      data-edge-label={edge.id}
      data-lit={lit || (!muted && edge.highlighted === true) ? '' : undefined}
      data-flow={edge.highlighted === true ? '' : undefined}
      data-muted={muted ? '' : undefined}
      data-quiet={edge.quiet === true ? '' : undefined}
      data-context={edge.context === true ? '' : undefined}
      data-supporting={edge.supporting === true ? '' : undefined}
    >
      <text textAnchor="middle" x={edge.x} y={edge.y}>
        {edgeLabel(edge.label)}
      </text>
    </g>
  );
}

/** The line under the pointer, drawn again above every other line with its label. */
export function RaisedEdge({
  edge,
  marker,
  described = false,
}: {
  readonly edge: ConnectedCanvasEdge;
  readonly marker: string;
  readonly described?: boolean;
}) {
  return (
    <g
      aria-hidden="true"
      className={styles.raised}
      data-raised-edge={edge.id}
      data-kind={edge.kind}
      data-pattern={edge.pattern}
    >
      <path d={edge.path} markerEnd={edge.directed === false ? undefined : `url(#${marker}-lit)`} />
      <text textAnchor="middle" x={edge.x} y={edge.y}>
        {edgeLabel(edge.label)}
      </text>
      {described ? (
        <foreignObject
          className={styles.description}
          x={Math.max(12, edge.x - 180)}
          y={edge.y + 16}
          width={360}
          height={1}
        >
          <div role="tooltip">
            <Panel>
              <Text as="p" size="sm">
                {edge.detail}
              </Text>
            </Panel>
          </div>
        </foreignObject>
      ) : null}
    </g>
  );
}
