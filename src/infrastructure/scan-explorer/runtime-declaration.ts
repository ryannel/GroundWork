import 'server-only';

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import type { Source } from '@/domain/scan/scan.generated';
import type { DeclaredRuntimeBinding } from '@/domain/scan-explorer/current-contracts';

interface RuntimeRequest {
  readonly repository: string;
  readonly repo: string;
  readonly commit: string;
  readonly applicationPath: string;
  readonly logicalId: string;
  readonly label: string;
}

function git(input: RuntimeRequest, args: readonly string[]): string {
  return execFileSync('/usr/bin/git', ['--no-optional-locks', '-C', input.repository, ...args], {
    encoding: 'utf8',
    maxBuffer: 2_000_000,
    timeout: 10_000,
  }).trimEnd();
}

function declaration(input: RuntimeRequest, path: string, text: string): Source {
  const key = `${input.repo}:${input.commit}:${path}`;
  return {
    kind: 'source',
    id: `runtime-source:${createHash('sha256').update(key).digest('hex')}`,
    repo: input.repo,
    commit: input.commit,
    path,
    blob: git(input, ['rev-parse', `${input.commit}:${path}`]),
    lines: [1, text.split('\n').length],
    host: 'github.com',
    authority: 'declared',
  };
}

function linkedModules(
  input: RuntimeRequest,
  root: string,
): {
  readonly paths: readonly string[];
  readonly declarations: readonly Source[];
} {
  const rootPom = git(input, ['show', `${input.commit}:pom.xml`]);
  const paths = [...rootPom.matchAll(/<module>([^<]+)<\/module>/gu)]
    .map((match) => match[1])
    .filter((path) => path !== undefined);
  const poms = paths.map((path) => ({
    path,
    text: git(input, ['show', `${input.commit}:${path}/pom.xml`]),
  }));
  const reached = new Set([root]);
  let changed = true;
  while (changed) {
    const additions = poms
      .filter((pom) => reached.has(pom.path))
      .flatMap((pom) =>
        paths.filter(
          (target) =>
            !reached.has(target) && pom.text.includes(`<artifactId>${target}</artifactId>`),
        ),
      );
    changed = additions.length > 0;
    for (const target of additions) reached.add(target);
  }
  return {
    paths: [...reached].map((path) => `${path}/`),
    declarations: [
      declaration(input, 'pom.xml', rootPom),
      ...poms
        .filter((pom) => reached.has(pom.path))
        .map((pom) => declaration(input, `${pom.path}/pom.xml`, pom.text)),
    ],
  };
}

/** Explicit source runtime identity; Maven modules only join through declared dependency paths. */
export function declaredSpringRuntime(input: RuntimeRequest): DeclaredRuntimeBinding {
  if (!/^[a-f\d]{40}$/u.test(input.commit)) {
    throw new Error('Runtime declaration needs a full pinned commit');
  }
  const application = git(input, ['show', `${input.commit}:${input.applicationPath}`]);
  if (
    !application.includes('@SpringBootApplication') ||
    !application.includes('SpringApplication.run(')
  ) {
    throw new Error('Source does not declare a Spring Boot runtime entry');
  }
  const applicationModule = input.applicationPath.split('/')[0];
  if (applicationModule === undefined) throw new Error('Runtime application module is missing');
  const modules = linkedModules(input, applicationModule);
  const applicationSource = declaration(input, input.applicationPath, application);
  const sources = [applicationSource, ...modules.declarations];
  const ids = sources.map((source) => source.id);
  return {
    component: {
      id: `runtime:${input.logicalId}@${input.commit}`,
      kind: 'runtime_component',
      logicalId: input.logicalId,
      label: input.label,
      category: 'service',
      technology: 'Spring Boot',
      sources: [applicationSource.id, ...ids.slice(1)],
      basis: 'source_declared',
      evidence: [sources[0]?.id ?? 'missing', ...ids.slice(1)],
      gaps: [],
    },
    repo: input.repo,
    commit: input.commit,
    declarations: sources,
    modulePaths: modules.paths,
    verification: 'pinned_runtime_declaration',
    limitations: [
      'One source-declared Spring Boot host; repository and module names do not establish deployment',
      'Maven dependency closure establishes available source modules; conditional registration and runtime execution remain unverified',
    ],
  };
}
