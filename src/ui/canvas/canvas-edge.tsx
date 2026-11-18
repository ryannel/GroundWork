import { diagramCaption } from '@/shared/diagram-caption';
import type { ConnectedCanvasEdge } from '@/ui/connected-canvas-types';

import styles from './canvas-edge.module.css';

export function CanvasCaption({
  edge,
  always = false,
}: {
  readonly edge: Pick<ConnectedCanvasEdge, 'label' | 'x' | 'y' | 'labelHidden'>;
  /** A raised line shows its caption even when there was no room to leave it on the map. */
  readonly always?: boolean;
}) {
  if (edge.labelHidden === true && !always) return null;
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
          orient="auto-start-reverse"
          refX="8"
          refY="5"
        >
          <path className={suffix === '' ? styles.arrow : styles.arrowLit} d="M0,0 L10,5 L0,10 Z" />
        </marker>
      ))}
    </defs>
  );
}

function EdgeLine({
  edge,
  arrow,
  bidirectional,
}: {
  readonly edge: ConnectedCanvasEdge;
  readonly arrow: string;
  readonly bidirectional: boolean | undefined;
}) {
  return (
    <path
      className={styles.line}
      d={edge.path}
      markerStart={bidirectional === true ? arrow : undefined}
      markerEnd={edge.directed === false ? undefined : arrow}
    />
  );
}

/** One line. Only its wide, undashed hit path takes the pointer, so dotted lines are as easy to point at. */
export function CanvasEdge({
  edge,
  marker,
  bidirectional,
  lit,
  muted,
  onEnter,
  onLeave,
  onSelect,
}: {
  readonly edge: ConnectedCanvasEdge;
  readonly marker: string;
  readonly bidirectional?: boolean;
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
      <EdgeLine edge={edge} arrow={arrow} bidirectional={bidirectional} />
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
      <CanvasCaption edge={edge} />
    </g>
  );
}

/** A technical count opens the same group as its path. */
export function CanvasEdgeCaptionControl({
  edge,
  lit = false,
  muted = false,
  onSelect,
}: {
  readonly edge: ConnectedCanvasEdge;
  readonly onSelect: (id: string) => void;
  readonly lit?: boolean;
  readonly muted?: boolean;
}) {
  if (edge.labelHidden === true) return null;
  const select = (): void => {
    onSelect(edge.id);
  };
  return (
    <g
      aria-label={edge.detail}
      className={styles.captionControl}
      role="button"
      tabIndex={0}
      onClick={select}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      }}
    >
      <CanvasEdgeLabel edge={edge} lit={lit} muted={muted} />
    </g>
  );
}

/** The line under the pointer or keyboard focus, drawn again above every other line with its caption. */
export function RaisedEdge({
  edge,
  marker,
}: {
  readonly edge: ConnectedCanvasEdge;
  readonly marker: string;
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
      <CanvasCaption edge={edge} always />
    </g>
  );
}
