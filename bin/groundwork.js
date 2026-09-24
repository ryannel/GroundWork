#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
const entry = new URL('../runtime/server/cli.js', import.meta.url)
let cli
try {
  cli = await import(entry.href)
} catch (error) {
  if (error?.code === 'ERR_MODULE_NOT_FOUND' && String(error.message).includes(fileURLToPath(entry))) {
    console.error('Groundwork has not been built in this checkout. Run npm run build first.')
    process.exit(1)
  }
  throw error
}
await cli.run()
