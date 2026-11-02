// Rules for page titles and spelling. See docs/architecture.md.
import path from 'node:path';

const declaredNames = (node) => {
  if (node.type === 'FunctionDeclaration') return node.id?.name ?? '';
  if (node.type !== 'VariableDeclaration') return '';
  return node.declarations.map((d) => (d.id.type === 'Identifier' ? d.id.name : '')).join(' ');
};

/** Every page names itself, so a tab, a bookmark and the history say where the reader is. */
export const pageMetadata = {
  meta: {
    type: 'suggestion',
    docs: { description: 'each page.tsx exports metadata or generateMetadata' },
    schema: [],
    messages: {
      missing:
        'A page exports `metadata` or `generateMetadata` with its own title, so the tab says where the reader is.',
    },
  },
  create(context) {
    if (path.basename(context.filename) !== 'page.tsx') return {};
    return {
      Program(program) {
        const has = program.body.some(
          (n) =>
            n.type === 'ExportNamedDeclaration' &&
            n.declaration &&
            /\b(?:metadata|generateMetadata)\b/u.test(declaredNames(n.declaration)),
        );
        if (!has) context.report({ node: program, messageId: 'missing' });
      },
    };
  },
};

// American spellings and the British ones the site writes. Code names (the CSS `color` property, GitHub's
// `organization`) are left alone: only prose is checked, and anything in `backticks` or "quotes" is a name, not prose.
const BRITISH = {
  color: 'colour',
  colors: 'colours',
  colored: 'coloured',
  behavior: 'behaviour',
  behaviors: 'behaviours',
  center: 'centre',
  centered: 'centred',
  catalog: 'catalogue',
  catalogs: 'catalogues',
  canceled: 'cancelled',
  canceling: 'cancelling',
  labeled: 'labelled',
  labeling: 'labelling',
  modeling: 'modelling',
  modeled: 'modelled',
  favor: 'favour',
  favorite: 'favourite',
  honor: 'honour',
  gray: 'grey',
  analyze: 'analyse',
  analyzed: 'analysed',
  analyzes: 'analyses',
};
const IZE_STEMS = new Set(
  'organ recogn initial summar normal serial optim visual priorit custom author categor minim maxim util real emphas standard synchron'.split(
    ' ',
  ),
);
const IZE = /^([a-z]+)iz(e|es|ed|ing|ation|ations)$/u;
const WORD = /[A-Za-z]+/gu;

const britishOf = (word) => {
  const lower = word.toLowerCase();
  if (Object.hasOwn(BRITISH, lower)) return BRITISH[lower];
  const ize = IZE.exec(lower);
  if (ize === null || !IZE_STEMS.has(ize[1])) return null;
  return `${ize[1]}is${ize[2]}`;
};

/** Prose is plain British English: comments and the words on screen. */
export const britishSpelling = {
  meta: {
    type: 'suggestion',
    docs: { description: 'comments and JSX text use British spelling' },
    schema: [],
    messages: { spell: 'Write "{{british}}", not "{{word}}": the site is in British English.' },
  },
  create(context) {
    const check = (node, text) => {
      for (const [word] of text.replaceAll(/`[^`]*`|"[^"]*"/gu, '').matchAll(WORD)) {
        const british = britishOf(word);
        if (british) context.report({ node, messageId: 'spell', data: { word, british } });
      }
    };
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) check(comment, comment.value);
      },
      JSXText(node) {
        check(node, node.value);
      },
    };
  },
};
