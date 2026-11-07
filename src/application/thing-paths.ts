import { idToToken } from '@/domain/ids';

import { planHref, type PlanAddress } from './plan-navigation';
import type { Reader } from './today-reader';

/** A thing's page under a base that ends in a slash: a plan's things/, or a workspace's. */
export const thingAt = (base: string, id: string): string => `${base}?id=${idToToken(id)}`;

/** The screen name of the page that shows one thing at a time. */
export const THINGS_SCREEN = 'things';

export function thingHref(at: PlanAddress, id: string): string {
  return thingAt(`${planHref(at)}things/`, id);
}

/** How the inspector, palette and thing pages read a plan: its plan.json at `modelSrc`, its pages under it. */
export function planReaderOf(at: PlanAddress, modelSrc: string): Reader {
  return {
    mode: 'plan',
    modelSrc,
    thingBase: `${planHref(at)}things/`,
    assetBase: planHref(at),
    plan: { workspace: at.workspace, slug: at.slug },
  };
}
