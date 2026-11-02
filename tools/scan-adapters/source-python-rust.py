"""Parse supplied bytes only. Never import, compile or run target application code."""
import ast
import json
import sys


def offsets(content):
    encoded = content.encode('utf-8')
    def span(start, end):
        return [len(encoded[:start].decode('utf-8').encode('utf-16-le')) // 2,
                len(encoded[:end].decode('utf-8').encode('utf-16-le')) // 2]
    return encoded, span


def python_index(content):
    encoded, span = offsets(content)
    starts = [0]
    for line in encoded.splitlines(keepends=True):
        starts.append(starts[-1] + len(line))
    tree = ast.parse(content, type_comments=True)
    nodes = []
    kinds = {'Module': 'SourceFile', 'FunctionDef': 'METHOD', 'AsyncFunctionDef': 'METHOD',
             'Lambda': 'LAMBDA_EXPRESSION', 'ClassDef': 'CLASS', 'Call': 'METHOD_INVOCATION',
             'Name': 'IDENTIFIER', 'Attribute': 'MEMBER_SELECT', 'Return': 'RETURN',
             'If': 'IF', 'IfExp': 'CONDITIONAL_EXPRESSION', 'For': 'ENHANCED_FOR_LOOP',
             'AsyncFor': 'ENHANCED_FOR_LOOP', 'While': 'WHILE_LOOP', 'Assign': 'ASSIGNMENT',
             'AnnAssign': 'VARIABLE', 'AugAssign': 'ASSIGNMENT', 'Try': 'TRY',
             'ExceptHandler': 'CATCH', 'Raise': 'THROW', 'Await': 'AwaitExpression',
             'Constant': 'STRING_LITERAL', 'arg': 'VARIABLE', 'Import': 'IMPORT', 'alias': 'IMPORT_ALIAS',
             'ImportFrom': 'IMPORT', 'Subscript': 'IndexExpr', 'BinOp': 'BinaryExpr',
             'Compare': 'BinaryExpr', 'UnaryOp': 'UnaryExpr'}
    field_names = {'args': 'arguments', 'func': 'callee', 'test': 'condition',
                   'body': 'consequent', 'orelse': 'otherwise', 'value': 'values',
                   'targets': 'targets', 'target': 'targets', 'left': 'left',
                   'right': 'right', 'operand': 'operand', 'returns': 'returnType',
                   'annotation': 'type', 'decorator_list': 'annotations',
                   'handlers': 'catches', 'finalbody': 'finally', 'bases': 'bases', 'names': 'imports', 'keywords': 'keywords'}
    def bounds(node):
        if not hasattr(node, 'lineno'):
            return [0, len(content.encode('utf-16-le')) // 2]
        return span(starts[node.lineno - 1] + node.col_offset,
                    starts[node.end_lineno - 1] + node.end_col_offset)
    def walk(node, parent):
        if not hasattr(node, 'lineno') and not isinstance(node, ast.Module):
            for child in ast.iter_child_nodes(node): walk(child, parent)
            return
        start, end = bounds(node)
        record = {'kind': kinds.get(type(node).__name__, type(node).__name__),
                  'text': ast.get_source_segment(content, node) or content,
                  'start': start, 'end': end, 'lines': [getattr(node, 'lineno', 1),
                  getattr(node, 'end_lineno', max(1, len(content.splitlines())))],
                  'parent': parent, 'fields': {}}
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            record['symbol'] = node.name
        if isinstance(node, ast.ImportFrom): record['symbol'] = '.' * node.level + (node.module or '')
        if isinstance(node, ast.alias):
            record['symbol'] = node.name
            if node.asname: record['modifiers'] = [node.asname]
        if isinstance(node, ast.Attribute): record['symbol'] = node.attr
        if isinstance(node, ast.Name): record['symbol'] = node.id
        if isinstance(node, ast.arg): record['symbol'] = node.arg
        if isinstance(node, ast.keyword): record['symbol'] = node.arg or '**'
        if isinstance(node, ast.Constant):
            if node.value is None or type(node.value) in (str, bool):
                record['literalValue'] = node.value
            elif type(node.value) in (int, float) and abs(node.value) <= 9007199254740991:
                record['literalValue'] = node.value
            else:
                record['kind'] = 'PythonLiteralUnresolved'
        if isinstance(node, ast.AsyncFunctionDef): record['modifiers'] = ['async']
        if isinstance(node, ast.Await): record['fields']['task'] = [bounds(node.value)]
        operators = {'Add': '+', 'Sub': '-', 'Mult': '*', 'Div': '/', 'Mod': '%', 'Pow': '**',
                     'LShift': '<<', 'RShift': '>>', 'BitOr': '|', 'BitAnd': '&', 'BitXor': '^',
                     'Eq': '==', 'NotEq': '!=', 'Lt': '<', 'LtE': '<=', 'Gt': '>', 'GtE': '>=',
                     'UAdd': '+', 'USub': '-', 'Invert': '~', 'Not': 'not', 'In': 'in', 'NotIn': 'not in', 'Is': 'is', 'IsNot': 'is not'}
        if isinstance(node, (ast.BinOp, ast.UnaryOp, ast.AugAssign)):
            record['operator'] = operators.get(type(node.op).__name__, type(node.op).__name__)
            if isinstance(node, ast.AugAssign): record['operator'] += '='
        if isinstance(node, (ast.Assign, ast.AnnAssign)): record['operator'] = '='
        if isinstance(node, ast.Compare):
            if len(node.ops) == 1:
                record['operator'] = operators.get(type(node.ops[0]).__name__, type(node.ops[0]).__name__)
                record['fields']['right'] = [bounds(node.comparators[0])]
            else: record['kind'] = 'PythonChainedComparison'
        position = len(nodes)
        nodes.append(record)
        for name, value in ast.iter_fields(node):
            children = value if isinstance(value, list) else [value]
            mapped = field_names.get(name)
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)) and name == 'args':
                children = [*value.posonlyargs, *value.args, *value.kwonlyargs]
                if value.vararg: children.append(value.vararg)
                if value.kwarg: children.append(value.kwarg)
                mapped = 'parameters'
            if name == 'body' and not isinstance(node, (ast.If, ast.IfExp)): mapped = 'body'
            if name == 'orelse' and not isinstance(node, (ast.If, ast.IfExp)): mapped = 'unsupported_else'
            if name == 'value' and isinstance(node, ast.Attribute): mapped = 'receiver'
            if name == 'body' and isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Module)):
                mapped = 'statements'
            located = [child for child in children if isinstance(child, ast.AST) and hasattr(child, 'lineno')]
            if mapped == 'targets':
                located = [child for child in located if isinstance(child, (ast.Name, ast.Attribute, ast.Subscript))]
            if mapped and located: record['fields'][mapped] = [bounds(child) for child in located]
        for child in ast.iter_child_nodes(node): walk(child, position)
    walk(tree, None)
    return {'parser': 'python/ast/' + sys.version.split()[0], 'nodes': nodes, 'diagnostics': []}


