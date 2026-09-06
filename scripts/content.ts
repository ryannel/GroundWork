import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { documentSchemas } from '../src/data/content-schema.ts'
import { loadContent } from '../src/data/content.ts'
import { livePrototypeIds } from '../src/data/live-prototypes.ts'
import { readContentDirectory } from './content-files.ts'
const root = path.resolve(import.meta.dirname, '..')
try {
  if (process.argv[2] === 'schemas' || process.argv[2] === 'check-schemas') {
    await mkdir(path.join(root, 'schemas'), { recursive: true })
    for (const [name, schema] of Object.entries(documentSchemas)) {
      const file = path.join(root, 'schemas', `${name}.schema.json`)
      const json = JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n'
      if (process.argv[2] === 'schemas') await writeFile(file, json)
      else if (await readFile(file, 'utf8') !== json) throw new Error(`${name} schema is stale; run npm run content:schemas`)
    }
    console.log('Content schemas are up to date.')
  } else {
    const snapshot = loadContent(await readContentDirectory(path.resolve(process.argv[2] ?? path.join(root, 'content'))), livePrototypeIds)
    console.log(`Valid content: ${snapshot.workspaces.length} workspaces, ${snapshot.products.length} products, ${snapshot.components.length} components, ${snapshot.features.length} features.`)
  }
} catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 }
