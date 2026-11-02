using System;
using System.Linq;
using System.Collections.Generic;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

// Source type identity comes from Roslyn symbols, never a simple-name match.
static class CompilerContracts {
 static object Anchor(SyntaxNode node) => new {path=node.SyntaxTree.FilePath,start=node.SpanStart,end=node.Span.End};
 static object Unknown(ITypeSymbol type,string reason="missing_dependency") => new {kind="unresolved",spelling=type.ToDisplayString(),reason};
 static object Shape(ITypeSymbol type,int depth=0) {
  var spelling=type.ToDisplayString();
  if(depth>16) return Unknown(type,"unsupported");
  if(type.TypeKind==TypeKind.Error) return Unknown(type);
  if(type.NullableAnnotation==NullableAnnotation.Annotated && type.IsReferenceType) return new {kind="union",spelling,alternatives=new object[]{Shape(type.WithNullableAnnotation(NullableAnnotation.NotAnnotated),depth+1),new {kind="scalar",name="null",spelling="null"}}};
  var scalar=type.SpecialType switch {
   SpecialType.System_String or SpecialType.System_Char => "string",
   SpecialType.System_Boolean => "boolean",
   SpecialType.System_Byte or SpecialType.System_SByte or SpecialType.System_Int16 or SpecialType.System_UInt16 or SpecialType.System_Int32 or SpecialType.System_UInt32 or SpecialType.System_Int64 or SpecialType.System_UInt64 => "integer",
   SpecialType.System_Decimal or SpecialType.System_Double or SpecialType.System_Single => "number",
   _ => null
  };
  if(scalar!=null) return new {kind="scalar",name=scalar,spelling};
  if(type is IArrayTypeSymbol array) return array.Rank==1 ? new {kind="array",spelling,item=Shape(array.ElementType,depth+1)} : Unknown(type,"unsupported");
  if(type is not INamedTypeSymbol named) return Unknown(type);
  if(named.OriginalDefinition.SpecialType==SpecialType.System_Nullable_T) return new {kind="union",spelling,alternatives=new object[]{Shape(named.TypeArguments[0],depth+1),new {kind="scalar",name="null",spelling="null"}}};
  if(named.IsTupleType) return new {kind="tuple",spelling,items=named.TupleElements.Select(field=>Shape(field.Type,depth+1)).ToArray()};
  var definition=named.OriginalDefinition.ToDisplayString();
  if(new[]{"System.Collections.Generic.List<T>","System.Collections.Generic.IList<T>","System.Collections.Generic.IReadOnlyList<T>","System.Collections.Generic.ICollection<T>","System.Collections.Generic.IReadOnlyCollection<T>","System.Collections.Generic.IEnumerable<T>","System.Collections.Generic.HashSet<T>"}.Contains(definition))
   return new {kind="array",spelling,item=Shape(named.TypeArguments[0],depth+1)};
  if(new[]{"System.Collections.Generic.Dictionary<TKey, TValue>","System.Collections.Generic.IDictionary<TKey, TValue>","System.Collections.Generic.IReadOnlyDictionary<TKey, TValue>"}.Contains(definition))
   return new {kind="map",spelling,key=Shape(named.TypeArguments[0],depth+1),value=Shape(named.TypeArguments[1],depth+1)};
  var declaration=named.OriginalDefinition.DeclaringSyntaxReferences.FirstOrDefault()?.GetSyntax();
  if(declaration is BaseTypeDeclarationSyntax) return new {kind="reference",spelling,target=Anchor(declaration)};
  return Unknown(type);
 }
 public static object[] Collect(CSharpCompilation compilation, SyntaxTree[] trees) {
  var contracts=new List<object>();
  foreach(var tree in trees) {
   var model=compilation.GetSemanticModel(tree,true);
   foreach(var declaration in tree.GetRoot().DescendantNodes().OfType<BaseTypeDeclarationSyntax>()) {
    var symbol=model.GetDeclaredSymbol(declaration) as INamedTypeSymbol;
    if(symbol==null) continue;
    if(symbol.TypeKind==TypeKind.Enum) {
     var constants=symbol.GetMembers().OfType<IFieldSymbol>().Where(field=>field.HasConstantValue).Select(field=>Convert.ToDecimal(field.ConstantValue)).ToArray();
     var safe=constants.Length>0 && constants.All(number=>number>=-9007199254740991m && number<=9007199254740991m);
     contracts.Add(new {source=Anchor(declaration),name=symbol.ToDisplayString(),fields=Array.Empty<object>(),enumValues=safe?constants:null,enumDeclaration=true});
     continue;
    }
    var properties=symbol.GetMembers().OfType<IPropertySymbol>().Where(property=>!property.IsStatic && !property.IsIndexer && property.DeclaredAccessibility==Accessibility.Public && property.DeclaringSyntaxReferences.Length>0);
    contracts.Add(new {source=Anchor(declaration),name=symbol.ToDisplayString(),enumValues=(decimal[]?)null,enumDeclaration=false,fields=properties.Select(property=>new {
     name=property.Name,nullable=property.NullableAnnotation==NullableAnnotation.Annotated || property.Type.OriginalDefinition.SpecialType==SpecialType.System_Nullable_T,
     required=property.IsRequired,shape=Shape(property.Type)
    }).ToArray()});
   }
  }
  return contracts.ToArray();
 }
 public static object[] Signatures(CSharpCompilation compilation,SyntaxTree[] trees) {
  return trees.SelectMany(tree=>tree.GetRoot().DescendantNodes().OfType<MethodDeclarationSyntax>().Select(declaration=>{
   var symbol=compilation.GetSemanticModel(tree,true).GetDeclaredSymbol(declaration);
   if(symbol==null) return null;
   var result=symbol.ReturnType;
   if(result is INamedTypeSymbol named && named.TypeArguments.Length==1 &&
    new[]{"System.Threading.Tasks.Task<TResult>","System.Threading.Tasks.ValueTask<TResult>"}.Contains(named.OriginalDefinition.ToDisplayString())) result=named.TypeArguments[0];
   return new {source=Anchor(declaration),result=Shape(result),parameters=declaration.ParameterList.Parameters.Select((parameter,position)=>new {source=Anchor(parameter),name=parameter.Identifier.ValueText,shape=Shape(symbol.Parameters[position].Type)}).ToArray()};
  }).Where(signature=>signature!=null).Select(signature=>(object)signature!)).ToArray();
 }

}
