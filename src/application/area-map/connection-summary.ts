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
