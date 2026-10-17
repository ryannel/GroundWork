'use client';

import { Component, type ReactNode } from 'react';

import { Callout } from '@/ui/callout';

interface BoundaryProps {
  readonly children: ReactNode;
}

interface BoundaryState {
  /** Why the screen failed, or null while it draws. */
  readonly failed: string | null;
}

function Failed({ failed }: { readonly failed: string }) {
  return (
    <Callout title="This screen could not be drawn." tone="warning">
      <p>
        Something in the plan stopped it: {failed}. The other screens still work; use the rail or
        the pager to go on.
      </p>
    </Callout>
  );
}

// A screen that throws while it draws says so in its own place; the bar, the rail and the pager stay usable. React
// only catches render errors in a class component.
export class ChapterBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { failed: (error instanceof Error ? error.message : String(error)).replace(/\.$/u, '') };
  }

  override render(): ReactNode {
    const { failed } = this.state;
    const { children } = this.props;
    return failed === null ? children : <Failed failed={failed} />;
  }
}
