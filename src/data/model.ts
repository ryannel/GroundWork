import type { z } from 'zod'
import type * as schemas from './content-schema.ts'
import type { FeatureSpec } from './spec.ts'
export type ID = string
export type Workspace = z.infer<typeof schemas.workspaceSchema>
export type Product = z.infer<typeof schemas.productSchema>
export type Component = z.infer<typeof schemas.componentReadSchema>
/** Read model: owner name and section documents are resolved by the repository. */
export type Feature = schemas.FeatureRecord & { owner: string; spec?: FeatureSpec }
export interface Db {
  workspaces: Workspace[]
  products: Product[]
  components: Component[]
  features: Feature[]
}
