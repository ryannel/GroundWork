import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { parse } from 'yaml';

import { migrateModel, validateMigratedOutput } from './migrate-model/runner';

const { values } = parseArgs({
  options: {
    workspace: { type: 'string' },
    out: { type: 'string' },
    report: { type: 'string' },
    accept: { type: 'string', multiple: true },
    'validate-output': { type: 'string' },
  },
});
if (values['validate-output'] === undefined) {
  if (values.workspace === undefined || values.out === undefined || values.report === undefined) {
    throw new Error(
      'Use --workspace <folder> --out <new copy> --report <folder> [--accept <review file>].',
    );
  }
  const accepted = await Promise.all(
    (values.accept ?? []).map(async (file): Promise<unknown> =>
      parse(await readFile(file, 'utf8')),
    ),
  );
  const result = await migrateModel({
    workspace: values.workspace,
    out: values.out,
    report: values.report,
    accepted,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'ready') process.exitCode = 1;
} else {
  console.log(JSON.stringify(await validateMigratedOutput(values['validate-output'])));
}
