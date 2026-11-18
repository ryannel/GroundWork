'use client';

import { useEffect, useState } from 'react';

import type {
  EndpointExplorerView,
  EndpointStep,
  EndpointSchema,
  EndpointStore,
} from '@/application/endpoint-explorer';
import type { Reader } from '@/application/today-reader';
import { modelRecord } from '@/domain/workspace-model';
import { open } from '@/features/plan/inspector-history';
import { Badge } from '@/ui/badge';
import { Callout } from '@/ui/callout';
import { DataTable } from '@/ui/data-table';
import { FilterChips } from '@/ui/filter-chips';
import { Mention } from '@/ui/mention';
import { Select } from '@/ui/select';
import { Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import styles from './endpoint-explorer.module.css';
import { InspectorBar } from './inspector-bar.client';
import { InspectorBody } from './inspector-body';

type View = 'contract' | 'logic' | 'data';

const NONE: readonly string[] = [];

interface Read {
  readonly src: string;
  readonly endpoint: EndpointExplorerView | null;
  readonly failed: boolean;
}

function isEndpoint(value: unknown): value is { readonly endpoint: EndpointExplorerView } {
  const endpoint = modelRecord(modelRecord(value)?.endpoint);
  return typeof endpoint?.id === 'string' && typeof endpoint.signature === 'string';
}

function Fields({
  schema,
  touched = NONE,
}: {
  readonly schema: EndpointSchema;
  readonly touched?: readonly string[];
}) {
  if (schema.fields.length === 0) {
    return <Text tone="muted">No fields are recorded for {schema.name}.</Text>;
  }
  return (
    <DataTable
      caption={schema.name}
      captionHidden
      columns={[
        { key: 'name', label: 'Field' },
        { key: 'mark', label: '', compact: true },
      ]}
      rows={schema.fields.map((field) => ({
        key: field.name,
        cells: {
          name: (
            <span
              className={styles.field}
              data-touched={touched.includes(field.name) ? '' : undefined}
            >
              <span className={styles.fieldLine}>
                <code>{field.name}</code>
                {field.ref === null ? (
                  <span className={styles.type}>{field.type}</span>
                ) : (
                  <Mention id={field.ref} label={field.type} mono />
                )}
              </span>
              {field.note === null ? null : (
                <Text size="sm" tone="muted">
                  {field.note}
                </Text>
              )}
            </span>
          ),
          mark: (
            <>
              {field.key ? <Badge tone="accent">key</Badge> : null}
              {field.required ? <Badge>required</Badge> : null}
            </>
          ),
        },
      }))}
    />
  );
}

function Shape({
  title,
  schema,
}: {
  readonly title: string;
  readonly schema: EndpointSchema | null;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>
        {title}
        {schema === null ? null : <Mention id={schema.id} label={schema.name} mono />}
      </h3>
      {schema === null ? (
        <Text tone="muted">No {title.toLowerCase()} body is recorded.</Text>
      ) : (
        <Fields schema={schema} />
      )}
    </section>
  );
}

function Contract({ endpoint }: { readonly endpoint: EndpointExplorerView }) {
  const params = [
    ...endpoint.params.path.map((name) => ({ name, place: 'path' })),
    ...endpoint.params.query.map((name) => ({ name, place: 'query' })),
  ];
  return (
    <>
      {params.length === 0 ? null : (
        <section className={styles.section}>
          <h3 className={styles.heading}>Parameters</h3>
          <DataTable
            caption="Parameters"
            captionHidden
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'place', label: 'In', compact: true },
            ]}
            rows={params.map((param) => ({
              key: `${param.place}:${param.name}`,
              cells: { name: <code>{param.name}</code>, place: param.place },
            }))}
          />
        </section>
      )}
      <Shape schema={endpoint.request} title="Request" />
      <Shape schema={endpoint.response} title="Response" />
      {endpoint.errors.length === 0 ? null : (
        <section className={styles.section}>
          <h3 className={styles.heading}>Errors</h3>
          <DataTable
            caption="Errors"
            captionHidden
            columns={[
              { key: 'status', label: 'Status', compact: true },
              { key: 'when', label: 'When' },
            ]}
            rows={endpoint.errors.map((error, position) => ({
              key: `${error.status}-${String(position)}`,
              cells: { status: <code>{error.status}</code>, when: error.when },
            }))}
          />
        </section>
      )}
      <section className={styles.section}>
        <h3 className={styles.heading}>Called by</h3>
        {endpoint.callers.length === 0 ? (
          <Text tone="muted">No caller is recorded.</Text>
        ) : (
          <div className={styles.mentions}>
            {endpoint.callers.map((caller) => (
              <Mention id={caller.id} key={caller.id} label={caller.name} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Step({ node }: { readonly node: EndpointStep }) {
  return (
    <li className={styles.step} data-kind={node.kind}>
      <div className={styles.stepLine}>
        <span className={styles.kind}>{node.kind}</span>
        {node.title === node.kind ? null : <span>{node.title}</span>}
        {node.async ? <Badge>async</Badge> : null}
      </div>
      {node.condition === null ? null : (
        <Text size="sm" tone="muted">
          when {node.condition}
        </Text>
      )}
      {node.branches.map((branch, position) => (
        <div className={styles.branch} key={`${branch.label}-${String(position)}`}>
          {branch.label === 'steps' || branch.label === node.kind ? null : (
            <span className={styles.branchLabel}>
              {branch.label === 'Unnamed lane' ? 'alongside' : branch.label}
            </span>
          )}
          {branch.nodes.length === 0 ? (
            <Text size="sm" tone="muted">
              carries on below
            </Text>
          ) : (
            <ol className={styles.steps}>
              {branch.nodes.map((child) => (
                <Step key={child.id} node={child} />
              ))}
            </ol>
          )}
        </div>
      ))}
    </li>
  );
}

function Logic({ endpoint }: { readonly endpoint: EndpointExplorerView }) {
  return (
    <>
      {endpoint.handlers.length === 0 ? (
        <Callout title="No logic recorded">
          <p>No handler is recorded for this endpoint yet, so its steps are unknown.</p>
        </Callout>
      ) : (
        endpoint.handlers.map((handler) => (
          <section className={styles.section} key={handler.id}>
            <h3 className={styles.heading}>{handler.summary ?? 'Handler'}</h3>
            <ol className={styles.steps}>
              {handler.nodes.map((node) => (
                <Step key={node.id} node={node} />
              ))}
            </ol>
            {handler.failures.length === 0 ? null : (
              <>
                <h4 className={styles.subheading}>When it fails</h4>
                <ol className={styles.steps}>
                  {handler.failures.map((node) => (
                    <Step key={node.id} node={node} />
                  ))}
                </ol>
              </>
            )}
          </section>
        ))
      )}
      {endpoint.calls.length + endpoint.messages.length === 0 ? null : (
        <section className={styles.section}>
          <h3 className={styles.heading}>Reaches</h3>
          <div className={styles.mentions}>
            {[...endpoint.calls, ...endpoint.messages].map((target) => (
              <Mention id={target.id} key={target.id} label={target.name} />
            ))}
          </div>
        </section>
      )}
      <TextLink href={endpoint.logicHref}>Open the full logic flow →</TextLink>
    </>
  );
}

function Store({ store }: { readonly store: EndpointStore }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>
        <Mention id={store.id} label={store.name} />
        {store.form === null ? null : <Badge>{store.form}</Badge>}
      </h3>
      {store.technology === null ? null : (
        <Text size="sm" tone="muted">
          {store.technology}
        </Text>
      )}
      {store.tables.map((table) => (
        <div className={styles.table} key={table.id}>
          <h4 className={styles.subheading}>
            <Mention id={table.id} label={table.name} mono />
            {table.access.map((mode) => (
              <Badge key={mode} tone={mode === 'write' ? 'modified' : 'neutral'}>
                {mode}
              </Badge>
            ))}
          </h4>
          {table.summary === null ? null : <Text size="sm">{table.summary}</Text>}
          <Fields schema={table} touched={table.touched} />
        </div>
      ))}
      {store.others.length === 0 ? null : (
        <Text size="sm" tone="muted">
          Also holds {store.others.join(', ')}.
        </Text>
      )}
    </section>
  );
}

function Data({ endpoint }: { readonly endpoint: EndpointExplorerView }) {
  if (endpoint.stores.length === 0) {
    return (
      <Callout title="No data access recorded">
        <p>
          {endpoint.handlers.length === 0
            ? 'Without a recorded handler, the stores this endpoint reads and writes are unknown.'
            : 'Its recorded handler reads and writes no store.'}
        </p>
      </Callout>
    );
  }
  return (
    <>
      {endpoint.stores.map((store) => (
        <Store key={store.id} store={store} />
      ))}
    </>
  );
}

function Head({ endpoint }: { readonly endpoint: EndpointExplorerView }) {
  const [method = '', ...rest] = endpoint.signature.split(/\s+/u);
  return (
    <header className={styles.head}>
      <Text size="sm" tone="muted">
        Endpoint
      </Text>
      <h2 className={styles.signature}>
        <span className={styles.method} data-method={method}>
          {method}
        </span>
        <code>{rest.join(' ')}</code>
      </h2>
      {endpoint.summary === null ? null : <Text as="p">{endpoint.summary}</Text>}
      <div className={styles.meta}>
        {endpoint.component === null ? null : (
          <Mention id={endpoint.component.id} label={endpoint.component.name} />
        )}
        {endpoint.system === null ? null : (
          <Mention id={endpoint.system.id} label={endpoint.system.name} />
        )}
        {endpoint.team === null ? null : <Badge>{endpoint.team}</Badge>}
        {endpoint.idempotent === true ? <Badge>idempotent</Badge> : null}
      </div>
      {endpoint.auth === null ? null : (
        <Text size="sm" tone="muted">
          Auth · {endpoint.auth}
        </Text>
      )}
      {endpoint.operations.length < 2 ? null : (
        <Select
          label="Another operation of this component"
          onChange={open}
          options={endpoint.operations.map((operation) => ({
            value: operation.id,
            label: operation.name,
          }))}
          value={endpoint.id}
        />
      )}
    </header>
  );
}

function Explorer({ endpoint }: { readonly endpoint: EndpointExplorerView }) {
  const [view, setView] = useState<View>('contract');
  const tables = endpoint.stores.reduce((total, store) => total + store.tables.length, 0);
  const steps = endpoint.handlers.reduce((total, handler) => total + handler.nodes.length, 0);
  return (
    <InspectorBody>
      <Head endpoint={endpoint} />
      <FilterChips
        choices={[
          { value: 'contract', label: 'Contract' },
          { value: 'logic', label: 'Logic', count: steps },
          { value: 'data', label: 'Data', count: tables },
        ]}
        label="What to show"
        onChange={setView}
        value={view}
      />
      {view === 'contract' ? <Contract endpoint={endpoint} /> : null}
      {view === 'logic' ? <Logic endpoint={endpoint} /> : null}
      {view === 'data' ? <Data endpoint={endpoint} /> : null}
      {endpoint.sources.length === 0 ? null : (
        <Stack gap={1}>
          <Text size="sm" tone="muted">
            Code
          </Text>
          {endpoint.sources.map((source) => (
            <TextLink href={source.href} key={source.href}>
              {source.label}
            </TextLink>
          ))}
        </Stack>
      )}
    </InspectorBody>
  );
}

function Loaded({ id, read }: { readonly id: string; readonly read: Read | null }) {
  if (read === null) {
    return (
      <InspectorBody>
        <Text tone="muted">Loading the endpoint…</Text>
      </InspectorBody>
    );
  }
  if (read.endpoint !== null) return <Explorer endpoint={read.endpoint} />;
  return (
    <InspectorBody>
      <Callout title={read.failed ? 'Endpoint could not be loaded' : 'Endpoint not recorded'}>
        <p>{read.failed ? 'Reload to try again.' : `No endpoint has the id ${id}.`}</p>
      </Callout>
    </InspectorBody>
  );
}

/** An endpoint's contract, logic and data, read from the server rather than the whole browser model. */
export function EndpointExplorer({ id, reader }: { readonly id: string; readonly reader: Reader }) {
  const lookup = new URL('endpoint.json', new URL(reader.modelSrc, globalThis.location.href));
  lookup.searchParams.set('id', id);
  const src = lookup.href;
  const [read, setRead] = useState<Read | null>(null);
  useEffect(() => {
    let live = true;
    void fetch(src)
      .then(async (response) => {
        if (response.status === 404) return { src, endpoint: null, failed: false };
        if (!response.ok) throw new Error('Endpoint read failed.');
        const body: unknown = await response.json();
        if (!isEndpoint(body)) throw new Error('Endpoint response is invalid.');
        return { src, endpoint: body.endpoint, failed: false };
      })
      .then(
        (result) => {
          if (live) setRead(result);
        },
        () => {
          if (live) setRead({ src, endpoint: null, failed: true });
        },
      );
    return () => {
      live = false;
    };
  }, [src]);
  const names = new Map(
    (read?.endpoint?.operations ?? []).map((operation) => [operation.id, operation.name]),
  );
  const label = (reference: string): string => names.get(reference) ?? reference;
  return (
    <>
      <InspectorBar id={id} model={{ label }} />
      <Loaded id={id} read={read?.src === src ? read : null} />
    </>
  );
}
