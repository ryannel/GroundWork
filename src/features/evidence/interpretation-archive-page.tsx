import {
  archiveHref,
  type ArchiveScope,
  type InterpretationArchive,
} from '@/application/interpretation-archive';
import { workspaceHref } from '@/application/workspace-paths';
import { AppBar } from '@/ui/app-bar';
import { AppShell } from '@/ui/app-shell';
import { PageHeader } from '@/ui/page-header';
import { Panel } from '@/ui/panel';
import { Cluster, Stack } from '@/ui/stack';
import { Text, TextLink } from '@/ui/text';

function scopeQuery(scope: ArchiveScope): URLSearchParams {
  return new URLSearchParams({ repo: scope.repo, commit: scope.commit });
}

export function ArchiveDirectory({
  workspace,
  repositories,
}: {
  readonly workspace: string;
  readonly repositories: readonly ArchiveScope[];
}) {
  const base = workspaceHref(workspace);
  return (
    <AppShell bar={<AppBar title="Evidence" trail={[{ label: workspace, href: base }]} />}>
      <PageHeader title="Archived interpretations" />
      <Stack>
        {repositories.length === 0 ? <Text>No interpretation archive is available.</Text> : null}
        {repositories.map((scope) => (
          <TextLink href={archiveHref(workspace, scope)} key={`${scope.repo}@${scope.commit}`}>
            {scope.repo} · {scope.commit}
          </TextLink>
        ))}
      </Stack>
    </AppShell>
  );
}

export function ArchiveRepository({
  workspace,
  scope,
  archive,
}: {
  readonly workspace: string;
  readonly scope: ArchiveScope;
  readonly archive: InterpretationArchive;
}) {
  const base = workspaceHref(workspace);
  const artifact = (key: string): string => {
    const query = scopeQuery(scope);
    query.set('artifact', key);
    return `${base}evidence/archive/?${query.toString()}`;
  };
  return (
    <AppShell bar={<AppBar title="Evidence" trail={[{ label: workspace, href: base }]} />}>
      <PageHeader
        title={scope.repo}
        meta={scope.commit}
        description="Published interpretations from this pinned repository."
      />
      <Stack gap={4}>
        <TextLink href={`${base}evidence/`}>All archived repositories</TextLink>
        <Cluster>
          <TextLink href={artifact('interpretation')}>Original interpretation</TextLink>
          <TextLink href={artifact('review')}>Original review</TextLink>
          <TextLink href={artifact('inputs')}>Original input manifest</TextLink>
          {archive.seal ? <TextLink href={artifact('seal')}>Interpretation seal</TextLink> : null}
          {archive.independentReview ? (
            <TextLink href={artifact('independent-review')}>Independent review</TextLink>
          ) : null}
          {archive.contexts.map((context) => (
            <TextLink key={context.id} href={artifact(context.sha256)}>
              Examined context · {context.id}
            </TextLink>
          ))}
        </Cluster>
        {archive.claims.map((claim) => (
          <section id={claim.id} key={claim.id}>
            <Panel title={claim.statement}>
              <Stack>
                <Text>
                  Inferred · {claim.confidence} confidence · {claim.kind}
                </Text>
                <Text>{claim.reasoning}</Text>
                {claim.limitations.map((limitation) => (
                  <Text key={limitation}>{limitation}</Text>
                ))}
                {claim.canonicalId === null ? (
                  <Text tone="muted">Archived with its original context snapshot.</Text>
                ) : (
                  <TextLink
                    href={`${base}things/?${new URLSearchParams({ id: claim.canonicalId }).toString()}`}
                  >
                    View canonical evidence
                  </TextLink>
                )}
              </Stack>
            </Panel>
          </section>
        ))}
      </Stack>
    </AppShell>
  );
}
