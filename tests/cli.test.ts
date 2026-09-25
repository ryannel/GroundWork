import { test } from 'node:test'
import assert from 'node:assert/strict'
import { main, exitCodeFor, UsageError } from '../server/cli.ts'

// Every case here fails or finishes while parsing argv, before any command touches a repository or a port.
const run = async (argv: string[]) => {
  const lines: string[] = []
  await main(argv, line => { lines.push(line) })
  return lines.join('\n')
}
const usage = (pattern: RegExp) => (error: unknown) =>
  error instanceof UsageError && exitCodeFor(error) === 2 && pattern.test(error.message)

test('help is printed for no command, help, --help, -h and any command with --help', async () => {
  for (const argv of [[], ['help'], ['--help'], ['-h'], ['read', '--help'], ['init', '-h']]) {
    assert.match(await run(argv), /portable repository planning/, argv.join(' ') || '(none)')
  }
})

test('unknown commands and options are usage errors', async () => {
  await assert.rejects(run(['nonsense']), usage(/Unknown command: nonsense/))
  await assert.rejects(run(['hub', '--root', 'x']), usage(/^hub: Unknown option '--root'/))
  await assert.rejects(run(['read', '--reff', 'main']), usage(/Unknown option '--reff'/))
  await assert.rejects(run(['start', '--standalone=yes']), usage(/^start: /))
})

test('each command accepts only its own number of positional arguments', async () => {
  await assert.rejects(run(['hub', 'extra']), usage(/hub: unexpected argument extra/))
  await assert.rejects(run(['projects', 'extra']), usage(/projects: unexpected argument extra/))
  await assert.rejects(run(['read', 'a', 'b']), usage(/read: unexpected argument b/))
  await assert.rejects(run(['validate', 'a', '--root', 'b']), usage(/validate: pass the path or --root, not both/))
})

test('options that take a value require one, and required options are enforced', async () => {
  await assert.rejects(run(['init', '--name']), usage(/^init: .*--name/))
})

test('call needs a listed operation, one scope and an input file', async () => {
  await assert.rejects(run(['call']), usage(/call: choose an operation listed in help/))
  await assert.rejects(run(['call', 'toString']), usage(/call: choose an operation listed in help/))
  await assert.rejects(run(['call', 'read_plan', '--central', '--root', 'x']), usage(/call: pass --root or --central, not both/))
  await assert.rejects(run(['call', 'read_plan']), usage(/call: --input is required/))
})

test('ports must be whole numbers from 1 to 65535', async () => {
  for (const port of ['abc', '-1', '0', '65536', '1.5']) {
    await assert.rejects(run(['hub', `--port=${port}`]), usage(new RegExp(`hub: invalid port ${port.replace('.', '\\.')}`)), port)
  }
  await assert.rejects(run(['serve', '.', '--port', 'abc']), usage(/serve: invalid port abc/))
})

test('an empty --port value is rejected instead of silently starting on a random port', async () => {
  await assert.rejects(run(['hub', '--port=']), usage(/^hub: invalid port $/))
})
