import { REST_MIN, registerGroups, restGroups } from '@/application/plan-story-commit';
import { askOf } from '@/application/plan-story-commit-ask';
import { DeliveryHead } from '@/features/plan/chapters/delivery/delivery-head';
import type { BodyProps } from '@/features/plan/screen-bodies';

import { AskGroups } from './ask-groups';
import { AlsoOpen, RestLine, StillOpen } from './ask-lists';
import styles from './ask-screen.module.css';
import { AskVote, VoteRule } from './ask-vote';

// 8.4: what is still to settle, by state: before approval what is owed and the vote; after it, what stays open.
export function AskScreen({ model, outline, page }: BodyProps) {
  const ask = askOf(model);
  const rest = restGroups(registerGroups(model)).flatMap((g) => g.items);
  const owed = ask.open.length > 0 && !ask.approved;
  return (
    <>
      <DeliveryHead
        chapter="commit"
        headline={ask.headline}
        model={model}
        outline={outline}
        page={page}
      >
        {ask.lede === '' ? null : <p>{ask.lede}</p>}
      </DeliveryHead>
      {owed && ask.owes !== '' ? <h3 className={styles.sub}>{ask.owes}</h3> : null}
      {owed ? <AskGroups groups={ask.groups} model={model} /> : null}
      {ask.approved ? <StillOpen model={model} open={ask.open} /> : null}
      <AskVote
        approved={ask.approved}
        delivered={ask.stage === 'delivered'}
        model={model}
        vote={ask.vote}
      />
      {ask.approved ? null : <VoteRule />}
      <AlsoOpen also={ask.also} model={model} />
      {rest.length < REST_MIN ? <RestLine items={rest} model={model} /> : null}
      {ask.closing === '' ? null : <p className={styles.closing}>{ask.closing}</p>}
    </>
  );
}
