import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { ErrorBoundary, isChunkLoadError, shouldReloadForChunk } from '../src/components/error-boundary.ts'

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: http://localhost/assets/feature-abc123.js')
const memoryStore = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}
/** Server rendering has no error boundaries, so drive the fallback through React's own static lifecycle. */
const renderWithError = (error: unknown, props: Record<string, unknown> = {}) => {
  const boundary = new ErrorBoundary({ children: createElement('p', null, 'content'), ...props })
  boundary.state = { ...boundary.state, ...ErrorBoundary.getDerivedStateFromError(error) }
  return renderToString(boundary.render() as never)
}

test('the boundary renders its children while nothing has failed', () => {
  assert.match(renderToString(createElement(ErrorBoundary, null, createElement('p', null, 'content'))), /content/)
})

test('a render error shows its message and a reload action instead of a blank page', () => {
  const html = renderWithError(new Error('Unknown component owner'))
  assert.match(html, /role="alert"/)
  assert.match(html, /Unknown component owner/)
  assert.match(html, /<button[^>]*>Reload<\/button>/)
  assert.doesNotMatch(html, /content/)
})

test('a stale lazy chunk is explained as an update', () => {
  assert.equal(isChunkLoadError(chunkError()), true)
  assert.equal(isChunkLoadError(new Error('Cannot read properties of undefined')), false)
  assert.equal(isChunkLoadError('Failed to fetch dynamically imported module'), false)
  assert.match(renderWithError(chunkError()), /Groundwork was updated/)
})

test('chunk-load errors reload the page once, then fall back to the message', () => {
  const store = memoryStore()
  assert.equal(shouldReloadForChunk(chunkError(), store, 1_000_000), true)
  assert.equal(shouldReloadForChunk(chunkError(), store, 1_000_500), false, 'no reload loop within the window')
  assert.equal(shouldReloadForChunk(chunkError(), store, 1_000_000 + 61_000), true)
  assert.equal(shouldReloadForChunk(new Error('render bug'), memoryStore(), 1_000_000), false)
  assert.equal(shouldReloadForChunk(chunkError(), undefined, 1_000_000), false, 'no storage, no automatic reload')
  const throwing = { getItem: () => { throw new Error('denied') }, setItem: () => {} }
  assert.equal(shouldReloadForChunk(chunkError(), throwing, 1_000_000), false)
})

test('changing the reset key clears the error so navigation recovers', () => {
  const failed = { error: new Error('x'), resetKey: '/w/a' }
  assert.equal(ErrorBoundary.getDerivedStateFromProps({ resetKey: '/w/a' }, failed), null)
  assert.deepEqual(ErrorBoundary.getDerivedStateFromProps({ resetKey: '/w/b' }, failed), { error: undefined, resetKey: '/w/b' })
})
