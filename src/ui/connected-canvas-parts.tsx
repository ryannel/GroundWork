import type { ReactNode } from 'react';

import styles from './connected-canvas-parts.module.css';

export function CanvasComponentDetail({
  header,
  children,
  footer,
}: {
  readonly header: ReactNode;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}) {
  return (
    <section className={styles.componentDetail}>
      <div className={styles.componentHeader}>{header}</div>
      <div className={styles.componentBody}>{children}</div>
      {footer === undefined ? null : <div className={styles.componentFooter}>{footer}</div>}
    </section>
  );
}

export function CanvasAttachmentGrid({ children }: { readonly children: ReactNode }) {
  return <div className={styles.attachmentGrid}>{children}</div>;
}

export function CanvasAttachment({ children }: { readonly children: ReactNode }) {
  return <div className={styles.attachment}>{children}</div>;
}

export function CanvasInspectorSection({ children }: { readonly children: ReactNode }) {
  return <section className={styles.inspectorSection}>{children}</section>;
}

export function CanvasEndpointChoice({
  active,
  children,
  onClick,
}: {
  readonly active: boolean;
  readonly children: ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button aria-pressed={active} className={styles.endpointChoice} onClick={onClick} type="button">
      {children}
    </button>
  );
}

export function CanvasContractGrid({ children }: { readonly children: ReactNode }) {
  return <div className={styles.contractGrid}>{children}</div>;
}

export function CanvasDependencyArrow({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.dependencyArrow}>
      <span aria-hidden="true" className={styles.dependencyLine} />
      {children}
    </div>
  );
}

/** A stable identity tint shared by a system boundary and every component it contains. */
export function CanvasSystemScope({
  colour,
  children,
}: {
  readonly colour: number;
  readonly children: ReactNode;
}) {
  return (
    <g className={styles.systemScope} data-colour={colour}>
      {children}
    </g>
  );
}

export function CanvasBoundary({
  x,
  y,
  width,
  height,
  header,
  headerHeight = 70,
}: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly header: ReactNode;
  readonly headerHeight?: number;
}) {
  return (
    <>
      <rect
        className={styles.boundary}
        height={height}
        width={width}
        x={x}
        y={y}
        vectorEffect="non-scaling-stroke"
      />
      <foreignObject
        height={headerHeight}
        pointerEvents="auto"
        width={width - 32}
        x={x + 16}
        y={y + 10}
      >
        <div className={styles.boundaryHeader}>{header}</div>
      </foreignObject>
    </>
  );
}
