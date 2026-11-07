import type { ReactNode } from 'react';

import { modelAssetsOf } from '@/application/model-assets';
import { modelFlowOf } from '@/application/model-flow';
import {
  modelInspectionOf,
  modelInspectionRef,
  type ModelInspection,
} from '@/application/model-inspection';
import {
  modelPlanBar,
  modelPlanFocus,
  modelPlanScreen,
  type ModelPlanBlock,
  type ModelPlanBasis,
  type ModelPlanProgress,
  type ModelPlanSnapshot,
  type ModelPlanScreen,
} from '@/application/model-plan-pages';
import type { ModelQueryContext } from '@/application/model-reader';
import { modelSystemMapWire } from '@/application/model-system-map-input';
import type { PlanCard } from '@/application/plan-footprint';
import {
  findPage,
  neighboursOf,
  planHref,
  pageHref,
  type Outline,
  type Page,
} from '@/application/plan-navigation';
import { keyOf } from '@/application/plan-pages-key';
import { thingHref } from '@/application/thing-paths';
import { idToToken, kindOf, tokenToId } from '@/domain/ids';
import { modelText } from '@/domain/workspace-model';
import { type SearchParams, firstParam } from '@/shared/search-params';
import { Badge } from '@/ui/badge';
import { Callout } from '@/ui/callout';
import { List, ListItem } from '@/ui/list';
import { PageHeader } from '@/ui/page-header';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { EntityDetailsContent } from './inspector/entity-details';
import { EntityHead } from './inspector/entity-head';
import { ModelPlanAssets } from './model-plan-assets';
import { ModelPlanBasisNotice } from './model-plan-basis';
import { ModelPlanProgressFeed, ModelPlanWork, ModelPlanPart } from './model-plan-progress';
import {
  modelPlanItems,
  ModelPlanRecordDetail,
  ModelPlanText,
  ModelPlanValue,
  type ModelPlanLabels,
} from './model-plan-record';
import { PlanActions } from './plan-bar';
import { PlanFrame } from './plan-frame';
import { PlanOverlays } from './plan-overlays';
import { ProgressStrip } from './progress/progress-strip.client';
import { ModelTodayFlow } from './today/model-today-flow';
import { SystemMapView } from './viz/system-map/system-map.client';

