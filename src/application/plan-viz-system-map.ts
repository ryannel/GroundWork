import type { Box, Context } from '@/application/plan-viz-system-map-boxes';
import { layoutColumns, type Columns } from '@/application/plan-viz-system-map-columns';
import { colX, placeBoxes } from '@/application/plan-viz-system-map-geometry';
import { aggregate, type Aggregate, type Link } from '@/application/plan-viz-system-map-links';
import { mergeLinks, routeAll, type Route } from '@/application/plan-viz-system-map-routes';
import {
  cardTip,
  innerText,
  lineTip,
  rowTip,
  systemTip,
} from '@/application/plan-viz-system-map-tips';
import type {
  DrawnBand,
  DrawnLine,
  DrawnNode,
  DrawnRow,
  DrawnTrunk,
  InnerLine,
  LensState,
  LineKind,
  MapShow,
  SystemMapDrawing,
  SystemMapInput,
} from '@/application/plan-viz-system-map-types';

export { SHOW_ALL, SHOW_OVERVIEW } from '@/application/plan-viz-system-map-types';

interface Kit {
  readonly ctx: Context;
  readonly agg: Aggregate;
  readonly cols: Columns;
  readonly lens: (id: string, host: string | null) => LensState;
  readonly off: (id: string) => boolean;
  readonly landed: ReadonlySet<string>;
  readonly inner: readonly Link[];
}

function contextOf(input: SystemMapInput, show: MapShow, agg: Aggregate): Context {
  const nodes = new Map(
    [...input.services, ...input.systems, ...input.stores].map((n) => [n.id, n]),
  );
  return { input, agg, show, nodes, label: (id) => input.labels[id] ?? id };
}

/** The lens team's cards stay bright, those they talk to stay readable, the rest dim. */
function lensOf(ctx: Context, agg: Aggregate, cols: Columns): Pick<Kit, 'lens' | 'off'> {
  const lens = ctx.input.lens;
  const off = (id: string): boolean => lens !== null && (ctx.nodes.get(id)?.team ?? null) !== lens;
  const host = (id: string): string => agg.hostOfSat.get(id) ?? id;
  const near = new Set<string>();
  if (lens !== null) {
    for (const l of agg.links) {
      const [a, b] = [host(l.a), host(l.b)];
      if (off(a) === off(b)) continue;
      const far = off(a) ? a : b;
      near.add(far);
      const sys = cols.sysOf.get(far);
      if (sys !== undefined) near.add(sys);
    }
  }
  return {
    off,
    lens: (id, of) => {
      if (lens === null) return null;
      if (!off(id)) return 'on';
      const sys = of === null ? undefined : cols.sysOf.get(of);
      const close =
        near.has(id) || (of !== null && near.has(of)) || (sys !== undefined && near.has(sys));
      return close ? 'near' : 'off';
    },
  };
}

const sidesOf = (kit: Kit, node: string, row: string): ('L' | 'R')[] =>
  (['L', 'R'] as const).filter((s) => kit.landed.has(`${node}|${row}|${s}`));

function rowsOf(kit: Kit, box: Box): DrawnRow[] {
  return box.rows
    .filter((r) => !r.hidden)
    .map((r) => ({
      id: r.id,
      label: r.label,
      count: r.eps.size,
      cy: r.cy - box.y,
      tip: rowTip(r.label, r.eps.size),
      landed: sidesOf(kit, box.id, r.id),
    }));
}

function moreOf(kit: Kit, box: Box): DrawnNode['more'] {
  if (box.more.length === 0) return null;
  const landed = (['L', 'R'] as const).filter((s) =>
    box.more.some((r) => kit.landed.has(`${box.id}|${r.id}|${s}`)),
  );
  return {
    count: box.more.length,
    cy: box.moreY - box.y,
    tip: box.more.map((r) => r.label).join('\n'),
    landed,
  };
}

function kindsOf(kit: Kit, box: Box): LineKind[] {
  const ids = box.kind === 'system' ? box.parts : [box.id];
  return [...new Set(ids.flatMap((id) => [...(kit.agg.kinds.get(id) ?? [])]))];
}

function insideOf(kit: Kit, box: Box): string[] {
  const mine = new Set(box.parts);
  const host = (id: string): string => kit.agg.hostOfSat.get(id) ?? id;
  const lines = kit.inner
    .filter((l) => mine.has(host(l.a)))
    .map((l) =>
      innerText(kit.ctx, {
        kind: l.kind,
        a: l.a,
        b: l.b,
        hostA: l.a,
        hostB: l.b,
        read: l.flags.has('read'),
        write: l.flags.has('write'),
      }),
    );
  return [...new Set(lines)];
}

function partsOf(kit: Kit, box: Box): DrawnNode['parts'] {
  if (!box.list) return [];
  return box.parts.map((id) => {
    const node = kit.ctx.nodes.get(id);
    const does = node?.does ?? '';
    const name = kit.ctx.label(id);
    return {
      id,
      label: name,
      kind: node?.kind ?? 'service',
      tip: does === '' ? name : `${name}\n${does}`,
    };
  });
}

