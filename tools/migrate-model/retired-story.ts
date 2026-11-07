import path from 'node:path';

import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { convertCitations, type MigrationCitations } from './citations';
import type { MigrationFile } from './files';
import type { MigrationFragment } from './workspace';

function conceptPlacements(files: readonly MigrationFile[]): ReadonlyMap<string, string | null> {
  const placements = new Map<string, string | null>();
  for (const file of files.filter((entry) => entry.path.endsWith('/system.yaml'))) {
    const folder = path.posix.dirname(path.posix.dirname(path.posix.dirname(file.path)));
    for (const component of modelList(modelRecord(file.value)?.components)) {
      const id = modelText(modelRecord(component)?.id);
      if (id !== null) {
        const target = `${folder}/language.yaml`;
        const previous = placements.get(id);
        placements.set(id, previous === undefined || previous === target ? target : null);
      }
    }
  }
  return placements;
}

function conceptFragment(
  output: ReadonlyMap<string, MigrationFragment>,
  concept: unknown,
  placements: ReadonlyMap<string, string | null>,
  citations: MigrationCitations,
): readonly [string, MigrationFragment] {
  const node = modelRecord(concept);
  const id = modelText(node?.id);
  const born = modelText(node?.born_in);
  const target = born === null ? undefined : placements.get(born);
  if (id === null || target === undefined || target === null) {
    throw new Error(
      `story.yaml: concept ${id ?? '(unnamed)'} has no uniquely recorded born_in domain; retain it for placement review.`,
    );
  }
  const previous = modelRecord(output.get(target)?.value) ?? {};
  const concepts = modelList(previous.concepts);
  if (concepts.some((value) => modelRecord(value)?.id === id)) {
    throw new Error(
      `story.yaml: concept ${id} already exists in ${target}; reconcile both authored records before migration.`,
    );
  }
  return [
    target,
    {
      family: 'workspace',
      definition: 'DomainLanguageFile',
      value: { ...previous, concepts: [...concepts, convertCitations(concept, citations)] },
    },
  ];
}

/** The retired workspace story is not a new execution model. Its concepts still belong in the kept glossary. */
export function migrateRetiredStory(
  files: readonly MigrationFile[],
  existing: ReadonlyMap<string, MigrationFragment>,
  citations: MigrationCitations,
): ReadonlyMap<string, MigrationFragment> {
  const story = modelRecord(files.find((file) => file.path === 'story.yaml')?.value);
  if (story === null) return existing;
  const placements = conceptPlacements(files);
  const output = new Map(existing);
  for (const concept of modelList(story.concepts)) {
    const [file, fragment] = conceptFragment(output, concept, placements, citations);
    output.set(file, fragment);
  }
  const aliases = modelRecord(output.get('aliases.yaml')?.value) ?? {};
  const stages = modelList(story.stages).flatMap((stage) => {
    const id = modelText(modelRecord(stage)?.id);
    return id === null
      ? []
      : [
          [
            id,
            {
              to: null,
              reason:
                'The workspace story stage is retired by rebuild design §4. Its complete authored summary, services, ordering and flows remain in the retained story.yaml and migration receipt; no successor execution stage is inferred.',
            },
          ] as const,
        ];
  });
  output.set('aliases.yaml', {
    family: 'workspace',
    definition: 'AliasesFile',
    value: { ...aliases, ...Object.fromEntries(stages) },
  });
  return output;
}
