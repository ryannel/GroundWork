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

import { writeRuntimeProof } from './runtime-proof';
import { softOfferDrawing, softOfferValueDrawing } from './soft-offer-proof-drawing';
import { softOfferInput, softOfferRequest } from './soft-offer-proof-fixture';

async function run(): Promise<void> {
  const { bundle, manifest } = await softOfferInput();
  const directory = path.resolve('reports/soft-offer-proof');
  await mkdir(directory, { recursive: true });
  await importKnowledgeSnapshot(path.join(directory, 'index.sqlite'), {
    manifest,
    bundles: [bundle],
  });
  const database = await openKnowledgeSnapshot(path.join(directory, 'index.sqlite'), manifest.id);
  try {
    const parse = await knowledgeValidators();
    const input = process.argv[2];
    if (input !== undefined) {
      console.log(
        JSON.stringify(
          parse.response(
            queryKnowledge(
              database.reader,
              parse.request(JSON.parse(await readFile(input, 'utf8'))),
            ),
          ),
          null,
          2,
        ),
      );
      return;
    }
    const results = await writeResults(database.reader, directory);
    await writeSoftDrawings(directory, results);
    await writeRuntimeLanding(directory);
    console.log(
      JSON.stringify(
        {
          snapshot: manifest.id,
          records: bundle.records.length,
          nodes: results.continuations?.nodes.length,
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
  const options: Record<string, Partial<QueryRequest>> = {
    trace: { query: 'trace' },
    continuations: {},
    consistency: { query: 'consistency' },
    created: { query: 'outcome', outcome: 201 },
    error: { query: 'outcome', outcome: 500 },
    cachedName: {
      query: 'value',
      value: 's2/v/cached-name',
      context: ['s2/http.add', 's2/add.notify', 's2/notify.send', 's2/handoff'],
      representation: 'persisted',
    },
    wrongEnvironment: { environment: 'test-profile' },
    boundedSupport: { query: 'consistency', maxRecords: 12 },
    consumerImpact: { query: 'impact', changed: ['s2/e/consumer-proto'] },
  };
  const results: Record<string, QueryResponse> = {};
  for (const [name, selection] of Object.entries(options)) {
    const request = parse.request(softOfferRequest(reader.snapshot, selection));
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

function proofPage(): string {
  return '<!doctype html><html lang="en"><meta charset="utf-8"><title>Volvo soft-offer proof</title><style>body{margin:0;background:#f4f7fa;font-family:Arial,sans-serif;color:#203347}nav{padding:18px 38px}a{margin-right:24px;color:#234e75}img{display:block;width:min(100%,1320px);height:auto}details{margin:24px 38px;max-width:1100px}p{line-height:1.5}</style><nav><a href="#control">Execution and writes</a><a href="#value">Follow Name</a><a href="consistency.json">Consistency query</a><a href="continuations.json">Operations and evidence</a><a href="boundedSupport.json">Bounded query</a></nav><img id="control" src="control.svg" alt="HTTP request, possible asynchronous delivery and separate cold and hot cache writes"><img id="value" src="value.svg" alt="Name traced backwards across the asynchronous handoff to the request"><details><summary>Scope and evidence</summary><p>These are collapsed projections of the pinned query results. The complete operation graph remains in the linked JSON, including guards, records, file and line evidence, invocation contexts and gaps. Click a diagram group to inspect its title, then open the query to resolve those record IDs. Possible delivery is conditional on committed production profiles. Effective deployment, offsets, retry policy and mapper implementation remain unresolved. No endpoint or store was called.</p></details></html>';
}

await run();

async function writeRuntimeLanding(directory: string): Promise<void> {
  await writeRuntimeProof('soft-offer', directory);
  await writeFile(
    path.join(directory, 'index.html'),
    '<meta http-equiv="refresh" content="0;url=runtime/index.html"><a href="runtime/index.html">Explore components</a>',
  );
}

async function writeSoftDrawings(
  directory: string,
  results: Readonly<Record<string, QueryResponse>>,
): Promise<void> {
  const continuation = results.continuations;
  const value = results.cachedName;
  if (continuation === undefined || value === undefined) throw new Error('Missing proof query');
  await writeFile(path.join(directory, 'control.svg'), softOfferDrawing(continuation));
  await writeFile(path.join(directory, 'value.svg'), softOfferValueDrawing(value));
  await writeFile(path.join(directory, 'logic.html'), proofPage());
}
