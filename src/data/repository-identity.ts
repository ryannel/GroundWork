/**
 * One canonical form for a repository identity, shared by the scanner, freshness checks and the viewer.
 * GitHub repositories (any URL form or `owner/name`) become lower-case `owner/name`.
 * Other Git URLs keep their host and path but lose credentials and a trailing `.git`.
 * Local paths are returned unchanged; callers resolve them with realpath where that matters.
 */
const github = /^(?:https?:\/\/(?:[^@/]+@)?github\.com\/|ssh:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i
const shorthand = /^([A-Za-z0-9][\w.-]*)\/([\w.-]+?)(?:\.git)?$/

export function repositoryIdentity(value: string): string {
  const trimmed = value.trim()
  const hosted = github.exec(trimmed)
  if (hosted) return `${hosted[1]}/${hosted[2]}`.toLowerCase()
  const short = shorthand.exec(trimmed)
  if (short && !trimmed.includes('://') && !trimmed.startsWith('/') && !trimmed.startsWith('.')) return `${short[1]}/${short[2]}`.toLowerCase()
  return stripCredentials(trimmed).replace(/\.git$/, '').replace(/\/$/, '')
}

/** Removes any user or password from a URL-shaped value; scp-style `user@host:path` values keep their user because it is a login, not a secret. */
export function stripCredentials(value: string): string {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    return url.toString()
  } catch {
    return value.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^@/]+@/i, '$1')
  }
}

export function hasCredentials(value: string): boolean {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return false
  try { const url = new URL(value); return url.username !== '' || url.password !== '' } catch { return /^[a-z][a-z0-9+.-]*:\/\/[^@/]+@/i.test(value) }
}

export function githubRepository(value: string): string | undefined {
  const identity = repositoryIdentity(value)
  return /^[\w.-]+\/[\w.-]+$/.test(identity) && !identity.includes('://') ? identity : undefined
}
