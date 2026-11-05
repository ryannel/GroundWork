// Materialises the maintained typed fixture through the same writer as reader integration tests.
import { parseArgs } from 'node:util';

import { acmeFiles, writeWorkspace } from '@/../test/workspace-kit';

const { values } = parseArgs({ options: { out: { type: 'string' } } });
if (values.out === undefined) {
  throw new Error('Use --out <new fixture folder>, then register that folder locally.');
}
await writeWorkspace(values.out, acmeFiles());
console.log(values.out);
