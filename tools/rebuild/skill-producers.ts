const LEGACY_TOOLS: ReadonlySet<string> = new Set([
  'tools/evidence/migrate.ts',
  'tools/install-corpus-explorer.ts',
  'tools/pack-corpus-explorer.ts',
  'tools/publish-corpus-explorer.ts',
  'tools/refine-corpus-explorer.ts',
  'tools/repair-corpus-entries.ts',
  'tools/scan-diff.ts',
  'tools/scan-discovery-inventory.ts',
  'tools/scan-discovery.ts',
  'tools/scan-interpretation.ts',
  'tools/scan-mark.ts',
  'tools/scan-readiness.ts',
  'tools/scan-refresh.ts',
  'tools/scan-repository-adopt.ts',
  'tools/scan-repository-pass.ts',
  'tools/scan-repository.ts',
  'tools/scan-run.ts',
  'tools/scan-spring-entry-catalogue.ts',
  'tools/scan-spring-entry-query.ts',
  'tools/scan-spring.ts',
  'tools/scan-status.ts',
  'tools/validate-knowledge.ts',
]);

const LEGACY_READER = /\b(?:readWorkspaceModel|legacyViewOf|readToday|systemModelOf)\b/u;
const RUN_SCRIPT = /\bnpm\s+(?:--silent\s+)?run(?:-script)?\s+(?:--silent\s+)?([\w:-]+)/gu;
const TOOL_PATH = /\btools\/[\w/-]+\.ts\b/gu;

interface ProducerUse {
  readonly file: string;
  readonly line: number;
  readonly target: string;
}

function toolPaths(command: string): readonly string[] {
  return [...command.matchAll(TOOL_PATH)]
    .map(([file]) => file)
    .filter((file) => LEGACY_TOOLS.has(file));
}

function lineUses(
  line: string,
  aliases: ReadonlyMap<string, readonly string[]>,
  script: boolean,
): readonly string[] {
  const indirect = [...line.matchAll(RUN_SCRIPT)].flatMap(
    (match) => aliases.get(match[1] ?? '') ?? [],
  );
  const reader = script ? LEGACY_READER.exec(line)?.[0] : undefined;
  return [...new Set([...toolPaths(line), ...indirect, ...(reader === undefined ? [] : [reader])])];
}

export function skillProducerUses(
  files: ReadonlyMap<string, string>,
  scripts: Readonly<Record<string, unknown>>,
): readonly ProducerUse[] {
  const aliases = new Map(
    Object.entries(scripts).flatMap(([script, command]) =>
      typeof command === 'string' ? [[script, toolPaths(command)] as const] : [],
    ),
  );
  return [...files].flatMap(([file, text]) => {
    if (!file.startsWith('.agents/skills/')) return [];
    const script = /\.[cm]?[jt]s$/u.test(file);
    return text
      .split('\n')
      .flatMap((line, index) =>
        lineUses(line, aliases, script).map((target) => ({ file, line: index + 1, target })),
      );
  });
}
