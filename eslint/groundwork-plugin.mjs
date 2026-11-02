// Groundwork's own lint rules: the conventions no published plugin checks. See docs/architecture.md.
import path from 'node:path';

import { cssModules } from './css-modules-rule.mjs';
import { barrelExportsOnly, noJunkDrawerNames, routeExports, serverOnly } from './layer-rules.mjs';
import { readonlyTypes } from './readonly-types-rule.mjs';
import { linkPrefetch, onePerChoice } from './speed-rules.mjs';
import { britishSpelling, pageMetadata } from './structure-rules.mjs';

const rel = (context) => path.relative(context.cwd, context.filename).split(path.sep).join('/');

const directiveOf = (program, name) =>
  program.body.find(
    (n) => n.type === 'ExpressionStatement' && 'directive' in n && n.directive === name,
  );

/** A client component says so in its name: `'use client'` lives only in `*.client.tsx`, and every `*.client.tsx` has it. */
const clientFileNaming = {
  meta: {
    type: 'problem',
    docs: { description: "'use client' only and always in *.client.tsx files" },
    schema: [],
    messages: {
      named:
        "'use client' belongs in a file named *.client.tsx, so a reader sees the boundary in the import.",
      missing: "A *.client.tsx file starts with 'use client'.",
    },
  },
  create(context) {
    return {
      Program(program) {
        const isClientName = /\.client\.tsx$/u.test(context.filename);
        const directive = directiveOf(program, 'use client');
        if (directive && !isClientName) context.report({ node: directive, messageId: 'named' });
        if (!directive && isClientName) context.report({ node: program, messageId: 'missing' });
      },
    };
  },
};

// The files Next.js gives meaning to inside the app router. Everything else belongs in features/ or ui/.
const ROUTE_FILES = new Set([
  'page',
  'layout',
  'template',
  'not-found',
  'error',
  'global-error',
  'loading',
  'default',
  'route',
  'sitemap',
  'robots',
  'manifest',
  'icon',
  'apple-icon',
  'opengraph-image',
  'twitter-image',
]);

/** src/app holds routes only: special files, and globals.css at the top. */
const appRouteFilesOnly = {
  meta: {
    type: 'problem',
    docs: { description: 'src/app holds only the files Next.js gives meaning to' },
    schema: [],
    messages: {
      route:
        '"{{name}}" is not a Next.js route file. Put components in src/features/<feature>/ or src/ui/, logic in src/application/.',
    },
  },
  create(context) {
    const file = rel(context);
    if (!file.startsWith('src/app/') || /\.(?:test|spec)\.tsx?$/u.test(file)) return {};
    const name = path.basename(file).replace(/\.(?:tsx?|mts)$/u, '');
    if (ROUTE_FILES.has(name)) return {};
    return {
      Program(program) {
        context.report({ node: program, messageId: 'route', data: { name: path.basename(file) } });
      },
    };
  },
};

// Route segment options that cache, pre-build or fix how a page renders. Every page is drawn on request from the
// workspaces' YAML (the root layout asks for that once), and the readers keep what they work out until a file
// changes, so none of these is needed.
const RENDER_OPTIONS = new Set([
  'revalidate',
  'fetchCache',
  'dynamic',
  'dynamicParams',
  'generateStaticParams',
]);

/** The site reads its workspaces and writes nothing: no server actions, and no route caching or pre-building. */
const drawnOnRequest = {
  meta: {
    type: 'problem',
    docs: { description: 'no server actions, and no route segment caching or pre-building' },
    schema: [],
    messages: {
      server: "'use server' would let a page write; the site only reads its workspaces.",
      option:
        '`{{name}}` caches or pre-builds the route; every page is drawn on request (see docs/architecture.md).',
    },
  },
  create(context) {
    const check = (node, name) => {
      if (RENDER_OPTIONS.has(name)) context.report({ node, messageId: 'option', data: { name } });
    };
    return {
      Program(program) {
        const directive = directiveOf(program, 'use server');
        if (directive) context.report({ node: directive, messageId: 'server' });
      },
      'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator'(node) {
        check(node, node.id.type === 'Identifier' ? node.id.name : '');
      },
      'ExportNamedDeclaration > FunctionDeclaration'(node) {
        check(node, node.id?.name ?? '');
      },
    };
  },
};

export default {
  meta: { name: 'groundwork' },
  rules: {
    'client-file-naming': clientFileNaming,
    'app-route-files-only': appRouteFilesOnly,
    'drawn-on-request': drawnOnRequest,
    'css-modules': cssModules,
    'route-exports': routeExports,
    'server-only': serverOnly,
    'barrel-exports-only': barrelExportsOnly,
    'no-junk-drawer-names': noJunkDrawerNames,
    'readonly-types': readonlyTypes,
    'one-per-choice': onePerChoice,
    'link-prefetch': linkPrefetch,
    'page-metadata': pageMetadata,
    'british-spelling': britishSpelling,
  },
};
