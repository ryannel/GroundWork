import type { AnySchema } from "ajv";

const citeSchema = {
  oneOf: [
    { type: "string", minLength: 1 },
    {
      type: "object",
      additionalProperties: false,
      required: ["code"],
      properties: {
        code: { type: "string", minLength: 1 },
        symbol: { type: "string", minLength: 1 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["evidence"],
      properties: {
        evidence: { type: "string", minLength: 1 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["doc", "title", "retrieved_at"],
      properties: {
        doc: { type: "string", minLength: 1 },
        title: { type: "string", minLength: 1 },
        section: { type: "string" },
        version: { type: "string" },
        retrieved_at: { type: "string", minLength: 1 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["catalog", "source", "ref", "snapshot_at"],
      properties: {
        catalog: { type: "string", minLength: 1 },
        source: { type: "string", minLength: 1 },
        ref: { type: "string", minLength: 1 },
        snapshot_at: { type: "string", minLength: 1 },
        digest: { type: "string" },
      },
    },
  ],
};

export const workspacePointerSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/workspace-pointer.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "id", "root"],
  properties: {
    schema_version: { const: 1 },
    id: { type: "string", minLength: 1 },
    name: { type: "string" },
    root: { type: "string", minLength: 1 },
    repo: { type: "string" },
  },
};

export const workspaceFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/workspace.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "id", "name"],
  properties: {
    schema_version: { const: 1 },
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    description: { type: "string" },
    private: { type: "boolean" },
    projects: { type: "array", items: { type: "string", minLength: 1 } },
    repos: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string" },
          remote: { type: "string" },
          default_branch: { type: "string" },
        },
      },
    },
    teams: { type: "array", items: { type: "object", required: ["id", "name"] } },
    actors: { type: "array", items: { type: "object", required: ["id", "name", "summary"] } },
    organisations: { type: "array", items: { type: "object", required: ["id", "name"] } },
  },
};

export const domainsFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/domains.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "domains"],
  properties: {
    schema_version: { const: 1 },
    domains: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "purpose"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          purpose: { type: "string", minLength: 1 },
        },
      },
    },
  },
};

export const systemFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/system.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "purpose", "mapped"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    purpose: { type: "string", minLength: 1 },
    domain: { type: "string", minLength: 1 },
    team: { type: "string", minLength: 1 },
    mapped: { type: "boolean" },
    runs_on: { type: "array", items: { type: "string", minLength: 1 } },
    homes: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        required: ["repo"],
        properties: {
          repo: { type: "string", minLength: 1 },
          path: { type: "string" },
        },
      },
    },
    connections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["to", "says", "backs"],
        properties: {
          to: { type: "string", minLength: 1 },
          says: { type: "string", minLength: 1 },
          backs: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
        },
      },
    },
  },
};

export const componentFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/component.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "kind"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    kind: { enum: ["service", "app", "module"] },
    form: { enum: ["web", "mobile", "admin", "cli", "library", "runtime", "tool"] },
    tech: { type: "string" },
    home: { type: "string" },
    depth: { enum: ["stub", "contract-only", "module-boundary", "full"] },
    infrastructure: { type: "boolean" },
    uses: { type: "array", items: { type: "string", minLength: 1 } },
    depends_on: { type: "array", items: { type: "string", minLength: 1 } },
    public_modules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1 },
          summary: { type: "string" },
          cites: { type: "array", items: citeSchema },
        },
      },
    },
    invariants: { type: "array", items: { type: "string", minLength: 1 } },
    does: { type: "string" },
    cites: { type: "array", items: citeSchema },
    triage: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["surface", "disposition", "reason"],
        properties: {
          surface: { type: "string", minLength: 1 },
          disposition: { enum: ["operational", "dead_code", "test_only", "deferred"] },
          reason: { type: "string", minLength: 1 },
        },
      },
    },
    attestations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["facet", "state", "checked", "reason"],
        properties: {
          facet: {
            enum: ["interfaces", "stores", "messages_published", "messages_consumed", "jobs", "screens", "outbound_calls"],
          },
          state: { const: "verified_none" },
          checked: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
          reason: { type: "string", minLength: 1 },
        },
      },
    },
    observed_edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "to", "kind", "says", "reason", "cites"],
        properties: {
          id: { type: "string", minLength: 1 },
          to: { type: "string", minLength: 1 },
          kind: { enum: ["call", "publish", "consume", "read", "write"] },
          says: { type: "string", minLength: 1 },
          status: { enum: ["unpromoted", "unused_registration"] },
          reason: { type: "string", minLength: 1 },
          cites: { type: "array", minItems: 1, items: citeSchema },
        },
      },
    },
  },
};

