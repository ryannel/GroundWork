import type { AnySchema } from "ajv";

export const repositoryPinSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/repository.schema.json",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "repo_name",
    "commit",
    "branch",
    "dirty",
    "scanned_at",
    "scanner_version",
    "package_roots",
  ],
  properties: {
    schema_version: { const: 1 },
    repo_name: { type: "string", minLength: 1 },
    remote: { type: "string" },
    commit: { type: "string", minLength: 7 },
    branch: { type: "string", minLength: 1 },
    dirty: { type: "boolean" },
    scanned_at: { type: "string", format: "date-time" },
    scanner_version: { type: "string", minLength: 1 },
    submodules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "name", "commit", "branch", "dirty"],
        properties: {
          path: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          remote: { type: "string" },
          commit: { type: "string", minLength: 7 },
          branch: { type: "string", minLength: 1 },
          dirty: { type: "boolean" },
        },
      },
    },
    package_roots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "name", "language", "manifest", "frameworks", "capabilities", "key_dependencies"],
        properties: {
          path: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          language: {
            enum: ["go", "typescript", "javascript", "python", "csharp", "java", "rust", "unknown"],
          },
          manifest: { type: "string", minLength: 1 },
          submodule_path: { type: "string" },
          repo_name: { type: "string" },
          workspace_dependencies: { type: "array", items: { type: "string" } },
          frameworks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "facet", "support", "source"],
              properties: {
                name: { type: "string", minLength: 1 },
                version: { type: "string" },
                facet: {
                  enum: [
                    "interfaces",
                    "stores",
                    "messages_published",
                    "messages_consumed",
                    "jobs",
                    "screens",
                    "outbound_calls",
                  ],
                },
                support: { enum: ["supported", "partial", "unsupported"] },
                source: { type: "string", minLength: 1 },
              },
            },
          },
          capabilities: {
            type: "object",
            additionalProperties: false,
            required: [
              "interfaces",
              "stores",
              "messages_published",
              "messages_consumed",
              "jobs",
              "screens",
              "outbound_calls",
            ],
            properties: {
              interfaces: { enum: ["supported", "partial", "unsupported"] },
              stores: { enum: ["supported", "partial", "unsupported"] },
              messages_published: { enum: ["supported", "partial", "unsupported"] },
              messages_consumed: { enum: ["supported", "partial", "unsupported"] },
              jobs: { enum: ["supported", "partial", "unsupported"] },
              screens: { enum: ["supported", "partial", "unsupported"] },
              outbound_calls: { enum: ["supported", "partial", "unsupported"] },
            },
          },
          key_dependencies: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
};

export const surfaceInventorySchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/inventory.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "repo_name", "commit", "scanned_at", "summary", "surfaces", "cross_checks"],
  properties: {
    schema_version: { const: 1 },
    repo_name: { type: "string", minLength: 1 },
    commit: { type: "string", minLength: 7 },
    scanned_at: { type: "string", format: "date-time" },
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["total_surfaces", "by_kind", "by_denominator", "by_package"],
      properties: {
        total_surfaces: { type: "integer", minimum: 0 },
        by_kind: { type: "object", additionalProperties: { type: "integer", minimum: 0 } },
        by_denominator: {
          type: "object",
          additionalProperties: false,
          required: ["declarative_spec", "source_heuristic", "infra_manifest"],
          properties: {
            declarative_spec: { type: "integer", minimum: 0 },
            source_heuristic: { type: "integer", minimum: 0 },
            infra_manifest: { type: "integer", minimum: 0 },
          },
        },
        by_package: { type: "object", additionalProperties: { type: "integer", minimum: 0 } },
      },
    },
    surfaces: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["surface_id", "kind", "facet", "package_root", "denominator", "extractor", "file"],
        properties: {
          surface_id: { type: "string", minLength: 1 },
          kind: {
            enum: ["route", "ws_channel", "topic", "subscription", "table", "job", "screen", "outbound_call", "module_export", "module_dep"],
          },
          facet: {
            enum: [
              "interfaces",
              "stores",
              "messages_published",
              "messages_consumed",
              "jobs",
              "screens",
              "outbound_calls",
            ],
          },
          package_root: { type: "string", minLength: 1 },
          repo_name: { type: "string" },
          denominator: { enum: ["declarative_spec", "source_heuristic", "infra_manifest"] },
          extractor: { type: "string", minLength: 1 },
          file: { type: "string", minLength: 1 },
          lines: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: { type: "integer", minimum: 1 },
          },
          symbol: { type: "string" },
          details: { type: "object" },
        },
      },
    },
    cross_checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["facet", "scope", "spec_count", "code_count", "matched", "spec_only", "code_only"],
        properties: {
          facet: {
            enum: [
              "interfaces",
              "stores",
              "messages_published",
              "messages_consumed",
              "jobs",
              "screens",
              "outbound_calls",
            ],
          },
          scope: { type: "string", minLength: 1 },
          spec_count: { type: "integer", minimum: 0 },
          code_count: { type: "integer", minimum: 0 },
          matched: { type: "integer", minimum: 0 },
          spec_only: { type: "array", items: { type: "object" } },
          code_only: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
};

