'use client';

import { type ReactNode, useRef, useState } from 'react';

import type { FlowView } from '@/application/plan-viz-flow-key';
import { keepChoice, keptChoice } from '@/features/plan/kept';

import styles from './flow-shell.module.css';
import { FlowStepper, type StepperStop } from './flow-stepper';
import { useFlowStop } from './use-flow-stop';
import { useStepClicks } from './use-step-clicks';

export interface StopView extends StepperStop {
  readonly diagram: ReactNode;
  readonly sequence: ReactNode;
  /** The screens the flow passes through, with this stop's lit. */
  readonly strip: ReactNode;
  /** What the stop says: the experience, or the step card. */
  readonly side: ReactNode;
}

export interface FlowShellProps {
  readonly stops: readonly StopView[];
  /** The views the reader may pick between. */
  readonly views: readonly FlowView[];
  readonly view?: FlowView | undefined;
  /** The key to the drawing, for each view. */
  readonly keys: Readonly<Record<FlowView, ReactNode>>;
  /** Beside the view switch: copy as Mermaid. */
  readonly tools?: ReactNode;
  /** Put the side above the drawing rather than below. */
  readonly sideFirst?: boolean;
  readonly start?: number | undefined;
  readonly stop?: number | undefined;
  readonly onStop?: ((stop: number) => void) | undefined;
  readonly hint?: string;
  /** Called when the reader picks a view. */
  readonly onView?: ((view: FlowView) => void) | undefined;
  /** Let the arrow keys step through the stops; off when something around the viewer steps instead. */
  readonly stepKeys?: boolean;
  /** Fold the drawing away under this name, with its own previous and next in place of the stepper. */
  readonly fold?: string | undefined;
  /** Remember the view the reader picks under this name, and open on it next time. */
  readonly keep?: string | undefined;
}

const viewOf = (keep: string | undefined, view: FlowView): FlowView => {
  const kept = keep === undefined ? undefined : keptChoice(keep);
  return kept === 'diagram' || kept === 'sequence' ? kept : view;
};

const NAMES: Readonly<Record<FlowView, string>> = { diagram: 'Flow diagram', sequence: 'Sequence' };

interface ToolbarProps {
  readonly keys: FlowShellProps['keys'];
  readonly views: readonly FlowView[];
  readonly shown: FlowView;
  readonly onPick: (view: FlowView) => void;
  readonly tools: ReactNode;
}

function Toolbar({ keys, views, shown, onPick, tools }: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.key}>{keys[shown]}</div>
      {views.length > 1 ? (
        <div aria-label="View" className={styles.views} role="group">
          {views.map((v) => (
            <button
              aria-pressed={v === shown}
              className={styles.view}
              key={v}
              onClick={() => {
                onPick(v);
              }}
              type="button"
            >
              {NAMES[v]}
            </button>
          ))}
        </div>
      ) : null}
      {tools}
    </div>
  );
}

function FoldNav(props: {
  readonly current: number;
  readonly count: number;
  readonly onGo: (stop: number) => void;
}) {
  const { current, count, onGo } = props;
  return (
    <nav aria-label="Stops in this flow" className={styles.foldNav}>
      <button
        disabled={current <= 0}
        onClick={() => {
          onGo(current - 1);
        }}
        type="button"
      >
        ← Previous
      </button>
      <button
        disabled={current >= count - 1}
        onClick={() => {
          onGo(current + 1);
        }}
        type="button"
      >
        Next →
      </button>
    </nav>
  );
}

// The viewer's moving parts: which stop and which view are shown. Everything drawn arrives ready-made.
export function FlowShell({
  stops,
  views,
  view = 'diagram',
  keys,
  tools,
  sideFirst = false,
  start,
  stop,
  onStop,
  hint = 'Click a card to open it; click a step to go to it.',
  onView,
  stepKeys = true,
  fold,
  keep,
}: FlowShellProps) {
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<FlowView>(() => viewOf(keep, view));
  const { current, go, move } = useFlowStop({ count: stops.length, start, stop, onStop });
  useStepClicks(root, { onGo: go, onMove: stepKeys ? move : undefined });
  const at = stops[current];
  if (at === undefined) return <p className={styles.none}>This flow has no steps.</p>;
  const side = <div className={styles.side}>{at.side}</div>;
  const toolbar = (
    <Toolbar
      keys={keys}
      onPick={(v) => {
        setShown(v);
        if (keep !== undefined) keepChoice(keep, v);
        onView?.(v);
      }}
      shown={shown}
      tools={tools}
      views={views}
    />
  );
  const stage = (
    <div className={styles.stage} data-walk-anchor={fold === undefined ? '' : undefined}>
      {shown === 'diagram' ? at.diagram : at.sequence}
    </div>
  );
  if (fold !== undefined) {
    return (
      <div className={styles.shell} ref={root}>
        <details className={styles.fold} data-keep="diagram" data-walk-anchor="">
          <summary>{fold}</summary>
          <FoldNav count={stops.length} current={current} onGo={go} />
          {toolbar}
          {at.strip}
          {stage}
          <p className={styles.hint}>{hint}</p>
        </details>
        {side}
      </div>
    );
  }
  return (
    <div className={styles.shell} ref={root}>
      {toolbar}
      {at.strip}
      {sideFirst ? side : null}
      {stage}
      <FlowStepper current={current} onGo={go} stops={stops} />
      {sideFirst ? null : side}
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}
