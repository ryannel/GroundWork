import { expect, it } from 'vitest';

import { skillProducerUses } from './skill-producers';

it('finds retired producer commands and helper imports in tracked skill content', () => {
  const files = new Map([
    [
      '.agents/skills/example/SKILL.md',
      [
        'npm run --silent scan:pass -- <repo>',
        'npm --silent run scan:interpretation -- <draft>',
        'node --import ./tools/register.ts tools/scan-mark.ts <workspace>',
        'npm run scan:model -- --workspace acme',
      ].join('\n'),
    ],
    ['.agents/skills/example/check.mjs', 'import { readWorkspaceModel } from "./tool.mjs";'],
    ['docs/archives/old-scan.md', 'npm run scan:pass'],
  ]);
  expect(
    skillProducerUses(files, {
      'scan:pass': 'node --import ./tools/register.ts tools/scan-repository-pass.ts',
      'scan:interpretation': 'node tools/scan-interpretation.ts',
      'scan:model': 'node tools/scan-model.ts',
    }),
  ).toEqual([
    { file: '.agents/skills/example/SKILL.md', line: 1, target: 'tools/scan-repository-pass.ts' },
    { file: '.agents/skills/example/SKILL.md', line: 2, target: 'tools/scan-interpretation.ts' },
    { file: '.agents/skills/example/SKILL.md', line: 3, target: 'tools/scan-mark.ts' },
    { file: '.agents/skills/example/check.mjs', line: 1, target: 'readWorkspaceModel' },
  ]);
});
