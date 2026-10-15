'use client';

import { type ReactNode, Suspense, use, useMemo, useSyncExternalStore } from 'react';

import type { Model } from '@/application/plan/derive';
import { progressOf, walkOf } from '@/application/plan-story-journey-walk';
import type { FlowView } from '@/application/plan-viz-flow-key';
import { keepChoice, keptChoice } from '@/features/plan/kept';
import { pendingModel } from '@/features/plan/plan-model';
import { journeyModes } from '@/features/plan/viz/journey/journey';
import { JourneyView } from '@/features/plan/viz/journey/journey-shell.client';

import styles from './scenario-walk.module.css';
import { useSteady } from './use-steady';
import { useWalk } from './use-walk';
import { WalkNav } from './walk-nav';

export interface ScenarioWalkProps {
  /** Where the plan is fetched from. */
  readonly src: string;
  /** Where the plan's pictures are served from. */
  readonly base: string;
  /** This screen's address. */
  readonly href: string;
  /** The scenario's flows, in the order it runs them, each with its name in the flow list. */
  readonly flows: readonly { readonly id: string; readonly option: string }[];
  /** Each flow's heading, drawn above its journey. */
  readonly heads: Readonly<Record<string, ReactNode>>;
  /** The scenario's story, under the heading. */
  readonly context: ReactNode;
}

function ignore(): void {
  // Being in the browser never changes once the page is there.
}
const neverChanges = (): (() => void) => ignore;

const flowViewOf = (): FlowView =>
  keptChoice('flow-view') === 'sequence' ? 'sequence' : 'diagram';

function FlowList({
  flows,
  current,
  onPick,
}: {
  readonly flows: ScenarioWalkProps['flows'];
  readonly current: string;
  readonly onPick: (id: string) => void;
}) {
  if (flows.length < 2) return null;
  return (
    <label className={styles.field}>
      <span>Flow in this scenario</span>
      <select
        onChange={(event) => {
          onPick(event.target.value);
        }}
        value={current}
      >
        {flows.map((flow) => (
          <option key={flow.id} value={flow.id}>
            {flow.option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Walking({ model, props }: { readonly model: Model; readonly props: ScenarioWalkProps }) {
  const { flows, base, heads, context } = props;
  const walk = useMemo(
    () =>
      walkOf(
        model,
        flows.map((f) => f.id),
      ),
    [model, flows],
  );
  const { root, before } = useSteady();
  const { place, go } = useWalk({ walk, href: props.href, before });
  const at = walk.positions[place.index] ?? { flowId: flows[0]?.id ?? '', stepId: null };
  const modes = useMemo(
    () => journeyModes(model, { flowId: at.flowId, base, extraIds: [at.flowId] }),
    [model, at.flowId, base],
  );
  const toStep = (id: string): void => {
    const index = walk.positions.findIndex((p) => (p.stepId ?? p.flowId) === id);
    if (index !== -1) go({ ...place, index });
  };
  return (
    <div className={styles.walk} ref={root}>
      {heads[at.flowId]}
      {context}
      <div className={styles.bar}>
        <FlowList
          current={at.flowId}
          flows={flows}
          onPick={(id) => {
            const first = walk.stops[place.mode].find((i) => walk.positions[i]?.flowId === id);
            if (first !== undefined) go({ ...place, index: first });
          }}
        />
        <p aria-live="polite" className={styles.progress}>
          {progressOf(walk, place)}
        </p>
      </div>
      <JourneyView
        flow={{
          keys: false,
          view: flowViewOf(),
          onView: (view) => {
            keepChoice('flow-view', view);
          },
        }}
        mode={place.mode}
        modes={modes}
        onMode={(mode) => {
          go({ ...place, mode });
        }}
        onStep={toStep}
        stepId={at.stepId ?? at.flowId}
      />
      <WalkNav
        onGo={(index) => {
          go({ ...place, index });
        }}
        place={place}
        walk={walk}
      />
    </div>
  );
}

function Still({ props, note }: { readonly props: ScenarioWalkProps; readonly note: string }) {
  return (
    <div className={styles.walk}>
      {props.heads[props.flows[0]?.id ?? '']}
      {props.context}
      <p className={styles.note}>{note}</p>
    </div>
  );
}

function Loaded({ props }: { readonly props: ScenarioWalkProps }) {
  const model = use(pendingModel(props.src).model);
  if (model === null) return <Still note="The steps could not be loaded." props={props} />;
  return <Walking model={model} props={props} />;
}

/**
 * A scenario walked one step at a time across every flow it runs, today or with the plan. The browser draws it
 * from the plan itself, so the page carries one heading per flow rather than every step drawn twice.
 */
export function ScenarioWalk(props: ScenarioWalkProps) {
  const mounted = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
  const waiting = <Still note="Loading the steps…" props={props} />;
  if (!mounted) return waiting;
  return (
    <Suspense fallback={waiting}>
      <Loaded props={props} />
    </Suspense>
  );
}
