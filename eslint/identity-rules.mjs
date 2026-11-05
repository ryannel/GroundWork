// Runtime model identities and Git-host links have one implementation each.
const PREFIXES = new Set(
  'team sys svc st sch if api msg flow chg tst wi ms dec risk q sc con stage scr graph sg gql ui uj h req dom app top lib ext sub job actor area jny plan prog ev rel term'.split(
    ' ',
  ),
);
const prefixSyntax = (text) => PREFIXES.has(text.split(':')[0]) && text.includes(':');
const gitSyntax = (text) =>
  /\/(?:blob|tree|issues|pull)\//u.test(text) ||
  /https?:\/\/(?:github\.com|gitlab\.com|bitbucket\.org)\/$/u.test(text);
const literal = (node) =>
  node?.type === 'Literal' && typeof node.value === 'string' ? node.value : '';
const method = (node) =>
  node.type === 'MemberExpression' && !node.computed ? node.property.name : '';

export const identityBoundary = {
  meta: {
    type: 'problem',
    docs: {
      description: 'model ids and Git-host links are built and parsed in their domain modules',
    },
    schema: [],
    messages: {
      id: 'Use src/domain/ids.ts to build or parse a model id.',
      url: 'Use src/domain/code-links.ts to build or parse a Git-host link.',
    },
  },
  create(context) {
    const file = context.filename.replaceAll('\\', '/');
    if (/\/domain\/(?:ids|code-links)\.ts$/u.test(file)) return {};
    // Test data deliberately contains invalid ids and links, and examples of rejected source code.
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file) || /\/(?:fixtures|eslint)\//u.test(file)) {
      return {};
    }
    const report = (node, messageId) => context.report({ node, messageId });
    return {
      TemplateLiteral(node) {
        if (node.expressions.length === 0) return;
        const parts = node.quasis.map((part) => part.value.cooked ?? '');
        if (prefixSyntax(parts[0] ?? '')) report(node, 'id');
        if (parts.some(gitSyntax)) report(node, 'url');
        const parent = context.sourceCode.getText(node.expressions[0]);
        if (
          parts[1] === '#' &&
          /id|schema|parent|sch|gid/iu.test(parent) &&
          !/href|url|asset/iu.test(parent)
        ) {
          report(node, 'id');
        }
      },
      BinaryExpression(node) {
        if (node.operator === '+' && prefixSyntax(literal(node.left))) report(node, 'id');
        if (node.operator === '+' && gitSyntax(literal(node.left))) report(node, 'url');
      },
      CallExpression(node) {
        const name = method(node.callee);
        const first = node.arguments[0];
        if (
          name === 'split' &&
          literal(first) === ':' &&
          /(?:^|\.)id$/iu.test(context.sourceCode.getText(node.callee.object))
        ) {
          report(node, 'id');
        }
        if (name === 'startsWith' && prefixSyntax(literal(first))) report(node, 'id');
        if (
          ['split', 'indexOf', 'includes'].includes(name) &&
          literal(first) === '#' &&
          !/url|href/iu.test(context.sourceCode.getText(node.callee.object))
        ) {
          report(node, 'id');
        }
        if (
          name === 'replace' &&
          first?.regex &&
          (prefixSyntax(first.regex.pattern.slice(1)) || first.regex.pattern.startsWith('^[a-z]+:'))
        ) {
          report(node, 'id');
        }
      },
      Literal(node) {
        if (node.regex && /github.*(?:blob|tree|issues|pull)/u.test(node.regex.pattern)) {
          report(node, 'url');
        }
      },
    };
  },
};
