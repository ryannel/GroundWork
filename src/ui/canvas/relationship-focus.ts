import type { ConnectedCanvasEdge } from '@/ui/connected-canvas-types';

export type ConnectionDirection = 'both' | 'incoming' | 'outgoing';

function portMatches(edge: ConnectedCanvasEdge, endpoint: string | undefined): boolean {
  if (endpoint === undefined || endpoint === '') return true;
  return (
    edge.surfaceId === endpoint ||
    edge.endpointId === endpoint ||
    edge.relations?.some((relation) => relation.endpointId === endpoint) === true
  );
}

function hasParticipant(edge: ConnectedCanvasEdge, selected: string, side: 'from' | 'to'): boolean {
  const usage = side === 'from' ? 'usageFrom' : 'usageTo';
  if ((edge.relations?.length ?? 0) > 0) {
    return (
      edge.relations?.some((relation) => (relation[usage] ?? relation[side]) === selected) === true
    );
  }
  return (edge[usage] ?? edge[side]) === selected;
}

export function matchesConnection(
  edge: ConnectedCanvasEdge,
  focus: {
    readonly selected?: string | undefined;
    readonly endpoint?: string | undefined;
    readonly direction: ConnectionDirection;
  },
): boolean {
  if (focus.selected === undefined) return true;
  const outgoing = hasParticipant(edge, focus.selected, 'from');
  const incoming = hasParticipant(edge, focus.selected, 'to') && portMatches(edge, focus.endpoint);
  if (edge.directed === false) {
    return (
      focus.direction === 'both' && (outgoing || incoming) && portMatches(edge, focus.endpoint)
    );
  }
  return (
    (focus.direction !== 'incoming' && outgoing) || (focus.direction !== 'outgoing' && incoming)
  );
}
