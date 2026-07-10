import * as path from 'path';
import { Ctx } from '../util/context';
import { httpProbe, run, sleep } from '../util/proc';
import { isRunning } from '../util/services';
import { ROOT, logFile } from '../util/paths';
import { findDocsRunner } from '../util/docs-runner';
import { bootRunner } from './lifecycle';

/** Poll a URL until something answers (any status code proves the port is
 *  live — a dev server mid-compile can still 404/500) or the deadline
 *  passes. */
async function waitForPort(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    const code = await httpProbe(url, 2000);
    if (code > 0) return true;
    await sleep(1000);
  } while (Date.now() < deadline);
  return false;
}

/** `./dev docs` — boot-or-refresh the project's docs site and print its URL
 *  (review-throughput C1). The docs runner is found name-independently: any
 *  registered runner whose cwd carries a package.json with a `sync-live-bets`
 *  script (the docs-site generator always wires exactly that one —
 *  files/package.json) is treated as the docs runner, so a renamed runner or
 *  service directory is still discovered. */
export async function docs(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const runner = findDocsRunner(ctx.runners);

  if (!runner) {
    r.info('No docs site scaffolded — accept the docs-site offer at scaffold, or add the generator.');
    return 0;
  }

  const port = runner.env?.PORT || '4000';
  const url = `http://localhost:${port}`;
  const cwd = runner.cwd ? path.join(ROOT, runner.cwd) : ROOT;

  if (isRunning(runner.name)) {
    // Already serving — a one-shot refresh so newly opened worktree/branch
    // bets show up without a restart. Fail-soft: a broken sync never hides
    // the (still-live) URL behind it.
    r.startSpinner('Refreshing the live docsite window');
    const code = run('node', ['scripts/sync-live-bets.js'], { cwd });
    if (code === 0) {
      r.stopSpinner('Docs site refreshed');
    } else {
      r.failSpinner('sync-live-bets.js failed — the docs site keeps serving what it last synced');
    }
    r.success(`Docs site: ${url}`);
    return 0;
  }

  const pid = await bootRunner(r, runner);
  if (pid === null) {
    // bootRunner already rendered the error card.
    return 1;
  }

  r.startSpinner('Waiting for the docs site to answer');
  const live = await waitForPort(url, 90000);
  if (!live) {
    r.failSpinner('Docs site did not answer in time');
    r.errorCard(
      `${runner.name} started but never answered on ${url}`,
      `Check ${logFile(runner.name)} for the cause.`,
    );
    return 1;
  }
  r.stopSpinner('Docs site is live');
  r.success(`Docs site: ${url}`);
  return 0;
}