function drawNode(kit: Kit, box: Box): DrawnNode {
  const node = kit.ctx.nodes.get(box.id);
  const system = box.kind === 'system';
  return {
    id: box.id,
    kind: box.kind,
    name: kit.ctx.label(box.id),
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    head: box.head,
    lines: box.lines,
    role: box.role,
    nameEnd: box.nameEnd,
    tx: box.tx,
    top: box.top,
    serviceKind: node?.kind ?? '',
    teamSlot: node?.teamSlot ?? 8,
    lens: kit.lens(box.id, box.host ?? box.sys),
    kinds: kindsOf(kit, box),
    tip: system ? systemTip(kit.ctx, box, insideOf(kit, box)) : cardTip(kit.ctx, box),
    part: box.part,
    compact: box.compact,
    external: box.kind === 'service' && node?.kind === 'external',
    system: box.sys,
    host: box.host,
    rows: rowsOf(kit, box),
    more: moreOf(kit, box),
    parts: partsOf(kit, box),
    folded: box.list,
  };
}

function drawLine(kit: Kit, r: Route): DrawnLine {
  const l = r.line;
  const first = [...l.vias][0];
  const ref = first ?? (l.kind === 'data' ? l.b : (l.row ?? l.b));
  const tip = lineTip(kit.ctx, l);
  return {
    key: l.key,
    kind: l.kind,
    a: l.shownA,
    b: l.shownB,
    hostA: l.hostA,
    hostB: l.hostB,
    d: r.d,
    tx: r.tx,
    ty: r.ty,
    into: r.into,
    noted: l.noted,
    dim: kit.off(l.a) && kit.off(l.b) && kit.ctx.input.lens !== null,
    inspect: ref,
    label: tip.split('\n')[0] ?? tip,
    tip,
  };
}

function drawTrunk(box: Box, nodes: ReadonlyMap<string, Box>): DrawnTrunk | null {
  const unit = nodes.get(box.trunk ?? box.host ?? '');
  if (box.host === null || unit === undefined) return null;
  const x = unit.x + 7;
  const y = box.y + box.h / 2;
  const d = `M${String(x)} ${String(unit.y + unit.h)} V${String(y - 5)} Q${String(x)} ${String(y)} ${String(x + 5)} ${String(y)} H${String(box.x)}`;
  return {
    host: box.host,
    unit: unit.id,
    node: box.id,
    kind: box.kind === 'topic' ? 'msg' : 'data',
    d,
  };
}

function bandsOf(input: SystemMapInput, cols: Columns): DrawnBand[] {
  return input.stages.length === 0
    ? []
    : cols.used.flatMap((stage, c): DrawnBand[] => {
        const s = input.stages[stage];
        if (s === undefined) return [];
        const tip = s.summary === '' ? s.name : `${s.name}: ${s.summary}`;
        return [{ x: colX(c) - 10, stage, id: s.id, name: s.name, tip }];
      });
}

function landedOf(routes: readonly Route[]): Set<string> {
  return new Set(
    routes
      .filter((r) => r.line.row !== null)
      .map((r) => `${r.to.id}|${r.line.row ?? ''}|${r.into === 1 ? 'L' : 'R'}`),
  );
}

/**
 * The map laid out for what is shown. `flip` holds systems whose parts show the other way round from
 * `show.parts`. Null when there are no services to draw.
 */
export function drawSystemMap(
  input: SystemMapInput,
  options: { readonly show: MapShow; readonly flip?: ReadonlySet<string> },
): SystemMapDrawing | null {
  if (input.services.length === 0) return null;
  const agg = aggregate(input, options.show);
  const ctx = contextOf(input, options.show, agg);
  const cols = layoutColumns(input, agg);
  const placed = placeBoxes(ctx, cols, options.flip ?? new Set());
  const { live, inner } = mergeLinks(agg, cols, placed.nodes);
  const { routes, h } = routeAll(live, placed.nodes, placed);
  const kit: Kit = { ctx, agg, cols, ...lensOf(ctx, agg, cols), landed: landedOf(routes), inner };
  const boxes = [...new Set(placed.nodes.values())];
  const innerLines: InnerLine[] = inner.map((l) => ({
    kind: l.kind,
    a: l.a,
    b: l.b,
    hostA: agg.hostOfSat.get(l.a) ?? l.a,
    hostB: agg.hostOfSat.get(l.b) ?? l.b,
  }));
  return {
    w: placed.w,
    h: h + 22,
    columns: cols.cols.length,
    nodes: boxes.map((b) => drawNode(kit, b)),
    lines: routes.map((r) => drawLine(kit, r)),
    inner: innerLines,
    trunks: boxes.flatMap((b) => drawTrunk(b, placed.nodes) ?? []),
    bands: bandsOf(input, cols),
    services: input.services.length,
    satellites: agg.hostOfSat.size,
  };
}
