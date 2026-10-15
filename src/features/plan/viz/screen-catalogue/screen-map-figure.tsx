import { clipText } from '@/application/plan-viz-flow-geometry';
import type {
  CatalogueCluster,
  CatalogueLine,
  CatalogueScreenBox,
} from '@/application/plan-viz-screen-catalogue';
import { Hit } from '@/features/plan/viz/flow-diagram/flow-hit';

import styles from './screen-map-figure.module.css';

const NAME_CLIP = 24;
const META_CLIP = 32;

function Screen({ box }: { readonly box: CatalogueScreenBox }) {
  return (
    <g
      className={styles.screen}
      data-journeys={box.journeys}
      data-shared-only={box.sharedOnly ? '' : undefined}
      transform={`translate(${String(box.x)} ${String(box.y)})`}
    >
      <rect className={styles.box} height={box.h} rx={10} width={box.w} />
      <text className={styles.name} x={14} y={30}>
        {clipText(box.name, NAME_CLIP)}
      </text>
      <text className={styles.meta} x={14} y={50}>
        {clipText(box.meta, META_CLIP)}
      </text>
      {box.sharedOnly ? (
        <text className={styles.note} x={14} y={70}>
          Shared navigation only
        </text>
      ) : null}
      <Hit h={box.h} inspect={box.id} label={`Open screen: ${box.name}`} w={box.w} x={0} y={0} />
    </g>
  );
}

function Line({ line, marker }: { readonly line: CatalogueLine; readonly marker: string }) {
  const { pill } = line;
  return (
    <g
      className={styles.line}
      data-journeys={line.journeys}
      data-output={line.output ? '' : undefined}
      data-shared-line={line.shared ? '' : undefined}
    >
      <path className={styles.path} d={line.path} markerEnd={`url(#${marker})`} />
      <rect className={styles.pill} height={pill.h} rx={13} width={pill.w} x={pill.x} y={pill.y} />
      <text
        className={styles.label}
        textAnchor="middle"
        x={pill.x + pill.w / 2}
        y={pill.y + pill.h / 2 + 4}
      >
        {clipText(line.label, Math.floor((pill.w - 16) / 7))}
      </text>
      <Hit
        h={pill.h}
        inspect={line.inspect}
        label={`Inspect connection: ${line.describe}`}
        w={pill.w}
        x={pill.x}
        y={pill.y}
      />
    </g>
  );
}

export interface ScreenMapFigureProps {
  readonly cluster: CatalogueCluster;
  /** Unique on the page: the arrow head the lines point with. */
  readonly marker: string;
}

/** One connected set of screens, drawn once each, with the recorded sequences between them as arrows. */
export function ScreenMapFigure({ cluster, marker }: ScreenMapFigureProps) {
  return (
    <svg
      className={styles.svg}
      height={cluster.height}
      viewBox={`0 0 ${String(cluster.width)} ${String(cluster.height)}`}
      width={cluster.width}
    >
      <defs>
        <marker id={marker} markerHeight="8" markerWidth="8" orient="auto" refX="6" refY="4">
          <path className={styles.head} d="M1,1 L6,4 L1,7" />
        </marker>
      </defs>
      {cluster.lines.map((line) => (
        <Line key={line.id} line={line} marker={marker} />
      ))}
      {cluster.screens.map((box) => (
        <Screen box={box} key={box.id} />
      ))}
    </svg>
  );
}
