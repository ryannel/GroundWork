import type { Product } from '@/data/model'
import { useQuery } from '@/data/store'

/** The repository declarations are useful even before a catalog has been scanned. */
export function ProductRepositories({ product }: { product: Product }) {
  const repositories = useQuery().productRepositories(product.id)
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
      </li>)}
    </ul>}
  </section>
}
