import type { SemanticEdge, SemanticNode } from './scan.generated';

type NodeKind = SemanticNode['nodeKind'];
type Relation = SemanticEdge['relation'];
const expressionKinds: readonly NodeKind[] = [
  'identifier',
  'literal',
  'member',
  'index',
  'call',
  'construct',
  'object',
  'array',
  'property',
  'binary',
  'unary',
  'conditional',
  'template',
  'function',
  'expression',
  'field',
  'await',
  'callback',
  'unknown',
  'value',
  'invocation',
  'assignment',
  'jsx_element',
];
const roles: Partial<Record<Relation, readonly NodeKind[]>> = {
  receiver: ['member', 'call', 'invocation', 'index', 'type', 'function', 'expression'],
  callee: ['call', 'invocation', 'construct', 'jsx_element'],
  argument: ['call', 'invocation', 'construct', 'annotation', 'index'],
  left: ['binary', 'assignment'],
  right: ['binary', 'assignment'],
  operand: ['binary', 'unary', 'await', 'conditional', 'template', 'expression'],
  condition: ['if', 'conditional', 'loop', 'branch', 'control', 'catch'],
  consequent: ['if', 'conditional', 'branch', 'control'],
  otherwise: ['if', 'conditional', 'branch', 'control'],
  try_body: ['try'],
  catches: ['try'],
  catch: ['try'],
  finally: ['try'],
  deferred: ['defer'],
  assigns: ['assignment', 'declaration', 'variable'],
  assigned_value: ['assignment', 'identifier', 'index', 'member', 'unary'],
  returns: ['return', 'function'],
  parameter: ['function', 'callback', 'declaration', 'catch', 'expression', 'type'],
  declared_type: [
    'function',
    'catch',
    'parameter',
    'declaration',
    'variable',
    'field',
    'type',
    'object',
    'expression',
  ],
  initialiser: [
    'declaration',
    'variable',
    'parameter',
    'field',
    'property',
    'jsx_attribute',
    'if',
    'control',
  ],
  initializer: [
    'declaration',
    'variable',
    'parameter',
    'field',
    'property',
    'jsx_attribute',
    'if',
    'control',
  ],
  column_binding: ['sql_column'],
  available_when: ['jsx_element', 'jsx_attribute'],
};
const targets: Partial<Record<Relation, readonly NodeKind[]>> = {
  receiver: expressionKinds,
  callee: expressionKinds,
  argument: [...expressionKinds, 'block'],
  condition: expressionKinds,
  catches: ['catch'],
  catch: ['catch'],
  finally: ['finally', 'block'],
  parameter: ['parameter'],
  declared_type: ['type'],
  annotation: ['annotation'],
  reaching_definition: ['assignment', 'declaration', 'variable', 'parameter', 'field'],
  reaching_value: ['identifier'],
  column_binding: expressionKinds,
  scheduling_unknown: ['runtime_boundary', 'policy'],
  delivery_unknown: ['runtime_boundary', 'policy'],
  rollback_unknown: ['runtime_boundary', 'policy'],
  registry_context_unknown: ['runtime_boundary', 'policy'],
};

export function semanticRoleErrors(
  edge: SemanticEdge,
  endpoints: { readonly from: SemanticNode | undefined; readonly to: SemanticNode | undefined },
): string[] {
  const errors: string[] = [];
  const fromKinds = roles[edge.relation];
  const toKinds = targets[edge.relation];
  errors.push(...dereferenceErrors(edge, endpoints.from));
  if (fromKinds && (!endpoints.from || !fromKinds.includes(endpoints.from.nodeKind))) {
    errors.push(`${edge.id}: invalid ${edge.relation} origin kind`);
  }
  if (toKinds && (!endpoints.to || !toKinds.includes(endpoints.to.nodeKind))) {
    errors.push(`${edge.id}: invalid ${edge.relation} target kind`);
  }
  if (
    ['argument', 'parameter', 'sql_parameter', 'column_binding'].includes(edge.relation) &&
    edge.position === undefined
  ) {
    errors.push(`${edge.id}: ${edge.relation} requires position`);
  }
  if (edge.relation === 'column_binding' && edge.label === undefined) {
    errors.push(`${edge.id}: column binding requires column label`);
  }
  return errors;
}

function dereferenceErrors(edge: SemanticEdge, from: SemanticNode | undefined): string[] {
  if (edge.relation !== 'assigned_value' || from?.nodeKind !== 'unary' || from.operator === '*') {
    return [];
  }
  return [`${edge.id}: assigned_value unary target requires pointer dereference`];
}
