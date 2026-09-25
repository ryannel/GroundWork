import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { ContentDocuments } from '../shared/content.ts'
export async function readContentDirectory(root: string): Promise<ContentDocuments> {
  const files: ContentDocuments = {}
  async function visit(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile() && entry.name.endsWith('.json')) {
        const relative = path.relative(root, file).split(path.sep).join('/')
        try { files[relative] = JSON.parse(await readFile(file, 'utf8')) }
        catch (error) { throw new Error(`${relative}: ${error instanceof Error ? error.message : error}`, { cause: error }) }
      }
    }
  }
  await visit(root)
  return files
}
