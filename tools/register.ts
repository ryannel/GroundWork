// Lets node run tools that import the app's own code: resolves `@/…` to src/ and extensionless imports to .ts.
//   node --import ./tools/register.ts --conditions=react-server tools/<tool>.ts
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const TRIES = ['', '.ts', '.tsx', '/index.ts'];

function located(base: string): string | undefined {
  return TRIES.map((end) => `${base}${end}`).find(
    (file) => existsSync(file) && !file.endsWith('/'),
  );
}

registerHooks({
  resolve(specifier, context, next) {
    const parent = context.parentURL ?? '';
    const local =
      specifier.startsWith('.') && parent.startsWith('file:') && !parent.includes('/node_modules/');
    let base: string | undefined;
    if (specifier.startsWith('@/')) base = path.join(SRC, specifier.slice(2));
    else if (local) base = path.resolve(path.dirname(fileURLToPath(parent)), specifier);
    const file = base === undefined || path.extname(base) === '.json' ? undefined : located(base);
    if (file !== undefined) return next(pathToFileURL(file).href, context);
    return next(specifier, context);
  },
});
