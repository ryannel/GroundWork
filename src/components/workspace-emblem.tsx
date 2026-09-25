import { Layers } from 'lucide-react'
import type { Product, Workspace } from '@shared/model'
import { hueStyle, kinds } from '@/lib/taxonomy'

/** One workspace identity: its hue, with the icon of its first product's kind. */
export function WorkspaceEmblem({ workspace, products }: { workspace: Workspace; products: Product[] }) {
  const Icon = products[0] ? kinds[products[0].kind].icon : Layers
  return <span className="workspace-emblem" style={hueStyle(workspace.hue)} aria-hidden="true"><Icon strokeWidth={1.5} /></span>
}
