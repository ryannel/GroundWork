import { describe, expect, it } from 'vitest';

import type { Workspace } from '@/domain/workspace';

import {
  domainFlowHref,
  findWorkspace,
  flowSlug,
  partnerHref,
  programmeHref,
  systemFlowHref,
} from './workspace-paths';

describe('workspace paths', () => {
  it('addresses a flow by its id without flow:, on a domain or a system', () => {
    expect(flowSlug('flow:place-order')).toBe('place-order');
    expect(flowSlug('my-flow:x')).toBe('my-flow:x');
    expect(systemFlowHref({ workspace: 'w', domain: 'd', system: 's' }, 'flow:f')).toBe(
      '/w/d/s/flows/f/',
    );
    expect(domainFlowHref('w', 'd', 'flow:f')).toBe('/w/d/flows/f/');
  });

  it('addresses a programme, and a partner by its team id without team:', () => {
    expect(programmeHref('w', 'care')).toBe('/w/programmes/care/');
    expect(partnerHref('w', 'team:ziklo')).toBe('/w/partners/ziklo/');
    expect(partnerHref('w', 'a-team:x')).toBe('/w/partners/a-team:x/');
  });

  it('finds a workspace by id, or none', () => {
    const one = { id: 'one' } as Workspace;
    const two = { id: 'two' } as Workspace;
    expect(findWorkspace([one, two], 'two')).toBe(two);
    expect(findWorkspace([one, two], 'three')).toBeNull();
  });
});
