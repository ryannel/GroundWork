import type { DepthResult } from './scan-benchmark-depth-facts';
import { addressResponse, addressWire } from './scan-depth-next-address';
import { incomeCallback, incomeResponse } from './scan-depth-next-income';
import { serverLineage, serverOutput } from './scan-depth-next-server';
import type { SemanticGraph } from './scan-semantic-query';

export function evaluateNextDepth(
  graph: SemanticGraph,
  rootSummaryId: string,
  checkId: string,
): DepthResult | undefined {
  switch (checkId) {
    case 'ts-address-callback-and-wire': {
      return addressWire(graph, checkId);
    }
    case 'ts-address-response-and-availability': {
      return addressResponse(graph, checkId);
    }
    case 'ts-income-callback-not-awaiting': {
      return incomeCallback(graph, checkId);
    }
    case 'ts-income-response-to-onNext': {
      return incomeResponse(graph, checkId);
    }
    case 'ts-server-lineage-and-hops': {
      return serverLineage(graph, rootSummaryId, checkId);
    }
    case 'ts-server-failure-and-output': {
      return serverOutput(graph, rootSummaryId, checkId);
    }
    default: {
      return undefined;
    }
  }
}
