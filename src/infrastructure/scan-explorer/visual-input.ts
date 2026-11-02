import 'server-only';

import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import { currentSourceIds } from '@/application/scan-explorer/current-source-ids';
import type { Source } from '@/domain/scan/scan.generated';
import type {
  CurrentRecord,
  CurrentScanInput,
  DeclaredRuntimeBinding,
} from '@/domain/scan-explorer/current-contracts';
import type { ExplorerService } from '@/domain/service-explorer';
import { knowledgeValidators } from '@/infrastructure/knowledge/knowledge-format';
import { scanValidator } from '@/infrastructure/scan/scan-format';

import { currentQueryPublication } from './current-publication';
import { visualPurpose } from './visual-interpretation';
import { visualContentSnapshot, uniqueVisualRecords } from './visual-selection';

const sourceSchema = z.object({
  kind: z.literal('source'),
  id: z.string(),
  repo: z.string(),
  path: z.string(),
  commit: z.string(),
  blob: z.string(),
  lines: z.tuple([z.number().int(), z.number().int()]),
  host: z.string(),
  authority: z.enum(['declared', 'tested', 'observed']),
});
const bindingSchema = z.object({
  component: z.unknown(),
  repo: z.string(),
  commit: z.string(),
  declarations: z.array(sourceSchema).min(1),
  modulePaths: z.array(z.string()).min(1),
  verification: z.literal('pinned_runtime_declaration'),
  limitations: z.array(z.string()),
});
const serviceSchema = z.object({
  binding: z.string(),
  metadata: z.string(),
  documents: z.array(z.string()),
  queryDirectories: z.array(z.string()),
  interpretation: z.string(),
  interpretationInputs: z.string(),
});
const configSchema = z.object({
  workspace: z.string(),
  output: z.string(),
  retained: z.array(z.string()),
  services: z.array(serviceSchema).min(1),
});
export type VisualExportConfig = z.infer<typeof configSchema>;

export async function readVisualExportConfig(file: string): Promise<VisualExportConfig> {
  return configSchema.parse(JSON.parse(await readFile(file, 'utf8')));
}

async function runtimeBinding(filename: string): Promise<DeclaredRuntimeBinding> {
  const raw: unknown = JSON.parse(await readFile(filename, 'utf8'));
  const wrapper = z.object({ binding: z.unknown() }).parse(raw);
  const parsed = bindingSchema.parse(wrapper.binding);
  const validate = await knowledgeValidators();
  const component = validate.record(parsed.component);
  if (component.kind !== 'runtime_component') {
    throw new Error('Runtime component declaration expected');
  }
  return {
    ...parsed,
    component,
    declarations: parsed.declarations.map((source): Source => source),
  };
}

export async function visualExportInput(config: VisualExportConfig['services'][number]): Promise<{
  readonly input: CurrentScanInput;
  readonly purpose: ExplorerService['purpose'];
}> {
  const validate = await scanValidator();
  const metadataBytes = await readFile(config.metadata, 'utf8');
  const metadata = validate(JSON.parse(metadataBytes));
  const [binding, ...documents] = await Promise.all([
    runtimeBinding(config.binding),
    ...config.documents.map(async (file) => validate(JSON.parse(await readFile(file, 'utf8')))),
    ...config.queryDirectories.map(currentQueryPublication),
  ]);
  const selections = [metadata, ...documents];
  const all = selections.flatMap((document) => [
    ...document.sources,
    ...document.contracts,
    ...document.gaps,
    ...document.summaries,
    ...(document.semantic ?? []),
    ...(document.framework ?? []),
    ...(document.bindings ?? []),
  ]);
  const records = boundRecords(all, binding);
  const sources = records.filter((record) => record.kind === 'source');
  const purpose = await visualPurpose({
    interpretation: config.interpretation,
    inputs: config.interpretationInputs,
    target: metadata,
    targetBytes: metadataBytes,
  });
  return {
    input: {
      snapshot: visualContentSnapshot({
        selections,
        binding,
        purpose,
        interpretation: await readFile(config.interpretation, 'utf8'),
        inputs: await readFile(config.interpretationInputs, 'utf8'),
      }),
      records,
      sources,
      binding,
      coverage: [
        `${String(sources.length)} pinned source ranges are selected for this component.`,
        'Entries without a selected method body remain unexpanded; their effects are unknown.',
        'Runtime execution, deployed addresses and complete caller discovery remain unobserved.',
      ],
    },
    purpose,
  };
}

function boundRecords(
  all: readonly CurrentRecord[],
  binding: DeclaredRuntimeBinding,
): CurrentRecord[] {
  const bound = new Set(
    all
      .filter((record) => record.kind === 'source')
      .filter(
        (source) =>
          source.repo === binding.repo &&
          source.commit === binding.commit &&
          binding.modulePaths.some(
            (module) => module.endsWith('/') && source.path.startsWith(module),
          ),
      )
      .map((source) => source.id),
  );
  return uniqueVisualRecords(
    all.filter((record) => currentSourceIds(record).some((id) => bound.has(id))),
  );
}
