import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { digest, readSnapshot } from '../../../../tools/rebuild/snapshots.ts';

const [candidate, reports, out] = process.argv.slice(2);
if (!candidate || !reports || !out) throw new Error('Pass candidate root, comparison root and output fragment.');
const proofRoot = 'artifacts/rebuild/pr8';
const proof = path.join(proofRoot, 'release');
const json = (file, folder = proof) => readSnapshot(folder, file);
const byteHash = async (folder, file) => createHash('sha256').update(await readFile(path.join(folder, file))).digest('hex');
const plans = await json('volvo-plan-route-ledger.json', proofRoot);
const planRoutes = new Map(plans.rows.map((row) => [row.route, row]));
const outlines = new Map(plans.outlines.map((row) => [row.pointer, row]));
const links = await json('nonplan-link-resolution-release.json', proofRoot);
const recapture = await json('inspection-recapture.json');
const range = await json('range-route-proof.json.gz');
const allowed = [];
const held = [];

const rangeReason = {
  area: 'The authored Range record is exact after resolving the area ID.',
  boundaries: 'The seven reviewed unmapped systems appear as explicit boundaries.',
  collaborations: 'The complete authored collaboration is unchanged after resolving system IDs.',
  gaps: 'The route exposes the 2,046 gaps in the checked area shard.',
  relationships: 'Both authored relationships keep their wording and direction through aliases.',
  systems: 'All 115 original cards resolve. This projection uses canonical component placement and explicit resource IDs.',
  technicalRelationships: '855 exact canonical sites replace 298 grouped rows. Each old site has an individual disposition.',
  valueFlow: 'Ordered bands, core links, overview links and captions retain authored facts and backing. Aliases and citations are explicit.',
};
const transportReason = {
  model: 'The current model is carried directly and matches the checked current scope.',
  plan: 'Authored records match the checked model and plan lineage. Synthetic current carriers are replaced by the canonical model.',
  before: 'The selected before model is supplied directly, including inherited provenance.',
  after: 'The selected after model is supplied directly, including proposal gaps.',
  profile: 'The lookup profile reports exact loaded and omitted evidence counts.',
  inherited: 'Inherited records remain in the checked before scope with their original provenance.',
  standing: 'Standing uses the independent recorded events and the native authored records.',
  status: 'The old synthetic status carrier is replaced by independent progress records and gaps.',
  progress: 'All independently recorded progress events and errors match the checked capture.',
};
function presentation(workspace, route, plan) {
  if (route === '/') return 'Library counts and recorded work state. release/causes.md Library';
  if (route.endsWith('/plans/')) return 'The directory retains plan destinations and displays known progress and archived rechecks. release/causes.md';
  if (plan) return `Selected native ${plan.kind} records and outline. volvo-plan-route-ledger.json`;
  if (route.includes('/things/?')) return 'Selected identity and scoped references replace sibling navigation. nonplan-link-resolution-release.json';
  if (route.endsWith('/explorer/')) return 'The native rail surrounds the retained explorer publication. release/causes.md';
  if (workspace !== 'volvo-cars') return 'Native layout and preserved example facts. small-http-causes.md and release/causes.md';
  if (route.includes('/programmes/')) return 'Selected programme work and complete programme detail. non-map-pages/handoff.md and release/inspection-recapture.json';
  if (route.includes('/partners/')) return 'Recorded contacts, work and independent progress. native-workspace-catalogues.md';
  if (route.includes('/areas/')) return 'Authored band captions and deferred map detail. release/range-route-proof.md';
  if (route.includes('/reference/')) return 'Canonical reference rows with scoped search and record detail. area-and-facts/handoff.md';
  if (route.includes('/journeys/')) return 'Authored journeys and narrative step navigation. native-system-handoff.md';
  if (route.includes('/commercial-backbone/')) return 'Declared systems, scoped native maps, flows and catalogues. release/causes.md and native-system-handoff.md';
  if (route.endsWith('/language/') || route.endsWith('/people/')) return 'Canonical concepts and declared actors. native-workspace-catalogues.md';
  if (route.endsWith('/value-flows/')) return 'Saved value-flow catalogue and authored captions. area-and-facts/handoff.md';
  if (route === '/volvo-cars/') return 'Canonical workspace counts, Entry flows and Journey directory. release/causes.md';
  return null;
}

