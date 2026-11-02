import { Button } from './button';
import type { ConnectionDirection } from './canvas/relationship-focus';
import type { ConnectedCanvasEdge } from './connected-canvas-types';
import { Cluster } from './stack';
import { Text } from './text';

interface ToolbarProps {
  readonly direction: ConnectionDirection;
  readonly handleDirection: (direction: ConnectionDirection) => void;
  readonly zoom: number;
  readonly fullscreen: boolean;
  readonly kinds: ReadonlySet<ConnectedCanvasEdge['kind']>;
  readonly hasMembership: boolean;
  readonly detail: 'grouped' | 'all';
  readonly canChangeDetail: boolean;
  readonly handleZoom: (factor: number) => void;
  readonly handleFit: () => void;
  readonly handleFocus: () => void;
  readonly handleFullscreen: () => void;
  readonly handleKind: (kind: ConnectedCanvasEdge['kind']) => void;
  readonly handleDetail: () => void;
  readonly handleReset: () => void;
  readonly selection: boolean;
  readonly isolated: boolean;
  readonly handleIsolate: () => void;
  /** Calls to shared platform services, when there are any to show. */
  readonly platform: { readonly shown: boolean; readonly count: number } | undefined;
  readonly handlePlatform: () => void;
}
function RelationshipControls({
  kinds,
  hasMembership,
  canChangeDetail,
  detail,
  handleKind,
  handleDetail,
  handleReset,
  selection,
  isolated,
  handleIsolate,
  direction,
  handleDirection,
  platform,
  handlePlatform,
}: ToolbarProps) {
  const filters = [
    ['api', 'API'],
    ['message', 'Events'],
    ['data', 'Data'],
  ] as const;
  return (
    <Cluster gap={1} label="Relationship filters">
      {[...filters, ...(hasMembership ? [['membership', 'Membership'] as const] : [])].map(
        ([kind, name]) => (
          <Button
            key={kind}
            label={`${kinds.has(kind) ? 'Hide' : 'Show'} ${name.toLowerCase()} relationships`}
            onClick={() => {
              handleKind(kind);
            }}
            pressed={kinds.has(kind)}
            size="sm"
          >
            {name}
          </Button>
        ),
      )}
      {platform === undefined ? null : (
        <Button
          label={`${platform.shown ? 'Hide' : 'Show'} ${String(platform.count)} calls to platform services such as feature flags and sign-in`}
          onClick={handlePlatform}
          pressed={platform.shown}
          size="sm"
        >
          Platform {platform.count}
        </Button>
      )}
      {canChangeDetail ? (
        <Button
          label={detail === 'grouped' ? 'Show all calls' : 'Group related calls'}
          onClick={handleDetail}
          pressed={detail === 'all'}
          size="sm"
        >
          {detail === 'grouped' ? 'Grouped' : 'All calls'}
        </Button>
      ) : null}
      {selection ? (
        <Cluster gap={1} label="Connection direction">
          {(
            [
              ['both', 'Both'],
              ['incoming', 'Used by'],
              ['outgoing', 'Depends on'],
            ] as const
          ).map(([value, name]) => (
            <Button
              key={value}
              pressed={direction === value}
              size="sm"
              onClick={() => {
                handleDirection(value);
              }}
            >
              {name}
            </Button>
          ))}
          <Button
            label="Only selected connections"
            onClick={handleIsolate}
            pressed={isolated}
            size="sm"
          >
            {isolated ? 'Show context' : 'Connections only'}
          </Button>
        </Cluster>
      ) : null}
      <Button label="Reset canvas view" onClick={handleReset} size="sm" variant="quiet">
        Reset
      </Button>
    </Cluster>
  );
}

export function CanvasNavigation({
  zoom,
  fullscreen,
  handleZoom,
  handleFit,
  handleFullscreen,
  selection = false,
  handleFocus,
}: Pick<ToolbarProps, 'zoom' | 'fullscreen' | 'handleZoom' | 'handleFit' | 'handleFullscreen'> & {
  readonly selection?: boolean;
  readonly handleFocus?: () => void;
}) {
  return (
    <Cluster gap={1}>
      <Button
        label="Zoom out"
        onClick={() => {
          handleZoom(1 / 1.2);
        }}
        size="sm"
      >
        −
      </Button>
      <Text mono size="sm">
        {Math.round(zoom * 100)}%
      </Text>
      <Button
        label="Actual size"
        onClick={() => {
          handleZoom(1 / zoom);
        }}
        size="sm"
      >
        100%
      </Button>
      <Button
        label="Zoom in"
        onClick={() => {
          handleZoom(1.2);
        }}
        size="sm"
      >
        +
      </Button>
      <Button onClick={handleFit} size="sm">
        Fit map
      </Button>
      {selection ? (
        <Button onClick={() => handleFocus?.()} size="sm">
          Focus selection
        </Button>
      ) : null}
      <Button
        label={fullscreen ? 'Exit full screen' : 'Full screen'}
        onClick={handleFullscreen}
        size="sm"
      >
        {fullscreen ? 'Exit full screen' : 'Full screen'}
      </Button>
    </Cluster>
  );
}

export function CanvasToolbar({
  zoom,
  fullscreen,
  handleZoom,
  handleFit,
  handleFocus,
  handleFullscreen,
  ...relationshipProps
}: ToolbarProps) {
  return (
    <Cluster label="Diagram navigation" spread>
      <CanvasNavigation
        zoom={zoom}
        fullscreen={fullscreen}
        handleZoom={handleZoom}
        handleFit={handleFit}
        handleFullscreen={handleFullscreen}
        selection={relationshipProps.selection}
        handleFocus={handleFocus}
      />
      <RelationshipControls
        {...relationshipProps}
        fullscreen={fullscreen}
        handleFit={handleFit}
        handleFocus={handleFocus}
        handleFullscreen={handleFullscreen}
        handleZoom={handleZoom}
        zoom={zoom}
      />
    </Cluster>
  );
}
