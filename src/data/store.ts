import { createContext, createElement, useContext, useMemo, useState, type ReactNode } from 'react'
import { createRepository, type ContentSnapshot, type Repository, type RepositoryQueries } from './content.ts'
import { useRuntime } from './runtime.ts'
import type { Component, Feature, Product, Workspace } from './model.ts'
import type { FeatureStage } from '@/lib/taxonomy'

const empty: ContentSnapshot = { project: { schemaVersion: 1 }, members: [], workspaces: [], products: [], components: [], features: [] }
const repositories = new WeakMap<ContentSnapshot, Repository>()
/** One repository per snapshot, shared by every hook. */
export function repositoryFor(snapshot: ContentSnapshot | null | undefined): Repository {
  const key = snapshot ?? empty
  let repository = repositories.get(key)
  if (!repository) repositories.set(key, repository = createRepository(key))
  return repository
}

const RepositoryContext = createContext<Repository | null>(null)
/** Provides the repository for the current runtime snapshot (or an explicit one, e.g. in tests). */
export function RepositoryProvider({ snapshot, children }: { snapshot?: ContentSnapshot | null; children?: ReactNode }) {
  const runtimeSnapshot = useRuntime().plan?.snapshot
  const repository = repositoryFor(snapshot === undefined ? runtimeSnapshot : snapshot)
  return createElement(RepositoryContext.Provider, { value: repository }, children)
}
/** The repository for the rendered snapshot; outside a provider it follows the runtime snapshot directly. */
export function useRepository(): Repository {
  const provided = useContext(RepositoryContext)
  const runtimeSnapshot = useRuntime().plan?.snapshot
  return provided ?? repositoryFor(runtimeSnapshot)
}
export const useQuery = (): RepositoryQueries => useRepository().q

export const ACTIVE_STAGES: FeatureStage[] = ['exploring', 'designing', 'specced', 'building']
export const isActive = (f: Feature) => ACTIVE_STAGES.includes(f.stage)

export const STALE_DAYS = 14
const coldAt = (f: Feature, now: number) => isActive(f) && now - Date.parse(f.updatedAt) > STALE_DAYS * 864e5
export const isCold = (f: Feature) => coldAt(f, Date.now())

export const byUpdated = (a: { updatedAt: string }, b: { updatedAt: string }) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
const byStage = (features: Feature[]) => ACTIVE_STAGES.slice().reverse()
  .map(stage => ({ stage, features: features.filter(f => f.stage === stage) }))
  .filter(g => g.features.length)

export interface WorkspaceSummary {
  workspace: Workspace
  products: Product[]
  componentCount: number
  active: Feature[]
  shipped: Feature[]
  lastActivity?: string
}
export function summarizeWorkspace(w: Workspace, query: RepositoryQueries): WorkspaceSummary {
  const products = query.products(w.id)
  const feats = query.featuresInWorkspace(w.id)
  return {
    workspace: w,
    products,
    componentCount: products.reduce((n, p) => n + query.components(p.id).length, 0),
    active: feats.filter(isActive),
    shipped: feats.filter(f => f.stage === 'shipped'),
    lastActivity: feats[0]?.updatedAt,
  }
}

/** Home page view model; pure so it can be tested without React. */
export function homeView({ db, q: query }: Repository, now: number) {
  const summaries = db.workspaces.map(workspace => summarizeWorkspace(workspace, query))
  const inFlight = db.features.filter(isActive).sort(byUpdated)
  const since = now - 30 * 864e5
  const ideas = db.features.filter(f => f.stage === 'idea').sort(byUpdated)
  const resume = db.features.filter(f => f.stage !== 'shipped').sort(byUpdated)[0]
  return {
    summaries,
    inFlight,
    byStage: byStage(inFlight),
    ideas,
    resume,
    cold: inFlight.filter(f => coldAt(f, now)).length,
    totals: {
      workspaces: db.workspaces.length,
      products: db.products.length,
      components: db.components.length,
      inFlight: inFlight.length,
      shipped30d: db.features.filter(f => f.stage === 'shipped' && Date.parse(f.updatedAt) > since).length,
      ideas: ideas.length,
    },
  }
}

