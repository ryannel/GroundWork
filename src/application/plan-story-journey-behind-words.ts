import type { Model } from '@/application/plan/derive';
import { countWord, numWord } from '@/application/plan-viz-text';
import type { WaterfallFacts } from '@/application/plan-viz-waterfall-facts';
import type { Operation } from '@/domain/plan/plan.generated';

// What the reader asks for, as a place on a screen, and how long that place takes to show.

const lower = (text: string): string =>
  /^[A-Z][a-z]/.test(text) ? `${text[0]?.toLowerCase() ?? ''}${text.slice(1)}` : text;

/** "the product page", or "the reviews on the product page" when the operation serves one of several regions. */
function whereOf(model: Model, op: Operation): { phrase: string; region: string | null } {
  const refs = op.screens ?? [];
  const id = refs[0]?.split('#')[0];
  const screen = model.asIs.screens.find((s) => s.id === id);
  if (screen === undefined) return { phrase: 'the page', region: null };
  const name = lower(screen.name);
  const isPage = screen.kind === undefined || screen.kind === 'page';
  const named = isPage && !/\b(page|screen|view)$/i.test(name) ? `${name} page` : name;
  const regions = refs.filter((r) => r.includes('#'));
  const [only] = regions;
  if (regions.length === 1 && only !== undefined && screen.regions.length > 1)
    return { phrase: `the ${lower(model.label(only))} on the ${named}`, region: model.label(only) };
  return { phrase: `the ${named}`, region: only === undefined ? null : model.label(only) };
}

function hitLayerText(model: Model, facts: WaterfallFacts): string {
  if (facts.hitLayer === null) return `${facts.hitLayerName} cache`;
  return `${lower(model.label(facts.hitLayer).replace(/ cache$/i, ''))} cache`;
}

const across = (teams: number): string => `${numWord(teams)} ${teams === 1 ? 'team' : 'teams'}`;

/** What a place on a screen costs: in milliseconds when the plan measured them, else in round trips and teams. */
export function behindHeadline(model: Model, op: Operation, facts: WaterfallFacts): string {
  const { plan } = facts;
  if (plan === null) return `${op.name} has no query plan.`;
  const teams = across(plan.teams.length);
  const trips = countWord(plan.roundTrips, 'round trip');
  const where = whereOf(model, op);
  if (plan.kind === 'mutation')
    return `${where.region ?? op.name} is never cached: it takes ${trips} across ${teams}, every time.`;
  const shows = `Showing ${where.phrase} takes`;
  const { layerHit, layerCold } = facts;
  if (facts.layerObserved && layerHit !== null && layerCold !== null)
    return `${shows} ${String(layerHit)} ms when the ${hitLayerText(model, facts)} has it and about ${String(layerCold)} ms when nothing does.`;
  if (facts.layerObserved && layerCold !== null)
    return `${shows} about ${String(layerCold)} ms, across ${teams}.`;
  const priv =
    facts.policy?.scope === 'private' ? ' It is private, so the edge never keeps it.' : '';
  return `${shows} ${trips} across ${teams}.${priv}`;
}
