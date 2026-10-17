import type { Model } from '@/application/plan/derive';
import { gateTitle, heldUp, isApproved } from '@/application/plan-story-cover-standing';
import type { TeamPart } from '@/application/plan-story-part';
import type { Deciding } from '@/application/plan-viz-decision';
import { handlingOf } from '@/application/plan-viz-risks';
import { shortDate } from '@/application/plan-viz-state';
import { teamName } from '@/application/plan-viz-teams';
import type { Risk } from '@/domain/plan/plan.generated';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { NamedChips } from '@/features/plan/common/named-chip';
import { VoteTiles } from '@/features/plan/viz/vote/vote-tiles';

import { PartSection } from './part-section';
import styles from './team-gates.module.css';

interface GatesProps {
  readonly model: Model;
  readonly team: string;
  readonly part: TeamPart;
}

const MOST_HELD = 3;
const today = (): string => new Date().toISOString().slice(0, 10);

function Gate({
  model,
  gate,
  held,
  who,
}: {
  readonly model: Model;
  readonly gate: Deciding;
  readonly held: readonly string[];
  readonly who: boolean;
}) {
  return (
    <li className={styles.gate}>
      <EntityChip id={gate.id} label={gateTitle(gate)} model={model} />
      <span className={styles.meta}>
        {gate.decide_by === undefined
          ? 'no date'
          : `decide by ${shortDate(gate.decide_by, model.today)}`}
        {who && gate.decider !== undefined ? ` · ${teamName(model, gate.decider)} decides` : ''}
      </span>
      {held.length === 0 ? null : (
        <span className={styles.held}>
          waiting on it
          <NamedChips ids={held.slice(0, MOST_HELD)} model={model} />
          {held.length > MOST_HELD ? `+${String(held.length - MOST_HELD)}` : null}
        </span>
      )}
    </li>
  );
}

function RiskRow({ model, risk }: { readonly model: Model; readonly risk: Risk }) {
  const decision = (model.plan.decisions ?? []).find((d) => d.id === risk.accepted_by);
  const decider =
    decision?.decider === undefined ? '' : ` · ${teamName(model, decision.decider)} decides`;
  return (
    <li className={styles.gate}>
      <EntityChip id={risk.id} model={model} />
      <span className={styles.meta}>
        {handlingOf(model, risk)}
        {decider}
      </span>
    </li>
  );
}

function Group({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className={styles.group}>
      <h4 className={styles.title}>{title}</h4>
      <ul className={styles.list}>{children}</ul>
    </div>
  );
}

function Groups({ model, team, part }: GatesProps) {
  const name = teamName(model, team);
  return (
    <>
      {part.decides.length === 0 ? null : (
        <Group title={`${name} decides`}>
          {part.decides.map((e) => (
            <Gate gate={e} held={heldUp(model, e.id)} key={e.id} model={model} who={false} />
          ))}
        </Group>
      )}
      {part.waitsOn.length === 0 ? null : (
        <Group title="Waits on others">
          {part.waitsOn.map(({ gate, held }) => (
            <Gate gate={gate} held={held} key={gate.id} model={model} who />
          ))}
        </Group>
      )}
      {part.risksOn.length === 0 ? null : (
        <Group title={`Risks ${name} owns`}>
          {part.risksOn.map((r) => (
            <RiskRow key={r.id} model={model} risk={r} />
          ))}
        </Group>
      )}
    </>
  );
}

// What the team decides, waits on and owns before the plan is approved, and its own confidence rating.
export function BeforeApproval({ model, team, part }: GatesProps) {
  const approved = isApproved(part.stage);
  const showVote = part.vote !== null && !part.low && !approved;
  const count =
    part.decides.length + part.waitsOn.length + part.risksOn.length + part.alsoOpen.length;
  if (count === 0 && !showVote) return null;
  const late = part.decides.some(
    (e) => e.decide_by !== undefined && e.decide_by.localeCompare(today()) < 0,
  );
  return (
    <PartSection title={approved ? 'Still open' : 'Before approval'} warn={part.low || late}>
      <Groups model={model} part={part} team={team} />
      {part.alsoOpen.length === 0 ? null : (
        <p className={styles.also}>
          Also open, with nothing waiting on {part.alsoOpen.length === 1 ? 'it' : 'them'}:{' '}
          <NamedChips ids={part.alsoOpen.map((q) => q.id)} model={model} />
        </p>
      )}
      {showVote ? <VoteTiles model={model} teams={[team]} /> : null}
    </PartSection>
  );
}
