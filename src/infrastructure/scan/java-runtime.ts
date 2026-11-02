import 'server-only';

import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

const managedRuntime = z
  .object({
    format: z.literal('scan-java-runtime/v1'),
    executable: z
      .string()
      .min(1)
      .refine((value) => path.isAbsolute(value), 'Expected an absolute Java executable'),
    version: z.string().regex(/^25(?:[.+-]|$)/u),
    archiveSha256: z.string().regex(/^[a-f\d]{64}$/u),
    source: z.url().refine((value) => {
      const source = new URL(value);
      return (
        source.origin === 'https://github.com' &&
        source.pathname.startsWith('/adoptium/temurin25-binaries/releases/download/')
      );
    }),
    installedAt: z.iso.datetime(),
  })
  .strict();

function manifestContent(filename: string): string | undefined {
  try {
    return readFileSync(filename, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

/** An explicit compiler wins; otherwise prefer the verified project-local Java 25 installation. */
export function javaExecutable(
  explicit?: string,
  manifestFile = path.resolve('node_modules/.cache/groundwork/java25/runtime.json'),
): string {
  if (explicit !== undefined) {
    if (explicit.trim() === '' || explicit.includes('\0')) {
      throw new Error('Expected a Java executable path or command.');
    }
    return explicit;
  }
  const content = manifestContent(manifestFile);
  if (content === undefined) return 'java';
  try {
    const runtime = managedRuntime.parse(JSON.parse(content));
    accessSync(runtime.executable, constants.X_OK);
    if (!statSync(runtime.executable).isFile()) throw new Error('Java executable is not a file.');
    return runtime.executable;
  } catch (error) {
    throw new Error(
      'Managed Java runtime is invalid; rerun npm run scan:java:setup or use --java.',
      {
        cause: error,
      },
    );
  }
}
