import type { ErrorObject, ValidateFunction } from 'ajv';

import type { Issue } from '@/application/plan/check-context';
import type { ShapeProblem } from '@/application/plan/check-shape';
import { formatPath, isRecord, pointerToSegments, prop } from '@/application/plan/ids';
import type { PathSegment } from '@/domain/plan/plan-ids';

const OP_BRANCH: Record<string, string> = {
  add: 'op_add',
  modify: 'op_modify',
  deprecate: 'op_deprecate',
  remove: 'op_remove',
};

/** How to find the schema branch for an op, and where in the plan the errors being rewritten sit. */
interface RewriteContext {
  branchOf: (name: string) => ValidateFunction | undefined;
  prefix?: readonly PathSegment[];
}

type Rewrite = (e: ErrorObject, segs: PathSegment[]) => Issue | null;

const show = (v: unknown): string => (typeof v === 'string' ? `"${v}"` : JSON.stringify(v));
const param = (e: ErrorObject, key: string): unknown => e.params[key];
const issue = (segs: readonly PathSegment[], message: string): Issue => ({
  path: formatPath(segs),
  message,
});

function typeName(v: unknown): string {
  if (Array.isArray(v)) return 'array';
  return v === null ? 'null' : typeof v;
}

const KEYWORDS: Record<string, Rewrite> = {
  additionalProperties(e, segs) {
    const props = isRecord(e.parentSchema) ? prop(e.parentSchema, 'properties') : undefined;
    const allowed = isRecord(props) ? Object.keys(props) : [];
    const hint = allowed.length > 0 ? ` (allowed: ${allowed.join(', ')})` : '';
    return issue(
      [...segs, String(param(e, 'additionalProperty'))],
      `unknown property${hint}; rename it to an allowed key or delete it (status, colour, order and seq are derived, never authored)`,
    );
  },
  required(e, segs) {
    const name = String(param(e, 'missingProperty'));
    const where =
      name === 'into'
        ? ' (fields go into sch:…, endpoints into if:…, steps into flow:…, regions into scr:…)'
        : '';
    return issue([...segs, name], `is required; add \`${name}:\`${where}`);
  },
  pattern(e, segs) {
    const said = prop(e.parentSchema, 'description');
    return issue(
      segs,
      `${show(e.data)} must look like ${typeof said === 'string' ? said : String(param(e, 'pattern'))}`,
    );
  },
  enum(e, segs) {
    const allowed = param(e, 'allowedValues');
    const hint =
      segs.at(-1) === 'add' && segs.includes('ops')
        ? '; teams are base data, and tests/work items live in their own arrays, not in ops'
        : '';
    return issue(
      segs,
      `${show(e.data)} must be one of: ${Array.isArray(allowed) ? allowed.join(' | ') : ''}${hint}`,
    );
  },
  type(e, segs) {
    if (e.data instanceof Date) {
      return issue(
        segs,
        'dates must be quoted strings ("2026-10-01") so YAML keeps them as strings',
      );
    }
    const want = String(param(e, 'type'));
    const hint = want === 'array' ? '; wrap it in a list, e.g. [svc:x]' : '';
    return issue(segs, `must be ${want} (got ${typeName(e.data)})${hint}`);
  },
  format(e, segs) {
    const format = String(param(e, 'format'));
    return issue(
      segs,
      `${show(e.data)} must be a ${format}${format === 'date' ? ' (YYYY-MM-DD)' : ''}`,
    );
  },
  minItems: (e, segs) =>
    issue(
      segs,
      `must have at least ${String(param(e, 'limit'))} item(s); add one, or delete the empty list's owner`,
    ),
  minProperties: (_e, segs) =>
    issue(segs, 'must not be empty; put at least one prop in it, or delete the key'),
  discriminator(e, segs) {
    const tag = String(param(e, 'tag'));
    const branches = prop(e.parentSchema, 'oneOf');
    const names = Array.isArray(branches)
      ? branches
          .map((b) => prop(prop(prop(b, 'properties'), tag), 'const'))
          .filter((x) => x !== undefined)
          .map(String)
      : [];
    return issue([...segs, tag], `${show(prop(e.data, tag))} must be one of: ${names.join(' | ')}`);
  },
  'false schema': (_e, segs) => {
    const last = String(segs.at(-1));
    return issue(
      segs,
      `${last} belongs to a GraphQL type (kind: graph-type) or one of its fields; set kind: graph-type and graph: graph:… on the schema, or delete ${last}`,
    );
  },
  const: () => null,
  oneOf: () => null,
  if: () => null,
};

/** Translate one ajv error into an issue, or null to drop it. */
function readable(e: ErrorObject, prefix: readonly PathSegment[]): Issue | null {
  const segs = [...prefix, ...pointerToSegments(e.instancePath)];
  const rewrite = KEYWORDS[e.keyword];
  return rewrite === undefined ? issue(segs, e.message ?? e.keyword) : rewrite(e, segs);
}

