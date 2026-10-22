// The system model: how the systems of a workspace work today. It sits beside the structure
// (domains/<d>/systems/<s>/system.yaml) as contracts.yaml and handlers.yaml per system, story.yaml, flows/ and journeys/,
// and is read in plan shape so the plan views can draw it.
import type {
  Concept,
  Flow,
  Graph,
  Handler,
  Interaction,
  Interface,
  Message,
  Operation,
  Schema,
  Screen,
  Service,
  Source,
  Stage,
  Store,
  Subgraph,
  UserJourney,
} from './plan/plan.generated';

/** Where a fact came from: a scan of the code, the demo seed, or a person. */
export type Origin = 'extracted' | 'seeded' | 'curated';

/** The lines of code a fact was read from. The permalink is derived, never stored. */
export interface CodeSource {
  /** org/name on GitHub, as system.yaml lists repos (acme/pricing); host/org/name elsewhere. */
  readonly repo: string;
  readonly path: string;
  readonly commit: string;
  readonly lines?: readonly [number, number];
  readonly symbol?: string;
  readonly label?: string;
  readonly note?: string;
}

/** Who said a fact and where it lives in the code. Kept per id, for top-level and nested facts alike. */
export interface Attribution {
  readonly origin: Origin;
  readonly sources: readonly CodeSource[];
}

/** What a system's contracts.yaml adds to one of its components. */
export interface ComponentDetail {
  readonly id: string;
  readonly kind?: Service['kind'];
  readonly summary?: string;
  readonly sources?: readonly Source[];
}

export interface SystemContracts {
  /** The workspace system id, without `sys:`. */
  readonly system: string;
  readonly components: readonly ComponentDetail[];
  readonly stores: readonly Store[];
  readonly interfaces: readonly Interface[];
  readonly schemas: readonly Schema[];
  readonly messages: readonly Message[];
  readonly screens: readonly Screen[];
  readonly graphs: readonly Graph[];
  readonly subgraphs: readonly Subgraph[];
  readonly operations: readonly Operation[];
  /** What runs when its endpoints are called or its messages arrive, from handlers.yaml beside the contracts. */
  readonly handlers: readonly Handler[];
}

export interface Story {
  readonly summary: string | null;
  readonly concepts: readonly Concept[];
  readonly stages: readonly Stage[];
}

/** A domain's language: the words its systems use and what each means. From domains/<domain>/language.yaml. */
export interface DomainLanguage {
  readonly domain: string;
  /** The domain told in its own words. */
  readonly summary: string | null;
  readonly concepts: readonly Concept[];
}

/** One step of the flow a domain is heading for: a thing of the business, and who should own it. */
export interface TargetStage {
  /** Unique within the domain's target.yaml. */
  readonly id: string;
  readonly name: string;
  /** The key term it is (term:…), when the business has agreed a word for it. */
  readonly term: string | null;
  /** The systems or components that should own it: sys:… or a component id. */
  readonly owners: readonly string[];
  /** Markdown; may cite [[id]]. */
  readonly summary: string | null;
  /** The stages it is made from, by id. */
  readonly from: readonly string[];
}

/** One place where today differs from the target, and which way it is moving. */
export interface TargetShift {
  readonly id: string;
  readonly name: string;
  /** What is true today. Markdown; may cite [[id]]. */
  readonly today: string;
  /** Where it is heading. Markdown; may cite [[id]]. */
  readonly target: string;
  /** Where the difference shows in today's model. */
  readonly cites: readonly string[];
}

/** Where a domain is heading, written by people. From domains/<domain>/target.yaml. */
export interface TargetArchitecture {
  readonly domain: string;
  readonly summary: string | null;
  readonly stages: readonly TargetStage[];
  readonly shifts: readonly TargetShift[];
}

/** How closely a scanned word or a system matches a key term. */
export type TermFit = 'same' | 'close' | 'renamed' | 'clash' | 'lives-in';

/** Where a key term shows up in the systems: a scanned word (con:…), or the system or domain it belongs to. */
export interface TermAnchor {
  readonly to: string;
  readonly fit: TermFit;
  readonly note: string | null;
}

/** A key term put to work: how it is used, in everyday life or at the company. */
export interface TermExample {
  readonly context: 'everyday' | 'company';
  readonly analogy: string | null;
  readonly sentence: string | null;
}

/** One word the business has agreed on, in its own words, with where it shows up in the systems. */
export interface KeyTerm {
  readonly id: string;
  readonly name: string;
  readonly group: string | null;
  /** Other words people use for the same thing. */
  readonly aliases: readonly string[];
  readonly means: string;
  readonly examples: readonly TermExample[];
  readonly relates: readonly { readonly to: string; readonly as: string }[];
  readonly anchors: readonly TermAnchor[];
}

/** The words the whole business agrees on, above any one domain. From language.yaml at the workspace root. */
export interface KeyTerms {
  readonly summary: string | null;
  /** The document the terms come from, and whether it is still open to change. */
  readonly source: {
    readonly title: string;
    readonly url: string | null;
    readonly status: string | null;
  } | null;
  readonly groups: readonly { readonly id: string; readonly name: string }[];
  readonly terms: readonly KeyTerm[];
}

/** The high-water mark of one repo: the commit the system model reflects. From scans/<repo>.yaml. */
export interface Scan {
  readonly repo: string;
  readonly branch: string;
  readonly head: string;
  readonly scannedAt: string;
  readonly scanner: string;
  /** Blob sha per file that produced facts. */
  readonly files: Readonly<Record<string, string>>;
  readonly facts: number;
  /** The last time tools/scan-status.ts asked the remote how far the branch had moved past `head`, if ever. */
  readonly checked: ScanCheck | null;
}

export interface ScanCheck {
  readonly at: string;
  readonly tip: string;
  /** Commits between `head` and `tip`, or null when they were not counted. */
  readonly behind: number | null;
  /** Of those commits, how many touch each folder a system lists, by folder; empty when not counted. */
  readonly folders: Readonly<Record<string, number>>;
}

export interface WorkspaceModel {
  readonly story: Story;
  /** One per domain that has a language.yaml, in domain order. */
  readonly languages: readonly DomainLanguage[];
  /** One per domain that has a target.yaml, in domain order. */
  readonly targets: readonly TargetArchitecture[];
  /** The business's agreed words, above the domains. Empty when the workspace has no language.yaml. */
  readonly keyTerms: KeyTerms;
  readonly flows: readonly Flow[];
  readonly journeys: readonly UserJourney[];
  readonly interactions: readonly Interaction[];
  readonly contracts: readonly SystemContracts[];
  readonly attribution: Readonly<Record<string, Attribution>>;
  readonly scans: readonly Scan[];
}

/** A GitHub permalink for a code source: blob/<commit>/<path>#L<from>-L<to>. */
export function permalinkOf(source: CodeSource): string {
  const host = source.repo.split('/').length > 2 ? source.repo : `github.com/${source.repo}`;
  const base = `https://${host}/blob/${source.commit}/${encodeURI(source.path)}`;
  if (source.lines === undefined) return base;
  const [from, to] = source.lines;
  return from === to ? `${base}#L${String(from)}` : `${base}#L${String(from)}-L${String(to)}`;
}
