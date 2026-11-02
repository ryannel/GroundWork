import type { AreaComponentView, AreaTechnicalRelationship } from '@/application/workspace-area';
import type { LandscapeFlowConnection } from '@/domain/landscape';

/** Prefer the saved interpretation; endpoint prose is a literal fallback, never an invented business outcome. */
export function connectionSummary(
  connection: AreaTechnicalRelationship,
  components: readonly AreaComponentView[],
  summaries: readonly LandscapeFlowConnection[] = [],
): string {
  const authored = summaries.find((summary) => {
    if (
      summary.from !== connection.from ||
      summary.to !== connection.to ||
      summary.kind !== connection.kind
    ) {
      return false;
    }
    const id = connection.endpointId;
    return id === null || id === undefined || summary.evidence.includes(id);
  });
  if (authored !== undefined) return authored.label;
  if (connection.summary !== undefined) return connection.summary;
  const endpoint = components
    .find((component) => component.id === connection.to)
    ?.endpoints.find((item) => item.id === connection.endpointId);
  const purpose = endpoint?.summary.trim() ?? '';
  if (purpose === '') return connection.label;
  const label =
    purpose
      .split(/[.;\n]/u)[0]
      ?.replaceAll('`', '')
      .trim() ?? '';
  return label === '' ? connection.label : label;
}

/** Multiple callers of the same operation share one explanation, not an inflated connection count. */
export function combinedConnectionSummary(
  connections: readonly { readonly label: string }[],
): string {
  const labels = [...new Set(connections.map((connection) => connection.label))];
  return labels.join('; ');
}

/** Preserve every call while stating repeated direction/evidence qualifications only once. */
export function connectionDetails(
  summary: string,
  connections: readonly { readonly detail: string }[],
): string {
  const notes = new Set<string>();
  const descriptions = connections.map(({ detail }) => {
    let description = detail;
    for (const note of [
      'Direction follows the initiating request, not its response.',
      'Declared dependency; no captured call site.',
      'Modelled access; deployed behaviour is not established.',
    ]) {
      if (description.includes(note)) {
        notes.add(note);
        description = description.replaceAll(note, '').trim();
      }
    }
    return description;
  });
  return [summary, ...new Set(descriptions), ...notes].join('\n\n');
}
