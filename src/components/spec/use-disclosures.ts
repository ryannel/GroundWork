import { useState } from 'react'

/** Follow a new deep link while preserving other disclosure choices. */
export function useDisclosures(initial: string[], focus?: string) {
  const [state, setState] = useState(() => ({ focus, open: new Set(initial) }))
  if (state.focus !== focus) {
    const open = new Set(state.open)
    if (focus) open.add(focus)
    setState({ focus, open })
  }
  const toggle = (id: string) => setState(previous => {
    const open = new Set(previous.open)
    if (open.has(id)) open.delete(id)
    else open.add(id)
    return { ...previous, open }
  })
  const replace = (open: Set<string>) => setState(previous => ({ ...previous, open }))
  return { open: state.open, toggle, replace }
}
