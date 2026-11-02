import { describe, expect, it, vi } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';
import type { FrameworkRecord, CsharpSymbolBinding, Contract } from '@/domain/scan/scan.generated';

import { bindingReviewDocument, bindingReviewPages } from './scan-bindings-pages';

vi.mock(import('server-only'), () => ({}));

describe('schema collection preservation across public pages', () => {
  it('retains ASP.NET, Python/Rust framework, compiler bindings and schema contracts', () => {
    const document = scanFixture();
    const framework: FrameworkRecord[] = [
      {
        kind: 'aspnet_route_binding',
        id: 'route:aspnet',
        source: 'source:handler',
        support: ['source:handler'],
        controller: 'Controller',
        method: 'Get',
        httpMethods: ['GET'],
        template: '/items',
        parameters: [],
        status: 'source_declared',
        limitations: ['Runtime unverified'],
        input_contract_ids: [],
        output_contract_ids: ['contract:dto'],
      },
      {
        kind: 'source_framework_binding',
        id: 'route:python',
        source: 'source:handler',
        support: ['source:handler'],
        language: 'python',
        framework: 'fastapi',
        role: 'http_entry',
        name: 'items',
        target_source: 'source:handler',
        declaration: '@router.get',
        status: 'source_declared',
        limitations: ['Runtime unverified'],
      },
    ];
    const binding: CsharpSymbolBinding = {
      kind: 'csharp_symbol_binding',
      id: 'binding:call',
      source: 'source:handler',
      target: 'source:handler',
      owner: 'source:handler',
      relation: 'call_target',
      symbol: 'Get',
      dispatch: 'exact',
      arguments: [],
      limitations: ['Runtime unverified'],
      boundary: 'unclassified',
      completion: 'returned',
      configurationSources: [],
      conditions: [],
    };
    const contract: Contract = {
      kind: 'contract',
      id: 'contract:dto',
      shape: { kind: 'scalar', name: 'string', spelling: 'string' },
      support: ['source:handler'],
    };
    const input = { ...document, framework, bindings: [binding], contracts: [contract] };
    const ids = [...framework.map((record) => record.id), binding.id, contract.id];
    const restored = bindingReviewDocument('scan:roundtrip', bindingReviewPages(input, ids));
    expect(restored.framework).toEqual(framework);
    expect(restored.bindings).toEqual([binding]);
    expect(restored.contracts).toEqual([contract]);
    expect(restored.semantic).toEqual([]);
  });
});
