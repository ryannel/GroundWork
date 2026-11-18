import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/ui/icon';

import styles from './component-card.module.css';

export interface CardSelection {
  readonly pressed: boolean;
  readonly toggle: () => void;
}

export type CardTone = 'api' | 'data' | 'events' | 'shared' | 'app' | 'job' | 'neutral';

/**
 * A component on the area map: a header naming it, then one titled section per kind of thing it offers or
 * holds. Heights are fixed (see `area-map/card-geometry.ts`) so lines land on the row they name.
 */
export function ComponentCard({
  active,
  muted = false,
  highlighted = false,
  selection,
  header,
  children,
  footer,
  footerSize = 'fixed',
}: {
  readonly active: boolean;
  readonly muted?: boolean;
  readonly highlighted?: boolean;
  readonly selection?: CardSelection | undefined;
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
      data-flow={highlighted || selection?.pressed === true ? '' : undefined}
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
  selection,
  wrapName = false,
}: {
  readonly compact?: boolean;
  readonly density?: 'normal' | 'dense';
  readonly icon: IconName;
  readonly tone: CardTone;
  readonly kind: string;
  readonly name: string;
  readonly summary: string;
  readonly onOpen?: () => void;
  readonly inspect?: string | undefined;
  readonly expanded?: boolean;
  readonly selection?: CardSelection | undefined;
  readonly wrapName?: boolean;
}) {
  return (
    <button
      data-compact={compact ? '' : undefined}
      data-density={density}
      data-inspect={inspect}
      data-tone={tone}
      aria-label={name}
      aria-expanded={selection === undefined ? expanded : undefined}
      aria-pressed={selection?.pressed}
      className={styles.header}
      onClick={selection?.toggle ?? onOpen}
      title={summary === '' ? name : `${name} — ${summary}`}
      type="button"
    >
      <span aria-hidden="true" className={styles.tile} data-size="lg" data-tone={tone}>
        <Icon name={icon} />
      </span>
      <span className={styles.heading}>
        <span className={styles.kind}>{kind}</span>
        <span className={styles.name} data-wrap={wrapName ? '' : undefined}>
          {name}
        </span>
        <span className={styles.summary}>{summary}</span>
      </span>
    </button>
  );
}

export function ComponentCardDetails({
  name,
  inspect,
  onOpen,
  className = styles.headerDetails,
}: {
  readonly name: string;
  readonly inspect?: string | undefined;
  readonly onOpen?: (() => void) | undefined;
  readonly className?: string | undefined;
}) {
  return (
    <button
      aria-label={`Details of ${name}`}
      className={className}
      data-inspect={inspect}
      onClick={onOpen}
      type="button"
    >
      Details
    </button>
  );
}

export function ComponentCardHeaderActions({ children }: { readonly children: ReactNode }) {
  return <div className={styles.headerActions}>{children}</div>;
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

/** One group of API operations: the protocol as a badge, the resource path, and how many operations it holds. */
export function ComponentCardApiRow({
  protocol,
  path,
  operations,
  inspect,
  ports,
  active,
  onSelect,
}: {
  readonly protocol: string;
  readonly path: string;
  readonly operations: number;
  readonly inspect?: string | undefined;
  /** The endpoint ids behind this row, so resting on it can light just their lines. */
  readonly ports?: readonly string[];
  readonly active: boolean;
  readonly onSelect: () => void;
}) {
  const unit = operations === 1 ? 'operation' : 'operations';
  const shortUnit = operations === 1 ? 'op' : 'ops';
  const count = operations === 0 ? '' : `${String(operations)} ${unit}`;
  const shortCount = operations === 0 ? '' : `${String(operations)} ${shortUnit}`;
  const label = [protocol, path, count].filter((part) => part !== '').join(' · ');
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={styles.apiRow}
      data-inspect={inspect}
      data-port={ports === undefined || ports.length === 0 ? undefined : ports.join(' ')}
      onClick={onSelect}
      title={label}
      type="button"
    >
      <span className={styles.badge} hidden={protocol === ''}>
        {protocol}
      </span>
      <span className={styles.path}>{path}</span>
      <span className={styles.meta}>{shortCount}</span>
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
      aria-label={detail === '' ? name : `${name} ${detail}`}
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

/** A resource reference explains where selecting it will lead, including unplaced resources. */
export function ComponentCardSharedRow({
  icon,
  tone,
  name,
  detail,
  location,
  active,
  disabled,
  onSelect,
}: {
  readonly icon: IconName;
  readonly tone: CardTone;
  readonly name: string;
  readonly detail: string;
  readonly location: string;
  readonly active: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      aria-label={detail}
      aria-pressed={active}
      className={styles.sharedRow}
      disabled={disabled}
      onClick={onSelect}
      title={detail}
      type="button"
    >
      <span aria-hidden="true" className={styles.tile} data-size="sm" data-tone={tone}>
        <Icon name={icon} />
      </span>
      <span className={styles.resourceText}>
        <span className={styles.resourceName}>{name}</span>
        <span className={styles.resourceDetail}>{location}</span>
      </span>
      {disabled ? null : (
        <span aria-hidden="true" className={styles.meta}>
          →
        </span>
      )}
    </button>
  );
}
