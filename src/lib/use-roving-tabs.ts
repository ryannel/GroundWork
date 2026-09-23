import { useRef, type KeyboardEvent } from 'react'

const keys = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])

/** The tab that a roving-tabindex key moves to, or undefined for keys the tablist does not handle. */
export function rovingTarget<T>(ids: readonly T[], active: T, key: string): T | undefined {
  if (!keys.has(key) || !ids.length) return undefined
  const index = Math.max(0, ids.indexOf(active))
  if (key === 'Home') return ids[0]
  if (key === 'End') return ids[ids.length - 1]
  return ids[(index + (key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length]
}

/**
 * Automatic-activation tablist: arrows, Home and End select and focus a tab; only the active tab is tabbable.
 * Spread `tabProps(id)` on each tab and put `onKeyDown` on the element with `role="tablist"`.
 */
export function useRovingTabs<T extends string>(ids: readonly T[], active: T, onSelect: (id: T) => void) {
  const tabs = useRef(new Map<T, HTMLElement>())
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const next = rovingTarget(ids, active, event.key)
    if (next === undefined) return
    event.preventDefault()
    onSelect(next)
    tabs.current.get(next)?.focus()
  }
  const tabProps = (id: T) => ({
    role: 'tab' as const,
    tabIndex: id === active ? 0 : -1,
    'aria-selected': id === active,
    onClick: () => onSelect(id),
    ref: (element: HTMLElement | null) => {
      if (element) tabs.current.set(id, element)
      else tabs.current.delete(id)
    },
  })
  return { onKeyDown, tabProps }
}
