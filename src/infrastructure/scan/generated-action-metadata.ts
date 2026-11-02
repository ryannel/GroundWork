import 'server-only';

import { parse } from 'yaml';
import { z } from 'zod';

const actionSchema = z.object({ runs: z.object({ using: z.string(), main: z.string() }) });
const packageSchema = z.object({
  scripts: z.object({ build: z.literal('rimraf dist && rolldown -c') }),
  devDependencies: z.object({ rolldown: z.string().min(1) }),
});

/** Validate bounded pinned declarations; this does not execute a build. */
export function generatedActionMetadata(
  actionText: string,
  packageText: string,
): { readonly using: string; readonly main: string } | undefined {
  const action = actionSchema.safeParse(parse(actionText));
  const manifest = packageSchema.safeParse(JSON.parse(packageText));
  return action.success && manifest.success ? action.data.runs : undefined;
}

const nccPackage = z.object({
  scripts: z.object({ build: z.string() }),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

function nccBuilder(manifest: z.infer<typeof nccPackage>): boolean {
  const version =
    manifest.devDependencies?.['@vercel/ncc'] ?? manifest.dependencies?.['@vercel/ncc'];
  return version !== undefined && /^\d+\.\d+\.\d+$/u.test(version);
}

function nccRecipe(build: string): { readonly input: string; readonly main: string } | undefined {
  const recipe = /^ncc build ([\w/-]+\.[cm]?[jt]s) -o (dist(?:\/[\w-]+)?)$/u.exec(build);
  const input = recipe?.[1];
  const output = recipe?.[2];
  if (input === undefined || output === undefined) return undefined;
  if (input.startsWith('/') || input.startsWith('-')) return undefined;
  if (input.split('/').includes('dist')) return undefined;
  return { input, main: `${output}/index.js` };
}

/** Only a closed static NCC recipe; no shell expansion, extra command or build execution. */
export function nccActionMetadata(
  actionText: string,
  packageText: string,
): { readonly using: string; readonly main: string; readonly input: string } | undefined {
  const action = actionSchema.safeParse(parse(actionText));
  const manifest = nccPackage.safeParse(JSON.parse(packageText));
  if (!action.success || !manifest.success) return undefined;
  if (!nccBuilder(manifest.data)) return undefined;
  const recipe = nccRecipe(manifest.data.scripts.build);
  if (recipe === undefined) return undefined;
  if (!/^node(?:20|24)$/u.test(action.data.runs.using)) return undefined;
  return action.data.runs.main === recipe.main
    ? { ...action.data.runs, input: recipe.input }
    : undefined;
}
