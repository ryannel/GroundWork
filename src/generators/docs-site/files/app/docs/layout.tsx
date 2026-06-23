import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { source } from '@/app/source';

// Sidebar order is declarative now: docs/meta.json seeds the canonical top-level
// ordering and sinks the principles tree to the bottom (collapsed), so the old
// imperative betsFirst() sort is gone. Order is owned by the content tree, not code.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.pageTree} nav={{ title: '<%= navTitle %>' }}>
      {children}
    </DocsLayout>
  );
}
