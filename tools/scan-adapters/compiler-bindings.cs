using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.Json;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

// Isolated source-only compilation. Metadata references are the parser's own .NET framework.
// No project evaluation, package resolution, target assembly loading or target execution.
static class CompilerBindings {
 record Input(string path, string content);
 static readonly SymbolDisplayFormat Format=SymbolDisplayFormat.FullyQualifiedFormat.WithMemberOptions(SymbolDisplayMemberOptions.IncludeContainingType|SymbolDisplayMemberOptions.IncludeParameters|SymbolDisplayMemberOptions.IncludeType).WithParameterOptions(SymbolDisplayParameterOptions.IncludeType|SymbolDisplayParameterOptions.IncludeName);
 static object Anchor(SyntaxNode node) => new {path=node.SyntaxTree.FilePath,start=node.SpanStart,end=node.Span.End};
 static SyntaxNode? Declaration(ISymbol? symbol) {
  if(symbol is IMethodSymbol method) symbol=(method.ReducedFrom ?? method).OriginalDefinition;
  return symbol?.DeclaringSyntaxReferences.FirstOrDefault()?.GetSyntax();
 }
 static string Boundary(IMethodSymbol? method) {
  if(method==null) return "unknown";
  var type=method.ContainingType.OriginalDefinition.ToDisplayString();
  if(type=="System.Net.Http.HttpClient" || type=="System.Net.Http.HttpMessageInvoker") return "http";
  if(type.StartsWith("MongoDB.Driver.IMongoCollection<",StringComparison.Ordinal) || type=="Microsoft.Azure.Cosmos.Container" || type=="Microsoft.EntityFrameworkCore.DbContext") return "storage";
  if(type=="System.Threading.Tasks.Task" && method.Name=="Run") return "async";
  return "unclassified";
 }
 static string Completion(InvocationExpressionSyntax call) => call.Parent is AwaitExpressionSyntax ? "awaited" : call.Parent is ReturnStatementSyntax ? "returned" : "unobserved";
 static bool Exact(IMethodSymbol method) => method.IsStatic || method.MethodKind == MethodKind.Constructor ||
  (!method.IsVirtual && !method.IsAbstract && !method.IsOverride && method.ContainingType.TypeKind != TypeKind.Interface) || method.IsSealed;
 public static void Run() {
  var inputs=JsonSerializer.Deserialize<Input[]>(Console.In.ReadToEnd()) ?? Array.Empty<Input>();
  var trees=inputs.Select(input=>CSharpSyntaxTree.ParseText(input.content,new CSharpParseOptions(LanguageVersion.Preview),input.path)).ToArray();
  var platform=(AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") as string ?? "").Split(Path.PathSeparator);
  var references=platform.Where(file=>file.EndsWith(".dll",StringComparison.Ordinal)).Select(file=>MetadataReference.CreateFromFile(file));
  var compilation=CSharpCompilation.Create("GroundworkSourceOnly",trees,references,new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
  var bindings=new List<object>();
  foreach(var tree in trees) {
   var model=compilation.GetSemanticModel(tree,true);
   foreach(var node in tree.GetRoot().DescendantNodes()) {
    if(node is InvocationExpressionSyntax call) {
     var info=model.GetSymbolInfo(call);
     var target=info.Symbol as IMethodSymbol;
     var declaration=Declaration(target);
     var owner=call.Ancestors().FirstOrDefault(item=>item is BaseMethodDeclarationSyntax || item is LocalFunctionStatementSyntax || item is LambdaExpressionSyntax);
     var arguments=call.ArgumentList.Arguments.Select(argument=>new {
      source=Anchor(argument.Expression),
      parameter=target == null ? null : Declaration(target.Parameters.FirstOrDefault(parameter=>argument.NameColon != null ? parameter.Name == argument.NameColon.Name.Identifier.ValueText : parameter.Ordinal == call.ArgumentList.Arguments.IndexOf(argument))) is SyntaxNode formal ? Anchor(formal) : null
     }).ToArray();
     bindings.Add(new {relation="call_target",source=Anchor(call),target=declaration==null?null:Anchor(declaration),owner=owner==null?null:Anchor(owner),
      symbol=target?.ToDisplayString(Format) ?? "",configurationSources=Array.Empty<object>(),conditions=Array.Empty<string>(),
      boundary=Boundary(target),completion=Completion(call),dispatch=target == null ? "unresolved" : declaration == null ? "external" : Exact(target) ? "exact" : "polymorphic",arguments});
    }
    if(node is IdentifierNameSyntax identifier) {
     var symbol=model.GetSymbolInfo(identifier).Symbol;
     if(symbol is not ILocalSymbol && symbol is not IParameterSymbol && symbol is not IFieldSymbol && symbol is not IPropertySymbol) continue;
     var declaration=Declaration(symbol);
     if(declaration==null) continue;
     bindings.Add(new {relation="reaching_definition",source=Anchor(identifier),target=Anchor(declaration),owner=(object?)null,
      symbol=symbol.ToDisplayString(Format),configurationSources=Array.Empty<object>(),conditions=Array.Empty<string>(),boundary="unclassified",completion="unobserved",dispatch="exact",arguments=Array.Empty<object>()});
    }
   }
  }
  Implementations(compilation,trees,bindings);
  Console.Write(JsonSerializer.Serialize(new {bindings,contracts=CompilerContracts.Collect(compilation,trees),signatures=CompilerContracts.Signatures(compilation,trees),diagnostics=compilation.GetDiagnostics().Where(item=>item.Severity==DiagnosticSeverity.Error).Select(item=>item.ToString()).OrderBy(item=>item,StringComparer.Ordinal).ToArray()}));
 }
 record Registration(InvocationExpressionSyntax Call, ITypeSymbol? Service, ITypeSymbol? Implementation, string[] Conditions);
 static bool ImportedDependencyInjection(SyntaxNode root) => root.DescendantNodes().OfType<UsingDirectiveSyntax>().Any(imported=>imported.Name?.ToString()=="Microsoft.Extensions.DependencyInjection");
 static Registration[] Registrations(CSharpCompilation compilation, SyntaxTree[] trees) {
  var registrations=new List<Registration>();
  foreach(var tree in trees) {
   var root=tree.GetRoot(); var model=compilation.GetSemanticModel(tree,true);
   if(!ImportedDependencyInjection(root)) continue;
   foreach(var call in root.DescendantNodes().OfType<InvocationExpressionSyntax>()) {
    if(call.Expression is not MemberAccessExpressionSyntax access || access.Expression is not IdentifierNameSyntax receiver) continue;
    var parameter=model.GetSymbolInfo(receiver).Symbol as IParameterSymbol;
    if(parameter?.Type.Name!="IServiceCollection") continue;
    var resolved=model.GetSymbolInfo(call).Symbol as IMethodSymbol;
    if(resolved!=null && resolved.ContainingNamespace.ToDisplayString()!="Microsoft.Extensions.DependencyInjection") continue;
    var conditional=call.Ancestors().Any(node=>node is IfStatementSyntax || node is SwitchSectionSyntax || node is ConditionalExpressionSyntax || node is ForEachStatementSyntax);
    if(access.Name is GenericNameSyntax generic && new[]{"AddScoped","AddTransient","AddSingleton"}.Contains(generic.Identifier.ValueText) && generic.TypeArgumentList.Arguments.Count==2 && call.ArgumentList.Arguments.Count==0) {
     registrations.Add(new Registration(call,model.GetTypeInfo(generic.TypeArgumentList.Arguments[0]).Type,model.GetTypeInfo(generic.TypeArgumentList.Arguments[1]).Type,
      new[]{conditional?"Registration is conditional within source control flow.":"Registration has no enclosing source control branch; runtime activation remains unverified.",generic.Identifier.ValueText}));
    }
    if(access.Name.Identifier.ValueText=="Scan") registrations.Add(new Registration(call,null,null,new[]{"Assembly-scan registration candidate; assembly membership and predicate applicability remain unresolved.",call.ToString()}));
   }
  }
  return registrations.ToArray();
 }
 static void Implementations(CSharpCompilation compilation,SyntaxTree[] trees,List<object> bindings) {
  var registrations=Registrations(compilation,trees);
  foreach(var tree in trees) {
   var model=compilation.GetSemanticModel(tree,true);
   foreach(var declaration in tree.GetRoot().DescendantNodes().OfType<ClassDeclarationSyntax>()) {
    var type=model.GetDeclaredSymbol(declaration);
    if(type==null) continue;
    foreach(var contract in type.AllInterfaces) {
     var matching=registrations.Where(registration=>registration.Service==null ||
      (SymbolEqualityComparer.Default.Equals(registration.Service,contract) && SymbolEqualityComparer.Default.Equals(registration.Implementation,type))).ToArray();
     var conditions=matching.SelectMany(registration=>registration.Conditions).ToList();
     if(matching.Length==0) conditions.Add("Source implements interface; no selected registration establishes activation.");
     if(matching.Length>1 || registrations.Count(registration=>SymbolEqualityComparer.Default.Equals(registration.Service,contract))>1) conditions.Add("Multiple registration candidates; selection and ordering are unresolved.");
     foreach(var member in contract.GetMembers().OfType<IMethodSymbol>()) {
      var target=type.FindImplementationForInterfaceMember(member);
      var source=Declaration(member); var implementation=Declaration(target);
      if(source==null || implementation==null) continue;
      bindings.Add(new {relation="implementation_candidate",source=Anchor(source),target=Anchor(implementation),owner=Anchor(declaration),symbol=target!.ToDisplayString(Format),
       dispatch="polymorphic",boundary="unclassified",completion="unobserved",arguments=Array.Empty<object>(),
       configurationSources=matching.Select(registration=>Anchor(registration.Call)).ToArray(),conditions=conditions.ToArray()});
     }
    }
   }
  }
 }

}
