import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import {
  channelOf,
  nameOf,
  OWNER_COLUMNS,
  ownerFacts,
  ownerLists,
  type OwnerColumn,
  type OwnerKey,
  type OwnerLists,
  workText,
} from '@/application/plan-viz-owners';
import { teamIndex, teamName } from '@/application/plan-viz-teams';
import { voteSummary, voteText } from '@/application/plan-viz-vote';
import { EntityChips } from '@/features/plan/common/entity-chip';
import { NamedChips } from '@/features/plan/common/named-chip';
import { TeamDot, TeamTag } from '@/features/plan/common/team-dot';
import { NoneMark, TestButton } from '@/features/plan/common/test-button';
import { RowDetail, type DetailCell } from '@/features/plan/viz/row-detail/row-detail.client';

import styles from './ownership-table.module.css';

interface OwnershipTableProps {
  readonly model: Model;
  /** The rows, in the order given: the plan's teams, in lane order. */
  readonly teamIds: readonly string[];
  /** Every count starts open (the team page). */
  readonly expand?: boolean | undefined;
  /** A team id: other teams' rows dim. */
  readonly lens?: string | undefined;
  /** The team name opens the team (off on the team page itself). */
  readonly link?: boolean | undefined;
  /** Drops things from the lists. */
  readonly hide?: ((id: string) => boolean) | undefined;
}

const NAMED = new Set<OwnerKey>(['chg', 'wi', 'dec']);

function Body({
  model,
  k,
  ids,
}: {
  readonly model: Model;
  readonly k: OwnerKey;
  readonly ids: readonly string[];
}) {
  if (k === 'tst') {
    return (
      <div className={styles.tests}>
        {ids.map((id) => (
          <TestButton id={id} key={id} level model={model} />
        ))}
      </div>
    );
  }
  return NAMED.has(k) ? (
    <NamedChips ids={ids} model={model} />
  ) : (
    <EntityChips ids={ids} model={model} />
  );
}

function countCell(
  model: Model,
  c: OwnerColumn & { readonly key: OwnerKey },
  lists: OwnerLists,
): DetailCell {
  const ids = lists[c.key];
  if (ids.length === 0) return { key: c.key, content: <NoneMark title={`No ${c.head}`} /> };
  const text = c.key === 'wi' ? workText(model, ids) : String(ids.length);
  return {
    key: c.key,
    button: {
      text,
      title: c.title,
      body: <Body ids={ids} k={c.key} model={model} />,
      names: ids.map((id) => nameOf(model, id)),
      label: `${c.title}: ${text}`,
    },
  };
}

function voteCell(model: Model, team: string, low: boolean): DetailCell {
  const vote = voteText(model, team);
  if (vote === '') {
    return {
      key: 'vote',
      content: <NoneMark title="This team has no work, so it does not rate its confidence" />,
    };
  }
  return {
    key: 'vote',
    content: (
      <span className={styles.vote} data-low={low ? '' : undefined}>
        {vote}
      </span>
    ),
  };
}

function Head({
  model,
  team,
  link,
}: {
  readonly model: Model;
  readonly team: string;
  readonly link: boolean;
}) {
  const channel = channelOf(model, team);
  return (
    <span className={styles.head}>
      {link ? (
        <TeamTag model={model} teamId={team} />
      ) : (
        <span className={styles.name}>
          <TeamDot model={model} teamId={team} />
          {teamName(model, team)}
        </span>
      )}
      {channel === '' ? null : <span className={styles.channel}>{channel}</span>}
    </span>
  );
}

function Row({
  model,
  team,
  options,
  low,
}: {
  readonly model: Model;
  readonly team: string;
  readonly options: Pick<OwnershipTableProps, 'expand' | 'lens' | 'link' | 'hide'>;
  readonly low: boolean;
}): ReactNode {
  const lists = ownerLists(model, team, { hide: options.hide });
  const cells: DetailCell[] = [
    { key: 'team', content: <Head link={options.link ?? true} model={model} team={team} /> },
    ...OWNER_COLUMNS.map((c) =>
      c.key === 'vote' ? voteCell(model, team, low) : countCell(model, { ...c, key: c.key }, lists),
    ),
  ];
  const channel = channelOf(model, team);
  const dim = options.lens !== undefined && options.lens !== team;
  return (
    <RowDetail
      attrs={{
        'data-facts': ownerFacts(model, team, lists),
        'data-facts-of': `own:${team}`,
        'data-search': [teamName(model, team), team, channel]
          .filter((s) => s !== '')
          .join(' ')
          .toLowerCase(),
        'data-team-idx': String(teamIndex(model, team)),
        ...(dim ? { 'data-dim': '' } : {}),
      }}
      cells={cells}
      {...(options.expand === undefined ? {} : { expand: options.expand })}
    />
  );
}

/**
 * The ownership table: a row for each team, a column for each kind of thing it owns or decides. A count opens the
 * names as chips; zero is a faint dot. The teams page and the team page draw it the same way.
 */
export function OwnershipTable({
  model,
  teamIds,
  expand,
  lens,
  link = true,
  hide,
}: OwnershipTableProps) {
  if (teamIds.length === 0) return <p className={styles.empty}>No teams in this plan.</p>;
  const low = new Set(voteSummary(model).low);
  return (
    <div className={styles.wrap}>
      <table aria-label="Who owns what" className={styles.table}>
        <thead>
          <tr>
            <th scope="col">team</th>
            {OWNER_COLUMNS.map((c) => (
              <th key={c.key} scope="col">
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teamIds.map((team) => (
            <Row
              key={team}
              low={low.has(team)}
              model={model}
              options={{ expand, lens, link, hide }}
              team={team}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
