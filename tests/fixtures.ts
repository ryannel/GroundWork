import { readContentDirectory } from '../scripts/content-files.ts'
import { loadContent } from '../src/data/content.ts'
import { livePrototypeIds } from '../src/data/live-prototypes.ts'
export const documents = await readContentDirectory(new URL('./fixtures/content', import.meta.url).pathname)
export const snapshot = loadContent(documents, livePrototypeIds)
export const taxRulesSpec = snapshot.features.find(feature => feature.id === 'f-2')!.spec!
