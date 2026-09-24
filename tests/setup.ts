/**
 * Loaded before every test file (`node --test --import ./tests/setup.ts`). It makes the suite hermetic:
 * git ignores the developer's global and system config (commit signing, templates, hooks paths, autocrlf),
 * commits get a fixed identity, and the Groundwork registry and scan directories live in a per-process
 * temp dir instead of ~/.config/groundwork and the shared os.tmpdir()/groundwork-scans.
 * Child processes spawned by tests inherit the same environment.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const isolated = mkdtempSync(path.join(os.tmpdir(), 'groundwork-test-env-'))
Object.assign(process.env, {
  GIT_CONFIG_GLOBAL: os.devNull,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Groundwork tests',
  GIT_AUTHOR_EMAIL: 'tests@example.invalid',
  GIT_COMMITTER_NAME: 'Groundwork tests',
  GIT_COMMITTER_EMAIL: 'tests@example.invalid',
  GROUNDWORK_HOME: path.join(isolated, 'home'),
  GROUNDWORK_TMPDIR: path.join(isolated, 'tmp'),
})
process.on('exit', () => rmSync(isolated, { recursive: true, force: true }))
