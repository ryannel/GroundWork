import { readFileSync } from 'node:fs'
import type { Component } from '../../src/data/model.ts'

/**
 * A synthetic catalog of a fictional bicycle retailer: four scanned services, two with long endpoint lists, one event
 * relay without endpoints, one traced upload flow, three message brokers and an "MSRP" endpoint whose summary is the
 * paraphrase target for discovery tests.
 */
const read = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./catalog/${name}`, import.meta.url), 'utf8'))
export const components = read<Component[]>('components.json')
export const products = read<{ id: string }[]>('products.json')
export const msrpEndpoint = 'post-api-v2-prices-calculate-msrp'
/** Plan files for `initialise(root, { files })`, as project id `catalog`. */
export const catalogFiles: Record<string, string> = {
  'project.json': JSON.stringify({ schemaVersion: 2, id: 'catalog', name: 'Catalog evaluation' }),
  'members/owner.json': JSON.stringify({ id: 'owner', name: 'Owner' }),
  ...Object.fromEntries(products.map(product => [`products/${product.id}.json`, JSON.stringify(product)])),
  ...Object.fromEntries(components.map(component => [`components/${component.id}.json`, JSON.stringify(component)])),
}
