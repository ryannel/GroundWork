'use client';

import { createContext, Suspense, use, type ReactNode } from 'react';

import { useLens } from './lens.client';

// A page drawn once for everyone, cut to a team on the client: each part names the teams that see it, and the
// lens hides the rest. Unlike ByLens, nothing is drawn twice, so the file stays the size of one cut.

const Known = createContext<readonly string[]>([]);

/** The team in the address, as the page names it, or null for everyone or a team the page does not know. */
function useTeam(): string | null {
  const lens = useLens();
  const known = use(Known);
  if (lens === null) return null;
  return [lens, `team:${lens}`].find((id) => known.includes(id)) ?? null;
}

/** The entry `byTeam` holds for the team in the address, or undefined for everyone. */
export function usePick<T>(byTeam: Readonly<Record<string, T>>): T | undefined {
  const lens = useLens();
  if (lens === null) return undefined;
  const key = [lens, `team:${lens}`].find((id) => Object.hasOwn(byTeam, id));
  return key === undefined ? undefined : byTeam[key];
}

interface LensTeamsProps {
  readonly children: ReactNode;
  /** The teams a lens can name. A lens on any other shows everything. */
  readonly teams: readonly string[];
}

/** Names the teams the parts below can be cut to. */
export function LensTeams({ children, teams }: LensTeamsProps) {
  return <Known value={teams}>{children}</Known>;
}

interface ForTeamsProps {
  readonly children: ReactNode;
  /** The teams who see the children. */
  readonly teams: readonly string[];
  /** Whether the children show with no team in the address. */
  readonly everyone?: boolean;
}

function Seen({ children, teams, everyone = true }: ForTeamsProps): ReactNode {
  const team = useTeam();
  const shown = team === null ? everyone : teams.includes(team);
  return shown ? children : null;
}

/** Its children for everyone and for the teams named; hidden while the address names another team. */
export function ForTeams({ children, teams, everyone = true }: ForTeamsProps) {
  return (
    <Suspense fallback={everyone ? children : null}>
      <Seen everyone={everyone} teams={teams}>
        {children}
      </Seen>
    </Suspense>
  );
}

interface LensCountProps {
  /** The count for everyone. */
  readonly everyone: number;
  /** The count for each team that has any; a known team missing here counts none. */
  readonly teams: Readonly<Record<string, number>>;
  readonly one: string;
  readonly many: string;
}

function Counted({ everyone, teams, one, many }: LensCountProps) {
  const team = useTeam();
  const n = team === null ? everyone : (teams[team] ?? 0);
  return `${String(n)} ${n === 1 ? one : many}`;
}

/** A count that follows the lens. */
export function LensCount(props: LensCountProps) {
  const { everyone, one, many } = props;
  return (
    <Suspense fallback={`${String(everyone)} ${everyone === 1 ? one : many}`}>
      <Counted {...props} />
    </Suspense>
  );
}
