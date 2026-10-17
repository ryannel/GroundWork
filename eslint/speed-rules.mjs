// Rules that keep pages light. A static page ships what it draws twice (as HTML, and as the payload React hydrates
// from), so drawing what the reader has not asked for costs every reader on every visit. See Speed in
// docs/architecture.md.

const isClientModule = (source) => /\.client(?:\.tsx)?$/u.test(source);

const isJsx = (node) => node?.type === 'JSXElement' || node?.type === 'JSXFragment';

/** The value a callback hands back: its expression body, or what any `return` in its block gives. */
function returnsJsx(fn) {
  if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') return false;
  if (fn.body.type !== 'BlockStatement') return isJsx(fn.body) || containsJsx(fn.body);
  return fn.body.body.some((s) => s.type === 'ReturnStatement' && containsJsx(s.argument));
}

function containsJsx(node) {
  if (node === null || node === undefined) return false;
  if (isJsx(node)) return true;
  if (node.type === 'ConditionalExpression') {
    return containsJsx(node.consequent) || containsJsx(node.alternate);
  }
  if (node.type === 'LogicalExpression') return containsJsx(node.right);
  if (node.type === 'ArrayExpression') return node.elements.some(containsJsx);
  return false;
}

/** What a name was given, when it is a `const` in reach: `views` in `const views = stops.map(…)`. */
function initOf(context, node) {
  let scope = context.sourceCode.getScope(node);
  while (scope !== null) {
    const variable = scope.set.get(node.name);
    if (variable !== undefined) {
      const def = variable.defs[0];
      return def?.type === 'Variable' && def.parent.kind === 'const' ? def.node.init : null;
    }
    scope = scope.upper;
  }
  return null;
}

/**
 * `xs.map((x) => <Thing />)`, `Object.fromEntries(xs.map((x) => [x, <Thing />]))`, an object holding two or more
 * drawings, or a `const` given one of these: a drawing per choice.
 */
function drawsPerChoice(context, node, depth = 0) {
  if (node === null || node === undefined || depth > 2) return false;
  if (node.type === 'Identifier') return drawsPerChoice(context, initOf(context, node), depth + 1);
  if (node.type === 'CallExpression') {
    const { callee } = node;
    const mapped =
      callee.type === 'MemberExpression' &&
      callee.property.type === 'Identifier' &&
      (callee.property.name === 'map' || callee.property.name === 'flatMap');
    if (mapped && node.arguments.some(returnsJsx)) return true;
    return node.arguments.some((a) => drawsPerChoice(context, a, depth + 1));
  }
  if (node.type === 'ObjectExpression') {
    return node.properties.filter((p) => p.type === 'Property' && containsJsx(p.value)).length > 1;
  }
  return false;
}

/**
 * A server component hands a client component one drawing, not one per choice the reader might make. A prop such as
 * `views={stops.map((s) => <Stop … />)}` or `bodies={{ asis: <A />, tobe: <B /> }}` puts every choice in the page
 * though the reader sees one at a time: draw once and let the client change what it shows, or draw the others in the
 * browser when asked. Children are left alone: what is drawn as children is on the page for all to see.
 */
export const onePerChoice = {
  meta: {
    type: 'problem',
    docs: { description: 'no drawing per choice handed to a client component as a prop' },
    schema: [],
    messages: {
      each: '`{{prop}}` hands {{component}} a drawing for every choice, and the page ships them all. Draw once and let the client change what it shows, or draw the rest in the browser when asked.',
    },
  },
  create(context) {
    if (/\.client\.tsx$/u.test(context.filename)) return {};
    const clients = new Set();
    return {
      ImportDeclaration(node) {
        if (!isClientModule(String(node.source.value))) return;
        for (const s of node.specifiers) clients.add(s.local.name);
      },
      JSXAttribute(node) {
        const element = node.parent;
        if (element.name.type !== 'JSXIdentifier' || !clients.has(element.name.name)) return;
        const value = node.value?.type === 'JSXExpressionContainer' ? node.value.expression : null;
        if (value === null || !drawsPerChoice(context, value)) return;
        context.report({
          node,
          messageId: 'each',
          data: { prop: String(node.name.name), component: element.name.name },
        });
      },
    };
  },
};

/**
 * `next/link` fetches every link as it scrolls into view, and `prefetch={false}` stops it fetching at all, so the
 * click waits. Neither is right for a page of many links: use IntentLink, which fetches when the reader reaches for it.
 */
export const linkPrefetch = {
  meta: {
    type: 'problem',
    docs: { description: 'no prefetch prop on next/link; use IntentLink for many links' },
    schema: [],
    messages: {
      prefetch:
        'Leave prefetch to Link (a few links) or use IntentLink from @/ui/intent-link.client (many links): prefetch={false} makes the click wait.',
    },
  },
  create(context) {
    let link = null;
    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'next/link') return;
        const named = node.specifiers.find((s) => s.type === 'ImportDefaultSpecifier');
        if (named !== undefined) link = named.local.name;
      },
      JSXAttribute(node) {
        const element = node.parent;
        if (link === null || element.name.type !== 'JSXIdentifier') return;
        if (element.name.name === link && node.name.name === 'prefetch') {
          context.report({ node, messageId: 'prefetch' });
        }
      },
    };
  },
};
