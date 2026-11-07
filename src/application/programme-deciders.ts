interface ProgrammeDeciders {
  readonly decisions?: readonly { readonly decider?: string }[];
  readonly questions?: readonly { readonly decider?: string }[];
}

/** An authored decision or question can name only a declared workspace team as decider. */
export function programmeDeciderProblems(
  programme: ProgrammeDeciders,
  isTeam: (id: string) => boolean,
): readonly {
  readonly path: readonly [collection: 'decisions' | 'questions', index: number, field: 'decider'];
  readonly message: string;
}[] {
  return (['decisions', 'questions'] as const).flatMap((collection) =>
    (programme[collection] ?? []).flatMap(({ decider }, index) =>
      decider === undefined || isTeam(decider)
        ? []
        : [
            {
              path: [collection, index, 'decider'],
              message: `${decider} is not in workspace.yaml; fix the team id`,
            },
          ],
    ),
  );
}
