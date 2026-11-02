import { discoveryEvidenceErrors } from './discovery-evidence';
import type { DiscoveryInput } from './discovery-types';
import type { DiscoveryEvidence } from './discovery.generated';
import type { Context } from './interpretation.generated';

function safeRepositoryPath(path: string): boolean {
  return (
    path !== '' &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    path.split('/').every((part) => !['', '.', '..'].includes(part))
  );
}
function candidatePathMatches(root: string, path: string | undefined): boolean {
  if (path === undefined || !safeRepositoryPath(path)) return false;
  if (root === '.') return true;
  return safeRepositoryPath(root) && (path === root || path.startsWith(`${root}/`));
}
function evidencePath(evidence: DiscoveryEvidence, input: DiscoveryInput): string | undefined {
  if (evidence.kind === 'context_snapshot') return evidence.path;
  const snapshot = input.snapshots.find((item) => item.id === evidence.context_id);
  return snapshot?.kind === 'scan_snapshot'
    ? snapshot.document.sources.find((item) => item.id === evidence.source_id)?.path
    : undefined;
}
function canonicalPinErrors(
  evidence: Extract<DiscoveryEvidence, { readonly kind: 'context_snapshot' }>,
  input: DiscoveryInput,
): string[] {
  const { inventory } = input;
  const snapshot = input.snapshots.find((item) => item.id === evidence.context_id);
  const context = input.interpretation.contexts.find((item) => item.id === evidence.context_id);
  const uri = `https://github.com/${inventory.repo}/blob/${inventory.commit}/${evidence.path}`;
  const pinned =
    context?.kind === 'context_snapshot' &&
    context.pins.some((pin) => pin.repo === inventory.repo && pin.commit === inventory.commit);
  const matches = [
    snapshot?.kind === 'context_snapshot',
    snapshot?.sha256 === evidence.sha256,
    snapshot?.kind === 'context_snapshot' && snapshot.uri === uri,
    snapshot?.kind === 'context_snapshot' && snapshot.revision === inventory.commit,
    evidence.commit === inventory.commit,
    pinned,
  ].every(Boolean);
  return matches
    ? []
    : ['Discovery canonical evidence needs exact pinned source bytes and GitHub path.'];
}
function pinErrors(evidence: DiscoveryEvidence, input: DiscoveryInput): string[] {
  if (evidence.kind === 'context_snapshot') return canonicalPinErrors(evidence, input);
  const { inventory } = input;
  const snapshot = input.snapshots.find((item) => item.id === evidence.context_id);
  const source =
    snapshot?.kind === 'scan_snapshot'
      ? snapshot.document.sources.find((item) => item.id === evidence.source_id)
      : undefined;
  return source?.repo === inventory.repo &&
    source.commit === inventory.commit &&
    snapshot?.sha256 === inventory.snapshot_sha256
    ? []
    : ['Discovery observed evidence is outside the frozen target.'];
}
function matchesTarget(context: Context, input: DiscoveryInput): boolean {
  const { inventory } = input;
  if (context.role !== 'target' || context.sha256 !== inventory.snapshot_sha256) return false;
  if (context.kind === 'scan_snapshot') {
    return context.repo === inventory.repo && context.commit === inventory.commit;
  }
  const prefix = `https://github.com/${inventory.repo}/blob/${inventory.commit}/`;
  const pinned = context.pins.some(
    (pin) => pin.repo === inventory.repo && pin.commit === inventory.commit,
  );
  return [
    context.revision === inventory.commit,
    pinned,
    context.uri.startsWith(prefix),
    safeRepositoryPath(context.uri.slice(prefix.length)),
  ].every(Boolean);
}
export function discoveryInventoryErrors(input: DiscoveryInput): string[] {
  const { inventory, interpretation } = input;
  const errors: string[] = [];
  const target = interpretation.contexts.some((context) => matchesTarget(context, input));
  if (!target) errors.push('Discovery inventory needs the exact target snapshot.');
  if (
    new Set(inventory.candidates.map((candidate) => candidate.id)).size !==
    inventory.candidates.length
  ) {
    errors.push('Discovery inventory candidate identities are duplicated.');
  }
  for (const candidate of inventory.candidates) {
    if (candidate.id.trim() === '' || candidate.root.trim() === '') {
      errors.push('Discovery inventory candidate needs identity and root.');
    }
    errors.push(...discoveryEvidenceErrors(candidate.evidence, input));
    for (const evidence of candidate.evidence) {
      errors.push(...pinErrors(evidence, input));
      const path = evidencePath(evidence, input);
      const root = candidate.root.replace(/\/$/u, '');
      if (!candidatePathMatches(root, path)) {
        errors.push(`${candidate.id}: evidence source is outside its candidate root.`);
      }
    }
  }
  return errors;
}
