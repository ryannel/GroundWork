import { describe, expect, it, vi } from 'vitest';

import { protobufSourceUrl } from '@/domain/scan/protobuf-contracts';

import { captureProtobufContracts } from './protobuf-contracts-capture';
import { probeProtobufCompiler } from './protobuf-contracts-compiler';
import { validateProtobufContracts } from './protobuf-contracts-format';
import { verifyProtobufContractDescriptors } from './protobuf-contracts-verification';

vi.mock(import('server-only'), () => ({}));

const compiler = {
  protoc: '/opt/homebrew/bin/protoc',
  python: '/usr/local/bin/python3',
  standardIncludeRoot: '/opt/homebrew/include',
};
const availability = await probeProtobufCompiler(compiler);
const source = {
  path: 'nested/envelope.proto',
  bytes: `syntax = "proto3";
package sample;
import "google/protobuf/timestamp.proto";
message Envelope {
  reserved 4 to 6;
  reserved "old";
  message Child { string value = 1; }
  enum Kind { UNKNOWN = 0; READY = 1; }
  map<string, Child> children = 1;
  oneof choice { string name = 2; int64 counter = 3; }
  optional bool enabled = 7;
  google.protobuf.Timestamp created = 8;
  Kind kind = 9;
}
service Stream { rpc Watch(Envelope) returns (stream Envelope); }
`,
};
const input = {
  repo: 'fixture/contracts',
  commit: 'a'.repeat(40),
  sources: [source],
  compiler,
  analysisSha256: 'b'.repeat(64),
};

describe('canonical protobuf declaration compilation', () => {
  it.skipIf(availability.status !== 'available')(
    'retains nested fields, maps, oneofs, enums, reserved declarations, imports and RPC source anchors',
    async () => {
      const capture = await captureProtobufContracts(input);
      const file = capture.document.files[0]!;
      expect(file.status).toBe('extracted');
      const message = file.messages[0]!;
      expect(message.fq_name).toBe('.sample.Envelope');
      expect(message.nested_messages.map((item) => item.fq_name)).toContain(
        '.sample.Envelope.Child',
      );
      expect(message.fields[0]).toMatchObject({
        name: 'children',
        number: 1,
        repeated: true,
        map: { key_type: 'TYPE_STRING', value_type_name: '.sample.Envelope.Child' },
      });
      expect(message.oneofs.find((item) => item.name === 'choice')).toMatchObject({
        synthetic: false,
        field_ids: [
          'fixture/contracts:nested/envelope.proto#.sample.Envelope.name',
          'fixture/contracts:nested/envelope.proto#.sample.Envelope.counter',
        ],
      });
      expect(message.fields.find((item) => item.name === 'enabled')).toMatchObject({
        proto3_optional: true,
        anchor: { lines: [11, 11] },
      });
      expect(message.oneofs.some((item) => item.synthetic)).toBe(true);
      expect(message.reserved_ranges[0]).toMatchObject({
        start: 4,
        end: 7,
        end_semantics: 'exclusive',
      });
      expect(message.reserved_names[0]?.name).toBe('old');
      expect(message.enums[0]?.values.map((value) => value.number)).toEqual([0, 1]);
      expect(file.services[0]?.methods[0]).toMatchObject({
        input_type: '.sample.Envelope',
        output_type: '.sample.Envelope',
        server_streaming: true,
      });
      expect(file.imports[0]).toMatchObject({
        path: 'google/protobuf/timestamp.proto',
        anchor: { lines: [3, 3] },
      });
      expect(capture.document.compiler.standard_includes[0]?.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(protobufSourceUrl(capture.document, message.fields[0]!.anchor!)).toContain(
        `/blob/${input.commit}/nested/envelope.proto#L9-L9`,
      );
      await expect(
        verifyProtobufContractDescriptors(capture.document, {
          sources: input.sources,
          descriptors: capture.descriptors,
          compiler,
        }),
      ).resolves.toEqual(capture.document);
    },
  );

  it.skipIf(availability.status !== 'available')(
    'preserves an import failure in the source denominator without guessing aliases',
    async () => {
      const missing = {
        path: 'missing.proto',
        bytes: 'syntax = "proto3"; import "Protos/absent.proto"; message Pending {}\n',
      };
      const capture = await captureProtobufContracts({ ...input, sources: [source, missing] });
      expect(capture.document.files.map((file) => file.status)).toEqual([
        'extracted',
        'compiler_failed',
      ]);
      expect(capture.document.files[1]).toMatchObject({
        path: 'missing.proto',
        descriptor_sha256: null,
        messages: [],
      });
      expect(capture.document.files[1]?.diagnostics).toContain('Protos/absent.proto');
    },
  );

  it('reports unavailable local compiler dependencies explicitly', async () => {
    const capture = await captureProtobufContracts({
      ...input,
      compiler: { ...compiler, protoc: '/unavailable/protoc' },
    });
    expect(capture.document.compiler.status).toBe('unavailable');
    expect(capture.document.files[0]).toMatchObject({
      status: 'compiler_unavailable',
      descriptor_sha256: null,
      messages: [],
    });
  });

  it.skipIf(availability.status !== 'available')(
    'rejects changed source bytes, hashes and exact in-bounds source anchors',
    async () => {
      const capture = await captureProtobufContracts(input);
      await expect(
        validateProtobufContracts(capture.document, [
          { ...source, bytes: `${source.bytes}// altered\n` },
        ]),
      ).rejects.toThrow('digest');
      const changed = structuredClone(capture.document);
      changed.files[0]!.messages[0]!.fields[0]!.anchor!.sha256 = '0'.repeat(64);
      await expect(validateProtobufContracts(changed, input.sources)).rejects.toThrow('anchor');
      const moved = structuredClone(capture.document);
      moved.files[0]!.messages[0]!.fields[0]!.anchor!.lines = [8, 8];
      await expect(
        verifyProtobufContractDescriptors(moved, {
          sources: input.sources,
          descriptors: capture.descriptors,
          compiler,
        }),
      ).rejects.toThrow('SourceCodeInfo');
    },
  );
});
