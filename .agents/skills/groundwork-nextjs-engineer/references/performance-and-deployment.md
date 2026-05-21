# Performance & Deployment

## Table of Contents
- [Image Optimisation](#image-optimisation)
- [Font Loading](#font-loading)
- [Bundling & Package Issues](#bundling--package-issues)
- [Third-Party Scripts](#third-party-scripts)
- [Metadata & SEO](#metadata--seo)
- [Self-Hosting](#self-hosting)
- [Docker Deployment](#docker-deployment)
- [ISR Cache Handlers](#isr-cache-handlers)
- [Debug Tools](#debug-tools)
- [Core Web Vitals](#core-web-vitals)
- [Serverless Deployment (OpenNext)](#serverless-deployment-opennext)

---

## Image Optimisation

Always use `next/image`. Raw `<img>` tags bypass automatic optimisation, responsive sizing, and lazy loading.

### Local Images

```tsx
import meetingHero from '@/public/meeting-hero.webp';
import Image from 'next/image';

// Width and height are auto-inferred from the import
<Image
  src={meetingHero}
  alt="Meeting room with glass walls"
  placeholder="blur"  // Auto-generates blur placeholder from static import
  priority            // Set for LCP (Largest Contentful Paint) images
/>
```

### Remote Images

Remote images require explicit dimensions and a configured `remotePatterns` in `next.config.ts`:

```tsx
// next.config.ts
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.wordloop.app',
        pathname: '/v1/media/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
};
```

```tsx
<Image
  src={`https://api.wordloop.app/v1/media/${imageId}`}
  alt={imageAlt}
  width={800}
  height={450}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

### Responsive Images

Use the `sizes` prop to tell the browser how wide the image will be at each viewport:

```tsx
// Full width on mobile, half on tablet, third on desktop
<Image
  src={src}
  alt={alt}
  fill                          // Fills parent container
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  className="object-cover"      // CSS controls positioning within the container
/>
```

### Priority Loading

Set `priority` on the **Largest Contentful Paint** image — typically the hero image or primary visual above the fold. Only one image per page should have `priority`.

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `<img>` tags | Always `next/image` |
| Missing `alt` text | Always provide descriptive alt text |
| Missing `sizes` with `fill` | Always specify how wide the image renders at each breakpoint |
| `priority` on multiple images | Only the LCP image gets `priority` |
| Remote images without `remotePatterns` | Configure in `next.config.ts` |

### Image Optimisation Tuning

For self-hosted deployments, reduce CPU load by limiting generated variants and extending cache TTL:

```tsx
// next.config.ts
const nextConfig = {
  images: {
    minimumCacheTTL: 60 * 60 * 24,         // 24 hours
    deviceSizes: [640, 750, 1080, 1920],   // Limit generated sizes
  },
};
```

For high-traffic sites, offload image optimisation to Cloudinary, Imgix, or a similar CDN:

```tsx
// next.config.ts
const nextConfig = {
  images: {
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
  },
};
```

```tsx
// lib/image-loader.ts
export default function cloudinaryLoader({
  src, width, quality,
}: { src: string; width: number; quality?: number }) {
  const params = ['f_auto', 'c_limit', `w_${width}`, `q_${quality ?? 'auto'}`];
  return `https://res.cloudinary.com/wordloop/image/upload/${params.join(',')}${src}`;
}
```

### Static Export

When using `output: 'export'` for a fully static site, image optimisation is disabled. Use `unoptimized` or a custom loader:

```tsx
// next.config.ts — disable optimisation globally
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
```

```tsx
// Or per-image
<Image src="/hero.png" alt="Hero" width={800} height={400} unoptimized />
```

---

## Font Loading

Use `next/font` to load all typefaces. Never use `<link>` tags or CSS `@import` for fonts — these block rendering and create layout shifts.

### Geist Setup

```tsx
// lib/fonts.ts — shared font definitions
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export const fontSans = GeistSans;
export const fontMono = GeistMono;
```

```tsx
// app/layout.tsx
import { fontSans, fontMono } from '@/lib/fonts';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable}`}
    >
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
```

### Integration with Tailwind

The CSS variables are referenced in `@theme`:

```css
@theme {
  --font-sans: 'Geist', sans-serif;
  --font-mono: 'Geist Mono', monospace;
}
```

### Rules

- **One font file**, shared everywhere — define in `lib/fonts.ts`, import in root layout
- **Never import per-component** — fonts imported in multiple components create duplicate download requests
- **Never use `@import url('fonts.googleapis.com/...')`** in CSS — blocks rendering
- **Subset to `latin`** unless the app requires other character sets
- **Use `display: 'swap'`** (default in next/font) — shows fallback font immediately, swaps when loaded

### Font Weight Selection

Geist is a variable font — it includes all weights automatically. For non-variable fonts, specify only the weights you use:

```tsx
// Variable font (recommended) — all weights included
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });

// Non-variable font — specify only needed weights
import { Roboto } from 'next/font/google';
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});
```

### Local Fonts

For custom or licensed fonts not available on Google Fonts:

```tsx
import localFont from 'next/font/local';

const customFont = localFont({
  src: [
    { path: './fonts/Custom-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Custom-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-custom',
});
```

### Display Strategy Options

| Value | Behaviour | Use When |
|-------|-----------|----------|
| `'swap'` | Show fallback immediately, swap when font loads | Default — best for most cases |
| `'block'` | Short invisible period, then swap | Font is critical to brand identity |
| `'fallback'` | Short invisible, short swap window, then fallback | Acceptable if custom font doesn't load |
| `'optional'` | Short invisible, no swap | Font is decorative, not essential |

---

## Bundling & Package Issues

### Server-Incompatible Packages

Some npm packages reference `window`, `document`, or other browser APIs. These crash when imported in Server Components.

### Error Signs

```
ReferenceError: window is not defined
ReferenceError: document is not defined
ReferenceError: localStorage is not defined
Module not found: Can't resolve 'fs'
SyntaxError: Cannot use import statement outside a module
Error: require() of ES Module
```

#### Fix 1: Dynamic Import with ssr: false

```tsx
import dynamic from 'next/dynamic';

const RichTextEditor = dynamic(
  () => import('@/components/rich-text-editor'),
  { ssr: false, loading: () => <EditorSkeleton /> }
);
```

#### Fix 2: serverExternalPackages

For packages that should run on the server but fail due to ESM/CJS issues:

```tsx
// next.config.ts
const nextConfig = {
  serverExternalPackages: ['sharp', 'canvas'],
};
```

#### Fix 3: Client Wrapper

Wrap the problematic import behind a `"use client"` boundary:

```tsx
// components/chart-wrapper.tsx
'use client';

import { ResponsiveChart } from 'some-chart-library';
export { ResponsiveChart };
```

### ESM/CJS Resolution

For packages that ship ESM but aren't properly resolved:

```tsx
// next.config.ts
const nextConfig = {
  transpilePackages: ['package-name'],
};
```

### CSS Imports

Import CSS from npm packages using `import`, not `<link>`:

```tsx
// Good — in a client component or layout
import 'some-package/dist/styles.css';

// Bad — in <head> via <link>
<link rel="stylesheet" href="/node_modules/some-package/dist/styles.css" />
```

### Bundle Analysis

```bash
pnpm dlx @next/bundle-analyzer
ANALYZE=true pnpm build
```

Generates an interactive treemap showing what contributes most to bundle size. Look for:
- Duplicate dependencies
- Large unused libraries
- Server-only code leaking to the client bundle

### Polyfills

Next.js includes common polyfills automatically (`Array.from`, `Object.assign`, `Promise`, `fetch`, `Map`, `Set`, `Symbol`, `URLSearchParams`, and 50+ others). Do not load redundant polyfills from CDNs.

### Common Problematic Packages

| Package | Issue | Fix |
|---------|-------|-----|
| `sharp` | Native bindings | `serverExternalPackages: ['sharp']` |
| `bcrypt` | Native bindings | `serverExternalPackages: ['bcrypt']` or use `bcryptjs` |
| `canvas` | Native bindings | `serverExternalPackages: ['canvas']` |
| `recharts` | Uses `window` | `dynamic(() => import('recharts'), { ssr: false })` |
| `react-quill` | Uses `document` | `dynamic(() => import('react-quill'), { ssr: false })` |
| `mapbox-gl` | Uses `window` | `dynamic(() => import('mapbox-gl'), { ssr: false })` |
| `monaco-editor` | Uses `window` | `dynamic(() => import('@monaco-editor/react'), { ssr: false })` |
| `lottie-web` | Uses `document` | `dynamic(() => import('lottie-react'), { ssr: false })` |

---

## Third-Party Scripts

Use `next/script` for all external scripts. Never use raw `<script>` tags.

```tsx
import Script from 'next/script';

<Script
  src="https://analytics.example.com/script.js"
  strategy="afterInteractive"  // Load after page becomes interactive
  id="analytics"               // Required for inline scripts
/>
```

### Loading Strategies

| Strategy | When It Loads | Use For |
|----------|--------------|---------|
| `afterInteractive` | After hydration | Analytics, chat widgets |
| `lazyOnload` | During idle time | Non-critical features, social embeds |
| `beforeInteractive` | Before hydration | Critical polyfills, consent managers |
| `worker` | Web Worker (experimental) | Heavy computation scripts |

### Google Analytics

```tsx
import { GoogleAnalytics } from '@next/third-parties/google';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <GoogleAnalytics gaId="G-XXXXXXXXXX" />
      </body>
    </html>
  );
}
```

### Google Tag Manager

```tsx
import { GoogleTagManager } from '@next/third-parties/google';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <GoogleTagManager gtmId="GTM-XXXXXXXXX" />
      <body>{children}</body>
    </html>
  );
}
```

### Third-Party Embeds

```tsx
import { YouTubeEmbed, GoogleMapsEmbed } from '@next/third-parties/google';

// YouTube — lazy-loaded, privacy-enhanced
<YouTubeEmbed videoid="dQw4w9WgXcQ" />

// Google Maps
<GoogleMapsEmbed
  apiKey={process.env.NEXT_PUBLIC_MAPS_KEY!}
  mode="place"
  q="Brooklyn+Bridge,New+York,NY"
/>
```

### Rules

- All `<Script>` components must have an `id` if they contain inline code
- Never place `<Script>` inside `<Head>` — it belongs in the component body
- Use `@next/third-parties` for Google services (Analytics, GTM, Maps, YouTube)
- `strategy="beforeInteractive"` only works in the root `app/layout.tsx`

---

## Metadata & SEO

The `metadata` object and `generateMetadata` function are **only supported in Server Components**. They cannot be used in files with `'use client'`. If a page needs both client interactivity and metadata:
1. Remove `'use client'` and move client logic to child components
2. Or extract metadata to a parent Server Component layout
3. Or split the file: Server Component with metadata imports Client Components

### Deduplicating Metadata Fetches

When `generateMetadata` and the page component need the same data, use `React.cache()` to deduplicate:

```tsx
import { cache } from 'react';

const getMeeting = cache(async (id: string) => {
  return await fetchMeetingFromApi(id);
});

// generateMetadata and the page both call getMeeting(id)
// React.cache ensures only one API request is made
```

### Static Metadata

```tsx
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'WordLoop',
    template: '%s | WordLoop',  // Child pages: "Meetings | WordLoop"
  },
  description: 'AI-powered meeting intelligence platform',
};
```

### Dynamic Metadata

```tsx
// app/meetings/[id]/page.tsx
import type { Metadata } from 'next';
import { getMeeting } from '@/lib/api';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const meeting = await getMeeting(id);

  return {
    title: meeting.title,
    description: `Meeting details: ${meeting.title}`,
    openGraph: {
      title: meeting.title,
      type: 'article',
    },
  };
}
```

### Viewport (Separate Export)

Viewport configuration must be a separate export — not part of `metadata`:

```tsx
import type { Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f8f8' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
  width: 'device-width',
  initialScale: 1,
};
```

For dynamic viewport configuration, use `generateViewport`:

```tsx
import type { Viewport } from 'next';

export function generateViewport({ params }: Props): Viewport {
  return {
    themeColor: getThemeColor(params),
  };
}
```

### File-Based Metadata

| File | Purpose |
|------|---------|
| `app/favicon.ico` | Browser tab icon |
| `app/icon.tsx` | Generated app icon |
| `app/apple-icon.tsx` | Apple touch icon |
| `app/opengraph-image.tsx` | OG image (generated) |
| `app/sitemap.ts` | XML sitemap |
| `app/robots.ts` | Robots.txt |
| `app/manifest.ts` | Web app manifest |

### OG Image Generation

Use `next/og` (not `@vercel/og`) to generate Open Graph images at build time:

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: 'white',
        fontSize: 64,
        fontWeight: 700,
      }}>
        WordLoop
      </div>
    ),
    { ...size }
  );
}
```

**Styling constraints:** ImageResponse uses Flexbox layout only — no CSS Grid. All styles must be inline objects.

### Custom Fonts in OG Images

```tsx
import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

export default async function OGImage() {
  const fontPath = join(process.cwd(), 'assets/fonts/Geist-Bold.ttf');
  const fontData = await readFile(fontPath);

  return new ImageResponse(
    (<div style={{ fontFamily: 'Geist', fontSize: 64 }}>WordLoop</div>),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Geist', data: fontData, style: 'normal' }],
    }
  );
}
```

### Multiple OG Images per Route

Use `generateImageMetadata` when a route needs multiple OG images:

```tsx
// app/meetings/[id]/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export async function generateImageMetadata({ params }: Props) {
  const images = await getMeetingImages(params.id);
  return images.map((img, idx) => ({
    id: idx,
    alt: img.alt,
    size: { width: 1200, height: 630 },
    contentType: 'image/png' as const,
  }));
}

export default async function OGImage({ params, id }: { params: Props['params']; id: number }) {
  const images = await getMeetingImages(params.id);
  const image = images[id];
  return new ImageResponse(/* render image */);
}
```

### Multiple Sitemaps

Use `generateSitemaps` for large sites with over 50,000 URLs:

```tsx
// app/sitemap.ts
import type { MetadataRoute } from 'next';

export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }];
}

