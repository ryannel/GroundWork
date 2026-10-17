// Data is read, not changed: every property of a type, and every array a type or a parameter holds, is readonly.
// Build a new value instead of editing one. A local variable may still be a mutable array while it is built.

const isReadonlyOperator = (node) =>
  node?.type === 'TSTypeOperator' && node.operator === 'readonly';

/** Does this array type sit in a property, an index signature or a parameter, where it is shared? */
function isShared(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    switch (parent.type) {
      case 'TSPropertySignature':
      case 'TSIndexSignature': {
        return true;
      }
      case 'TSTypeAnnotation': {
        const owner = parent.parent;
        if (owner?.type === 'TSPropertySignature' || owner?.type === 'TSIndexSignature') {
          return true;
        }
        if (
          owner?.type === 'Identifier' ||
          owner?.type === 'ObjectPattern' ||
          owner?.type === 'ArrayPattern' ||
          owner?.type === 'RestElement' ||
          owner?.type === 'AssignmentPattern'
        ) {
          return isParameter(owner);
        }
        return false;
      }
      case 'TSTypeAliasDeclaration':
      case 'TSInterfaceBody': {
        return true;
      }
      case 'VariableDeclarator':
      case 'TSAsExpression':
      case 'TSSatisfiesExpression': {
        return false;
      }
      default: {
        break;
      }
    }
  }
  return false;
}

function isParameter(node) {
  let current = node;
  while (current.parent?.type === 'AssignmentPattern' || current.parent?.type === 'RestElement') {
    current = current.parent;
  }
  const fn = current.parent;
  return (
    (fn?.type === 'FunctionDeclaration' ||
      fn?.type === 'FunctionExpression' ||
      fn?.type === 'ArrowFunctionExpression' ||
      fn?.type === 'TSDeclareFunction') &&
    fn.params.includes(current)
  );
}

// an array of arrays needs brackets: (readonly string[])[], not readonly string[][]
const wrapped = (node, type) =>
  node.parent?.type === 'TSArrayType' ? `(readonly ${type})` : `readonly ${type}`;

export const readonlyTypes = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: { description: 'properties, index signatures and shared arrays are readonly' },
    schema: [],
    messages: {
      property: 'Make `{{name}}` readonly: build a new value rather than changing this one.',
      index: 'Make the index signature readonly.',
      array: 'Use `readonly {{type}}`: a shared array is read, not changed.',
      generic: 'Use `{{readonly}}<…>`: a shared collection is read, not changed.',
    },
  },
  create(context) {
    const source = context.sourceCode;
    const GENERIC = new Map([
      ['Array', 'ReadonlyArray'],
      ['Map', 'ReadonlyMap'],
      ['Set', 'ReadonlySet'],
    ]);
    return {
      TSPropertySignature(node) {
        if (node.readonly) return;
        const name = source.getText(node.key);
        context.report({
          node: node.key,
          messageId: 'property',
          data: { name },
          fix: (fixer) =>
            fixer.insertTextBefore(
              node.computed ? source.getTokenBefore(node.key) : node.key,
              'readonly ',
            ),
        });
      },
      TSIndexSignature(node) {
        if (node.readonly) return;
        context.report({
          node,
          messageId: 'index',
          fix: (fixer) => fixer.insertTextBefore(node, 'readonly '),
        });
      },
      TSArrayType(node) {
        if (isReadonlyOperator(node.parent) || !isShared(node)) return;
        const type = source.getText(node);
        context.report({
          node,
          messageId: 'array',
          data: { type },
          fix: (fixer) => fixer.replaceText(node, wrapped(node, type)),
        });
      },
      TSTupleType(node) {
        if (isReadonlyOperator(node.parent) || !isShared(node)) return;
        const type = source.getText(node);
        context.report({
          node,
          messageId: 'array',
          data: { type },
          fix: (fixer) => fixer.replaceText(node, wrapped(node, type)),
        });
      },
      TSTypeReference(node) {
        if (node.typeName.type !== 'Identifier') return;
        const readonly = GENERIC.get(node.typeName.name);
        if (readonly === undefined || !isShared(node)) return;
        context.report({
          node,
          messageId: 'generic',
          data: { readonly },
          fix: (fixer) => fixer.replaceText(node.typeName, readonly),
        });
      },
    };
  },
};
