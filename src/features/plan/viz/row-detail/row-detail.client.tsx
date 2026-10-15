'use client';

import { useId, useState, type ReactNode } from 'react';

import { Glyph } from '@/ui/icon';
import { InlineMarkdown } from '@/ui/markdown';

import styles from './row-detail.module.css';

export interface DetailButton {
  /** What the cell shows. */
  readonly text: string;
  /** Names the panel the cell opens. */
  readonly title: string;
  /** The panel's content. */
  readonly body: ReactNode;
  /** The names behind the count, for the hover card. */
  readonly names?: readonly string[];
  /** The accessible name, when "title: text" is not it. */
  readonly label?: string;
  readonly glyph?: string;
}

export interface DetailCell {
  readonly key: string;
  readonly align?: 'start' | 'end' | 'center';
  /** A plain cell. */
  readonly content?: ReactNode;
  /** A count that opens a panel. */
  readonly button?: DetailButton;
}

interface RowDetailProps {
  readonly cells: readonly DetailCell[];
  /** Every panel starts open (the team page). */
  readonly expand?: boolean;
  readonly status?: string;
  /** `data-*` attributes on the row, such as the facts a test reads back. */
  readonly attrs?: Readonly<Record<`data-${string}`, string>> | undefined;
}

const MAX_NAMES = 8;

/** The hover card behind a count: the names, one per line, then "+n more". */
function NamesCard({
  title,
  names,
}: {
  readonly title: string;
  readonly names: readonly string[];
}) {
  const list = names.filter((n) => n !== '');
  if (list.length === 0) return null;
  return (
    <span aria-hidden="true" className={styles.card}>
      <b>{title}</b>
      {list.slice(0, MAX_NAMES).map((n) => (
        <span key={n}>
          <InlineMarkdown text={n} />
        </span>
      ))}
      {list.length > MAX_NAMES ? (
        <span className={styles.more}>+{list.length - MAX_NAMES} more</span>
      ) : null}
    </span>
  );
}

function Count({
  cell,
  open,
  id,
  toggle,
}: {
  readonly cell: DetailButton;
  readonly open: boolean;
  readonly id: string;
  readonly toggle: () => void;
}) {
  return (
    <>
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-label={cell.label ?? `${cell.title}: ${cell.text}`}
        className={styles.button}
        onClick={toggle}
        type="button"
      >
        {cell.glyph === undefined ? null : (
          <span aria-hidden="true" className={styles.glyph}>
            <Glyph glyph={cell.glyph} />
          </span>
        )}
        <span className={styles.n}>{cell.text}</span>
      </button>
      <NamesCard names={cell.names ?? []} title={cell.title} />
    </>
  );
}

/**
 * A table row whose cell counts open a detail row underneath: one cell spanning every column, one panel per opened
 * cell, in column order. A count is a button, so keyboard and touch work.
 */
export function RowDetail({ cells, expand = false, status, attrs }: RowDetailProps) {
  const base = useId();
  const idOf = (key: string): string => `${base}-${key}`;
  const [open, setOpen] = useState<ReadonlySet<string>>(
    new Set(expand ? cells.filter((c) => c.button !== undefined).map((c) => c.key) : []),
  );
  const toggle = (key: string): void => {
    const next = new Set(open);
    if (!next.delete(key)) next.add(key);
    setOpen(next);
  };
  const panels = cells.filter((c) => c.button !== undefined && open.has(c.key));
  return (
    <>
      <tr {...attrs} data-status={status}>
        {cells.map((c) => (
          <td className={styles.cell} data-align={c.align} key={c.key}>
            {c.button === undefined ? (
              c.content
            ) : (
              <Count
                cell={c.button}
                id={idOf(c.key)}
                open={open.has(c.key)}
                toggle={() => {
                  toggle(c.key);
                }}
              />
            )}
          </td>
        ))}
      </tr>
      {panels.length === 0 ? null : (
        <tr className={styles.detail}>
          <td colSpan={cells.length}>
            <div className={styles.panels}>
              {panels.map((c) => (
                <section className={styles.panel} id={idOf(c.key)} key={c.key}>
                  <h4 className={styles.heading}>{c.button?.title}</h4>
                  <div>{c.button?.body}</div>
                </section>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
