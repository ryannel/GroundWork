import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { componentKindSchema } from '../shared/content-schema.ts'

// Guards the agent-facing catalog skill (shipped to every consumer repository) against drifting
// away from the zod schemas that `apply_repository_scan` actually enforces.

const skillRoot = path.resolve(import.meta.dirname, '../.agents/skills/groundwork-system-catalog')

/** Bullet literals such as `- \`third-party\`: ...` under a `## Heading` section. */
function literalsUnderHeading(markdown: string, heading: string): string[] {
  const sections = markdown.split(/^## /m)
  const section = sections.find(part => part.startsWith(`${heading}\n`))
  assert.ok(section, `Expected a "## ${heading}" section in taxonomy.md`)
  const literals = [...section!.matchAll(/^- `([a-z0-9-]+)`:/gm)].map(match => match[1])
  assert.ok(literals.length > 0, `Expected literal bullet points under "## ${heading}" in taxonomy.md`)
  return literals
}

test('taxonomy.md infrastructure literals exist in the component kind enum', async () => {
  const markdown = await readFile(path.join(skillRoot, 'references/taxonomy.md'), 'utf8')
  const literals = literalsUnderHeading(markdown, 'Infrastructure')
  const allowed = componentKindSchema.options as readonly string[]
  for (const literal of literals) {
    assert.ok(allowed.includes(literal), `taxonomy.md infrastructure literal "${literal}" is not one of ${allowed.join(', ')}`)
  }
})
