import type { ReactNode } from 'react';

import { Icon } from '@/ui/icon';

import {
  type CardSelection,
  ComponentCard,
  ComponentCardDetails,
  ComponentCardHeader,
} from './component-card';
import styles from './system-card.module.css';

/** A collapsed system has one expansion action and an optional separate way to read its details. */
export function SystemCard({
  name,
  purpose,
  meta,
  owner,
  density = 'normal',
  kind = 'System',
  muted = false,
  highlighted = false,
  onExpand,
  selection,
  inspect,
  details,
  children,
}: {
  readonly name: string;
  readonly purpose: string;
  readonly meta: string;
  readonly owner?: string;
  readonly density?: 'normal' | 'dense';
  readonly kind?: 'System' | 'Area';
  readonly muted?: boolean;
  readonly highlighted?: boolean;
  readonly onExpand: () => void;
  readonly selection?: CardSelection | undefined;
  readonly inspect?: string;
  readonly details?: ReactNode;
  readonly children?: ReactNode;
}) {
  return (
    <ComponentCard
      active={false}
      muted={muted}
      highlighted={highlighted}
      selection={selection}
      footerSize="content"
      header={
        <div
          className={styles.body}
          data-density={density}
          data-kind={kind}
          data-selectable={selection === undefined ? undefined : ''}
        >
          <div className={styles.header}>
            <ComponentCardHeader
              density={density}
              expanded={false}
              selection={selection}
              icon={kind === 'Area' ? 'concept' : 'system'}
              kind={kind}
              name={name}
              onOpen={onExpand}
              summary={purpose}
              tone="neutral"
              wrapName={kind === 'Area'}
            />
          </div>
          {children === undefined || children === null ? null : (
            <div className={styles.activities}>{children}</div>
          )}
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
            {inspect === undefined ? (
              details
            ) : (
              <ComponentCardDetails className={styles.action} inspect={inspect} name={name} />
            )}
          </div>
        </div>
      }
    />
  );
}

/** The same identity remains above an expanded system, with an explicit way back to its card. */
export function SystemBoundaryHeader({
  name,
  purpose,
  dense = false,
  kind = 'System',
  onCollapse,
  selection,
  actions,
  inspect,
}: {
  readonly name: string;
  readonly purpose: string;
  readonly dense?: boolean;
  readonly kind?: 'System' | 'Area';
  readonly onCollapse: () => void;
  readonly selection?: CardSelection | undefined;
  readonly actions?: ReactNode;
  readonly inspect?: string;
}) {
  return (
    <div className={styles.boundaryHeader} data-dense={dense ? '' : undefined}>
      <div className={styles.identity}>
        <Icon name={kind === 'Area' ? 'concept' : 'system'} />
        <h3 className={styles.name}>
          {selection === undefined ? (
            <>
              {kind} · {name}
            </>
          ) : (
            <button
              aria-pressed={selection.pressed}
              className={styles.areaSelection}
              onClick={() => {
                selection.toggle();
              }}
              type="button"
            >
              {kind} · {name}
            </button>
          )}
        </h3>
      </div>
      <span className={styles.purpose} title={purpose}>
        {purpose}
      </span>
      <div className={styles.actions}>
        {actions}
        {inspect === undefined ? null : (
          <ComponentCardDetails className={styles.action} inspect={inspect} name={name} />
        )}
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
