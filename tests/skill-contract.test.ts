import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { componentKindSchema } from '../src/data/content-schema.ts'
import { repositoryDiscoverySchema } from '../src/data/scan-schema.ts'

// Guards the agent-facing catalog skill (shipped to every consumer repository) against drifting
// away from the zod schemas that `apply_repository_scan` actually enforces.

const skillRoot = path.resolve(import.meta.dirname, '../.agents/skills/groundwork-system-catalog')

function extractJsonBlocks(markdown: string): unknown[] {
  return [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]))
}

/** Bullet literals such as `- \`third-party\`: ...` under a `## Heading` section. */
function literalsUnderHeading(markdown: string, heading: string): string[] {
  const sections = markdown.split(/^## /m)
  const section = sections.find(part => part.startsWith(`${heading}\n`))
  assert.ok(section, `Expected a "## ${heading}" section in taxonomy.md`)
  const literals = [...section!.matchAll(/^- `([a-z0-9-]+)`:/gm)].map(match => match[1])
  assert.ok(literals.length > 0, `Expected literal bullet points under "## ${heading}" in taxonomy.md`)
  return literals
}

test('normalized-output.md JSON examples validate against the discovery schema', async () => {
  const markdown = await readFile(path.join(skillRoot, 'references/normalized-output.md'), 'utf8')
  const blocks = extractJsonBlocks(markdown)
  assert.ok(blocks.length > 0, 'Expected at least one ```json example in normalized-output.md')
  for (const block of blocks) repositoryDiscoverySchema.parse(block)
})

test('taxonomy.md ownership literals exist in the discovery schema ownership enum', async () => {
  const markdown = await readFile(path.join(skillRoot, 'references/taxonomy.md'), 'utf8')
  const literals = literalsUnderHeading(markdown, 'Ownership')
  const allowed = repositoryDiscoverySchema.shape.ownership.unwrap().options as readonly string[]
  for (const literal of literals) {
    assert.ok(allowed.includes(literal), `taxonomy.md ownership literal "${literal}" is not one of ${allowed.join(', ')}`)
  }
})

test('taxonomy.md infrastructure literals exist in the component kind enum', async () => {
  const markdown = await readFile(path.join(skillRoot, 'references/taxonomy.md'), 'utf8')
  const literals = literalsUnderHeading(markdown, 'Infrastructure')
  const allowed = componentKindSchema.options as readonly string[]
  for (const literal of literals) {
    assert.ok(allowed.includes(literal), `taxonomy.md infrastructure literal "${literal}" is not one of ${allowed.join(', ')}`)
  }
})
