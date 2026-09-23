// Applies the saved theme before first paint. Loaded as a same-origin file so the CSP (script-src 'self') allows it.
// Keep the accepted values in sync with src/lib/theme.tsx.
try {
  var root = document.documentElement
  var theme = localStorage.getItem('gw-theme')
  if (theme === 'dark' || theme === 'light') root.dataset.theme = theme
} catch {}