export default async function sitemap({
  id,
}: { id: number }): Promise<MetadataRoute.Sitemap> {
  const start = id * 50000;
  const end = start + 50000;
  const meetings = await getMeetings(start, end);

  return meetings.map(meeting => ({
    url: `https://wordloop.app/meetings/${meeting.id}`,
    lastModified: meeting.updated_at,
  }));
}
```

Generates `/sitemap/0.xml`, `/sitemap/1.xml`, etc.

---

## Self-Hosting

### Standalone Output

Configure Next.js to produce a minimal standalone build that includes only the files needed to run:

```tsx
// next.config.ts
const nextConfig = {
  output: 'standalone',
};
```

This creates `.next/standalone/` with a self-contained Node.js server.

### Health Check Endpoint

```tsx
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok' }, { status: 200 });
}
```

### Environment Variables

| Type | Prefix | Available | Use For |
|------|--------|-----------|---------|
| Server-only | None | Server only | Database URLs, API keys, secrets |
| Public | `NEXT_PUBLIC_` | Server + client | API base URLs, feature flags |

```env
# Server-only
DATABASE_URL=postgres://...
API_SECRET_KEY=sk-xxx

# Public — embedded in client bundle
NEXT_PUBLIC_API_URL=https://api.wordloop.app
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
```

---

## Docker Deployment

### Multi-Stage Dockerfile

```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Stage 3: Production
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=https://api.wordloop.app
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

