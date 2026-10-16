import Link from 'next/link';

import type { LandNode } from '@/application/landscape-map-types';

import styles from './landscape-box.module.css';

export type Lit = 'hot' | 'dim' | undefined;

interface BoxProps {
  readonly node: LandNode;
  readonly lit: Lit;
  readonly onToggle: (domain: string) => void;
}

function Head({ node }: { readonly node: LandNode }) {
  return (
    <>
      <span className={styles.eyebrow}>{node.eyebrow}</span>
      {node.href === null || node.kind === 'system' ? (
        <span className={styles.name}>{node.name}</span>
      ) : (
        <Link className={styles.name} href={node.href}>
          {node.name}
        </Link>
      )}
    </>
  );
}

function Body({ node, onToggle }: Pick<BoxProps, 'node' | 'onToggle'>) {
  const text = node.text === null ? null : <span className={styles.text}>{node.text}</span>;
  switch (node.kind) {
    case 'domain': {
      return (
        <>
          <button
            aria-expanded={false}
            aria-label={`Show the systems in ${node.name}`}
            className={styles.cover}
            onClick={() => {
              onToggle(node.id);
            }}
            type="button"
          />
          <Head node={node} />
          {text}
          <span className={styles.foot}>
            <span className={styles.dots}>
              {node.dots.map((slot) => (
                <span className={styles.team} data-team={slot} key={slot} />
              ))}
            </span>
            <span className={styles.more}>Show systems</span>
          </span>
        </>
      );
    }
    case 'frame': {
      return (
        <span className={styles.top}>
          <span className={styles.titles}>
            <Head node={node} />
          </span>
          <button
            className={styles.fold}
            onClick={() => {
              onToggle(node.id);
            }}
            type="button"
          >
            Fold
          </button>
        </span>
      );
    }
    case 'system': {
      return (
        <Link className={styles.card} href={node.href ?? '#'}>
          <span className={styles.team} data-team={node.teamSlot} />
          <Head node={node} />
          {text}
        </Link>
      );
    }
    case 'external': {
      return (
        <button className={styles.card} data-inspect={node.id} type="button">
          <Head node={node} />
          {text}
        </button>
      );
    }
    case 'actor': {
      return (
        <>
          <Head node={node} />
          {text}
        </>
      );
    }
  }
}

/** Puts a box where the drawing says; it is moved with the DOM because a style prop is not allowed. */
function placed(node: LandNode) {
  return (el: HTMLDivElement | null): void => {
    if (el === null) return;
    el.style.setProperty('left', `${String(node.x)}px`);
    el.style.setProperty('top', `${String(node.y)}px`);
    el.style.setProperty('width', `${String(node.w)}px`);
    el.style.setProperty('height', `${String(node.h)}px`);
  };
}

// One box on the landscape, drawn as HTML over the lines so its text wraps and its links and buttons work.
// It sits outside the svg because WebKit does not scale or place HTML inside a foreignObject properly.
export function LandscapeBox({ node, lit, onToggle }: BoxProps) {
  return (
    <div
      className={styles.box}
      data-box={node.kind === 'frame' ? undefined : node.id}
      data-kind={node.kind}
      data-lit={lit}
      ref={placed(node)}
    >
      <Body node={node} onToggle={onToggle} />
    </div>
  );
}
