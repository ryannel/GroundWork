'use client';

import { Suspense, use, useEffect, useRef, useState } from 'react';

import type { Mode } from '@/application/plan/derive-core';
import { interfaceEndpoints, type Shared } from '@/application/plan-viz-endpoint';
import { pendingModel } from '@/features/plan/plan-model';
import { Text } from '@/ui/text';

import { EndpointLines } from './endpoint-lines';

export interface LazyEndpoint {
  /** The model's address relative to the page: plan.json or model.json. */
  readonly src: string;
  /** The interface that serves it, to find it in the model. */
  readonly ifc: string;
}

interface BodyProps {
  readonly lazy: LazyEndpoint;
  readonly id: string;
  readonly mode: Mode;
  readonly shared: Shared;
  readonly flowHref?: string | undefined;
}

function Lines({ lazy, id, mode, shared, flowHref }: BodyProps) {
  const model = use(pendingModel(lazy.src).model);
  const ep =
    model === null ? undefined : interfaceEndpoints(model, lazy.ifc, mode).find((e) => e.id === id);
  if (model === null || ep === undefined) {
    return <Text tone="faint">This endpoint could not be loaded.</Text>;
  }
  return <EndpointLines ep={ep} flowHref={flowHref} mode={mode} model={model} shared={shared} />;
}

/**
 * An endpoint's body, drawn in the browser the first time its row opens, from the model the inspector reads. A
 * catalogue of every endpoint would otherwise ship every field table inside rows that start closed. Pointing at
 * the row starts the fetch, so by the click it is usually there.
 */
export function EndpointBody({ lazy, id, mode, shared, flowHref }: BodyProps) {
  const { src } = lazy;
  const mark = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const row = mark.current?.closest('details') ?? null;
    const warm = () => {
      pendingModel(src);
    };
    const sync = () => {
      if (row?.open === true) setOpen(true);
    };
    sync();
    row?.addEventListener('toggle', sync);
    row?.addEventListener('pointerenter', warm);
    row?.addEventListener('focusin', warm);
    return () => {
      row?.removeEventListener('toggle', sync);
      row?.removeEventListener('pointerenter', warm);
      row?.removeEventListener('focusin', warm);
    };
  }, [src]);
  return (
    <>
      <span hidden ref={mark} />
      {open ? (
        <Suspense fallback={<Text tone="faint">Loading…</Text>}>
          <Lines flowHref={flowHref} id={id} lazy={lazy} mode={mode} shared={shared} />
        </Suspense>
      ) : null}
    </>
  );
}
