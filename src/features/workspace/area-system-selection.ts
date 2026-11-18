import { useMemo, useState } from 'react';

import {
  type ConnectionScope,
  sameConnectionScope,
  scopeContains,
} from '@/application/area-map/landscape-calls';
import type { CardSelection } from '@/ui/canvas/component-card';

interface AreaSelection {
  readonly active: boolean;
  readonly includes: (
    fromSystem: string | undefined,
    toSystem: string | undefined,
    from?: string,
    to?: string,
  ) => boolean;
  readonly card: (system: string, component?: string) => CardSelection;
  readonly collapse: (system: string) => void;
  readonly clear: () => void;
}

function toggleScope(current: readonly ConnectionScope[], scope: ConnectionScope) {
  if (current.some((item) => sameConnectionScope(item, scope))) {
    return current.filter((item) => !sameConnectionScope(item, scope));
  }
  return [
    ...current.filter((item) => !scopeContains(item, scope) && !scopeContains(scope, item)),
    scope,
  ];
}

export function useAreaSystemSelection(area: string): AreaSelection {
  const [picked, setPicked] = useState<readonly ConnectionScope[]>([]);
  return useMemo(
    () => ({
      active: picked.length > 0,
      includes: (fromSystem, toSystem, from, to) => {
        if (picked.length === 0) return true;
        const source = {
          area,
          ...(fromSystem === undefined ? {} : { system: fromSystem }),
          ...(from === undefined ? {} : { component: from }),
        };
        const target = {
          area,
          ...(toSystem === undefined ? {} : { system: toSystem }),
          ...(to === undefined ? {} : { component: to }),
        };
        if (picked.length === 1) {
          return picked.some(
            (scope) => scopeContains(scope, source) || scopeContains(scope, target),
          );
        }
        return picked.some(
          (scope) =>
            scopeContains(scope, source) &&
            picked.some((other) => other !== scope && scopeContains(other, target)),
        );
      },
      card: (system, component) => {
        const scope = { area, system, ...(component === undefined ? {} : { component }) };
        return {
          pressed: picked.some((item) => sameConnectionScope(item, scope)),
          toggle: () => {
            setPicked((current) => toggleScope(current, scope));
          },
        };
      },
      collapse: (system) => {
        setPicked((current) =>
          current.filter((scope) => scope.system !== system || scope.component === undefined),
        );
      },
      clear: () => {
        setPicked([]);
      },
    }),
    [area, picked],
  );
}
