'use client';

import { type ReactNode, useState } from 'react';

import type { FlowView } from '@/application/plan-viz-flow-key';
import type { AbsenceView, OutlineItem } from '@/application/plan-viz-journey-outline';
import type { JourneyMode } from '@/application/plan-viz-journey-words';
import { FlowShell, type FlowShellProps } from '@/features/plan/viz/flow-viewer/flow-shell.client';

import { JourneyAbsence } from './journey-absence';
import { JourneyModes } from './journey-modes';
import { JourneyOutline } from './journey-outline';

export interface ModeView {
  /** The ids of the steps this view draws, in order. */
  readonly steps: readonly string[];
  /** The viewer for this view; null when the view has no steps. */
  readonly shell: Pick<
    FlowShellProps,
    'stops' | 'keys' | 'tools' | 'sideFirst' | 'diagram' | 'sequence'
  > | null;
  readonly outline: readonly OutlineItem[];
  /** For each step or flow this view lacks, what to say. */
  readonly absences: Readonly<
    Record<string, { readonly view: AbsenceView; readonly extra: ReactNode }>
  >;
}

export interface JourneyShellProps {
  readonly modes: Readonly<Record<JourneyMode, ModeView>>;
  readonly start: { readonly mode: JourneyMode; readonly stepId: string };
}

interface BodyProps {
  readonly view: ModeView;
  readonly stepId: string;
  readonly onStep: (stepId: string) => void;
  readonly onMode: (mode: JourneyMode) => void;
  readonly flow?: FlowChoice | undefined;
}

/** What a walk asks of the viewer: its own keys off, and the drawing it last showed. */
export interface FlowChoice {
  readonly keys: boolean;
  readonly view?: FlowView | undefined;
  readonly onView?: ((view: FlowView) => void) | undefined;
}

function Body({ view, stepId, onStep, onMode, flow }: BodyProps) {
  const index = view.steps.indexOf(stepId);
  if (index !== -1 && view.shell !== null) {
    return (
      <FlowShell
        {...view.shell}
        onStop={(i) => {
          const next = view.steps[i];
          if (next !== undefined) onStep(next);
        }}
        onView={flow?.onView}
        stepKeys={flow?.keys ?? true}
        stop={index}
        view={flow?.view}
        fold="System diagram"
        views={['diagram', 'sequence']}
      />
    );
  }
  const absent = view.absences[stepId];
  if (absent === undefined) return <p>This step is not recorded in this flow.</p>;
  return <JourneyAbsence extra={absent.extra} onMode={onMode} onStep={onStep} view={absent.view} />;
}

export interface JourneyViewProps {
  readonly modes: Readonly<Record<JourneyMode, ModeView>>;
  readonly mode: JourneyMode;
  readonly stepId: string;
  readonly onMode: (mode: JourneyMode) => void;
  readonly onStep: (stepId: string) => void;
  readonly flow?: FlowChoice | undefined;
  /** Outside any plan: today only, with no switch. */
  readonly asIsOnly?: boolean | undefined;
}

/** The journey drawn at a place someone else keeps. */
export function JourneyView({
  modes,
  mode,
  stepId,
  onMode,
  onStep,
  flow,
  asIsOnly = false,
}: JourneyViewProps) {
  const view = modes[mode];
  return (
    <div>
      {asIsOnly ? null : <JourneyModes mode={mode} onMode={onMode} />}
      <JourneyOutline current={stepId} items={view.outline} onPick={onStep} />
      <Body flow={flow} key={mode} onMode={onMode} onStep={onStep} stepId={stepId} view={view} />
    </div>
  );
}

/** The journey's moving parts: which view, which step. Everything drawn arrives ready-made for both views. */
export function JourneyShell({ modes, start }: JourneyShellProps) {
  const [mode, setMode] = useState(start.mode);
  const [stepId, setStepId] = useState(start.stepId);
  return (
    <JourneyView mode={mode} modes={modes} onMode={setMode} onStep={setStepId} stepId={stepId} />
  );
}
