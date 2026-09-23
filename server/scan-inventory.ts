import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { broaderChange } from './catalog-freshness.ts'
import { identityNames, laneTerms, manifestNames, type InventoryFile } from './scan-projects.ts'

interface InventoryBudgets { maxFiles: number; maxBytes: number }

const generatedSegments = new Set([
  '.git', '.next', '.nuxt', '.output', 'bin', 'build', 'coverage', 'dist', 'node_modules',
  'obj', 'out', 'target', 'vendor',
])
const excludedNames = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb',
  'composer.lock', 'cargo.lock', 'poetry.lock', 'gemfile.lock',
])
const binaryExtensions = new Set([
  '.7z', '.a', '.avif', '.bin', '.bmp', '.class', '.dll', '.dylib', '.eot', '.exe', '.gif',
  '.gz', '.ico', '.jar', '.jpeg', '.jpg', '.map', '.mp3', '.mp4', '.o', '.otf', '.pdf',
  '.png', '.so', '.tar', '.tgz', '.ttf', '.wasm', '.webp', '.woff', '.woff2', '.zip',
])

function excludedReason(file: string) {
  const lower = file.toLowerCase()
  const segments = lower.split('/')
  if (lower === 'agents.md' || lower === 'claude.md' || lower.startsWith('.agents/') || lower === '.github/copilot-instructions.md' || lower.startsWith('.github/agents/') || lower.startsWith('.github/instructions/')) return 'agent-instructions'
  if (segments.some(segment => generatedSegments.has(segment))) return 'generated-or-vendored'
  if (excludedNames.has(path.posix.basename(lower)) || lower.endsWith('.lock')) return 'lockfile'
  if (lower.endsWith('.min.js') || lower.endsWith('.min.css') || lower.endsWith('.snap')) return 'generated-or-vendored'
  if (binaryExtensions.has(path.posix.extname(lower))) return 'binary'
  return null
}

export async function inventory(acquisition: string, budgets: InventoryBudgets, raw: string) {
  const entries = raw.split('\0').filter(Boolean).map(entry => {
    const match = /^(\d+) ([a-f0-9]+) \d\t(.+)$/.exec(entry)
    if (!match) throw new Error('Git returned an unsupported file inventory')
    return { mode: match[1], digest: match[2], path: match[3] }
  })
  const excluded: Record<string, number> = {}
  const candidates: InventoryFile[] = []
  for (const entry of entries) {
    const reason = entry.mode === '160000' ? 'submodule' : entry.mode === '120000' ? 'symlink' : excludedReason(entry.path)
    if (reason) { excluded[reason] = (excluded[reason] ?? 0) + 1; continue }
    if (entry.mode !== '100644' && entry.mode !== '100755') { excluded['unsupported-mode'] = (excluded['unsupported-mode'] ?? 0) + 1; continue }
    const file = path.join(acquisition, ...entry.path.split('/'))
    const info = await stat(file)
    if (info.size > 1024 * 1024) { excluded.oversized = (excluded.oversized ?? 0) + 1; continue }
    const head = await readFile(file).then(value => value.subarray(0, 4096))
    if (head.includes(0)) { excluded.binary = (excluded.binary ?? 0) + 1; continue }
    const text = head.toString('utf8')
    if (text.startsWith('version https://git-lfs.github.com/spec/v1')) { excluded['git-lfs-pointer'] = (excluded['git-lfs-pointer'] ?? 0) + 1; continue }
    if (/@generated|code generated .* do not edit|auto-generated file/i.test(text)) { excluded['generated-header'] = (excluded['generated-header'] ?? 0) + 1; continue }
    candidates.push({ path: entry.path, digest: entry.digest, bytes: info.size })
  }
  const priority = (file: InventoryFile) => {
    const name = path.posix.basename(file.path).toLowerCase()
    if (identityNames.has(name) || manifestNames.has(name) || name.endsWith('.csproj')) return 0
    if (Object.values(laneTerms).some(pattern => pattern.test(file.path))) return 1
    return 2
  }
  candidates.sort((a, b) => priority(a) - priority(b) || a.path.localeCompare(b.path))
  const files: InventoryFile[] = []
  let bytes = 0
  for (const file of candidates) {
    if (files.length >= budgets.maxFiles || bytes + file.bytes > budgets.maxBytes) { excluded.budget = (excluded.budget ?? 0) + 1; continue }
    files.push(file); bytes += file.bytes
  }
  const dependencies = entries.filter(entry => /^100(?:644|755)$/.test(entry.mode) && broaderChange(entry.path))
  return { files, excluded, dependencyFingerprints: dependencies.slice(0, 10000).map(entry => ({ path: entry.path, digest: entry.digest })), omittedDependencyFingerprints: Math.max(0, dependencies.length - 10000) }
}
