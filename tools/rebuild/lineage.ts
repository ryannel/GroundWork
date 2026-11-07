// Read-only lineage report against the immutable format-1 baseline and an isolated canonical workspace.
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

import { argumentsOf, manifestOf } from './capture';
import { citationLineage, handlerEffectLineage, landscapeLineage } from './fact-lineage';
import { digest, readSnapshot, writeSnapshot } from './snapshots';

const { values } = argumentsOf();
const { before, workspace, out } = values;
if (before === undefined || workspace === undefined || out === undefined) {
  throw new Error('Use --before <frozen capture> --workspace <id> --out <report folder>.');
}
const manifest = manifestOf(await readSnapshot(before, 'manifest.json'));
if (manifest.workspace !== workspace) throw new Error('The baseline belongs to another workspace.');
const frozen = await readSnapshot(before, 'facts.json.gz');
const index = await readCanonicalModelIndex(workspace);
if (index === null) throw new Error('Lineage requires the selected native workspace.');
const citations = citationLineage(frozen, index);
const handlerSites = handlerEffectLineage(frozen, index);
const landscape = landscapeLineage(frozen, index);
const problems = [...citations, ...handlerSites, ...landscape].filter(
  (row) => row.problems.length > 0,
);
const summary = {
  workspace,
  citations: citations.length,
  handlerSites: handlerSites.length,
  landscape: landscape.length,
  problems: problems.length,
};
await writeSnapshot(out, 'lineage.json.gz', {
  ...summary,
  frozenFacts: digest(frozen),
  citations,
  handlerSites,
  landscape,
});
console.log(JSON.stringify(summary));
if (problems.length > 0) process.exitCode = 1;
