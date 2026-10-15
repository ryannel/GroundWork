import type { Model } from '@/application/plan/derive';
import { possessive } from '@/application/plan-story-cover-standing';
import {
  otherChanges,
  type StepChange,
  type StepKind,
  type TeamPart,
} from '@/application/plan-story-part';
import { teamName } from '@/application/plan-viz-teams';
import { numWord } from '@/application/plan-viz-text';
import { EntityChip, EntityChips } from '@/features/plan/common/entity-chip';
import { Badge, type BadgeTone } from '@/ui/badge';

import { PartSection } from './part-section';
import styles from './team-steps.module.css';

const KIND: Readonly<Record<StepKind, { tone: BadgeTone; word: string }>> = {
  new: { tone: 'added', word: 'new step' },
  differently: { tone: 'modified', word: 'works differently' },
  rerouted: { tone: 'modified', word: 'calls differently' },
  removed: { tone: 'removed', word: 'removed' },
};

function StepRow({ model, step }: { readonly model: Model; readonly step: StepChange }) {
  const { tone, word } = KIND[step.kind];
  const route = [step.from, step.to]
    .flatMap((id) => (id === null ? [] : [model.label(id)]))
    .join(' → ');
  const same =
    step.sameCall && step.caller !== null && step.via !== null
      ? `; ${model.label(step.caller)} calls ${model.label(step.via)} the same way`
      : '';
  return (
    <li className={styles.step}>
      <Badge tone={tone}>{word}</Badge>
      <EntityChip id={step.id} label={step.action} model={model} />
      <span className={styles.who}>
        {route}
        {same}
      </span>
    </li>
  );
}

function Flow({
  model,
  flow,
  steps,
}: {
  readonly model: Model;
  readonly flow: string;
  readonly steps: readonly StepChange[];
}) {
  return (
    <li className={styles.flow}>
      <EntityChip id={flow} model={model} />
      <ul className={styles.steps}>
        {steps.map((s) => (
          <StepRow key={s.id} model={model} step={s} />
        ))}
      </ul>
    </li>
  );
}

function NewFlow({
  model,
  team,
  flow,
  steps,
}: {
  readonly model: Model;
  readonly team: string;
  readonly flow: string;
  readonly steps: readonly StepChange[];
}) {
  const mine =
    steps.length === 1 ? 'one of its steps is' : `${numWord(steps.length)} of its steps are`;
  return (
    <li className={styles.step}>
      <Badge tone="added">new flow</Badge>
      <EntityChip id={flow} model={model} />
      <span className={styles.who}>
        {mine} {possessive(teamName(model, team))}
      </span>
    </li>
  );
}

const group = (steps: readonly StepChange[]): Map<string, StepChange[]> => {
  const byFlow = new Map<string, StepChange[]>();
  for (const s of steps) byFlow.set(s.flow, [...(byFlow.get(s.flow) ?? []), s]);
  return byFlow;
};

// Where the plan changes the team's steps, each placed in its flow, and changes no step shows.
export function LandsIn({
  model,
  team,
  part,
}: {
  readonly model: Model;
  readonly team: string;
  readonly part: TeamPart;
}) {
  const rest = otherChanges(model, part);
  if (part.steps.length === 0 && rest.length === 0) return null;
  const flows = [...group(part.steps)];
  const isNew = ([flow]: [string, unknown]): boolean => model.status(flow) === 'added';
  const added = flows.filter(isNew);
  const existing = flows.filter((f) => !isNew(f));
  return (
    <PartSection title="What changes for you">
      <ul className={styles.flows}>
        {existing.map(([flow, steps]) => (
          <Flow flow={flow} key={flow} model={model} steps={steps} />
        ))}
        {added.length === 0 ? null : (
          <li className={styles.flow}>
            <span className={styles.newHead}>New flows</span>
            <ul className={styles.steps}>
              {added.map(([flow, steps]) => (
                <NewFlow flow={flow} key={flow} model={model} steps={steps} team={team} />
              ))}
            </ul>
          </li>
        )}
      </ul>
      {rest.length === 0 ? null : (
        <div className={styles.rest}>
          <span className={styles.who}>{part.steps.length === 0 ? 'Changes' : 'Also changes'}</span>
          <EntityChips ids={rest} model={model} />
        </div>
      )}
    </PartSection>
  );
}
