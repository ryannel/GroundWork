import type { ModelScope } from '@/application/model-scope';
import type { Model } from '@/application/plan/derive';
import { mapScopeOf } from '@/application/today-scope';
import { targetMapInput } from '@/application/workspace-target-map';
import type { Workspace } from '@/domain/workspace';
import type { TargetArchitecture } from '@/domain/workspace-model';
import { SystemMapView } from '@/features/plan/viz/system-map/system-map.client';

interface TargetMapProps {
  readonly model: Model;
  readonly workspace: Workspace;
  readonly scope: ModelScope;
  readonly target: TargetArchitecture;
}

// A domain's target architecture as a system map: its stages left to right, each holding the systems that should
// own it. Systems of other domains are dotted, and say where they live.
export function TargetMap({ model, workspace, scope, target }: TargetMapProps) {
  const input = targetMapInput(model, target, mapScopeOf(workspace, scope));
  if (input.services.length === 0) return null;
  return <SystemMapView flow input={input} outside="outside this domain" />;
}
