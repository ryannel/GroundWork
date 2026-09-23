import { readContentDirectory } from '../server/content-files.ts'
import { loadContent } from '../src/data/content.ts'
export const documents = await readContentDirectory(new URL('./fixtures/content', import.meta.url).pathname)
export const snapshot = loadContent(documents)
export const taxRulesSpec = snapshot.features.find(feature => feature.id === 'f-2')!.spec!
