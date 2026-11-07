import 'server-only';

import { parse } from 'yaml';

import type { Issue } from '@/application/plan/check-context';
import { pathIn, readText } from '@/infrastructure/disk';

import { workspaceFolder } from './workspace-folders';

// A workspace no folder holds has no plans: its plan folder is a path that is not there.
export async function planFolder(
  root: string | undefined,
  workspace: string,
  slug: string,
): Promise<string> {
  const folder = await workspaceFolder(workspace, root);
  return pathIn(folder ?? pathIn(root ?? '', '.no-such-workspace', workspace), 'plans', slug);
}

export async function readRaw(
  file: string,
): Promise<{ readonly data: unknown } | { readonly error: Issue }> {
  try {
    return {
      data: parse(await readText(file), {
        prettyErrors: true,
        uniqueKeys: true,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: { path: '(root)', message } };
  }
}
