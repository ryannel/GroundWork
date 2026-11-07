// Capture facts once, then pass this completed folder as --facts when capturing routes.
import { existsSync } from 'node:fs';
import path from 'node:path';

import { argumentsOf, captureFactFiles, manifestOf } from './capture';
import { readSnapshot } from './snapshots';

const { values } = argumentsOf();
const { before, workspace, out } = values;
if (before === undefined || workspace === undefined || out === undefined) {
  throw new Error('Use --before <frozen capture> --workspace <id> --out <new folder>.');
}
if (existsSync(out)) throw new Error('Choose a new folder for the fact capture.');
const baseline = manifestOf(await readSnapshot(before, 'manifest.json'));
if (baseline.workspace !== workspace) throw new Error('The baseline belongs to another workspace.');
const receipt = await captureFactFiles({ workspace, asOf: baseline.asOf, out });
console.log(
  `Captured ${String(receipt.files.length)} complete fact files in ${path.resolve(out)}.`,
);
