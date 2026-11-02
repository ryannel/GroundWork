/** Filename metadata is a denominator, never proof of framework or semantic support. */
export interface RescanTreeFile {
  readonly path: string;
  readonly kind: string;
  readonly mode: string;
}
export interface RescanLanguage {
  readonly language: string;
  readonly files: number;
  readonly syntax: 'not_assessed';
  readonly semantics: 'not_assessed';
  readonly framework: 'not_assessed';
}
const languages: Readonly<Record<string, string>> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  java: 'java',
  go: 'go',
  cs: 'csharp',
  csx: 'csharp',
  py: 'python',
  pyi: 'python',
  rs: 'rust',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  sc: 'scala',
  fs: 'fsharp',
  fsx: 'fsharp',
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  hpp: 'cpp',
  vue: 'vue',
  svelte: 'svelte',
  sql: 'sql',
  proto: 'protobuf',
  graphql: 'graphql',
  gql: 'graphql',
  graphqls: 'graphql',
  rhai: 'rhai',
  cshtml: 'razor',
  bicep: 'bicep',
  ipynb: 'python-notebook',
  cmd: 'windows-shell',
  bat: 'windows-shell',
  handlebars: 'handlebars',
  tpl: 'go-template',
  feature: 'gherkin',
  avsc: 'avro-schema',
  css: 'css',
  scss: 'scss',
  sh: 'shell',
  bash: 'shell',
  ps1: 'powershell',
  tf: 'terraform',
  mdx: 'mdx',
  html: 'html',
  hbs: 'handlebars',
};
const nextCandidate = 'nextjs-candidate';
const markers: Readonly<Record<string, string>> = {
  'pom.xml': 'maven',
  'build.gradle': 'gradle',
  'build.gradle.kts': 'gradle',
  'package.json': 'node-package',
  'go.mod': 'go-module',
  'Cargo.toml': 'cargo',
  'pyproject.toml': 'python-project',
  'requirements.txt': 'python-requirements',
  'next.config.ts': nextCandidate,
  'next.config.js': nextCandidate,
  'next.config.mjs': nextCandidate,
  'angular.json': 'angular-candidate',
};
function rescanFileLanguage(filename: string): string | null {
  const basename = filename.split('/').at(-1) ?? '';
  if (
    basename === 'Dockerfile' ||
    basename.startsWith('Dockerfile.') ||
    basename.toLowerCase().endsWith('.dockerfile')
  ) {
    return 'dockerfile';
  }
  if (basename === 'Makefile') return 'make';
  const extension = filename.split('.').at(-1)?.toLowerCase() ?? '';
  return languages[extension] ?? null;
}
export function rescanTreeSummary(files: readonly RescanTreeFile[]): {
  readonly trackedFiles: number;
  readonly nonRegularFiles: number;
  readonly languages: readonly RescanLanguage[];
  readonly frameworkIndicators: readonly { readonly path: string; readonly indicator: string }[];
  readonly otherSuffixes: Readonly<Record<string, number>>;
  readonly qualification: string;
} {
  const regular = files.filter(
    (file) => file.kind === 'blob' && ['100644', '100755'].includes(file.mode),
  );
  const counts = new Map<string, number>();
  const otherSuffixes: Record<string, number> = {};
  for (const file of regular) {
    const language = rescanFileLanguage(file.path);
    if (language === null) {
      const suffix = file.path.split('/').at(-1)?.split('.').slice(1).at(-1) ?? '[none]';
      otherSuffixes[suffix] = (otherSuffixes[suffix] ?? 0) + 1;
    } else {
      counts.set(language, (counts.get(language) ?? 0) + 1);
    }
  }
  return {
    trackedFiles: files.length,
    nonRegularFiles: files.length - regular.length,
    languages: [...counts]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([language, count]) => ({
        language,
        files: count,
        syntax: 'not_assessed',
        semantics: 'not_assessed',
        framework: 'not_assessed',
      })),
    frameworkIndicators: regular.flatMap((file) => {
      const basename = file.path.split('/').at(-1) ?? '';
      const indicator =
        markers[basename] ?? (basename.endsWith('.csproj') ? 'dotnet-project' : undefined);
      return indicator === undefined ? [] : [{ path: file.path, indicator }];
    }),
    otherSuffixes,
    qualification:
      'Metadata only. Review other suffixes for unmapped source languages; manifests indicate candidates, not framework support. Tests, generated and vendored files remain in the denominator.',
  };
}
