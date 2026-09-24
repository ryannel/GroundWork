import { createInterface } from 'node:readline'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { operate, operationSchemas, descriptions, operationAnnotations, operationNames, isOperationName } from './operations.ts'
import { packageRoot } from './setup.ts'

const version = (JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as { version: string }).version
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const id = z.union([z.string(), z.number(), z.null()])
const requestSchema = z.object({ jsonrpc: z.literal('2.0'), id: id.optional(), method: z.string(), params: z.record(z.string(), z.unknown()).optional() })
const instructions = 'Plans are repository-owned. Read before writing, preserve expectedRevision and expectedContext, and select checkouts explicitly. '
  + 'Ref views are read-only. Evidence and declared progress are separate.'

/** Handles one JSON-RPC line. Returns the response, or null for a notification. Batches are not supported. */
export async function handleMessage(line: string, root?: string): Promise<Record<string, unknown> | null> {
  const failure = (code: number, text: string, requestId: z.infer<typeof id> = null) => ({ jsonrpc: '2.0', id: requestId, error: { code, message: text } })
  if (!line.trim()) return null
  let parsed: unknown
  try { parsed = JSON.parse(line) } catch { return failure(-32700, 'Invalid JSON') }
  const envelope = requestSchema.safeParse(parsed)
  if (!envelope.success) {
    const given = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? id.safeParse((parsed as { id?: unknown }).id) : null
    return failure(-32600, 'Invalid Request', given?.success ? given.data ?? null : null)
  }
  const request = envelope.data
  if (request.id === undefined) return null
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: request.id, result })
  if (request.method === 'initialize') {
    return reply({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'groundwork', version }, instructions })
  }
  if (request.method === 'ping') return reply({})
  if (request.method === 'tools/list') {
    return reply({ tools: operationNames.map(name => ({
      name, description: descriptions[name], inputSchema: z.toJSONSchema(operationSchemas[name]), annotations: operationAnnotations(name),
    })) })
  }
  if (request.method === 'tools/call') {
    const name = request.params?.name
    if (typeof name !== 'string' || !isOperationName(name)) return failure(-32602, 'Unknown tool', request.id)
    try { return reply({ content: [{ type: 'text', text: JSON.stringify(await operate(name, request.params?.arguments ?? {}, root)) }] }) }
    catch (error) { return reply({ isError: true, content: [{ type: 'text', text: message(error) }] }) }
  }
  return failure(-32601, 'Method not found', request.id)
}

export function mcp(root?: string) {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
  let queue = Promise.resolve()
  lines.on('line', line => {
    queue = queue.then(async () => {
      const response = await handleMessage(line, root)
      if (response) process.stdout.write(JSON.stringify(response) + '\n')
    }).catch(error => { process.stderr.write(`${message(error)}\n`) })
  })
}