---

## ISR Cache Handlers

When self-hosting with multiple instances, ISR (Incremental Static Regeneration) needs a shared cache backend. By default, the ISR cache is stored on the local filesystem, which doesn't work across multiple servers.

### Redis Cache Handler

```tsx
// cache-handler.mjs
import { CacheHandler } from '@neshca/cache-handler';
import createRedisHandler from '@neshca/cache-handler/redis-strings';
import { createClient } from 'redis';

CacheHandler.onCreation(async () => {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();

  const handler = await createRedisHandler({ client, keyPrefix: 'next:' });

  return {
    handlers: [handler],
  };
});

export default CacheHandler;
```

```tsx
// next.config.ts
const nextConfig = {
  cacheHandler: require.resolve('./cache-handler.mjs'),
  cacheMaxMemorySize: 0,  // Disable in-memory cache, use Redis only
};
```

### S3 Cache Handler

For AWS deployments without Redis:

```tsx
// cache-handler.mjs
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.CACHE_BUCKET;

export default class CacheHandler {
  async get(key) {
    try {
      const response = await s3.send(new GetObjectCommand({
        Bucket: BUCKET, Key: `cache/${key}`,
      }));
      const body = await response.Body.transformToString();
      return JSON.parse(body);
    } catch (err) {
      if (err.name === 'NoSuchKey') return null;
      throw err;
    }
  }

  async set(key, data, ctx) {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `cache/${key}`,
      Body: JSON.stringify({ value: data, lastModified: Date.now() }),
      ContentType: 'application/json',
    }));
  }
}
```

