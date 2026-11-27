import type { AnySchema } from "ajv";

export const planManifestSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/plan-manifest.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "id", "title", "status", "problem", "pillars"],
  properties: {
    schema_version: { const: 1 },
    id: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    status: { enum: ["draft", "ready", "executing", "landed", "abandoned"] },
    date: { type: "string" },
    builds_on: { type: "array", items: { type: "string", minLength: 1 } },
    problem: {
      type: "object",
      additionalProperties: false,
      required: ["summary"],
      properties: {
        summary: { type: "string", minLength: 1 },
        why: { type: "string" },
        non_goals: { type: "array", items: { type: "string" } },
      },
    },
    pillars: {
      type: "object",
      additionalProperties: false,
      required: ["architecture", "design", "execution", "proof"],
      properties: {
        architecture: {
          type: "object",
          additionalProperties: false,
          required: ["file"],
          properties: {
            file: { type: "string", minLength: 1 },
            additions: { type: "string" },
          },
        },
        design: {
          oneOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["applicable", "file"],
              properties: {
                applicable: { const: true },
                file: { type: "string", minLength: 1 },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["applicable", "reason"],
              properties: {
                applicable: { const: false },
                reason: { type: "string", minLength: 1 },
              },
            },
          ],
        },
        execution: {
          type: "object",
          additionalProperties: false,
          required: ["file"],
          properties: {
            file: { type: "string", minLength: 1 },
            progress: { type: "string" },
          },
        },
        proof: {
          type: "object",
          additionalProperties: false,
          required: ["file"],
          properties: {
            file: { type: "string", minLength: 1 },
          },
        },
      },
    },
    signoffs: { type: "object" },
    questions: { type: "array" },
    decisions: { type: "array" },
    risks: { type: "array" },
  },
};

export const planChangesSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/plan-changes.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "changes"],
  properties: {
    schema_version: { const: 1 },
    relies_on: { type: "array", items: { type: "string", minLength: 1 } },
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title"],
        properties: {
          id: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          why: { type: "string" },
          requires: { type: "array" },
          blocked_by: { type: "array", items: { type: "string" } },
          ops: { type: "array" },
        },
      },
    },
  },
};

export const planDesignSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/plan-design.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "design_system", "screens"],
  properties: {
    schema_version: { const: 1 },
    design_system: { enum: ["inherit", "extend", "new", "code-cited"] },
    design_system_source: {},
    tokens_patch: { type: "string" },
    flows: { type: "array" },
    screens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["screen", "prototype", "fidelity", "states"],
        properties: {
          screen: { type: "string", minLength: 1 },
          prototype: { type: "string", minLength: 1 },
          baseline: { type: "string" },
          fidelity: { enum: ["low", "mid", "high"] },
          viewports: { type: "array", items: { type: "string" } },
          states: { type: "array", minItems: 1 },
          a11y: { type: "object" },
          bindings: { type: "array" },
        },
      },
    },
  },
};

export const planExecutionSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/plan-execution.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "milestones", "work_items"],
  properties: {
    schema_version: { const: 1 },
    milestones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          due: { type: "string" },
          after: { type: "array", items: { type: "string" } },
        },
      },
    },
    work_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "milestone", "target"],
        properties: {
          id: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          milestone: { type: "string", minLength: 1 },
          team: { type: "string" },
          target: {
            oneOf: [
              { type: "object", additionalProperties: false, required: ["repo"], properties: { repo: { type: "string", minLength: 1 } } },
              { type: "object", additionalProperties: false, required: ["new_repo"], properties: { new_repo: { type: "string", minLength: 1 } } },
              { type: "object", additionalProperties: false, required: ["external"], properties: { external: { type: "string", minLength: 1 } } },
            ],
          },
          external_ref: { type: "string" },
          implements: { type: "array", items: { type: "string" } },
          verified_by: { type: "array", items: { type: "string" } },
          verification_none_reason: { type: "string" },
          depends_on: { type: "array", items: { type: "string" } },
          blocked_by: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

export const planProofSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/plan-proof.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "tests"],
  properties: {
    schema_version: { const: 1 },
    tests: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "level", "name", "env", "proves"],
        properties: {
          id: { type: "string", minLength: 1 },
          level: { enum: ["unit", "contract", "integration", "service", "e2e", "manual"] },
          name: { type: "string", minLength: 1 },
          env: { enum: ["local", "ci", "staging", "prod"] },
          proves: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
          given: { type: "string" },
          when: { type: "string" },
          then: {},
          owner: { type: "string" },
          cites: { type: "array" },
          manual_signoff: { type: "object" },
        },
      },
    },
  },
};

export const reviewNoteSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/review-note.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "id", "target_id", "author", "created_at", "status", "body"],
  properties: {
    schema_version: { const: 1 },
    id: { type: "string", minLength: 1 },
    target_id: { type: "string", minLength: 1 },
    author: { type: "string", minLength: 1 },
    created_at: { type: "string", minLength: 1 },
    status: { enum: ["open", "resolved"] },
    anchor_hash: { type: "string" },
    body: { type: "string", minLength: 1 },
  },
};
