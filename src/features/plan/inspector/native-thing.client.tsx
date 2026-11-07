'use client';

import { type ReactNode, use, useEffect, useState, useTransition } from 'react';

import { modelAssetsOf } from '@/application/model-assets';
import {
  modelInspectionOf,
  modelInspectionRef,
  type ModelInspection,
} from '@/application/model-inspection';
import type { ModelQueryContext } from '@/application/model-reader';
import { assetUrl } from '@/application/plan-viz-screens';
import { thingAt } from '@/application/thing-paths';
import type { Reader } from '@/application/today-reader';
import { isAuthoredReference, kindOf } from '@/domain/ids';
import { modelRecord } from '@/domain/workspace-model';
import { ModelPlanAssets } from '@/features/plan/model-plan-assets';
import { pendingNativeModel } from '@/features/plan/plan-model';
import { Callout } from '@/ui/callout';
import { CodeBlock } from '@/ui/code-block';
import { Markdown } from '@/ui/markdown';
import { Mention } from '@/ui/mention';

import { EntityDetailsContent } from './entity-details';
import { EntityHead } from './entity-head';
import { EntityPlaces } from './entity-places';
import { InspectorBar } from './inspector-bar.client';
import { InspectorBody } from './inspector-body';
import { NativeInspectionExtras } from './native-inspection-extras';
import { NativeProgress } from './native-progress';
import { revisionSrc, VersionJump } from './version-jump.client';
import { ViewSwitch } from './view-switch.client';