### Testing Cache Handlers

Test your cache handler on every Next.js upgrade. Start multiple instances and verify they share state:

```bash
# Start two instances
PORT=3001 node .next/standalone/server.js &
PORT=3002 node .next/standalone/server.js &

# Trigger ISR revalidation on instance 1
curl http://localhost:3001/api/revalidate?path=/meetings

# Verify both instances see the update
curl http://localhost:3001/meetings
curl http://localhost:3002/meetings
# Should return identical content
```

### Feature Compatibility (Self-Hosted)

| Feature | Single Instance | Multi-Instance | Notes |
|---------|:-:|:-:|-------|
| SSR | ✅ | ✅ | No special setup |
| SSG | ✅ | ✅ | Built at deploy time |
| ISR | ✅ | Needs cache handler | Filesystem cache breaks across instances |
| Image Optimisation | ✅ | ✅ | CPU-intensive — consider CDN |
| Proxy (Middleware) | ✅ | ✅ | Runs on Node.js |
| `revalidatePath/Tag` | ✅ | Needs cache handler | Must share cache |
| `next/font` | ✅ | ✅ | Fonts bundled at build time |
| Draft Mode | ✅ | ✅ | Cookie-based |

---

## Debug Tools

### MCP Debug Endpoint

Next.js exposes a debug endpoint at `/_next/mcp` when running in development. This provides JSON-RPC tools for diagnosing issues:

