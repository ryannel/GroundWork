import type { Component } from './model'

export type ScanStatus = NonNullable<Component['scan']>['status'] | 'unknown'
export type CoverageArea = 'dependencies' | 'api' | 'data' | 'messaging'
export type CoverageState = 'not-scanned' | 'partial' | 'complete'

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

export const scanStatusLabel = (status: ScanStatus) => ({
  unknown: 'Coverage unknown',
  'not-scanned': 'Not scanned',
  scanning: 'Scan in progress',
  partial: 'Partially scanned',
  complete: 'Scan complete',
  failed: 'Scan failed',
})[status]

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
