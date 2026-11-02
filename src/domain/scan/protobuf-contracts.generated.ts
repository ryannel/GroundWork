/* Generated from schema/protobuf-contracts.schema.json. */

export interface CanonicalProtobufContracts {
  format: 'canonical-protobuf-contracts/v1';
  repo: string;
  commit: string;
  source_inventory_sha256: string;
  compiler: Compiler;
  files: File[];
  limitations: string[];
  analysis_sha256: string;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "Compiler".
 */
export interface Compiler {
  status: 'available' | 'unavailable';
  protoc_version: string | null;
  python_protobuf_version: string | null;
  standard_include_root: string;
  standard_includes: StandardInclude[];
  reason: string;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "StandardInclude".
 */
export interface StandardInclude {
  path: string;
  sha256: string;
  lines: number;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "File".
 */
export interface File {
  path: string;
  sha256: string;
  anchor: Anchor;
  status: 'extracted' | 'compiler_failed' | 'compiler_unavailable';
  diagnostics: string;
  descriptor_sha256: string | null;
  package: string | null;
  syntax: string | null;
  imports: Import[];
  messages: Message[];
  enums: Enum[];
  services: Service[];
  unsupported: string[];
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "Anchor".
 */
export interface Anchor {
  path: string;
  sha256: string;
  /**
   * @minItems 2
   * @maxItems 2
   */
  lines: [number, number];
  /**
   * @minItems 2
   * @maxItems 2
   */
  columns: [number, number];
  descriptor_path: number[];
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "Import".
 */
export interface Import {
  path: string;
  public: boolean;
  weak: boolean;
  anchor: Anchor | null;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "Message".
 */
export interface Message {
  id: string;
  fq_name: string;
  map_entry: boolean;
  fields: Field[];
  nested_messages: Message[];
  enums: Enum[];
  oneofs: Oneof[];
  reserved_ranges: Range[];
  reserved_names: ReservedName[];
  extension_ranges: Range[];
  anchor: Anchor | null;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "Field".
 */
export interface Field {
  id: string;
  name: string;
  number: number;
  type: string;
  type_name: string;
  label: string;
  repeated: boolean;
  map: MapType | null;
  oneof: string | null;
  proto3_optional: boolean;
  json_name: string;
  default_value: string;
  anchor: Anchor | null;
  has_default_value: boolean;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "MapType".
 */
export interface MapType {
  key_type: string;
  value_type: string;
  value_type_name: string;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "Enum".
 */
export interface Enum {
  id: string;
  fq_name: string;
  values: EnumValue[];
  reserved_ranges: Range[];
  reserved_names: ReservedName[];
  anchor: Anchor | null;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "EnumValue".
 */
export interface EnumValue {
  id: string;
  name: string;
  number: number;
  anchor: Anchor | null;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "Range".
 */
export interface Range {
  start: number;
  end: number;
  end_semantics: 'exclusive' | 'inclusive';
  anchor: Anchor | null;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "ReservedName".
 */
export interface ReservedName {
  name: string;
  anchor: Anchor | null;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "Oneof".
 */
export interface Oneof {
  id: string;
  name: string;
  synthetic: boolean;
  field_ids: string[];
  anchor: Anchor | null;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "Service".
 */
export interface Service {
  id: string;
  fq_name: string;
  methods: Rpc[];
  anchor: Anchor | null;
}
/**
 * This interface was referenced by `CanonicalProtobufContracts`'s JSON-Schema
 * via the `definition` "Rpc".
 */
export interface Rpc {
  id: string;
  name: string;
  input_type: string;
  output_type: string;
  client_streaming: boolean;
  server_streaming: boolean;
  anchor: Anchor | null;
}
