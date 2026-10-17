import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { FlowMode } from '@/application/plan/flow-steps';
import { sequenceView } from '@/application/plan-viz-sequence';
import type { StepAction } from '@/features/plan/viz/flow-diagram/flow-hit';
import { ScrollCue } from '@/features/plan/viz/zoompane/scroll-cue.client';

import { Head } from './seq-head';
import { Items } from './seq-items';
import { Key } from './seq-key';
import styles from './sequence.module.css';

interface SequenceProps {
  readonly model: Model;
  readonly flowId: string;
  /** Which version of the flow is drawn; to-be unless told otherwise. */
  readonly mode?: FlowMode | undefined;
  /** The current step by index, or steps: the rows before it are drawn as walked. */
  readonly step?: number | readonly number[] | undefined;
  /** Draw the tests that walk the flow as numbered brackets down the left. */
  readonly spans?: boolean | undefined;
  /** A mark after a step's action, by step id; picking it asks to add that step to the changes ahead. */
  readonly markers?: Readonly<Record<string, string>> | undefined;
  readonly markerTitle?: string;
  /** Extra words after a step's action, by step id. */
  readonly notes?: Readonly<Record<string, ReactNode>>;
  /** What picking a step does: open it in the inspector, or give its number to a viewer that goes to it. */
  readonly action?: StepAction;
}

const NO_MARKERS: NonNullable<SequenceProps['markers']> = {};
const NO_NOTES: NonNullable<SequenceProps['notes']> = {};

// A flow as a sequence drawing: a column for each participant, a row for each step, time running down. Rows hold the
// step's arrow, its words and the records it touches; frames show what can fail and what happens together.
export function Sequence({
  model,
  flowId,
  mode = 'toBe',
  step,
  spans = false,
  markers = NO_MARKERS,
  markerTitle = 'Planned changes. Click to add it to Changes ahead.',
  notes = NO_NOTES,
  action = 'inspect',
}: SequenceProps) {
  const view = sequenceView(model, flowId, { mode, step, spans, markers, markerTitle });
  if (view === null) return <p className={styles.none}>This flow has no steps.</p>;
  const env = { model, cols: view.cols, action, notes, markerTitle };
  return (
    <figure className={styles.figure}>
      <ScrollCue note>
        <div
          aria-label={`Sequence of ${view.title}`}
          className={styles.seq}
          data-dense={view.dense ? '' : undefined}
          data-gut={view.lanes}
          data-min={view.tier}
          role="group"
        >
          <Head model={model} view={view} />
          <Items env={env} items={view.items} />
        </div>
      </ScrollCue>
      <Key items={view.key} />
    </figure>
  );
}
