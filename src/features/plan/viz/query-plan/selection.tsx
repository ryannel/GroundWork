import { type SelNode, WHY } from '@/application/plan-viz-query-plan';

import styles from './selection.module.css';

/** A fetch's selection: "price { amount currency }". Names the gateway added on its own are marked, with the reason. */
export function Selection({ nodes }: { readonly nodes: readonly SelNode[] }) {
  return nodes.map((n, i) => (
    <span key={n.name}>
      {i > 0 ? ' ' : ''}
      {n.router === null ? (
        n.name
      ) : (
        <span className={styles.router} title={WHY[n.router]}>
          {n.name}
        </span>
      )}
      {n.kids.length === 0 ? null : (
        <>
          {' { '}
          <Selection nodes={n.kids} />
          {' }'}
        </>
      )}
    </span>
  ));
}
