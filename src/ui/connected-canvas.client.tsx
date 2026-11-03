'use client';

import { useId, useState, type ReactNode } from 'react';

import { CanvasEdge, CanvasEdgeLabel, Markers, RaisedEdge } from './canvas/canvas-edge';
import { matchesConnection, type ConnectionDirection } from './canvas/relationship-focus';
import { useSteadyHover } from './canvas/use-steady-hover';
import { CanvasToolbar } from './connected-canvas-toolbar';
import type { ConnectedCanvasEdge, ConnectedCanvasFocus } from './connected-canvas-types';
import styles from './connected-canvas.module.css';
import { Legend, type LegendItem } from './legend';
import { Stack } from './stack';
import { Text } from './text';
import { useCanvasFocus } from './use-canvas-focus';
import { useCanvasFullscreen } from './use-canvas-fullscreen';
import { useExplorerViewport } from './use-explorer-viewport';

export type { ConnectedCanvasEdge, ConnectedCanvasFocus } from './connected-canvas-types';
export {
  CanvasAttachment,
  CanvasAttachmentGrid,
  CanvasBoundary,
  CanvasComponentDetail,
  CanvasContractGrid,
  CanvasDependencyArrow,
  CanvasEndpointChoice,
  CanvasInspectorSection,
  CanvasSystemScope,
} from './connected-canvas-parts';

function CanvasDiagram({
  marker,
  width,
  height,
  zoom,
  edges,
  selected,
  endpoint,
  direction,
  platform,
  onSelect,
  children,
}: {
  readonly marker: string;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
  readonly edges: readonly ConnectedCanvasEdge[];
  readonly selected?: string | undefined;
  readonly endpoint?: string | undefined;
  readonly direction: ConnectionDirection;
  readonly platform: boolean;
  readonly onSelect?: ((id: string) => void) | undefined;
  readonly children: ReactNode;
}) {
  const [described, setDescribed] = useState<string | null>(null);
  const {
    component,
    edge: pointed,
    settle,
    clear: handlePointerLeave,
    enterEdge,
    leaveEdge: handleLeaveEdge,
  } = useSteadyHover();
  const focus = {
    selected: component ?? selected,
    endpoint: component === null ? endpoint : undefined,
    direction,
  };
  const shown = edges.filter(
    (edge) =>
      edge.platform !== true ||
      platform ||
      (focus.selected !== undefined && matchesConnection(edge, focus)),
  );
  const raised = shown.find((edge) => edge.id === (described ?? pointed));
  return (
    <svg
      className={styles.canvas}
      height={height * zoom}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      width={width * zoom}
      onFocusCapture={(event) => {
        setDescribed(event.target.closest<SVGElement>('[data-edge]')?.dataset.edge ?? null);
      }}
      onBlurCapture={() => {
        setDescribed(null);
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') setDescribed(null);
      }}
      onPointerOver={(event) => {
        settle(event.target);
      }}
      onPointerLeave={handlePointerLeave}
    >
      <Markers marker={marker} />
      {children}
      {shown.map((edge) => (
        <CanvasEdge
          edge={edge}
          key={edge.id}
          lit={focus.selected !== undefined && matchesConnection(edge, focus)}
          marker={marker}
          muted={!matchesConnection(edge, focus)}
          onEnter={() => {
            enterEdge(edge.id);
          }}
          onLeave={handleLeaveEdge}
          onSelect={onSelect}
        />
      ))}
      {shown.map((edge) => (
        <CanvasEdgeLabel
          edge={edge}
          key={edge.id}
          lit={focus.selected !== undefined && matchesConnection(edge, focus)}
          muted={!matchesConnection(edge, focus)}
        />
      ))}
      {raised === undefined ? null : (
        <RaisedEdge
          edge={raised}
          marker={marker}
          described={described !== null || raised.labelHidden === true}
        />
      )}
    </svg>
  );
}

function useRelationshipKinds() {
  const [direction, setDirection] = useState<ConnectionDirection>('both');
  const [kinds, setKinds] = useState<ReadonlySet<ConnectedCanvasEdge['kind']>>(
    () => new Set(['api', 'message', 'data', 'membership']),
  );
  const toggleKind = (kind: ConnectedCanvasEdge['kind']): void => {
    setKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };
  const resetKinds = (): void => {
    setDirection('both');
    setKinds(new Set(['api', 'message', 'data', 'membership']));
  };
  return { kinds, toggleKind, resetKinds, direction, setDirection };
}

const LINES = [
  { label: 'API call', line: 'solid' },
  { label: 'Event', line: 'dashed' },
  { label: 'Data movement', line: 'dotted' },
] as const;

const FAINT = { label: 'Faint: context', line: 'faint' } as const;

/** With no isolation or direction chosen, every line is in scope; otherwise only the selection's. */
function inScope(
  edge: ConnectedCanvasEdge,
  scope: {
    readonly isolated: boolean;
    readonly selected: string | undefined;
    readonly endpoint: string | undefined;
    readonly direction: ConnectionDirection;
  },
): boolean {
  const { isolated, ...focus } = scope;
  return (!isolated && focus.direction === 'both') || matchesConnection(edge, focus);
}

