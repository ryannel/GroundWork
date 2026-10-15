import type { Model } from '@/application/plan/derive';
import type { GraphMode } from '@/application/plan-viz-graph-base';
import {
  type Band,
  type GraphPictureView,
  graphPicture,
} from '@/application/plan-viz-graph-picture';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { TeamTag } from '@/features/plan/common/team-dot';
import { ScrollCue } from '@/features/plan/viz/zoompane/scroll-cue.client';

import styles from './graph-picture.module.css';
import { TraceFrame } from './trace-frame.client';

export interface GraphPictureProps {
  readonly model: Model;
  readonly graphId: string;
  /** Today's graph by default. */
  readonly mode?: GraphMode;
  /** A team id: what other teams own is dimmed. */
  readonly lens?: string | null;
}

const HEADS = ['front end', 'edge', 'gateway', 'gateway cache', 'subgraphs and their stores'];

function Bands({
  model,
  bands,
  none,
}: {
  readonly model: Model;
  readonly bands: readonly Band[];
  readonly none: string;
}) {
  return (
    <>
      {bands.length === 0 ? <p className={styles.none}>{none}</p> : null}
      {bands.map((band) => (
        <div
          className={styles.band}
          key={band.id}
          title={`${model.label(band.id)}: a hit stops here`}
        >
          <span className={styles.bandKind}>◍ {band.layer}</span>
          <EntityChip id={band.id} model={model} status="existing" />
          <span className={styles.bandTech}>
            {[band.tech, band.perItem ? 'per entity' : ''].filter((x) => x !== '').join(' · ')}
          </span>
        </div>
      ))}
    </>
  );
}

function Gateway({
  model,
  lens,
  view,
}: {
  readonly model: Model;
  readonly lens: string | null;
  readonly view: GraphPictureView;
}) {
  const { gateway } = view;
  const dim = lens !== null && gateway.team !== null && gateway.team !== lens;
  return (
    <div className={styles.card} data-dim={dim ? '' : undefined}>
      <div className={styles.cardHead}>
        <EntityChip id={gateway.id} model={model} status="existing" />
        {gateway.team === null ? null : <TeamTag model={model} teamId={gateway.team} />}
      </div>
      <p className={styles.small}>{gateway.summary}</p>
      <ul className={styles.ops}>
        {gateway.operations.map((op) => (
          <li className={styles.op} data-sgs={op.on.join(' ')} key={op.id}>
            <EntityChip id={op.id} model={model} status="existing" />
            <span className={styles.small}>{op.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Subgraphs({
  model,
  lens,
  view,
}: {
  readonly model: Model;
  readonly lens: string | null;
  readonly view: GraphPictureView;
}) {
  return (
    <>
      {view.rows.map((row) => {
        const dim = lens !== null && row.team !== null && row.team !== lens;
        return (
          <div className={styles.row} data-dim={dim ? '' : undefined} data-sg={row.id} key={row.id}>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <EntityChip id={row.id} label={row.label} model={model} status="existing" />
                {row.team === null ? null : <TeamTag model={model} teamId={row.team} />}
              </div>
              <p className={styles.small}>
                served by <EntityChip id={row.service} model={model} status="existing" />
              </p>
              <ul className={styles.types}>
                {row.types.map((type) => (
                  <li className={styles.type} key={type.id}>
                    {type.label}
                    <span className={styles.share}>{type.share}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.stores}>
              {row.stores.map((id) => (
                <EntityChip id={id} key={id} model={model} status="existing" />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * The graph as one picture, left to right: front end, edge cache, gateway and its operations, gateway cache, then
 * each subgraph with its types and stores. Hover a subgraph to light the operations that reach it.
 */
export function GraphPicture({ model, graphId, mode = 'asIs', lens = null }: GraphPictureProps) {
  const view = graphPicture(model, graphId, mode);
  if (view === null) return null;
  return (
    <figure className={styles.figure}>
      <p className={styles.key}>
        A cache band: a hit stops there. Hover a subgraph to light the operations that reach it.
      </p>
      <ScrollCue note>
        <TraceFrame className={styles.pic}>
          <div className={styles.head}>
            {HEADS.map((head) => (
              <span key={head}>{head}</span>
            ))}
          </div>
          <div className={styles.grid}>
            <div className={styles.col}>
              {view.clients.length === 0 ? <p className={styles.none}>no client named</p> : null}
              {view.clients.map((id) => (
                <div className={styles.card} key={id}>
                  ◧ <EntityChip id={id} model={model} status="existing" />
                </div>
              ))}
            </div>
            <div className={styles.col}>
              <Bands bands={view.edge} model={model} none="no edge cache" />
            </div>
            <div className={styles.col}>
              <Gateway lens={lens} model={model} view={view} />
            </div>
            <div className={styles.col}>
              <Bands bands={view.gatewayCache} model={model} none="no gateway cache" />
            </div>
            <div className={styles.col}>
              <Subgraphs lens={lens} model={model} view={view} />
            </div>
          </div>
        </TraceFrame>
      </ScrollCue>
    </figure>
  );
}
