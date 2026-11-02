import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/ui/icon';

import styles from './component-card.module.css';

export type CardTone = 'api' | 'data' | 'events' | 'shared' | 'app' | 'job' | 'neutral';

/**
 * A component on the area map: a header naming it, then one titled section per kind of thing it offers or
 * holds. Heights are fixed (see `area-map/card-geometry.ts`) so lines land on the row they name.
 */
export function ComponentCard({
  active,
  muted = false,
  highlighted = false,
  header,
  children,
  footer,
  footerSize = 'fixed',
}: {
  readonly active: boolean;
  readonly muted?: boolean;
  readonly highlighted?: boolean;
  readonly header: ReactNode;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly footerSize?: 'fixed' | 'content';
}) {
  return (
    <section
      className={styles.card}
      data-muted={muted ? '' : undefined}
      data-active={active ? '' : undefined}
      data-flow={highlighted ? '' : undefined}
    >
      {header}
      {children}
      {footer === undefined ? null : (
        <div className={styles.footer} data-size={footerSize}>
          {footer}
        </div>
      )}
    </section>
  );
}

export function ComponentCardHeader({
  compact = false,
  density = 'normal',
  icon,
  tone,
  kind,
  name,
  summary,
  onOpen,
  inspect,
  expanded,
}: {
  readonly compact?: boolean;
  readonly density?: 'normal' | 'dense';
  readonly icon: IconName;
  readonly tone: CardTone;
  readonly kind: string;
  readonly name: string;
  readonly summary: string;
  readonly onOpen?: () => void;
  readonly inspect?: string;
  readonly expanded?: boolean;
}) {
  return (
    <button
      data-compact={compact ? '' : undefined}
      data-density={density}
      data-inspect={inspect}
      data-tone={tone}
      aria-label={name}
      aria-expanded={expanded}
      className={styles.header}
      onClick={onOpen}
      title={summary === '' ? name : `${name} — ${summary}`}
      type="button"
    >
      <span aria-hidden="true" className={styles.tile} data-size="lg" data-tone={tone}>
        <Icon name={icon} />
      </span>
      <span className={styles.heading}>
        <span className={styles.kind}>{kind}</span>
        <span className={styles.name}>{name}</span>
        <span className={styles.summary}>{summary}</span>
      </span>
    </button>
  );
}

/**
 * What a card holds, counted by kind, as one toggle. Closed, it is all the card shows below its header, and
 * lines land on the card; open, the sections follow and lines fan out to the rows they use.
 */
export function ComponentCardContents({
  name,
  open,
  items,
  onToggle,
}: {
  readonly name: string;
  readonly open: boolean;
  readonly items: readonly {
    readonly key: string;
    readonly icon: IconName;
    readonly tone: CardTone;
    readonly label: string;
    readonly count: number;
  }[];
  readonly onToggle: () => void;
}) {
  const described = items.map((item) => `${String(item.count)} ${item.label}`).join(', ');
  return (
    <button
      aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} what ${name} holds: ${described}`}
      className={styles.contents}
      onClick={onToggle}
      title={described}
      type="button"
    >
      {items.map((item) => (
        <span className={styles.chip} data-tone={item.tone} key={item.key}>
          <Icon name={item.icon} />
          {item.count}
        </span>
      ))}
      <span aria-hidden="true" className={styles.toggle}>
        {open ? 'Hide ▴' : 'Show ▾'}
      </span>
    </button>
  );
}

export function ComponentCardSection({
  tone,
  icon,
  label,
  count,
  children,
}: {
  readonly tone: CardTone;
  readonly icon: IconName;
  readonly label: string;
  readonly count: number;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.section} data-tone={tone}>
      <div className={styles.sectionHeading}>
        <Icon name={icon} />
        <span>{label}</span>
        <span className={styles.count}>{count}</span>
      </div>
      {children}
    </div>
  );
}

/** One group of API operations: the protocol as a badge, the resource path, and its versions. */
export function ComponentCardApiRow({
  protocol,
  path,
  versions,
  operations,
  active,
  onSelect,
}: {
  readonly protocol: string;
  readonly path: string;
  readonly versions: string;
  readonly operations: number;
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  const count = `${String(operations)} ${operations === 1 ? 'operation' : 'operations'}`;
  const label = [protocol, path, versions, count].filter((part) => part !== '').join(' · ');
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={styles.apiRow}
      onClick={onSelect}
      title={label}
      type="button"
    >
      <span className={styles.badge}>{protocol}</span>
      <span className={styles.path}>{path}</span>
      <span className={styles.meta}>
        {[versions, `${String(operations)} ${operations === 1 ? 'op' : 'ops'}`]
          .filter((part) => part !== '')
          .join(' · ')}
      </span>
    </button>
  );
}

/** A store or topic the component owns: a tinted icon, its name and its technology. */
export function ComponentCardResourceRow({
  icon,
  tone,
  name,
  detail,
  resource,
  active,
  onSelect,
}: {
  readonly icon: IconName;
  readonly tone: CardTone;
  readonly name: string;
  readonly detail: string;
  readonly resource: string;
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      aria-label={`${name} ${detail}`}
      aria-pressed={active}
      className={styles.resourceRow}
      data-component={resource}
      onClick={onSelect}
      title={`${name} · ${detail}`}
      type="button"
    >
      <span aria-hidden="true" className={styles.tile} data-tone={tone}>
        <Icon name={icon} />
      </span>
      <span className={styles.resourceText}>
        <span className={styles.resourceName}>{name}</span>
        <span className={styles.resourceDetail}>{detail}</span>
      </span>
    </button>
  );
}

/** A store or topic another component owns; drawn small, since its own card holds the detail. The detail is
 * the full description, for the tooltip and screen readers. */
export function ComponentCardSharedRow({
  icon,
  tone,
  name,
  detail,
  onSelect,
}: {
  readonly icon: IconName;
  readonly tone: CardTone;
  readonly name: string;
  readonly detail: string;
  readonly onSelect: () => void;
}) {
  return (
    <button
      aria-label={detail}
      className={styles.sharedRow}
      onClick={onSelect}
      title={detail}
      type="button"
    >
      <span aria-hidden="true" className={styles.tile} data-size="sm" data-tone={tone}>
        <Icon name={icon} />
      </span>
      <span className={styles.path}>{name}</span>
      <span aria-hidden="true" className={styles.meta}>
        ↗
      </span>
    </button>
  );
}
