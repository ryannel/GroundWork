// A component and its CSS module are a pair: `card.tsx` imports `./card.module.css` as `styles`, every
// `styles.x` is a class the file defines, and every class the file defines is used.
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const cache = new Map();

function classesIn(file) {
  const { mtimeMs } = statSync(file);
  const hit = cache.get(file);
  if (hit?.mtimeMs === mtimeMs) return hit.classes;
  const classes = new Set();
  const collect = selectorParser((selectors) => {
    selectors.walkClasses((node) => {
      classes.add(node.value);
    });
  });
  postcss.parse(readFileSync(file, 'utf8')).walkRules((rule) => {
    collect.processSync(rule.selector);
  });
  cache.set(file, { mtimeMs, classes });
  return classes;
}

const pairName = (filename) => path.basename(filename).replace(/(\.client)?\.tsx?$/, '');

function propertyName(member) {
  if (!member.computed && member.property.type === 'Identifier') return member.property.name;
  if (
    member.computed &&
    member.property.type === 'Literal' &&
    typeof member.property.value === 'string'
  ) {
    return member.property.value;
  }
  return null;
}

export const cssModules = {
  meta: {
    type: 'problem',
    docs: {
      description: 'a CSS module pairs with one component, and their classes match both ways',
    },
    schema: [],
    messages: {
      pair: 'Import only this file’s own module, ./{{expected}}.module.css; share styles through a ui component.',
      binding: 'Import a CSS module as `styles`: import styles from "./{{expected}}.module.css".',
      missingFile: '{{source}} does not exist.',
      missing: '.{{name}} is not defined in {{source}}.',
      unused: '.{{name}} in {{source}} is never used; remove it.',
      dynamic:
        'Use styles.<class>, so the class can be checked; style state with a data attribute.',
    },
  },
  create(context) {
    const expected = pairName(context.filename);
    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== 'string' || !source.endsWith('.module.css')) return;
        if (source !== `./${expected}.module.css`) {
          context.report({ node: node.source, messageId: 'pair', data: { expected } });
          return;
        }
        const specifier = node.specifiers[0];
        if (
          node.specifiers.length !== 1 ||
          specifier.type !== 'ImportDefaultSpecifier' ||
          specifier.local.name !== 'styles'
        ) {
          context.report({ node, messageId: 'binding', data: { expected } });
          return;
        }
        let classes;
        try {
          classes = classesIn(path.join(path.dirname(context.filename), source));
        } catch {
          context.report({ node: node.source, messageId: 'missingFile', data: { source } });
          return;
        }
        const used = new Set();
        const [variable] = context.sourceCode.getDeclaredVariables(specifier);
        for (const reference of variable?.references ?? []) {
          const parent = reference.identifier.parent;
          const name =
            parent.type === 'MemberExpression' && parent.object === reference.identifier
              ? propertyName(parent)
              : null;
          if (name === null) {
            context.report({ node: reference.identifier, messageId: 'dynamic' });
            continue;
          }
          used.add(name);
          if (!classes.has(name))
            context.report({ node: parent.property, messageId: 'missing', data: { name, source } });
        }
        for (const name of classes) {
          if (!used.has(name))
            context.report({ node: node.source, messageId: 'unused', data: { name, source } });
        }
      },
    };
  },
};
