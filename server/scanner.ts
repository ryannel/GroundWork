/**
 * Repository scanning: prepare a pinned, Git-free snapshot for an untrusted worker, then apply its
 * evidence-checked discoveries to the catalog in one write.
 *
 * - scan-acquire: hardened git/gh commands, cloning, reading committed objects
 * - scan-inventory, scan-projects, scan-packets: what goes into the snapshot and how work is split
 * - scan-workspace: temporary scan directories and their metadata
 * - scan-evidence: citation checks shared by every apply path
 * - scan-baseline: apply_repository_scan; scan-lifecycle: investigations and reconciliation
 */
export {
  applyCatalogInvestigationSchema,
  applyRepositoryScanSchema,
  discardRepositoryScanSchema,
  prepareRepositoryScanSchema,
  reconcileCatalogSchema,
  repositoryDiscoverySchema,
} from '../src/data/scan-schema.ts'
export { applyRepositoryScan } from './scan-baseline.ts'
export { applyCatalogInvestigation, reconcileCatalog } from './scan-lifecycle.ts'
export { readScanManifest, readScanManifestSchema } from './scan-manifests.ts'
export { discardRepositoryScan, prepareRepositoryScan } from './scan-prepare.ts'
