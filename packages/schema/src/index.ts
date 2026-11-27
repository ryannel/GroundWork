import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";
import addFormatsModule from "ajv-formats";
import { citeAnchorsSchema, repositoryPinSchema, structureEvidenceSchema, surfaceInventorySchema } from "./schemas.js";
import {
  componentFileSchema,
  contractsFileSchema,
  domainsFileSchema,
  externalFileSchema,
  flowFileSchema,
  handlersFileSchema,
  orientationFileSchema,
  screensFileSchema,
  storeFileSchema,
  systemFileSchema,
  topicFileSchema,
  workspaceFileSchema,
  workspacePointerSchema,
} from "./model-schemas.js";
import {
  planChangesSchema,
  planDesignSchema,
  planExecutionSchema,
  planManifestSchema,
  planProofSchema,
  reviewNoteSchema,
} from "./plan-schemas.js";

export * from "./ids.js";
export * from "./types.js";
export * from "./model-types.js";
export * from "./plan-types.js";
export * from "./schemas.js";
export * from "./model-schemas.js";
export * from "./plan-schemas.js";

const addFormats =
  (addFormatsModule as unknown as { default?: (ajv: Ajv) => Ajv }).default ??
  (addFormatsModule as unknown as (ajv: Ajv) => Ajv);

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function formatErrors(errors: readonly ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];
  return errors.map((e) => `${e.instancePath || "/"}: ${e.message ?? "invalid"}`);
}

function makeValidator(fn: ValidateFunction): (data: unknown) => ValidationResult {
  return (data: unknown) => {
    const valid = Boolean(fn(data));
    return { valid, errors: formatErrors(fn.errors) };
  };
}

export const validateRepositoryPin = makeValidator(ajv.compile(repositoryPinSchema));
export const validateSurfaceInventory = makeValidator(ajv.compile(surfaceInventorySchema));
export const validateCiteAnchors = makeValidator(ajv.compile(citeAnchorsSchema));
export const validateStructureEvidence = makeValidator(ajv.compile(structureEvidenceSchema));

export const validateWorkspacePointer = makeValidator(ajv.compile(workspacePointerSchema));
export const validateWorkspaceFile = makeValidator(ajv.compile(workspaceFileSchema));
export const validateDomainsFile = makeValidator(ajv.compile(domainsFileSchema));
export const validateSystemFile = makeValidator(ajv.compile(systemFileSchema));
export const validateComponentFile = makeValidator(ajv.compile(componentFileSchema));
export const validateContractsFile = makeValidator(ajv.compile(contractsFileSchema));
export const validateStoreFile = makeValidator(ajv.compile(storeFileSchema));
export const validateTopicFile = makeValidator(ajv.compile(topicFileSchema));
export const validateScreensFile = makeValidator(ajv.compile(screensFileSchema));
export const validateHandlersFile = makeValidator(ajv.compile(handlersFileSchema));
export const validateOrientationFile = makeValidator(ajv.compile(orientationFileSchema));
export const validateExternalFile = makeValidator(ajv.compile(externalFileSchema));
export const validateFlowFile = makeValidator(ajv.compile(flowFileSchema));

export const validatePlanManifest = makeValidator(ajv.compile(planManifestSchema));
export const validatePlanChanges = makeValidator(ajv.compile(planChangesSchema));
export const validatePlanDesign = makeValidator(ajv.compile(planDesignSchema));
export const validatePlanExecution = makeValidator(ajv.compile(planExecutionSchema));
export const validatePlanProof = makeValidator(ajv.compile(planProofSchema));
export const validateReviewNote = makeValidator(ajv.compile(reviewNoteSchema));
