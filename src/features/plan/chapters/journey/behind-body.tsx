import Link from 'next/link';

import type { Model } from '@/application/plan/derive';
import { findPage, type Outline, pageHref, planHref } from '@/application/plan-pages';
import type { BehindOp } from '@/application/plan-story-journey-behind';
import { journeyGroups } from '@/application/plan-story-journey-groups';
import { EntityChip, EntityChips } from '@/features/plan/common/entity-chip';
import { TeamTag } from '@/features/plan/common/team-dot';
import { ScreenFigure } from '@/features/plan/viz/screens/screen-figure';
import { TintedDocument } from '@/features/plan/viz/waterfall/tinted-document';
import { Waterfall } from '@/features/plan/viz/waterfall/waterfall';

import styles from './behind-body.module.css';

interface BodyProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly op: BehindOp;
}

function Sent({ model, op }: Pick<BodyProps, 'model' | 'op'>) {
  const regions = op.screen?.focus ?? [];
  return (
    <p className={styles.sent}>
      Sent {op.when}
      {regions.length > 0 ? ' by' : ''}
      {regions.length > 0 ? <EntityChips ids={regions} model={model} /> : null}
      {op.screen === null ? null : (
        <>
          on <EntityChip id={op.screen.id} model={model} />
        </>
      )}
    </p>
  );
}

function Purges({ model, outline, op }: BodyProps) {
  const { rows, flow } = op.purges;
  if (rows.length === 0) return null;
  const group =
    flow === null ? undefined : journeyGroups(model).find((g) => g.flows.includes(flow));
  return (
    <details className={styles.fold}>
      <summary>
        What purges the caches <span className={styles.faint}>· event → layer</span>
      </summary>
      <ul className={styles.purges}>
        {rows.map((row) => (
          <li key={row.store}>
            <EntityChip id={row.store} model={model} />
            {row.events.length > 0 ? (
              <EntityChips ids={row.events} model={model} />
            ) : (
              <span className={styles.faint}>{row.expires}</span>
            )}
            {row.mechanism === '' ? null : <span className={styles.faint}>{row.mechanism}</span>}
          </li>
        ))}
      </ul>
      {group === undefined ? null : (
        <Link href={pageHref(outline, 'journey', group.key)}>See the purge</Link>
      )}
    </details>
  );
}

function Change({ outline, op }: Pick<BodyProps, 'outline' | 'op'>) {
  if (op.change === null) return null;
  const graph = findPage(outline, 'changes', 'graph');
  return (
    <p className={styles.change}>
      {graph === null ? (
        'The plan changes this'
      ) : (
        <Link href={graph.href}>The plan changes this</Link>
      )}
      : {op.change}
    </p>
  );
}

function Call({ model, op }: Pick<BodyProps, 'model' | 'op'>) {
  return (
    <p className={styles.call}>
      <span className={styles.faint}>If it is slow, call</span>
      {op.teams.map((team) => (
        <TeamTag key={team} model={model} teamId={team} />
      ))}
      {op.gateway === null ? null : (
        <span className={styles.faint}>
          · {model.label(op.gateway.team)} runs the gateway
          {op.gateway.decides ? ' and decides which subgraphs to ask' : ''}
        </span>
      )}
    </p>
  );
}

// What sits under one operation's headline: the screen that asks and the waterfall of what answers, then the
// document, what empties the caches, whom to call and how the plan changes it.
export function BehindBody({ model, outline, op }: BodyProps) {
  const seen = findPage(outline, 'today', 'graph');
  const note = op.cache?.note ?? null;
  return (
    <>
      <Sent model={model} op={op} />
      <div className={styles.top}>
        {op.screen === null ? null : (
          <div>
            <ScreenFigure
              base={planHref(outline)}
              focus={op.screen.focus}
              id={op.screen.id}
              mode="asIs"
              model={model}
              size="md"
            />
            <p className={styles.faint}>The lit part of the screen is what asks.</p>
          </div>
        )}
        <Waterfall id={op.id} mode="asIs" model={model} />
      </div>
      {op.hasDocument ? (
        <details className={styles.fold}>
          <summary>
            The operation <span className={styles.faint}>· what the front end sends</span>
          </summary>
          <TintedDocument id={op.id} mode="asIs" model={model} />
          {op.cache === null ? null : <p>{op.cache.text}</p>}
          {note === null ? null : <p className={styles.faint}>{note}</p>}
        </details>
      ) : null}
      <Purges model={model} op={op} outline={outline} />
      <Call model={model} op={op} />
      <Change op={op} outline={outline} />
      {seen === null ? null : <Link href={seen.href}>You saw this in the graph today</Link>}
    </>
  );
}