def rust_index(content):
    import tree_sitter
    import tree_sitter_rust
    encoded, span = offsets(content)
    parser = tree_sitter.Parser(tree_sitter.Language(tree_sitter_rust.language()))
    tree = parser.parse(encoded)
    nodes = []
    diagnostics = []
    kinds = {'source_file': 'SourceFile', 'function_item': 'METHOD',
             'closure_expression': 'LAMBDA_EXPRESSION', 'call_expression': 'METHOD_INVOCATION',
             'identifier': 'IDENTIFIER', 'field_expression': 'MEMBER_SELECT',
             'return_expression': 'RETURN', 'if_expression': 'CONDITIONAL_EXPRESSION', 'match_expression': 'SWITCH_EXPRESSION',
             'for_expression': 'ENHANCED_FOR_LOOP', 'while_expression': 'WHILE_LOOP',
             'loop_expression': 'ForStmt', 'let_declaration': 'VARIABLE',
             'assignment_expression': 'ASSIGNMENT', 'block': 'BLOCK',
             'binary_expression': 'BinaryExpr', 'unary_expression': 'UnaryExpr',
             'string_literal': 'STRING_LITERAL', 'integer_literal': 'INT_LITERAL',
             'boolean_literal': 'BOOLEAN_LITERAL', 'await_expression': 'AwaitExpression',
             'struct_item': 'CLASS', 'enum_item': 'ENUM', 'field_declaration': 'PropertyDeclaration', 'use_declaration': 'IMPORT',
             'attribute_item': 'ANNOTATION', 'index_expression': 'IndexExpr'}
    field_names = {'function': 'callee', 'arguments': 'arguments', 'condition': 'condition',
                   'consequence': 'consequent', 'alternative': 'otherwise', 'left': 'left',
                   'right': 'right', 'value': 'values', 'pattern': 'targets', 'body': 'body',
                   'parameters': 'parameters', 'return_type': 'returnType', 'type': 'type', 'trait': 'trait', 'name': 'name', 'macro': 'callee'}
    def walk(node, parent):
        if not node.is_named: return
        start, end = span(node.start_byte, node.end_byte)
        record = {'kind': kinds.get(node.type, node.type),
                  'text': encoded[node.start_byte:node.end_byte].decode('utf-8'),
                  'start': start, 'end': end, 'lines': [node.start_point.row + 1, node.end_point.row + 1],
                  'parent': parent, 'fields': {}}
        if node.is_error or node.is_missing:
            diagnostics.append('Rust parser recovery at ' + str(node.start_point))
        name = node.child_by_field_name('name')
        if node.type == 'parameter':
            pattern = node.child_by_field_name('pattern')
            if pattern and pattern.type == 'identifier': record['symbol'] = pattern.text.decode('utf-8')
        if node.type == 'function_item':
            modifier = next((child for child in node.named_children if child.type == 'function_modifiers'), None)
            if modifier: record['modifiers'] = [child.type for child in modifier.children if child.type == 'async']
        if node.type in ('identifier', 'type_identifier', 'field_identifier'): record['symbol'] = record['text']
        if name: record['symbol'] = encoded[name.start_byte:name.end_byte].decode('utf-8')
        if node.type in ('return_expression', 'await_expression', 'unary_expression'):
            values = [child for child in node.named_children if child.type not in ('line_comment', 'block_comment')]
            field = 'values' if node.type == 'return_expression' else 'operand'
            record['fields'][field] = [span(child.start_byte, child.end_byte) for child in values]
            if node.type == 'await_expression': record['fields']['task'] = record['fields'][field]
        operator = node.child_by_field_name('operator')
        if node.type == 'unary_expression':
            operator = next((child for child in node.children if child.type in ('!', '-', '*')), None)
        if operator: record['operator'] = operator.type
        if node.type in ('assignment_expression', 'let_declaration'): record['operator'] = '='
        position = len(nodes)
        nodes.append(record)
        for source, target in field_names.items():
            if source == 'arguments' and node.type != 'call_expression': continue
            if source == 'macro': target = 'macro_name'
            if node.type == 'field_expression' and source == 'value': target = 'receiver'
            child = node.child_by_field_name(source)
            if child:
                children = child.named_children if source in ('arguments', 'parameters') else [child]
                record['fields'][target] = [span(item.start_byte, item.end_byte) for item in children]
        if node.type in ('struct_item', 'enum_item', 'function_item', 'impl_item', 'field_declaration'):
            attributes = []
            sibling = node.prev_named_sibling
            while sibling and sibling.type in ('attribute_item', 'line_comment', 'block_comment'):
                if sibling.type == 'attribute_item': attributes.insert(0, span(sibling.start_byte, sibling.end_byte))
                sibling = sibling.prev_named_sibling
            if attributes: record['fields']['annotations'] = attributes
        if node.type == 'impl_item': record['kind'] = 'RustImpl'
        if node.type == 'block':
            record['fields']['statements'] = [span(child.start_byte, child.end_byte) for child in node.named_children]
        for child in node.named_children: walk(child, position)
    walk(tree.root_node, None)
    if tree.root_node.has_error and not diagnostics: diagnostics.append('Rust parser recovery tree')
    return {'parser': 'rust/tree-sitter/0.25.2/grammar-0.24.0', 'nodes': nodes, 'diagnostics': diagnostics}


try:
    request = json.load(sys.stdin)
    result = python_index(request['content']) if request['language'] == 'python' else rust_index(request['content'])
except Exception as failure:
    result = {'parser': 'python-rust/unavailable', 'nodes': [],
              'diagnostics': [type(failure).__name__ + ': ' + str(failure)]}
print(json.dumps(result, ensure_ascii=False))
