import { createElement } from 'react'
import { Boxes, Cloud, Database, HardDrive, Layers, Network, type LucideIcon, type LucideProps } from 'lucide-react'
import type { ComponentKind } from '@shared/component-structure'

/** One icon per component kind, shared by every screen that shows a component. */
const icons = {
  service: Boxes,
  module: Layers,
  database: Database,
  cache: Database,
  'object-storage': HardDrive,
  'local-storage': HardDrive,
  queue: Network,
  'external-service': Cloud,
} satisfies Record<ComponentKind, LucideIcon>

export function ComponentKindIcon({ kind, ...props }: LucideProps & { kind: ComponentKind }) {
  return createElement(icons[kind], props)
}
