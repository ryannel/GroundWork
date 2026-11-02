import 'server-only';

import { z } from 'zod';

const roster = z.object({
  repositories: z
    .array(
      z.object({
        repo: z.string().regex(/^[a-zA-Z0-9][\w.-]*\/[a-zA-Z0-9][\w.-]*$/u),
        commit: z.string().regex(/^[a-f0-9]{40}$/u),
      }),
    )
    .min(1),
});
export function parseRescanRoster(value: unknown): z.infer<typeof roster> {
  const result = roster.parse(value);
  const names = result.repositories.map((repository) => repository.repo);
  if (new Set(names).size !== names.length) {
    throw new Error('Duplicate repository in rescan roster');
  }
  return result;
}
