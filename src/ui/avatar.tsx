/** Up to two initials, one per word: "Ada Lovelace" → "AL". */
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()

/** Owner initials. Decorative by default because the name is always shown beside it. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return <span className={className} aria-hidden="true">{initials(name)}</span>
}
