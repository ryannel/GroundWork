import { Tree } from '@nx/devkit';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Shared helpers used by every service generator (Go, Python, Next.js, ...).
 *
 * These were previously copy-pasted into each generator, which meant every
 * cross-cutting fix had to be applied N times and drifted between languages.
 * They live here once and are imported by all generators. Anything that is
 * genuinely language-specific (e.g. the per-service docker-compose entry) stays
 * in the individual generator.
 */

/**
 * Engineer skills live in hidden-skills/ until a service is scaffolded, then
 * they are promoted to .agents/skills/ so engineers have them immediately
 * available in their toolchain.
 */
export function promoteEngineerSkill(tree: Tree, skillName: string) {
  const sourcePath = path.join(__dirname, '..', '..', '..', '..', 'src', 'hidden-skills', skillName);

  if (!fs.existsSync(sourcePath)) {
    console.warn(`Engineer skill ${skillName} not found at ${sourcePath}`);
    return;
  }

  function copyDir(src: string, dest: string) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcFile = path.join(src, entry.name);
      const destFile = dest + '/' + entry.name;
      if (entry.isDirectory()) {
        copyDir(srcFile, destFile);
      } else {
        tree.write(destFile, fs.readFileSync(srcFile));
      }
    }
  }

  copyDir(sourcePath, `.agents/skills/${skillName}`);
}

/**
 * Turn a stack-doc path under docs/principles/stack/ into a human-readable
 * title for the llms.txt index, e.g.
 *   docs/principles/stack/go/concurrency.md  -> "Go: Concurrency"
 *   docs/principles/stack/typescript/frontend.md -> "Typescript: Frontend"
 * The mapping is derived purely from the path so it works for any stack.
 */
function stackDocTitle(destPath: string): string {
  const parts = destPath.split('/');
  const stackIdx = parts.indexOf('stack');
  const segments =
    stackIdx >= 0 ? parts.slice(stackIdx + 1) : parts.slice(-2);

  const titleCase = (s: string) =>
    s
      .replace(/\.md$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  if (segments.length >= 2) {
    const stack = titleCase(segments[0]);
    const last = segments[segments.length - 1];
    // An index doc is the stack's overview, not a topic named "Index".
    const topic = /^index\.md$/i.test(last) ? 'Overview' : titleCase(last);
    return `${stack}: ${topic}`;
  }
  return titleCase(segments[segments.length - 1] ?? destPath);
}

const STACK_PRINCIPLES_MARKER =
  '<!-- Stack-specific docs are appended here when a generator deploys them. -->';

/**
 * Register a stack doc in the project's root llms.txt under the
 * "Stack principles (added by generators)" section.
 *
 * - Idempotent: a path already listed is left untouched, so re-running a
 *   generator never duplicates an entry.
 * - Consumes the placeholder comment the first time a doc is registered, then
 *   keeps appending real entries beneath the section heading.
 * - Matches the existing list-entry format: `- [Title](path): description.`
 *
 * No-op when llms.txt is absent (e.g. a bare workspace that has not run
 * `groundwork init`).
 */
function registerStackDocInLlms(tree: Tree, destPath: string) {
  if (!tree.exists('llms.txt')) return;

  const content = tree.read('llms.txt', 'utf-8') ?? '';

  // Already listed — nothing to do (idempotency).
  if (content.includes(`(${destPath})`)) return;

  const title = stackDocTitle(destPath);
  const entry = `- [${title}](${destPath}): Stack-specific engineering principles.`;

  let updated: string;
  if (content.includes(STACK_PRINCIPLES_MARKER)) {
    // Replace the placeholder with the first real entry.
    updated = content.replace(STACK_PRINCIPLES_MARKER, entry);
  } else {
    // Placeholder already consumed; append under the existing section.
    updated = content.replace(/\s*$/, '') + '\n' + entry + '\n';
  }

  tree.write('llms.txt', updated);
}

/**
 * Deploy a generator's stack-principle docs into the project's docs/ tree and
 * register each one in llms.txt.
 *
 * - Existing docs on disk are never overwritten (idempotent deploy).
 * - Every doc that ends up in the tree is registered in llms.txt, whether it
 *   was just written or already present, so the index stays complete even if
 *   the files predate llms.txt registration.
 */
export function deployStackDocs(tree: Tree, docsRoot: string) {
  if (!fs.existsSync(docsRoot)) return;

  function walk(src: string, relPath: string) {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(srcPath, destPath);
      } else {
        if (!tree.exists(destPath)) {
          tree.write(destPath, fs.readFileSync(srcPath));
        }
        registerStackDocInLlms(tree, destPath);
      }
    }
  }
  walk(docsRoot, 'docs');
}

/**
 * Inject the optional infrastructure a service needs into the shared
 * docker-compose. redis and the pubsub emulator are not in the base compose;
 * they are added here on demand and only once, so a project provisions only the
 * infrastructure some service actually uses.
 */
export function ensureOptionalInfra(
  composeDoc: any,
  servicesMap: any,
  opts: { usesRedis: boolean; usesPubSub: boolean }
) {
  if (opts.usesRedis && !servicesMap.has('redis')) {
    servicesMap.set('redis', {
      image: 'redis:7-alpine',
      restart: 'unless-stopped',
      ports: ['6379:6379'],
      networks: ['groundwork-net'],
      volumes: ['redis_data:/data'],
      healthcheck: {
        test: ['CMD', 'redis-cli', 'ping'],
        interval: '5s',
        timeout: '3s',
        retries: 5
      }
    });
    let volumesMap = composeDoc.get('volumes');
    if (!volumesMap) {
      composeDoc.set('volumes', {});
      volumesMap = composeDoc.get('volumes');
    }
    if (!volumesMap.has('redis_data')) {
      volumesMap.set('redis_data', null);
    }
  }

  if (opts.usesPubSub && !servicesMap.has('pubsub')) {
    servicesMap.set('pubsub', {
      // Pinned: the bare `:emulators` tag floats with every cloud-sdk release.
      image: 'gcr.io/google.com/cloudsdktool/cloud-sdk:572.0.0-emulators',
      restart: 'unless-stopped',
      ports: ['8085:8085'],
      networks: ['groundwork-net'],
      command: 'gcloud beta emulators pubsub start --host-port=0.0.0.0:8085',
      healthcheck: {
        test: ['CMD', 'curl', '-f', 'http://localhost:8085'],
        interval: '5s',
        timeout: '5s',
        retries: 5
      }
    });
  }
}
