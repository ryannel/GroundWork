'use client';

import { Suspense } from 'react';

import type { PyramidView } from '@/application/plan-viz-tests';
import { usePick } from '@/features/plan/lens-cut.client';

import { type DrawProps, PyramidDrawing } from './pyramid-drawing';

interface PyramidByLensProps extends DrawProps {
  readonly everyone: PyramidView;
  /** Each team's pyramid, by team id: numbers, drawn here for the team in the address. */
  readonly teams: Readonly<Record<string, PyramidView>>;
}

function Pick({ everyone, teams, ...rest }: PyramidByLensProps) {
  return <PyramidDrawing view={usePick(teams) ?? everyone} {...rest} />;
}

/** The pyramid for the team in the address, or for everyone. */
export function PyramidByLens({ everyone, teams, ...draw }: PyramidByLensProps) {
  return (
    <Suspense fallback={<PyramidDrawing view={everyone} {...draw} />}>
      <Pick everyone={everyone} teams={teams} {...draw} />
    </Suspense>
  );
}
