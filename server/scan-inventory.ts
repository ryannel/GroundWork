import path from 'node:path'
import { broaderChange } from './catalog-freshness.ts'
import { identityNames, laneTerms, manifestNames, type InventoryFile } from './scan-projects.ts'

interface InventoryBudgets { maxFiles: number; maxBytes: number }
/** One entry of `git ls-tree -r -l`: blob sizes come from the object database, so no content is read to filter by size. */
export interface TreeEntry { mode: string; digest: string; bytes: number; path: string }
export type BlobReader = (digests: string[]) => Promise<Map<string, Buffer>>

/** Files larger than this are never copied into a scan snapshot. */
export const FILE_SIZE_LIMIT = 1024 * 1024
/** Leading bytes inspected to recognise binary, LFS-pointer and generated files. */
export const SNIFF_BYTES = 4096
const READ_BATCH_FILES = 64
const READ_BATCH_BYTES = 8 * 1024 * 1024
const MAX_DEPENDENCY_FINGERPRINTS = 10000

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
/**
 * Instructions addressed to coding agents are never copied to the scan worker, at any depth:
 * AGENTS.md, CLAUDE.md, GEMINI.md, .cursorrules, .windsurfrules, copilot-instructions.md,
 * and anything under .agents/, .claude/, .cursor/rules/, .github/agents/ or .github/instructions/.
 */
const agentInstructionNames = new Set(['agents.md', 'claude.md', 'gemini.md', '.cursorrules', '.windsurfrules', 'copilot-instructions.md'])
const agentInstructionDirectories = ['.agents/', '.claude/', '.cursor/rules/', '.github/agents/', '.github/instructions/']

function excludedReason(file: string) {
  const lower = file.toLowerCase()
  const segments = lower.split('/')
  if (agentInstructionNames.has(segments.at(-1)!)
    || agentInstructionDirectories.some(directory => lower.startsWith(directory) || lower.includes(`/${directory}`))) return 'agent-instructions'
  if (segments.some(segment => generatedSegments.has(segment))) return 'generated-or-vendored'
  if (excludedNames.has(path.posix.basename(lower)) || lower.endsWith('.lock')) return 'lockfile'
  if (lower.endsWith('.min.js') || lower.endsWith('.min.css') || lower.endsWith('.snap')) return 'generated-or-vendored'
  if (binaryExtensions.has(path.posix.extname(lower))) return 'binary'
  return null
}

function sniffedReason(content: Buffer) {
  const head = content.subarray(0, SNIFF_BYTES)
  if (head.includes(0)) return 'binary'
  const text = head.toString('utf8')
  if (text.startsWith('version https://git-lfs.github.com/spec/v1')) return 'git-lfs-pointer'
  if (/@generated|code generated .* do not edit|auto-generated file/i.test(text)) return 'generated-header'
  return null
}

/** Parses `git ls-tree -r -l -z` output. Submodules report `-` for their size. */
export function parseTree(raw: string): TreeEntry[] {
  return raw.split('\0').filter(Boolean).map(entry => {
    const match = /^(\d+) \w+ ([a-f0-9]+) +(-|\d+)\t(.+)$/s.exec(entry)
    if (!match) throw new Error('Git returned an unsupported file inventory')
    return { mode: match[1], digest: match[2], bytes: match[3] === '-' ? 0 : Number(match[3]), path: match[4] }
  })
}

function priority(file: InventoryFile) {
  const name = path.posix.basename(file.path).toLowerCase()
  if (identityNames.has(name) || manifestNames.has(name) || name.endsWith('.csproj')) return 0
  if (Object.values(laneTerms).some(pattern => pattern.test(file.path))) return 1
  return 2
}

/**
 * Selects the snapshot: path, mode and size filters first, then the priority order and budget, reading
 * content only for files that could still fit. Returns the accepted files with their committed bytes.
 */
export async function inventory(entries: TreeEntry[], budgets: InventoryBudgets, read: BlobReader) {
  const excluded: Record<string, number> = {}
  const exclude = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1 }
  const candidates: InventoryFile[] = []
  for (const entry of entries) {
    const reason = entry.mode === '160000' ? 'submodule' : entry.mode === '120000' ? 'symlink' : excludedReason(entry.path)
    if (reason) { exclude(reason); continue }
    if (entry.mode !== '100644' && entry.mode !== '100755') { exclude('unsupported-mode'); continue }
    if (entry.bytes > FILE_SIZE_LIMIT) { exclude('oversized'); continue }
    candidates.push({ path: entry.path, digest: entry.digest, bytes: entry.bytes })
  }
  candidates.sort((a, b) => priority(a) - priority(b) || a.path.localeCompare(b.path))

  const files: InventoryFile[] = []
  const contents = new Map<string, Buffer>()
  let bytes = 0
  let pending: InventoryFile[] = []
  const pendingBytes = () => pending.reduce((total, file) => total + file.bytes, 0)
  const fits = (file: InventoryFile) =>
    files.length + pending.length < budgets.maxFiles && bytes + pendingBytes() + file.bytes <= budgets.maxBytes
  const flush = async () => {
    if (!pending.length) return
    const blobs = await read([...new Set(pending.map(file => file.digest))])
    for (const file of pending) {
      const content = blobs.get(file.digest)
      if (!content) throw new Error(`${file.path}: Git object is missing from the acquired repository`)
      const reason = sniffedReason(content)
      if (reason) { exclude(reason); continue }
      files.push(file); contents.set(file.path, content); bytes += file.bytes
    }
    pending = []
  }
  // A file is judged against the budget only once every earlier file has been sniffed, so the result
  // matches reading everything first while never reading files that cannot fit.
  for (const file of candidates) {
    if (!fits(file)) await flush()
    if (!fits(file)) { exclude('budget'); continue }
    pending.push(file)
    if (pending.length >= READ_BATCH_FILES || pendingBytes() >= READ_BATCH_BYTES) await flush()
  }
  await flush()

  const dependencies = entries.filter(entry => /^100(?:644|755)$/.test(entry.mode) && broaderChange(entry.path))
  return {
    files,
    contents,
    excluded,
    dependencyFingerprints: dependencies.slice(0, MAX_DEPENDENCY_FINGERPRINTS).map(entry => ({ path: entry.path, digest: entry.digest })),
    omittedDependencyFingerprints: Math.max(0, dependencies.length - MAX_DEPENDENCY_FINGERPRINTS),
  }
}
