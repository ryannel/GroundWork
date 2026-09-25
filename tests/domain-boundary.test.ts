import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// Shared domain modules must work in the Node runtime without browser state.
const directory = new URL('../shared/', import.meta.url).pathname
const files = readdirSync(directory).filter(name => name.endsWith('.ts'))
const imports = (source: string) => [...source.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gm)]
  .map(match => match[1] ?? match[2])
const dom = /(?<![\w.'"`])(?:window|document)\s*(?:\?\.|\.|\[)|typeof\s+(?:window|document)\b/

test('shared domain modules stay free of React, the router and the DOM', () => {
  assert.ok(files.length > 10)
  const violations: string[] = []
  for (const name of files) {
    const source = readFileSync(path.join(directory, name), 'utf8')
    for (const specifier of imports(source)) {
      if (/^(?:react|react-dom|react-router|react-router-dom)(?:\/|$)/.test(specifier)) violations.push(`${name} imports ${specifier}`)
      if (/(?:^|\/)(?:runtime|store)(?:\.ts)?$/.test(specifier)) violations.push(`${name} imports browser state ${specifier}`)
    }
    if (dom.test(source)) violations.push(`${name} touches window or document`)
  }
  assert.deepEqual(violations, [])
})

test('the boundary check recognises the patterns it guards against', () => {
  const sample = `import { useState } from 'react'\nimport type { X } from "./store.ts"\nconst m = import('react-router-dom')`
  assert.deepEqual(imports(sample), ['react', './store.ts', 'react-router-dom'])
  assert.ok(dom.test('const p = window.location.pathname'))
  assert.ok(dom.test("document['title'] = x"))
  assert.equal(dom.test("issues.push('section documents require feature.json')"), false)
})
