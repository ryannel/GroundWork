import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, lstat } from 'node:fs/promises'
import { watch, type FSWatcher } from 'node:fs'
import path from 'node:path'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { ZodError } from 'zod'
import { viewerIdentity } from './viewer-identity.ts'
import { inventory, selectRoot } from './registry.ts'
import { readPlan, safePath } from './repository.ts'
import { activity, digest, gitBuffer, gitRaw, resolveRef } from './git.ts'
import { assetPattern, PLAN_DIRECTORY } from './format.ts'
import { operate, isOperationName } from './operations.ts'
import { packageRoot } from './setup.ts'
import { InvalidInput, NotFound, statusFor } from './errors.ts'
import { ContentError } from '../src/data/content.ts'
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}
const csp = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "img-src 'self' https: http: data:",
  "font-src 'self' https://fonts.gstatic.com", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'",
].join('; ')
const MAX_BODY = 4 * 1024 * 1024
const POLL_MS = 1500, HEARTBEAT_MS = 15000, REMEMBERED_SNAPSHOTS = 32
const message = (error: unknown) => error instanceof Error ? error.message : String(error)

/**
 * Status for a failed request. Typed errors map through statusFor; schema and JSON failures are 400 and a missing file
 * is 404. Anything else, including a plain `Error`, Git failures and programming faults, is 500.
 */
export function httpStatus(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError || error instanceof ContentError) return 400
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'ENOENT') return 404
  return statusFor(error)
}

async function readBody(req: IncomingMessage): Promise<{ body: string } | { status: number; error: string }> {
  const tooLarge = { status: 413, error: 'Request exceeds 4 MB' }
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY) return tooLarge
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > MAX_BODY) return tooLarge
    chunks.push(chunk)
  }
  // Decode once: a multi-byte character may be split across chunks.
  try { return { body: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)) } }
  catch { return { status: 400, error: 'Request body is not valid UTF-8' } }
}

