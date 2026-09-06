import { createServer, type ServerResponse } from 'node:http'
import { readFile, lstat } from 'node:fs/promises'
import { watch } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { inventory, selectRoot } from './registry.ts'
import { Conflict, readPlan, safePath } from './repository.ts'
import { activity, digest, resolveRef } from './git.ts'
import { assetPattern, PLAN_DIRECTORY } from './format.ts'
import { operate, operationSchemas, type OperationName } from './operations.ts'
import { packageRoot } from './setup.ts'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const exec = promisify(execFile)
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' }
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
export async function serve(options: { root?: string; port?: number; viewerDirectory?: string } = {}) {
  const token = randomBytes(32).toString('hex')
  const viewer = options.viewerDirectory ?? path.join(packageRoot, 'dist')
  const clients = new Set<ServerResponse>()
  const lastValid = new Map<string, unknown>()
  const snapshot = async (checkoutId?: string, ref?: string) => {
    const key = `${checkoutId ?? ''}:${ref ?? ''}`
    try {
      const root = await selectRoot(checkoutId, options.root)
      const plan = await readPlan(root, ref)
      const observed = await activity(root)
      for (const feature of plan.snapshot.features) for (const mock of feature.spec?.design?.mockups ?? []) {
        if (assetPattern.test(mock.ref)) mock.ref = `/api/asset?checkoutId=${plan.context.checkoutId}${ref ? `&ref=${encodeURIComponent(plan.context.head!)}` : ''}&path=${encodeURIComponent(mock.ref)}&v=${plan.assets[mock.ref]}`
      }
      const value = { ...plan, activity: observed }
      lastValid.set(key, value)
      return { plan: value, error: null }
    } catch (error) { return { plan: lastValid.get(key) ?? null, error: message(error) } }
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: http: data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
    const json = (value: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
    try {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const hosts = [`127.0.0.1:${port}`, `localhost:${port}`]
      if (!hosts.includes(req.headers.host ?? '') || (req.headers.origin && !hosts.map(h => `http://${h}`).includes(req.headers.origin))) return json({ error: 'Only same-origin local requests are accepted' }, 403)
      const url = new URL(req.url!, `http://${req.headers.host}`)
      const checkoutId = url.searchParams.get('checkoutId') ?? undefined
      const ref = url.searchParams.get('ref') ?? undefined
      if (req.method === 'GET' && url.pathname === '/api/session') return json({ token, mode: options.root ? 'standalone' : 'central' })
      if (req.method === 'GET' && url.pathname === '/api/projects') return json(await inventory(options.root))
      if (req.method === 'GET' && url.pathname === '/api/snapshot') return json(await snapshot(checkoutId, ref))
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
        res.write(': connected\n\n'); clients.add(res)
        let previous = '', busy = false, closed = false
        const tick = async () => {
          if (closed || busy) return
          busy = true
          try { const data = JSON.stringify(await snapshot(checkoutId, ref)); const hash = digest(data); if (!closed && hash !== previous) { res.write(`data: ${data}\n\n`); previous = hash } }
          finally { busy = false }
        }
        void tick()
        const timer = setInterval(() => { void tick() }, 1500)
        const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15000)
        const root = await selectRoot(checkoutId, options.root).catch(() => null)
        let watcher: ReturnType<typeof watch> | undefined
        if (root && !ref) try { watcher = watch(path.join(root, PLAN_DIRECTORY), { recursive: true }, () => { void tick() }); watcher.on('error', () => watcher?.close()) } catch { /* Periodic reconciliation covers missing directories and unavailable watchers. */ }
        res.on('close', () => { closed = true; clearInterval(timer); clearInterval(heartbeat); watcher?.close(); clients.delete(res) })
        return
      }
      if (req.method === 'POST' && url.pathname.startsWith('/api/operations/')) {
        if (req.headers.authorization !== `Bearer ${token}`) return json({ error: 'Mutation authentication required' }, 401)
        if (!req.headers['content-type']?.startsWith('application/json')) return json({ error: 'JSON required' }, 415)
        let body = ''
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4 * 1024 * 1024) return json({ error: 'Request exceeds 4 MB' }, 413) }
        const name = url.pathname.slice('/api/operations/'.length)
        if (!Object.hasOwn(operationSchemas, name)) return json({ error: 'Unknown operation' }, 404)
        return json(await operate(name as OperationName, JSON.parse(body), options.root))
      }
      if (req.method === 'GET' && url.pathname === '/api/asset') {
        const name = url.searchParams.get('path') ?? ''
        if (!assetPattern.test(name)) return json({ error: 'Unsupported raster asset path' }, 400)
        const root = await selectRoot(checkoutId, options.root)
        let data: Buffer
        if (ref) {
          const sha = await resolveRef(root, ref)
          const mode = (await exec('git', ['-C', root, 'ls-tree', sha, '--', `${PLAN_DIRECTORY}/${name}`])).stdout
          if (!mode.startsWith('100644 ') && !mode.startsWith('100755 ')) throw new Error('Unsupported asset mode')
          data = (await exec('git', ['-C', root, 'show', `${sha}:${PLAN_DIRECTORY}/${name}`], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 })).stdout
        } else data = await readFile(await safePath(root, `${PLAN_DIRECTORY}/${name}`))
        res.writeHead(200, { 'Content-Type': mime[path.extname(name)] }); res.end(data); return
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'Method not allowed' }, 405)
      if (url.pathname.startsWith('/api/')) return json({ error: 'Unknown API route' }, 404)
      const relative = decodeURIComponent(url.pathname).slice(1) || 'index.html'
      let file = await safePath(viewer, relative)
      if (!(await lstat(file).catch(() => null))?.isFile()) {
        if (path.extname(relative)) return json({ error: 'File not found' }, 404)
        file = path.join(viewer, 'index.html')
      }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(req.method === 'HEAD' ? undefined : await readFile(file))
    } catch (error) {
      if (!res.headersSent) json({ error: message(error) }, error instanceof Conflict ? 409 : 400)
      else res.end()
    }
  })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(options.port ?? 4317, '127.0.0.1', resolve) })
  const address = server.address() as { port: number }
  return { server, url: `http://127.0.0.1:${address.port}`, close: async () => { for (const client of clients) client.end(); server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) } }
}
