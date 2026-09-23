import type { TestContext } from 'node:test'
import { mkdtemp, realpath, rm, writeFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { git } from '../server/git.ts'
import { initialise } from '../server/setup.ts'
import { readPlan, writePlan } from '../server/repository.ts'
import { checkCatalogFreshness } from '../server/catalog-freshness.ts'
import { catalogId } from '../src/data/catalog-identity.ts'

/** The repository checkout, for spawning source-mode children and reading fixtures from any working directory. */
export const repoRoot = fileURLToPath(new URL('..', import.meta.url))
export const fixturePath = (relative: string) => path.join(repoRoot, 'tests/fixtures', relative)

/** A fresh directory under os.tmpdir(), removed when the test ends. Symlinks are resolved so paths compare equal. */
export async function tempDir(t: TestContext, prefix = 'groundwork-test-') {
  const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

/** Writes `files` (relative path → text) under `root`, creating parent directories. */
export async function writeFiles(root: string, files: Record<string, string>) {
  for (const [file, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), text)
  }
}

/** Initialises a git repository on `main` (identity comes from tests/setup.ts). */
export async function gitInit(root: string) {
  await mkdir(root, { recursive: true })
  await git(root, ['init', '-q', '-b', 'main'])
  return root
}

/** Stages everything and commits it; returns the new HEAD revision. */
export async function commitAll(root: string, message = 'Fixture') {
  await git(root, ['add', '-A'])
  await git(root, ['commit', '-q', '--allow-empty', '-m', message])
  return git(root, ['rev-parse', 'HEAD'])
}

/** The optimistic-concurrency guard every mutation takes, from a plan returned by readPlan. */
export const guard = (plan: { revision: string; context: { token: string } }) =>
  ({ expectedRevision: plan.revision, expectedContext: plan.context.token })

/** Sets environment variables for the rest of the test and restores the previous values afterwards. */
export function withEnv(t: TestContext, vars: Record<string, string | undefined>) {
  const previous = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]))
  const apply = (values: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  apply(vars)
  t.after(() => apply(previous))
}

/**
 * A committed source repository and a catalog whose `service` component cites it: one endpoint (handler.ts) and one
 * flow (helper.ts). `check` runs a freshness check of both against HEAD; `commit` changes one source file.
 */
export async function sourceCatalogFixture(t: TestContext) {
  const base = await tempDir(t, 'groundwork-freshness-')
  const source = await gitInit(path.join(base, 'source')), target = path.join(base, 'catalog')
  await writeFiles(source, {
    'handler.ts': 'callHelper()\n', 'helper.ts': 'return 1\n', 'unmapped.ts': 'return true\n', 'package-lock.json': '{"version":1}\n',
  })
  const revision = await commitAll(source, 'Observed source')
  await initialise(target, { id: 'freshness', name: 'Freshness' })
  const p = await readPlan(target)
  const endpoint = {
    id: 'read', name: 'Read', method: 'GET', path: '/read', source: 'handler.ts',
    evidence: [{ path: 'handler.ts', lines: '1', revision, claim: 'Calls helper.' }],
  }
  const helperStep = {
    id: 'helper', title: 'Helper', kind: 'logic', description: 'Helper returns a value.',
    evidence: [{ path: 'helper.ts', lines: '1', revision, claim: 'Returns a value.' }],
  }
  const flow = {
    id: 'read-flow', endpointId: 'read', name: 'Read flow', summary: 'Handler uses helper.', sourceRevision: revision,
    entryStepId: 'helper', steps: [helperStep], transitions: [], gaps: [],
  }
  const component = {
    id: 'service', productId: 'app', name: 'Service', repo: source, sourceRevision: revision,
    api: { name: 'API', endpoints: [endpoint] }, executionFlows: [flow],
  }
  await writePlan(target, { ...guard(p), changes: { 'components/service.json': JSON.stringify(component) } })
  const ids = [catalogId('freshness', 'service', 'endpoint', 'read'), catalogId('freshness', 'service', 'flow', 'read-flow')]
  const check = (patch = {}) => checkCatalogFreshness(target, { repositoryPath: source, targetRef: 'HEAD', ids, ...patch })
  const commit = async (file: string, value: string) => {
    await writeFile(path.join(source, file), value)
    await commitAll(source, 'Changed source')
  }
  return { source, target, revision, component, ids, check, commit }
}
