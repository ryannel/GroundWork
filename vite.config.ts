import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import path from 'node:path'

const HUB = 'http://127.0.0.1:4318'
const CHUNK_BUDGET_KB = 500

/**
 * The lazily loaded ELK layout engine is one ~1.4 MB chunk and cannot be split, so the global warning limit sits above
 * it; every other chunk keeps the default 500 kB budget and a chunk over it fails the build.
 */
function chunkBudget(): Plugin {
  return {
    name: 'groundwork-chunk-budget',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || chunk.name.startsWith('elk')) continue
        const kb = Buffer.byteLength(chunk.code) / 1000
        if (kb > CHUNK_BUDGET_KB) this.error(`${chunk.fileName} is ${kb.toFixed(0)} kB, over the ${CHUNK_BUDGET_KB} kB chunk budget`)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), chunkBudget()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src'), '@shared': path.resolve(import.meta.dirname, 'shared') } },
  build: { chunkSizeWarningLimit: 1500 },
  server: {
    // `npm run dev`: the viewer hot-reloads here while API calls go to the Hub started from source on its fixed port.
    proxy: {
      '/api': {
        target: HUB,
        changeOrigin: true,
        configure: proxy => proxy.on('proxyReq', (request, incoming) => {
          // The Hub accepts only its own origin. Vouch for requests from this dev page; anything else is still refused.
          if (incoming.headers.origin === `http://${incoming.headers.host}`) request.setHeader('origin', HUB)
        }),
      },
    },
  },
})
