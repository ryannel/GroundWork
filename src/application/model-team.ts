import type { ModelIndex } from '@/application/model-index';

/** The existing 1–13 palette: a valid authored colour, else the team's stable 1–12 order; unknown is 8. */
export function modelTeamSlotOf(index: ModelIndex, teamId: string | null | undefined): number {
  const team = index.get(teamId ?? '');
  const colour = Number(team?.data.colour);
  if (Number.isInteger(colour) && colour >= 1 && colour <= 13) return colour;
  const at = (index.model.teams ?? []).findIndex((candidate) => candidate.id === team?.id);
  return at === -1 ? 8 : (at % 12) + 1;
}