export const contractsFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/contracts.schema.json",
  type: "object",
  additionalProperties: false,
  properties: {
    interfaces: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kind", "known_from", "entries"],
        properties: {
          id: { type: "string", minLength: 1 },
          kind: { enum: ["rest", "graphql", "grpc", "sdk", "websocket"] },
          known_from: { enum: ["implementation", "declared-spec", "consumer-observed", "vendor-doc"] },
          version: { type: "string" },
          base_path: { type: "string" },
          auth: { type: "string" },
          entries: {
            type: "array",
            items: {
              type: "object",
              required: ["id"],
              properties: {
                id: { type: "string", minLength: 1 },
                method: { type: "string" },
                path: { type: "string" },
                field: { type: "string" },
                signature: { type: "string" },
                rpc: { type: "string" },
                call: { type: "string" },
                summary: { type: "string" },
                auth: { type: "string" },
                idempotent: { type: "boolean" },
                request: { type: "string" },
                response: { type: "string" },
                surface: { type: "string" },
                errors: { type: "array" },
                cites: { type: "array", items: citeSchema },
              },
            },
          },
        },
      },
    },
    subscriptions: { type: "array", items: { type: "object", required: ["id", "message"] } },
    jobs: { type: "array", items: { type: "object", required: ["id"] } },
    interactions: { type: "array", items: { type: "object", required: ["id", "on", "action"] } },
    schemas: { type: "array", items: { type: "object", required: ["id", "kind", "fields"] } },
  },
};

export const storeFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/store.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "form", "owner"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    form: { enum: ["database", "cache", "bucket", "warehouse", "vector", "managed"] },
    tech: { type: "string" },
    owner: { type: "string", minLength: 1 },
    owner_cites: { type: "array", items: citeSchema },
    notes: { type: "string" },
    cites: { type: "array", items: citeSchema },
    records: { type: "array", items: { type: "object", required: ["id", "kind", "fields"] } },
  },
};

export const topicFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/topic.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "form", "owner"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    form: { enum: ["stream", "queue"] },
    tech: { type: "string" },
    owner: { type: "string", minLength: 1 },
    owner_cites: { type: "array", items: citeSchema },
    cites: { type: "array", items: citeSchema },
    messages: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "semantics"],
        properties: {
          id: { type: "string", minLength: 1 },
          payload: { type: "string" },
          key: { type: "string" },
          semantics: { enum: ["event", "command", "state"] },
          summary: { type: "string" },
          schema: { type: "object" },
          surface: { type: "string" },
          cites: { type: "array", items: citeSchema },
        },
      },
    },
  },
};

export const screensFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/screens.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["screens"],
  properties: {
    screens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kind"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string" },
          kind: { enum: ["page", "modal", "sheet", "print", "email"] },
          device: { type: "string" },
          route: { type: "string" },
          regions: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "name"],
              properties: { id: { type: "string" }, name: { type: "string" } },
            },
          },
          cites: { type: "array", items: citeSchema },
        },
      },
    },
  },
};

export const handlersFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/handlers.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["handlers"],
  properties: {
    procedures: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "summary", "steps"],
        properties: {
          id: { type: "string", minLength: 1 },
          summary: { type: "string", minLength: 1 },
          cite_base: { type: "string" },
          cites: { type: "array", items: citeSchema },
          steps: { type: "array" },
          failures: { type: "array" },
        },
      },
    },
    handlers: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "on", "summary", "steps"],
        properties: {
          id: { type: "string", minLength: 1 },
          on: { type: "string", minLength: 1 },
          summary: { type: "string", minLength: 1 },
          cite_base: { type: "string" },
          cites: { type: "array", items: citeSchema },
          steps: { type: "array" },
          failures: { type: "array" },
        },
      },
    },
  },
};

export const externalFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/external.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "summary"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    organisation: { type: "string" },
    summary: { type: "string", minLength: 1 },
    doc_root: { type: "string" },
  },
};

export const flowFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/flow.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "summary", "steps"],
  properties: {
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    actor: { type: "string" },
    steps: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "ref"],
        properties: {
          id: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          ref: { type: "string", minLength: 1 },
          note: { type: "string" },
        },
      },
    },
  },
};

export const orientationFileSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/orientation.schema.json",
  type: "object",
  additionalProperties: false,
  properties: {
    lifecycle: { type: "string", minLength: 1 },
    zones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "role", "summary", "paths"],
        properties: {
          id: { type: "string", pattern: "^[a-z0-9][a-z0-9-]*$" },
          name: { type: "string", minLength: 1 },
          role: { enum: ["core", "contract", "feature", "adapter", "infra", "diagnostic"] },
          summary: { type: "string", minLength: 1 },
          paths: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
        },
      },
    },
    start_here: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "why"],
        properties: {
          path: { type: "string", minLength: 1 },
          symbol: { type: "string", minLength: 1 },
          why: { type: "string", minLength: 1 },
        },
      },
    },
    traps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "cite"],
        properties: {
          title: { type: "string", minLength: 1 },
          detail: { type: "string", minLength: 1 },
          cite: citeSchema,
        },
      },
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label"],
        properties: {
          label: { type: "string", minLength: 1 },
          path: { type: "string", minLength: 1 },
          command: { type: "string", minLength: 1 },
          note: { type: "string" },
        },
      },
    },
  },
};
