import { useMemo } from 'react'
import { Database } from 'lucide-react'
import { isDatastore } from '@/data/inspector-model'
import { DataCatalog } from './data-catalog'
import { LinkedInfrastructure } from './dependencies'
import { EmptyCatalog } from './catalog-content'
import type { CatalogPanelProps } from './use-catalog-location'

export function DataPanel({ component, dependencies }: Pick<CatalogPanelProps, 'component' | 'dependencies'>) {
  const datastores = useMemo(() => dependencies.filter(isDatastore), [dependencies])
  return <>
    <div className="catalog-panel-heading">
      <div><h4><Database size={16} />Stored data</h4><p>Explore records, cache keys and documents owned by this component.</p></div>
    </div>
    {component.data?.records.length ? <DataCatalog component={component} /> : <EmptyCatalog component={component} area="data" label="data records" />}
    <LinkedInfrastructure summary="Linked datastores" title="Datastores" description="Mapped storage dependencies." dependencies={datastores} />
  </>
}
