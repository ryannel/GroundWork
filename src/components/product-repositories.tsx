import type { Product } from '@/data/model'
import { useQuery } from '@/data/store'
import { useResolvedCatalog } from '@/ui/use-resolved-catalog'

const revision = (value?: string | null) => value?.slice(0, 12) ?? 'unknown revision'

/** The repository declarations are useful even before a catalog has been scanned. */
export function ProductRepositories({ product, resolved }: { product: Product; resolved?: ReturnType<typeof useResolvedCatalog> }) {
  const repositories = useQuery().productRepositories(product.id)
  const ownResolution = useResolvedCatalog(resolved ? '' : product.id)
  const { result, error } = resolved ?? ownResolution
  if (!repositories.length && !product.domain) return null
  return <section aria-labelledby="product-repositories-heading" className="product-page-body mt-6">
    <div className="product-view-heading">
      <div>
        <h2 id="product-repositories-heading">Repositories</h2>
        <p>Source repositories owned or used by {product.name}. A catalog adds detail, but the product exists without one.</p>
      </div>
      {product.domain && <a href={product.domain} className="text-sm text-accent underline">Product domain</a>}
    </div>
    {!!repositories.length && <ul className="grid gap-3 md:grid-cols-2">
      {repositories.map(entry => <li key={`${entry.repository}:${entry.role}`} className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <strong className="break-all text-sm">{entry.repository}</strong>
          <span className="text-xs text-fg-muted">{entry.role === 'owned' ? 'Owned' : 'Used'}</span>
        </div>
        {!!entry.paths?.length && <p className="mt-2 text-xs text-fg-muted">Paths: {entry.paths.join(', ')}</p>}
        {!!entry.aliases?.length && <p className="mt-1 text-xs text-fg-muted">Earlier names: {entry.aliases.join(', ')}</p>}
        {result?.repositories.filter(catalog => catalog.repository === entry.repository).map(catalog => <div key={catalog.repository} className="mt-3 border-t border-border pt-3 text-xs">
          <p><strong>Catalog read:</strong> {catalog.selected === 'local' ? `Local from ${catalog.local.label}` : catalog.source?.label ?? 'Source catalog not loaded'}</p>
          <p>{catalog.components.length} catalog {catalog.components.length === 1 ? 'component' : 'components'} resolved for this product.</p>
          {!!catalog.resolution.warnings.length && <details className="mt-2"><summary role="status">{catalog.resolution.warnings.length} catalog revision {catalog.resolution.warnings.length === 1 ? 'conflict' : 'conflicts'} need review</summary><ul className="mt-1 grid gap-1">
            {catalog.resolution.warnings.map((warning, index) => <li key={`${warning.componentId}:${warning.kind}:${warning.id}:${index}`}>
              {warning.componentId} · {warning.kind}/{warning.id}: {warning.status} ordering
            </li>)}
          </ul></details>}
          {!!catalog.incompatible.length && <details className="mt-2"><summary role="status">{catalog.incompatible.length} flow or finding {catalog.incompatible.length === 1 ? 'has' : 'have'} incompatible references</summary><ul className="mt-1 grid gap-1">
            {catalog.incompatible.map(detail => <li key={`${detail.unit.componentId}:${detail.unit.kind}:${detail.unit.id}`}>
              {detail.unit.componentId} · {detail.unit.kind}/{detail.unit.id}: {detail.incompatible.map(reference =>
                `${reference.kind}/${reference.id} (area at ${revision(reference.areaRevision)})`).join(', ')}
            </li>)}
          </ul></details>}
          {!!catalog.resolution.areas.length && <details className="mt-2"><summary>Area provenance</summary><ul className="mt-1 grid gap-1">
            {catalog.resolution.areas.map(area => <li key={`${area.unit.componentId}:${area.unit.area}`}>
              {area.unit.componentId} · {area.unit.area}: {area.provenance.catalog} at {revision(area.provenance.revision)}
              {area.provenance.otherRevision && <> (other at {revision(area.provenance.otherRevision)})</>}
              {area.provenance.conflict && <> · {area.provenance.conflict} ordering</>}
            </li>)}
          </ul></details>}
          {!!(catalog.resolution.flows.length + catalog.resolution.findings.length + catalog.resolution.retirements.length)
            && <details className="mt-2"><summary>Flow, finding and retirement provenance</summary><ul className="mt-1 grid gap-1">
              {[...catalog.resolution.flows.map(item => ({ kind: 'flow', ...item })),
                ...catalog.resolution.findings.map(item => ({ kind: 'finding', ...item })),
                ...catalog.resolution.retirements.map(item => ({ kind: 'retirement', ...item }))].map(item =>
                <li key={`${item.unit.componentId}:${item.kind}:${item.unit.id}`}>
                  {item.unit.componentId} · {item.kind}/{item.unit.id}: {item.provenance.catalog} at {revision(item.provenance.revision)}
                  {item.provenance.otherRevision && <> (other at {revision(item.provenance.otherRevision)})</>}
                  {item.provenance.conflict && <> · {item.provenance.conflict} ordering</>}
                </li>)}
            </ul></details>}
        </div>)}
      </li>)}
    </ul>}
    {error && <p role="alert" className="mt-3 text-sm">Catalog resolution: {error}</p>}
  </section>
}
