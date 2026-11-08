// The original inventory stays frozen. Replay its capture from Groundwork commit 329dc9f2.
import { checkExplorerRetirement } from './rebuild/explorer-retirement';

if (!(await checkExplorerRetirement())) process.exitCode = 1;