function dedupe(list: readonly Issue[]): Issue[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const key = `${x.path}\u0000${x.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function valueAt(root: unknown, segs: readonly PathSegment[]): unknown {
  return segs.reduce<unknown>(
    (v, k) => (Array.isArray(v) ? v[Number(k)] : prop(v, String(k))),
    root,
  );
}

/** How an op that failed its oneOf is reported: by the branch its key names, or by "exactly one of". */
function opIssues(op: unknown, at: readonly PathSegment[], ctx: RewriteContext): Issue[] {
  const prefix = ctx.prefix ?? [];
  const kinds = isRecord(op) ? Object.keys(OP_BRANCH).filter((k) => k in op) : [];
  const where = formatPath([...prefix, ...at]);
  if (kinds.length === 0) {
    return [
      {
        path: where,
        message:
          'op must have exactly one of add | modify | deprecate | remove; rename the op key to one of those',
      },
    ];
  }
  if (kinds.length > 1) {
    return [
      {
        path: where,
        message: `op has ${kinds.join(' + ')}; use exactly one of add | modify | deprecate | remove (split it into ${String(kinds.length)} ops)`,
      },
    ];
  }
  const branch = ctx.branchOf(OP_BRANCH[kinds[0] ?? ''] ?? '');
  if (branch === undefined || branch(op)) return [];
  return rewriteErrors(branch.errors ?? [], op, { ...ctx, prefix: [...prefix, ...at] });
}

function anyOfIssues(
  errors: readonly ErrorObject[],
  prefix: readonly PathSegment[],
  skip: (p: string) => boolean,
) {
  const out: Issue[] = [];
  const collapsed = new Set<ErrorObject>();
  for (const a of errors.filter((e) => e.keyword === 'anyOf' && !skip(e.instancePath))) {
    const subs = errors.filter(
      (e) =>
        e !== a && e.instancePath === a.instancePath && e.schemaPath.startsWith(`${a.schemaPath}/`),
    );
    const where = formatPath([...prefix, ...pointerToSegments(a.instancePath)]);
    if (subs.length > 0 && subs.every((e) => e.keyword === 'required')) {
      for (const e of subs) collapsed.add(e);
      const names = subs.map((e) => String(param(e, 'missingProperty'))).join(' | ');
      out.push({
        path: where,
        message: `needs one of: ${names}; add the one that says what changes`,
      });
    } else out.push({ path: where, message: a.message ?? 'anyOf' });
  }
  return { out, collapsed };
}

/**
 * Rewrite ajv errors: resolve failing `op` oneOfs to the branch the author meant, collapse
 * anyOf-of-required, and make every message readable.
 */
export function rewriteErrors(
  errors: readonly ErrorObject[],
  data: unknown,
  ctx: RewriteContext,
): Issue[] {
  const prefix = ctx.prefix ?? [];
  const opFails = errors
    .filter((e) => e.keyword === 'oneOf' && /\/changes\/\d+\/ops\/\d+$/.test(e.instancePath))
    .map((e) => e.instancePath);
  const underOp = (p: string): boolean => opFails.some((o) => p === o || p.startsWith(`${o}/`));
  const out: Issue[] = [];
  for (const ptr of opFails) {
    const at = pointerToSegments(ptr);
    out.push(...opIssues(valueAt(data, at), at, ctx));
  }
  const grouped = anyOfIssues(errors, prefix, underOp);
  out.push(...grouped.out);
  for (const e of errors) {
    if (e.keyword === 'anyOf' || grouped.collapsed.has(e) || underOp(e.instancePath)) continue;
    const r = readable(e, prefix);
    if (r !== null) out.push(r);
  }
  return dedupe(out);
}

const NAMED_BY: Record<string, string> = {
  additionalProperties: 'additionalProperty',
  required: 'missingProperty',
};

function namedProp(e: ErrorObject): string | undefined {
  const key = NAMED_BY[e.keyword];
  const name = key === undefined ? undefined : param(e, key);
  return typeof name === 'string' ? name : undefined;
}

/** The ajv errors of one entity, as problems a modify op can be blamed for. */
export function shapeProblems(errors: readonly ErrorObject[]): ShapeProblem[] {
  const out: ShapeProblem[] = [];
  for (const e of errors) {
    const message = readable(e, [])?.message;
    if (message === undefined) continue;
    const segs = pointerToSegments(e.instancePath);
    const first = segs[0];
    out.push({
      prop: first === undefined ? namedProp(e) : String(first),
      tail: segs.slice(1),
      message,
      unknownProp: e.keyword === 'additionalProperties',
    });
  }
  return out;
}
