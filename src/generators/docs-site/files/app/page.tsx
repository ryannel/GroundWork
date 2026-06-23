import Link from 'next/link';
import { source } from '@/app/source';

// A generated, brand-driven landing page (F4): a hero (project name + a one-line
// tagline) over section cards derived live from the doc tree. Nothing here is
// product-specific — the project name and sections come from the workspace and
// the docs/ folder, so this renders sensibly for any project GroundWork builds.
// The /docs index (the catch-all route's DocsIndex) remains the fallback link.

const TITLE = '<%= projectName %>';
const TAGLINE = '<%= tagline %>';
const WORDMARK = '<%= wordmark %>';

/** Human-friendly label for a top-level docs folder segment. */
function label(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

      <section className="mt-14 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
