// npm run rebuild:baseline -- --workspace <id> --out <dir> [--origin <built site>]
import { existsSync } from 'node:fs';
import path from 'node:path';

import { argumentsOf, capture, routeList } from './capture';

const { values } = argumentsOf();
if (values.workspace === undefined || values.out === undefined) {
  throw new Error('Use --workspace <id> --out <dir>.');
}
if (existsSync(path.join(values.out, 'manifest.json'))) {
  throw new Error('The baseline already exists. Choose a new --out directory.');
}
const asOf = values['as-of'] ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/u.test(asOf)) throw new Error('--as-of must be YYYY-MM-DD.');
const manifest = await capture({
  workspace: values.workspace,
  out: values.out,
  asOf,
  origin: values.origin,
  factFolder: values.facts,
  routes: await routeList(values.routes),
});
console.log(
  `Captured ${manifest.workspace}: ${String(manifest.routes.length)} routes and the complete derived facts.`,
);
