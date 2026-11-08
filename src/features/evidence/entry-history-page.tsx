import { entryFlowHref } from '@/application/entry-flow-paths';
import {
  historicalDataPin,
  historicalEntryHref,
  type EntryHistory,
  type HistoricalAddress,
} from '@/application/entry-history';
import { explorerDrawing } from '@/application/explorer-drawing';
import { archiveHref } from '@/application/interpretation-archive';
import { workspaceHref } from '@/application/workspace-paths';
import { repositoryTreeUrl } from '@/domain/code-links';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { Callout } from '@/ui/callout';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

import { HistoricalCanvas } from './historical-canvas.client';
import { HistoricalEntries, HistoricalIndex, HistoricalRepositories } from './history-lists.client';

type Snapshot = Extract<EntryHistory, { readonly kind: 'snapshot' }>;

function ScopeLinks({
  workspace,
  history,
}: {
  readonly workspace: string;
  readonly history: Exclude<EntryHistory, { readonly kind: 'directory' }>;
}) {
  const { scope, overview, callers, sourceIndex } = history;
  return (
    <Cluster>
      <TextLink href={historicalEntryHref(workspace)}>All repository snapshots</TextLink>
      <TextLink href={historicalEntryHref(workspace, { scope: scope.key, page: overview })}>
        Repository overview
      </TextLink>
      <TextLink href={historicalEntryHref(workspace, { scope: scope.key, page: callers })}>
        Recorded references
      </TextLink>
      <TextLink
        href={
          scope.publication === 'live'
            ? archiveHref(workspace, scope)
            : `${workspaceHref(workspace)}evidence/`
        }
      >
        Archived interpretations
      </TextLink>
      {sourceIndex === undefined ? null : (
        <TextLink href={historicalEntryHref(workspace, { scope: scope.key, page: sourceIndex })}>
          Source files
        </TextLink>
      )}
      <TextLink href={repositoryTreeUrl(scope.repo, scope.commit)}>
        Repository at this revision
      </TextLink>
    </Cluster>
  );
}

function snapshotAddress(scope: Snapshot['scope'], page: string): HistoricalAddress {
  return scope.publication === 'fallback'
    ? { service: scope.service, page }
    : { scope: scope.key, page };
}

function SnapshotInspector({
  available,
  history,
  href,
  node,
}: {
  readonly available: (target: string) => boolean;
  readonly history: Snapshot;
  readonly href: (target: string, selection?: string) => string;
  readonly node: Snapshot['page']['nodes'][number];
}) {
  const { file, page } = history;
  const byId = new Map(page.nodes.map((item) => [item.id, item]));
  return (
    <Panel title={node.label}>
      <Stack>
        {node.target !== null && available(node.target) ? (
          <TextLink href={href(node.target)}>Open linked detail</TextLink>
        ) : null}
        {page.links
          .filter((link) => link.from === node.id || link.to === node.id)
          .map((link) => {
            const outgoing = link.from === node.id;
            const adjacent = byId.get(outgoing ? link.to : link.from);
            return (
              <Cluster key={link.id}>
                <Text>
                  {outgoing ? 'To' : 'From'} · {link.kind} · {link.label}
                </Text>
                {adjacent === undefined ? null : (
                  <TextLink href={href(file, adjacent.id)}>{adjacent.label}</TextLink>
                )}
              </Cluster>
            );
          })}
        <TextLink href={href(file)}>Clear selection</TextLink>
      </Stack>
    </Panel>
  );
}

function hasHistoricalDiagram(page: Snapshot['page']): boolean {
  return (
    page.kind !== 'data' &&
    (page.kind === 'flow' ||
      page.links.length > 0 ||
      page.nodes.some((item) => item.kind === 'component'))
  );
}

function SnapshotIndex({
  available,
  history,
  href,
}: {
  readonly available: (target: string) => boolean;
  readonly history: Snapshot;
  readonly href: (target: string) => string;
}) {
  const { file, page } = history;
  const indexDetail = page.kind === 'callers' || file === history.interpretationIndex;
  return page.kind === 'flow' ? (
    page.nodes.flatMap((item) =>
      item.target !== null && available(item.target)
        ? [
            <TextLink href={href(item.target)} key={item.id}>
              {item.label}
            </TextLink>,
          ]
        : [],
    )
  ) : (
    <HistoricalIndex
      items={page.nodes.map((item) => ({
        id: item.id,
        label: item.label,
        detail: indexDetail ? item.detail : undefined,
        href: item.target !== null && available(item.target) ? href(item.target) : null,
      }))}
    />
  );
}