interface ContentProps {
  readonly inspection: ModelInspection;
  readonly context: ModelQueryContext;
  readonly reader: Reader;
  readonly today: boolean;
}
function InspectionContent({ inspection, context, reader, today }: ContentProps) {
  const [detail, setDetail] = useState(false);
  const { view } = inspection;
  const version = today ? 'before' : 'after';
  return (
    <InspectorBody>
      <EntityHead view={view} today={today} />
      {inspection.gaps.length === 0 ? null : (
        <Callout title="Gaps">
          <ul>
            {inspection.gaps.map((gap, position) => (
              <li key={`${gap.id}:${gap.kind}:${String(position)}`}>{gap.message}</li>
            ))}
          </ul>
        </Callout>
      )}
      <EntityDetailsContent
        view={view}
        today={today}
        image={view.image === null ? null : assetUrl(reader.assetBase, view.image)}
        renderText={(text) => (
          <Markdown
            text={text}
            isReference={isAuthoredReference}
            renderRef={(id) => <Mention {...modelInspectionRef(context, id, version)} />}
          />
        )}
      />
      <ModelPlanAssets
        assets={modelAssetsOf(
          context,
          view.id,
          version,
          reader.mode === 'plan' ? reader.assetBase : undefined,
        )}
      />
      <NativeInspectionExtras
        index={today ? context.beforeIndex : context.afterIndex}
        id={view.id}
      />
      <NativeProgress context={context} id={view.id} />
      <EntityPlaces
        here=""
        sources={view.sources}
        places={[]}
        mentionedIn={view.mentionedIn}
        mentionedParts={view.mentionedParts}
      />
      <details
        onToggle={(event) => {
          setDetail(event.currentTarget.open);
        }}
      >
        <summary>Recorded detail</summary>
        {detail ? (
          <CodeBlock label="Recorded fields">{JSON.stringify(inspection.raw, null, 2)}</CodeBlock>
        ) : null}
      </details>
    </InspectorBody>
  );
}
function isInspection(value: unknown): value is { readonly inspection: ModelInspection } {
  const data = modelRecord(value);
  const inspection = modelRecord(data?.inspection);
  return (
    modelRecord(inspection?.view) !== null &&
    modelRecord(inspection?.raw) !== null &&
    Array.isArray(inspection?.gaps)
  );
}
interface EvidenceRead {
  readonly src: string;
  readonly state: 'loaded' | 'absent' | 'failed';
  readonly inspection: ModelInspection | null;
}
/** Unloaded evidence is queried explicitly; it is not labelled missing before the server answers. */
function UnloadedEvidence({
  id,
  context,
  reader,
}: {
  readonly id: string;
  readonly context: ModelQueryContext;
  readonly reader: Reader;
}) {
  const source = new URL(reader.modelSrc, globalThis.location.href);
  const lookup = new URL(context.profile?.lookup ?? 'evidence.json', source);
  lookup.searchParams.set('id', id);
  const src = lookup.href;
  const [read, setRead] = useState<EvidenceRead | null>(null);
  useEffect(() => {
    let live = true;
    void fetch(src, { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 404) return { src, state: 'absent' as const, inspection: null };
        if (!response.ok) throw new Error('Evidence read failed.');
        const body: unknown = await response.json();
        if (!isInspection(body)) throw new Error('Evidence response is invalid.');
        return { src, state: 'loaded' as const, inspection: body.inspection };
      })
      .then(
        (result) => {
          if (live) setRead(result);
        },
        () => {
          if (live) setRead({ src, state: 'failed', inspection: null });
        },
      );
    return () => {
      live = false;
    };
  }, [src]);
  if (read?.src !== src) return <p>Loading evidence…</p>;
  if (read.inspection !== null) {
    return (
      <InspectionContent inspection={read.inspection} context={context} reader={reader} today />
    );
  }
  return (
    <Callout
      title={read.state === 'absent' ? 'Evidence not recorded' : 'Evidence could not be loaded'}
    >
      <p>
        {read.state === 'absent'
          ? `No current evidence record has the id ${id}.`
          : 'Reload to try this evidence again.'}
      </p>
    </Callout>
  );
}
interface NativeThingProps {
  readonly id: string;
  readonly reader: Reader;
  readonly head: ModelQueryContext;
}
interface SelectedProps {
  readonly id: string;
  readonly reader: Reader;
  readonly context: ModelQueryContext;
  readonly inspection: ModelInspection | null;
  readonly today: boolean;
}
function SelectedInspection({ id, reader, context, inspection, today }: SelectedProps) {
  if (inspection !== null) {
    return (
      <InspectionContent
        inspection={inspection}
        context={context}
        reader={reader}
        today={context.plan === null || today}
      />
    );
  }
  if (kindOf(id) === 'evidence' && context.profile !== null) {
    return <UnloadedEvidence id={id} context={context} reader={reader} />;
  }
  if (today && context.afterIndex.get(id) !== null) {
    return <p>New in this plan; not present before it.</p>;
  }
  return <p>{`Nothing called ${id} is recorded in this view.`}</p>;
}
function NativeView({
  id,
  reader,
  context,
  children,
}: {
  readonly id: string;
  readonly reader: Reader;
  readonly context: ModelQueryContext;
  readonly children: ReactNode;
}) {
  const [before, setBefore] = useState(false);
  const version = before ? 'before' : 'after';
  const inspection = modelInspectionOf(context, id, version);
  const page = reader.pages?.[id] ?? thingAt(reader.thingBase, id);
  return (
    <>
      <InspectorBar
        id={id}
        model={{ label: (reference) => modelInspectionRef(context, reference, version).label }}
        page={page}
      />
      {children}
      {context.plan === null || inspection?.view.planLevel === true ? null : (
        <ViewSwitch today={before} onChange={setBefore} beforeLabel="before this plan" />
      )}
      <SelectedInspection
        key={`${id}:${String(before)}`}
        id={id}
        reader={reader}
        context={context}
        inspection={inspection}
        today={before}
      />
    </>
  );
}

export function NativeThing({ id, reader, head }: NativeThingProps) {
  const [version, setVersion] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const shown =
    version === null ? head : use(pendingNativeModel(revisionSrc(reader.modelSrc, version)).model);
  const jump = (next: string | null): void => {
    startTransition(() => {
      setVersion(next);
    });
  };
  const versions =
    head.plan === null ? null : <VersionJump plan={head.plan} onChange={jump} value={version} />;
  if (shown === null) {
    return (
      <>
        <InspectorBar
          id={id}
          model={{ label: (reference) => modelInspectionRef(head, reference).label }}
        />
        {versions}
        <p>{`No copy of version ${version ?? ''} was kept.`}</p>
      </>
    );
  }
  return (
    <NativeView key={`${id}:${version ?? ''}`} id={id} reader={reader} context={shown}>
      {versions}
    </NativeView>
  );
}

/** The shared inspector reads the canonical browser envelope on demand. */
export function NativeThingLoader({ id, reader }: Omit<NativeThingProps, 'head'>) {
  const head = use(pendingNativeModel(reader.modelSrc).model);
  if (head !== null) return <NativeThing id={id} reader={reader} head={head} />;
  const what = reader.mode === 'plan' ? 'The plan' : 'How the systems work today';
  return (
    <>
      <InspectorBar id={id} model={null} />
      <p>{`${what} could not be loaded.`}</p>
    </>
  );
}
