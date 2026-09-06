import { useMemo, useState } from 'react'
import { createRepository } from './content'
import { attachSnapshot } from './runtime'
import { featureTouchesComponent } from './component-structure'
import type { Component, Feature, Product, Workspace } from './model'
import type { FeatureStage } from '@/lib/taxonomy'

const empty = { project: { schemaVersion: 1 as const }, members: [], workspaces: [], products: [], components: [], features: [] }
let repository = createRepository(empty)
let db = repository.db
export let q = repository.q
attachSnapshot(snapshot => { repository = createRepository(snapshot); db = repository.db; q = repository.q })

export const ACTIVE_STAGES: FeatureStage[] = ['exploring', 'designing', 'specced', 'building']
export const isActive = (f: Feature) => ACTIVE_STAGES.includes(f.stage)

export const STALE_DAYS = 14
export const isCold = (f: Feature) => isActive(f) && Date.now() - Date.parse(f.updatedAt) > STALE_DAYS * 864e5

export const byUpdated = (a: { updatedAt: string }, b: { updatedAt: string }) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)


export interface WorkspaceSummary {
  workspace: Workspace
  products: Product[]
  componentCount: number
  active: Feature[]
  shipped: Feature[]
  lastActivity?: string
}
export function summarizeWorkspace(w: Workspace): WorkspaceSummary {
  const products = q.products(w.id)
  const feats = q.featuresInWorkspace(w.id)
  return {
    workspace: w,
    products,
    componentCount: products.reduce((n, p) => n + q.components(p.id).length, 0),
    active: feats.filter(isActive),
    shipped: feats.filter(f => f.stage === 'shipped'),
    lastActivity: feats[0]?.updatedAt,
  }
}

export function useHome() {
  const [now] = useState(Date.now)
  return useMemo(() => {
    const summaries = db.workspaces.map(summarizeWorkspace)
    const inFlight = db.features.filter(isActive).sort(byUpdated)
    const since = now - 30 * 864e5
    const ideas = db.features.filter(f => f.stage === 'idea').sort(byUpdated)
    const resume = db.features.filter(f => f.stage !== 'shipped').sort(byUpdated)[0]
    const byStage = ACTIVE_STAGES.slice().reverse().map(stage => ({ stage, features: inFlight.filter(f => f.stage === stage) })).filter(g => g.features.length)
    return {
      summaries,
      inFlight,
      byStage,
      ideas,
      resume,
      cold: inFlight.filter(isCold).length,
      totals: {
        workspaces: db.workspaces.length,
        products: db.products.length,
        components: db.components.length,
        inFlight: inFlight.length,
        shipped30d: db.features.filter(f => f.stage === 'shipped' && Date.parse(f.updatedAt) > since).length,
        ideas: db.features.filter(f => f.stage === 'idea').length,
      },
    }
  }, [now])
}

export interface ComponentLoad { component: Component; product: Product; features: Feature[]; crossProduct: boolean }

/** Everything the workspace page needs: products with their components and features, plus component load across the workspace. */
export function useWorkspace(slug: string) {
  return useMemo(() => {
    const workspace = q.workspace(slug)
    if (!workspace) return undefined
    const products = q.products(workspace.id).map(product => {
      const components = q.components(product.id)
      const features = q.features(product.id)
      return {
        product,
        components,
        active: features.filter(isActive),
        ideas: features.filter(f => f.stage === 'idea'),
        shipped: features.filter(f => f.stage === 'shipped'),
      }
    })
    const active = q.featuresInWorkspace(workspace.id).filter(isActive)
    const load: ComponentLoad[] = products.flatMap(({ product, components }) =>
      components.filter(component => !component.parentId).map(component => {
        const features = active.filter(f => featureTouchesComponent(f, component.id, db.components))
        return { component, product, features, crossProduct: features.some(f => f.productId !== product.id) }
      }),
    ).filter(l => l.features.length > 0).sort((a, b) => b.features.length - a.features.length)
    const reaching = active.filter(f => f.touches.some(id => q.component(id)?.productId !== f.productId))
    const all = q.featuresInWorkspace(workspace.id)
    const ideas = all.filter(f => f.stage === 'idea')
    const shipped = all.filter(f => f.stage === 'shipped')
    const byStage = ACTIVE_STAGES.slice().reverse().map(stage => ({ stage, features: active.filter(f => f.stage === stage) })).filter(g => g.features.length)
    return { workspace, products, active, byStage, ideas, shipped, load, reaching, cold: active.filter(isCold).length, componentCount: products.reduce((n, p) => n + p.components.length, 0) }
  }, [slug])
}

/** Product page: its features by stage, its components with load, and features from other products that touch it. */
export function useProduct(workspaceSlug: string, productSlug: string) {
  return useMemo(() => {
    const workspace = q.workspace(workspaceSlug)
    const product = workspace && q.products(workspace.id).find(p => p.slug === productSlug)
    if (!workspace || !product) return undefined
    const all = q.features(product.id)
    const active = all.filter(isActive)
    const components = q.components(product.id).map(component => ({
      component,
      touchedBy: db.features.filter(f => isActive(f) && featureTouchesComponent(f, component.id, db.components)),
    }))
    const cids = new Set(components.map(c => c.component.id))
    const incoming = db.features.filter(f => isActive(f) && f.productId !== product.id && f.touches.some(id => cids.has(id))).sort(byUpdated)
    const byStage = ACTIVE_STAGES.slice().reverse().map(stage => ({ stage, features: active.filter(f => f.stage === stage) })).filter(g => g.features.length)
    return {
      workspace, product, active, byStage, components, incoming,
      ideas: all.filter(f => f.stage === 'idea'),
      shipped: all.filter(f => f.stage === 'shipped'),
      cold: active.filter(isCold).length,
    }
  }, [workspaceSlug, productSlug])
}

export function relTime(iso: string) {
  const ms = Date.now() - Date.parse(iso)
  const m = Math.round(ms / 6e4), h = Math.round(ms / 36e5), dd = Math.round(ms / 864e5)
  if (m < 60) return `${Math.max(m, 1)}m ago`
  if (h < 24) return `${h}h ago`
  if (dd < 30) return `${dd}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
