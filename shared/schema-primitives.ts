import { z } from 'zod'

/** Shared zod building blocks for content, delivery and catalog documents. */

// Validators never rewrite values: text must contain a non-space character and is stored exactly as written (no trimming).
export const text = z.string().min(1).regex(/\S/, 'Text cannot be blank')
export const idPattern = /^(?!(?:constructor|prototype|__proto__)$)[a-zA-Z0-9][a-zA-Z0-9_-]*$/
export const id = text.regex(idPattern, 'Use a URL-safe stable ID')
/** A Git object ID: SHA-1 (40 hex) or SHA-256 (64 hex). Used for commits and blob digests. */
export const commitSha = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/, 'Use a full commit or object hash')
/** ISO 8601 date-time; UTC `Z` or an explicit offset. */
export const isoTimestamp = z.iso.datetime({ offset: true })

/** Relative, forward-slash, no empty or `..` segments. */
export const isRepoRelativePath = (value: string) =>
  !value.startsWith('/') && !value.includes('\\') && !value.split('/').some(part => !part || part === '..')
export const repoRelativePath = z.string().min(1).max(4096).refine(isRepoRelativePath, 'Repository-relative path required')

/** Contract methods: HTTP verbs plus message (EVENT) and RPC boundaries. */
export const httpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'EVENT', 'RPC'])
export type HttpMethod = z.infer<typeof httpMethodSchema>
export const httpMethods = httpMethodSchema.options
export const httpVerbs: readonly HttpMethod[] = httpMethods.filter(method => method !== 'EVENT' && method !== 'RPC')
