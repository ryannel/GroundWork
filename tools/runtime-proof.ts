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

import { runtimeProofInput, runtimeRequest } from './runtime-proof-fixture';
import { runtimeProofPage } from './runtime-proof-page';
import { runtimeOverview } from './runtime-proof-svg';

export async function writeRuntimeProof(
  name: 'capture' | 'soft-offer',
  parentDirectory: string,
): Promise<void> {
  const { bundle, manifest } = await runtimeProofInput(name);
  const directory = path.join(parentDirectory, 'runtime');
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'index.sqlite');
  await importKnowledgeSnapshot(file, { manifest, bundles: [bundle] });
  const database = await openKnowledgeSnapshot(file, manifest.id);
  try {
    const results = await writeQueries(database.reader, { name, directory });
    const interactions = results.interactions;
    const trace = results.trace;
    if (interactions === undefined || trace === undefined) {
      throw new Error('Missing runtime proof query');
    }
    const view = { name, interactions, trace };
    await writeFile(path.join(directory, 'components.svg'), runtimeOverview(view));
    await writeFile(path.join(directory, 'index.html'), runtimeProofPage(view));
    console.log(
      JSON.stringify({
        proof: name,
        snapshot: manifest.id,
        componentsAndBoundaries: interactions.nodes.length,
        callSites: interactions.edges.length,
        sourceLinks: interactions.sourceLinks?.length,
        directory,
      }),
    );
  } finally {
    database.close();
  }
}
async function run(): Promise<void> {
  const name = process.argv[2];
  if (name !== 'capture' && name !== 'soft-offer') throw new Error('Choose capture or soft-offer');
  const requestFile = process.argv[3];
  if (requestFile === undefined) {
    await writeRuntimeProof(name, path.resolve(`reports/${name}-proof`));
    return;
  }
  const { bundle, manifest } = await runtimeProofInput(name);
  const parse = await knowledgeValidators();
  const directory = path.resolve(`reports/${name}-proof/runtime`);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'index.sqlite');
  await importKnowledgeSnapshot(file, { manifest, bundles: [bundle] });
  const database = await openKnowledgeSnapshot(file, manifest.id);
  try {
    const request = parse.request(JSON.parse(await readFile(requestFile, 'utf8')));
    console.log(JSON.stringify(parse.response(queryKnowledge(database.reader, request)), null, 2));
  } finally {
    database.close();
  }
}
if (process.argv[1] === import.meta.filename) await run();

async function writeQueries(
  reader: KnowledgeReader,
  options: { readonly name: 'capture' | 'soft-offer'; readonly directory: string },
): Promise<Record<string, QueryResponse>> {
  const parse = await knowledgeValidators();
  const selections: Readonly<Record<string, Partial<QueryRequest>>> = {
    interactions: {},
    trace: { query: 'continuations' },
    bounded: { maxRecords: 15 },
    wrongEnvironment: { environment: 'different-profile' },
  };
  const results: Record<string, QueryResponse> = {};
  for (const [label, selection] of Object.entries(selections)) {
    const request = parse.request(runtimeRequest(options.name, reader.snapshot, selection));
    const result = parse.response(queryKnowledge(reader, request));
    results[label] = result;
    await writeFile(
      path.join(options.directory, `${label}.request.json`),
      `${JSON.stringify(request, null, 2)}\n`,
    );
    await writeFile(
      path.join(options.directory, `${label}.json`),
      `${JSON.stringify(result, null, 2)}\n`,
    );
  }
  return results;
}