for (const workspace of ['personal', 'acme', 'volvo-cars']) {
  const frozen = 'artifacts/rebuild/baseline/' + workspace;
  const current = path.join(candidate, workspace);
  const frame = await json('manifest.json', frozen);
  const next = await json('manifest.json', current);
  const report = await json('comparison.json', path.join(reports, workspace));
  const receipts = await json('pr8-release-route-receipts-' + workspace + '.json.gz');
  const scopeTransport = await json(workspace === 'volvo-cars' ? 'volvo-json-transport.json' : 'pr8-release-transport-' + workspace + '.json');
  const transport = new Map(scopeTransport.checks.map((row) => [row.route, row]));
  const review = new Map(links.workspaces[workspace].pairs.map((row) => [row.route, row]));
  const responseByFile = new Map();
  const oldRoutes = new Set(frame.routes);
  const newRoutes = new Set(next.routes);
  if (report.workspace !== workspace || report.pageBudget.over.length > 0 || frame.routes.some((route) => !newRoutes.has(route))) {
    throw new Error('Unverified candidate route set for ' + workspace);
  }
  if (receipts.manifestSha256[0] !== await byteHash(frozen, 'manifest.json') || receipts.manifestSha256[1] !== await byteHash(current, 'manifest.json')) {
    throw new Error('Wrong route receipt manifests for ' + workspace);
  }
  const changeGroups = Map.groupBy(report.changes, (row) => row.file);
  for (const route of next.routes) {
    const row = receipts.routes[route];
    const was = oldRoutes.has(route) ? await json(row.file, frozen) : null;
    const now = await json(row.file, current);
    const beforeHash = was === null ? null : await byteHash(frozen, row.file);
    const afterHash = await byteHash(current, row.file);
    if (row.sha256[0] !== beforeHash || row.sha256[1] !== afterHash || now.route !== route || now.status !== 200 || (was && (was.status !== now.status || was.type !== now.type))) {
      throw new Error('Invalid release route receipt ' + route);
    }
    const plan = planRoutes.get(route);
    if (plan && (plan.comparison.sha256 !== digest(changeGroups.get(row.file) ?? []) || plan.records.some((record) => record.before && !record.after))) {
      throw new Error('Plan comparison differs from its exact reviewed witnesses: ' + route);
    }
    const navigation = review.get(route);
    if (navigation && (navigation.before.sha256 !== beforeHash || navigation.after.sha256 !== afterHash)) {
      const refreshed = recapture.releases.find((release) => release.workspace === workspace)?.checked.find((item) => item.route === route);
      if (!refreshed || refreshed.after !== digest(now) || navigation.before.sha256 !== beforeHash) throw new Error('Navigation evidence changed ' + route);
    }
    if (route === range.route && (range.frozenResponseSha256 !== beforeHash || range.candidateResponseSha256 !== afterHash)) {
      throw new Error('Range evidence does not match the compared responses');
    }
    if (now.type === 'application/json' && route !== range.route && transport.get(route)?.responseSha256 !== afterHash) {
      throw new Error('Unproved JSON transport ' + route);
    }
    let directoryRail = false;
    if (was && route.endsWith('/plans/')) {
      const source = receipts.routes[route.slice(0, -'plans/'.length)];
      const moved = row.links.removed.every((href) => source?.links.removed.includes(href));
      const additions = row.links.added.every((href) => newRoutes.has(href) || source?.links.added.includes(href));
      directoryRail = moved && additions;
    }
    responseByFile.set(row.file, { route, was, now, plan, navigation, directoryRail });
  }

  for (const diff of report.unexplained) {
    let reason = null;
    if (diff.file === 'selection' && /^\/\d+$/u.test(diff.path)) {
      reason = 'PR8 route selection adds verified Entry flows, journey and record routes. All frozen addresses remain. release route receipts';
    } else if (diff.file === 'facts.json.gz' && workspace === 'volvo-cars') {
      const outline = outlines.get(diff.path);
      if (outline && digest(outline.frozenExact) === digest(diff) && outline.missingFrozenHtmlAddresses.length === 0) {
        reason = `PR8 derives the outline for ${outline.slug} from the checked plan instead of storing the synthetic carrier. volvo-plan-route-ledger.json`;
      }
    } else {
      const row = responseByFile.get(diff.file);
      if (row) {
        const { route, was, now, plan, navigation, directoryRail } = row;
        const segments = diff.path.split('/').slice(1);
        const [head, field, slot] = segments;
        if (was === null && diff.path === '' && receipts.newRoutes.includes(route)) {
          reason = 'PR8 adds this observed Entry flow, canonical journey or record selection. It returned HTTP 200. release route receipts';
        } else if (was && now.type === 'application/json' && head === 'payload') {
          const explanation = (route === range.route ? rangeReason : transportReason)[field];
          if (explanation) reason = `PR8 ${explanation} ${route === range.route ? 'release/range-route-proof.json.gz' : 'release JSON transport and area-and-facts factual proofs'}`;
        } else if (was && now.type === 'text/html') {
          const disposition = presentation(workspace, route, plan);
          if (disposition && (head === 'headings' || diff.path === '/payload/text' || diff.path === '/htmlBytes')) {
            reason = `PR8 ${disposition}. Exact route text, heading and size changes are in the release receipt`;
          } else if (disposition && (head === 'links' || (head === 'payload' && field === 'inspectedIds')) && (navigation || directoryRail || plan || route === '/')) {
              const before = head === 'links' ? was.links : was.payload.inspectedIds;
              const after = head === 'links' ? now.links : now.payload.inspectedIds;
              const at = Number(head === 'links' ? field : slot);
              if (Number.isSafeInteger(at) && at >= 0) {
                const moved = (before[at] === undefined || after.includes(before[at])) && (after[at] === undefined || before.includes(after[at]));
                reason = moved
                  ? 'PR8 position shift within checked retained link or identity membership. release route receipts'
                  : `PR8 ${disposition}. Exact added and removed links or inspected identities are in the release receipt`;
              }
            }
        }
        if (reason) reason += ` for ${route}.`;
      }
    }
    if (reason === null) held.push({ workspace, ...diff });
    else allowed.push({ workspace, ...diff, reason });
  }
}

if (held.length > 0) {
  await writeFile(out + '.held.json', JSON.stringify(held, null, 2) + '\n');
  throw new Error(`${held.length} differences still lack an exact disposition; see ${out}.held.json`);
}
const body = allowed.map((row) => '  - ' + JSON.stringify(row)).join('\n');
await writeFile(out, '# PR8 release responses and derived navigation. See pr8/release/causes.md.\n' + body + '\n');
console.log(JSON.stringify({ total: allowed.length, output: out }));
