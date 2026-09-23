import { createInterface } from 'node:readline'
import { z } from 'zod'
import { operate, operationSchemas, descriptions, type OperationName } from './operations.ts'
export function mcp(root?: string) {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
  let queue = Promise.resolve()
  lines.on('line', line => {
    queue = queue.then(async () => {
      let request: { id?: string | number; method: string; params?: Record<string, any> }
      const send = (data: unknown) => { process.stdout.write(JSON.stringify(data) + '\n') }
      try { request = JSON.parse(line) } catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }); return }
      if (request.id === undefined) return
      const reply = (result: unknown) => send({ jsonrpc: '2.0', id: request.id, result })
      if (request.method === 'initialize') return reply({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'groundwork-v2', version: '0.4.12' }, instructions: 'Plans are repository-owned. Read before writing, preserve expectedRevision and expectedContext, and select checkouts explicitly. Ref views are read-only. Evidence and declared progress are separate.' })
      if (request.method === 'ping') return reply({})
      if (request.method === 'tools/list') return reply({ tools: Object.entries(operationSchemas).map(([name, schema]) => ({ name, description: descriptions[name as OperationName], inputSchema: z.toJSONSchema(schema), annotations: {
        readOnlyHint: ['read_scan_manifest', 'projects', 'read_plan', 'search_catalog', 'get_catalog_entity', 'get_discovery_context', 'get_discovery_baseline', 'check_catalog_freshness', 'prepare_repository_scan'].includes(name),
        destructiveHint: ['reconcile_catalog', 'migrate_catalog', 'write_plan', 'apply_repository_scan', 'apply_catalog_investigation'].includes(name),
        openWorldHint: name === 'prepare_repository_scan',
      } })) })
      if (request.method === 'tools/call') {
        const name = request.params?.name
        if (typeof name !== 'string' || !Object.hasOwn(operationSchemas, name)) return send({ jsonrpc: '2.0', id: request.id, error: { code: -32602, message: 'Unknown tool' } })
        try { return reply({ content: [{ type: 'text', text: JSON.stringify(await operate(name as OperationName, request.params?.arguments ?? {}, root)) }] }) }
        catch (error) { return reply({ isError: true, content: [{ type: 'text', text: (error as Error).message }] }) }
      }
      send({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } })
    }).catch(error => { process.stderr.write(`${error}\n`) })
  })
}
