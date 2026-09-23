import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './shell/layout'
import { HomePage } from './pages/home'
import { WorkspacePage } from './pages/workspace'
import { ProductPage } from './pages/product'
import { useRuntime, checkoutId } from './data/runtime'
import { ProjectsPage } from './pages/projects'
import { DeliveryPage } from './pages/delivery'
const FeaturePage = lazy(() => import('./pages/feature').then(module => ({ default: module.FeaturePage })))
const DesignSystemPage = lazy(() => import('./pages/design-system').then(module => ({ default: module.DesignSystemPage })))

export function App() {
  const runtime = useRuntime()
  const projectName = runtime.plan?.manifest.name
  useEffect(() => {
    document.title = runtime.mode === 'central' && !checkoutId ? 'Groundwork Hub · All projects' : projectName ? `${projectName} · ${runtime.mode === 'central' ? 'Groundwork Hub' : 'Groundwork standalone'}` : 'Groundwork'
  }, [runtime.mode, projectName])
  if (runtime.loading) return <main className="runtime-start" role="status"><h1>Groundwork</h1><p>Opening your plans…</p></main>
  if (runtime.error && !runtime.plan && !runtime.connected) return <main className="runtime-start" role="alert"><h1>Groundwork is unavailable</h1><p>{runtime.error}</p><p>Start Groundwork Hub, then reload this page.</p><button onClick={() => window.location.reload()}>Reload</button></main>
  if (runtime.mode === 'central' && !checkoutId) return <ProjectsPage />
  return (
    <Routes key={`${runtime.plan?.context.token ?? "unavailable"}:${runtime.plan?.revision ?? "empty"}`}>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/w/:slug" element={<WorkspacePage />} />
        <Route path="/w/:slug/:product" element={<ProductPage />} />
        <Route path="/f/:id" element={<FeaturePage />} />
        <Route path="/f/:id/:section" element={<FeaturePage />} />
        <Route path="/f/:id/:section/:item" element={<FeaturePage />} />
        <Route path="/delivery" element={<DeliveryPage />} />
        <Route path="/design" element={<DesignSystemPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
import { lazy, useEffect } from 'react'
