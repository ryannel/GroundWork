// Holds features to the design system: feature CSS may only shrink in how much it styles looks,
// feature components may only lose raw controls, and copied CSS rules may only go down.
// Run with --update after moving a feature onto src/ui, to lock in the gain.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  compare,
  controlCount,
  type Counts,
  countsOf,
  duplicateGroups,
  visualCount,
} from './design-drift-rules';

const FEATURES = 'src/features';
const BASELINE = 'tools/design-drift.baseline.json';

function featureFiles(): string[] {
  return readdirSync(FEATURES, { recursive: true, encoding: 'utf8' })
    .map((file) => path.join(FEATURES, file).replaceAll('\\', '/'))
    .toSorted((a, b) => a.localeCompare(b));
}

function nonZero(entries: readonly (readonly [string, number])[]): Record<string, number> {
  return Object.fromEntries(entries.filter(([, count]) => count > 0));
}

function measure(): Counts {
  const files = featureFiles();
  const sheets = Object.fromEntries(
    files
      .filter((file) => file.endsWith('.module.css'))
      .map((file) => [file, readFileSync(file, 'utf8')]),
  );
  const components = files.filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'));
  return {
    visual: nonZero(Object.entries(sheets).map(([file, css]) => [file, visualCount(css)])),
    controls: nonZero(components.map((file) => [file, controlCount(readFileSync(file, 'utf8'))])),
    duplicates: duplicateGroups(sheets).length,
  };
}

const now = measure();

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify(now, undefined, 2)}\n`);
  console.log(`Design drift baseline written to ${BASELINE}.`);
} else {
  const baseline = countsOf(JSON.parse(readFileSync(BASELINE, 'utf8')));
  const { worse, better } = compare(baseline, now);
  for (const line of better) console.log(`better  ${line}`);
  for (const line of worse) console.error(`worse   ${line}`);
  if (worse.length > 0) {
    console.error(
      '\nFeatures must use src/ui for how things look: buttons, fields, lists, text and colour.' +
        '\nAdd or extend a primitive in src/ui rather than styling a feature. See docs/architecture.md.',
    );
    process.exitCode = 1;
  } else if (better.length > 0) {
    console.log(
      '\nLess drift than the baseline. Run npm run design:drift -- --update to lock it in.',
    );
  } else {
    console.log('No new design drift.');
  }
}
