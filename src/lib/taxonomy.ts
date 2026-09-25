import type { z } from 'zod'
import type { productKindSchema, featureStageSchema } from '@shared/content-schema'
import { Boxes, MonitorSmartphone, Terminal, Sparkles, Library, type LucideIcon } from 'lucide-react'

/** Product kinds. Adding a kind = add an entry here + a --kind-* hue in tokens.css. */
export type ProductKind = z.infer<typeof productKindSchema>
export const kinds: Record<ProductKind, { label: string; hueVar: string; icon: LucideIcon; blurb: string }> = {
  'service-system': { label: 'Service system', hueVar: 'var(--kind-service-system)', icon: Boxes, blurb: 'A set of services and repos that ship together.' },
  'desktop-app':    { label: 'Desktop app',    hueVar: 'var(--kind-desktop-app)',    icon: MonitorSmartphone,
    blurb: 'A native or Electron app installed on a machine.' },
  'cli':            { label: 'CLI',            hueVar: 'var(--kind-cli)',            icon: Terminal, blurb: 'A command-line tool.' },
  'playground':     { label: 'Playground',     hueVar: 'var(--kind-playground)',     icon: Sparkles,
    blurb: 'An exploratory space for images, video, and experiments.' },
  'library':        { label: 'Library',        hueVar: 'var(--kind-library)',        icon: Library, blurb: 'Shared code consumed by other products.' },
}
export const kindList = Object.keys(kinds) as ProductKind[]

/** Feature stages, in lifecycle order. */
export type FeatureStage = z.infer<typeof featureStageSchema>
export const stages: Record<FeatureStage, { label: string; hueVar: string }> = {
  idea:      { label: 'Idea',      hueVar: 'var(--stage-idea)' },
  exploring: { label: 'Exploring', hueVar: 'var(--stage-exploring)' },
  designing: { label: 'Designing', hueVar: 'var(--stage-designing)' },
  specced:   { label: 'Specced',   hueVar: 'var(--stage-specced)' },
  building:  { label: 'Building',  hueVar: 'var(--stage-building)' },
  shipped:   { label: 'Shipped',   hueVar: 'var(--stage-shipped)' },
}
export const stageList = Object.keys(stages) as FeatureStage[]
export const stageIndex = (s: FeatureStage) => stageList.indexOf(s)

/** Inline style helper: sets --hue so hue-* utilities work. */
export const hueStyle = (hueVar: string) => ({ ['--hue' as string]: hueVar })
