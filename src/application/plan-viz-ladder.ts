import type { Model } from '@/application/plan/derive';
import { prop } from '@/application/plan/ids';
import {
  type Ladder,
  type Retirement,
  andList,
  isConsumer,
  lastMigrateMs,
  msShort,
  retireMilestone,
  sequencing,
  versionNames,
  type Sequencing,
} from '@/application/plan-viz-ladder-order';
import { numWord } from '@/application/plan-viz-text';

// A migration ladder in words: what happens to the contract, who has to move and by when.

interface Move {
  readonly from: string;
  readonly to: string;
}

/** A graph field that moves between subgraphs through @override has the two subgraphs on its ladder. */
function movesBetween(l: Ladder): Move | null {
  if (!('from' in l)) return null;
  return typeof l.from === 'string' && typeof l.to === 'string' ? { from: l.from, to: l.to } : null;
}

interface Words {
  readonly old: string;
  readonly next: string;
  readonly name: string | null;
  /** The old and the new version as the sentence names them: a bare "v1", or a quoted id. */
  readonly oldQ: string;
  readonly nextQ: string;
}

function wordsOf(model: Model, l: Ladder): Words | null {
  const from = l.chain[0];
  const to = l.chain.at(-1);
  if (from === undefined || to === undefined) return null;
  const n = versionNames(model, from, to);
  const quote = (x: string) => (n.named ? x : `\`${x}\``);
  return { old: n.old, next: n.next, name: n.name, oldQ: quote(n.old), nextQ: quote(n.next) };
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

interface Ctx {
  readonly model: Model;
  readonly id: string;
  readonly w: Words;
  readonly retirement: Retirement;
  readonly who: readonly string[];
}

function retireBreaks({ id, who, w }: Ctx): string {
  if (id.startsWith('api:')) return `calls to ${w.oldQ} then fail`;
  const thing = `\`${w.name ?? w.old}\``;
  return `${who.length === 1 ? 'it' : 'any that has not'} stops receiving ${thing}`;
}

/** Who has to move to the new version, by which milestone, and what breaks for whoever has not. */
function deadline(c: Ctx, l: Ladder): string {
  const { model, w, retirement, who } = c;
  const names =
    who.length > 3
      ? `${who.slice(0, 3).join(', ')} and ${numWord(who.length - 3)} more`
      : andList(who);
  const lastMs = lastMigrateMs(model, l);
  const by = lastMs === null ? '' : ` by ${msShort(model, lastMs)}`;
  const verb = who.length === 1 ? 'has' : 'have';
  if (retirement.kind === 'retire' && retirement.ms !== null) {
    if (who.length === 0) {
      return `${w.oldQ} is removed in ${msShort(model, retirement.ms)}; nobody is recorded as still using it.`;
    }
    return `${names} ${verb} to move to ${w.nextQ} by ${msShort(model, retirement.ms)}, when ${w.oldQ} is removed; ${retireBreaks(c)}.`;
  }
  if (who.length === 0) return '';
  if (retirement.kind === 'deprecate') {
    const when = retirement.ms === null ? '' : ` in ${msShort(model, retirement.ms)}`;
    return `${names} should move to ${w.nextQ}${by}. Nothing breaks yet: ${w.oldQ} is deprecated${when} and still works, and removing it is a later plan.`;
  }
  return `${names} move to ${w.nextQ}${by}. ${w.oldQ} keeps working until a later plan removes it.`;
}

function retireSentence(c: Ctx, move: Move | null, l: Ladder): string {
  const { model, w, retirement } = c;
  const at = retirement.ms === null ? '' : ` in ${msShort(model, retirement.ms)}`;
  const deprecated = retirement.kind === 'deprecate';
  if (deprecated) return `${w.oldQ} is deprecated${at}; removal is a later plan.`;
  if (retirement.kind !== 'retire') return '';
  if (move !== null) {
    const field =
      model
        .label(l.chain[0] ?? '')
        .split('.')
        .pop() ?? '';
    return `${model.label(move.from)} stops resolving \`${field}\`${at}, once ${model.label(move.to)} serves all of it.`;
  }
  if (retirement.early) {
    return `${w.oldQ} is removed after the migrations (planned ${msShort(model, retirement.ms ?? '')}, before the last migration in ${msShort(model, retirement.lastMigrate ?? '')}: check the plan).`;
  }
  return `${w.oldQ} is removed${at}, once every consumer has moved.`;
}

function headlineOf(c: Ctx, move: Move | null, l: Ladder): string {
  const { model, w } = c;
  if (move !== null) {
    return `\`${model.label(l.chain[0] ?? '')}\` moves from ${model.label(move.from)} to ${model.label(move.to)}`;
  }
  const first =
    w.name === null
      ? `\`${w.old}\` is replaced by \`${w.next}\``
      : `\`${w.name}\` goes to ${w.next}`;
  const n = c.who.length;
  if (n === 0) return capital(first);
  return capital(`${first}; ${numWord(n)} ${n === 1 ? 'consumer migrates' : 'consumers migrate'}`);
}

export interface LadderSummary {
  readonly headline: string;
  readonly deadline: string;
  readonly retire: string;
  readonly sequence: Sequencing | null;
  readonly early: boolean;
  readonly kind: Retirement['kind'];
}

/**
 * The ladder in a few sentences: a headline ("`product.published` goes to v2; four consumers migrate"), the
 * deadline for whoever has to move, and when the old version goes.
 */
export function ladderSummary(model: Model, id: string): LadderSummary | null {
  const l = model.ladder(id);
  const w = wordsOf(model, l);
  if (w === null || l.rungs.length === 0) return null;
  const retirement = retireMilestone(model, id);
  const who = l.rungs
    .filter((r) => r.rung === 'migrate' && isConsumer(r.consumer))
    .map((r) => model.label(r.consumer ?? ''));
  const c: Ctx = { model, id, w, retirement, who };
  const move = movesBetween(l);
  const retire = retireSentence(c, move, l);
  return {
    headline: headlineOf(c, move, l),
    deadline: move === null ? deadline(c, l) : '',
    retire: /^v\d/u.test(retire) ? retire : capital(retire),
    sequence: sequencing(model, id),
    early: retirement.early,
    kind: retirement.kind,
  };
}

export interface VersionPair {
  readonly side: 'new' | 'old';
  /** What the badge leads with: the word, then this version. */
  readonly lead: string;
  readonly other: string;
}

const verOf = (model: Model, id: string, same: boolean): string => {
  const version = prop(model.get(id), 'version');
  const name = model.get(id) === undefined ? id : model.label(id);
  if (same) return typeof version === 'string' ? version : (id.split('-').pop() ?? id);
  return typeof version === 'string' ? `${name} ${version}` : name;
};

const oldWord = (model: Model, id: string): string => {
  const status = model.status(id);
  if (status === 'removed') return 'Removed';
  return status === 'deprecated' ? 'Deprecated' : 'Replaced';
};

/**
 * The badge a versioned contract wears: "New v2 · replaces v1" or "Deprecated v1 · → v2". A pair with the same
 * name stays short; one whose names differ names the replacement in full.
 */
export function versionPair(model: Model, id: string): VersionPair | null {
  const v = model.versions(id);
  const other = v.replacedBy ?? v.supersedes;
  if (other === null) return null;
  const same =
    typeof prop(model.get(id), 'name') === 'string' &&
    prop(model.get(id), 'name') === prop(model.get(other), 'name');
  const me = verOf(model, id, same);
  const you = verOf(model, other, same);
  if (v.supersedes !== null) return { side: 'new', lead: `New ${me}`, other: `replaces ${you}` };
  return { side: 'old', lead: `${oldWord(model, id)} ${me}`, other: `→ ${you}` };
}
