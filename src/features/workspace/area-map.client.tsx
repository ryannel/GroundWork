'use client';

import { useMemo, useRef, useState } from 'react';

import { type AreaMapTransport, unpackAreaMapView } from '@/application/area-map/transport';
import { isRecord } from '@/application/plan/ids';
import type { AreaView } from '@/application/workspace-area';
import { Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { AreaSystemMap } from './area-system-map.client';
import { AreaValueMap } from './area-value-map.client';

function isPayload(value: unknown, area: string): value is AreaMapTransport {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.systems) || !Array.isArray(value.technicalRelationships)) return false;
  return isRecord(value.area) && value.area.id === area;
}

/** Start with the complete overview; read detailed contracts only when the reader explores. */
export function AreaMap({
  payload,
  detailsHref,
  initialFlow = '',
}: {
  readonly payload: AreaMapTransport;
  readonly detailsHref?: string;
  readonly initialFlow?: string;
}) {
  const [session, setSession] = useState({ payload, version: 0 });
  if (session.payload !== payload) {
    setSession({ payload, version: session.version + 1 });
  }
  return (
    <AreaMapSession
      key={session.version}
      payload={payload}
      initialFlow={initialFlow}
      {...(detailsHref === undefined ? {} : { detailsHref })}
    />
  );
}

function AreaMapSession({
  payload,
  detailsHref,
  initialFlow,
}: {
  readonly payload: AreaMapTransport;
  readonly detailsHref?: string;
  readonly initialFlow: string;
}) {
  const overview = useMemo(() => unpackAreaMapView(payload), [payload]);
  const [detail, setDetail] = useState<AreaView>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef<Promise<AreaView> | null>(null);
  const view = detail ?? overview;
  const prepare = async (): Promise<boolean> => {
    if (detail !== undefined || detailsHref === undefined) return true;
    setLoading(true);
    setFailed(false);
    try {
      request.current ??= fetch(detailsHref, { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('System details unavailable');
        const body: unknown = await response.json();
        if (!isPayload(body, payload.area.id)) throw new Error('Unexpected area details');
        return unpackAreaMapView(body);
      });
      setDetail(await request.current);
      return true;
    } catch {
      request.current = null;
      setFailed(true);
      return false;
    } finally {
      setLoading(false);
    }
  };
  return view.valueFlow === undefined ? (
    <AreaSystemMap view={view} />
  ) : (
    <Stack gap={2}>
      {loading || failed ? (
        <div role="status">
          <Text size="sm" tone="muted">
            {loading
              ? 'Loading system details…'
              : 'Could not load system details. Select the system to try again.'}
          </Text>
        </div>
      ) : null}
      <AreaValueMap
        view={view}
        narrative={view.valueFlow}
        prepare={prepare}
        initialFlow={initialFlow}
      />
    </Stack>
  );
}
