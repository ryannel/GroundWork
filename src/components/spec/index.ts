import type { ComponentType } from 'react'
import { Target, Footprints, PenTool, Workflow, Braces, Database, FlaskConical } from 'lucide-react'
import type { FeatureSpec, SectionKind } from '@/data/spec'
import { PurposeSection } from './purpose'
import { JourneySection } from './journey'
import { DesignSection } from './design'
import { FlowSection } from './flow'
import { ApiSection } from './api'
import { StorageSection } from './storage'
import { TestsSection } from './tests'

export interface SectionMeta { label: string; blurb: string; icon: ComponentType<{ className?: string }> }
export const sectionMeta: Record<SectionKind, SectionMeta> = {
  purpose: { label: 'Brief & scope', blurb: 'The problem, the outcome, and what this is not.', icon: Target },
  journey: { label: 'User journey', blurb: 'How someone moves through the product to get the outcome.', icon: Footprints },
  design: { label: 'Screens & prototype', blurb: 'Mockups: live, wireframe, Figma or images.', icon: PenTool },
  flow: { label: 'System flow', blurb: 'How data moves through components, decisions, workers and stores.', icon: Workflow },
  api: { label: 'API contracts', blurb: 'Contracts where data crosses a component boundary.', icon: Braces },
  storage: { label: 'Data model', blurb: 'What the data looks like at rest.', icon: Database },
  tests: { label: 'Tests & coverage', blurb: 'The system-level cases that prove the feature is delivered.', icon: FlaskConical },
}

export const sectionRenderers: { [K in SectionKind]: ComponentType<{ data: NonNullable<FeatureSpec[K]>; focus?: string }> } = {
  purpose: PurposeSection,
  journey: JourneySection,
  design: DesignSection,
  flow: FlowSection,
  api: ApiSection,
  storage: StorageSection,
  tests: TestsSection,
}

/** Item count per section, for the tab bar. */
export function sectionCount(spec: FeatureSpec, k: SectionKind): number | undefined {
  switch (k) {
    case 'journey': return spec.journey?.steps.length
    case 'design': return spec.design?.mockups.length
    case 'flow': return spec.flow?.nodes.length
    case 'api': return spec.api?.contracts.length
    case 'storage': return spec.storage?.tables.length
    case 'tests': return spec.tests?.cases.length
    default: return undefined
  }
}
export { SpecContext } from './context'