function SnapshotDetail({
  workspace,
  history,
}: {
  readonly workspace: string;
  readonly history: Snapshot;
}) {
  const { page, scope, file, selected } = history;
  const known = new Set(history.links);
  const available = (target: string): boolean => history.complete || known.has(target);
  const node = page.nodes.find((item) => item.id === selected);
  const href = (target: string, selection?: string): string =>
    historicalEntryHref(workspace, { ...snapshotAddress(scope, target), node: selection });
  const pagePin = scope.publication === 'fallback' ? historicalDataPin(page) : null;
  const sourceIds = node === undefined ? null : new Set(node.sourceIds);
  const sources = page.sources.filter((source) => sourceIds === null || sourceIds.has(source.id));
  return (
    <Stack gap={4}>
      <Text as="p">{page.description}</Text>
      {pagePin === null ? null : (
        <TextLink href={repositoryTreeUrl(pagePin.repo, pagePin.commit)}>
          Data source · {pagePin.repo} · {pagePin.commit}
        </TextLink>
      )}
      {history.entries
        .filter((entry) => entry.file === file)
        .map((entry) =>
          entry.native === null ? null : (
            <TextLink href={entryFlowHref(workspace, { entry: entry.native })} key={entry.id}>
              Current entry · {entry.label}
            </TextLink>
          ),
        )}

      <Text tone="muted">
        {page.completeSelection ? 'Selected source evidence' : 'Partial source evidence'} · runtime
        and deployment unverified
      </Text>
      {hasHistoricalDiagram(page) ? (
        <HistoricalCanvas
          file={file}
          drawing={explorerDrawing(page)}
          label={page.title}
          scope={scope.key}
          selected={selected}
          workspace={workspace}
        />
      ) : null}
      {node === undefined ? null : (
        <SnapshotInspector available={available} history={history} href={href} node={node} />
      )}
      {page.fields.map((field, position) => (
        <Panel key={`${field.name}-${String(position)}`} title={field.name}>
          <Text>
            {field.type} · Required {field.required} · Nullable {field.nullable}
          </Text>
        </Panel>
      ))}
      <SnapshotIndex available={available} history={history} href={href} />
      {page.incoming !== undefined && available(page.incoming) ? (
        <TextLink href={href(page.incoming)}>References in this view</TextLink>
      ) : null}
      {sources.map((source) => (
        <TextLink href={source.url} key={source.id}>
          {source.label}
        </TextLink>
      ))}
      {page.gaps.map((gap, position) => (
        <Text key={`${String(position)}-${gap}`} tone="muted">
          {gap}
        </Text>
      ))}
    </Stack>
  );
}

export function EntryHistoryPage({
  workspace,
  history,
}: {
  readonly workspace: string;
  readonly history: EntryHistory;
}) {
  const base = workspaceHref(workspace);
  const selectedTitle = history.kind === 'snapshot' ? history.page.title : 'Historical entries';
  const title = 'title' in history ? history.title : selectedTitle;
  return (
    <AppShell
      bar={<AppBar title="Historical entries" trail={[{ label: workspace, href: base }]} />}
      wide
    >
      <PageHeader
        title={title}
        meta={
          history.kind === 'directory'
            ? null
            : `Browsing ${history.scope.repo} · ${history.scope.commit}`
        }
      />
      {history.kind === 'directory' ? (
        <Stack>
          <TextLink href={entryFlowHref(workspace)}>Current entry flows</TextLink>
          <HistoricalRepositories scopes={history.scopes} workspace={workspace} />
        </Stack>
      ) : (
        <Stack gap={4}>
          <ScopeLinks history={history} workspace={workspace} />
          {history.kind === 'snapshot' ? (
            <SnapshotDetail history={history} workspace={workspace} />
          ) : (
            <Callout
              title={
                history.kind === 'retired'
                  ? 'Method browsing retired'
                  : 'Historical selection unavailable'
              }
            >
              <Stack>
                {history.sources.map((source) => (
                  <TextLink href={source.url} key={source.url}>
                    {source.label}
                  </TextLink>
                ))}
              </Stack>
            </Callout>
          )}
          <details>
            <summary>Entries at this revision</summary>
            <HistoricalEntries
              entries={history.entries}
              scope={history.scope.key}
              workspace={workspace}
            />
          </details>
        </Stack>
      )}
    </AppShell>
  );
}
