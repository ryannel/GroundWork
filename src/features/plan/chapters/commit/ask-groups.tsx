import type { Model } from '@/application/plan/derive';
import { itemCount } from '@/application/plan-story-commit';
import { type AskGroup, isLate } from '@/application/plan-story-commit-ask';
import {
  type Deciding,
  firstSentenceMd,
  isDecision,
  numberOf,
  titleOf,
} from '@/application/plan-viz-decision';
import { shortDate } from '@/application/plan-viz-state';
import { teamName } from '@/application/plan-viz-teams';
import { ModelInline } from '@/features/plan/common/model-text';
import { NamedChips } from '@/features/plan/common/named-chip';
import { TeamDot } from '@/features/plan/common/team-dot';
import { Badge } from '@/ui/badge';
import { Glyph } from '@/ui/icon';

import styles from './ask-groups.module.css';

interface ItemProps {
  readonly model: Model;
  readonly e: Deciding;
}

/** What applies if nobody decides, or what is proposed. */
function Default({ model, e }: ItemProps) {
  const text = isDecision(e) ? e.decision : e.answer;
  if (text === undefined || text.trim() === '') return null;
  const hard = isDecision(e) && e.reversibility === 'one-way' ? ' · hard to reverse' : '';
  return (
    <div className={styles.default}>
      <span className={styles.faint}>
        {isDecision(e) ? `proposed${hard}` : 'if nobody decides'}
      </span>
      <span>
        <ModelInline model={model} text={firstSentenceMd(text)} />
      </span>
    </div>
  );
}

function AskItem({ model, e }: ItemProps) {
  const waiting = model.weightOf(e.id).ids;
  return (
    <li className={styles.item}>
      <div className={styles.top}>
        <button className={styles.text} data-inspect={e.id} type="button">
          <span className={styles.number}>{numberOf(model, e.id)}</span>
          <Glyph glyph={isDecision(e) ? '⚖' : '?'} />
          <span>{titleOf(e)}</span>
        </button>
        <span className={styles.when}>
          {e.decide_by === undefined ? (
            <span className={styles.faint}>no date</span>
          ) : (
            <>
              <span className={styles.faint}>decide by</span>
              <time dateTime={e.decide_by}>{shortDate(e.decide_by)}</time>
            </>
          )}
          {isLate(e) ? <Badge tone="removed">overdue</Badge> : null}
        </span>
      </div>
      {waiting.length === 0 ? null : (
        <div className={styles.blocks}>
          <span className={styles.faint}>waiting on this</span>
          <NamedChips ids={waiting} model={model} />
        </div>
      )}
      <Default e={e} model={model} />
    </li>
  );
}

function Group({ model, group }: { readonly model: Model; readonly group: AskGroup }) {
  const { decider, items } = group;
  return (
    <section className={styles.group}>
      <header className={styles.head}>
        {decider === null ? (
          <span className={styles.faint}>No decider named</span>
        ) : (
          <>
            <TeamDot model={model} named teamId={decider} />
            <button className={styles.team} data-inspect={decider} type="button">
              {teamName(model, decider)}
            </button>
          </>
        )}
        <span className={styles.count}>{itemCount(items.length)}</span>
      </header>
      <ul className={styles.list}>
        {items.map((e) => (
          <AskItem e={e} key={e.id} model={model} />
        ))}
      </ul>
    </section>
  );
}

/** What is owed, by the team that decides, with what waits on each and what applies if nobody decides. */
export function AskGroups({
  model,
  groups,
}: {
  readonly model: Model;
  readonly groups: readonly AskGroup[];
}) {
  return (
    <div className={styles.groups}>
      {groups.map((g) => (
        <Group group={g} key={g.decider ?? ''} model={model} />
      ))}
    </div>
  );
}
