import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import ts from 'typescript';

import { indexOf } from '../../../../src/application/model-index.ts';
import { readModelPlans } from '../../../../src/infrastructure/model-plans.ts';
import { readModel } from '../../../../src/infrastructure/read-model.ts';
import { validatePlanProjections } from '../../../../src/infrastructure/validate-model.ts';
import { modelMapOf } from '../../../../tools/model-map.ts';

const { values } = parseArgs({
  options: {
    workspace: { type: 'string' },
    earlier: { type: 'string' },
    report: { type: 'string' },
    receipt: { type: 'string' },
    out: { type: 'string' },
  },
});
for (const key of ['workspace', 'earlier', 'report', 'receipt', 'out']) {
  assert.ok(values[key], `Missing --${key}`);
}
const previousCode = '0205662db80da14d662eab442b0b30fb8383015a';
const git = (args) =>
  execFileSync('/usr/bin/git', ['-c', 'core.fsmonitor=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
const oldSchema = JSON.parse(git(['show', `${previousCode}:schema/workspace.schema.json`]));
const currentSchema = JSON.parse(await readFile('schema/workspace.schema.json', 'utf8'));
assert.equal(oldSchema.$defs.Schema.properties.deprecated, undefined);
assert.equal(oldSchema.$defs.Schema.properties.supersedes, undefined);
const additional = {
  deprecated: currentSchema.$defs.Schema.properties.deprecated,
  supersedes: currentSchema.$defs.Schema.properties.supersedes,
};
assert.deepEqual(currentSchema, {
  ...oldSchema,
  $defs: {
    ...oldSchema.$defs,
    Schema: {
      ...oldSchema.$defs.Schema,
      properties: { ...oldSchema.$defs.Schema.properties, ...additional },
    },
  },
});
assert.deepEqual(additional.deprecated, { type: 'boolean' });
assert.equal(typeof additional.supersedes.pattern, 'string');
const changed = git([
  'diff',
  '--name-only',
  previousCode,
  '--',
  'src',
  'tools',
  'schema',
  'workspaces',
])
  .trim()
  .split('\n')
  .filter(Boolean);
const allowed = new Set([
  'schema/workspace.schema.json',
  'src/domain/model/workspace.generated.ts',
  'src/domain/model/plan.generated.ts',
  'src/infrastructure/model-plan-projection.test.ts',
]);
assert.ok(
  changed.every((file) => allowed.has(file)),
  `Runtime changes require fresh plan results: ${changed.join(', ')}`,
);
for (const file of changed.filter((name) => name.endsWith('.generated.ts'))) {
  const options = { compilerOptions: { module: ts.ModuleKind.ESNext } };
  assert.equal(
    ts.transpileModule(git(['show', `${previousCode}:${file}`]), options).outputText,
    ts.transpileModule(await readFile(file, 'utf8'), options).outputText,
  );
}
const previous = JSON.parse(await readFile(values.report, 'utf8'));
assert.equal(previous.status, 'invalid');
assert.deepEqual(previous.problems, [
  { at: 'sys:offers/schemas/86', message: 'must NOT have additional properties' },
]);
const receipt = JSON.parse(await readFile(values.receipt, 'utf8'));
async function hashes(folder) {
  const result = {};
  for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath, entry.name);
    result[path.relative(folder, full)] = createHash('sha256')
      .update(await readFile(full))
      .digest('hex');
  }
  return result;
}
const earlier = await hashes(values.earlier);
const files = await hashes(values.workspace);
assert.deepEqual(Object.keys(earlier).toSorted(), Object.keys(files).toSorted());
const differences = Object.keys(files)
  .toSorted()
  .flatMap((file) =>
    earlier[file] === files[file] ? [] : [{ file, before: earlier[file], after: files[file] }],
  );
assert.deepEqual(differences, receipt.changedFiles);
assert.equal(Object.keys(files).length, receipt.files);
process.env.GROUNDWORK_WORKSPACES = values.workspace;
const model = await readModel('volvo-cars');
assert.ok(model);
const plans = await readModelPlans(model.id);
assert.equal(plans.length, 8);
const affected = plans.find((plan) => plan.meta.id === 'plan:sourced-financing-terms');
assert.ok(affected);
assert.equal(affected.builds_on?.length ?? 0, 0);
const checked = await validatePlanProjections([affected], model);
assert.deepEqual(checked.problems, []);
const index = indexOf(model);
assert.deepEqual(
  index.gaps().filter((gap) => gap.kind === 'unbacked_connection'),
  [],
);
const queries = modelMapOf(index);
const resolved = new Set();
const kinds = {};
for (const entity of index.entities) {
  const shown = queries.show(entity.id);
  assert.equal(shown?.fact.id, entity.id);
  assert.equal(shown.fact.data, entity.data);
  assert.ok(!resolved.has(shown.fact.id));
  resolved.add(shown.fact.id);
  kinds[entity.kind] = (kinds[entity.kind] ?? 0) + 1;
}
const result = {
  generationCode: previousCode,
  validationCode: git(['rev-parse', 'HEAD']).trim(),
  previousReport: values.report,
  previousPlans: plans.length,
  reusedPlans: plans.filter((plan) => plan !== affected).map((plan) => plan.meta.id),
  affectedPlan: affected.meta.id,
  affectedPlanProblems: checked.problems,
  schemaOnlyAddsOptionalLifecycleFields: true,
  runtimeAndGeneratedTypeErasureUnchanged: true,
  generatedCopyMatchesRecordedFileReceipts: true,
  strictCurrentBaseRevalidated: true,
  unbackedCurrentConnections: 0,
  allEightPlanResultsReconciled: true,
  ordinaryShowResolvesEveryDeclaredCurrentModelIdOnce: resolved.size,
  kinds,
  files,
};
await writeFile(values.out, JSON.stringify(result, null, 2) + '\n');
console.log({ affectedPlanProblems: 0, reusedPlans: 7, resolvedCurrentIds: resolved.size, kinds });
