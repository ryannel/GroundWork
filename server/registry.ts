import { homedir } from 'node:os'
import { mkdir, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { atomicFile, readPlan, safePath, withLock } from './repository.ts'
import { context, discover } from './git.ts'
const registrySchema = z.strictObject({ version: z.literal(1), projects: z.array(z.strictObject({ root: z.string(), workspace: z.string().min(1), projectId: z.string() })) })
export const configRoot = () => path.resolve(process.env.GROUNDWORK_HOME ?? path.join(homedir(), '.config', 'groundwork-v2'))
export async function registry() {
  await mkdir(configRoot(), { recursive: true })
  const raw = await readFile(await safePath(configRoot(), 'registry.json'), 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error })
  return raw ? registrySchema.parse(JSON.parse(raw)) : { version: 1 as const, projects: [] as z.infer<typeof registrySchema>['projects'] }
}
export async function register(root: string, workspace = 'My projects') {
  root = await realpath(root)
  const plan = await readPlan(root)
  await mkdir(configRoot(), { recursive: true })
  return withLock(configRoot(), async () => {
    const config = await registry()
    const record = { root, workspace, projectId: plan.manifest.id }
    config.projects = [...config.projects.filter(p => p.root !== root), record]
    registrySchema.parse(config)
    await atomicFile(configRoot(), 'registry.json', JSON.stringify(config, null, 2) + '\n')
    return record
  }, 'registry.lock')
}
export async function unregister(root: string) {
  root = path.resolve(root)
  await mkdir(configRoot(), { recursive: true })
  return withLock(configRoot(), async () => {
    const config = await registry()
    config.projects = config.projects.filter(p => p.root !== root)
    await atomicFile(configRoot(), 'registry.json', JSON.stringify(config, null, 2) + '\n')
    return config
  }, 'registry.lock')
}
export async function inventory(standalone?: string) {
  const roots = standalone ? [{ root: standalone, workspace: 'This repository', projectId: '' }] : (await registry()).projects
  const entries = []
  const seen = new Set<string>()
  for (const record of roots) {
    try {
      for (const ctx of await discover(record.root)) {
        if (seen.has(ctx.checkoutId)) continue
        seen.add(ctx.checkoutId)
        try {
          const plan = await readPlan(ctx.root)
          entries.push({ ...ctx, workspace: record.workspace, projectId: plan.manifest.id, name: plan.manifest.name, features: plan.snapshot.features.map(f => ({ id: f.id, title: f.title, stage: f.stage })), error: null as string | null })
        } catch (error) { entries.push({ ...ctx, workspace: record.workspace, projectId: record.projectId, name: path.basename(ctx.root), features: [], error: (error as Error).message }) }
      }
    } catch (error) {
      entries.push({ root: record.root, checkoutId: '', branch: null, head: null, isGit: false, token: '', workspace: record.workspace, projectId: record.projectId, name: path.basename(record.root), features: [], error: (error as Error).message })
    }
  }
  return entries
}
export async function selectRoot(checkoutId: string | undefined, standalone?: string) {
  if (!checkoutId && standalone) return (await context(standalone)).root
  const entry = (await inventory(standalone)).find(entry => entry.checkoutId === checkoutId && entry.checkoutId)
  if (!entry) throw new Error('Unknown checkout. List projects and select a registered checkout ID.')
  return entry.root
}
