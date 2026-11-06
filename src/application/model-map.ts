// Human-readable inventories share the same index as pages and tools.
import type { ModelIndex } from '@/application/model-index';
import type { ModelSystem } from '@/domain/workspace-model';

export interface ModelCounts {
  readonly domains: number;
  readonly systems: number;
  readonly components: number;
  readonly entries: number;
  readonly handlers: number;
  readonly steps: number;
  readonly evidence: number;
  readonly edges: number;
  readonly gaps: number;
}
export function modelCounts(index: ModelIndex): ModelCounts {
  const count = (...kinds: readonly string[]): number =>
    index.entities.filter((entity) => kinds.includes(entity.kind)).length;
  return {
    domains: count('domain'),
    systems: count('system'),
    components: count('service', 'app', 'store', 'topic'),
    entries: index.entries().length,
    handlers: count('handler'),
    steps: count('step'),
    evidence: count('evidence'),
    edges: index.edges().length,
    gaps: index.gaps().length,
  };
}
function systemLines(system: ModelSystem, index: ModelIndex): readonly string[] {
  const lines = [`### ${system.name} (\`${system.id}\`)`, ''];
  if (system.purpose !== undefined) lines.push(system.purpose, '');
  for (const component of system.components) {
    const homes = index.codeHomes(component.id).map((home) => `${home.repo}/${home.path ?? ''}`);
    const location = homes.length === 0 ? '' : ` — ${homes.join(', ')}`;
    lines.push(`- \`${component.id}\` ${component.name}${location}`);
  }
  return [...lines, ''];
}
/** Pins say when code was read; they make no claim about an unchecked remote branch. */
export function modelMarkdownOf(index: ModelIndex): string {
  const { model } = index;
  const lines = [
    `# ${model.name}: system map`,
    '',
    ...model.evidence.map(
      ({ repository }) =>
        `- ${repository.repo}: read at \`${repository.commit}\` on ${repository.scannedAt}.`,
    ),
    '',
  ];
  for (const domain of model.domains) {
    lines.push(
      `## ${domain.name} (\`${domain.id}\`)`,
      '',
      ...domain.systems.flatMap((system) => systemLines(system, index)),
    );
  }

  lines.push(
    '## Recorded exchanges',
    '',
    ...index
      .edges()
      .map(
        (edge) =>
          `- \`${edge.from}\` → \`${edge.to}\`: ${edge.kind} via \`${edge.via}\` at \`${edge.site}\`.`,
      ),
    '',
    '## Gaps',
    '',
    ...index.gaps().map((gap) => `- \`${gap.id}\`: ${gap.message}`),
  );
  return `${lines.join('\n').trimEnd()}\n`;
}
