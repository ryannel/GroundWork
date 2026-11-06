// Read-only reproduction: run from the Groundwork root with the registered Volvo folder as argument.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isMap, isSeq, LineCounter, parseDocument } from 'yaml';

import { buildId, parseId } from '../../../../src/domain/ids.ts';
import { modelValidator } from '../../../../src/infrastructure/model-schema.ts';

const workspace = process.argv[2];
assert.ok(workspace, 'Pass the registered Volvo workspace folder.');
const output = 'artifacts/rebuild/verification/pr6/queue-compatibility.json';
const domainFiles = await readdir(path.join(workspace, 'domains'), { recursive: true });
const files = domainFiles
  .filter((file) => /\/(?:system|contracts|handlers)\.yaml$/u.test(file))
  .map((file) => `domains/${file}`)
  .toSorted();
const documents = await Promise.all(
  files.map(async (file) => {
    const text = await readFile(path.join(workspace, file), 'utf8');
    const lines = new LineCounter();
    const document = parseDocument(text, { lineCounter: lines });
    assert.equal(document.errors.length, 0, file);
    return { file, text, lines, document };
  }),
);
const topics = new Set(
  documents
    .filter(({ file }) => file.endsWith('/system.yaml'))
    .flatMap(({ document }) => document.toJS().components)
    .filter((component) => component.type === 'queue')
    .map((component) => component.id),
);
const cases = [];
const messages = [];
function inspect(node, pointer, context) {
  if (isSeq(node)) {
    for (const [index, item] of node.items.entries()) {
      inspect(item, `${pointer}/${String(index)}`, context);
    }
    return;
  }
  if (!isMap(node)) return;
  const value = node.toJSON();
  const handler = parseId(value.id)?.prefix === 'h' ? value.id : context.handler;
  const sources = value.sources ?? context.sources;
  const identity = {
    file: context.file,
    line: context.lines.linePos(node.range[0]).line,
    pointer,
    handler,
  };
  if (topics.has(value.store)) {
    cases.push({
      ...identity,
      definition: 'Schema',
      original: { id: value.id, kind: value.kind, store: value.store },
      sources,
    });
  }
  if (value.read && topics.has(value.from)) {
    cases.push({
      ...identity,
      definition: 'Step',
      original: { id: 'probe', read: value.read, from: value.from },
      sources,
    });
  }
  if (value.write && topics.has(value.to)) {
    cases.push({
      ...identity,
      definition: 'Step',
      original: { id: 'probe', write: value.write, to: value.to },
      sources,
    });
  }
  if (parseId(value.id)?.prefix === 'msg' && topics.has(value.topic)) {
    messages.push({ ...identity, id: value.id, topic: value.topic });
  }
  for (const pair of node.items) {
    inspect(pair.value, `${pointer}/${pair.key.value}`, { ...context, handler, sources });
  }
}
for (const { document, file, lines } of documents) {
  inspect(document.contents, '', { file, lines, sources: [], handler: null });
}
function targetKey(item) {
  if (item.definition === 'Schema') return 'store';
  return item.original.read ? 'from' : 'to';
}
const failures = [];
for (const item of cases) {
  const original = { ...item.original, cites: ['probe:source.cs#L1'] };
  const key = targetKey(item);
  const id = parseId(original[key]);
  assert.ok(id);
  const rewritten = { ...original, [key]: buildId('top', id.local) };
  const validate = await modelValidator('workspace', item.definition);
  assert.equal(validate(original), true, JSON.stringify(validate.errors));
  assert.equal(validate(rewritten), false, `${item.file}:${String(item.line)}`);
  const errors = structuredClone(validate.errors);
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.equal(errors[0].instancePath, `/${key}`);
  assert.equal(errors[0].keyword, 'pattern');
  failures.push({ ...item, original, rewritten, errors });
}
assert.equal(topics.size, 125);
assert.equal(failures.filter((item) => item.definition === 'Schema').length, 4);
assert.equal(failures.filter((item) => item.original.read).length, 1);
assert.equal(failures.filter((item) => item.original.write).length, 8);
const affected = new Set(
  failures.map((item) => item.original.store ?? item.original.from ?? item.original.to),
);
assert.equal(messages.filter((item) => affected.has(item.topic)).length, 0);
const relevant = documents.filter(
  ({ file }) =>
    failures.some((item) => item.file === file) ||
    (file.endsWith('/system.yaml') &&
      [...affected].some(
        (id) =>
          file ===
          documents.find((doc) =>
            doc.document.toJS()?.components?.some((component) => component.id === id),
          )?.file,
      )),
);
const schema = await readFile('schema/workspace.schema.json');
const report = {
  note: 'Minimal validation probes isolate the prefix restriction. probe is a synthetic child id and citation home, not a proposed migration or claim about code.',
  sourceFiles: relevant.map(({ file, text }) => ({
    file,
    sha256: createHash('sha256').update(text).digest('hex'),
  })),
  schema: {
    file: 'schema/workspace.schema.json',
    sha256: createHash('sha256').update(schema).digest('hex'),
  },
  counts: {
    legacyQueues: topics.size,
    affectedQueues: affected.size,
    schemas: 4,
    reads: 1,
    writes: 8,
    matchingMessageContracts: 0,
  },
  originalProbesValidate: true,
  rewrittenProbesFailOnlyTargetPattern: true,
  cases: failures,
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({
    ...report.counts,
    originalProbesValidate: true,
    rewrittenProbesFailOnlyTargetPattern: true,
  }),
);
