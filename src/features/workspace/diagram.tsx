import Link from 'next/link';
import { useId } from 'react';

import type {
  Diagram as DiagramModel,
  DiagramGroup,
  DiagramNode,
} from '@/application/workspace-diagram';

import styles from './diagram.module.css';

interface DiagramProps {
  readonly diagram: DiagramModel;
  /** What the drawing shows, for screen readers and as the caption. */
  readonly label: string;
}

// Boxes and arrows drawn from a laid-out diagram; the arrows are also listed as text under it.
export function Diagram({ diagram, label }: DiagramProps) {
  const id = useId();
  const arrow = `${id}-arrow`;
  return (
    <figure className={styles.figure}>
      <div className={styles.scroll}>
        <svg
          aria-label={label}
          className={styles.svg}
          height={diagram.height}
          role="img"
          viewBox={`0 0 ${String(diagram.width)} ${String(diagram.height)}`}
          width={diagram.width}
        >
          <defs>
            <marker id={arrow} markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <path className={styles.head} d="M 0 0 L 8 4 L 0 8 z" />
            </marker>
          </defs>
          {diagram.groups.map((group) => (
            <Group group={group} key={group.id} />
          ))}
          {diagram.edges.map((edge) => (
            <path
              className={styles.edge}
              d={edge.path}
              data-quiet={edge.quiet ? '' : undefined}
              key={edge.id}
              markerEnd={`url(#${arrow})`}
            >
              <title>{edge.description}</title>
            </path>
          ))}
          {diagram.nodes.map((node) => (
            <Node key={node.id} node={node} />
          ))}
        </svg>
      </div>
      <figcaption className={styles.caption}>
        <details>
          <summary>{label}, as a list</summary>
          {diagram.edges.length === 0 ? (
            <p>Nothing here talks to anything else.</p>
          ) : (
            <ul className={styles.list}>
              {diagram.edges.map((edge) => (
                <li key={edge.id}>{edge.description}</li>
              ))}
            </ul>
          )}
        </details>
      </figcaption>
    </figure>
  );
}

function Group({ group }: { readonly group: DiagramGroup }) {
  const title = (
    <text className={styles.groupLabel} x={group.x + 16} y={group.y + 24}>
      {group.label}
    </text>
  );
  return (
    <g>
      <rect
        className={styles.group}
        data-quiet={group.quiet ? '' : undefined}
        height={group.height}
        rx={12}
        width={group.width}
        x={group.x}
        y={group.y}
      />
      {group.href === null ? (
        title
      ) : (
        <Link className={styles.link} href={group.href}>
          {title}
        </Link>
      )}
    </g>
  );
}

function Node({ node }: { readonly node: DiagramNode }) {
  const box = (
    <g data-quiet={node.quiet ? '' : undefined}>
      <title>{node.title}</title>
      <rect
        className={styles.node}
        height={node.height}
        rx={8}
        width={node.width}
        x={node.x}
        y={node.y}
      />
      <rect
        className={styles.stripe}
        data-team={node.team ?? undefined}
        height={node.height - 12}
        rx={2}
        width={4}
        x={node.x + 6}
        y={node.y + 6}
      />
      <text className={styles.label} x={node.x + 18} y={node.y + (node.detail === null ? 26 : 19)}>
        {node.label}
      </text>
      {node.detail === null ? null : (
        <text className={styles.detail} x={node.x + 18} y={node.y + 34}>
          {node.detail}
        </text>
      )}
    </g>
  );
  return node.href === null ? (
    box
  ) : (
    <Link className={styles.link} href={node.href}>
      {box}
    </Link>
  );
}
