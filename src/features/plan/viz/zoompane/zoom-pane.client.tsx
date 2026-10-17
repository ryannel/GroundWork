'use client';

import { type ReactNode, createContext, use, useRef } from 'react';

import { type Bounds, type ZoomCommand, zoomPercent } from '@/application/plan-viz-zoompane';

import { ScrollCue } from './scroll-cue.client';
import { useZoomPane } from './use-zoom-pane';
import styles from './zoom-pane.module.css';

export interface ZoomPaneProps {
  /** What the drawing is, for the Expand button: "the flow", "the map". */
  readonly what?: string;
  /** The panel's accessible name while it fills the screen. */
  readonly label?: string;
  /** The drawn size, in the drawing's own units. */
  readonly w: number;
  readonly h: number;
  /** What the selected interaction takes up, in the same units; Focus frames it. */
  readonly focus?: Bounds | null;
  /** A drawing too large to read whole opens on its selection at no less than this scale. */
  readonly readable?: number | undefined;
  /** The smallest scale Fit may use. */
  readonly minFit?: number;
  /** A drawing that is read rather than panned (a sequence): expanded it fills the screen and scrolls. */
  readonly scroll?: boolean;
  /** A drawing too wide for the page: in the page it keeps its reading size and scrolls sideways. */
  readonly wide?: boolean;
  /** Toolbar groups before the zoom controls. */
  readonly tools?: ReactNode;
  /** A strip under the toolbar shown only while the drawing sits in the page: ways to scroll to a part of it. */
  readonly inline?: ReactNode;
  /** A strip under the drawing that explains its lines and colours. */
  readonly legend?: ReactNode;
  /** What the inline frame cannot show at once ("7 stages"); the Expand button says it. */
  readonly more?: string;
  /** The drawing. */
  readonly children: ReactNode;
}

/**
 * What a viewer that walks one drawing stop by stop has lit, in place of the pane's own `focus`; undefined outside
 * such a viewer.
 */
export const StopFocus = createContext<Bounds | null | undefined>(undefined);

function useStopFocus<T extends { readonly focus?: Bounds | null }>(own: T): T {
  const focus = use(StopFocus);
  return focus === undefined ? own : { ...own, focus };
}

type PaneSettings = Omit<ZoomPaneProps, 'children' | 'inline' | 'label' | 'legend'>;

const ZOOMS: readonly {
  readonly command: ZoomCommand;
  readonly title: string;
  readonly text: string;
}[] = [
  { command: 'out', title: 'Zoom out (−)', text: '−' },
  { command: 'reset', title: 'Actual size (1)', text: '' },
  { command: 'in', title: 'Zoom in (+)', text: '+' },
  { command: 'fit', title: 'Fit to the screen (0)', text: 'Fit' },
];

const ICONS = {
  expand: 'M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9',
  close: 'M4 4l8 8M12 4l-8 8',
};

function ExpandIcon({ open }: { readonly open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={styles.icon}
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
      width="14"
    >
      <path d={open ? ICONS.close : ICONS.expand} />
    </svg>
  );
}

interface ZoomToolsProps {
  readonly percent: string;
  readonly focusable: boolean;
  readonly onCommand: (command: ZoomCommand) => void;
}

function ZoomTools({ percent, focusable, onCommand }: ZoomToolsProps) {
  return (
    <div aria-label="Zoom" className={styles.group} role="group">
      {ZOOMS.map((zoom) => (
        <button
          aria-label={zoom.command === 'reset' ? 'Actual size' : undefined}
          className={styles.tool}
          data-zoom={zoom.command}
          key={zoom.command}
          onClick={() => {
            onCommand(zoom.command);
          }}
          title={zoom.title}
          type="button"
        >
          {zoom.command === 'reset' ? percent : zoom.text}
        </button>
      ))}
      {focusable ? (
        <button
          className={styles.tool}
          data-zoom="focus"
          onClick={() => {
            onCommand('focus');
          }}
          title="Focus the selected step (F)"
          type="button"
        >
          Focus selected step
        </button>
      ) : null}
    </div>
  );
}

interface ExpandProps {
  readonly full: boolean;
  readonly what: string;
  readonly more: string | undefined;
  readonly onToggle: () => void;
}

function Expand({ full, what, more, onToggle }: ExpandProps) {
  const open = more === undefined ? 'Expand' : `Expand · ${more}`;
  return (
    <button
      aria-label={full ? 'Close full screen' : `Expand ${what} to full screen`}
      className={styles.tool}
      data-expand=""
      onClick={onToggle}
      title={full ? 'Close (Esc)' : `Expand ${what} to fill the screen`}
      type="button"
    >
      <ExpandIcon open={full} />
      {full ? 'Close' : open}
    </button>
  );
}

function specOf(props: PaneSettings) {
  return {
    w: props.w,
    h: props.h,
    focus: props.focus ?? null,
    readable: props.readable ?? 0,
    minFit: props.minFit ?? 0,
    scroll: props.scroll ?? false,
  };
}

function Tools({
  props,
  pane,
}: {
  readonly props: PaneSettings;
  readonly pane: ReturnType<typeof useZoomPane>;
}) {
  const { command: handleCommand } = pane;
  return (
    <div className={styles.tools}>
      {props.tools}
      {pane.full && props.scroll !== true ? (
        <ZoomTools
          focusable={(props.focus ?? null) !== null}
          onCommand={handleCommand}
          percent={zoomPercent(pane.view)}
        />
      ) : null}
      <Expand
        full={pane.full}
        more={props.more}
        onToggle={() => {
          pane.toggle(!pane.full);
        }}
        what={props.what ?? 'the diagram'}
      />
    </div>
  );
}

function Notes({ partial, zoomable }: { readonly partial: boolean; readonly zoomable: boolean }) {
  return (
    <>
      {partial ? (
        <p className={styles.partial} role="status">
          Part of the drawing is out of sight. Fit (0) shows all of it.
        </p>
      ) : null}
      {zoomable ? (
        <p className={styles.hint}>Drag to pan · Ctrl or ⌘ and scroll to zoom · Esc closes</p>
      ) : null}
    </>
  );
}

// A diagram panel that expands to fill the screen, to zoom and pan: the flow diagram, the system map. The drawing
// is its children; the panel is told the drawn size and, optionally, where the selection is.
export function ZoomPane({ children, inline, label, legend, ...own }: ZoomPaneProps) {
  const settings = useStopFocus(own);
  const box = useRef<HTMLDivElement>(null);
  const pan = useRef<HTMLDivElement>(null);
  const spec = specOf(settings);
  const pane = useZoomPane(spec, { box, pan });
  const zoomable = pane.full && !spec.scroll;
  // read rather than panned, or wide and in the page: the drawing keeps its size and the box scrolls
  const scrolls = spec.scroll || (settings.wide === true && !pane.full);
  return (
    <section
      aria-label={pane.full ? (label ?? 'Diagram, full screen') : undefined}
      className={styles.shell}
      data-full={pane.full ? '' : undefined}
      data-scroll={spec.scroll ? '' : undefined}
    >
      <Tools pane={pane} props={settings} />
      {pane.full || inline === undefined ? null : <div className={styles.inline}>{inline}</div>}
      <div className={styles.view} ref={box}>
        <div className={styles.pan} ref={pan}>
          {scrolls ? (
            <ScrollCue note tall={!spec.scroll}>
              {children}
            </ScrollCue>
          ) : (
            children
          )}
        </div>
      </div>
      <Notes partial={pane.partial} zoomable={zoomable} />
      {legend === undefined ? null : <div className={styles.legend}>{legend}</div>}
    </section>
  );
}
