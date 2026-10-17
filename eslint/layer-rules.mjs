// Rules that keep each layer's files honest about what they are. See docs/architecture.md.
import path from 'node:path';

const rel = (context) => path.relative(context.cwd, context.filename).split(path.sep).join('/');
const isTest = (file) => /\.(?:test|spec)\.tsx?$/u.test(file);

// What a Next.js route file may export. Anything else is logic that belongs in a feature or application.
const ROUTE_EXPORTS = new Set([
  'default',
  'generateStaticParams',
  'generateMetadata',
  'metadata',
  'generateViewport',
  'viewport',
  'dynamicParams',
  'dynamic',
  'GET',
  'generateSitemaps',
  'generateImageMetadata',
  'alt',
  'size',
  'contentType',
]);

const exportedNames = (node) => {
  if (node.declaration) {
    const { declaration } = node;
    if (declaration.type === 'VariableDeclaration') {
      return declaration.declarations.map((d) => (d.id.type === 'Identifier' ? d.id.name : '?'));
    }
    return [declaration.id?.name ?? '?'];
  }
  return node.specifiers.map((s) =>
    s.exported.type === 'Identifier' ? s.exported.name : s.exported.value,
  );
};

/** A route file exports only what Next.js reads from it. */
export const routeExports = {
  meta: {
    type: 'problem',
    docs: { description: 'Next.js route files export only the names Next.js reads' },
    schema: [],
    messages: {
      name: '`{{name}}` is not an export Next.js reads from a route file. Move it to a feature or to application.',
    },
  },
  create(context) {
    const file = rel(context);
    if (!file.startsWith('src/app/') || isTest(file)) return {};
    return {
      ExportNamedDeclaration(node) {
        if (node.exportKind === 'type') return;
        for (const name of exportedNames(node)) {
          if (!ROUTE_EXPORTS.has(name)) context.report({ node, messageId: 'name', data: { name } });
        }
      },
      ExportAllDeclaration(node) {
        context.report({ node, messageId: 'name', data: { name: '*' } });
      },
    };
  },
};

/** Infrastructure reads the disk: each of its files says so with `import 'server-only'`, so a client bundle that reaches one fails the build. */
export const serverOnly = {
  meta: {
    type: 'problem',
    docs: { description: "every infrastructure file imports 'server-only'" },
    schema: [],
    messages: { missing: "An infrastructure file starts with `import 'server-only';`." },
  },
  create(context) {
    const file = rel(context);
    if (!file.startsWith('src/infrastructure/') || isTest(file)) return {};
    return {
      Program(program) {
        const has = program.body.some(
          (n) =>
            n.type === 'ImportDeclaration' &&
            n.source.value === 'server-only' &&
            n.specifiers.length === 0,
        );
        if (!has) context.report({ node: program, messageId: 'missing' });
      },
    };
  },
};

/** An index.ts is a feature's public face: it re-exports by name and holds no code. */
export const barrelExportsOnly = {
  meta: {
    type: 'problem',
    docs: { description: 'index.ts holds only named re-exports' },
    schema: [],
    messages: {
      code: 'index.ts only re-exports by name (`export { X } from "./x"`). Put code in its own file.',
    },
  },
  create(context) {
    if (path.basename(context.filename) !== 'index.ts') return {};
    return {
      Program(program) {
        for (const node of program.body) {
          const reexport =
            node.type === 'ExportNamedDeclaration' &&
            node.source !== null &&
            node.declaration === null;
          if (!reexport) context.report({ node, messageId: 'code' });
        }
      },
    };
  },
};

// Names that say nothing about what a file holds. Name a file for the one idea in it.
const JUNK = new Set([
  'util',
  'utils',
  'helper',
  'helpers',
  'misc',
  'common',
  'stuff',
  'lib',
  'core',
  'manager',
  'functions',
  'constants',
  'other',
  'temp',
  'tmp',
  'new',
  'old',
]);

/** A file is named for what it holds: no utils.ts, helpers.ts or common.tsx. */
export const noJunkDrawerNames = {
  meta: {
    type: 'suggestion',
    docs: { description: 'file names say what the file holds' },
    schema: [],
    messages: {
      junk: '"{{name}}" says nothing about what the file holds. Name it for the one idea in it.',
    },
  },
  create(context) {
    const name = path
      .basename(context.filename)
      .replace(/\.(tsx?|mts|mjs)$/u, '')
      .replace(/\.(test|spec|client|generated)$/u, '');
    if (!JUNK.has(name)) return {};
    return {
      Program(program) {
        context.report({ node: program, messageId: 'junk', data: { name } });
      },
    };
  },
};