| Tool | Purpose |
|------|---------|
| `get_errors` | Lists current build and runtime errors |
| `get_routes` | Shows all registered routes and their types |
| `get_project_metadata` | Next.js version, config, enabled features |
| `get_page_metadata` | Metadata for a specific route |
| `get_logs` | Recent server-side logs |
| `get_server_action_by_id` | Inspect a specific Server Action |

### Partial Rebuilds

When debugging a specific route, use `--debug-build-paths` to rebuild only that route:

```bash
pnpm dev --debug-build-paths=/meetings/[id]
```

This speeds up the dev server restart when working on a single page.

### Pre-Deployment Checklist

1. `pnpm build` completes without errors
2. `pnpm test` passes all suites
3. `pnpm lint` reports no issues
4. All pages tested in both Obsidian and Milk themes
5. Images use `next/image` with proper `sizes` and `alt`
6. Fonts load via `next/font`, no external `<link>` tags
7. No `console.log` in production code
8. Health check endpoint responds at `/api/health`
9. Environment variables documented and configured for target environment

---

## Core Web Vitals

Use `useReportWebVitals` to report performance metrics to your analytics backend:

```tsx
// app/web-vitals.tsx
'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals(metric => {
    // Send to analytics
    console.log(metric);  // Replace with actual analytics call
  });

  return null;
}
```

```tsx
// app/layout.tsx
import { WebVitals } from './web-vitals';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebVitals />
        {children}
      </body>
    </html>
  );
}
```

Metrics reported: **CLS** (Cumulative Layout Shift), **FCP** (First Contentful Paint), **FID** (First Input Delay), **INP** (Interaction to Next Paint), **LCP** (Largest Contentful Paint), **TTFB** (Time to First Byte).

---

## Serverless Deployment (OpenNext)

[OpenNext](https://open-next.js.org/) adapts Next.js for AWS Lambda, Cloudflare Workers, and other serverless platforms without Vercel:

```bash
# AWS Lambda + CloudFront
pnpx @opennextjs/aws build
```

Supported targets: AWS Lambda + CloudFront, Cloudflare Workers, Netlify Functions, Deno Deploy.
