import { documentPattern, type Files } from './format.ts'

export const layoutFile = '.groundwork/catalog/layout.json'
export const layoutText = '{"version":1}\n'
export type Layout = 'legacy' | 'catalog-v1'
const id = '[a-zA-Z0-9_-]+'
export const physicalDocumentPattern = new RegExp(`^(?:\\.groundwork/plans/(?:${documentPattern.source.slice(1, -1)})|\\.groundwork/project\\.json|\\.groundwork/members/${id}\\.json|\\.groundwork/catalog/(?:layout\\.json|products/${id}\\.json|scans/[a-f0-9]{64}\\.json|components/${id}/(?:component|api|data|messaging|knowledge)\\.json|components/${id}/flows/${id}\\.json))$`)

export function encodeStorage(files: Files, layout: Layout): Files {
  if (layout === 'legacy') return Object.fromEntries(Object.entries(files).map(([name, raw]) => [`.groundwork/plans/${name}`, raw]))
  const result: Files = { [layoutFile]: layoutText }
  for (const [name, raw] of Object.entries(files)) {
    if (name === 'project.json' || name.startsWith('members/')) result[`.groundwork/${name}`] = raw
    else if (name.startsWith('products/')) result[`.groundwork/catalog/${name}`] = raw
    else if (name.startsWith('scan-manifests/')) result[`.groundwork/catalog/scans/${name.split('/')[1]}`] = raw
    else if (name.startsWith('components/')) {
      const component = JSON.parse(raw)
      const { api, data, messaging, executionFlows, findings, ...metadata } = component
      const prefix = `.groundwork/catalog/components/${name.slice('components/'.length, -5)}/`
      const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
      result[prefix + 'component.json'] = json(metadata)
      for (const [area, value] of Object.entries({ api, data, messaging })) if (value !== undefined) result[prefix + area + '.json'] = json(value)
      // Preserve an explicitly empty array separately from an omitted field.
      if (findings !== undefined || executionFlows !== undefined) result[prefix + 'knowledge.json'] = json({ ...(findings !== undefined ? { findings } : {}), ...(executionFlows !== undefined ? { flowOrder: executionFlows.map((flow: { id: string }) => flow.id) } : {}) })
      for (const flow of executionFlows ?? []) result[prefix + `flows/${flow.id}.json`] = json(flow)
    } else result[`.groundwork/plans/${name}`] = raw
  }
  return result
}

export function decodeStorage(physical: Files): { files: Files; layout: Layout } {
  const split = physical[layoutFile] !== undefined || physical['.groundwork/project.json'] !== undefined
  if (!split) {
    if (Object.keys(physical).some(name => !name.startsWith('.groundwork/plans/'))) throw new Error('Catalog files without a layout marker; repair or recover the migration')
    return { layout: 'legacy', files: Object.fromEntries(Object.entries(physical).map(([name, raw]) => [name.slice('.groundwork/plans/'.length), raw])) }
  }
  if (!physical['.groundwork/project.json'] || physical[layoutFile] === undefined || JSON.parse(physical[layoutFile]).version !== 1) throw new Error('Unsupported or incomplete catalog layout')
  const files: Files = {}, components = new Set<string>()
  for (const [name, raw] of Object.entries(physical)) {
    if (name === layoutFile) continue
    if (name.startsWith('.groundwork/plans/')) {
      const logical = name.slice('.groundwork/plans/'.length)
      if (!/^(?:features\/|decisions\/)/.test(logical)) throw new Error('Mixed catalog authority: legacy catalog documents exist in plans; recover or reconcile explicitly')
      files[logical] = raw
    } else if (name === '.groundwork/project.json' || name.startsWith('.groundwork/members/')) files[name.slice('.groundwork/'.length)] = raw
    else if (name.startsWith('.groundwork/catalog/products/')) files[name.slice('.groundwork/catalog/'.length)] = raw
    else if (name.startsWith('.groundwork/catalog/scans/')) files[`scan-manifests/${name.split('/').at(-1)}`] = raw
    else if (name.startsWith('.groundwork/catalog/components/')) components.add(name.split('/')[3])
    else throw new Error(`Unknown catalog document: ${name}`)
  }
  for (const componentId of components) {
    const prefix = `.groundwork/catalog/components/${componentId}/`
    if (!physical[prefix + 'component.json']) throw new Error(`Missing component metadata: ${componentId}`)
    const component = JSON.parse(physical[prefix + 'component.json'])
    for (const field of ['api', 'data', 'messaging', 'executionFlows', 'findings']) if (field in component) throw new Error(`Mixed component authority: ${componentId}.${field}`)
    for (const area of ['api', 'data', 'messaging']) if (physical[prefix + area + '.json'] !== undefined) component[area] = JSON.parse(physical[prefix + area + '.json'])
    const knowledge = physical[prefix + 'knowledge.json'] === undefined ? {} : JSON.parse(physical[prefix + 'knowledge.json'])
    if (Object.keys(knowledge).some(key => !['findings', 'flowOrder'].includes(key))) throw new Error('Unsupported component knowledge field')
    if ('findings' in knowledge) component.findings = knowledge.findings
    const flowFiles = Object.keys(physical).filter(name => name.startsWith(prefix + 'flows/'))
    if ('flowOrder' in knowledge) {
      if (!Array.isArray(knowledge.flowOrder) || new Set(knowledge.flowOrder).size !== knowledge.flowOrder.length || flowFiles.length !== knowledge.flowOrder.length) throw new Error('Invalid flow inventory')
      component.executionFlows = knowledge.flowOrder.map((flowId: string) => {
        const name = prefix + `flows/${flowId}.json`
        if (!flowFiles.includes(name)) throw new Error('Missing flow document')
        const flow = JSON.parse(physical[name]); if (flow.id !== flowId) throw new Error('Flow identity mismatch')
        return flow
      })
    } else if (flowFiles.length) throw new Error('Flow files require an ordered inventory')
    if (component.id !== componentId) throw new Error('Component directory identity mismatch')
    files[`components/${componentId}.json`] = JSON.stringify(component, null, 2) + '\n'
  }
  return { layout: 'catalog-v1', files }
}
