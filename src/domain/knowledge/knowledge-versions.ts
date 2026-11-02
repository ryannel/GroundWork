import type { KnowledgeSnapshot, QueryRequest, QueryResponse } from './knowledge.generated';

export function queryRules(request: QueryRequest): KnowledgeSnapshot['rules'] {
  switch (request.format) {
    case 'groundwork-query/v1': {
      return 'knowledge-query/v1';
    }
    case 'groundwork-query/v2': {
      return 'knowledge-query/v2';
    }
    case 'groundwork-query/v3': {
      return 'knowledge-query/v3';
    }
  }
}

export function versionFormats(rules: KnowledgeSnapshot['rules']): {
  readonly snapshot: KnowledgeSnapshot['format'];
  readonly result: QueryResponse['format'];
} {
  switch (rules) {
    case 'knowledge-query/v1': {
      return { snapshot: 'groundwork-snapshot/v1', result: 'groundwork-result/v1' };
    }
    case 'knowledge-query/v2': {
      return { snapshot: 'groundwork-snapshot/v2', result: 'groundwork-result/v2' };
    }
    case 'knowledge-query/v3': {
      return { snapshot: 'groundwork-snapshot/v3', result: 'groundwork-result/v3' };
    }
  }
}
