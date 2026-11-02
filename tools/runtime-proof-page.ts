import type { Interaction } from '@/domain/knowledge/knowledge.generated';

import { contractView } from './runtime-proof-contracts';
import { componentInternals, implementationPanels } from './runtime-proof-internals';
import { interactionLines } from './runtime-proof-layout';
import { gapLines, sourceLinks } from './runtime-proof-sources';
import { runtimeOverview } from './runtime-proof-svg';
import { anchor, html, type RuntimeProofView, viewRecords } from './runtime-proof-view';

function interactionDetail(view: RuntimeProofView, interaction: Interaction): string {
  const records = viewRecords(view);
  const contract = records.get(interaction.contract);
  const inputs = interaction.requestBindings
    .map(
      (binding) =>
        `<div class="field"><strong>${html(binding.part)} ${html(binding.path.join('.'))}</strong><span> ← ${html(valueLabel(binding.value, records))}</span><small>${html(binding.transform)}</small></div>`,
    )
    .join('');
  const execution = records.get(interaction.execution);
  const code =
    execution?.kind === 'execution_binding'
      ? `<a href="#${anchor(execution.id)}">Open internal logic at this call</a>`
      : '';
  const label = valueLabel(interaction.operation, records);
  const component =
    execution?.kind === 'execution_binding' ? records.get(execution.component) : undefined;
  const actor = component?.kind === 'runtime_component' ? component.label : 'Current execution';
  const direction = interaction.mode === 'consume' ? 'Values received' : 'Values sent';
  return `<article class="call-site"><h2>${html(label)}</h2><p>${html(interaction.condition)}</p><p class="muted">${html(actor)} · ${html(interaction.mode.replaceAll('_', ' '))} · waits for ${html(interaction.waitsFor.replaceAll('_', ' '))} · ${html(interaction.boundary)} boundary</p>${code}<h3>${direction}</h3>${inputs.length === 0 ? '<p>Values are not expanded in this source slice; inspect the declared storage shape and source.</p>' : inputs}${sourceLinks(interaction.evidence, records)}${gapLines(interaction.gaps, records)}${contract?.kind === 'interface_contract' ? contractView(contract, records) : '<p>Supporting contract pending</p>'}</article>`;
}
function connectionPanels(view: RuntimeProofView): string {
  const records = viewRecords(view);
  return interactionLines(view)
    .map((line) => {
      const ids = [
        ...new Set(line.edges.flatMap((edge) => (edge.record === null ? [] : [edge.record]))),
      ];
      const body = ids
        .map((id) => {
          const record = records.get(id);
          return record?.kind === 'interaction'
            ? interactionDetail(view, record)
            : '<p>Interaction record pending</p>';
        })
        .join('');
      return `<section class="inspector" id="${anchor(line.id)}"><a href="#overview">← Components</a><h1>${html(line.label)}</h1>${body}</section>`;
    })
    .join('');
}
function componentPanels(view: RuntimeProofView): string {
  const records = viewRecords(view);
  return view.interactions.nodes
    .map((node) => {
      const record = records.get(node.record);
      if (record?.kind === 'interaction') {
        return `<section class="inspector" id="${anchor(node.id)}"><a href="#overview">← Components</a><h1>${html(node.label)}</h1>${interactionDetail(view, record)}</section>`;
      }
      if (record?.kind !== 'runtime_component') return '';
      const internal = componentInternals(view, record.id);
      const inbound = new Set(
        [...records.values()]
          .filter(
            (item): item is Interaction => item.kind === 'interaction' && item.mode === 'consume',
          )
          .flatMap((item) => {
            const execution = records.get(item.execution);
            return execution?.kind === 'execution_binding' && execution.component === record.id
              ? [item.contract]
              : [];
          }),
      );
      const contracts = [...records.values()].filter(
        (item) =>
          item.kind === 'interface_contract' &&
          (item.component === record.id || inbound.has(item.id)),
      );
      const exposed = contracts
        .flatMap((contract) =>
          contract.kind === 'interface_contract' ? [contractView(contract, records)] : [],
        )
        .join('');
      return `<section class="inspector" id="${anchor(node.id)}"><a href="#overview">← Components</a><h1>${html(record.label)}</h1><p class="muted">${html(record.category)} · ${html(record.technology)} · source declaration</p>${internal}${exposed}<h2>Component sources</h2>${sourceLinks(record.evidence, records)}${gapLines(record.gaps, records)}</section>`;
    })
    .join('');
}
export function runtimeProofPage(view: RuntimeProofView): string {
  const name = view.name === 'capture' ? 'Capture payment transaction' : 'Create soft offer';
  const overview = runtimeOverview(view);
  const components = componentPanels(view);
  const connections = connectionPanels(view);
  const internals = implementationPanels(view);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} · Runtime proof</title><style>body{margin:0;background:#f3f7fa;color:#243c52;font:16px Arial,sans-serif}nav{display:flex;gap:24px;flex-wrap:wrap;padding:18px 45px;background:#e8eff5}a{color:#235f91}nav a{text-decoration:none}main{max-width:1320px;margin:auto}svg{display:block;width:100%;height:auto}.inspector{display:none;padding:30px 45px;background:white;scroll-margin-top:20px}.inspector:target{display:block}.intro{padding:0 45px 24px}.muted{color:#5f7182;font-size:14px}h1{font-size:27px}h2{font-size:21px;margin-top:28px}h3{font-size:17px}h4{margin:12px 0;font-size:15px}p{line-height:1.5}.source{display:block;font:12px/1.6 ui-monospace,monospace;overflow-wrap:anywhere}.contract-columns{display:grid;grid-template-columns:1fr 1fr;gap:36px}.shape{padding:10px 0 10px 18px;border-left:2px solid #b8cad7;margin:12px 0}.field{font:14px/1.7 ui-monospace,monospace;padding:7px 0;border-bottom:1px solid #e3eaf0;overflow-wrap:anywhere}.field-source{display:inline-block;margin-left:12px;font-size:11px}.field small{display:block;color:#60748a}.nested{padding-left:18px}details{margin:18px 0}summary{cursor:pointer}.gaps{color:#805f27}.candidate{padding:14px;border-left:3px dashed #b38b57}.call-site{margin:30px 0;padding-top:12px;border-top:1px solid #b9cad8}@media(max-width:760px){.contract-columns{grid-template-columns:1fr}.inspector{padding:20px}nav{padding:16px}}</style><nav><a href="#overview">Components</a><a href="../control.svg">Full control flow</a><a href="../value.svg">Value journey</a><a href="interactions.json">Component query</a><a href="trace.request.json">Pinned trace request</a></nav><main id="overview">${overview}<p class="intro muted">Choose a node or connection. Solid lines show source-declared interactions; dashed lines show possible delivery or unresolved boundaries. Snapshot ${html(view.interactions.snapshot.slice(0, 12))} · Source inspection, no Volvo API or store was called.</p>${components}${connections}${internals}</main></html>`;
}

function valueLabel(id: string, records: ReturnType<typeof viewRecords>): string {
  const record = records.get(id);
  return record?.kind === 'value' || record?.kind === 'operation' ? record.label : id;
}
