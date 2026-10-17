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

/** What a line says on hover: who calls what, in which flows. */
export function lineTip(ctx: Context, l: Merged): string {
  const merged = l.parts.size > 1;
  const a = ctx.label(merged ? l.shownA : l.a);
  const b = ctx.label(merged ? l.shownB : l.b);
  const flows = l.flows.size > 0 ? `\nIn: ${[...l.flows].map((f) => ctx.label(f)).join(', ')}` : '';
  const hand = l.noted ? '\nShown on its stage; no flow uses it yet.' : '';
  if (l.kind === 'api') {
    const on = l.row === null ? '' : `${ctx.label(l.row)} on `;
    return `${a} calls ${on}${b}${viaWords(ctx, l)}${flows}${hand}`;
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
