// An adapter that spawns a child and then hangs. Killing the adapter must kill
// the child with it, or a battery that gave up would leave the machine busy.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const project = process.argv[3];
const marker = join(project, 'groundwork-forked-child');

const child = spawn(
  process.execPath,
  ['-e', 'setInterval(() => {}, 1000)', marker],
  { stdio: 'ignore' },
);

writeFileSync(marker, String(child.pid));

setTimeout(() => {}, 60_000);
