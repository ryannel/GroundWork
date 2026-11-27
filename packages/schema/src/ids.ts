export const ENTITY_PREFIXES = [
  "workspace",
  "project",
  "domain",
  "system",
  "service",
  "app",
  "module",
  "store",
  "topic",
  "interface",
  "endpoint",
  "message",
  "subscription",
  "job",
  "interaction",
  "schema",
  "screen",
  "handler",
  "procedure",
  "flow",
  "external",
  "library",
  "team",
  "actor",
  "organisation",
  "area",
  "evidence",
  "plan",
  "change",
  "requirement",
  "milestone",
  "work-item",
  "test",
  "decision",
  "question",
  "risk",
  "review",
] as const;

export type EntityPrefix = (typeof ENTITY_PREFIXES)[number];

const PREFIX_SET = new Set<string>(ENTITY_PREFIXES);

export const CANONICAL_ID_PATTERN =
  `^(?:${ENTITY_PREFIXES.join("|")}):[a-z0-9][a-z0-9._/-]*(?:#!?[a-z0-9][a-z0-9._/-]*)?$`;

const CANONICAL_ID_REGEX = new RegExp(CANONICAL_ID_PATTERN);
const LOCAL_SLUG_REGEX = /^[a-z0-9][a-z0-9._-]*$/;

export interface ParsedId {
  readonly raw: string;
  readonly prefix: EntityPrefix;
  readonly path: string;
  readonly child?: string;
  readonly isFailure: boolean;
}

export function isCanonicalId(value: string): boolean {
  return CANONICAL_ID_REGEX.test(value);
}

export function isLocalSlug(value: string): boolean {
  return LOCAL_SLUG_REGEX.test(value);
}

export function parseCanonicalId(value: string): ParsedId | undefined {
  if (!CANONICAL_ID_REGEX.test(value)) return undefined;
  const colonIdx = value.indexOf(":");
  const prefix = value.slice(0, colonIdx);
  if (!PREFIX_SET.has(prefix)) return undefined;
  const rest = value.slice(colonIdx + 1);
  const hashIdx = rest.indexOf("#");
  if (hashIdx === -1) {
    return {
      raw: value,
      prefix: prefix as EntityPrefix,
      path: rest,
      isFailure: false,
    };
  }
  const basePath = rest.slice(0, hashIdx);
  const childPart = rest.slice(hashIdx + 1);
  const isFailure = childPart.startsWith("!");
  return {
    raw: value,
    prefix: prefix as EntityPrefix,
    path: basePath,
    child: isFailure ? childPart.slice(1) : childPart,
    isFailure,
  };
}

/** Qualifies a bare local slug at declaration into its canonical pathed ID. */
export function qualifyId(prefix: EntityPrefix, rawId: string, scopeSlug?: string): string {
  if (rawId.includes(":")) return rawId;
  return scopeSlug ? `${prefix}:${scopeSlug}/${rawId}` : `${prefix}:${rawId}`;
}
