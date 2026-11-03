import { diagramCaption } from '@/shared/diagram-caption';
import type { ConnectedCanvasEdge } from '@/ui/connected-canvas-types';
import { Panel } from '@/ui/panel';
import { Text } from '@/ui/text';

import styles from './canvas-edge.module.css';

function Caption({ edge }: { readonly edge: ConnectedCanvasEdge }) {
  if (edge.labelHidden === true) return null;
  const caption = diagramCaption(edge.label);
  return (
    <text textAnchor="middle" x={edge.x} y={edge.y}>
      <tspan x={edge.x}>{caption.lines[0]}</tspan>
      {caption.lines[1] === undefined ? null : (
        <tspan x={edge.x} dy={caption.lineHeight}>
          {' '}
          {caption.lines[1]}
        </tspan>
      )}
    </text>
  );
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
      data-label-hidden={edge.labelHidden}
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
      <Caption edge={edge} />
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
      <Caption edge={edge} />
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
