'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import styles from './entry-canvas.module.css';
import { ExplorerNavigation } from './explorer-canvas';
import { TextLink } from './text';
import { useExplorerViewport } from './use-explorer-viewport';

function EntryBoard({ children }: { readonly children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const {
    viewportRef,
    zoom,
    changeZoom,
    handleFit,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useExplorerViewport(Math.max(1, size.width), Math.max(1, size.height), false);
  useEffect(() => {
    const viewport = viewportRef.current;
    const board = content.current;
    const measure = () => {
      const width = viewport?.clientWidth ?? 0;
      const height = board?.scrollHeight ?? 0;
      setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      );
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (viewport !== null) observer?.observe(viewport);
    if (board !== null) observer?.observe(board);
    measure();
    return () => {
      observer?.disconnect();
    };
  }, [viewportRef]);
  useEffect(() => {
    const style = frame.current?.style;
    if (style === undefined || size.width === 0) return;
    style.setProperty('--entry-board-width', `${String(size.width)}px`);
    style.setProperty('--entry-frame-width', `${String(size.width * zoom)}px`);
    style.setProperty('--entry-frame-height', `${String(size.height * zoom)}px`);
    style.setProperty('--entry-zoom', String(zoom));
  }, [size, zoom]);
  return (
    <div className={styles.navigation}>
      <ExplorerNavigation changeZoom={changeZoom} handleFit={handleFit} zoom={zoom} />
      <div
        aria-label="Entry flow canvas"
        className={styles.viewport}
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        ref={viewportRef}
        role="region"
      >
        <div className={styles.frame} ref={frame}>
          <div className={styles.board} ref={content}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

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
      <EntryBoard>{children}</EntryBoard>
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
        <h2>What starts it</h2>
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
export function EntryLater({ href, label }: { readonly href: string; readonly label: string }) {
  return (
    <div className={styles.later}>
      <TextLink href={href}>Later · {label} →</TextLink>
    </div>
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
