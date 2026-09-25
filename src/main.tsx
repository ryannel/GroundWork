import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/app.css'
import { ThemeProvider } from './lib/theme'
import { App } from './app'
import { runtimeBase, startRuntime } from './data/runtime'
import { RepositoryProvider } from './data/store'
import { ErrorBoundary } from './components/error-boundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter basename={runtimeBase}>
          <RepositoryProvider>
            <App />
          </RepositoryProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)

void startRuntime()
