import { describe, expect, it } from 'vitest';

import { generatedActionEntries } from './scan-repository-generated-config';

function recipe(entries: string): string {
  return `import { createActionConfig } from '../rolldown.config.mjs'; export default createActionConfig([${entries}]);`;
}
describe('bounded static action build grammar', () => {
  it('supports root, source-directory and nested output entries in order', () => {
    expect(
      generatedActionEntries(
        recipe(
          "{input:'main.mjs',file:'dist/index.mjs'},{input:'src/dependency-matrix.mjs',file:'dist/dependency-matrix/index.mjs',},",
        ),
      ),
    ).toEqual([
      { input: 'main.mjs', output: 'dist/index.mjs' },
      { input: 'src/dependency-matrix.mjs', output: 'dist/dependency-matrix/index.mjs' },
    ]);
  });
  it.each([
    "{input:'../main.mjs',file:'dist/index.mjs'}",
    "{input:'/main.mjs',file:'dist/index.mjs'}",
    "{input:'src//main.mjs',file:'dist/index.mjs'}",
    "{input:'src/main.mjs',file:'dist/../index.mjs'}",
    "{input:'src/main.mjs',file:'/dist/index.mjs'}",
    "{input:'dist/main.mjs',file:'dist/index.mjs'}",
    "{input:'s rc/main.mjs',file:'dist/index.mjs'}",
    "{input:process.env.INPUT,file:'dist/index.mjs'}",
    "{input:'src/main.mjs',file:'dist/index.mjs',external:true}",
    "{input:'a.mjs',file:'dist/index.mjs'},{input:'b.mjs',file:'dist/index.mjs'}",
    "{input:'main.mjs',file:'dist/index.mjs'}{input:'second.mjs',file:'dist/second.mjs'}",
    '',
  ])('rejects unsupported or unsafe entry list %s', (entries) => {
    expect(generatedActionEntries(recipe(entries))).toBeUndefined();
  });
  it('rejects additional executable configuration', () => {
    expect(
      generatedActionEntries(`${recipe("{input:'main.mjs',file:'dist/index.mjs'}")} run();`),
    ).toBeUndefined();
  });
});
