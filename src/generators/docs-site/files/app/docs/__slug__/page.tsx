import fs from 'fs';
import path from 'path';
import { source } from '@/app/source';
import { DocsPage, DocsBody, DocsDescription, DocsTitle } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { ComponentProps, FC } from 'react';
import { Mermaid } from '@/components/mermaid';

// MDX components injected into every rendered doc. `Mermaid` resolves the
// `<Mermaid chart="…" />` nodes the remark transform (source.config.ts) emits for fenced
// ```mermaid blocks.
const mdxComponents = { Mermaid };

// The custom title-from-H1 schema (source.config.ts) is a transform, which stops
// createMDXSource from threading the full page-data type through — the inferred
// type degrades to the base PageData (title only). The other fields (description,
// full, and the compiled-MDX runtime fields body + toc) are present at runtime;
// this view restores their types. toc's type is borrowed from DocsPage's own prop.
type DocData = {
  title: string;
  description?: string;
  full?: boolean;
  body: FC;
  toc: ComponentProps<typeof DocsPage>['toc'];
};

// The pristine root docs/ tree ships without an index.md (source.config.ts reads
// it untouched), so the `/docs` root — the empty slug — has no backing page. The
// home route redirects here, so 404ing it would make the whole site look broken
// on first load. Instead, render a generated overview that links into every
// section, derived live from the page list and grouped by the first folder
// segment under /docs (top-level docs fall under "Overview").
function DocsIndex() {
  const groups = new Map<string, { title: string; url: string }[]>();
  for (const page of source.getPages()) {
    const segments = page.url.replace(/^\/docs\/?/, '').split('/');
    const section = segments.length > 1 ? segments[0] : 'Overview';
    const list = groups.get(section) ?? [];
    list.push({ title: page.data.title, url: page.url });
    groups.set(section, list);
  }

  return (
    <DocsPage>
      <DocsTitle><%= navTitle %></DocsTitle>
      <DocsDescription>Project documentation, organized by section.</DocsDescription>
      <DocsBody>
        {[...groups.entries()].map(([section, pages]) => (
          <section key={section}>
            <h2 style={{ textTransform: 'capitalize' }}>{section.replace(/-/g, ' ')}</h2>
            <ul>
              {pages.map((p) => (
                <li key={p.url}>
                  <Link href={p.url}>{p.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </DocsBody>
    </DocsPage>
  );
}

// ─── review-throughput plan, Wave 3a, slice C2c/C2d — the in-flight mirror banner
//
// docs/bets/_live/ is a materialized, regenerated-on-every-sync mirror (see
// scripts/sync-live-bets.js) — edits or comments made on a page there are
// discarded on the next sync and never reach the bet branch. Every page under
// it gets a notice block naming that, plus a warning when the sync recorded a
// slug collision for this bet (C2d). Both reads are plain, fail-soft fs: an
// absent/malformed docs/bets/_live/meta.json (predev hasn't run yet, or the
// folder was deleted) renders no banner rather than an error — must never break
// `next build` when `_live/` is absent, which is the common case for any page
// NOT under bets/_live/ (and for a project with nothing in flight).

type LiveMetaBet = { slug: string; branch: string; freshness: string; goal?: string | null };
type LiveMetaCollision = { slug: string; kept: string; dropped: string };
type LiveMeta = { generatedAt?: string; bets?: LiveMetaBet[]; collisions?: LiveMetaCollision[] };

// docs/bets/_live/meta.json lives two levels above the service directory
// (process.cwd() when `next dev`/`next build` runs — the same directory
// scripts/sync-live-bets.js calls REPO_ROOT relative to itself). Fail-soft:
// absent, unreadable, or malformed all resolve to null, never a thrown error.
function readLiveMeta(): LiveMeta | null {
  try {
    const metaPath = path.join(process.cwd(), '..', '..', 'docs', 'bets', '_live', 'meta.json');
    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as LiveMeta;
  } catch {
    return null;
  }
}

// Coarse relative-time phrasing for the banner ("synced 3 minutes ago") — no
// dependency, just second/minute/hour/day buckets.
function relativeTime(iso: string | undefined): string {
  const then = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(then)) return 'at an unknown time';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec} second${diffSec === 1 ? '' : 's'} ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

function LiveMirrorBanner({ slug }: { slug: string[] }) {
  if (slug[0] !== 'bets' || slug[1] !== '_live') return null; // only under docs/bets/_live/
  const betSlug = slug[2];
  if (!betSlug) return null; // the _live/index.md dashboard itself carries no per-bet badge
  const meta = readLiveMeta();
  if (!meta) return null;
  const entry = (meta.bets || []).find((b) => b.slug === betSlug);
  if (!entry) return null;
  const collision = (meta.collisions || []).find((c) => c.slug === betSlug);

  return (
    <div
      style={{
        border: '1px solid var(--fd-border, #e5e5e5)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        background: 'var(--fd-secondary, rgba(120,120,120,0.08))',
        fontSize: '0.875rem',
      }}
    >
      <p style={{ margin: 0 }}>
        <strong>In-flight mirror</strong> — synced {relativeTime(meta.generatedAt)}, branch{' '}
        <code>{entry.branch}</code>, {entry.freshness}. Regenerated on every sync: edits or
        comments here are discarded and never reach the bet branch — review comments belong on
        the review surface.
      </p>
      {collision && (
        <p style={{ margin: '0.5rem 0 0' }}>
          <strong>Naming collision:</strong> another in-flight source also used the bet name{' '}
          <code>{collision.slug}</code> — this mirror shows branch <code>{collision.kept}</code>;
          branch <code>{collision.dropped}</code> was dropped from it.
        </p>
      )}
    </div>
  );
}

export default async function Page(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    // Empty slug is the `/docs` root — render the generated overview, not a 404.
    if (!params.slug || params.slug.length === 0) return <DocsIndex />;
    notFound();
  }

  const data = page.data as typeof page.data & DocData;
  const MDX = data.body;

  return (
    <DocsPage toc={data.toc} full={data.full}>
      <DocsTitle>{data.title}</DocsTitle>
      <DocsDescription>{data.description}</DocsDescription>
      {params.slug && <LiveMirrorBanner slug={params.slug} />}
      <DocsBody>
        <MDX components={mdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: { params: Promise<{ slug?: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) return {};

  const data = page.data as typeof page.data & DocData;
  return {
    title: data.title,
    description: data.description,
  };
}
