import * as fs from 'fs';
import * as path from 'path';
import { ROOT } from './paths';

/** The GroundWork package version this bundle was built from. Injected by
 *  build.mjs via esbuild `define` so the deployed bundle knows its own vintage —
 *  the upgrade path (./dev doctor, groundwork check) compares it against the
 *  install's framework stamp to flag a trailing bundle. */
export const DEV_CLI_VERSION: string = process.env.GW_DEV_CLI_VERSION || 'unknown';

/** The framework version stamped into this project by groundwork init/update. */
export function stampedFrameworkVersion(): string | null {
  try {
    const state = JSON.parse(
      fs.readFileSync(path.join(ROOT, '.groundwork', 'config', 'state.json'), 'utf8'),
    ) as { groundwork?: { version?: string } };
    return (state.groundwork && state.groundwork.version) || null;
  } catch {
    return null;
  }
}
