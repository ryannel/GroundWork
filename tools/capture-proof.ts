import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { queryKnowledge } from '@/application/knowledge/query-knowledge';
import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type { QueryRequest, QueryResponse } from '@/domain/knowledge/knowledge.generated';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';
import {
  importKnowledgeSnapshot,
  openKnowledgeSnapshot,
} from '@/infrastructure/knowledge/knowledge-index';

import { captureControlDrawing, captureValueDrawing } from './capture-proof-drawing';
import { captureProofInput, captureRequest } from './capture-proof-fixture';
import { writeRuntimeProof } from './runtime-proof';

async function run(): Promise<void> {
  const { bundle, manifest } = await captureProofInput();
  const parse = await knowledgeValidators();
  const directory = path.resolve('reports/capture-proof');
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'index.sqlite');
  await importKnowledgeSnapshot(file, { manifest, bundles: [bundle] });
  const database = await openKnowledgeSnapshot(file, manifest.id);
  try {
    if (process.argv[2] !== undefined) {
      const request = parse.request(JSON.parse(await readFile(process.argv[2], 'utf8')));
      console.log(
        JSON.stringify(parse.response(queryKnowledge(database.reader, request)), null, 2),
      );
      return;
    }
    const results = await writeResults(database.reader, directory);
    await writeDrawings(directory, results);
    await writeRuntimeProof('capture', directory);
    console.log(
      JSON.stringify(
        {
          snapshot: manifest.id,
          records: bundle.records.length,
          queries: Object.keys(results),
          directory,
        },
        null,
        2,
      ),
    );
  } finally {
    database.close();
  }
}

async function writeResults(
  reader: KnowledgeReader,
  directory: string,
): Promise<Record<string, QueryResponse>> {
  const parse = await knowledgeValidators();
  const requests: Record<string, Partial<QueryRequest>> = {
    trace: {},
    outcome208: { query: 'outcome', outcome: 208 },
    outcome422: { query: 'outcome', outcome: 422 },
    outcome500: { query: 'outcome', outcome: 500 },
    providerReference: {
      query: 'value',
      value: 'r1/value/outgoing.pspTransactionId',
      context: ['r1/controller.invoke'],
    },
    wirePayload: {
      query: 'value',
      value: 'r1/value/outgoing.attributes',
      context: ['r1/controller.invoke'],
      representation: 'wire',
    },
    effects: { query: 'effects' },
    invalidation: { query: 'impact', changed: ['r1/evidence/completed'] },
  };
  const results: Record<string, QueryResponse> = {};
  for (const [name, options] of Object.entries(requests)) {
    const request = parse.request(captureRequest(reader.snapshot, options));
    const result = parse.response(queryKnowledge(reader, request));
    results[name] = result;
    await writeFile(
      path.join(directory, `${name}.request.json`),
      `${JSON.stringify(request, null, 2)}\n`,
    );
    await writeFile(path.join(directory, `${name}.json`), `${JSON.stringify(result, null, 2)}\n`);
  }
  return results;
}

async function writeDrawings(
  directory: string,
  results: Readonly<Record<string, QueryResponse>>,
): Promise<void> {
  const trace = results.trace;
  const value = results.providerReference;
  if (trace === undefined || value === undefined) throw new Error('Missing proof views');
  await writeFile(path.join(directory, 'control.svg'), captureControlDrawing(trace));
  await writeFile(path.join(directory, 'value.svg'), captureValueDrawing(value));
  await writeFile(
    path.join(directory, 'index.html'),
    '<meta http-equiv="refresh" content="0;url=runtime/index.html"><a href="runtime/index.html">Explore components</a>',
  );
  await writeFile(
    path.join(directory, 'logic.html'),
    '<!doctype html><html lang="en"><meta charset="utf-8"><title>Volvo capture proof</title><style>body{margin:0;background:#f5f8fa;font-family:Arial,sans-serif}nav{padding:16px 40px}a{margin-right:24px}img{display:block;width:min(100%,1200px);height:auto}details{margin:20px 40px}pre{white-space:pre-wrap}</style><nav><a href="#control">Control flow</a><a href="#value">Selected value</a><a href="trace.json">Full query result</a><a href="effects.json">Effects and gaps</a></nav><img id="control" src="control.svg" alt="Collapsed endpoint control flow"><img id="value" src="value.svg" alt="Provider-reference data journey"><details><summary>How to inspect this proof</summary><p>Open the JSON results for operation identities, branches, conditions, evidence, coverage and unresolved boundaries. The drawing groups operations for readability; it does not assert exhaustive behaviour.</p></details></html>',
  );
}

await run();
