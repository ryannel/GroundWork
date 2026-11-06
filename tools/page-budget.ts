// Holds every page under a weight a reader can open at once. A page's HTML carries both what it draws and the
// payload React hydrates from, so a page that draws what the reader has not asked for (every stop of a walk, every
// field of every endpoint, every mode of a catalogue) shows here first. Run after npm run build: it starts the
// built site, follows its links from the home page, weighs each page once, and stops the site.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { workspaceRegistrations } from '@/infrastructure/workspace-folders';

import { judge, kilobytes, pageLinks, type PageSize } from './page-budget-rules';

/** The most one page may weigh, uncompressed. */
const LIMIT = 1024 * 1024;
const TOP = 10;
const AT_ONCE = 8;
// Query-driven flows are not reached by the path-only link crawler.
const SEEDS = [
  '/',
  '/model-fixture/entries/?id=api-confirm',
  '/model-fixture/entries/?id=api-confirm&plan=plan-confirm&version=before',
  '/model-fixture/entries/?id=api-confirm&plan=plan-confirm&version=after',
  '/model-fixture/entries/?id=sub-on-confirmed',
  '/model-fixture/entries/?id=api-charge',
  '/model-fixture/entries/?id=job-unknown',
];

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => {
        if (address === null || typeof address === 'string') reject(new Error('No port'));
        else resolve(address.port);
      });
    });
  });
}

async function ready(origin: string, tries: number): Promise<void> {
  if (tries === 0) throw new Error(`The site did not start at ${origin}`);
  const up = await fetch(origin).then(
    () => true,
    () => false,
  );
  if (up) return;
  await sleep(250);
  await ready(origin, tries - 1);
}

async function weigh(
  url: URL,
  required: boolean,
): Promise<{ readonly size: PageSize; readonly links: readonly string[] } | null> {
  const response = await fetch(url);
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('text/html')) {
    if (required || response.status >= 500) {
      throw new Error(`${url.pathname}${url.search} failed: ${String(response.status)}`);
    }
    return null;
  }
  const html = await response.text();
  return {
    size: { page: `${url.pathname}${url.search}`, bytes: Buffer.byteLength(html) },
    links: pageLinks(html, url),
  };
}

async function crawl(origin: string): Promise<PageSize[]> {
  const seen = new Set(SEEDS);
  const sizes: PageSize[] = [];
  let queue = SEEDS;
  while (queue.length > 0) {
    const batch = queue.slice(0, AT_ONCE);
    queue = queue.slice(AT_ONCE);
    const results = await Promise.all(
      batch.map(async (page) => weigh(new URL(page, origin), SEEDS.includes(page))),
    );
    for (const result of results) {
      if (result === null) continue;
      sizes.push(result.size);
      const fresh = result.links.filter((page) => !page.startsWith('/_next/') && !seen.has(page));
      for (const page of fresh) seen.add(page);
      queue.push(...fresh);
    }
  }
  return sizes;
}

function report(all: readonly PageSize[]): void {
  const { over, heaviest } = judge(all, LIMIT, TOP);
  console.log(`${String(all.length)} pages; the heaviest:`);
  for (const p of heaviest) console.log(`  ${kilobytes(p.bytes).padStart(9)}  ${p.page}`);
  if (over.length > 0) {
    for (const p of over) console.error(`over    ${kilobytes(p.bytes)}  ${p.page}`);
    console.error(
      `\n${String(over.length)} pages weigh more than ${kilobytes(LIMIT)}. Draw what the reader asked for and` +
        '\nleave the rest to the browser (see Speed in docs/architecture.md).',
    );
    process.exitCode = 1;
  } else {
    console.log(`\nEvery page is within ${kilobytes(LIMIT)}.`);
  }
}

const port = await freePort();
const origin = `http://127.0.0.1:${String(port)}`;
const registered = await workspaceRegistrations();
const folders = new Set([
  ...registered.map((workspace) => workspace.folder),
  path.resolve('test/fixtures/model'),
]);
const site = spawn(
  'node_modules/.bin/next',
  ['start', '--port', String(port), '--hostname', '127.0.0.1'],
  {
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, GROUNDWORK_WORKSPACES: [...folders].join(path.delimiter) },
  },
);
try {
  await ready(origin, 120);
  report(await crawl(origin));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error('Run npm run build first.');
  process.exitCode = 1;
} finally {
  site.kill();
}
