// Javac parse only: neither attribution nor application compilation is requested.
import java.net.URI;
import java.util.*;
import javax.tools.*;
import com.sun.source.tree.*;
import com.sun.source.util.*;

class SourceIndex {
  static String quote(String text) {
    StringBuilder out = new StringBuilder("\"");
    for(char c : text.toCharArray()) {
      switch(c) {
        case '"': out.append("\\\""); break;
        case '\\': out.append("\\\\"); break;
        case '\n': out.append("\\n"); break;
        case '\r': out.append("\\r"); break;
        case '\t': out.append("\\t"); break;
        default: if(c < 32) out.append(String.format("\\u%04x", (int)c)); else out.append(c);
      }
    }
    return out.append('"').toString();
  }

  static Tree predicate(Tree tree) {
    while(tree instanceof ParenthesizedTree grouped) tree = grouped.getExpression();
    return tree;
  }

  // Invoke the public compiler interface, never javac implementation internals.
  static Object modern(Tree tree, String contract, String method) {
    try {
      Class<?> api = Class.forName("com.sun.source.tree." + contract);
      return api.isInstance(tree) ? api.getMethod(method).invoke(tree) : null;
    } catch (ClassNotFoundException absentOnOlderJdk) {
      return null;
    } catch (ReflectiveOperationException failure) {
      throw new IllegalStateException("Cannot read compiler field " + contract + "." + method, failure);
    }
  }

  static void modernField(Map<String,List<? extends Tree>> fields, Tree tree,
      String field, String contract, String method) {
    Object value = modern(tree, contract, method);
    if(value instanceof Tree child) fields.put(field,List.of(child));
    if(value instanceof List<?> children) {
      var trees = new ArrayList<Tree>();
      for(Object child : children) if(child instanceof Tree typed) trees.add(typed);
      fields.put(field,trees);
    }
  }

  static void controlFields(Map<String,List<? extends Tree>> fields, Tree tree) {
    if(tree instanceof SwitchExpressionTree choice) {
      fields.put("condition",List.of(predicate(choice.getExpression())));
      fields.put("consequent",choice.getCases());
    }
    if(tree instanceof SwitchTree choice) {
      fields.put("condition",List.of(predicate(choice.getExpression())));
      fields.put("consequent",choice.getCases());
    }
    if(tree instanceof CaseTree arm) {
      if(Runtime.version().feature() >= 21) {
        modernField(fields,tree,"labels","CaseTree","getLabels");
        modernField(fields,tree,"condition","CaseTree","getGuard");
      } else fields.put("labels",arm.getExpressions());
      if(arm.getBody()!=null) fields.put("body",List.of(arm.getBody()));
      if(arm.getBody() instanceof ExpressionTree value) fields.put("values",List.of(value));
      if(arm.getStatements()!=null) fields.put("statements",arm.getStatements());
    }
    if(tree instanceof YieldTree yielded) fields.put("values",List.of(yielded.getValue()));
    if(tree instanceof InstanceOfTree checked) {
      fields.put("operand",List.of(checked.getExpression()));
      if(checked.getType()!=null) fields.put("type",List.of(checked.getType()));
      if(checked.getPattern()!=null) fields.put("pattern",List.of(checked.getPattern()));
    }
    if(tree instanceof BindingPatternTree binding) {
      var name = binding.getVariable().getName();
      fields.put("bindings",name.isEmpty() || name.contentEquals("_")?List.of():List.of(binding.getVariable()));
    }
    modernField(fields,tree,"type","DeconstructionPatternTree","getDeconstructor");
    modernField(fields,tree,"patterns","DeconstructionPatternTree","getNestedPatterns");
    modernField(fields,tree,"pattern","PatternCaseLabelTree","getPattern");
    modernField(fields,tree,"values","ConstantCaseLabelTree","getConstantExpression");
  }