export interface ModelPlanPageProps {
  readonly context: ModelQueryContext;
  readonly outline: Outline;
  readonly workspaceName: string;
  readonly plans: readonly PlanCard[];
  readonly progress: ModelPlanProgress;
  readonly snapshots: readonly ModelPlanSnapshot[];
  readonly basis?: ModelPlanBasis | null;
  readonly chapter?: string;
  readonly screen?: string;
  readonly lens?: string | null;
  readonly searchParams?: SearchParams;
}
const PAGE_SIZE = 30;
function pageNumber(query: SearchParams): number {
  const value = Number(firstParam(query.page));
  return Number.isInteger(value) && value > 0 ? value : 1;
}
function nextHref(href: string, page: number, query: SearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const first = firstParam(value);
    if (key !== 'page' && first !== '') params.set(key, first);
  }
  params.set('page', String(page));
  return `${href}?${params.toString()}`;
}
function Paging({
  total,
  page,
  href,
  query,
}: {
  readonly total: number;
  readonly page: number;
  readonly href: string;
  readonly query: SearchParams;
}) {
  return (
    <Cluster spread>
      <Text tone="muted" size="sm">
        {String(total)} records · page {String(page)} of{' '}
        {String(Math.max(1, Math.ceil(total / PAGE_SIZE)))}
      </Text>
      <Cluster>
        {page <= 1 ? null : (
          <TextLink href={nextHref(href, page - 1, query)}>← Previous records</TextLink>
        )}
        {page * PAGE_SIZE >= total ? null : (
          <TextLink href={nextHref(href, page + 1, query)}>More records →</TextLink>
        )}
      </Cluster>
    </Cluster>
  );
}
function GraphRows({
  records,
  lookup,
  outline,
}: {
  readonly records: ModelPlanBlock['records'];
  readonly lookup: ModelPlanLabels;
  readonly outline: Outline;
}) {
  return (
    <List>
      {records.map((record) =>
        record.id === null ? null : (
          <ListItem key={record.id}>
            <Stack gap={1}>
              <TextLink href={`${thingHref(outline, record.id)}&view=${lookup.version}`}>
                {lookup.labelOf(record.id)}
              </TextLink>
              <ModelPlanText text={modelText(record.data.summary)} lookup={lookup} />
            </Stack>
          </ListItem>
        ),
      )}
    </List>
  );
}
function RecordRows({
  block,
  visible,
  lookup,
  at,
  outline,
}: {
  readonly block: ModelPlanBlock;
  readonly visible: ModelPlanBlock['records'];
  readonly lookup: ModelPlanLabels;
  readonly at: Page;
  readonly outline: Outline;
}) {
  if (visible.length === 0) {
    return (
      <Text as="p" tone="muted">
        No entries recorded.
      </Text>
    );
  }
  if (at.chapter === 'today' && at.screen === 'graph') {
    return <GraphRows records={visible} lookup={lookup} outline={outline} />;
  }
  if (block.summary) {
    return (
      <List>
        {visible.map((record) => (
          <ListItem key={record.id ?? record.title}>
            <TextLink
              href={record.id === null ? at.href : pageHref(outline, 'changes', keyOf(record.id))}
            >
              {record.title}
            </TextLink>
          </ListItem>
        ))}
      </List>
    );
  }
  return (
    <>
      {visible.map((record) => (
        <ModelPlanRecordDetail key={record.id ?? record.title} record={record} lookup={lookup} />
      ))}
    </>
  );
}
function RecordBlock({
  block,
  lookup,
  page,
  query,
  at,
  outline,
}: {
  readonly block: ModelPlanBlock;
  readonly lookup: ModelPlanLabels;
  readonly page: number;
  readonly query: SearchParams;
  readonly at: Page;
  readonly outline: Outline;
}) {
  const visible = block.records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <Stack as="section" label={block.title} gap={3}>
      <Text as="h3" size="lg" weight="strong">
        {block.title}
      </Text>
      <RecordRows block={block} visible={visible} lookup={lookup} at={at} outline={outline} />
      {block.records.length <= PAGE_SIZE ? null : (
        <Paging total={block.records.length} page={page} href={at.href} query={query} />
      )}
    </Stack>
  );
}
function VersionSwitch({
  page,
  before,
  query,
}: {
  readonly page: Page;
  readonly before: boolean;
  readonly query: SearchParams;
}) {
  const href = (version: string): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      const first = firstParam(value);
      if (!['view', 'page'].includes(key) && first !== '') params.set(key, first);
    }
    params.set('view', version);
    return `${page.href}?${params.toString()}`;
  };
  return (
    <Cluster>
      <Badge tone={before ? 'neutral' : 'modified'}>
        {before ? 'Before this plan' : 'With this plan · proposed'}
      </Badge>
      <TextLink href={href(before ? 'after' : 'before')}>
        {before ? 'Show with this plan' : 'Show before this plan'}
      </TextLink>
    </Cluster>
  );
}
function RecordCatalogue({
  records,
  outline,
  page,
  query,
  selectedPage,
}: {
  readonly records: readonly {
    readonly id: string;
    readonly label: string;
    readonly kind: string;
  }[];
  readonly outline: Outline;
  readonly page: number;
  readonly query: SearchParams;
  readonly selectedPage: Page;
}) {
  return (
    <Stack gap={3}>
      <List>
        {records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((record) => (
          <ListItem key={record.id}>
            <Cluster spread>
              <TextLink href={`${planHref(outline)}things/?id=${idToToken(record.id)}`}>
                {record.label}
              </TextLink>
              <Text size="sm" tone="muted">
                {record.kind}
              </Text>
            </Cluster>
          </ListItem>
        ))}
      </List>
      <Paging total={records.length} page={page} href={selectedPage.href} query={query} />
    </Stack>
  );
}
function PlanMap({
  context,
  view,
  before,
  lens,
}: {
  readonly context: ModelQueryContext;
  readonly view: ModelPlanScreen;
  readonly before: boolean;
  readonly lens: string | null;
}) {
  if (!view.map) return null;
  const focus = modelPlanFocus(context);
  if (focus.length === 0) {
    return (
      <Callout title="Map scope is not recorded">
        This plan has no changed target or declared story scope with known system placement.
      </Callout>
    );
  }
  return (
    <SystemMapView
      packed={modelSystemMapWire(before ? context.beforeIndex : context.afterIndex, {
        focus,
        lens,
      })}
    />
  );
}
function flowHref(page: Page, query: SearchParams, id: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const first = firstParam(value);
    if (key !== 'flow' && first !== '') params.set(key, first);
  }
  params.set('flow', id);
  return `${page.href}?${params.toString()}`;
}
function PlanFlows({
  lookup,
  ids,
  page,
  query,
}: {
  readonly lookup: ModelPlanLabels;
  readonly ids: readonly string[];
  readonly page: Page;
  readonly query: SearchParams;
}) {
  const wanted = firstParam(query.flow);
  const id = ids.includes(wanted) ? wanted : ids[0];
  if (id === undefined) return null;
  const flow = modelFlowOf(lookup.index, id);
  return (
    <Stack gap={3}>
      {ids.length <= 1 ? null : (
        <Cluster label="Recorded flows">
          {ids.map((candidate) =>
            candidate === id ? (
              <Badge key={candidate}>{lookup.labelOf(candidate)}</Badge>
            ) : (
              <TextLink key={candidate} href={flowHref(page, query, candidate)}>
                {lookup.labelOf(candidate)}
              </TextLink>
            ),
          )}
        </Cluster>
      )}
      {flow === null ? (
        <Callout title="Flow is not present in this view">{id}</Callout>
      ) : (
        <ModelTodayFlow flow={flow} />
      )}
    </Stack>
  );
}
function PlanRecords({
  context,
  outline,
  view,
  progress,
  lookup,
  lens,
  query,
}: {
  readonly context: ModelQueryContext;
  readonly outline: Outline;
  readonly view: ModelPlanScreen;
  readonly progress: ModelPlanProgress;
  readonly lookup: ModelPlanLabels;
  readonly lens: string | null;
  readonly query: SearchParams;
}) {
  if (view.page.chapter === 'cover' && view.page.screen === 'part' && context.plan !== null) {
    const detailHref = (id: string): string => {
      const href =
        kindOf(id) === 'change' ? pageHref(outline, 'changes', keyOf(id)) : thingHref(outline, id);
      if (lookup.version === 'after') return href;
      return `${href}${href.includes('?') ? '&' : '?'}view=before`;
    };
    return (
      <ModelPlanPart
        plan={context.plan}
        progress={progress}
        lookup={lookup}
        team={lens}
        detailHref={detailHref}
      />
    );
  }
  if (view.page.chapter === 'build' && context.plan !== null) {
    if (view.page.screen === 'progress') {
      return <ModelPlanProgressFeed progress={progress} labelOf={lookup.labelOf} />;
    }
    return (
      <ModelPlanWork
        plan={context.plan}
        progress={progress}
        lookup={lookup}
        team={lens}
        grouped={view.page.screen === 'work-by-team'}
      />
    );
  }
  return (
    <>
      {view.blocks.map((block) => (
        <RecordBlock
          key={block.title}
          block={block}
          lookup={lookup}
          page={pageNumber(query)}
          query={query}
          at={view.page}
          outline={outline}
        />
      ))}
    </>
  );
}
function CoverContents({
  outline,
  context,
}: {
  readonly outline: Outline;
  readonly context: ModelQueryContext;
}) {
  const teams = [...new Set((context.plan?.work_items ?? []).map((item) => item.team))];
  return (
    <Stack as="section" label="Read this plan">
      <Text as="h3" weight="strong">
        Read this plan
      </Text>
      <Cluster>
        {teams.map((id) => (
          <TextLink
            key={id}
            href={`${pageHref(outline, 'cover', 'part')}?team=${encodeURIComponent(id)}`}
          >
            {context.afterIndex.label(id)}’s part
          </TextLink>
        ))}
      </Cluster>
      <List>
        {outline.chapters
          .filter((chapter) => chapter.key !== 'cover')
          .map((chapter) => (
            <ListItem key={chapter.key}>
              <TextLink href={chapter.pages[0]?.href ?? planHref(outline)}>
                {chapter.number} · {chapter.title}
              </TextLink>
              <Text as="p" tone="muted">
                {chapter.subtitle}
              </Text>
            </ListItem>
          ))}
      </List>
    </Stack>
  );
}
function PlanStageBadge({ context }: { readonly context: ModelQueryContext }) {
  return <Badge>{context.plan?.meta.status ?? 'draft'}</Badge>;
}
function isCoverPage(page: Page): boolean {
  return page.chapter === 'cover' && page.screen === 'cover';
}
function isBeforeView(page: Pick<Page, 'chapter'>, query: SearchParams): boolean {
  const requested = firstParam(query.view);
  return requested === 'before' || (requested !== 'after' && page.chapter === 'today');
}
function PlanBody({
  context,
  outline,
  page,
  progress,
  snapshots,
  basis,
  lens,
  query,
}: {
  readonly context: ModelQueryContext;
  readonly outline: Outline;
  readonly page: Page;
  readonly progress: ModelPlanProgress;
  readonly snapshots: readonly ModelPlanSnapshot[];
  readonly basis: ModelPlanBasis | null;
  readonly lens: string | null;
  readonly query: SearchParams;
}) {
  const before = isBeforeView(page, query);
  const index = before ? context.beforeIndex : context.afterIndex;
  const lookup: ModelPlanLabels = {
    context,
    version: before ? 'before' : 'after',
    planBase: planHref(outline),
    index,
    labelOf: (referenceId) =>
      modelInspectionRef(context, referenceId, before ? 'before' : 'after').label,
  };
  const view = modelPlanScreen(context, page, { before, snapshots });
  const cover = isCoverPage(page);
  return (
    <Stack gap={4}>
      <PageHeader
        title={cover ? outline.title : view.headline}
        description={
          cover ? <ModelPlanText text={context.plan?.problem.summary} lookup={lookup} /> : null
        }
        meta={<PlanStageBadge context={context} />}
      />
      <ModelPlanBasisNotice basis={basis} index={context.beforeIndex} show={cover} />
      {view.recap.length === 0 ? null : (
        <List>
          {modelPlanItems(view.recap).map(({ key, value }) => (
            <ListItem key={key}>
              <ModelPlanValue value={value} lookup={lookup} />
            </ListItem>
          ))}
        </List>
      )}
      {['today', 'changes', 'journey'].includes(page.chapter) ? (
        <VersionSwitch page={page} before={before} query={query} />
      ) : null}
      <PlanMap context={context} view={view} before={before} lens={lens} />
      <PlanFlows lookup={lookup} ids={view.flowIds} page={page} query={query} />
      <PlanRecords
        context={context}
        outline={outline}
        view={view}
        progress={progress}
        lookup={lookup}
        lens={lens}
        query={query}
      />
      {page.chapter === 'ref' ? (
        <RecordCatalogue
          records={view.catalogue}
          outline={outline}
          page={pageNumber(query)}
          query={query}
          selectedPage={page}
        />
      ) : null}
      {page.chapter === 'changes' ? (
        <Callout title="Proposed changes">
          These are plan effects. Implementation remains unverified until supported by current
          evidence.
        </Callout>
      ) : null}
      {cover ? <CoverContents outline={outline} context={context} /> : null}
    </Stack>
  );
}
function NativeFrame({
  data,
  page,
  children,
}: {
  readonly data: ModelPlanPageProps;
  readonly page: Page;
  readonly children: ReactNode;
}) {
  const { context, outline, workspaceName, plans } = data;
  const neighbours = neighboursOf(outline, page);
  const src = `${planHref(outline)}plan.json`;
  return (
    <PlanFrame
      outline={outline}
      page={page}
      workspaceName={workspaceName}
      plans={plans}
      neighbours={neighbours}
      actions={<PlanActions bar={modelPlanBar(context, outline)} outline={outline} src={src} />}
      overlays={<PlanOverlays outline={outline} page={page} neighbours={neighbours} src={src} />}
      progress={
        <ProgressStrip
          crumb={[
            outline.chapters.find((chapter) => chapter.key === page.chapter)?.title ?? '',
            page.title,
          ]}
          teams={[]}
        />
      }
    >
      {children}
    </PlanFrame>
  );
}
/** Native chapter bodies query only the selected server projection and reuse the existing frame and drawings. */
export function ModelPlanPage(props: ModelPlanPageProps) {
  const {
    context,
    outline,
    progress,
    snapshots,
    basis = null,
    chapter = 'cover',
    screen = 'cover',
    lens = null,
    searchParams = {},
  } = props;
  const page = findPage(outline, chapter, screen);
  if (page === null) return null;
  return (
    <NativeFrame data={props} page={page}>
      <PlanBody
        context={context}
        outline={outline}
        page={page}
        progress={progress}
        snapshots={snapshots}
        basis={basis}
        lens={lens}
        query={searchParams}
      />
    </NativeFrame>
  );
}
function ThingSheet({
  inspection,
  before,
  lookup,
}: {
  readonly inspection: ModelInspection | null;
  readonly before: boolean;
  readonly lookup: ModelPlanLabels;
}) {
  if (inspection === null) {
    return (
      <Callout title="Not present in this view">
        This record is not present in the selected view. Use the other view to inspect additions or
        removals.
      </Callout>
    );
  }
  return (
    <>
      <ModelPlanAssets
        assets={modelAssetsOf(lookup.context, inspection.view.id, lookup.version, lookup.planBase)}
      />
      <EntityHead heading="h1" view={inspection.view} today={before} />
      <EntityDetailsContent
        view={inspection.view}
        today={before}
        image={null}
        renderText={(text) => <ModelPlanText text={text} lookup={lookup} />}
      />
      {inspection.gaps.length === 0 ? null : (
        <Callout title="Gaps">
          <List>
            {inspection.gaps.map((gap) => (
              <ListItem key={`${gap.id}:${gap.kind}:${gap.message}`}>{gap.message}</ListItem>
            ))}
          </List>
        </Callout>
      )}
      <details>
        <summary>Recorded detail</summary>
        <ModelPlanValue value={inspection.raw} lookup={lookup} />
      </details>
      {inspection.view.sources.map((source) => (
        <TextLink key={source.href} href={source.href}>
          {source.label}
        </TextLink>
      ))}
    </>
  );
}
/** A native thing page uses the same inspection factory as the on-demand browser inspector. */
export function ModelPlanThingPage(props: ModelPlanPageProps & { readonly token: string }) {
  const { context, outline, token, searchParams = {} } = props;
  const before = isBeforeView({ chapter: 'ref' }, searchParams);
  const id = tokenToId(token);
  const version = before ? 'before' : 'after';
  const inspection = id === null ? null : modelInspectionOf(context, id, version);
  const page: Page = {
    chapter: 'ref',
    screen: 'things',
    title: inspection?.view.name ?? 'Things',
    href: `${planHref(outline)}things/`,
  };
  const index = before ? context.beforeIndex : context.afterIndex;
  const lookup: ModelPlanLabels = {
    context,
    version: before ? 'before' : 'after',
    planBase: planHref(outline),
    index,
    labelOf: (referenceId) =>
      modelInspectionRef(context, referenceId, before ? 'before' : 'after').label,
  };
  return (
    <NativeFrame data={props} page={page}>
      <Stack gap={3}>
        <VersionSwitch page={page} before={before} query={{ ...searchParams, id: token }} />
        <ThingSheet inspection={inspection} before={before} lookup={lookup} />
      </Stack>
    </NativeFrame>
  );
}
