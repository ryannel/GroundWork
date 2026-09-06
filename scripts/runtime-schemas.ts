import { writeFile, readFile } from 'node:fs/promises'
import { z } from 'zod'
import { manifestSchema, portableProductSchema, deliverySchema } from '../server/format.ts'
import { operationSchemas } from '../server/operations.ts'
for (const [name, schema] of Object.entries({ 'portable-project': manifestSchema, 'portable-product': portableProductSchema, delivery: deliverySchema, ...operationSchemas })) {
  const file = new URL(`../schemas/${name}.schema.json`, import.meta.url)
  const json = JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n'
  if (process.argv[2] === 'check') { if (await readFile(file, 'utf8') !== json) throw new Error(`${name} schema is stale; run npm run schemas:portable`) }
  else await writeFile(file, json)
}
