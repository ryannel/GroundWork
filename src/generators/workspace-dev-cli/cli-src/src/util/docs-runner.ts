import * as fs from 'fs';
import * as path from 'path';
import { Runner } from './runners';
import { ROOT } from './paths';

/** Locate the registered runner that boots the project's docs site.
 *
 *  Discovery is name-independent: it probes every registered runner's `cwd`
 *  for a `package.json` whose `scripts` map carries a `sync-live-bets` entry —
 *  the docs-site generator always wires exactly that script
 *  (files/package.json), regardless of what the runner or service directory
 *  is named. Returns null when no runner matches, including workspaces with
 *  no docs site scaffolded at all. Fails soft on any unreadable/malformed
 *  package.json — a bad neighbor never stops discovery of the real one. */
export function findDocsRunner(runners: Runner[]): Runner | null {
  for (const runner of runners) {
    const cwd = runner.cwd ? path.join(ROOT, runner.cwd) : ROOT;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) as {
        scripts?: Record<string, unknown>;
      };
      if (pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, 'sync-live-bets')) {
        return runner;
      }
    } catch {
      continue;
    }
  }
  return null;
}
