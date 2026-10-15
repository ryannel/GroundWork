import type { ReactNode } from 'react';

import { flowHead } from '@/application/plan-story-changes-flows';
import { fit } from '@/application/plan-story-changes-records';
import { changesOf, teamsBehind } from '@/application/plan-story-changes-touched';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import type { BodyProps } from '@/features/plan/screen-bodies';
import { SegTabs } from '@/features/plan/viz/query-plan/seg-tabs.client';

import { Decisions, JourneyLink, TeamRow } from './changes-kit';

interface FlowPanelProps extends BodyProps {
  readonly id: string;
  /** Says what the flow's records or interfaces do, in place of the change's own title. */
  readonly claim?: string | null;
  readonly children?: ReactNode;
  readonly tail?: ReactNode;
  /** Set when the flow sits in one tab of several. */
  readonly item?: string | undefined;
}

/** A flow the plan changes: what now happens, who builds it, and where to walk it. */
export function FlowPanel({
  model,
  outline,
  page,
  id,
  claim = null,
  children,
  tail,
  item,
}: FlowPanelProps) {
  const changes = changesOf(model, id);
  const { head, lede } = flowHead(model, id);
  const split = claim === null ? { head, rest: lede } : fit(claim);
  return (
    <>
      <ScreenHead headline={split.head} item={item} outline={outline} page={page}>
        {split.rest === '' ? null : <p>{split.rest}</p>}
      </ScreenHead>
      <TeamRow model={model} teamIds={teamsBehind(model, changes)} />
      <JourneyLink flowId={id} label={model.label(id)} model={model} outline={outline} />
      {children}
      <Decisions changeIds={changes} model={model} />
      {tail}
    </>
  );
}

/** One screen for one flow, or one stepped screen with a tab for each. */
export function FlowsScreen({ ids, ...props }: BodyProps & { readonly ids: readonly string[] }) {
  const many = ids.length > 1;
  return (
    <>
      {many ? <ScreenHead outline={props.outline} page={props.page} /> : null}
      <SegTabs
        label="Flows that change"
        stepped
        tabs={ids.map((id) => ({
          key: id,
          label: props.model.label(id),
          content: <FlowPanel {...props} id={id} item={many ? props.model.label(id) : undefined} />,
        }))}
      />
    </>
  );
}
