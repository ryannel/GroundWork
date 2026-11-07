import type { ModelQueryContext } from '@/application/model-reader';
import { assetUrl } from '@/application/plan-viz-screens';
import { workspaceHref } from '@/application/workspace-paths';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

export interface ModelAsset {
  readonly file: string | null;
  readonly figma: string | null;
  readonly region: string | null;
  readonly label: string | null;
  readonly href: string | null;
  readonly gap: string | null;
}
function hasFile(value: unknown, file: string): boolean {
  return modelList(value).some((asset) => modelRecord(asset)?.file === file);
}
function selectedAsset(context: ModelQueryContext, id: string, file: string): boolean {
  const operations = (context.plan?.changes ?? []).flatMap((change) => change.ops ?? []);
  return operations.some((op) => {
    if ('add' in op && op.add === 'screen' && op.value.id === id) {
      return hasFile(modelRecord(op.value)?.assets, file);
    }
    if (!('modify' in op) || op.modify !== id) return false;
    return (
      hasFile(modelRecord(op.set)?.assets, file) || hasFile(modelRecord(op.append)?.assets, file)
    );
  });
}
function fileLocation(
  context: ModelQueryContext,
  id: string,
  file: string,
  version: 'before' | 'after',
  planBase: string | undefined,
): Pick<ModelAsset, 'href' | 'gap'> {
  if (file.startsWith('data:') || file.includes('://') || file.startsWith('//')) {
    return { href: file, gap: null };
  }
  if (version === 'after' && selectedAsset(context, id, file)) {
    return planBase === undefined
      ? { href: null, gap: 'The plan asset location is not recorded.' }
      : { href: assetUrl(planBase, file), gap: null };
  }
  if ((context.plan?.builds_on ?? []).length > 0) {
    return {
      href: null,
      gap: 'The asset is retained, but its workspace or ancestor-plan location is not established in this view.',
    };
  }
  return { href: assetUrl(workspaceHref(context.beforeIndex.model.id), file), gap: null };
}
/** Migration retained literal paths: current files are workspace-relative; selected-plan assignments are plan-relative. */
export function modelAssetsOf(
  context: ModelQueryContext,
  id: string,
  version: 'before' | 'after' = 'after',
  planBase?: string,
): readonly ModelAsset[] {
  const index = version === 'before' ? context.beforeIndex : context.afterIndex;
  const node = index.get(id);
  return modelList(node?.data.assets).map((asset) => {
    const data = modelRecord(asset);
    const file = modelText(data?.file),
      figma = modelText(data?.figma);
    const location =
      file === null
        ? { href: figma, gap: null }
        : fileLocation(context, id, file, version, planBase);
    return {
      file,
      figma,
      region: modelText(data?.region),
      label: modelText(data?.label),
      ...location,
    };
  });
}
