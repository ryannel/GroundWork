import type { Model } from '@/application/plan/derive';
import { systemMapInput } from '@/application/plan-viz-system-map-input';

import { SystemMapView } from './system-map.client';

export interface SystemMapProps {
  readonly model: Model;
  /** A team's id: its cards stay bright, the ones they talk to stay readable, the rest dim. */
  readonly lens?: string | null;
}

/** Every system, and what calls what: the services as cards, the topics and stores under their keepers. */
export function SystemMap({ model, lens = null }: SystemMapProps) {
  const input = systemMapInput(model, lens);
  if (input.services.length === 0) return null;
  return <SystemMapView input={input} />;
}
