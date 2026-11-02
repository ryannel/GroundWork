import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { assessRescanAcceptance, rescanAcceptanceGates } from '@/domain/scan/rescan-acceptance';
import { rescanTreeSummary } from '@/domain/scan/rescan-preflight';
import { parseRescanRoster } from '@/infrastructure/scan/rescan-preflight-input';

import { repositoryInventory } from './scan-repository-inventory';

function capabilityRouting(summary: ReturnType<typeof rescanTreeSummary>) {
  const parserLanguages = new Set([
    'typescript',
    'javascript',
    'java',
    'go',
    'csharp',
    'python',
    'rust',
  ]);
  return {
    languages: summary.languages.map((entry) => ({
      language: entry.language,
      files: entry.files,
      route: parserLanguages.has(entry.language) ? 'parser_candidate' : 'pinned_canonical_capture',
      semanticAcceptance: 'unclosed_until_verified',
      frameworkPolicy: 'discover_then_block_unrecognised_completeness',
    })),
    otherTrackedFiles: 'pinned_canonical_capture_and_source_form_review_required',
    exclusionPolicy:
      'Missing parser support never establishes ancillary completeness; exclusions require a source-pinned reason.',
  };
}
/** Reads tree metadata only: never blobs, parsers, fetches or interpretation inputs. */
export async function scanRescanPreflight(args: readonly string[]): Promise<void> {
  const [manifest, cloneRoot, output, fallbackRoot] = args;
  const invalidCount = args.length < 3 || args.length > 4;
  if (manifest === undefined || cloneRoot === undefined || output === undefined || invalidCount) {
    throw new Error(
      'Usage: scan-rescan-preflight.ts <scan-state.json> <clone-root> <NEW-report.json> [fallback-flat-clone-root]',
    );
  }
  const manifestBytes = await readFile(manifest, 'utf8');
  const roster = parseRescanRoster(JSON.parse(manifestBytes));
  const repositories = roster.repositories.map((repository) => {
    try {
      const primary = path.join(cloneRoot, repository.repo);
      let selected = primary;
      let inventory: ReturnType<typeof repositoryInventory>;
      try {
        inventory = repositoryInventory(primary, repository.commit);
      } catch (error) {
        if (fallbackRoot === undefined) throw error;
        selected = path.join(fallbackRoot, repository.repo.split('/').at(-1) ?? '');
        inventory = repositoryInventory(selected, repository.commit);
      }
      const summary = rescanTreeSummary(inventory.files);
      return {
        repo: repository.repo,
        clone: selected,
        commit: inventory.commit,
        tree: inventory.tree,
        status: 'metadata_available',
        ...summary,
        capabilityRouting: capabilityRouting(summary),
      };
    } catch {
      return { repo: repository.repo, commit: repository.commit, status: 'metadata_unavailable' };
    }
  });
  const report = {
    format: 'rescan-preflight/v1',
    status: 'metadata_preflight_only',
    launchReadiness: 'requires_representative_capability_and_control_proofs',
    ingestionAcceptance: 'requires_per_repository_semantic_and_product_receipts',
    rosterSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    repositoryCount: repositories.length,
    repositories,
    sourcePolicy:
      'Pinned local Git tree metadata only; no lazy fetch, blob reads, parsing or queue restart.',
    requiredGates: rescanAcceptanceGates,
    acceptanceStatus: assessRescanAcceptance({ repositories: roster.repositories, evidence: [] })
      .status,
    acceptance:
      'Every repository requires current language, framework, semantic and product receipts. Metadata availability is not scan readiness. Other suffixes require explicit source-language mapping review.',
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
}
if (process.argv[1] === import.meta.filename) await scanRescanPreflight(process.argv.slice(2));
