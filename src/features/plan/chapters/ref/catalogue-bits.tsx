import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import { SHOWS, type Show } from '@/application/reference/model';
import { Catalogue } from '@/features/plan/chapters/ref/catalogue.client';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamDot } from '@/features/plan/common/team-dot';
import { ChipList } from '@/ui/chip';

import styles from './catalogue-bits.module.css';

/** What every catalogue is given. */
export interface CatProps {
  readonly model: Model;
  /** Every team's name, by id. */
  readonly teams: Readonly<Record<string, string>>;
  /** Read outside any plan: one page as the system runs today, with no switch and no status. */
  readonly today?: boolean | undefined;
  /** The model's address relative to the page, for what a catalogue draws only when it is opened. */
  readonly src: string;
  /** The team the address cuts the page to (`?team=`), or null for everyone. */
  readonly lens?: string | null | undefined;
}

/** The attributes a row carries so the filter box and the team lens can find it. */
export const rowAttrs = (
  search: string,
  teams: string,
  faded = false,
): {
  readonly 'data-search': string;
  readonly 'data-teams': string;
  readonly 'data-faded'?: string;
} => ({
  'data-search': search,
  'data-teams': teams,
  ...(faded ? { 'data-faded': '' } : {}),
});

/** A thing as a chip; outside the diff it carries no status, as nothing has changed there. */
export function RefChip({
  model,
  id,
  quiet,
}: {
  readonly model: Model;
  readonly id: string;
  readonly quiet: boolean;
}) {
  return quiet ? (
    <EntityChip id={id} model={model} status="existing" />
  ) : (
    <EntityChip id={id} model={model} />
  );
}

/** A wrapping row of chips, or a dash when there are none. */
export function RefChips({
  model,
  ids,
  quiet,
}: {
  readonly model: Model;
  readonly ids: readonly string[];
  readonly quiet: boolean;
}) {
  if (ids.length === 0) return <span className={styles.none}>—</span>;
  return (
    <ChipList>
      {[...new Set(ids)].map((id) => (
        <RefChip id={id} key={id} model={model} quiet={quiet} />
      ))}
    </ChipList>
  );
}

interface GroupProps {
  readonly title: ReactNode;
  readonly count?: number;
  readonly note?: string;
  /** The team whose colour leads the heading. */
  readonly team?: { readonly model: Model; readonly id: string } | undefined;
  readonly children: ReactNode;
}

/** A titled group of rows; the filter box hides it when none of its rows match. */
export function Group({ title, count, note, team, children }: GroupProps) {
  return (
    <section className={styles.group} data-group>
      <h3 className={styles.groupHead}>
        {team === undefined ? null : <TeamDot model={team.model} teamId={team.id} />}
        {title}
        {count === undefined ? null : <span className={styles.count}>{count}</span>}
        {note === undefined ? null : <span className={styles.note}>{note}</span>}
      </h3>
      {children}
    </section>
  );
}

/** A column of blocks. */
export function Stack({ children }: { readonly children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>;
}

/** A group a reader opens: a summary and a list. */
export function Fold({
  summary,
  children,
}: {
  readonly summary: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <details className={styles.fold} data-group>
      <summary>{summary}</summary>
      <ul>{children}</ul>
    </details>
  );
}

/** A grid of cards. */
export function Cards({ children }: { readonly children: ReactNode }) {
  return <div className={styles.cards}>{children}</div>;
}

/** A table that folds to labelled rows when narrow. */
export function RefTable({
  head,
  children,
}: {
  readonly head: readonly string[];
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** A table cell that names its column when the row folds. */
export function Cell({
  label,
  children,
  wide = false,
}: {
  readonly label: string;
  readonly children?: ReactNode;
  readonly wide?: boolean;
}) {
  return (
    <td data-label={label} data-wide={wide ? '' : undefined}>
      {children}
    </td>
  );
}

function Empty({ children }: { readonly children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

interface PagesProps {
  readonly model: Model;
  readonly noun: string;
  readonly teams: Readonly<Record<string, string>>;
  /** The blocks of a mode's page; none says `empty`. */
  readonly render: (show: Show) => readonly ReactNode[];
  readonly empty: string;
  /** True for a catalogue that reads differently today and with the plan. */
  readonly modes: boolean;
  readonly search?: boolean;
  /** Outside any plan: only today's page. */
  readonly today?: boolean | undefined;
}

/** A catalogue in the shell: one page per mode, or one page for all. */
export function Pages({
  noun,
  teams,
  render,
  empty,
  modes,
  search = true,
  today = false,
}: PagesProps) {
  const body = (show: Show): ReactNode => {
    const blocks = render(show);
    return blocks.length === 0 ? <Empty>{empty}</Empty> : blocks;
  };
  const many: readonly Show[] = modes ? SHOWS : ['diff'];
  const shows: readonly Show[] = today ? ['asis'] : many;
  const bodies: Partial<Record<Show, ReactNode>> = Object.fromEntries(
    shows.map((s) => [s, body(s)]),
  );
  return <Catalogue bodies={bodies} noun={noun} search={search} teams={teams} />;
}
