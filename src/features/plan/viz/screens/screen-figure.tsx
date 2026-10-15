import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { ProposedMarks } from '@/application/plan/proposed';
import {
  type FigureData,
  type FigureGhost,
  type FigureOptions,
  type FigureRegion,
  figureOf,
} from '@/application/plan-viz-screens';
import { Icon } from '@/ui/icon';

import { PlanImage } from './plan-image';
import { ProposedTag } from './proposed-tag';
import { RegionNumber } from './region-number';
import styles from './screen-figure.module.css';

export interface ScreenFigureProps extends FigureOptions {
  readonly model: Model;
  /** The screen. */
  readonly id: string;
  readonly size?: 'sm' | 'md';
  /** The name, route and kind under the picture. */
  readonly caption?: boolean;
  /** The name opens the screen in the inspector. */
  readonly link?: boolean;
  readonly proposed?: ProposedMarks | null;
}

const EDGE = 4;
const cell = (at: FigureRegion['at']) => ({
  x: `${String(at.x)}%`,
  y: `${String(at.y)}%`,
  width: `${String(at.w)}%`,
  height: `${String(at.h)}%`,
});

function RegionBox({ region }: { readonly region: FigureRegion }) {
  const title = region.note === '' ? region.name : `${region.name} · ${region.note}`;
  return (
    <foreignObject className={styles.cell} {...cell(region.at)}>
      <button
        className={styles.region}
        data-edge={region.at.y < EDGE ? '' : undefined}
        data-inspect={region.id}
        data-lit={region.lit ? '' : undefined}
        data-status={region.status}
        title={title}
        type="button"
      >
        {region.number === null ? null : (
          <RegionNumber corner n={region.number} status={region.status} />
        )}
        <span className={styles.regionName}>
          {region.name}
          {region.note === '' ? null : <span className={styles.note}> · {region.note}</span>}
        </span>
      </button>
    </foreignObject>
  );
}

function GhostBox({ ghost }: { readonly ghost: FigureGhost }) {
  return (
    <foreignObject className={styles.cell} {...cell(ghost.at)}>
      <span className={styles.ghost} title={`${ghost.name} · goes away`}>
        {ghost.number === null ? null : <RegionNumber corner gone n={ghost.number} />}
      </span>
    </foreignObject>
  );
}

function Picture({ figure }: { readonly figure: FigureData }) {
  return (
    <div className={styles.pic}>
      {figure.image === '' ? (
        <div className={styles.blank}>
          <Icon name="screen" />
          <span>No picture yet</span>
        </div>
      ) : (
        <PlanImage alt={figure.name} className={styles.img} src={figure.image} />
      )}
      <svg className={styles.overlay} focusable="false">
        {figure.regions.map((region) => (
          <RegionBox key={region.id} region={region} />
        ))}
        {figure.ghosts.map((ghost) => (
          <GhostBox ghost={ghost} key={ghost.id} />
        ))}
      </svg>
    </div>
  );
}

function Caption({
  figure,
  link,
  tag,
}: {
  readonly figure: FigureData;
  readonly link: boolean;
  readonly tag: ReactNode;
}) {
  const name = (
    <>
      <Icon name="screen" />
      <span className={styles.nameText}>{figure.name}</span>
    </>
  );
  const device = figure.device === '' ? '' : ` · ${figure.device}`;
  return (
    <figcaption className={styles.cap}>
      {link ? (
        <button className={styles.name} data-inspect={figure.id} type="button">
          {name}
        </button>
      ) : (
        <span className={styles.name}>{name}</span>
      )}
      {figure.route === '' ? null : <span className={styles.route}>{figure.route}</span>}
      <span className={styles.kind}>{`${figure.kind}${device}`}</span>
      {tag}
    </figcaption>
  );
}

// The picture of a screen with its regions outlined: lit when in `focus`, coloured by what the plan does to
// them when `status` is on, each with its number when `numbers` is given. Regions the plan removes come in as
// `ghosts`, dashed and grey, on the picture that no longer has them. Reusable wherever a screen is shown.
export function ScreenFigure({
  model,
  id,
  size = 'md',
  caption = true,
  link = true,
  proposed = null,
  ...options
}: ScreenFigureProps) {
  const mode = options.mode ?? 'toBe';
  const figure = figureOf(model, id, {
    ...options,
    mode,
    status: options.status ?? mode !== 'asIs',
  });
  if (figure === null) return null;
  return (
    <figure
      className={styles.fig}
      data-narrow={figure.narrow ? '' : undefined}
      data-screen={id}
      data-size={size}
    >
      <Picture figure={figure} />
      {caption ? (
        <Caption
          figure={figure}
          link={link}
          tag={mode === 'asIs' ? null : <ProposedTag id={id} marks={proposed} />}
        />
      ) : null}
    </figure>
  );
}
