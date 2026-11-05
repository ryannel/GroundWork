// The retirement gate lists behaviour separately from a publication's implementation details.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readExplorerCatalogue } from '@/infrastructure/service-explorer-catalogue';
import { readExplorerManifest } from '@/infrastructure/service-explorer-files';
import { workspaceRegistrations } from '@/infrastructure/workspace-folders';

interface Capability {
  readonly capability: string;
  readonly file: string;
  readonly token: string;
  readonly replacement: string;
}
const ROOT = 'src/features/service-explorer/';
const CAPABILITIES: readonly Capability[] = [
  {
    capability: 'All source operations disclosure',
    file: `${ROOT}explorer-stage.tsx`,
    token: 'All source operations',
    replacement:
      'Entry canvas disclosure preserves cited details (PR 5); arbitrary source operations still need explicit retirement approval before PR 10.',
  },
  {
    capability: 'Repository and service overview',
    file: `${ROOT}explorer-actions.tsx`,
    token: 'Code map',
    replacement:
      'Component/system pages and codeHomes (PR 4/8); repository scope must stay distinct from a deployed component.',
  },
  {
    capability: 'Repository selection and search',
    file: `${ROOT}explorer-corpus.client.tsx`,
    token: 'service',
    replacement: 'Component/repository navigation backed by homes and evidence (PR 8).',
  },
  {
    capability: 'Endpoint, consumer and job entry links',
    file: `${ROOT}explorer-actions.tsx`,
    token: 'Endpoint or entry',
    replacement: 'api:/sub:/job:/ui: entry flow links (PR 5/8).',
  },
  {
    capability: 'Direct entry and selected-node URLs; history',
    file: `${ROOT}use-explorer-location.ts`,
    token: 'location',
    replacement: 'Stable entry/step ids and drill history in the entry flow (PR 5/8).',
  },
  {
    capability: 'Caller lists and published references',
    file: `${ROOT}explorer-actions.tsx`,
    token: 'Published references',
    replacement:
      'indexOf.callers plus explicitly scoped evidence references; never claim exhaustive runtime callers (PR 4/8/9).',
  },
  {
    capability: 'References in the selected view',
    file: `${ROOT}explorer-actions.tsx`,
    token: 'References in view',
    replacement: 'Selected step/entry incoming and outgoing links with gaps (PR 5).',
  },
  {
    capability: 'Data shapes, required and nullable fields',
    file: `${ROOT}explorer-schema.tsx`,
    token: 'required',
    replacement:
      'Contract schemas and tagged field types in the inspector (PR 3/5); preserve unknown/nullability evidence.',
  },
  {
    capability: 'Nested schema drill',
    file: `${ROOT}explorer-inspector.tsx`,
    token: 'Explore schema',
    replacement: 'Schema links from entry/step inspectors (PR 5).',
  },
  {
    capability: 'Source file index and method links',
    file: `${ROOT}explorer-actions.tsx`,
    token: 'Source files',
    replacement:
      'Pinned repository homes and evidence-backed source navigation (PR 8/9); proof still required for arbitrary methods.',
  },
  {
    capability: 'Source text and long source detail',
    file: `${ROOT}explorer-inspector.tsx`,
    token: 'Source detail',
    replacement:
      'Read source at its cited commit (PR 9); a Git-host link alone has not proven parity with embedded text.',
  },
  {
    capability: 'Method-level flows and implementation drill',
    file: `${ROOT}explorer-inspector.tsx`,
    token: 'Open implementation',
    replacement:
      'Entry flow handles reachable entry logic (PR 5). Arbitrary/test method flows need an explicit user-approved retirement or replacement before PR 10.',
  },
  {
    capability: 'Branches, calls, failures, asynchronous and data links',
    file: 'src/domain/service-explorer.ts',
    token: "'control'",
    replacement: 'Cited handler step constructs and causes (PR 3/5/9); prove each construct.',
  },
  {
    capability: 'Reviewed Inferred context and confidence',
    file: `${ROOT}explorer-actions.tsx`,
    token: 'Inferred context',
    replacement:
      'Promote reviewed claims and reference repairs to evidence before retiring packs (PR 9).',
  },
  {
    capability: 'Search within indexes',
    file: `${ROOT}explorer-index.tsx`,
    token: 'Find in this index',
    replacement: 'Entry/reference catalogues with search (PR 8).',
  },
  {
    capability: 'Inspector selection and connection lists',
    file: `${ROOT}explorer-inspector.tsx`,
    token: 'ExplorerConnections',
    replacement: 'Entry flow inspector and step-linked targets (PR 5).',
  },
  {
    capability: 'Pan, zoom, fit and full screen',
    file: 'src/ui/explorer-canvas.tsx',
    token: 'export',
    replacement: 'Shared node canvas controls in the entry flow (PR 5).',
  },
  {
    capability: 'Gaps and partial selection notices',
    file: `${ROOT}explorer-stage.tsx`,
    token: 'gap',
    replacement: 'Model gaps remain visible; partial evidence is labelled (PR 4/5/9).',
  },
  {
    capability: 'Loading errors, retry and bounded asset verification',
    file: `${ROOT}use-explorer-page.ts`,
    token: 'error',
    replacement: 'Read-only route error/retry flow and validated evidence reads (PR 5/8/9).',
  },
  {
    capability: 'Legacy manifest fallback and corpus publication',
    file: `${ROOT}explorer-publication.tsx`,
    token: 'manifest',
    replacement:
      'One readModel route after comparisons pass for both existing publications (PR 8/10).',
  },
];

