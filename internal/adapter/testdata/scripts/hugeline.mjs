// An adapter that prints one enormous line with no newline in it. A cap that
// only counted lines would never fire.
import { writeSync } from 'node:fs';

writeSync(1, `{"schema":1,"note":"${'x'.repeat(2 * 1024 * 1024)}"}`);
