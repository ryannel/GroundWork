// Fast viewer loop: starts (or reuses) the Hub from source on port 4318 and a Vite dev server with hot reload that
// proxies /api to it (see vite.config.ts). No build is needed; restart this command after changing server code.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
// bin/ runs the compiled copy; here we run server/cli.ts straight from source, which starts the Hub
// itself via its own `node server/cli.ts ...` main guard.
const hub = spawn(process.execPath, ['server/cli.ts', 'hub', '--port', '4318'], { cwd: root, stdio: 'inherit' })
hub.on('exit', code => { if (code) process.exit(code) })
const vite = await createServer({ root })
await vite.listen()
vite.printUrls()
console.log('Open the Vite URL above for hot reload. Ctrl+C stops both servers.')
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { hub.kill(signal);
    void vite.close().then(() => process.exit(0)) })
}
