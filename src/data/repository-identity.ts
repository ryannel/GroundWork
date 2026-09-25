/**
 * One canonical form for a repository identity, shared by the scanner, freshness checks and the viewer.
 * Every URL form of one repository normalises to the same value on every host: SCP (`git@host:path`), ssh://,
 * https://, a bare `host/path` and `owner/name` shorthand all parse into a host and a path, then lose their
 * credentials, default port, query, fragment, trailing `.git` and trailing `/`, and lower-case the host.
 * GitHub repositories, under any of GitHub's hostnames and on any port GitHub serves them from, become lower-case
 * `owner/name`; every other host, and GitHub on a port it does not serve, keeps its host prefix and its path case,
 * so `ghe.example.com/acme/api` never collides with `acme/api`.
 * Local paths are returned unchanged; callers resolve them with realpath where that matters.
 */
const GITHUB_HOST = 'github.com'
/** GitHub's alternate SSH endpoint, for networks that block port 22; it answers on 443 as well as on 22. */
const GITHUB_SSH_HOST = `ssh.${GITHUB_HOST}`
/** Hostnames that serve the one GitHub.com repository namespace. */
const githubHosts = new Set([GITHUB_HOST, `www.${GITHUB_HOST}`, GITHUB_SSH_HOST])
/** Ports a scheme uses by default, and so never part of an identity. */
const defaultPorts: Record<string, string> = { ssh: '22', git: '9418', 'git+ssh': '22', https: '443', http: '80' }
const hostname = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i
const dottedHost = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i
const scpForm = /^(?:([^@/\\]+)@)?([^@/\\:]+):(.+)$/
const schemeForm = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/i
const shorthandForm = /^([A-Za-z0-9][\w.-]*)\/([\w.-]+)$/
/** A value Groundwork must not read as a remote URL: an absolute, relative or home-relative filesystem path. */
const localPath = /^(?:[/~.]|[A-Za-z]:[\\/])/
/** Marks an identity that only holds on this machine, because the clone has no `origin` to derive one from. */
export const PROVISIONAL_PREFIX = 'local:'
export const isProvisional = (identity: string) => identity.startsWith(PROVISIONAL_PREFIX)

export interface RemoteRef { host: string; path: string }

/** A URL query or fragment names a view of a repository, never a different repository, so neither is part of a path. */
const trimPath = (value: string) =>
  value.replace(/[?#].*$/, '').replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.git$/i, '').replace(/\/+$/, '')

/** Lower-cases a host, drops a port the scheme uses by default, and folds every GitHub hostname onto `github.com`. */
function normaliseHost(raw: string, protocol?: string): string | null {
  let host = raw, port = ''
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']')
    if (end < 0) return null
    host = raw.slice(0, end + 1)
    const tail = raw.slice(end + 1)
    if (tail && !/^:\d+$/.test(tail)) return null
    port = tail.slice(1)
    if (!/^\[[0-9a-f:.]+\]$/i.test(host)) return null
  } else {
    const colon = raw.lastIndexOf(':')
    if (colon > 0) {
      const value = raw.slice(colon + 1)
      if (!/^\d+$/.test(value)) return null
      host = raw.slice(0, colon)
      port = value
    }
    if (!hostname.test(host)) return null
  }
  host = host.toLowerCase()
  if (port && protocol !== undefined && port === defaultPorts[protocol]) port = ''
  // Every GitHub hostname addresses the one GitHub.com namespace, but only on the ports GitHub serves it from: the
  // scheme's default, which is already gone by here, and `ssh.github.com:443`, its documented alternate SSH endpoint.
  // Any other port is a different endpoint, such as a proxy or a tunnel, and keeps its own identity, because folding
  // it onto github.com would give two repositories that need not be the same one a single identity.
  if (githubHosts.has(host) && (!port || (host === GITHUB_SSH_HOST && port === '443'))) return GITHUB_HOST
  return port ? `${host}:${port}` : host
}