export async function serve(options: { root?: string; port?: number; viewerDirectory?: string } = {}) {
  const token = randomBytes(32).toString('hex')
  const expectedAuthorization = Buffer.from(`Bearer ${token}`)
  const authorized = (header: string | undefined) => {
    const given = Buffer.from(header ?? '')
    return given.length === expectedAuthorization.length && timingSafeEqual(given, expectedAuthorization)
  }
  const viewer = options.viewerDirectory ?? path.join(packageRoot, 'dist')
  const lastValid = new Map<string, unknown>()
  const remember = (key: string, value: unknown) => {
    lastValid.delete(key); lastValid.set(key, value)
    if (lastValid.size > REMEMBERED_SNAPSHOTS) lastValid.delete(lastValid.keys().next().value!)
  }
  const snapshot = async (checkoutId?: string, ref?: string) => {
    const key = `${checkoutId ?? ''}:${ref ?? ''}`
    try {
      const root = await selectRoot(checkoutId, options.root)
      const plan = await readPlan(root, ref)
      const observed = await activity(root)
      for (const feature of plan.snapshot.features) for (const mock of feature.spec?.design?.mockups ?? []) {
        if (!assetPattern.test(mock.ref)) continue
        const at = ref ? `&ref=${encodeURIComponent(plan.context.head!)}` : ''
        mock.ref = `/api/asset?checkoutId=${plan.context.checkoutId}${at}&path=${encodeURIComponent(mock.ref)}&v=${plan.assets[mock.ref]}`
      }
      const value = { ...plan, activity: observed }
      remember(key, value)
      return { plan: value, error: null }
    } catch (error) { return { plan: lastValid.get(key) ?? null, error: message(error) } }
  }

  /** One poller and one watcher per (checkout, ref), shared by every event-stream subscriber. */
  type Channel = { subscribers: Set<ServerResponse>; latest: string | null; close: () => void }
  const channels = new Map<string, Channel>()
  const openChannel = (key: string, checkoutId?: string, ref?: string): Channel => {
    let previous = '', busy = false, closed = false
    let watcher: FSWatcher | undefined
    // A full commit SHA never changes, so its view needs no polling once it has loaded.
    const immutable = !!ref && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(ref)
    const channel: Channel = {
      subscribers: new Set(), latest: null,
      close: () => { closed = true; clearInterval(timer); clearInterval(heartbeat); watcher?.close(); channels.delete(key) },
    }
    const broadcast = (frame: string) => { for (const res of channel.subscribers) res.write(frame) }
    const tick = async () => {
      if (closed || busy) return
      busy = true
      try {
        const result = await snapshot(checkoutId, ref)
        if (closed) return
        const data = JSON.stringify(result), hash = digest(data)
        if (hash !== previous) { previous = hash; channel.latest = data; broadcast(`data: ${data}\n\n`) }
        if (immutable && !result.error) clearInterval(timer)
      } finally { busy = false }
    }
    const timer = setInterval(() => { void tick() }, POLL_MS)
    const heartbeat = setInterval(() => broadcast(': keep-alive\n\n'), HEARTBEAT_MS)
    void tick()
    if (!ref) void selectRoot(checkoutId, options.root).then(root => {
      if (closed) return
      try {
        watcher = watch(path.join(root, '.groundwork'), { recursive: true }, () => { void tick() })
        watcher.on('error', () => watcher?.close())
      } catch { /* Periodic reconciliation covers missing directories and unavailable watchers. */ }
    }, () => { /* The poller reports an unknown checkout. */ })
    return channel
  }
  /** Synchronous, so the returned cleanup can be registered before anything awaits. */
  const subscribe = (res: ServerResponse, checkoutId?: string, ref?: string) => {
    const key = `${checkoutId ?? ''}:${ref ?? ''}`
    let channel = channels.get(key)
    if (!channel) { channel = openChannel(key, checkoutId, ref); channels.set(key, channel) }
    const subscribed = channel
    subscribed.subscribers.add(res)
    if (subscribed.latest) res.write(`data: ${subscribed.latest}\n\n`)
    return () => {
      subscribed.subscribers.delete(res)
      if (!subscribed.subscribers.size) subscribed.close()
    }
  }
  const clients = new Map<ServerResponse, () => void>()

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Content-Security-Policy', csp)
    const json = (value: unknown, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)) }
    try {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const hosts = [`127.0.0.1:${port}`, `localhost:${port}`]
      const foreignOrigin = req.headers.origin && !hosts.map(h => `http://${h}`).includes(req.headers.origin)
      if (!hosts.includes(req.headers.host ?? '') || foreignOrigin) return json({ error: 'Only same-origin local requests are accepted' }, 403)
      const url = new URL(req.url!, `http://${req.headers.host}`)
      const checkoutId = url.searchParams.get('checkoutId') ?? undefined
      const ref = url.searchParams.get('ref') ?? undefined
      if (req.method === 'GET' && url.pathname === '/api/viewer') return json(await viewerIdentity(options.root))
      // Threat model: the token is a CSRF guard for browsers, not authentication. Any local process can fetch it here,
      // so it does not protect against other programs on this machine; Host/Origin checks keep remote sites out.
      if (req.method === 'GET' && url.pathname === '/api/session') return json({ token, mode: options.root ? 'standalone' : 'central' })
      if (req.method === 'GET' && url.pathname === '/api/projects') return json(await inventory(options.root))
      if (req.method === 'GET' && url.pathname === '/api/snapshot') return json(await snapshot(checkoutId, ref))
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' })
        res.write(': connected\n\n')
        const unsubscribe = subscribe(res, checkoutId, ref)
        const cleanup = () => { unsubscribe(); clients.delete(res) }
        clients.set(res, cleanup)
        res.on('close', cleanup)
        return
      }
      if (req.method === 'POST' && url.pathname.startsWith('/api/operations/')) {
        if (!authorized(req.headers.authorization)) return json({ error: 'Mutation authentication required' }, 401)
        if (!req.headers['content-type']?.startsWith('application/json')) return json({ error: 'JSON required' }, 415)
        const name = url.pathname.slice('/api/operations/'.length)
        if (!isOperationName(name)) return json({ error: 'Unknown operation' }, 404)
        const read = await readBody(req)
        if ('error' in read) {
          // The rest of an oversized body is never read, so the connection cannot be reused.
          if (read.status === 413) res.setHeader('Connection', 'close')
          return json({ error: read.error }, read.status)
        }
        return json(await operate(name, JSON.parse(read.body), options.root))
      }
      if (req.method === 'GET' && url.pathname === '/api/asset') {
        const name = url.searchParams.get('path') ?? ''
        if (!assetPattern.test(name)) return json({ error: 'Unsupported raster asset path' }, 400)
        const root = await selectRoot(checkoutId, options.root)
        let data: Buffer
        if (ref) {
          const sha = await resolveRef(root, ref).catch(() => { throw new NotFound('Unknown ref') })
          const entry = await gitRaw(root, ['ls-tree', sha, '--', `${PLAN_DIRECTORY}/${name}`])
          if (!entry) throw new NotFound('Asset not found')
          if (!entry.startsWith('100644 ') && !entry.startsWith('100755 ')) throw new InvalidInput('Unsupported asset mode')
          data = await gitBuffer(root, ['cat-file', 'blob', `${sha}:${PLAN_DIRECTORY}/${name}`], { maxBuffer: 32 * 1024 * 1024 })
        } else data = await readFile(await safePath(root, `${PLAN_DIRECTORY}/${name}`))
        res.writeHead(200, { 'Content-Type': mime[path.extname(name)] }); res.end(data); return
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'Method not allowed' }, 405)
      if (url.pathname.startsWith('/api/')) return json({ error: 'Unknown API route' }, 404)
      const relative = decodeURIComponent(url.pathname).slice(1).replace(/\/$/, '') || 'index.html'
      let file = await safePath(viewer, relative)
      if (!(await lstat(file).catch(() => null))?.isFile()) {
        if (path.extname(relative)) return json({ error: 'File not found' }, 404)
        file = path.join(viewer, 'index.html')
      }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' })
      res.end(req.method === 'HEAD' ? undefined : await readFile(file))
    } catch (error) {
      if (!res.headersSent) json({ error: message(error) }, httpStatus(error))
      else res.end()
    }
  })
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(options.port ?? 4317, '127.0.0.1', resolve) })
  const address = server.address() as { port: number }
  const close = async () => {
    for (const [client, cleanup] of clients) { cleanup(); client.end() }
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
  return { server, url: `http://127.0.0.1:${address.port}`, close }
}
