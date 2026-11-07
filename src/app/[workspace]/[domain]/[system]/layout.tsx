import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { modelDomainNavOf, modelDomainViewOf } from '@/application/model-domain';
import type { ModelIndex } from '@/application/model-index';
import { modelSystemAt, modelSystemViewOf } from '@/application/model-system';
import { modelSystemMapWire } from '@/application/model-system-map-input';
import { modelSystemPlansOf, modelSystemPlanProgress } from '@/application/model-system-plans';
import { FlowList, ModelTodayOverlays, SystemMapView, TodaySearch } from '@/features/plan';
import {
  CatalogueList,
  ModelSystemOverview,
  ModelSystemPlans,
  SystemPage,
} from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlanProgress } from '@/infrastructure/model-plan-context';
import { readModelPlanEntries } from '@/infrastructure/model-plans';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly system: string;
}

// Every page of the system names the system after its own title.
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { workspace: id, domain, system } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) return {};
  const name = modelSystemAt(native, { domain, system })?.system.name;
  return name === undefined ? {} : { title: { default: name, template: `%s · ${name}` } };
}

async function nativeSystemLayout(native: ModelIndex, at: Params, children: ReactNode) {
  const { workspace: id, domain, system } = at;
  const view = modelSystemViewOf(native, { domain, system });
  const place = modelDomainViewOf(native, domain);
  if (view === null || place === null) notFound();
  const plans = modelSystemPlansOf(native, view.id, await readModelPlanEntries(id));
  const recorded = await Promise.all(
    plans.items.map(async (item) => {
      const reading = await readModelPlanProgress(id, item.slug);
      return modelSystemPlanProgress(item, reading?.progress ?? null, reading?.errors ?? []);
    }),
  );
  const interfaces = view.catalogue.apis.length + view.catalogue.events.length > 0;
  return (
    <SystemPage
      cataloguePreviewItems={false}
      actions={<TodaySearch />}
      view={view}
      nav={modelDomainNavOf(native, place, plans.domainPlans, {
        id: view.id,
        flows: view.flows.length > 0,
        data: view.data.length > 0,
        interfaces,
      })}
      overlays={<ModelTodayOverlays index={native} />}
      overview={
        <ModelSystemOverview view={view}>
          {view.flows.length === 0 ? children : null}
        </ModelSystemOverview>
      }
      plans={<ModelSystemPlans plans={{ ...plans, items: recorded }} />}
      interfaces={
        interfaces ? (
          <CatalogueList catalogue={{ ...view.catalogue, data: [] }} previewItems={false} />
        ) : null
      }
      map={
        <SystemMapView
          packed={modelSystemMapWire(native, { focus: [view.id] })}
          outside="outside this system, one step away"
        />
      }
      flows={view.flows.length === 0 ? null : <FlowList flows={view.flows}>{children}</FlowList>}
    />
  );
}

// The system page is a layout, so its flows can be pages of their own: picking one fetches only that flow.
export default async function SystemLayout({
  params,
  children,
}: {
  readonly params: Promise<Params>;
  readonly children: ReactNode;
}) {
  const { workspace: id, domain, system } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  return nativeSystemLayout(native, { workspace: id, domain, system }, children);
}
