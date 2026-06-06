import { Ctx, UsageError } from '../util/context';

/** Generate a shell completion script from the command registry. Imported lazily by
 *  the registry, so we require COMMANDS here to avoid a cycle at module load. */
export async function completion(ctx: Ctx): Promise<number> {
  const shell = ctx.args[0];
  // Pull the registry at call time to avoid an import cycle.
  const { COMMANDS } = await import('../registry');
  const verbs = COMMANDS.map((c) => c.name);
  const nounsByVerb = COMMANDS.filter((c) => c.nouns?.length).map((c) => ({ verb: c.name, nouns: c.nouns! }));
  const flagsByVerb = COMMANDS.filter((c) => c.flags?.length).map((c) => ({
    verb: c.name,
    flags: c.flags!.map((f) => f.name),
  }));

  if (shell === 'bash') {
    process.stdout.write(bashScript(verbs, nounsByVerb, flagsByVerb) + '\n');
    return 0;
  }
  if (shell === 'zsh') {
    process.stdout.write(zshScript(verbs, nounsByVerb, flagsByVerb) + '\n');
    return 0;
  }
  if (shell === 'fish') {
    process.stdout.write(fishScript(verbs, nounsByVerb, flagsByVerb) + '\n');
    return 0;
  }
  throw new UsageError('Usage: ./dev completion bash|zsh|fish');
}

type NV = { verb: string; nouns: string[] };
type FV = { verb: string; flags: string[] };

function bashScript(verbs: string[], nouns: NV[], flags: FV[]): string {
  const nounCases = nouns.map((n) => `      ${n.verb}) COMPREPLY=( $(compgen -W "${n.nouns.join(' ')}" -- "$cur") ); return;;`).join('\n');
  const flagCases = flags.map((f) => `      ${f.verb}) extra="${f.flags.join(' ')}";;`).join('\n');
  return `# bash completion for ./dev — eval "$(./dev completion bash)"
_dev_complete() {
  local cur prev verb extra
  cur="\${COMP_WORDS[COMP_CWORD]}"
  verb="\${COMP_WORDS[1]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${verbs.join(' ')}" -- "$cur") ); return
  fi
  case "$verb" in
${nounCases}
  esac
  extra=""
  case "$verb" in
${flagCases}
  esac
  COMPREPLY=( $(compgen -W "$extra" -- "$cur") )
}
complete -F _dev_complete ./dev dev`;
}

function zshScript(verbs: string[], nouns: NV[], _flags: FV[]): string {
  const nounCases = nouns.map((n) => `    ${n.verb}) compadd ${n.nouns.join(' ')} ;;`).join('\n');
  return `#compdef dev ./dev
# zsh completion for ./dev — eval "$(./dev completion zsh)"
_dev() {
  if (( CURRENT == 2 )); then
    compadd ${verbs.join(' ')}
    return
  fi
  case "\${words[2]}" in
${nounCases}
  esac
}
_dev "$@"`;
}

function fishScript(verbs: string[], nouns: NV[], flags: FV[]): string {
  const lines: string[] = [
    '# fish completion for ./dev — ./dev completion fish | source',
    `complete -c dev -f`,
    `complete -c dev -n '__fish_use_subcommand' -a '${verbs.join(' ')}'`,
  ];
  for (const n of nouns) {
    lines.push(`complete -c dev -n '__fish_seen_subcommand_from ${n.verb}' -a '${n.nouns.join(' ')}'`);
  }
  for (const f of flags) {
    for (const flag of f.flags) {
      lines.push(`complete -c dev -n '__fish_seen_subcommand_from ${f.verb}' -l '${flag.replace(/^--/, '')}'`);
    }
  }
  return lines.join('\n');
}
