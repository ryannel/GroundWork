import { expect, it } from 'vitest';

import type { ModelEntity, ModelRepository } from '@/domain/workspace-model';

import { routeContracts } from './contracts';

const place = {
  workspace: 'fixture',
  domain: 'dom:orders',
  system: 'sys:orders',
  component: 'svc:orders',
};
function entity(id: string, kind: ModelEntity['kind'], data: ModelEntity['data']): ModelEntity {
  return { id, kind, data, parent: null, place };
}

const cite = (id: string) => [{ kind: 'evidence', id }];
const entry = entity('api:orders', 'endpoint', {
  method: 'POST',
  path: '/orders',
  cites: cite('ev:route'),
});
const request = entity('sch:create-order', 'schema', { cites: cite('ev:input-contract') });
const response = entity('sch:order', 'schema', { cites: cite('ev:output-contract') });
const repository: Pick<ModelRepository, 'records'> = {
  records: [
    {
      family: 'framework',
      data: {
        kind: 'aspnet_route_binding',
        id: 'ev:route',
        source: 'ev:source',
        cites: ['ev:source'],
        controller: 'Orders',
        method: 'Create',
        httpMethods: ['POST'],
        template: '/orders',
        parameters: [],
        status: 'source_declared',
        limitations: ['Runtime deployment is not observed.'],
        input_contract_ids: ['ev:input-contract'],
        output_contract_ids: ['ev:output-contract'],
      },
    },
  ],
};

it('fills shapes only when a cited route and a unique declared schema agree', () => {
  expect(
    routeContracts({ entities: [entry, request, response] }, repository).get(entry.id),
  ).toEqual({
    values: { request: request.id, response: response.id },
    cites: ['ev:route'],
  });
  const other = entity('sch:other', 'schema', request.data);
  expect(
    routeContracts({ entities: [entry, request, other, response] }, repository).get(entry.id),
  ).toEqual({
    values: { response: response.id },
    cites: ['ev:route'],
  });
  expect(
    routeContracts(
      {
        entities: [entity(entry.id, 'endpoint', { ...entry.data, cites: [] }), request, response],
      },
      repository,
    ).size,
  ).toBe(0);
});
