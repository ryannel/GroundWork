// Applies the saved theme and skin before first paint. Loaded as a same-origin file so the CSP (script-src 'self') allows it.
// Keep the accepted values in sync with src/lib/theme.tsx.
try {
  var root = document.documentElement
  var theme = localStorage.getItem('gw-theme')
  if (theme === 'dark' || theme === 'light') root.dataset.theme = theme
  var skin = localStorage.getItem('gw-skin')
  if (skin === 'grain') root.dataset.skin = skin
} catch {}
