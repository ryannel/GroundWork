// Generates every JSON Schema in schemas/ from its zod source: content documents, portable plan files and operation
// inputs. `check` fails on a stale or missing file and on an orphan left behind by a removed schema; writing also
// deletes orphans, because the directory is entirely generated.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { documentSchemas } from '../shared/content-schema.ts'
import { deliverySchema } from '../server/format.ts'
import { operationSchemas } from '../server/operations.ts'

const directory = path.resolve(import.meta.dirname, '../schemas')
const groups: Record<string, Record<string, z.ZodType>> = {
  content: documentSchemas,
  portable: {
    delivery: deliverySchema,
  },
  operations: operationSchemas,
}

/** One name → schema map; two groups defining the same file name is a mistake, not an override. */
function allSchemas() {
  const all = new Map<string, z.ZodType>()
  for (const [group, schemas] of Object.entries(groups)) for (const [name, schema] of Object.entries(schemas)) {
    if (all.has(name)) throw new Error(`Schema name ${name} in ${group} collides with another group`)
    all.set(name, schema)
  }
  return all
}

try {
  const check = process.argv[2] === 'check'
  const expected = new Map([...allSchemas()].map(([name, schema]) => [`${name}.schema.json`, JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n']))
  await mkdir(directory, { recursive: true })
  const present = (await readdir(directory)).filter(file => file.endsWith('.schema.json'))
  const orphans = present.filter(file => !expected.has(file))
  const problems: string[] = []
  for (const [file, json] of expected) {
    const current = await readFile(path.join(directory, file), 'utf8').catch(() => null)
    if (current === json) continue
    if (check) problems.push(current === null ? `${file} is missing` : `${file} is stale`)
    else await writeFile(path.join(directory, file), json)
  }
  for (const file of orphans) {
    if (check) problems.push(`${file} has no schema source`)
    else await rm(path.join(directory, file))
  }
  if (problems.length) throw new Error(`${problems.join('\n')}\nRun npm run schemas to regenerate schemas/.`)
  console.log(check ? `All ${expected.size} schemas are up to date.` : `Wrote ${expected.size} schemas.`)
} catch (error) { console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1 }
