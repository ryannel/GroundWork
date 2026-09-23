import type { TestContext } from 'node:test'
import { mkdtemp, realpath, rm, writeFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { git } from '../server/git.ts'

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