  static String fields(Tree tree, SourcePositions positions, CompilationUnitTree unit) {
    var values = new LinkedHashMap<String,List<? extends Tree>>();
    if(tree instanceof ClassTree type) { values.put("annotations",type.getModifiers().getAnnotations()); values.put("members",type.getMembers()); values.put("interfaces",type.getImplementsClause()); values.put("typeParameters",type.getTypeParameters()); if(type.getExtendsClause()!=null) values.put("superType",List.of(type.getExtendsClause())); }
    if(tree instanceof AnnotationTree annotation) { values.put("annotationType",List.of(annotation.getAnnotationType())); values.put("arguments",annotation.getArguments()); }
    if(tree instanceof TypeParameterTree parameter) values.put("bounds",parameter.getBounds());
    if(tree instanceof ParameterizedTypeTree generic) { values.put("type",List.of(generic.getType())); values.put("typeArguments",generic.getTypeArguments()); }
    if(tree instanceof CompilationUnitTree file) { values.put("imports",file.getImports()); values.put("types",file.getTypeDecls()); if(file.getPackageName()!=null) values.put("packageName",List.of(file.getPackageName())); }
    if(tree instanceof MethodTree method) { values.put("typeParameters",method.getTypeParameters()); values.put("name",List.of()); values.put("annotations",method.getModifiers().getAnnotations()); if(method.getBody()!=null) values.put("body",List.of(method.getBody())); values.put("parameters",method.getParameters()); if(method.getReturnType()!=null) values.put("returnType",List.of(method.getReturnType())); }
    if(tree instanceof LambdaExpressionTree lambda) values.put("parameters",lambda.getParameters());
    if(tree instanceof MethodInvocationTree call) {
      values.put("callee",List.of(call.getMethodSelect())); values.put("arguments",call.getArguments());
    }
    if(tree instanceof NewClassTree call) {
      values.put("callee",List.of(call.getIdentifier())); values.put("arguments",call.getArguments());
    }
    if(tree instanceof IfTree branch) {
      values.put("condition",List.of(predicate(branch.getCondition()))); values.put("consequent",List.of(branch.getThenStatement()));
      if(branch.getElseStatement()!=null) values.put("otherwise",List.of(branch.getElseStatement()));
    }
    if(tree instanceof ConditionalExpressionTree choice) { values.put("condition",List.of(predicate(choice.getCondition()))); values.put("consequent",List.of(choice.getTrueExpression())); values.put("otherwise",List.of(choice.getFalseExpression())); }
    if(tree instanceof ReturnTree returned) values.put("values",returned.getExpression()==null?List.of():List.of(returned.getExpression()));
    if(tree instanceof ThrowTree thrown) values.put("values",List.of(thrown.getExpression()));
    if(tree instanceof VariableTree variable) { values.put("annotations",variable.getModifiers().getAnnotations()); values.put("targets",List.of()); if(variable.getType()!=null) values.put("type",List.of(variable.getType())); if(variable.getInitializer()!=null) values.put("values",List.of(variable.getInitializer())); }
    if(tree instanceof AssignmentTree assigned) { values.put("targets",List.of(assigned.getVariable())); values.put("values",List.of(assigned.getExpression())); }
    if(tree instanceof BinaryTree binary) { values.put("left",List.of(binary.getLeftOperand())); values.put("right",List.of(binary.getRightOperand())); }
    if(tree instanceof UnaryTree unary) values.put("operand",List.of(unary.getExpression()));
    if(tree instanceof MemberSelectTree member) values.put("receiver",List.of(member.getExpression()));
    if(tree instanceof MemberReferenceTree member) values.put("receiver",List.of(member.getQualifierExpression()));
    if(tree instanceof BlockTree block) values.put("statements",block.getStatements());
    if(tree instanceof TryTree attempt) { values.put("body",List.of(attempt.getBlock())); values.put("catches",attempt.getCatches()); if(attempt.getFinallyBlock()!=null) values.put("finally",List.of(attempt.getFinallyBlock())); }
    if(tree instanceof CatchTree caught) { values.put("type",List.of(caught.getParameter().getType())); values.put("parameters",(caught.getParameter().getName().contentEquals("_") || caught.getParameter().getName().isEmpty())?List.of():List.of(caught.getParameter())); values.put("body",List.of(caught.getBlock())); }
    if(tree instanceof ExpressionStatementTree statement) values.put("expression",List.of(statement.getExpression()));
    if(tree instanceof ParenthesizedTree grouped) values.put("expression",List.of(grouped.getExpression()));
    controlFields(values,tree);
    var entries = new ArrayList<String>();
    for(var entry : values.entrySet()) {
      var spans = new ArrayList<String>();
      for(var child : entry.getValue()) {
        long start=positions.getStartPosition(unit,child), end=positions.getEndPosition(unit,child);
        if(start>=0 && end>=start) spans.add("["+start+","+end+"]");
      }
      entries.add(quote(entry.getKey())+":["+String.join(",",spans)+"]");
    }
    return "{"+String.join(",",entries)+"}";
  }

