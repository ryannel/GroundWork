import type { TermFit } from '@/domain/workspace-model';
import { Badge, type BadgeTone } from '@/ui/badge';

const FITS: Readonly<Record<TermFit, { readonly label: string; readonly tone: BadgeTone }>> = {
  same: { label: 'Same in the code', tone: 'added' },
  renamed: { label: 'Named differently', tone: 'modified' },
  close: { label: 'Close in the code', tone: 'neutral' },
  clash: { label: 'Clashes with the code', tone: 'deprecated' },
  'lives-in': { label: 'Lives in a system', tone: 'accent' },
};

/** How well the code's word matches the business's; a key term with no anchor is not in the code yet. */
export function TermFitBadge({ fit }: { readonly fit: TermFit | null }) {
  if (fit === null) return <Badge>Not in the code yet</Badge>;
  const { label, tone } = FITS[fit];
  return <Badge tone={tone}>{label}</Badge>;
}
