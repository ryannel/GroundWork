import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { captureProtobufContracts } from '@/infrastructure/scan/protobuf-contracts-capture';

import {
  protobufAnalysisDigest,
  readGitProtobufSources,
  writeProtobufCapture,
} from './scan-protobuf-contracts-io';

function requiredArgument(args: readonly string[], index: number): string {
  const value = args[index];
  if (value === undefined) {
    throw new Error(
      'Usage: scan-protobuf-contracts.ts <owner/repo> <clone> <commit> <output> <protoc> <python3> <standard-include-root>',
    );
  }
  return value;
}
export async function scanProtobufContracts(args: readonly string[]): Promise<void> {
  if (args.length !== 7) throw new Error('Exactly seven protobuf capture arguments are required');
  const repo = requiredArgument(args, 0);
  const clone = requiredArgument(args, 1);
  const commit = requiredArgument(args, 2);
  const output = requiredArgument(args, 3);
  const protoc = requiredArgument(args, 4);
  const python = requiredArgument(args, 5);
  const include = requiredArgument(args, 6);
  const pinned = await readGitProtobufSources({ clone, commit });
  const capture = await captureProtobufContracts({
    repo,
    commit,
    sources: pinned.sources,
    analysisSha256: await protobufAnalysisDigest(),
    compiler: { protoc, python, standardIncludeRoot: include },
  });
  await writeProtobufCapture(output, capture, pinned.sources);
  const receipt = {
    format: 'canonical-protobuf-contracts-receipt/v1',
    repo,
    commit,
    tree: pinned.tree,
    trackedFiles: pinned.trackedFiles,
    protoFiles: pinned.sources.length,
    extractedFiles: capture.document.files.filter((file) => file.status === 'extracted').length,
    failedFiles: capture.document.files.filter((file) => file.status !== 'extracted').length,
    analysisSha256: capture.document.analysis_sha256,
    sourceInventorySha256: capture.document.source_inventory_sha256,
    sourceCapture: 'separate_canonical_declaration_compilation',
    semanticAcceptance: 'not_established',
    deployment: 'unknown',
    producerConsumerCorrespondence: 'unknown',
    effectiveWireBehaviour: 'unknown',
  };
  await writeFile(path.join(output, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
}
if (process.argv[1] === import.meta.filename) await scanProtobufContracts(process.argv.slice(2));
