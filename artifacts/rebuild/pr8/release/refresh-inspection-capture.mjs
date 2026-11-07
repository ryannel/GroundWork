import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { judge, PAGE_BYTE_LIMIT } from '../../../../tools/page-budget-rules.ts';
import { captureRoute, capturedPageSize } from '../../../../tools/rebuild/route-response.ts';
import { withSite } from '../../../../tools/rebuild/site.ts';
import { digest, readSnapshot, writeSnapshot } from '../../../../tools/rebuild/snapshots.ts';

const [previous, candidate, receipt] = process.argv.slice(2);
if (!previous || !candidate || !receipt || previous === candidate) {
  throw new Error('Pass the previous capture root, a new candidate root and the output receipt.');
}
const proof = JSON.parse(await readFile('artifacts/rebuild/pr8/nonplan-link-resolution-release.json', 'utf8'));
const broken = proof.workspaces['volvo-cars'].added.unresolved;
const local = proof.workspaces['volvo-cars'].inspections.newUnresolved;
const programme = '/volvo-cars/programmes/care-se/';
const fileOf = (route) => 'route-' + digest(route).slice(0, 20) + '.json.gz';
const htmlFields = ({ headings, links, payload, status, type }) => ({ headings, links, payload, status, type });
const releases = [];
const resolutions = [];
const allPages = [];

function verifyResponse(was, now, route) {
  const expected = htmlFields(was);
  if (route === programme) {
    const localIds = new Set(local.map(({ id }) => id));
    if (local.some(({ id, inlineLabel }) => !now.payload.text.includes(id) || !now.payload.text.includes(inlineLabel))) {
      throw new Error('A local programme record lost its exact label or identity');
    }
    expected.payload = {
      ...expected.payload,
      inspectedIds: expected.payload.inspectedIds.filter((id) => !localIds.has(id)),
    };
  }
  if (!isDeepStrictEqual(htmlFields(now), expected)) {
    throw new Error('Unexpected visible response difference in ' + route);
  }
}


await mkdir(candidate, { recursive: false });
await withSite(undefined, async (origin) => {
  for (const id of ['personal', 'acme', 'volvo-cars']) {
    const before = path.join(previous, id);
    const after = path.join(candidate, id);
    const manifest = await readSnapshot(before, 'manifest.json');
    await cp(before, after, { recursive: true, filter: (source) => !source.endsWith('/comparison.json') });
    const checked = [];
    const selected = manifest.routes.filter((route) => route.startsWith('/' + id + '/things/?') || route === programme);
    const controls = ['/', '/' + id + '/', '/' + id + '/model.json'];
    for (const route of [...selected, ...controls]) {
      const file = fileOf(route);
      const was = await readSnapshot(before, file);
      const now = await captureRoute(origin, route);
      verifyResponse(was, now, route);
      const size = capturedPageSize(now);
      if (size !== null) allPages.push(size);
      await writeSnapshot(after, file, now);
      checked.push({ route, file, before: digest(was), after: digest(now), bytes: [was.htmlBytes, now.htmlBytes] });
      console.log(JSON.stringify(checked.at(-1)));
    }
    releases.push({ workspace: id, manifest: digest(manifest), unchangedFiles: manifest.files.length - checked.length, checked });
  }

  const frame = await readSnapshot(path.join(previous, 'volvo-cars'), 'facts.json.gz');
  const model = await readSnapshot(path.join(previous, 'volvo-cars'), frame.current.model.file, frame.current.model.sha256);
  const byId = new Map(model.externals.map((value) => [value.id, value]));
  for (const { url, existingCanonicalId } of broken) {
    const expected = byId.get(existingCanonicalId);
    const now = await captureRoute(origin, url);
    if (!expected || now.status !== 200 || !now.headings.includes(expected.name) || now.payload.text.includes('Nothing here goes by that name.')) {
      throw new Error('Canonical thing does not open: ' + url);
    }
    const size = capturedPageSize(now);
    if (size === null) throw new Error('Canonical thing did not return HTML: ' + url);
    allPages.push(size);
    resolutions.push({ url, id: existingCanonicalId, name: expected.name, bytes: size.bytes, sha256: digest(now) });
    console.log(JSON.stringify(resolutions.at(-1)));
  }
});

const budget = judge(allPages, PAGE_BYTE_LIMIT, 10);
if (budget.over.length > 0) throw new Error('Changed route exceeds the unchanged page budget: ' + JSON.stringify(budget.over));
await writeFile(receipt, JSON.stringify({ previous, candidate, releases, resolutions, programme: { route: programme, localIdsRenderedAsText: local.map(({ id }) => id) }, budget }, null, 2) + '\n');
