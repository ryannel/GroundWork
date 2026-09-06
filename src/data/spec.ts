import type { z } from 'zod'
import type * as schemas from './content-schema.ts'

export const sectionKinds = ['purpose', 'journey', 'design', 'flow', 'api', 'storage', 'tests'] as const
export type SectionKind = typeof sectionKinds[number]

export type Criterion = z.infer<typeof schemas.criterionSchema>
export type Purpose = z.infer<typeof schemas.purposeSchema>
export type JourneyStep = z.infer<typeof schemas.journeyStepSchema>
export type Journey = z.infer<typeof schemas.journeySchema>
export type Mockup = z.infer<typeof schemas.mockupSchema>
export type Design = z.infer<typeof schemas.designSchema>
export type FlowNode = z.infer<typeof schemas.flowNodeSchema>
export type FlowEdge = z.infer<typeof schemas.flowEdgeSchema>
export type Flow = z.infer<typeof schemas.flowSchema>
export type SchemaField = z.infer<typeof schemas.schemaFieldSchema>
export type ApiContract = z.infer<typeof schemas.apiContractSchema>
export type Api = z.infer<typeof schemas.apiSchema>
export type Column = z.infer<typeof schemas.columnSchema>
export type Table = z.infer<typeof schemas.tableSchema>
export type Storage = z.infer<typeof schemas.storageSchema>
export type TestCase = z.infer<typeof schemas.testCaseSchema>
export type Tests = z.infer<typeof schemas.testsSchema>
export type FeatureSpec = z.infer<typeof schemas.featureSpecSchema>
export type Change = z.infer<typeof schemas.changeSchema>
export type TestStatus = z.infer<typeof schemas.testStatusSchema>
export type ResponseSchema = z.infer<typeof schemas.responseSchema>
export type MockupKind = Mockup['kind']
export type FlowNodeKind = FlowNode['kind']
