import type { z } from 'zod'
import type { componentScanAreaSchema } from './content-schema.ts'
import type { Component } from './model.ts'

export type ScanStatus = NonNullable<Component['scan']>['status'] | 'unknown'
export type CoverageArea = keyof NonNullable<NonNullable<Component['scan']>['coverage']>
export type CoverageState = z.infer<typeof componentScanAreaSchema>

const areaHasEvidence = (component: Component, area: CoverageArea) => {
  if (area === 'dependencies') return component.dependsOn !== undefined
  return component[area] !== undefined
}

export function componentCoverage(component: Component) {
  const status: ScanStatus = component.scan?.status
    ?? (component.api || component.data || component.messaging || component.dependsOn !== undefined ? 'partial' : component.repo ? 'not-scanned' : 'unknown')
  const area = (name: CoverageArea): CoverageState => {
    const explicit = component.scan?.coverage?.[name]
    if (explicit) return explicit
    if (status === 'complete') return 'complete'
    return areaHasEvidence(component, name) ? 'partial' : 'not-scanned'
  }
  return { status, area }
}

const scanStatusLabels = {
  unknown: 'Coverage unknown',
  'not-scanned': 'Not scanned',
  scanning: 'Scan in progress',
  partial: 'Partially scanned',
  complete: 'Catalog discovery complete',
  failed: 'Scan failed',
} satisfies Record<ScanStatus, string>
export const scanStatusLabel = (status: ScanStatus) => scanStatusLabels[status]

export function productCoverage(components: Component[]) {
  const statuses = components.map(component => componentCoverage(component).status)
  const complete = statuses.filter(status => status === 'complete').length
  const scanning = statuses.filter(status => status === 'scanning').length
  const failed = statuses.filter(status => status === 'failed').length
  const incomplete = statuses.length - complete
  return {
    total: statuses.length,
    complete,
    incomplete,
    status: !statuses.length ? 'unknown' as const
      : complete === statuses.length ? 'complete' as const
        : scanning ? 'scanning' as const
          : failed ? 'failed' as const
            : statuses.some(status => status === 'partial') ? 'partial' as const
              : statuses.some(status => status === 'not-scanned') ? 'not-scanned' as const
                : 'unknown' as const,
  }
}

/** Scan coverage is independent of optional traces and subsequent source verification. */
export function catalogKnowledgeState(component: Component) {
  const coverage = componentCoverage(component)
  const endpoints = component.api?.endpoints ?? []
  const traced = new Set((component.executionFlows ?? []).map(flow => flow.endpointId))
  return {
    coverage: Object.fromEntries((['dependencies', 'api', 'data', 'messaging'] as const).map(area => [area, coverage.area(area)])),
    investigation: { knownEndpoints: endpoints.length, tracedEndpoints: endpoints.filter(endpoint => traced.has(endpoint.id)).length, scope: 'Recorded paths only; alternative paths may be unexplored.' },
    freshness: { status: 'unchecked' as const, observedRevision: component.sourceRevision ?? component.scan?.revision ?? null, reason: 'No source comparison or behavioral verification has been performed by this query.' },
  }
}
