// Compiler syntax only. Reads one explicit source input, never a directory or module.
package main

import (
 "encoding/json"
 "fmt"
 "go/ast"
 "go/parser"
 "go/token"
 "os"
 "reflect"
 "runtime"
 "strings"
 "unicode/utf8"
)

type input struct { Path string `json:"path"`; Content string `json:"content"` }
type node struct { Kind string `json:"kind"`; Text string `json:"text"`; Start int `json:"start"`; End int `json:"end"`; Lines [2]int `json:"lines"`; Parent *int `json:"parent"`; Fields map[string][][2]int `json:"fields"`; Symbol string `json:"symbol"` }
func main() {
 var in input
 if e := json.NewDecoder(os.Stdin).Decode(&in); e != nil { panic(e) }
 offsets := utf16Offsets(in.Content)
 set := token.NewFileSet()
 file, failure := parser.ParseFile(set, in.Path, in.Content, parser.AllErrors|parser.ParseComments)
 nodes := []node{}
 stack := []int{}
 if file != nil { ast.Inspect(file, func(n ast.Node) bool {
  if n == nil { stack = stack[:len(stack)-1]; return false }
  start, end := set.Position(n.Pos()), set.Position(n.End())
  if n == file { start.Offset = 0; start.Line = 1; end.Offset = len(in.Content); end.Line = strings.Count(in.Content,"\n") + 1 }
  var parent *int
  if len(stack)>0 { p := stack[len(stack)-1]; parent = &p }
  text := ""
  if start.Offset >= 0 && end.Offset <= len(in.Content) { limit := end.Offset; if limit > start.Offset+512 { limit = start.Offset+512 }; text = in.Content[start.Offset:limit] }
  nodes = append(nodes, node{strings.TrimPrefix(reflect.TypeOf(n).String(), "*ast."), text, offsets[start.Offset], offsets[end.Offset], [2]int{start.Line,end.Line},parent,fields(n,set,offsets),symbol(n)})
  stack = append(stack,len(nodes)-1)
  return true
 }) }
 diagnostics := []string{}
 if failure != nil { diagnostics=append(diagnostics,failure.Error()) }
 out := map[string]any{"parser":"go/parser/"+runtime.Version(),"nodes":nodes,"diagnostics":diagnostics}
 if e := json.NewEncoder(os.Stdout).Encode(out); e != nil { fmt.Fprintln(os.Stderr,e); os.Exit(1) }
}

func fields(n ast.Node, set *token.FileSet, offsets []int) map[string][][2]int {
 out := map[string][][2]int{}
 add := func(name string, nodes ...ast.Node) { out[name] = [][2]int{}; for _, child := range nodes { if child != nil && !reflect.ValueOf(child).IsNil() { out[name] = append(out[name],[2]int{offsets[set.Position(child.Pos()).Offset],offsets[set.Position(child.End()).Offset]}) } } }
 params := func(f *ast.FuncType) { values:=[]ast.Node{}; if f.Params != nil { for _, p := range f.Params.List { values=append(values,p) } }; add("parameters",values...); returns:=[]ast.Node{}; if f.Results != nil { for _, p:= range f.Results.List { returns=append(returns,p) } }; add("returnType",returns...) }
 switch value := n.(type) {
 case *ast.FuncDecl: params(value.Type); add("body",value.Body); add("receiver",value.Recv)
 case *ast.FuncLit: params(value.Type); add("body",value.Body)
 case *ast.CallExpr:
  add("callee",value.Fun); args := []ast.Node{}; for _, arg := range value.Args { args=append(args,arg) }; add("arguments",args...)
 case *ast.ReturnStmt:
  values := []ast.Node{}; for _, item := range value.Results { values=append(values,item) }; add("values",values...)
 case *ast.IfStmt:
  if value.Init != nil { add("initializer",value.Init) }; add("condition",value.Cond); add("consequent",value.Body); if value.Else != nil { add("otherwise",value.Else) }
 case *ast.AssignStmt:
  targets := []ast.Node{}; for _, item := range value.Lhs { targets=append(targets,item) }; add("targets",targets...); values := []ast.Node{}; for _, item := range value.Rhs { values=append(values,item) }; add("values",values...)
 case *ast.ValueSpec:
  targets := []ast.Node{}; for _, item := range value.Names { targets=append(targets,item) }; add("targets",targets...); values := []ast.Node{}; for _, item := range value.Values { values=append(values,item) }; add("values",values...); add("type",value.Type)
 case *ast.BinaryExpr: add("left",value.X); add("right",value.Y)
 case *ast.UnaryExpr: add("operand",value.X)
 case *ast.StarExpr: add("operand",value.X)
 case *ast.SelectorExpr: add("receiver",value.X); add("member",value.Sel)
 case *ast.IndexExpr: add("receiver",value.X); add("key",value.Index)
 case *ast.IndexListExpr:
  add("receiver",value.X); values:=[]ast.Node{}; for _, item:=range value.Indices { values=append(values,item) }; add("key",values...)
 case *ast.TypeAssertExpr: add("receiver",value.X); add("type",value.Type)
 case *ast.CompositeLit:
  add("type",value.Type); values:=[]ast.Node{}; for _, item:=range value.Elts { values=append(values,item) }; add("properties",values...)
 case *ast.KeyValueExpr: add("key",value.Key); add("values",value.Value)
 case *ast.BlockStmt:
  values:=[]ast.Node{}; for _, item:=range value.List { values=append(values,item) }; add("statements",values...)
 case *ast.DeferStmt: add("expression",value.Call)
 case *ast.ExprStmt: add("expression",value.X)
 }
 return out
}

func utf16Offsets(content string) []int {
 offsets:=make([]int,len(content)+1)
 units:=0
 for position, char:=range content {
  length:=utf8.RuneLen(char)
  for step:=0; step<length; step++ { offsets[position+step]=units }
  units++
  if char>0xFFFF { units++ }
  offsets[position+length]=units
 }
 return offsets
}

func symbol(n ast.Node) string {
 if function,ok:=n.(*ast.FuncDecl); ok { return function.Name.Name }; if member,ok:=n.(*ast.SelectorExpr); ok { return member.Sel.Name }
 return ""
}
