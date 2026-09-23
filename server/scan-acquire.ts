import { execFile } from 'node:child_process'
import { realpath } from 'node:fs/promises'
import { hasCredentials, repositoryIdentity } from '../src/data/repository-identity.ts'
import { sourceRefSchema } from '../src/data/scan-schema.ts'
import { InvalidInput } from './errors.ts'
import { parseTree } from './scan-inventory.ts'

/** Acquisition commands are killed after this long, so an unreachable host cannot hang the operation. */
export const COMMAND_TIMEOUT_MS = 120_000
export const MAX_EXEC_BUFFER = 32 * 1024 * 1024

/** `owner/name` for gh. The owner must start with a letter or digit so gh never reads it as a flag. */
const githubShorthand = /^[A-Za-z0-9][\w.-]*\/[\w.-]+$/
const gitUrl = /^(?:https?:\/\/|ssh:\/\/|git@)/

/**
 * Configuration for every git process, including the ones gh starts: no hooks or fsmonitor from the scanned
 * repository, and ordinary transports only (`ext::` and other remote helpers are refused).
 */
const gitConfig: [string, string][] = [
  ['core.fsmonitor', 'false'],
  ['core.hooksPath', '/dev/null'],
  ['protocol.allow', 'never'],
  ['protocol.file.allow', 'always'],
  ['protocol.https.allow', 'always'],
  ['protocol.http.allow', 'always'],
  ['protocol.ssh.allow', 'always'],
]

function commandEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_COUNT: String(gitConfig.length) }
  // GIT_TERMINAL_PROMPT does not stop ssh from asking about host keys or passphrases; BatchMode does.
  if (!env.GIT_SSH_COMMAND && !env.GIT_SSH) env.GIT_SSH_COMMAND = 'ssh -o BatchMode=yes'
  gitConfig.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key
    env[`GIT_CONFIG_VALUE_${index}`] = value
  })
  return env
}

/** Removes `user:password@` from any URL in a message. */
export function redact(text: string) {
  return text.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1')
}

const knownFailures: [RegExp, string][] = [
  [/\bsaml\b|single sign-on|\bsso\b/i, 'Repository access requires SSO authorization for the active GitHub credentials'],
  [/authentication failed|could not read (?:username|password)|terminal prompts disabled|permission denied \(publickey|host key verification failed/i,
    'Repository authentication is unavailable; authenticate GitHub or configure a Git credential helper'],
  [/repository not found|could not resolve to a repository|does not appear to be a git repository|does not exist/i,
    'Repository was not found or the active credentials cannot access it'],
  [/rate limit/i, 'Repository acquisition was rate limited; retry after the GitHub limit resets'],
  [/couldn't find remote ref|not our ref|unadvertised object|invalid refspec/i, 'The requested sourceRef was not found in the repository'],
]

function commandError(file: string, args: string[], error: unknown) {
  const failure = error as NodeJS.ErrnoException & { stderr?: Buffer | string; killed?: boolean; signal?: string }
  failure.message = redact(String(failure.message))
  const cause = { cause: failure }
  if (failure.code === 'ENOENT') return new Error(`${file} is required for repository scanning but is not installed`, cause)
  if (failure.killed || failure.signal === 'SIGKILL') {
    return new Error(`${file} ${args[0]} did not finish within ${COMMAND_TIMEOUT_MS / 1000} seconds`, cause)
  }
  const stderr = redact(String(failure.stderr ?? ''))
  const known = knownFailures.find(([pattern]) => pattern.test(stderr))
  if (known) return new Error(known[1], cause)
  const detail = stderr.split('\n').map(line => line.replace(/^(?:fatal|error): /, '').trim()).find(Boolean)
  return new Error(`${file} ${args[0]} failed${detail ? `: ${detail.slice(0, 500)}` : ''}`, cause)
}

/** Runs git or gh with a timeout, non-interactive credentials and the hardened git configuration. Stdin is closed unless `input` is given. */
export function run(file: 'git' | 'gh', args: string[], options: { cwd?: string; input?: string } = {}) {
  return new Promise<Buffer>((resolve, reject) => {
    const child = execFile(file, args, {
      cwd: options.cwd,
      encoding: 'buffer',
      maxBuffer: MAX_EXEC_BUFFER,
      timeout: COMMAND_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      env: commandEnvironment(),
    }, (error, stdout, stderr) => {
      if (error) reject(commandError(file, args, Object.assign(error, { stderr })))
      else resolve(stdout)
    })
    child.stdin?.on('error', () => undefined)
    child.stdin?.end(options.input)
  })
}

async function git(args: string[], cwd?: string) {
  return (await run('git', args, { cwd })).toString('utf8')
}

/**
 * Clones `repository` into `target` and pins `ref` (or the default branch). The ref is validated again here
 * and always follows `--end-of-options`, so it can never be read as a git option.
 * Returns the pinned commit and the credential-free repository identity.
 */
export async function acquire(repository: string, ref: string | undefined, target: string) {
  if (hasCredentials(repository)) throw new InvalidInput('Remove credentials from the repository URL; use a Git credential helper or gh auth instead')
  const pinned = ref === undefined ? undefined : sourceRefSchema.parse(ref)
  const local = await realpath(repository).catch(() => null)
  if (local) {
    await git(['clone', '--no-hardlinks', '--no-tags', '--quiet', '--', local, target])
  } else if (githubShorthand.test(repository)) {
    await run('gh', ['repo', 'clone', repository, target, '--', '--filter=blob:none', '--depth=1', '--no-tags', '--quiet'])
  } else if (gitUrl.test(repository)) {
    await git(['clone', '--filter=blob:none', '--depth=1', '--no-tags', '--quiet', '--', repository, target])
  } else throw new InvalidInput('Repository must be an existing local path, owner/name, or Git URL')
  // Checkout only downloads the blobs a partial clone lacks. Snapshot bytes are read from the object
  // database, so checkout-time conversions (eol, autocrlf, filters) never reach the worker.
  if (pinned) {
    await git(['fetch', '--depth=1', '--no-tags', '--quiet', '--end-of-options', 'origin', pinned], target)
    await git(['checkout', '--detach', '--quiet', 'FETCH_HEAD'], target)
  } else await git(['checkout', '--detach', '--quiet'], target)
  const revision = (await git(['rev-parse', '--verify', 'HEAD^{commit}'], target)).trim()
  const origin = local
    ? await git(['remote', 'get-url', 'origin'], local).then(value => value.trim()).catch(() => local)
    : repository
  return { revision, repository: repositoryIdentity(origin) }
}

/** Every committed file at `revision`, with blob sizes. */
export async function listTree(repository: string, revision: string) {
  return parseTree(await git(['ls-tree', '-r', '-l', '-z', '--full-tree', '--end-of-options', revision], repository))
}

/** Reads blobs by object ID with one `git cat-file --batch` process. */
export async function readBlobs(repository: string, digests: string[]) {
  const blobs = new Map<string, Buffer>()
  if (!digests.length) return blobs
  const output = await run('git', ['cat-file', '--batch'], { cwd: repository, input: `${digests.join('\n')}\n` })
  let offset = 0
  while (offset < output.length) {
    const newline = output.indexOf(10, offset)
    const header = output.subarray(offset, newline).toString('utf8').split(' ')
    offset = newline + 1
    if (header[1] === 'missing') continue
    const size = Number(header[2])
    blobs.set(header[0], output.subarray(offset, offset + size))
    offset += size + 1
  }
  return blobs
}