/** Splits a remote into a lower-case host and a path, or null for a local path or an unrecognised value. */
export function parseRemote(value: string): RemoteRef | null {
  const trimmed = value.trim()
  if (!trimmed || localPath.test(trimmed) || isProvisional(trimmed)) return null
  const scheme = schemeForm.exec(trimmed)
  if (scheme) {
    const protocol = scheme[1].toLowerCase()
    if (protocol === 'file') return null
    const rest = scheme[2].replace(/^[^@/]*@/, '')
    const slash = rest.indexOf('/')
    if (slash <= 0) return null
    const host = normaliseHost(rest.slice(0, slash), protocol)
    const path = trimPath(rest.slice(slash))
    return host && path ? { host, path } : null
  }
  // A host with an explicit port, as a stored identity spells it, is read before the scp form, which would
  // otherwise take the port for the first directory of the path.
  const [first, ...rest] = trimmed.split('/')
  const bracketed = first.startsWith('[')
  if (rest.length && (bracketed || dottedHost.test(first.replace(/:\d+$/, '')))) {
    const host = normaliseHost(first)
    const path = trimPath(rest.join('/'))
    if (host && path) return { host, path }
  }
  const scp = scpForm.exec(trimmed)
  if (scp) {
    const host = normaliseHost(scp[2])
    const path = trimPath(scp[3])
    return host && path ? { host, path } : null
  }
  // `owner/name` with no host means GitHub, as it does everywhere Git hosting is written by hand.
  const shorthand = shorthandForm.exec(trimmed)
  if (!shorthand) return null
  const path = trimPath(`${shorthand[1]}/${shorthand[2]}`)
  return path.includes('/') ? { host: GITHUB_HOST, path } : null
}

export function repositoryIdentity(value: string): string {
  const trimmed = value.trim()
  // A provisional identity is already normalised; parsing it again would read `local:` as an scp-style host.
  if (isProvisional(trimmed)) return trimmed
  const remote = parseRemote(trimmed)
  if (remote) return remote.host === GITHUB_HOST ? remote.path.toLowerCase() : `${remote.host}/${remote.path}`
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
  const remote = parseRemote(value)
  return remote?.host === GITHUB_HOST ? remote.path.toLowerCase() : undefined
}

/** A stable-ish stand-in derived from the folder name; a teammate's clone of the same code would not match it. */
export function provisionalIdentity(folder: string): string {
  const name = folder.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
  const cleaned = name.toLowerCase().replaceAll(/[^a-z0-9._-]+/g, '-').replace(/^[-.]+/, '').replace(/[-.]+$/, '')
  return PROVISIONAL_PREFIX + (cleaned || 'repository')
}

export interface RepositoryIdentity {
  /** The normalised identity, or a `local:` placeholder when the clone has no origin. */
  id: string
  /** The configured origin URL exactly as Git reports it, before normalisation. */
  origin: string | null
  provisional: boolean
  warning?: string
}
/**
 * The identity of a checkout, from its configured `origin` only. A teammate's clone has no `upstream` and no
 * `url.*.insteadOf` rewrite of yours, so neither may take part in an identity the whole team must agree on.
 */
export function deriveRepositoryIdentity(origin: string | null | undefined, folder: string): RepositoryIdentity {
  const configured = origin?.trim()
  if (configured) return { id: repositoryIdentity(configured), origin: configured, provisional: false }
  const id = provisionalIdentity(folder)
  return {
    id,
    origin: null,
    provisional: true,
    warning: `This checkout has no origin remote, so Groundwork uses the provisional identity "${id}". `
      + 'Add an origin remote so everyone derives the same identity.',
  }
}

/** The repository's own name: the last segment of its identity. */
export const repositoryName = (identity: string) => identity.replace(/^local:/, '').split('/').pop() || identity
/** Characters an identity uses that a document ID cannot; each escape starts with `_`, so the encoding is prefix-free. */
const slugEscapes: Record<string, string> = { '/': '__', _: '_u', '.': '_d', ':': '_c' }
const hex = (value: string) => [...new TextEncoder().encode(value)].map(byte => byte.toString(16).padStart(2, '0'))
/** Names a document ID may not take, because they are inherited object properties rather than own entries. */
const reservedIds = new Set(['constructor', 'prototype', '__proto__'])
/**
 * A document-safe ID for an identity, for the places that still need one flat token, such as the project manifest.
 * The encoding is injective, because the ID qualifies catalog IDs and two repositories must never share one:
 * `/` becomes `__` and every other character outside `[A-Za-z0-9-]` becomes a `_` escape, so `volvo-cars/price-engine`
 * reads as `volvo-cars__price-engine` while `foo.bar/a/b` and `foo-bar.a/b` stay distinct.
 */
export function identitySlug(identity: string): string {
  const value = identity.trim()
  let slug = ''
  for (const character of value) {
    if (/^[A-Za-z0-9-]$/.test(character)) slug += character
    else slug += slugEscapes[character] ?? hex(character).map(byte => `_x${byte}`).join('')
  }
  if (/^[A-Za-z0-9]/.test(slug) && !reservedIds.has(slug)) return slug
  // An identity that starts with anything else, such as a filesystem-path origin, or one that spells a reserved
  // property name, cannot be a document ID as it stands. `_z` is a sequence the escape encoding never produces,
  // so the two forms can never collide.
  return `r_z${hex(value).join('')}`
}
