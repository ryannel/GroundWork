import 'server-only';

import path from 'node:path';

import type { DiscoverySourceFile } from './discovery-inventory-source';

export interface DiscoveryScope {
  readonly root: string;
  readonly manifests: readonly DiscoverySourceFile[];
  readonly files: readonly DiscoverySourceFile[];
  readonly rootEvidence: DiscoverySourceFile | undefined;
}
function discoveryManifest(filename: string): boolean {
  const name = path.posix.basename(filename);
  return (
    [
      'package.json',
      'project.json',
      'pom.xml',
      'go.mod',
      'Cargo.toml',
      'pyproject.toml',
      'setup.py',
      'requirements.txt',
      'build.gradle',
      'build.gradle.kts',
    ].includes(name) || /\.(?:csproj|fsproj|vbproj)$/u.test(name)
  );
}
function ignored(filename: string): boolean {
  return filename
    .split('/')
    .some((part) => ['node_modules', 'vendor', '.yarn', '__tests__'].includes(part));
}
export function discoveryEntry(filename: string): boolean {
  return [
    /(?:^|\/)app\/(?:[^/]+\/)*(?:page|route)\.[cm]?[jt]sx?$/u.test(filename),
    /(?:^|\/)pages\/(?:[^/]+\/)*[^/]+\.[cm]?[jt]sx?$/u.test(filename),
    /(?:^|\/)(?:controllers?|consumers?|jobs?|functions?)\//iu.test(filename),
    /(?:Controller|Consumer|Listener|Job|Worker|Handler)\.(?:cs|java|go|py|tsx?|jsx?)$/u.test(
      filename,
    ),
    /(?:^|\/)(?:Program\.cs|main\.(?:go|rs|py)|server\.[jt]s|function\.json)$/u.test(filename),
    /(?:^|\/)main\.[cm]?[jt]s$/u.test(filename),
    /\.(?:controller|consumer|listener|job|handler)\.[cm]?[jt]s$/u.test(filename),
  ].includes(true);
}
function discoveryImplementation(filename: string): boolean {
  return (
    /\.(?:[cm]?[jt]sx?|cs|java|go|py|rs|razor|html|graphql|proto)$/u.test(filename) &&
    !/(?:^|\/)(?:tests?|__tests__)\//u.test(filename) &&
    ![/\.(?:test|spec)\./u.test(filename), filename.endsWith('_test.go')].includes(true)
  );
}
function discoverySupporting(filename: string): boolean {
  const name = path.posix.basename(filename);
  return (
    /^(?:README[^/]*|Dockerfile[^/]*|appsettings[^/]*\.json)$/iu.test(name) ||
    /^(?:host|function|project)\.json$/u.test(name) ||
    /^(?:serverless|next\.config)\.[^/]+$/u.test(name)
  );
}
/** Paths identify candidates only. No filename or manifest alone establishes a runtime. */
export function discoveryScopes(files: readonly DiscoverySourceFile[]): readonly DiscoveryScope[] {
  const regular = files.filter(
    (file) => file.kind === 'blob' && /^100(?:644|755)$/u.test(file.mode),
  );
  const manifests = regular.filter((file) => discoveryManifest(file.path) && !ignored(file.path));
  const roots = new Set(manifests.map((file) => path.posix.dirname(file.path)));
  for (const file of regular) {
    const app = /^(apps\/[^/]+)\//u.exec(file.path)?.[1];
    if (app !== undefined) roots.add(app);
    if (path.posix.basename(file.path) === 'function.json') {
      roots.add(path.posix.dirname(file.path));
    }
  }
  if (roots.size === 0) roots.add('.');
  const ordered = [...roots].toSorted((left, right) => left.localeCompare(right));
  const owned = new Map<string, DiscoverySourceFile[]>(ordered.map((root) => [root, []]));
  for (const file of regular.filter((item) => !ignored(item.path))) {
    const owner = ordered
      .filter((root) => root === '.' || file.path.startsWith(`${root}/`))
      .toSorted((left, right) => right.length - left.length)[0];
    if (owner !== undefined) owned.get(owner)?.push(file);
  }
  return ordered.map((root) => ({
    root,
    manifests: manifests.filter((file) => path.posix.dirname(file.path) === root),
    files: owned.get(root) ?? [],
    rootEvidence: regular.find((file) => root === '.' || file.path.startsWith(`${root}/`)),
  }));
}
export function discoverySelection(scope: DiscoveryScope): readonly {
  readonly file: DiscoverySourceFile;
  readonly basis: 'boundary' | 'entry' | 'implementation' | 'root_name';
}[] {
  const entries = scope.files.filter((file) => discoveryEntry(file.path));
  const supporting = scope.files.filter((file) => discoverySupporting(file.path));
  const implementations = scope.files.filter((file) => discoveryImplementation(file.path));
  const selected = new Map<
    string,
    {
      readonly file: DiscoverySourceFile;
      readonly basis: 'boundary' | 'entry' | 'implementation' | 'root_name';
    }
  >();
  for (const file of scope.manifests) selected.set(file.path, { file, basis: 'boundary' });
  for (const file of supporting.slice(0, 4)) {
    if (!selected.has(file.path)) selected.set(file.path, { file, basis: 'implementation' });
  }
  for (const file of entries.slice(0, 12)) selected.set(file.path, { file, basis: 'entry' });
  for (const file of implementations.slice(0, 6)) {
    if (!selected.has(file.path)) selected.set(file.path, { file, basis: 'implementation' });
  }
  if (selected.size === 0 && scope.rootEvidence !== undefined) {
    selected.set(scope.rootEvidence.path, { file: scope.rootEvidence, basis: 'root_name' });
  }
  return [...selected.values()];
}
