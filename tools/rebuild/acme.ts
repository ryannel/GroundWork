// Materialises the reviewed canonical fixture; migration decisions live in the PR8 handoff.
import { cp } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { out: { type: 'string' } } });
if (values.out === undefined) {
  throw new Error('Use --out <new fixture folder>, then register that folder locally.');
}
await cp(new URL('../../test/fixtures/acme-model/', import.meta.url), values.out, {
  recursive: true,
});
console.log(values.out);
