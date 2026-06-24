import Link from 'next/link';
import { source } from '@/app/source';

// A generated, brand-driven landing page (F4): a hero (project name + a one-line
// tagline) over two audience on-ramps, then section cards derived live from the
// doc tree. Nothing here is product-specific — the project name, the on-ramp
// targets, and the sections all come from the workspace and the docs/ folder, so
// this renders sensibly for any project GroundWork builds. The /docs index (the
// catch-all route's DocsIndex) remains the fallback link.

const TITLE = '<%= projectName %>';
const TAGLINE = '<%= tagline %>';
const WORDMARK = '<%= wordmark %>';

/** Human-friendly label for a top-level docs folder segment. */
function label(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Every page url under /docs, lower-cased once for cheap existence checks. */
function pageUrls(): Set<string> {
  return new Set(source.getPages().map((p) => p.url.toLowerCase()));
}

/** True when any doc exists at exactly `url` or nested beneath it — lets an
 *  on-ramp target either a leaf doc (product-brief) or a section (getting-started)
 *  without 404ing on a fresh scaffold where the setup skills have not yet authored
 *  the doc. */
function hasRoute(urls: Set<string>, url: string): boolean {
  const target = url.toLowerCase();
  for (const u of urls) {
    if (u === target || u.startsWith(target + '/')) return true;
  }
  return false;
}

/** The two audience on-ramps, in reading order — a fresh-clone developer first,
 *  a product reader second. Only the ones whose target doc actually exists are
 *  rendered, so the hero degrades gracefully before setup authors the docs. */
function onramps(
  urls: Set<string>,
): { title: string; blurb: string; url: string }[] {
  return [
    {
      title: 'New here — get it running',
      blurb: 'Install dependencies, boot the stack, and learn the ./dev workflow.',
      url: '/docs/getting-started',
    },
    {
      title: 'Understand the product',
      blurb: 'What the system is, who it serves, and what it does and does not do.',
      url: '/docs/product-brief',
    },
  ].filter((r) => hasRoute(urls, r.url));
}

/** The top-level sections present under /docs, derived from the page list, plus
 *  the count of pages each one carries. Top-level docs fall under "Overview". */
function sections(): { slug: string; title: string; url: string; count: number }[] {
  const groups = new Map<string, { count: number; firstUrl: string }>();
  for (const page of source.getPages()) {
    const segments = page.url.replace(/^\/docs\/?/, '').split('/').filter(Boolean);
    const section = segments.length > 1 ? segments[0] : 'overview';
    const g = groups.get(section);
    if (g) g.count += 1;
    else groups.set(section, { count: 1, firstUrl: page.url });
  }
  return [...groups.entries()].map(([slug, g]) => ({
    slug,
    title: slug === 'overview' ? 'Overview' : label(slug),
    url: slug === 'overview' ? '/docs' : `/docs/${slug}`,
    count: g.count,
  }));
}

export default function HomePage() {
  const urls = pageUrls();
  const ramps = onramps(urls);
  const cards = sections();
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16">
      <section className="w-full max-w-3xl text-center">
        {WORDMARK ? (
          <div
            aria-hidden
            className="mb-6 text-4xl font-semibold"
            style={{ color: 'hsl(var(--fd-primary))' }}
          >
            {WORDMARK}
          </div>
        ) : null}
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{TITLE}</h1>
        <p className="mt-4 text-lg text-fd-muted-foreground">{TAGLINE}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/docs"
            className="rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Browse the docs
          </Link>
        </div>
      </section>

      {ramps.length ? (
        <section className="mt-12 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {ramps.map((r) => (
            <Link
              key={r.url}
              href={r.url}
              className="rounded-xl border border-fd-border bg-fd-card p-6 text-left transition-colors hover:border-fd-primary hover:bg-fd-accent"
            >
              <div className="text-lg font-semibold text-fd-card-foreground">{r.title}</div>
              <div className="mt-2 text-sm text-fd-muted-foreground">{r.blurb}</div>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.slug}
            href={c.url}
            className="rounded-xl border border-fd-border bg-fd-card p-5 text-left transition-colors hover:bg-fd-accent"
          >
            <div className="text-base font-semibold text-fd-card-foreground">{c.title}</div>
            <div className="mt-1 text-sm text-fd-muted-foreground">
              {c.count} {c.count === 1 ? 'page' : 'pages'}
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
