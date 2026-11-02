import type { CardTone } from '@/ui/canvas/component-card';
import type { IconName } from '@/ui/icon';

// The same component-kind icons, colours and words used by the landscape.

const KINDS = {
  service: { icon: 'service', tone: 'api', word: 'Service' },
  ui: { icon: 'ui', tone: 'app', word: 'App' },
  job: { icon: 'job', tone: 'job', word: 'Job' },
  external: { icon: 'external', tone: 'neutral', word: 'External' },
} as const satisfies Readonly<
  Record<string, { readonly icon: IconName; readonly tone: CardTone; readonly word: string }>
>;

type KindName = keyof typeof KINDS;

const isKind = (kind: string): kind is KindName => kind in KINDS;

export function kindOf(kind: string): (typeof KINDS)[KindName] {
  return isKind(kind) ? KINDS[kind] : KINDS.service;
}
