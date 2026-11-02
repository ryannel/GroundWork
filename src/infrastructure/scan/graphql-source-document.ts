import 'server-only';

interface Token {
  readonly value: string;
  readonly start: number;
  readonly end: number;
}
interface Variable {
  readonly name: string;
  readonly type: string;
  readonly start: number;
  readonly end: number;
}
interface Selection {
  readonly path: string;
  readonly field_name: string;
  readonly arguments: readonly {
    readonly name: string;
    readonly variable: string;
    readonly start: number;
    readonly end: number;
  }[];
  readonly start: number;
  readonly end: number;
}
interface ParsedDocument {
  readonly operation_type: 'query' | 'mutation' | 'subscription';
  readonly operation_name: string | null;
  readonly variables: readonly Variable[];
  readonly selections: readonly Selection[];
}
interface Cursor {
  readonly tokens: readonly Token[];
  readonly position: () => number;
  readonly advance: () => void;
}
function take(cursor: Cursor, expected?: string): Token {
  const token = cursor.tokens[cursor.position()];
  if (!token || (expected !== undefined && token.value !== expected)) {
    throw new Error('Unsupported GraphQL source syntax.');
  }
  cursor.advance();
  return token;
}
function peek(cursor: Cursor): string | undefined {
  return cursor.tokens[cursor.position()]?.value;
}
function name(cursor: Cursor): Token {
  const token = take(cursor);
  if (!/^[_A-Za-z]\w*$/u.test(token.value)) {
    throw new Error('Expected a GraphQL name.');
  }
  return token;
}
function variableType(cursor: Cursor, depth = 0): string {
  if (depth > 8) throw new Error('GraphQL type depth exceeds eight.');
  let type: string;
  if (peek(cursor) === '[') {
    take(cursor, '[');
    type = `[${variableType(cursor, depth + 1)}]`;
    take(cursor, ']');
  } else type = name(cursor).value;
  if (peek(cursor) === '!') type += take(cursor, '!').value;
  return type;
}
function variables(cursor: Cursor): readonly Variable[] {
  const result: Variable[] = [];
  if (peek(cursor) !== '(') return result;
  take(cursor, '(');
  while (peek(cursor) !== ')') {
    const start = take(cursor, '$').start;
    const variable = name(cursor);
    take(cursor, ':');
    const type = variableType(cursor);
    const end = cursor.tokens[cursor.position() - 1]?.end ?? variable.end;
    if (result.some((entry) => entry.name === variable.value)) {
      throw new Error('Duplicate GraphQL variable.');
    }
    result.push({ name: variable.value, type, start, end });
  }
  take(cursor, ')');
  return result;
}
function fieldArguments(cursor: Cursor): Selection['arguments'] {
  const result: Selection['arguments'][number][] = [];
  if (peek(cursor) !== '(') return result;
  take(cursor, '(');
  while (peek(cursor) !== ')') {
    const argument = name(cursor);
    take(cursor, ':');
    take(cursor, '$');
    const variable = name(cursor);
    if (result.some((entry) => entry.name === argument.value)) {
      throw new Error('Duplicate GraphQL argument.');
    }
    result.push({
      name: argument.value,
      variable: variable.value,
      start: argument.start,
      end: variable.end,
    });
  }
  take(cursor, ')');
  return result;
}
function selections(cursor: Cursor, parent: string, depth = 0): readonly Selection[] {
  if (depth > 16) throw new Error('GraphQL selection depth exceeds sixteen.');
  const result: Selection[] = [];
  take(cursor, '{');
  while (peek(cursor) !== '}') {
    const field = name(cursor);
    const path = parent === '' ? field.value : `${parent}.${field.value}`;
    const args = fieldArguments(cursor);
    const end = cursor.tokens[cursor.position() - 1]?.end ?? field.end;
    result.push({ path, field_name: field.value, arguments: args, start: field.start, end });
    if (peek(cursor) === '{') result.push(...selections(cursor, path, depth + 1));
  }
  take(cursor, '}');
  if (result.length === 0) throw new Error('Empty GraphQL selection.');
  return result;
}
function tokensOf(content: string): readonly Token[] {
  const pattern = /#[^\r\n]*|[\s,]+|[_A-Za-z]\w*|[$!():{}[\]]/gu;
  const tokens: Token[] = [];
  let end = 0;
  for (const match of content.matchAll(pattern)) {
    if (match.index !== end) throw new Error('Unsupported GraphQL source token.');
    end = match.index + match[0].length;
    if (/^[\s#,]/u.test(match[0])) continue;
    tokens.push({ value: match[0], start: match.index, end });
    if (tokens.length > 4096) throw new Error('GraphQL document exceeds 4096 tokens.');
  }
  if (end !== content.length) throw new Error('Unsupported GraphQL source token.');
  return tokens;
}

function operationKind(value: string): ParsedDocument['operation_type'] {
  if (value === 'mutation') return 'mutation';
  return value === 'subscription' ? 'subscription' : 'query';
}

/** A bounded source-query subset; unsupported fragments/directives/literals fail without recovery. */
export function parseGraphqlSource(content: string): ParsedDocument {
  if (content.length > 1_048_576) throw new Error('GraphQL source exceeds one MiB.');
  let position = 0;
  const cursor = {
    tokens: tokensOf(content),
    position: () => position,
    advance: () => {
      position += 1;
    },
  };
  const operation = take(cursor).value;
  if (!['query', 'mutation', 'subscription'].includes(operation)) {
    throw new Error('Expected an explicit GraphQL operation.');
  }
  const operationType = operationKind(operation);
  const operationName = peek(cursor) === '(' || peek(cursor) === '{' ? null : name(cursor).value;
  const declared = variables(cursor);
  const fields = selections(cursor, '');
  if (cursor.position() !== cursor.tokens.length) {
    throw new Error('Expected one GraphQL operation.');
  }
  const names = new Set(declared.map((variable) => variable.name));
  if (fields.some((field) => field.arguments.some((argument) => !names.has(argument.variable)))) {
    throw new Error('Undeclared GraphQL variable.');
  }
  return {
    operation_type: operationType,
    operation_name: operationName,
    variables: declared,
    selections: fields,
  };
}
