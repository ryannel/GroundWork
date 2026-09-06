import { useState } from 'react'
import { q, summarizeWorkspace } from '@/data/store'
import { WorkspaceCard } from '@/components/workspace-card'
import { FeatureRow } from '@/components/feature-row'
import { Search, Inbox, ArrowRight, Sparkles, Settings } from 'lucide-react'
import { kindList, kinds, stageList } from '@/lib/taxonomy'
import {
  Avatar, Badge, Button, Card, CardBody, EmptyState, Glass, IconButton, Input, Kbd,
  KindBadge, Progress, Select, Separator, Skeleton, StageBadge, Stat, Tabs, Tooltip,
} from '@/ui'

function Section({ title, description, children, id }: { title: string; description?: string; children: React.ReactNode; id: string }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-h2 font-medium tracking-[var(--text-h2--letter-spacing)]">{title}</h2>
        {description && <p className="text-small text-fg-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

const Swatch = ({ name, varName, cls }: { name: string; varName?: string; cls?: string }) => (
  <div className="flex items-center gap-3">
    <div className={`size-10 shrink-0 rounded-sm border border-border ${cls ?? ''}`} style={varName ? { background: `var(${varName})` } : undefined} />
    <div className="min-w-0">
      <div className="text-small font-medium">{name}</div>
      {varName && <div className="truncate font-mono text-[11px] text-fg-subtle">{varName}</div>}
    </div>
  </div>
)

export function DesignSystemPage() {
  const [tab, setTab] = useState('active')
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-16">
        <div className="eyebrow mb-3">Groundwork · Design system</div>
        <h1 className="max-w-2xl text-display font-display">Clear structure. Distinct identity. Considered details.</h1>
        <p className="mt-4 max-w-xl text-fg-muted">A shared visual language for workspaces, products and feature plans. Kinds and stages are defined in <code className="font-mono text-[13px]">taxonomy.ts</code>, so adding a product kind never touches components.</p>
      </div>

      <div className="flex flex-col gap-16">
        <Section id="color" title="Color" description="Semantic roles only. Components never reference the raw palette.">
          <Card><CardBody className="grid gap-8">
            <div>
              <div className="eyebrow mb-3">Roles</div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <Swatch name="Background" varName="--bg" /><Swatch name="Elevated" varName="--bg-elevated" /><Swatch name="Foreground" varName="--fg" /><Swatch name="Muted" varName="--fg-muted" /><Swatch name="Subtle" varName="--fg-subtle" />
                <Swatch name="Accent" varName="--accent" /><Swatch name="Accent soft" varName="--accent-soft" /><Swatch name="Border" varName="--border" /><Swatch name="Border strong" varName="--border-strong" />
              </div>
            </div>
            <div>
              <div className="eyebrow mb-3">Status</div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral" dot>Neutral</Badge><Badge tone="accent" dot>Accent</Badge><Badge tone="success" dot>Success</Badge><Badge tone="warning" dot>Warning</Badge><Badge tone="danger" dot>Danger</Badge><Badge tone="info" dot>Info</Badge>
              </div>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="eyebrow mb-3">Product kinds</div>
                <div className="flex flex-wrap gap-2">{kindList.map(k => <KindBadge key={k} kind={k} />)}</div>
              </div>
              <div>
                <div className="eyebrow mb-3">Feature stages</div>
                <div className="flex flex-wrap gap-2">{stageList.map(s => <StageBadge key={s} stage={s} />)}</div>
              </div>
            </div>
          </CardBody></Card>
        </Section>

        <Section id="type" title="Typography" description="Geist with tabular numerals everywhere. Geist Mono for identifiers.">
          <Card><CardBody className="grid gap-6">
            {[
              ['Display', 'text-display font-display', '40 / 44'],
              ['Heading 1', 'text-h1 font-display', '28 / 34'],
              ['Heading 2', 'text-h2 tracking-[var(--text-h2--letter-spacing)] font-medium', '20 / 28'],
              ['Body', 'text-body', '14 / 22'],
              ['Small', 'text-small text-fg-muted', '13 / 18'],
            ].map(([n, cls, m]) => (
              <div key={n} className="grid grid-cols-[110px_1fr_auto] items-baseline gap-4">
                <span className="eyebrow">{n}</span>
                <span className={cls}>Pricing rules engine v2 ships 12,480 evaluations/s</span>
                <span className="font-mono text-[11px] text-fg-subtle">{m}</span>
              </div>
            ))}
            <div className="grid grid-cols-[110px_1fr_auto] items-baseline gap-4">
              <span className="eyebrow">Eyebrow</span><span className="eyebrow">Service system · 3 components</span><span className="font-mono text-[11px] text-fg-subtle">11 / 16</span>
            </div>
            <div className="grid grid-cols-[110px_1fr_auto] items-baseline gap-4">
              <span className="eyebrow">Mono</span><span className="font-mono text-[13px]">pricing-api · feat/GW-142 · ⌘K</span><span className="font-mono text-[11px] text-fg-subtle">13</span>
            </div>
          </CardBody></Card>
        </Section>

        <Section id="glass" title="Surfaces" description="Quiet canvas, raised panels, and distinct contextual layers.">
          <div className="relative grid gap-4 rounded-xl p-8 sm:grid-cols-3" style={{ background: 'radial-gradient(70% 90% at 15% 25%, hsl(var(--hue-indigo) / 0.22), transparent 70%), radial-gradient(60% 80% at 85% 75%, hsl(var(--hue-magenta) / 0.14), transparent 70%), radial-gradient(50% 70% at 55% 15%, hsl(var(--hue-teal) / 0.14), transparent 70%)' }}>
            {([1, 2, 3] as const).map(l => (
              <Glass key={l} level={l} className="p-5">
                <div className="eyebrow mb-1">Level {l}</div>
                <div className="font-medium">{['Panel', 'Popover', 'Modal'][l - 1]}</div>
                <p className="mt-1 text-small text-fg-muted">{['Soft border · subtle shadow', 'Higher contrast · contextual controls', 'Strongest elevation · focused decisions'][l - 1]}</p>
              </Glass>
            ))}
          </div>
        </Section>

        <Section id="buttons" title="Buttons" description="Component previews: four variants, three sizes, loading and disabled states. Sample actions demonstrate appearance only.">
          <Card><CardBody className="grid gap-6">
            {(['primary', 'secondary', 'ghost', 'danger'] as const).map(v => (
              <div key={v} className="flex flex-wrap items-center gap-3">
                <span className="eyebrow w-20">{v}</span>
                <Button variant={v} size="sm">Small</Button>
                <Button variant={v}>Inspect</Button>
                <Button variant={v} size="lg" trailing={<ArrowRight />}>Large</Button>
                <Button variant={v} loading>Loading</Button>
                <Button variant={v} disabled>Disabled</Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <span className="eyebrow w-20">icon</span>
              <IconButton label="Settings"><Settings /></IconButton>
              <IconButton label="Settings" variant="glass"><Settings /></IconButton>
              <Tooltip label="Search button preview"><IconButton label="Search preview" variant="glass"><Search /></IconButton></Tooltip>
              <Tabs items={[{ value: 'active', label: 'Active', count: 4 }, { value: 'shipped', label: 'Shipped', count: 12 }, { value: 'all', label: 'All' }]} value={tab} onChange={setTab} />
            </div>
          </CardBody></Card>
        </Section>

        <Section id="forms" title="Forms" description="Outlined fields with a clear accent focus ring.">
          <Card><CardBody className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Search products, features…" leading={<Search />} trailing={<Kbd>⌘K</Kbd>} />
            <Select defaultValue="service-system">{kindList.map(k => <option key={k} value={k}>{kinds[k].label}</option>)}</Select>
            <Input placeholder="Disabled" disabled />
            <div className="flex items-center gap-2 text-small text-fg-muted md:col-span-2">Keyboard badge examples <Kbd>⌘</Kbd><Kbd>K</Kbd> <Separator vertical className="h-4" /> <Kbd>G</Kbd><Kbd>H</Kbd></div>
          </CardBody></Card>
        </Section>

        <Section id="data" title="Data display" description="Stats, progress, avatars, skeletons, empty states.">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardBody><Stat label="Features in flight" value="14" delta={12} hint="across 5 products" icon={<Sparkles />} /></CardBody></Card>
            <Card><CardBody><Stat label="Shipped this month" value="6" delta={-8} hint="vs. 7 last month" /></CardBody></Card>
            <Card><CardBody><Stat label="Components" value="23" delta={0} hint="in 9 repos" /></CardBody></Card>
            <Card className="md:col-span-2"><CardBody className="grid gap-5">
              <div className="grid gap-2"><span className="eyebrow">Progress</span><Progress value={64} /><Progress value={32} hue="var(--kind-cli)" /></div>
              <div className="grid gap-2"><span className="eyebrow">Workflow stage</span><div className="flex flex-wrap gap-2">{stageList.map(stage => <StageBadge key={stage} stage={stage} />)}</div><p className="text-small text-fg-muted">Stages describe the kind of work. They are not completion percentages.</p></div>
              <div className="flex items-center gap-3"><span className="eyebrow">Avatars</span><Avatar name="Ryan Nel" size="sm" /><Avatar name="Ryan Nel" /><Avatar name="Ada Lovelace" size="lg" hue="var(--kind-playground)" /></div>
              <div className="grid gap-2"><span className="eyebrow">Skeleton</span><div className="flex items-center gap-3"><Skeleton className="size-9 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-1/3" /></div></div></div>
            </CardBody></Card>
            <Card><CardBody className="h-full"><EmptyState icon={<Inbox />} title="No features yet" description="Feature plans will appear here when your AI assistant adds them." className="h-full" /></CardBody></Card>
          </div>
        </Section>

        <Section id="composition" title="Live compositions" description="The same workspace cards and feature rows used in the app. Changes here stay in sync with the product.">
          <div className="grid gap-6"><div className="workspace-directory">{q.workspaces().map(workspace => <WorkspaceCard key={workspace.id} s={summarizeWorkspace(workspace)} />)}</div><div className="board-feature-list">{q.features().filter(feature => feature.stage !== 'shipped').slice(0,3).map(feature => <FeatureRow key={feature.id} feature={feature} showWorkspace />)}</div></div>
        </Section>
      </div>
    </div>
  )
}
