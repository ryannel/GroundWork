import * as fs from 'fs';
import * as path from 'path';
import { Ctx, CliError } from '../util/context';
import { ROOT, GROUNDWORK_SURFACES_FILE } from '../util/paths';
import { Painter } from '../theme/color';
import { Renderer } from '../theme/render';

// ---------------------------------------------------------------------------
// Surface registry & capability ledger (`./dev surface status`)
//
// Read-only view over .groundwork/surfaces.json — the machine-readable twin of
// docs/surfaces.md. Architecture writes it, bet validation appends capability
// rows, surface activation appends surfaces; this command only reads.
// ---------------------------------------------------------------------------

interface Surface {
  slug: string;
  type?: string;
  platform?: string;
  status?: string; // active | planned | dormant | retired
  coreAccess?: string;
  auth?: string;
  scaffold?: string;
  testMedium?: string | null;
  designTrack?: string;
}

interface LedgerCell {
  state?: string; // delivered | planned | omitted | n/a
  bet?: string;
  ref?: string;
  rationale?: string;
}

interface Capability {
  key: string;
  name?: string;
  cells?: Record<string, LedgerCell>;
}

interface SurfacesFile {
  schema?: string;
  version?: number;
  core?: { deployment?: string; contractFormat?: string; contractsPath?: string };
  surfaces?: Surface[];
  capabilities?: Capability[];
}

function readSurfacesFile(): SurfacesFile | null {
  if (!fs.existsSync(GROUNDWORK_SURFACES_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(GROUNDWORK_SURFACES_FILE, 'utf8')) as SurfacesFile;
  } catch {
    throw new CliError(
      `Could not parse ${path.relative(ROOT, GROUNDWORK_SURFACES_FILE)}`,
      'Fix or remove the malformed JSON file — docs/surfaces.md is its human twin.',
    );
  }
}

function isRetired(s: Surface): boolean {
  return s.status === 'retired';
}

/** One painted character per ledger state. A missing or unknown state renders as
 *  the illegal empty cell — loud on purpose: bet validation fills every column. */
function cellGlyph(p: Painter, state: string | undefined): string {
  const u = p.caps.unicode;
  if (state === 'delivered') return p.paint('success', u ? '●' : '*');
  if (state === 'planned') return p.paint('warning', u ? '◐' : '~');
  if (state === 'omitted') return p.dim(u ? '○' : 'o');
  if (state === 'n/a') return p.dim(u ? '·' : '.');
  return p.paint('error', '!');
}

/** Planned-cell counts per non-retired surface — the sync backlog at a glance.
 *  Retired columns are frozen history and never count as backlog. */
function backlogOf(surfaces: Surface[], capabilities: Capability[]): Record<string, number> {
  const backlog: Record<string, number> = {};
  for (const s of surfaces) {
    if (!isRetired(s)) backlog[s.slug] = 0;
  }
  for (const cap of capabilities) {
    for (const slug of Object.keys(backlog)) {
      if (cap.cells?.[slug]?.state === 'planned') backlog[slug] += 1;
    }
  }
  return backlog;
}

/** Cells that are missing or carry an unknown state — the machine form of the
 *  illegal empty ledger cell. Every registry surface gets a column, retired
 *  included (frozen history or auto-n/a per the retired-column rule). */
function illegalCellsOf(surfaces: Surface[], capabilities: Capability[]): string[] {
  const states = new Set(['delivered', 'planned', 'omitted', 'n/a']);
  const out: string[] = [];
  for (const cap of capabilities) {
    for (const s of surfaces) {
      const cell = cap.cells?.[s.slug];
      if (!cell || !cell.state || !states.has(cell.state)) {
        out.push(`${cap.key} × ${s.slug}`);
      }
    }
  }
  return out;
}

/** Pad to a visible width, ANSI-safe: pad the plain text, then paint — painted
 *  strings defeat padEnd (the table comment in bet.ts explains why). */
function padPlain(text: string, width: number): string {
  return text.padEnd(width);
}

export async function surfaceCmd(ctx: Ctx): Promise<number> {
  const noun = ctx.args.filter((a) => !a.startsWith('-'))[0] ?? 'status';
  switch (noun) {
    case 'status':
      return status(ctx);
    default:
      throw new CliError('Usage: ./dev surface status [--json]');
  }
}

