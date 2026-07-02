# Performance

Deployment (Docker, self-hosting, serverless adapters) is scaffold-owned — the generator ships compose and `./dev`, and `docs/architecture/infrastructure.md` records run topology. This file covers project-level performance gates: what the agent must get right in the code, not how the app ships.

## Image Optimisation

Always use `next/image` — raw `<img>` tags bypass automatic optimisation, responsive sizing, and lazy loading.

```tsx
import orderPhoto from '@/public/order-photo.webp';
import Image from 'next/image';

<Image
  src={orderPhoto}
  alt="Packaged order ready for pickup"
  placeholder="blur"  // auto-generated from a static import
  priority             // set only on the LCP image — one per page
/>
```

Remote images require explicit `width`/`height` (or `fill` + `sizes`) and a configured `remotePatterns` in `next.config.ts`:

```tsx
// next.config.ts
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'api.example.com', pathname: '/v1/media/**' }] },
};
```

| Mistake | Fix |
|---------|-----|
| Using `<img>` tags | Always `next/image` |
| Missing `alt` text | Always provide descriptive alt text |
| Missing `sizes` with `fill` | Specify how wide the image renders at each breakpoint |
| `priority` on multiple images | Only the LCP image gets `priority` |
| Remote images without `remotePatterns` | Configure in `next.config.ts` |

For self-hosted deployments, `images.minimumCacheTTL` and `images.deviceSizes` cap CPU load from on-demand variant generation; for high-traffic sites, `images.loader: 'custom'` offloads optimisation to a CDN (Cloudinary, Imgix). `output: 'export'` disables image optimisation entirely — use `unoptimized` or a custom loader.

---

## Font Loading

Use `next/font` for every typeface — never `<link>` tags or CSS `@import`, both of which block rendering and cause layout shift. Define fonts once in `lib/fonts.ts` and import in the root layout; importing per-component creates duplicate download requests.

```tsx
// lib/fonts.ts
import { GeistSans } from 'geist/font/sans';
export const fontSans = GeistSans;
```

```tsx
// app/layout.tsx
import { fontSans } from '@/lib/fonts';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontSans.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
```

Subset to `latin` unless the app needs other character sets. `next/font` defaults to `display: 'swap'` (fallback shows immediately, swaps on load) — leave it unless the brand has a documented reason to prefer `block`/`fallback`/`optional`.

---

## Bundling & Package Issues

Some npm packages reference `window`, `document`, or other browser APIs and crash when imported in Server Components (`ReferenceError: window is not defined`, `Module not found: Can't resolve 'fs'`).

| Package | Issue | Fix |
|---------|-------|-----|
| `sharp`, `bcrypt`, `canvas` | Native bindings | `serverExternalPackages: ['sharp']` in `next.config.ts` |
| `recharts`, `mapbox-gl`, `monaco-editor` | Uses `window` | `dynamic(() => import('recharts'), { ssr: false })` |
| `react-quill`, `lottie-web` | Uses `document` | Same dynamic-import fix |

```tsx
// Client-only escape hatch for a package that can't run on the server
import dynamic from 'next/dynamic';
const RichTextEditor = dynamic(() => import('@/components/rich-text-editor'), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});
```

For packages that should run server-side but fail on ESM/CJS resolution, `transpilePackages: ['package-name']` is the fix instead of `serverExternalPackages`. Import CSS from npm packages via `import`, never a `<link>` in `<head>`.

---

## Third-Party Scripts

Use `next/script`, never a raw `<script>` tag — it needs an `id` for inline code and must live in the component body, not `<Head>`.

| Strategy | Loads | Use For |
|----------|-------|---------|
| `afterInteractive` | After hydration | Analytics, chat widgets |
| `lazyOnload` | During idle time | Non-critical features, social embeds |
| `beforeInteractive` | Before hydration (root layout only) | Critical polyfills, consent managers |

`@next/third-parties/google` wraps Analytics, GTM, Maps, and YouTube with the lazy/privacy-enhanced defaults already applied — prefer it over hand-rolling the script tag for those specific integrations.

---

## Bundle Analysis

```bash
ANALYZE=true pnpm build
```

Generates an interactive treemap. Look for duplicate dependencies, large unused libraries, and server-only code that leaked into the client bundle. Next.js ships common polyfills automatically (`fetch`, `Promise`, `URLSearchParams`, 50+ others) — do not load redundant ones from a CDN.

---

## Core Web Vitals

Field RUM, not lab metrics, is the signal that matters — `references/observability.md` owns instrumentation (`useReportWebVitals`, what to capture, PII discipline). This file's concern is the levers above that move LCP, INP, and CLS: correctly sized/prioritised images, non-blocking font loading, and a bundle free of accidental server-code leakage.
