import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const directories = ['server', 'shared', 'src', 'scripts', 'tests']
const maxLineLength = 160
const violations: string[] = []

function visitFiles(directory: string, files: string[]) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) visitFiles(filename, files)
    else if (/\.tsx?$/.test(filename)) files.push(filename)
  }
}

const files: string[] = []
for (const directory of directories) visitFiles(directory, files)

for (const filename of files) {
  const content = fs.readFileSync(filename, 'utf8')
  const lines = content.split('\n')
  lines.forEach((line, index) => {
    if (line.length > maxLineLength) violations.push(`${filename}:${index + 1}: line exceeds ${maxLineLength} characters`)
  })

  const kind = filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true, kind)
  function check(node: ts.Node) {
    if (ts.isSourceFile(node) || ts.isBlock(node)) {
      let previousLine = -1
      for (const statement of node.statements) {
        const line = source.getLineAndCharacterOfPosition(statement.getStart(source)).line
        if (line === previousLine) violations.push(`${filename}:${line + 1}: separate statements onto their own lines`)
        previousLine = line
      }
    }
    ts.forEachChild(node, check)
  }
  check(source)
}

if (violations.length) {
  console.error(violations.join('\n'))
  process.exitCode = 1
}