async function status(ctx: Ctx): Promise<number> {
  const { r } = ctx;
  const json = ctx.json || ctx.args.includes('--json');
  const file = readSurfacesFile();
  const ro = r.asStream(process.stdout);

  if (!file) {
    if (json) {
      process.stdout.write(JSON.stringify({ present: false }, null, 2) + '\n');
      return 0;
    }
    ro.info('No surface registry (.groundwork/surfaces.json) — run the groundwork-update lane; its Surfaces registry family re-derives it.');
    return 0;
  }

  const surfaces = (file.surfaces ?? []).filter((s) => Boolean(s.slug));
  const capabilities = (file.capabilities ?? []).filter((c) => Boolean(c.key));
  const backlog = backlogOf(surfaces, capabilities);
  const illegalCells = illegalCellsOf(surfaces, capabilities);

  if (json) {
    process.stdout.write(
      JSON.stringify({ present: true, core: file.core ?? null, surfaces, capabilities, backlog, illegalCells }, null, 2) + '\n',
    );
    return 0;
  }

  const p = ro.painter;
  ro.logo('Surface Board');

  // --- Registry: slug, type, platform, status, scaffold, test medium ---------
  ro.table(
    'Surface Registry',
    surfaces.map((s) => {
      const slug = isRetired(s) ? p.dim(padPlain(`${s.slug} (retired)`, 28)) : padPlain(s.slug, 28);
      const shape = `${s.type ?? '?'} · ${s.platform ?? '?'}`;
      const detail = `${s.status ?? '?'} · ${s.scaffold ?? '?'} · ${s.testMedium ?? '—'}`;
      return [slug, shape, detail] as [string, string, string];
    }),
  );
  if (surfaces.length === 0) {
    ro.info('Registry is empty — a headless core is legal; its contracts stand alone.');
  }

  // --- Capability ledger: rows × surface columns -----------------------------
  if (capabilities.length === 0) {
    ro.info('Capability ledger is empty — bet validation appends capability rows when bets close.');
  } else {
    const keyWidth = Math.max(...capabilities.map((c) => c.key.length), 'capability'.length) + 2;
    const colWidth = (s: Surface): number => (isRetired(s) ? s.slug.length + ' (retired)'.length : s.slug.length) + 2;
    const header =
      p.dim(padPlain('capability', keyWidth)) +
      surfaces
        .map((s) => (isRetired(s) ? p.dim(padPlain(`${s.slug} (retired)`, colWidth(s))) : padPlain(s.slug, colWidth(s))))
        .join('');
    const rows: Array<[string, string, string]> = [[header, '', '']];
    for (const cap of capabilities) {
      const line =
        padPlain(cap.key, keyWidth) +
        surfaces
          .map((s) => cellGlyph(p, cap.cells?.[s.slug]?.state) + ' '.repeat(colWidth(s) - 1))
          .join('');
      rows.push([line, '', '']);
    }
    ro.table('Capability Ledger', rows);
    const u = p.caps.unicode;
    ro.info(
      `${cellGlyph(p, 'delivered')} delivered  ${cellGlyph(p, 'planned')} planned  ${cellGlyph(p, 'omitted')} omitted  ${cellGlyph(p, 'n/a')} n/a  ${p.paint('error', '!')} empty ${u ? '—' : '-'} illegal`,
    );
  }

  // --- Illegal empty cells: a real signal, never hidden -----------------------
  for (const cell of illegalCells) {
    ro.error(`Empty ledger cell: ${cell} — illegal state; bet validation fills every column or the bet does not close.`);
  }

  // --- Sync backlog: planned cells per active surface -------------------------
  const entries = Object.entries(backlog);
  if (entries.length > 0 && capabilities.length > 0) {
    ro.step('Sync backlog (planned cells)');
    for (const [slug, count] of entries) {
      ro.cmd(slug, count === 0 ? 'in sync — no planned cells' : `${count} planned cell${count === 1 ? '' : 's'}`);
    }
    const total = entries.reduce((acc, [, n]) => acc + n, 0);
    if (total === 0 && illegalCells.length === 0) {
      ro.success('All surfaces in sync — every ledger decision is on record.');
    }
  }

  return 0;
}
