import {
  claimTouchesCandidate,
  discoveryEvidenceContains,
  discoveryEvidenceErrors,
} from './discovery-evidence';
import type { DiscoveryCandidate, DiscoveryInput } from './discovery-types';
import type {
  ActionHost,
  CandidateDisposition,
  DiscoveredComponent,
  DiscoveryEvidence,
  ScanDiscovery,
  DiscoveryReceipt,
} from './discovery.generated';
import type { Claim } from './interpretation.generated';

export function dispositionComponents(disposition: CandidateDisposition): readonly string[] {
  if (disposition.disposition === 'split') return disposition.component_ids ?? [];
  return disposition.component_id === null ? [] : [disposition.component_id];
}
function safeRoot(root: string): boolean {
  return (
    root === '.' ||
    (!root.startsWith('/') &&
      !root.includes('\\') &&
      root.split('/').every((part) => !['', '.', '..'].includes(part)))
  );
}
function ownsPath(root: string, sourcePath: string): boolean {
  return root === '.' || sourcePath === root || sourcePath.startsWith(`${root}/`);
}
function evidencePath(evidence: DiscoveryEvidence, input: DiscoveryInput): string | undefined {
  if (evidence.kind === 'context_snapshot') return evidence.path;
  const snapshot = input.snapshots.find((item) => item.id === evidence.context_id);
  return snapshot?.kind === 'scan_snapshot'
    ? snapshot.document.sources.find((item) => item.id === evidence.source_id)?.path
    : undefined;
}
function inventoryBasis(
  evidence: DiscoveryEvidence,
  input: DiscoveryInput,
  bases: readonly string[],
): boolean {
  return input.inventory.candidates.some((candidate) =>
    candidate.evidence.some(
      (item) => bases.includes(item.basis) && discoveryEvidenceContains(item, evidence),
    ),
  );
}
function componentHostEvidence(
  component: DiscoveredComponent,
  input: DiscoveryInput,
): readonly DiscoveryEvidence[] {
  return component.evidence.filter((evidence) => {
    const path = evidencePath(evidence, input);
    return (
      path !== undefined &&
      component.source_roots?.some((root) => ownsPath(root, path)) === true &&
      inventoryBasis(evidence, input, ['entry', 'implementation'])
    );
  });
}
function rootsOverlap(left: DiscoveredComponent, right: DiscoveredComponent): boolean {
  return (
    left.source_roots?.some(
      (root) =>
        right.source_roots?.some((other) => ownsPath(root, other) || ownsPath(other, root)) ===
        true,
    ) === true
  );
}
function splitComponentErrors(document: ScanDiscovery, input: DiscoveryInput): string[] {
  const errors: string[] = [];
  for (const disposition of document.candidates.filter((item) => item.disposition === 'split')) {
    const components = document.components.filter((component) =>
      dispositionComponents(disposition).includes(component.id),
    );
    for (const component of components) {
      const roots = component.source_roots ?? [];
      if (roots.length === 0 || roots.some((root) => !safeRoot(root))) {
        errors.push(`${component.id}: split host needs safe explicit source roots.`);
      }
      if (componentHostEvidence(component, input).length === 0) {
        errors.push(
          `${component.id}: split host needs host-local entry or implementation evidence.`,
        );
      }
      if (components.some((other) => other.id !== component.id && rootsOverlap(component, other))) {
        errors.push(`${component.id}: split host source roots overlap another host.`);
      }
    }
  }
  return errors;
}
function bindingErrors(
  binding: ActionHost,
  document: ScanDiscovery,
  input: DiscoveryInput,
): string[] {
  const errors = discoveryEvidenceErrors(binding.evidence, input);
  const claim = input.interpretation.claims.find((item) => item.id === binding.action_id);
  const component = document.components.find((item) => item.id === binding.component_id);
  if (claim?.kind !== 'action' || !component) {
    return [...errors, `${binding.action_id}: action host needs a real action and component.`];
  }
  const hostEvidence = componentHostEvidence(component, input);
  const local = {
    id: component.id,
    kind: 'boundary' as const,
    root: '.',
    evidence: hostEvidence.map((evidence) => ({ ...evidence, basis: 'entry' as const })),
  };
  const declared = binding.evidence.some(
    (evidence) =>
      component.evidence.some((item) => discoveryEvidenceContains(item, evidence)) &&
      inventoryBasis(evidence, input, ['boundary', 'entry']),
  );
  const inspected = hostEvidence.some((evidence) =>
    binding.evidence.some((item) => discoveryEvidenceContains(evidence, item)),
  );
  const supported =
    claimTouchesCandidate(claim.support, local) && claimTouchesCandidate(claim.entrypoints, local);
  if (!declared || !inspected || !supported) {
    errors.push(
      `${binding.action_id}: action host needs declared host evidence and matching host-local action support and entrypoints.`,
    );
  }
  if (
    binding.evidence.some(
      (evidence) => !component.evidence.some((item) => discoveryEvidenceContains(item, evidence)),
    )
  ) {
    errors.push(`${binding.action_id}: action host evidence belongs to another component.`);
  }
  const run = input.interpretation.runs.find((item) => item.id === claim.run_id);
  if (
    !run ||
    binding.evidence.some((evidence) => !run.input_context_ids.includes(evidence.context_id))
  ) {
    errors.push(`${binding.action_id}: action host evidence was not supplied to its run.`);
  }
  return errors;
}
function hostCandidate(component: DiscoveredComponent, input: DiscoveryInput): DiscoveryCandidate {
  return {
    id: component.id,
    kind: 'boundary',
    root: '.',
    evidence: componentHostEvidence(component, input).map((evidence) => ({
      ...evidence,
      basis: 'entry',
    })),
  };
}
function actionIds(claim: Claim | undefined): readonly string[] {
  if (claim?.kind === 'action') return [claim.id];
  return claim?.kind === 'journey' ? claim.steps.map((step) => step.action) : [];
}
function splitReceiptErrorsFor(
  receipt: DiscoveryReceipt,
  document: ScanDiscovery,
  input: DiscoveryInput,
): string[] {
  const errors: string[] = [];
  const component = document.components.find((item) => item.id === receipt.component_id);
  if (!component) return errors;
  const local = hostCandidate(component, input);
  for (const id of receipt.claim_ids) {
    const claim = input.interpretation.claims.find((item) => item.id === id);
    if (!claim || !claimTouchesCandidate(claim.support, local)) {
      errors.push(`${id}: split-host receipt lacks host-local claim support.`);
    }
    for (const action of actionIds(claim)) {
      if (
        document.action_hosts?.some(
          (binding) =>
            binding.action_id === action &&
            (claim?.kind !== 'action' || binding.component_id === component.id),
        ) !== true
      ) {
        errors.push(`${action}: split-host receipt needs its explicit primary action host.`);
      }
    }
  }
  const inspected = receipt.inspected.every(
    (evidence) =>
      component.evidence.some((item) => discoveryEvidenceContains(item, evidence)) ||
      inventoryBasis(evidence, input, ['boundary']),
  );
  if (!inspected) {
    errors.push(`${component.id}: split-host receipt inspected another host's implementation.`);
  }
  return errors;
}
function splitReceiptErrors(document: ScanDiscovery, input: DiscoveryInput): string[] {
  const splitIds = new Set(
    document.candidates
      .filter((item) => item.disposition === 'split')
      .flatMap(dispositionComponents),
  );
  return document.receipts
    .filter((receipt) => splitIds.has(receipt.component_id))
    .flatMap((receipt) => splitReceiptErrorsFor(receipt, document, input));
}
function splitBehaviourErrors(document: ScanDiscovery): string[] {
  const splitIds = new Set(
    document.candidates
      .filter((item) => item.disposition === 'split')
      .flatMap(dispositionComponents),
  );
  return document.behaviours.flatMap((receipt) => {
    const disposition = document.candidates.find(
      (item) => item.candidate_id === receipt.candidate_id,
    );
    const hosts =
      disposition === undefined
        ? []
        : dispositionComponents(disposition).filter((id) => splitIds.has(id));
    if (hosts.length === 0 || receipt.outcome !== 'explained') return [];
    return receipt.claim_ids.flatMap((action) =>
      document.action_hosts?.some(
        (binding) => binding.action_id === action && hosts.includes(binding.component_id),
      ) === true
        ? []
        : [`${action}: split-host entry behaviour needs its explicit primary action host.`],
    );
  });
}
export function discoveryHostErrors(document: ScanDiscovery, input: DiscoveryInput): string[] {
  const bindings = document.action_hosts ?? [];
  const duplicates = new Set(bindings.map((item) => item.action_id)).size !== bindings.length;
  return [
    ...splitComponentErrors(document, input),
    ...bindings.flatMap((binding) => bindingErrors(binding, document, input)),
    ...splitReceiptErrors(document, input),
    ...splitBehaviourErrors(document),
    ...(duplicates
      ? [
          'An action must have exactly one primary action host; duplicate or cross-host bindings are invalid.',
        ]
      : []),
  ];
}
