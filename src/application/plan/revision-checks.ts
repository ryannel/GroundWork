import type { CheckContext, Report } from '@/application/plan/check-context';
import {
  compareVersions,
  currentRevision,
  ledgerOf,
  type RevisionEntry,
} from '@/application/plan/revision-ledger';

interface Entry {
  readonly list: readonly RevisionEntry[];
  readonly r: RevisionEntry;
  readonly i: number;
}

const at = (i: number, ...rest: readonly (string | number)[]) => ['meta', 'revisions', i, ...rest];

function checkOrder({ list, r, i }: Entry, rep: Report): void {
  const before = list[i - 1];
  if (before !== undefined && compareVersions(r.version, before.version) <= 0) {
    rep.error(
      at(i, 'version'),
      `${r.version} does not follow ${before.version}; meta.revisions is oldest first and every version is higher than the one before`,
    );
  }
  if (r.status === 'proposed' && i !== list.length - 1) {
    rep.error(
      at(i, 'status'),
      `${r.version} is still proposed but a later revision follows it; approve or reject it first (only the last entry can be proposed)`,
    );
  }
}

function checkApproval({ r, i }: Entry, rep: Report): void {
  if (r.status === 'approved' && r.approved_on === undefined) {
    rep.warn(
      at(i),
      `${r.version} is approved but has no approved_on; tools/revision.mjs approve records it`,
    );
  }
  if (r.status !== 'approved' && (r.approved_on !== undefined || r.approved_by !== undefined)) {
    rep.warn(
      at(i),
      `${r.version} is ${r.status} but carries approval fields; drop them or set status: approved`,
    );
  }
}

function checkRejection({ r, i }: Entry, rep: Report): void {
  if (r.status === 'rejected' && (r.reason === undefined || r.reason === '')) {
    rep.warn(
      at(i),
      `${r.version} is rejected but says nobody why; add reason: (tools/revision.mjs reject --reason records it)`,
    );
  }
  if (r.status === 'rejected' && r.rejected_on === undefined) {
    rep.warn(
      at(i),
      `${r.version} is rejected but has no rejected_on; tools/revision.mjs reject records it`,
    );
  }
  if (r.status !== 'rejected' && (r.rejected_on !== undefined || r.rejected_by !== undefined)) {
    rep.warn(
      at(i),
      `${r.version} is ${r.status} but carries rejection fields; drop them or set status: rejected`,
    );
  }
}

function checkWhy({ r, i }: Entry, rep: Report): void {
  if (r.status === 'proposed' && i > 0 && (r.why === undefined || r.why === '')) {
    rep.warn(
      at(i),
      `${r.version} is proposed without a why; reviewers decide on the reasoning, so say in two or three sentences what is wrong without it (why:)`,
    );
  }
}

// the proposer's word on work items: only the last entry's can be checked against this file
function checkWork({ list, r, i }: Entry, ctx: CheckContext, rep: Report): void {
  if (i !== list.length - 1) return;
  for (const [j, w] of (r.work ?? []).entries()) {
    if (w.action !== 'drop' && !ctx.known(w.item)) {
      rep.error(
        at(i, 'work', j, 'item'),
        `${w.item} is not a work item in this plan; name one of its work_items (drop is the only action for one that is gone)`,
      );
    }
  }
}

function checkProposal(entry: Entry, ctx: CheckContext, rep: Report): void {
  const { r, i } = entry;
  checkWhy(entry, rep);
  checkWork(entry, ctx, rep);
  for (const [j, who] of (r.by ?? []).entries()) {
    if (who.startsWith('team:') && !ctx.known(who)) {
      rep.error(
        at(i, 'by', j),
        `${who} is not a team in this plan; use one of its team ids or a plain name`,
      );
    }
  }
}

function checkHead(ctx: CheckContext, rep: Report): void {
  const { meta } = ctx.plan;
  const cur = currentRevision(ctx.plan);
  if (cur === null) {
    rep.warn(
      ['meta', 'revisions'],
      'every version is rejected; meta.revisions needs at least one proposed or approved entry to say what this file is',
    );
    return;
  }
  if (meta.version === undefined) {
    rep.error(
      ['meta', 'version'],
      `the plan has meta.revisions but no meta.version; set meta.version: "${cur.version}"`,
    );
  } else if (meta.version !== cur.version) {
    rep.error(
      ['meta', 'version'],
      `meta.version is ${meta.version} but meta.revisions says this file is version ${cur.version}; set meta.version: "${cur.version}" (tools/revision.mjs keeps them in step)`,
    );
  }
}

/** Check 12: the revision ledger is ordered, has one head, and meta.version names it. */
export function revisionChecks(ctx: CheckContext, rep: Report): void {
  const list = ledgerOf(ctx.plan);
  if (list.length === 0) return;
  for (const [i, r] of list.entries()) {
    const entry = { list, r, i };
    checkOrder(entry, rep);
    checkApproval(entry, rep);
    checkRejection(entry, rep);
    checkProposal(entry, ctx, rep);
  }
  checkHead(ctx, rep);
}
