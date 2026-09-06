import { Aperture, Blocks, Command, Layers } from 'lucide-react'
import type { Workspace } from '@/data/model'
import { hueStyle } from '@/lib/taxonomy'

const icons = { ecom: Blocks, groundwork: Command, 'image-lab': Aperture }

/** One workspace identity, reused from its directory card to its page header. */
export function WorkspaceEmblem({ workspace, size = 'default' }: { workspace: Workspace; size?: 'default' | 'large' }) {
  const Icon = icons[workspace.slug as keyof typeof icons] ?? Layers
  return <span className={`workspace-emblem workspace-emblem-${size}`} style={hueStyle(workspace.hue)} aria-hidden="true"><Icon strokeWidth={1.5} /></span>
}
