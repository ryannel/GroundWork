import type { ReactNode } from 'react';

import styles from './entry-canvas.module.css';

/** A node canvas and its inspector share the reading width; narrow windows put details underneath. */
export function EntryCanvas({
  children,
  inspector,
  active = false,
}: {
  readonly children: ReactNode;
  readonly inspector: ReactNode;
  readonly active?: boolean;
}) {
  return (
    <div className={styles.workspace}>
      <div className={styles.board}>{children}</div>
      <aside
        aria-label="Flow inspector"
        className={styles.inspector}
        data-active={active ? '' : undefined}
      >
        <div className={styles.inspectorBody}>{inspector}</div>
      </aside>
    </div>
  );
}
export function EntryGlance({
  callers,
  component,
  effects,
}: {
  readonly callers: ReactNode;
  readonly component: ReactNode;
  readonly effects: ReactNode;
}) {
  return (
    <div aria-label="At a glance" className={styles.glance}>
      <div>
        <h2>Called by</h2>
        {callers}
      </div>
      <div>
        <h2>Handled in</h2>
        {component}
      </div>
      <div>
        <h2>Effects</h2>
        {effects}
      </div>
    </div>
  );
}
/** Natural grid wrapping stacks wide branches without changing their reading order. */
export function EntryFork({ children }: { readonly children: ReactNode }) {
  return <div className={styles.fork}>{children}</div>;
}
export function EntryBranch({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={styles.branch}>
      <p className={styles.branchLabel}>{label}</p>
      {children}
    </section>
  );
}
export function EntrySequence({ children }: { readonly children: ReactNode }) {
  return <div className={styles.sequence}>{children}</div>;
}
export function EntryGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <details className={styles.group} open>
      <summary>{title}</summary>
      {children}
    </details>
  );
}
export function EntryNode({
  title,
  kind,
  selected,
  note,
  onSelect,
}: {
  readonly title: string;
  readonly kind: string;
  readonly selected: boolean;
  readonly note?: string;
  readonly onSelect?: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={styles.node}
      data-kind={kind}
      onClick={onSelect}
      type="button"
    >
      <span className={styles.kind}>{kind}</span>
      <span className={styles.title}>{title}</span>
      {note === undefined ? null : <span className={styles.note}>{note}</span>}
    </button>
  );
}
