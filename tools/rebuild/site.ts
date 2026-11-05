// The proof reads a production server and always stops the server it owns.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address === null || typeof address === 'string') reject(new Error('No port.'));
        else resolve(address.port);
      });
    });
  });
}

export async function withSite<T>(
  origin: string | undefined,
  read: (at: string) => Promise<T>,
): Promise<T> {
  if (origin !== undefined) return read(origin);
  const port = await freePort();
  const at = `http://127.0.0.1:${String(port)}`;
  const site = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--port', String(port), '--hostname', '127.0.0.1'],
    {
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
  const failures: Error[] = [];
  site.on('error', (error: Error) => {
    failures.push(error);
  });
  try {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const failure = failures[0];
      if (failure !== undefined) throw failure;
      if (site.exitCode !== null) {
        throw new Error('The production server stopped. Run npm run build first.');
      }
      const response = await fetch(at).catch(() => null);
      if (response !== null) return await read(at);
      await sleep(250);
    }
    throw new Error('The production server did not start. Run npm run build first.');
  } finally {
    site.kill();
    if (site.exitCode === null) {
      await new Promise<void>((resolve) => {
        site.once('exit', () => {
          resolve();
        });
      });
    }
  }
}
