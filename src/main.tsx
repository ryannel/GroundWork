import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/base.css'
import './styles/runtime.css'
import { ThemeProvider } from './lib/theme'
import { App } from './app'
import { runtimeBase, startRuntime } from './data/runtime'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter basename={runtimeBase}>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)

void startRuntime()