export const citeAnchorsSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/cite-anchors.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "repo_name", "commit", "anchors"],
  properties: {
    schema_version: { const: 1 },
    repo_name: { type: "string", minLength: 1 },
    commit: { type: "string", minLength: 7 },
    anchors: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        required: ["file", "lines", "content_sha256"],
        properties: {
          file: { type: "string", minLength: 1 },
          lines: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: { type: "integer", minimum: 1 },
          },
          symbol: { type: "string" },
          content_sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
        },
      },
    },
  },
};

const structureEntrypointSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "name", "kind"],
  properties: {
    path: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    kind: { enum: ["binary", "library", "script", "container", "harness"] },
    command: { type: "string" },
    summary: { type: "string" },
  },
};

export const structureEvidenceSchema: AnySchema = {
  $id: "https://groundwork.local/schema/v1/structure.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "repo_name", "commit", "scanned_at", "packages"],
  properties: {
    schema_version: { const: 1 },
    repo_name: { type: "string", minLength: 1 },
    commit: { type: "string", minLength: 7 },
    scanned_at: { type: "string", format: "date-time" },
    workspace_harnesses: {
      type: "array",
      items: structureEntrypointSchema,
    },
    packages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "package_root",
          "name",
          "language",
          "total_files",
          "source_files",
          "total_loc",
          "tier",
          "entrypoints",
          "modules",
          "tech_stack",
        ],
        properties: {
          package_root: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          language: {
            enum: ["go", "typescript", "javascript", "python", "csharp", "java", "rust", "unknown"],
          },
          repo_name: { type: "string" },
          web_url: { type: "string" },
          git_ref: { type: "string" },
          repo_subpath: { type: "string" },
          doc_summary: { type: "string" },
          total_files: { type: "integer", minimum: 0 },
          source_files: { type: "integer", minimum: 0 },
          total_loc: { type: "integer", minimum: 0 },
          tier: { enum: ["compact", "standard", "deep"] },
          entrypoints: {
            type: "array",
            items: structureEntrypointSchema,
          },
          modules: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["path", "name", "kind", "visibility", "file_count", "source_files", "loc"],
              properties: {
                path: { type: "string", minLength: 1 },
                name: { type: "string", minLength: 1 },
                kind: { enum: ["dir", "file"] },
                visibility: { enum: ["public", "hidden", "internal", "test", "asset"] },
                file_count: { type: "integer", minimum: 0 },
                source_files: { type: "integer", minimum: 0 },
                loc: { type: "integer", minimum: 0 },
                asset_counts: {
                  type: "object",
                  additionalProperties: { type: "integer", minimum: 0 },
                },
                doc_summary: { type: "string" },
              },
            },
          },
          flags: {
            type: "array",
            items: { type: "string" },
          },
          tech_stack: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["category", "items"],
              properties: {
                category: { type: "string", minLength: 1 },
                items: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  },
};
