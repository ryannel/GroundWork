import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildScanExplorer } from '@/application/scan-explorer/build-index';
import { currentCallers } from '@/application/scan-explorer/current-callers';
import {
  currentProvidersFromCanonical,
  currentTargetsFromCanonical,
} from '@/application/scan-explorer/current-targets';
import { visualContext } from '@/application/scan-explorer/visual-context';
import {
  visualArtifacts,
  visualCallers,
  visualOverview,
  visualService,
} from '@/application/scan-explorer/visual-service';
import type { VisualArtifact } from '@/application/scan-explorer/visual-types';
import type { ExplorerIndex } from '@/domain/scan-explorer/contracts';
import type { ExplorerManifest, ExplorerService, ExplorerPage } from '@/domain/service-explorer';
import { explorerPage } from '@/domain/service-explorer-check';
import { sourceDigest } from '@/infrastructure/scan/source-index';
import { retainedExplorerReader } from '@/infrastructure/scan-explorer/retained-capture';
import {
  readVisualExportConfig,
  visualExportInput,
} from '@/infrastructure/scan-explorer/visual-input';
import { parseExplorerManifest } from '@/infrastructure/service-explorer-format';

async function retained(folders: readonly string[]): Promise<ExplorerIndex> {
  const selections = await Promise.all(
    folders.map(async (folder) => ({
      reader: await retainedExplorerReader({
        bundlePath: path.join(folder, 'bundle.json.gz'),
        snapshotPath: path.join(folder, 'snapshot.json'),
      }),
      scope: folder,
      completeness: 'partial' as const,
      limitations: ['Retained source; deployed correspondence remains unverified'],
    })),
  );
  return buildScanExplorer(selections);
}

async function publish(
  output: string,
  manifest: ExplorerManifest,
  artifacts: readonly VisualArtifact[],
): Promise<void> {
  await mkdir(output, { recursive: true });
  const files = new Set(artifacts.map((artifact) => artifact.file));
  for (const artifact of artifacts) {
    const page = checkedPage(artifact);
    if (page.snapshot !== manifest.snapshot) throw new Error('Export page snapshot mismatch');
    if (page.nodes.some((node) => node.target !== null && !files.has(node.target))) {
      throw new Error(`Dangling visual target in ${artifact.file}`);
    }
  }
  await Promise.all(
    artifacts.map(async (artifact) =>
      writeFile(path.join(output, artifact.file), JSON.stringify(artifact.page)),
    ),
  );
  await writeFile(
    path.join(output, 'manifest.json'),
    JSON.stringify(parseExplorerManifest(manifest)),
  );
}

async function main(): Promise<void> {
  const config = await readVisualExportConfig(
    process.argv[2] ?? 'reports/service-explorer-readiness-001/export-input.json',
  );
  const [index, inputs] = await Promise.all([
    retained(config.retained),
    Promise.all(config.services.map(visualExportInput)),
  ]);
  const snapshot = exportSnapshot(config.workspace, inputs, index);
  const projected = inputs.map((input) => projectService(input, { index, snapshot }));
  const artifacts = [
    ...new Map(
      projected.flatMap((item) => item.artifacts).map((artifact) => [artifact.file, artifact]),
    ).values(),
  ];
  const manifest: ExplorerManifest = {
    format: 'service-explorer/v1',
    workspace: config.workspace,
    snapshot,
    services: projected.map((item) => item.service),
    artifacts: artifacts.map((artifact) => {
      const bytes = JSON.stringify(artifact.page);
      return { file: artifact.file, bytes: Buffer.byteLength(bytes), sha256: sourceDigest(bytes) };
    }),
  };
  await publish(config.output, manifest, artifacts);
  process.stdout.write(
    `Service explorer: ${config.output} · ${String(artifacts.length)} bounded pages\n`,
  );
}

function pageFile(component: string, id: string): string {
  const key = `${component}:${id}`;
  return `page-${sourceDigest(key).slice(0, 24)}.json`;
}
function exportSnapshot(
  workspace: string,
  inputs: readonly Awaited<ReturnType<typeof visualExportInput>>[],
  index: ExplorerIndex,
): string {
  return sourceDigest(
    JSON.stringify({
      workspace,
      inputs: inputs.map((item) => ({
        snapshot: item.input.snapshot,
        binding: item.input.binding,
        purpose: item.purpose,
      })),
      retained: index.selections.map((item) => item.reader.snapshot),
    }),
  );
}

function projectService(
  prepared: Awaited<ReturnType<typeof visualExportInput>>,
  options: { readonly index: ExplorerIndex; readonly snapshot: string },
): { readonly service: ExplorerService; readonly artifacts: readonly VisualArtifact[] } {
  const { input, purpose } = prepared;
  const { index, snapshot } = options;
  const enriched = {
    ...input,
    targets: currentTargetsFromCanonical(input, index),
    providers: currentProvidersFromCanonical(input, index),
  };
  const reverse = currentCallers(
    [enriched],
    { component: input.binding.component.logicalId, limit: 100 },
    index,
  );
  const context = visualContext(input, {
    snapshot,
    purpose,
    fileFor: (id) => pageFile(input.binding.component.logicalId, id),
    externalSources: reverse.sourceLinks.map((link) => ({
      id: link.id,
      label: link.url.split('/').at(-1) ?? link.id,
      url: link.url,
    })),
  });
  return {
    service: visualService(context),
    artifacts: [
      ...visualArtifacts(context),
      { file: context.files.get('overview') ?? 'overview.json', page: visualOverview(context) },
      {
        file: context.files.get('callers') ?? 'callers.json',
        page: visualCallers(context, reverse.items),
      },
    ],
  };
}

function checkedPage(artifact: VisualArtifact): ExplorerPage {
  try {
    return explorerPage(artifact.page);
  } catch (error) {
    throw new Error(`Invalid explorer page ${artifact.file}: ${artifact.page.title}`, {
      cause: error,
    });
  }
}

await main();