export async function writeExplorerParity(): Promise<void> {
  const rows: (Capability & { readonly line: number; readonly status: string })[] = [];
  for (const item of CAPABILITIES) {
    const sourceText = await readFile(item.file, 'utf8');
    const lines = sourceText.split('\n');
    const line = lines.findIndex((text) => text.toLowerCase().includes(item.token.toLowerCase()));
    if (line === -1) {
      throw new Error(`Parity source moved: ${item.file} (${item.token}). Review the inventory.`);
    }
    rows.push({ ...item, line: line + 1, status: 'planned; parity unproven' });
  }
  const publications: object[] = [];
  for (const workspace of await workspaceRegistrations()) {
    const catalogue = await readExplorerCatalogue(workspace.id);
    const manifest = await readExplorerManifest(workspace.id);
    const services =
      catalogue?.selections.map((selection) => selection.service) ?? manifest?.services ?? [];
    publications.push({
      workspace: workspace.id,
      selected: catalogue === null ? 'legacy manifest' : 'corpus catalogue',
      available: catalogue !== null || manifest !== null,
      services: services.map((service) => ({
        id: service.id,
        repo: service.repo,
        commit: service.commit,
        overview: service.overview,
        callers: service.callers,
        entries: service.entryCount ?? service.entries.length,
        sourceIndex: service.sourceIndex ?? null,
        interpretationIndex: service.interpretationIndex ?? null,
      })),
      legacyServices: manifest?.services.map((service) => service.id) ?? [],
    });
  }
  await mkdir('artifacts/rebuild', { recursive: true });
  await writeFile(
    'artifacts/rebuild/explorer-parity.json',
    `${JSON.stringify({ capabilities: rows, publications }, null, 2)}\n`,
  );
  await writeFile(
    'artifacts/rebuild/explorer-parity.md',
    `# Explorer parity inventory\n\nGenerated by tools/explorer-parity.ts from reachable UI controls and both publication modes. These are planned destinations, not proof of parity or approval to retire anything. Every row blocks retirement until its replacement is proven or the user explicitly approves retirement. In particular, arbitrary method flows, embedded source text and reviewed Inferred context remain open.\n\n| Capability | Current evidence | Future replacement | Status |\n|---|---|---|---|\n${rows
      .map(
        (row) =>
          `| ${row.capability} | ${row.file}:${String(row.line)} | ${row.replacement} | ${row.status} |`,
      )
      .join('\n')}\n`,
  );
  console.log(`Explorer: ${String(rows.length)} capabilities; none retired or proven.`);
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await writeExplorerParity();
}
