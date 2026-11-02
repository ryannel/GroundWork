import { actorJourneyErrors } from './check-scan-actions';
import { receiptErrors, referencesFor } from './check-scan-answers';
import { bindingErrors } from './check-scan-bindings';
import { actorConstraintErrors } from './check-scan-constraints';
import { executionErrors } from './check-scan-execution';
import { frameworkErrors } from './check-scan-framework';
import { semanticErrors } from './check-scan-semantic';
import { scanRecords, type ScanRecords } from './scan-records';
import type { ScanDocument } from './scan.generated';

function recordErrors(document: ScanDocument, records: ScanRecords): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const record of scanRecords(document)) {
    if (ids.has(record.id)) errors.push(`${record.id}: duplicate record id`);
    ids.add(record.id);
    if ('support' in record) {
      errors.push(...referencesFor(records)(record.support, ['source', 'derivation'], record.id));
    }
  }
  for (const source of document.sources) {
    errors.push(...referencesFor(records)([source.host], ['host'], source.id));
    if (source.lines[0] > source.lines[1]) errors.push(`${source.id}: reversed source lines`);
  }
  for (const derivation of document.derivations) {
    errors.push(
      ...referencesFor(records)([derivation.rule], ['rule'], derivation.id),
      ...referencesFor(records)(derivation.sources, ['source'], derivation.id),
    );
  }
  for (const search of document.searches ?? []) {
    errors.push(
      ...referencesFor(records)([search.rule], ['rule'], search.id),
      ...referencesFor(records)(search.sources, ['source'], search.id),
    );
  }
  return errors;
}

function dependencyErrors(document: ScanDocument): string[] {
  const errors: string[] = [];
  const dependencies = new Set(document.dependencies.map((item) => item.id));
  for (const dependency of document.dependencies) {
    for (const id of dependency.dependsOn) {
      if (!dependencies.has(id)) errors.push(`${dependency.id}: missing dependency ${id}`);
    }
  }
  for (const closure of document.closures) {
    if (closure.dependencies.some((id) => !dependencies.has(id))) {
      errors.push(`${closure.id}: missing closure dependency`);
    }
  }
  return errors;
}

export function validateScanDocument(document: ScanDocument): string[] {
  const records = new Map(scanRecords(document).map((record) => [record.id, record]));
  return [
    ...recordErrors(document, records),
    ...dependencyErrors(document),
    ...receiptErrors(document, records),
    ...executionErrors(document, records),
    ...semanticErrors(document, records),
    ...frameworkErrors(document, records),
    ...bindingErrors(document, records),
    ...actorJourneyErrors(document, records),
    ...actorConstraintErrors({ document, records }),
  ];
}
