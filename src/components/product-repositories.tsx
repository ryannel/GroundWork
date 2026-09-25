import type { Product } from '@shared/model'
import { useQuery } from '@/data/store'
import { useProductCatalog } from '@/ui/use-product-catalog'

/** The repository declarations are useful even before a catalog has been scanned. */
export function ProductRepositories({ product, resolved }: { product: Product; resolved?: ReturnType<typeof useProductCatalog> }) {
  const repositories = useQuery().productRepositories(product.id)
  const ownResolution = useProductCatalog(resolved ? '' : product.id)
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
        {result?.repositories.filter(catalog => catalog.repository === entry.repository).map(catalog =>
          <div key={catalog.repository} className="mt-3 border-t border-border pt-3 text-xs">
          <p><strong>Catalog read:</strong> {catalog.selected === 'local'
            ? `Local from ${catalog.local?.label}` : catalog.source?.label ?? 'Source catalog not loaded'}</p>
          <p>{catalog.components.length} catalog {catalog.components.length === 1 ? 'component' : 'components'} for this product.</p>
        </div>)}
      </li>)}
    </ul>}
    {error && <p role="alert" className="mt-3 text-sm">Catalog resolution: {error}</p>}
  </section>
}