  static String symbol(Tree tree) {
    if(tree instanceof MethodTree value) return value.getName().toString();
    if(tree instanceof VariableTree value) return value.getName().isEmpty()?"_":value.getName().toString();
    if(tree instanceof ClassTree value) return value.getSimpleName().toString();
    if(tree instanceof TypeParameterTree value) return value.getName().toString();
    if(tree instanceof ImportTree value) return value.getQualifiedIdentifier().toString();
    if(tree instanceof ModifiersTree value) return String.join(" ",value.getFlags().stream().map(Object::toString).toList());
    if(tree instanceof MemberSelectTree value) return value.getIdentifier().toString();
    if(tree instanceof MemberReferenceTree value) return value.getName().toString();
    return "";
  }

  static String modifiers(Tree tree) {
    ModifiersTree modifiers = tree instanceof ClassTree value?value.getModifiers():tree instanceof MethodTree value?value.getModifiers():tree instanceof VariableTree value?value.getModifiers():null;
    if(modifiers==null) return "[]";
    return "["+String.join(",",modifiers.getFlags().stream().map(value->quote(value.toString())).toList())+"]";
  }

  static String literal(Tree tree) {
    if(!(tree instanceof LiteralTree literal)) return "";
    Object value = literal.getValue();
    if(value instanceof String || value instanceof Character || value instanceof Boolean) return ",\"literalValue\":"+quote(value.toString());
    if(value instanceof Number number && Double.isFinite(number.doubleValue())) return ",\"literalValue\":"+number;
    return "";
  }

  // Input is a source string on stdin and its logical path as the sole argument.
  public static void main(String[] args) throws Exception {
    String source = new String(System.in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
    var compiler = ToolProvider.getSystemJavaCompiler();
    var diagnostics = new DiagnosticCollector<JavaFileObject>();
    var input = new SimpleJavaFileObject(URI.create("string:///Input.java"), JavaFileObject.Kind.SOURCE) {
      public CharSequence getCharContent(boolean ignored) { return source; }
    };
    var task = (JavacTask)compiler.getTask(null, null, diagnostics, List.of("-proc:none"), null, List.of(input));
    var nodes = new ArrayList<String>();
    for(var unit : task.parse()) {
      var positions = Trees.instance(task).getSourcePositions();
      new TreeScanner<Void,Integer>() {
        public Void scan(Tree tree, Integer parent) {
          if(tree == null) return null;
          long start = positions.getStartPosition(unit,tree), end = positions.getEndPosition(unit,tree);
          if(start < 0 || end < start) return super.scan(tree,parent);
          int index = nodes.size();
          String text = source.substring((int)start,(int)Math.min(end,start+512));
          nodes.add("{\"kind\":"+quote(tree.getKind().name())+",\"text\":"+quote(text)+
            ",\"start\":"+start+",\"end\":"+end+",\"lines\":["+
            unit.getLineMap().getLineNumber(start)+","+unit.getLineMap().getLineNumber(Math.max(start,end-1))+
            "],\"parent\":"+(parent == null ? "null" : parent)+",\"fields\":"+fields(tree,positions,unit)+",\"symbol\":"+quote(symbol(tree))+",\"modifiers\":"+modifiers(tree)+literal(tree)+"}");
          return super.scan(tree,index);
        }
      }.scan(unit,null);
    }
    var errors = new ArrayList<String>();
    for(var diagnostic : diagnostics.getDiagnostics()) errors.add(quote(diagnostic.toString()));
    System.out.println("{\"parser\":"+quote("javac/"+System.getProperty("java.version"))+
      ",\"nodes\":["+String.join(",",nodes)+"],\"diagnostics\":["+String.join(",",errors)+"]}");
  }
}
