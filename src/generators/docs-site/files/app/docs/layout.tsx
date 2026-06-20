import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { source } from '@/app/source';

type Tree = typeof source.pageTree;

// Float the `bets` section to the top of the sidebar so active and delivered bets
// are the first thing a reader sees, then preserve the natural order of the rest
// (lifecycle, principles, examples, …). Sorting is stable, so non-bets nodes keep
// their relative order. The bets folder's auto-derived label is "Bets".
function betsFirst(tree: Tree): Tree {
  const isBets = (node: Tree['children'][number]) =>
    typeof node.name === 'string' && node.name.toLowerCase().includes('bets');
  return {
    ...tree,
    children: [...tree.children].sort((a, b) => Number(isBets(b)) - Number(isBets(a))),
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={betsFirst(source.pageTree)} nav={{ title: '<%= navTitle %>' }}>
      {children}
    </DocsLayout>
  );
}
