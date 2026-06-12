// Bundles the ./dev CLI source into a single zero-runtime-dependency file that the
// workspace-dev-cli generator copies verbatim into generated projects.
//
// The output is intentionally written OUTSIDE the generator's `files/` directory so it
// never passes through Nx's EJS templating (a bundle can contain `<%` in strings/regexes
// that EJS would corrupt). generator.ts reads dist/dev-bundle.js and writes it raw.
//
// Run from the repo root: `npm run build:dev-cli`.

import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Embed the package version so the deployed bundle knows its vintage (./dev --version,
// doctor's framework-alignment check). NOTE: this makes the committed bundle
// version-dependent — rebuild it after every `npm version` bump (the bundle-freshness
// contract test fails the release gates if you forget).
const PKG_VERSION = JSON.parse(
  fs.readFileSync(path.join(here, '..', '..', '..', '..', 'package.json'), 'utf8'),
).version;

// Default writes the committed bundle. Tests set DEV_CLI_OUTFILE to a temp path to
// build a fresh bundle without mutating the working tree, then diff it against the
// committed one (the freshness contract) — sharing this one esbuild config.
const outfile = process.env.DEV_CLI_OUTFILE || path.join(here, 'dist', 'dev-bundle.js');

await build({
  entryPoints: [path.join(here, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile,
  legalComments: 'none',
  logLevel: 'info',
  define: { 'process.env.GW_DEV_CLI_VERSION': JSON.stringify(PKG_VERSION) },
});

console.log(`Built ${outfile}`);
