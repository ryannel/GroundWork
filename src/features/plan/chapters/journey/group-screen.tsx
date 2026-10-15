import { planHref } from '@/application/plan-pages';
import { flowView } from '@/application/plan-story-journey-flow';
import { type JourneyGroup, journeyGroups } from '@/application/plan-story-journey-groups';
import { ScreenHead } from '@/features/plan/chapters/screen-head';
import { ModelInline, ModelText } from '@/features/plan/common/model-text';
import { planJsonOf } from '@/features/plan/plan-model';
import type { BodyProps } from '@/features/plan/screen-bodies';

import styles from './group-screen.module.css';
import { ScenarioWalk } from './scenario-walk.client';

const ORDER =
  'Steps follow the order the flow is drawn in; work set off by an event can finish separately.';

// A planned scenario's story, or for a flow no scenario covers, how to read the order of its steps.
function context({ model, group }: Pick<BodyProps, 'model'> & { readonly group: JourneyGroup }) {
  const scenario = model.plan.problem.scenarios?.find((s) => s.id === group.scenario);
  if (scenario !== undefined && scenario.story === undefined) return null;
  return (
    <details className={styles.context} data-keep="scenario">
      <summary>{scenario?.title ?? 'Flow context'}</summary>
      {scenario?.story === undefined ? null : <ModelText model={model} text={scenario.story} />}
      <p className={styles.order}>{ORDER}</p>
    </details>
  );
}

function headOf(props: BodyProps, flowId: string, many: boolean) {
  const { model, outline, page } = props;
  const view = flowView(model, flowId);
  return (
    <ScreenHead
      headline={view.claim}
      item={many ? model.label(flowId) : undefined}
      outline={outline}
      page={page}
    >
      {view.lines.map((line) => (
        <p key={line.label}>
          <strong>{line.label}</strong> <ModelInline model={model} text={line.text} />
        </p>
      ))}
    </ScreenHead>
  );
}

// A planned scenario, or a flow no scenario covers: walked one step at a time across every flow it runs, as it
// runs today and as it runs with the plan.
export function GroupScreen(props: BodyProps) {
  const { model, outline, page } = props;
  const group = journeyGroups(model).find((g) => g.key === page.screen);
  if (group === undefined) return null;
  const many = group.flows.length > 1;
  return (
    <>
      {many ? <ScreenHead outline={outline} page={page} /> : null}
      <ScenarioWalk
        base={planHref(outline)}
        context={context({ model, group })}
        flows={group.flows.map((id) => ({ id, option: flowView(model, id).option }))}
        href={page.href}
        heads={Object.fromEntries(group.flows.map((id) => [id, headOf(props, id, many)]))}
        src={planJsonOf(page)}
      />
    </>
  );
}
