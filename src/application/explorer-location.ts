import { explorerArtifactIndex } from '@/domain/explorer-artifact-index';
import { stripPrefix } from '@/domain/ids';
import type { ExplorerManifest, ExplorerService } from '@/domain/service-explorer';

export interface ExplorerLocation {
  readonly component: string;
  readonly file: string;
  readonly selected: string | null;
}
function published(manifest: ExplorerManifest, file: string | null): boolean {
  if (file === null) return false;
  return (
    manifest.artifacts.some((artifact) => artifact.file === file) ||
    explorerArtifactIndex(manifest, file) !== undefined
  );
}

/** Addresses select published evidence only; stale or foreign files return to the service overview. */
export function explorerLocation(manifest: ExplorerManifest, search: string): ExplorerLocation {
  const params = new URLSearchParams(search);
  const matched = matchService(manifest, params.get('service'));
  const service = matched ?? manifest.services[0];
  const requested = params.get('page');
  const compatible = params.get('service') === null || matched !== undefined;
  const known = compatible && published(manifest, requested);
  return {
    component: service?.id ?? '',
    file: known ? (requested ?? '') : (service?.overview ?? ''),
    selected: known ? params.get('node') : null,
  };
}

export function explorerSearch(location: ExplorerLocation): string {
  const params = new URLSearchParams({ service: location.component, page: location.file });
  if (location.selected !== null) params.set('node', location.selected);
  return `?${params.toString()}`;
}

export function serviceExplorerHref(workspace: string, component: string): string {
  return `/${encodeURIComponent(workspace)}/explorer/?service=${encodeURIComponent(component)}`;
}

function matchService(
  manifest: ExplorerManifest,
  requested: string | null,
): ExplorerService | undefined {
  const exact = manifest.services.find((service) => service.id === requested);
  if (exact !== undefined) return exact;
  const compatible = stripPrefix(requested, 'svc');
  return manifest.services.find((service) => service.id === compatible);
}
