// Holds every exported page under a weight a reader can open at once. A page's HTML carries both what it draws
// and the payload React hydrates from, so a page that draws what the reader has not asked for (every stop of a
// walk, every field of every endpoint, every mode of a catalogue) shows here first. Run after npm run build.
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { judge, kilobytes, pageOf } from './page-budget-rules';

const OUT = 'out';
/** The most one page may weigh, uncompressed. */
const LIMIT = 1024 * 1024;
const TOP = 10;

function pages() {
  return readdirSync(OUT, { recursive: true, encoding: 'utf8' })
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => file === 'index.html' || file.endsWith('/index.html'))
    .map((file) => ({ page: pageOf(file), bytes: statSync(path.join(OUT, file)).size }));
}

if (existsSync(OUT)) {
  const all = pages();
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
} else {
  console.error(`No ${OUT}/ to measure. Run npm run build first.`);
  process.exitCode = 1;
}
