import 'server-only';

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

const INSTRUCTIONS = [
  '.agents/skills/groundwork-scan/SKILL.md',
  '.agents/skills/groundwork-explore/SKILL.md',
  '.agents/skills/groundwork-schema/interpretation.md',
] as const;

async function fingerprint(files: readonly string[]): Promise<string> {
  const inputs = await Promise.all(
    files.map(async (filename) => ({
      filename,
      sha256: createHash('sha256')
        .update(await readFile(filename))
        .digest('hex'),
    })),
  );
  return createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
}

/** Interpretation guidance and assessment rules invalidate reviews independently of native parsing. */
export async function discoveryValidationVersion(): Promise<{
  readonly assessmentRulesSha256: string;
  readonly interpretationInstructionsSha256: string;
}> {
  const names = await readdir('src/domain/scan');
  const domain = names
    .filter((name) => /^(?:discovery-|interpretation-).*\.ts$/u.test(name))
    .filter((name) => !name.endsWith('.test.ts'))
    .toSorted((left, right) => left.localeCompare(right))
    .map((name) => `src/domain/scan/${name}`);
  const files = [
    ...domain,
    'schema/scan-discovery.schema.json',
    'schema/scan-interpretation.schema.json',
    'tools/scan-discovery.ts',
    'tools/scan-discovery-io.ts',
    'tools/scan-discovery-review.ts',
    'tools/scan-interpretation.ts',
    'src/infrastructure/scan/discovery-format.ts',
    'src/infrastructure/scan/discovery-format-inputs.ts',
    'src/infrastructure/scan/discovery-review-format.ts',
    'src/infrastructure/scan/discovery-inventory-verify.ts',
    'src/infrastructure/scan/interpretation-format.ts',
    'src/infrastructure/scan/interpretation-inputs.ts',
    'src/infrastructure/scan/verified-scan-snapshot.ts',
    'src/infrastructure/scan/framed-scan-document.ts',
    'src/infrastructure/scan/framed-scan-storage.ts',
    'src/infrastructure/scan/discovery-validation-version.ts',
  ];
  return {
    assessmentRulesSha256: await fingerprint(files),
    interpretationInstructionsSha256: await fingerprint(INSTRUCTIONS),
  };
}
