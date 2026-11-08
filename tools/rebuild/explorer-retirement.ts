import { readFile } from 'node:fs/promises';

import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { sourceHash } from './consumer-inventory';

const FROZEN = 'artifacts/rebuild/explorer-parity.json';
const RECEIPT = 'artifacts/rebuild/pr10/explorer-dispositions.json';
const SHA256 = '69e65c669ae2818ad03bf666bd95b7caadebf81fd0e69561e63370ce178da254';

interface Proof {
  readonly status: 'proved';
  readonly capability: string;
  readonly file: string;
  readonly sha256: unknown;
}
type Disposition = Proof | { readonly status: 'open'; readonly reason: string };
function dispositionOf(original: unknown, decision: unknown, position: number): Disposition {
  const capability = modelText(modelRecord(original)?.capability);
  const row = modelRecord(decision);
  if (capability === null || row?.capability !== capability) {
    throw new Error(`Explorer retirement capability changed at row ${String(position + 1)}.`);
  }
  const reason = modelText(row.reason);
  if (row.status === 'open' && reason !== null) {
    return { status: 'open', reason: `${String(position + 1)}. ${capability}: ${reason}` };
  }
  const proof = modelText(row.proof);
  if (
    !['proved', 'approved-retirement'].includes(String(row.status)) ||
    proof === null ||
    !/^artifacts\/rebuild\/pr10\/[a-z-]+\.md$/u.test(proof) ||
    reason === null
  ) {
    throw new Error(`Explorer retirement needs a proof and disposition for ${capability}.`);
  }
  return { status: 'proved', capability, file: proof, sha256: row.sha256 };
}

export async function checkExplorerRetirement(): Promise<boolean> {
  const frozen = await readFile(FROZEN, 'utf8');
  if (sourceHash(frozen) !== SHA256) throw new Error('The frozen explorer inventory changed.');
  const inventory = modelList(modelRecord(JSON.parse(frozen))?.capabilities);
  const reviewed = modelList(
    modelRecord(JSON.parse(await readFile(RECEIPT, 'utf8')))?.dispositions,
  );
  if (inventory.length !== 20 || reviewed.length !== inventory.length) {
    throw new Error('Explorer retirement needs one disposition for each frozen capability.');
  }
  const dispositions = inventory.map((original, position) =>
    dispositionOf(original, reviewed[position], position),
  );
  const outstanding = dispositions.flatMap((row) => (row.status === 'open' ? [row.reason] : []));
  const proofs = dispositions.filter((row) => row.status === 'proved');
  await Promise.all(
    proofs.map(async ({ capability, file, sha256 }) => {
      if (sourceHash(await readFile(file, 'utf8')) !== sha256) {
        throw new Error(`Explorer retirement proof changed for ${capability}.`);
      }
    }),
  );
  if (outstanding.length === 0) {
    console.log('All 20 explorer capabilities have checked dispositions.');
    return true;
  }
  console.error(
    `Explorer retirement has ${String(outstanding.length)} open capabilities.\n${outstanding.join('\n')}`,
  );
  return false;
}
