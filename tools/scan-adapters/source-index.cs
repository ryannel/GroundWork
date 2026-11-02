using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

// Parses supplied bytes only. No project loading, restore, application compilation or execution.
static class SourceIndex {
 static readonly Dictionary<Type,string> Kinds = new() {
  [typeof(ClassDeclarationSyntax)]="CLASS", [typeof(InterfaceDeclarationSyntax)]="INTERFACE",
  [typeof(RecordDeclarationSyntax)]="RECORD", [typeof(EnumDeclarationSyntax)]="ENUM",
  [typeof(MethodDeclarationSyntax)]="METHOD", [typeof(ConstructorDeclarationSyntax)]="METHOD",
  [typeof(LocalFunctionStatementSyntax)]="METHOD", [typeof(SimpleLambdaExpressionSyntax)]="LAMBDA_EXPRESSION",
  [typeof(ParenthesizedLambdaExpressionSyntax)]="LAMBDA_EXPRESSION",
  [typeof(InvocationExpressionSyntax)]="METHOD_INVOCATION", [typeof(ObjectCreationExpressionSyntax)]="NEW_CLASS",
  [typeof(IdentifierNameSyntax)]="IDENTIFIER", [typeof(MemberAccessExpressionSyntax)]="MEMBER_SELECT",
  [typeof(ReturnStatementSyntax)]="RETURN", [typeof(ThrowStatementSyntax)]="THROW",
  [typeof(BlockSyntax)]="BLOCK", [typeof(IfStatementSyntax)]="IF", [typeof(ConditionalExpressionSyntax)]="CONDITIONAL_EXPRESSION",
  [typeof(VariableDeclaratorSyntax)]="VARIABLE", [typeof(ParameterSyntax)]="VARIABLE",
  [typeof(AssignmentExpressionSyntax)]="ASSIGNMENT", [typeof(ExpressionStatementSyntax)]="EXPRESSION_STATEMENT",
  [typeof(TryStatementSyntax)]="TRY", [typeof(CatchClauseSyntax)]="CATCH", [typeof(AttributeSyntax)]="ANNOTATION",
  [typeof(UsingDirectiveSyntax)]="IMPORT", [typeof(ForStatementSyntax)]="FOR_LOOP",
  [typeof(ForEachStatementSyntax)]="ENHANCED_FOR_LOOP", [typeof(WhileStatementSyntax)]="WHILE_LOOP",
  [typeof(DoStatementSyntax)]="DO_WHILE_LOOP", [typeof(SwitchStatementSyntax)]="SWITCH",
  [typeof(SwitchExpressionSyntax)]="SWITCH_EXPRESSION", [typeof(ElementAccessExpressionSyntax)]="IndexExpr"
 };
 static string Kind(SyntaxNode node) {
  if(node is AssignmentExpressionSyntax callbackAssignment && callbackAssignment.Right is LambdaExpressionSyntax) return "CsharpCallbackAssignment";
  if(node is AssignmentExpressionSyntax assignment && (assignment.Left is DeclarationExpressionSyntax || assignment.Left is TupleExpressionSyntax)) return "CsharpDeconstructionAssignment";
  if (Kinds.TryGetValue(node.GetType(), out var kind)) return kind;
  if (node is LiteralExpressionSyntax literal) return literal.Kind().ToString().ToUpperInvariant()+"_LITERAL";
  return node.Kind().ToString();
 }
 static string? Symbol(SyntaxNode node) => node switch {
  BaseTypeDeclarationSyntax value => value.Identifier.ValueText,
  MethodDeclarationSyntax value => value.Identifier.ValueText,
  ConstructorDeclarationSyntax value => value.Identifier.ValueText,
  LocalFunctionStatementSyntax value => value.Identifier.ValueText,
  PropertyDeclarationSyntax value => value.Identifier.ValueText,
  VariableDeclaratorSyntax value => value.Identifier.ValueText,
  ParameterSyntax value => value.Identifier.ValueText,
  IdentifierNameSyntax value => value.Identifier.ValueText,
  _ => null
 };
 static Dictionary<string, int[][]> Fields(SyntaxNode node) {
  var fields = new Dictionary<string,int[][]>();
  void Add(string key, params SyntaxNode?[] values) {
   fields[key] = values.Where(value => value != null).Select(value => new[]{value!.SpanStart,value.Span.End}).ToArray();
  }
  switch(node) {
   case MethodDeclarationSyntax value:
    Add("parameters",value.ParameterList.Parameters.ToArray()); Add("returnType",value.ReturnType);
    Add("body",(SyntaxNode?)value.Body ?? value.ExpressionBody?.Expression);
    Add("annotations",value.AttributeLists.SelectMany(list=>list.Attributes).ToArray()); break;
   case ConstructorDeclarationSyntax value:
    Add("parameters",value.ParameterList.Parameters.ToArray()); Add("body",value.Body); break;
   case LocalFunctionStatementSyntax value:
    Add("parameters",value.ParameterList.Parameters.ToArray()); Add("returnType",value.ReturnType);
    Add("body",(SyntaxNode?)value.Body ?? value.ExpressionBody?.Expression); break;
   case LambdaExpressionSyntax value:
    Add("body",value.Body);
    if(value is SimpleLambdaExpressionSyntax simple) Add("parameters",simple.Parameter);
    if(value is ParenthesizedLambdaExpressionSyntax multiple) Add("parameters",multiple.ParameterList.Parameters.ToArray()); break;
   case UsingDirectiveSyntax value: Add("name",value.Name); Add("alias",value.Alias?.Name); break;
   case BaseTypeDeclarationSyntax value:
    Add("annotations",value.AttributeLists.SelectMany(list=>list.Attributes).ToArray());
    Add("bases",value.BaseList?.Types.Select(item=>item.Type).ToArray() ?? Array.Empty<SyntaxNode>());
    if(value is RecordDeclarationSyntax record) Add("parameters",record.ParameterList?.Parameters.ToArray() ?? Array.Empty<SyntaxNode>()); break;
   case PropertyDeclarationSyntax value:
    Add("type",value.Type); Add("values",value.Initializer?.Value);
    Add("annotations",value.AttributeLists.SelectMany(list=>list.Attributes).ToArray()); break;
   case ParameterSyntax value:
    Add("type",value.Type); Add("values",value.Default?.Value);
    Add("annotations",value.AttributeLists.SelectMany(list=>list.Attributes).ToArray()); break;
   case VariableDeclaratorSyntax value:
    Add("values",value.Initializer?.Value); Add("type",(value.Parent as VariableDeclarationSyntax)?.Type); break;
   case InvocationExpressionSyntax value:
    Add("callee",value.Expression); Add("arguments",value.ArgumentList.Arguments.Select(arg=>arg.Expression).ToArray()); break;
   case ObjectCreationExpressionSyntax value:
    Add("callee",value.Type); Add("arguments",value.ArgumentList?.Arguments.Select(arg=>arg.Expression).ToArray() ?? Array.Empty<SyntaxNode>()); break;
   case MemberAccessExpressionSyntax value: Add("receiver",value.Expression); Add("member",value.Name); break;
   case ReturnStatementSyntax value: Add("values",value.Expression); break;
   case ThrowStatementSyntax value: Add("values",value.Expression); break;
   case IfStatementSyntax value: Add("condition",value.Condition); Add("consequent",value.Statement); Add("otherwise",value.Else?.Statement); break;
   case ConditionalExpressionSyntax value: Add("condition",value.Condition); Add("consequent",value.WhenTrue); Add("otherwise",value.WhenFalse); break;
   case BlockSyntax value: Add("statements",value.Statements.ToArray()); break;
   case BinaryExpressionSyntax value: Add("left",value.Left); Add("right",value.Right); break;
   case AssignmentExpressionSyntax value: Add("targets",value.Left); Add("values",value.Right); break;
   case PrefixUnaryExpressionSyntax value: Add("operand",value.Operand); break;
   case PostfixUnaryExpressionSyntax value: Add("operand",value.Operand); break;
   case AwaitExpressionSyntax value: Add("expression",value.Expression); break;
   case ParenthesizedExpressionSyntax value: Add("expression",value.Expression); break;
   case TryStatementSyntax value: Add("body",value.Block); Add("catches",value.Catches.ToArray()); Add("finally",value.Finally?.Block); break;
   case CatchClauseSyntax value: Add("body",value.Block); Add("condition",value.Filter?.FilterExpression); break;
   case AttributeSyntax value: Add("annotationName",value.Name); Add("arguments",value.ArgumentList?.Arguments.Select(arg=>arg.Expression).ToArray() ?? Array.Empty<SyntaxNode>()); break;
  }
  var operatorToken = node switch {
   BinaryExpressionSyntax value => value.OperatorToken,
   AssignmentExpressionSyntax value => value.OperatorToken,
   PrefixUnaryExpressionSyntax value => value.OperatorToken,
   PostfixUnaryExpressionSyntax value => value.OperatorToken,
   _ => default
  };
  if(operatorToken.RawKind!=0) fields["operator"] = new[]{new[]{operatorToken.SpanStart,operatorToken.Span.End}};
  return fields;
 }
 static void Main(string[] args) {
  if(args.Length > 0 && args[0] == "--bindings") { CompilerBindings.Run(); return; }
  var content = Console.In.ReadToEnd();
  var tree = CSharpSyntaxTree.ParseText(content, new CSharpParseOptions(LanguageVersion.Preview));
  var nodes = new List<object>();
  void Visit(SyntaxNode node, int? parent) {
   if(node.Span.IsEmpty) return;
   var position=nodes.Count; var span=tree.GetLineSpan(node.Span);
   var data = new Dictionary<string,object?> {
    ["kind"]=Kind(node), ["text"]=content.Substring(node.SpanStart,Math.Min(node.Span.Length,512)),
    ["start"]=node.SpanStart,["end"]=node.Span.End,["parent"]=parent,
    ["lines"]=new[]{span.StartLinePosition.Line+1,tree.GetLineSpan(new Microsoft.CodeAnalysis.Text.TextSpan(Math.Max(node.SpanStart,node.Span.End-1),0)).StartLinePosition.Line+1},
    ["fields"]=Fields(node)
   };
   var symbol=Symbol(node); if(symbol!=null) data["symbol"]=symbol;
   if(node is MemberDeclarationSyntax member) data["modifiers"]=member.Modifiers.Select(token=>token.ValueText).ToArray();
   if(node is LiteralExpressionSyntax literal && literal.Token.Value is string) data["literalValue"]=literal.Token.Value;
   nodes.Add(data);
   foreach(var child in node.ChildNodes()) Visit(child,position);
  }
  Visit(tree.GetRoot(),null);
  Console.Write(JsonSerializer.Serialize(new {parser="roslyn/"+typeof(CSharpSyntaxTree).Assembly.GetName().Version,nodes,
   diagnostics=tree.GetDiagnostics().Where(item=>item.Severity==DiagnosticSeverity.Error).Select(item=>item.ToString()).Concat(tree.GetRoot().DescendantTrivia(descendIntoTrivia:true).Any(trivia=>trivia.GetStructure() is IfDirectiveTriviaSyntax) ? new[]{"C# conditional compilation symbols are not project-resolved; file is quarantined rather than claiming inactive branches are absent."} : Array.Empty<string>()).ToArray()}));
 }
}
