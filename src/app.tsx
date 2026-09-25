import { lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useRuntime, checkoutId } from './data/runtime'
import { routesKey } from '../shared/view-models.ts'
import { Layout } from './shell/layout'
import { HomePage } from './pages/home'
import { WorkspacePage } from './pages/workspace'
import { ProjectsPage } from './pages/projects'
import { DeliveryPage } from './pages/delivery'

// The product page carries the graph stack (xyflow, ELK) and its stylesheet; load both only when a product opens.
const ProductPage = lazy(() => Promise.all([import('./pages/product'), import('@xyflow/react/dist/style.css')])
  .then(([module]) => ({ default: module.ProductPage })))
const FeaturePage = lazy(() => import('./pages/feature').then(module => ({ default: module.FeaturePage })))

function documentTitle(hub: boolean, projectName?: string) {
  if (hub) return 'Groundwork Hub · All projects'
  if (!projectName) return 'Groundwork'
  return `${projectName} · Groundwork Hub`
}

export function App() {
  const runtime = useRuntime()
  const hub = !checkoutId
  const projectName = runtime.plan?.manifest.name
  useEffect(() => { document.title = documentTitle(hub, projectName) }, [hub, projectName])
  if (runtime.loading) return <main className="runtime-start" role="status"><h1>Groundwork</h1><p>Opening your plans…</p></main>
  if (runtime.error && !runtime.plan && !runtime.connected) return <main className="runtime-start" role="alert">
    <h1>Groundwork is unavailable</h1>
    <p>{runtime.error}</p>
    <p>Start Groundwork Hub, then reload this page.</p>
    <button onClick={() => window.location.reload()}>Reload</button>
  </main>
  return (
    <Routes key={routesKey(runtime.plan)}>
      <Route element={<Layout />}>
        {hub
          ? <Route index element={<ProjectsPage />} />
          : <>
            <Route index element={<HomePage />} />
            <Route path="/w/:slug" element={<WorkspacePage />} />
            <Route path="/r/:slug/:product" element={<ProductPage />} />
            <Route path="/f/:id" element={<FeaturePage />} />
            <Route path="/f/:id/:section" element={<FeaturePage />} />
            <Route path="/f/:id/:section/:item" element={<FeaturePage />} />
            <Route path="/delivery" element={<DeliveryPage />} />
          </>}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