/** Calls to shared platform services stay off the canvas until asked for. */
function usePlatformLines(edges: readonly ConnectedCanvasEdge[]) {
  const [shown, setShown] = useState(false);
  const count = edges.filter((edge) => edge.platform === true).length;
  return {
    shown,
    toolbar: count === 0 ? undefined : { shown, count },
    toggle: (): void => {
      setShown((value) => !value);
    },
    reset: (): void => {
      setShown(false);
    },
  };
}

/** A pannable canvas with stable graph scale, relationship filters and a readable inspector dock. */
function CanvasInspector({ children }: { readonly children: ReactNode }) {
  if (children === undefined) return null;
  return (
    <aside aria-label="Selected component" className={styles.inspector}>
      {children}
    </aside>
  );
}

function fullscreenFrame(focus: ConnectedCanvasFocus | null | undefined, fullscreen: boolean) {
  return focus?.maximumZoom === undefined
    ? focus
    : { ...focus, id: `${focus.id}:${String(fullscreen)}` };
}

export function ConnectedCanvas({
  caption,
  legend = LINES,
  controls,
  context,
  width,
  height,
  label,
  edges,
  focus,
  inspector,
  detail = 'grouped',
  onDetailChange,
  onEdgeSelect,
  onReset,
  selected,
  endpoint,
  children,
}: {
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly caption?: string;
  readonly legend?: readonly LegendItem[];
  readonly controls?: ReactNode;
  readonly context?: ReactNode;
  readonly edges: readonly ConnectedCanvasEdge[];
  readonly focus?: ConnectedCanvasFocus | null;
  readonly inspector?: ReactNode;
  readonly detail?: 'grouped' | 'all';
  readonly onDetailChange?: (detail: 'grouped' | 'all') => void;
  readonly onEdgeSelect?: (id: string) => void;
  readonly onReset?: () => void;
  readonly selected?: string | undefined;
  readonly endpoint?: string | undefined;
  readonly children: ReactNode;
}) {
  const marker = useId().replaceAll(':', '');
  const [isolated, setIsolated] = useState(false);
  const platform = usePlatformLines(edges);
  const { fullscreen, toggle: toggleFullscreen } = useCanvasFullscreen();
  const { kinds, toggleKind, resetKinds, direction, setDirection } = useRelationshipKinds();
  const {
    viewportRef,
    zoom,
    changeZoom,
    handleFit,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useExplorerViewport(width, height, {
    fit: focus?.maximumZoom === undefined,
    minimumFit: 0.85,
  });
  const framedFocus = fullscreenFrame(focus, fullscreen);
  const handleFocus = useCanvasFocus(framedFocus, viewportRef, { zoom, changeZoom });
  const reset = (): void => {
    resetKinds();
    setIsolated(false);
    platform.reset();
    onDetailChange?.('grouped');
    onReset?.();
    handleFit();
  };
  const toolbar = (
    <CanvasToolbar
      direction={direction}
      handleDirection={setDirection}
      canChangeDetail={onDetailChange !== undefined}
      detail={detail}
      fullscreen={fullscreen}
      kinds={kinds}
      hasMembership={edges.some((edge) => edge.kind === 'membership')}
      handleDetail={() => onDetailChange?.(detail === 'grouped' ? 'all' : 'grouped')}
      handleFit={handleFit}
      handleFocus={handleFocus}
      handleFullscreen={toggleFullscreen}
      handleKind={toggleKind}
      handleReset={reset}
      handleZoom={changeZoom}
      selection={selected !== undefined}
      isolated={isolated}
      platform={platform.toolbar}
      handlePlatform={platform.toggle}
      handleIsolate={() => {
        setIsolated((value) => !value);
      }}
      zoom={zoom}
    />
  );
  return (
    <div className={styles.shell} data-fullscreen={fullscreen ? '' : undefined}>
      <Stack gap={2}>
        <div className={styles.stage} data-inspector={inspector === undefined ? undefined : ''}>
          <div className={styles.context}>
            <Stack gap={2}>
              {toolbar}
              {controls}
              <Text size="sm" tone="faint">
                {caption ??
                  'Arrowheads point from caller or producer to receiver · scroll to explore · pinch to zoom'}
              </Text>
              {context}
              {edges.some((edge) => edge.labelHidden === true) ? (
                <Text size="sm" tone="muted">
                  Crowded connections keep their full captions on hover or keyboard focus.
                </Text>
              ) : null}
            </Stack>
          </div>
          <div
            aria-label={label}
            className={styles.viewport}
            onPointerCancel={handlePointerUp}
            onLostPointerCapture={handlePointerUp}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            ref={viewportRef}
            role="region"
          >
            <CanvasDiagram
              edges={edges.filter(
                (edge) =>
                  kinds.has(edge.kind) &&
                  inScope(edge, { isolated, selected, endpoint, direction }),
              )}
              direction={direction}
              endpoint={endpoint}
              height={height}
              marker={marker}
              onSelect={onEdgeSelect}
              platform={platform.shown}
              selected={selected}
              width={width}
              zoom={zoom}
            >
              {children}
            </CanvasDiagram>
          </div>
          <CanvasInspector>{inspector}</CanvasInspector>
        </div>
        <Legend
          items={[
            ...legend,
            ...(edges.some((edge) => edge.kind === 'membership')
              ? [{ label: 'Recorded membership (no arrow)', line: 'dotted' as const }]
              : []),
            ...(edges.some((edge) => edge.context === true) ? [FAINT] : []),
          ]}
        />
      </Stack>
    </div>
  );
}
