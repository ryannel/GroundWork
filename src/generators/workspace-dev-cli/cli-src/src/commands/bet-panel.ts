import * as fs from 'fs';
import * as path from 'path';
import { ROOT } from '../util/paths';
import { Renderer } from '../theme/render';

const ACTIVE_LANE_FILE = path.join(ROOT, '.groundwork', 'cache', 'active-lane');

function boardPath(slug: string): string {
  return path.join(ROOT, '.groundwork', 'cache', 'bets', slug, 'board.yaml');
}

function memlogPath(slug: string): string {
  return path.join(ROOT, '.groundwork', 'cache', 'bets', slug, 'memlog.md');
}

export interface BetPanelSlice {
  key: string;
  status: string;
}

export interface BetPanelModel {
  slug: string;
  stepPhrase: string;
  slices: BetPanelSlice[];
  lastEvent: string | null;
}

// Owner-safe phrasing for `board.yaml`'s `step` pointer (04-delivery.md's
// step-router table) — plain language, never the file/step-slug jargon.
const STEP_PHRASES: Record<string, string> = {
  'step-01-readiness': 'getting ready',
  'step-02-slice-loop': 'building slices',
  'step-03-milestone-close': 'proving the milestone',
  'step-04-postmortem': 'wrapping up the milestone',
};

function stripComment(value: string): string {
  const i = value.indexOf('#');
  return (i === -1 ? value : value.slice(0, i)).trim();
}

interface ParsedMilestone {
  n: number;
  slices: BetPanelSlice[];
}

/** A defensive, line-based `board.yaml` reader — no YAML dependency, matching
 *  `lib/bet-state/compose.js`'s `readBoard` (extended to the milestones/slices
 *  shape this panel needs). The board is cache-tier and never a gate
 *  (04-delivery.md) — a shape this doesn't recognize degrades to "nothing
 *  parsed" rather than throwing; the caller treats that as absent. */
function parseBoard(text: string): { step: string | null; milestones: ParsedMilestone[] } {
  let step: string | null = null;
  const milestones: ParsedMilestone[] = [];
  let currentMilestone: ParsedMilestone | null = null;
  let currentSlice: BetPanelSlice | null = null;
  let inMilestones = false;

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Top-level key (no leading indent) — bet/track/mode/step/approved/updated/milestones.
    if (!/^\s/.test(line)) {
      const m = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
      if (m) {
        const [, key, val] = m;
        if (key === 'step') step = stripComment(val) || null;
        inMilestones = key === 'milestones';
        currentMilestone = null;
        currentSlice = null;
      }
      continue;
    }
    if (!inMilestones) continue;

    // "  - n: <N>" — a milestone list entry.
    const milestoneMatch = /^\s{2}-\s*n:\s*(\d+)/.exec(line);
    if (milestoneMatch) {
      currentMilestone = { n: parseInt(milestoneMatch[1], 10), slices: [] };
      milestones.push(currentMilestone);
      currentSlice = null;
      continue;
    }
    if (!currentMilestone) continue;

    // "      - key: <slice-key>" — a slice list entry, nested under "slices:".
    const sliceMatch = /^\s{6}-\s*key:\s*(.+)$/.exec(line);
    if (sliceMatch) {
      currentSlice = { key: stripComment(sliceMatch[1]), status: 'unknown' };
      currentMilestone.slices.push(currentSlice);
      continue;
    }
    if (!currentSlice) continue;

    // "        status: <state>" — applies to the current slice.
    const statusMatch = /^\s{8}status:\s*(.+)$/.exec(line);
    if (statusMatch) currentSlice.status = stripComment(statusMatch[1]);
  }

  return { step, milestones };
}

/** Read the active-lane sentinel, its board.yaml, and the last memlog line.
 *  Fail-silent at every step — a missing sentinel, missing/corrupt board, or
 *  an unrecognized `step` value all return null, so callers render nothing
 *  rather than a guess (this slice's fail-silent acceptance bar: no
 *  sentinel/board/parse error → output byte-identical to today). */
export function loadBetPanel(): BetPanelModel | null {
  try {
    if (!fs.existsSync(ACTIVE_LANE_FILE)) return null;
    const slug = fs.readFileSync(ACTIVE_LANE_FILE, 'utf8').trim();
    if (!slug) return null;

    const bPath = boardPath(slug);
    if (!fs.existsSync(bPath)) return null;
    const { step, milestones } = parseBoard(fs.readFileSync(bPath, 'utf8'));
    if (!step || !(step in STEP_PHRASES) || milestones.length === 0) return null;

    const current = milestones.reduce<ParsedMilestone | null>(
      (max, m) => (max === null || m.n > max.n ? m : max),
      null,
    );
    if (!current) return null;

    let lastEvent: string | null = null;
    try {
      const lines = fs
        .readFileSync(memlogPath(slug), 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      lastEvent = lines.length > 0 ? lines[lines.length - 1] : null;
    } catch {
      lastEvent = null;
    }

    return { slug, stepPhrase: STEP_PHRASES[step], slices: current.slices, lastEvent };
  } catch {
    return null;
  }
}

/** A slice's state glyph, reusing the themed symbol vocabulary rather than a
 *  bespoke one — `done`/`blocked` map to the success/error roles a user
 *  already reads elsewhere in `./dev` output; the in-flight states share the
 *  warning role; anything else (including a status this parser didn't
 *  recognize) renders as a muted placeholder rather than guessing. */
function glyphFor(r: Renderer, status: string): string {
  switch (status) {
    case 'done':
      return r.painter.paint('success', r.symbol('success'));
    case 'blocked':
      return r.painter.paint('error', r.symbol('error'));
    case 'in-progress':
    case 'review':
    case 'patching':
      return r.painter.paint('warning', r.symbol('warning'));
    default:
      return r.painter.dim(r.symbol('info'));
  }
}

/** Render the bet-board panel after the existing status tables (E5). A no-op
 *  when `loadBetPanel()` finds nothing — the fail-silent contract lives here
 *  so every call site (status, each --watch frame) gets it for free. */
export function renderBetPanel(r: Renderer): void {
  const model = loadBetPanel();
  if (!model) return;
  r.table(
    `Bet: ${model.slug} — ${model.stepPhrase}`,
    model.slices.map(
      (s) => [s.key, '', '', `${glyphFor(r, s.status)} ${s.status}`] as [string, string, string, string],
    ),
  );
  if (model.lastEvent) {
    r.info(`Last event: ${model.lastEvent}`);
  }
}

/** The additive `--json` `bet` key (E5) — null when the lane isn't active or
 *  the board didn't parse, so callers can splice it in only when present and
 *  leave every existing key untouched. */
export function betPanelJson(): Record<string, unknown> | null {
  const model = loadBetPanel();
  if (!model) return null;
  return {
    slug: model.slug,
    step: model.stepPhrase,
    slices: model.slices.map((s) => ({ key: s.key, status: s.status })),
    lastEvent: model.lastEvent,
  };
}
