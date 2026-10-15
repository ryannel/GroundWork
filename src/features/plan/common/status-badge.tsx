import type { ElementStatus } from '@/application/plan/derive-core';
import { statusWord } from '@/application/plan-chips';
import { Badge, type BadgeTone } from '@/ui/badge';

const SHOWN: Partial<Record<ElementStatus, readonly [BadgeTone, string]>> = {
  added: ['added', '+ New'],
  modified: ['modified', '~ Changed'],
  deprecated: ['deprecated', 'Deprecated · still works'],
  removed: ['removed', '× Removed'],
};

/** A status as a badge; an unchanged thing has none. */
export function StatusBadge({ status }: { readonly status: ElementStatus | null }) {
  const shown = status === null ? undefined : SHOWN[status];
  if (status === null || shown === undefined) return null;
  return (
    <span title={statusWord(status)}>
      <Badge tone={shown[0]}>{shown[1]}</Badge>
    </span>
  );
}
