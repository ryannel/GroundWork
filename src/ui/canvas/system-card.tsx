import type { ReactNode } from 'react';

import { Icon } from '@/ui/icon';

import { ComponentCard, ComponentCardHeader } from './component-card';
import styles from './system-card.module.css';

function SystemDetails({ name, inspect }: { readonly name: string; readonly inspect: string }) {
  return (
    <button
      aria-label={`Details of ${name}`}
      className={styles.action}
      data-inspect={inspect}
      type="button"
    >
      Details
    </button>
  );
}

/** A collapsed system has one expansion action and an optional separate way to read its details. */
export function SystemCard({
  name,
  purpose,
  meta,
  owner,
  density = 'normal',
  muted = false,
  highlighted = false,
  onExpand,
  inspect,
  details,
  children,
}: {
  readonly name: string;
  readonly purpose: string;
  readonly meta: string;
  readonly owner?: string;
  readonly density?: 'normal' | 'dense';
  readonly muted?: boolean;
  readonly highlighted?: boolean;
  readonly onExpand: () => void;
  readonly inspect?: string;
  readonly details?: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <ComponentCard
      active={false}
      muted={muted}
      highlighted={highlighted}
      footerSize="content"
      header={
        <div className={styles.header} data-density={density}>
          <ComponentCardHeader
            density={density}
            expanded={false}
            icon="system"
            kind="System"
            name={name}
            onOpen={onExpand}
            summary={purpose}
            tone="neutral"
          />
        </div>
      }
      footer={
        <div className={styles.footer}>
          <span className={styles.meta} title={meta}>
            {meta}
          </span>
          {owner === undefined || owner === '' ? null : (
            <span className={styles.owner} title={owner}>
              {owner}
            </span>
          )}
          <div className={styles.actions}>
            <button
              aria-expanded={false}
              aria-label={`Expand ${name}`}
              className={styles.action}
              onClick={onExpand}
              type="button"
            >
              <span aria-hidden="true">+</span> Expand
            </button>
            {inspect === undefined ? details : <SystemDetails inspect={inspect} name={name} />}
          </div>
        </div>
      }
    >
      {children === undefined || children === null ? null : (
        <div className={styles.activities}>{children}</div>
      )}
    </ComponentCard>
  );
}

/** The same identity remains above an expanded system, with an explicit way back to its card. */
export function SystemBoundaryHeader({
  name,
  purpose,
  dense = false,
  onCollapse,
  actions,
  inspect,
}: {
  readonly name: string;
  readonly purpose: string;
  readonly dense?: boolean;
  readonly onCollapse: () => void;
  readonly actions?: ReactNode;
  readonly inspect?: string;
}) {
  return (
    <div className={styles.boundaryHeader} data-dense={dense ? '' : undefined}>
      <div className={styles.identity}>
        <Icon name="system" />
        <h3 className={styles.name}>System · {name}</h3>
      </div>
      <span className={styles.purpose} title={purpose}>
        {purpose}
      </span>
      <div className={styles.actions}>
        {actions}
        {inspect === undefined ? null : <SystemDetails inspect={inspect} name={name} />}
        <button
          aria-expanded
          aria-label={`Collapse ${name}`}
          className={styles.action}
          onClick={onCollapse}
          type="button"
        >
          <span aria-hidden="true">−</span> Collapse
        </button>
      </div>
    </div>
  );
}
