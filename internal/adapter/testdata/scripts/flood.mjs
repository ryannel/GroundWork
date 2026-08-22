// An adapter that prints forever. The output cap must cut it off.
import { writeSync } from 'node:fs';

const block = Buffer.alloc(64 * 1024, 0x78);
for (;;) {
  writeSync(1, block);
}