export interface ComponentLoad { component: Component; product: Product; features: Feature[]; crossProduct: boolean }

/** Workspace page: products with their components and features, plus component load across the workspace. */
export function workspaceView({ q: query }: Repository, slug: string, now = Date.now()) {
  const workspace = query.workspace(slug)
  if (!workspace) return undefined
  const products = query.products(workspace.id).map(product => {
    const components = query.components(product.id)
    const features = query.features(product.id)
    return {
      product,
      components,
      active: features.filter(isActive),
      ideas: features.filter(f => f.stage === 'idea'),
      shipped: features.filter(f => f.stage === 'shipped'),
    }
  })
  const all = query.featuresInWorkspace(workspace.id)
  const active = all.filter(isActive)
  const load: ComponentLoad[] = products.flatMap(({ product, components }) =>
    components.filter(component => !component.parentId).map(component => {
      const features = active.filter(f => query.touches(f, component.id))
      return { component, product, features, crossProduct: features.some(f => f.productId !== product.id) }
    }),
  ).filter(l => l.features.length > 0).sort((a, b) => b.features.length - a.features.length)
  const reaching = active.filter(f => {
    const own = new Set(query.components(f.productId).map(component => component.id))
    return f.touches.some(id => !own.has(id))
  })
  return {
    workspace, products, active, byStage: byStage(active), load, reaching,
    ideas: all.filter(f => f.stage === 'idea'),
    shipped: all.filter(f => f.stage === 'shipped'),
    cold: active.filter(f => coldAt(f, now)).length,
    componentCount: products.reduce((n, p) => n + p.components.length, 0),
  }
}

/** Product page: its features by stage, its components with load, and features from other products that touch it. */
export function productView({ db, q: query }: Repository, workspaceSlug: string, productSlug: string, now = Date.now()) {
  const workspace = query.workspace(workspaceSlug)
  const product = workspace && query.products(workspace.id).find(p => p.slug === productSlug)
  if (!workspace || !product) return undefined
  const all = query.features(product.id)
  const active = all.filter(isActive)
  const activeAnywhere = db.features.filter(isActive)
  const components = query.components(product.id).map(component => ({
    component,
    touchedBy: activeAnywhere.filter(f => query.touches(f, component.id)),
  }))
  const cids = new Set(components.map(c => c.component.id))
  const incoming = activeAnywhere.filter(f => f.productId !== product.id && f.touches.some(id => cids.has(id))).sort(byUpdated)
  return {
    workspace, product, active, byStage: byStage(active), components, incoming,
    ideas: all.filter(f => f.stage === 'idea'),
    shipped: all.filter(f => f.stage === 'shipped'),
    cold: active.filter(f => coldAt(f, now)).length,
  }
}

export function useHome() {
  const [now] = useState(Date.now)
  const repository = useRepository()
  return useMemo(() => homeView(repository, now), [repository, now])
}
export function useWorkspace(slug: string) {
  const repository = useRepository()
  return useMemo(() => workspaceView(repository, slug), [repository, slug])
}
export function useProduct(workspaceSlug: string, productSlug: string) {
  const repository = useRepository()
  return useMemo(() => productView(repository, workspaceSlug, productSlug), [repository, workspaceSlug, productSlug])
}

export function relTime(iso: string) {
  const ms = Date.now() - Date.parse(iso)
  const m = Math.round(ms / 6e4), h = Math.round(ms / 36e5), dd = Math.round(ms / 864e5)
  if (m < 60) return `${Math.max(m, 1)}m ago`
  if (h < 24) return `${h}h ago`
  if (dd < 30) return `${dd}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
