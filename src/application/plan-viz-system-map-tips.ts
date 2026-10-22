import type { Box, Context } from '@/application/plan-viz-system-map-boxes';
import type { Merged } from '@/application/plan-viz-system-map-routes';
import type { InnerLine } from '@/application/plan-viz-system-map-types';

// The words a reader gets on hover: what each card, line and row is.

const capital = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
const withDoes = (head: string, does: string): string => (does === '' ? head : `${head}\n${does}`);
const bracket = (text: string): string => (text === '' ? '' : ` (${text})`);
const dotted = (text: string): string => (text === '' ? '' : ` · ${text}`);

function ownerOf(ctx: Context, box: Box): string {
  if (box.sys !== null) return `part of ${ctx.label(box.sys)}`;
  const team = ctx.nodes.get(box.id)?.team ?? null;
  return team === null ? '' : ctx.label(team);
}

export function cardTip(ctx: Context, box: Box): string {
  const node = ctx.nodes.get(box.id);
  const name = ctx.label(box.id);
  const does = node?.does ?? '';
  const kind = node?.kind ?? '';
  if (box.kind === 'topic') return withDoes(`Topic: ${name}`, does);
  if (box.kind === 'store') {
    return withDoes(`${kind === '' ? 'Store' : capital(kind)}: ${name}`, does);
  }
  const word = kind === '' || kind === 'service' ? '' : kind;
  const quiet = box.compact ? '\nNo calls, events or stores modelled today' : '';
  const head = `${name}${bracket(word)}${dotted(ownerOf(ctx, box))}`;
  return `${withDoes(head, does)}${quiet}`;
}

const ARROWS: Readonly<Record<string, string>> = { api: 'calls', msg: '→' };

function innerWord(l: Pick<Merged, 'kind' | 'read' | 'write'>): string {
  if (l.kind !== 'data') return ARROWS[l.kind] ?? '';
  if (l.read && l.write) return 'reads and writes';
  return l.write ? 'writes' : 'reads';
}

export function innerText(
  ctx: Context,
  l: InnerLine & { readonly read: boolean; readonly write: boolean },
): string {
  return `${ctx.label(l.a)} ${innerWord(l)} ${ctx.label(l.b)}`;
}

const more = (n: number): string => `\n+${String(n)} more`;

export function systemTip(ctx: Context, box: Box, inside: readonly string[]): string {
  const node = ctx.nodes.get(box.id);
  const team = node?.team ?? null;
  const head = `${ctx.label(box.id)} (system${team === null ? '' : dotted(ctx.label(team))})`;
  const parts = `Parts: ${box.parts.map((id) => ctx.label(id)).join(', ')}`;
  const extra = inside.length > 8 ? more(inside.length - 8) : '';
  const wires = inside.length === 0 ? '' : `\nInside:\n${inside.slice(0, 8).join('\n')}${extra}`;
  return `${withDoes(head, node?.does ?? '')}\n${parts}${wires}`;
}

function viaWords(ctx: Context, l: Merged): string {
  if (l.vias.size === 0) return '';
  const words = [...l.vias].slice(0, 6).map((v) => ctx.label(v));
  return `\n${words.join('\n')}${l.vias.size > 6 ? more(l.vias.size - 6) : ''}`;
}

/** How a line's calls travel, " by GraphQL query", when the model says for every one of them. */
function howWords(ctx: Context, l: Pick<Merged, 'vias'>): string {
  const words = new Set([...l.vias].map((v) => ctx.input.callWords?.[v] ?? ''));
  if (words.size !== 1 || words.has('')) return '';
  return [...words].join('');
}

/** The data a line carries, by name, most used first: "Product", "Price changed". */
export function carried(
  ctx: Context,
  l: Pick<Merged, 'vias'>,
): readonly (readonly [string, number])[] {
  const count = new Map<string, number>();
  for (const v of l.vias) {
    const name = ctx.input.carries?.[v] ?? ctx.label(v);
    count.set(name, (count.get(name) ?? 0) + 1);
  }
  return [...count].toSorted((x, y) => (y[1] === x[1] ? x[0].localeCompare(y[0]) : y[1] - x[1]));
}

const times = (n: number, noun: string): string => (n === 1 ? noun : `${String(n)} ${noun}s`);

function carriedLines(ctx: Context, l: Merged): string {
  const calls = { ...l, vias: new Set([...l.vias].filter((v) => !v.startsWith('msg:'))) };
  const events = { ...l, vias: new Set([...l.vias].filter((v) => v.startsWith('msg:'))) };
  const lines = [
    ...carried(ctx, calls).map(([name, n]) => `${name} · ${times(n, 'call')}`),
    ...carried(ctx, events).map(([name]) => `${name} · event`),
  ];
  const extra = lines.length > 8 ? more(lines.length - 8) : '';
  return lines.length === 0 ? '' : `\n${lines.slice(0, 8).join('\n')}${extra}`;
}

function pairHead(ctx: Context, l: Merged): string {
  const a = ctx.label(l.shownA);
  const b = ctx.label(l.shownB);
  if (l.kinds.has('api')) {
    const how = howWords(ctx, l);
    const by = how === '' ? '' : ` by ${how}`;
    return `${a} gets data from ${b}${by}`;
  }
  if (l.kinds.has('msg')) return `${a} listens to ${b}`;
  return `${a} ${innerWord(l)} ${b}`;
}

/** A line read system by system: who gets data from whom, and what that data is. */
export function pairTip(ctx: Context, l: Merged): string {
  const flows = l.flows.size > 0 ? `\nIn: ${[...l.flows].map((f) => ctx.label(f)).join(', ')}` : '';
  const hand = l.noted ? '\nShown on its stage; no flow uses it yet.' : '';
  return `${pairHead(ctx, l)}${carriedLines(ctx, l)}${flows}${hand}`;
}

/** What a line says on hover: who calls what, how, in which flows. */
export function lineTip(ctx: Context, l: Merged): string {
  const merged = l.parts.size > 1;
  const a = ctx.label(merged ? l.shownA : l.a);
  const b = ctx.label(merged ? l.shownB : l.b);
  const flows = l.flows.size > 0 ? `\nIn: ${[...l.flows].map((f) => ctx.label(f)).join(', ')}` : '';
  const hand = l.noted ? '\nShown on its stage; no flow uses it yet.' : '';
  if (l.kind === 'api') {
    const on = l.row === null ? '' : `${ctx.label(l.row)} on `;
    const how = howWords(ctx, l);
    const by = how === '' ? '' : ` by ${how}`;
    return `${a} calls ${on}${b}${by}${viaWords(ctx, l)}${flows}${hand}`;
  }
  const named = l.vias.size > 0 ? `: ${[...l.vias].map((v) => ctx.label(v)).join(', ')}` : '';
  if (l.kind === 'msg') return `${a} → ${b}${named}${flows}${hand}`;
  return `${a} ${innerWord(l)} ${b}${flows}${hand}`;
}

export function rowTip(label: string, endpoints: number): string {
  if (endpoints === 0) return `${label}: called today`;
  const count = endpoints === 1 ? '1 endpoint' : `${String(endpoints)} endpoints`;
  return `${label}: ${count} called today`;
}
