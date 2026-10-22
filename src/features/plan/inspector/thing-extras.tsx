import type { Model } from '@/application/plan/derive';
import {
  flowDrawingOf,
  issuePreviewOf,
  type IssuePreview,
  operationDocumentOf,
} from '@/application/plan-pages-entity-extras';
import { shortDate } from '@/application/plan-viz-state';
import { CopyButton } from '@/features/plan/viz/board/copy-button.client';
import { CopyMermaid } from '@/features/plan/viz/flow-viewer/copy-mermaid.client';
import { Sequence } from '@/features/plan/viz/sequence/sequence';
import { TintedDocument } from '@/features/plan/viz/waterfall/tinted-document';
import { Badge } from '@/ui/badge';

import styles from './thing-extras.module.css';

function FlowDrawn({ model, id, today }: ThingExtrasProps) {
  const drawing = flowDrawingOf(model, id, today);
  if (drawing === null) return null;
  return (
    <details className={styles.extra} open>
      <summary className={styles.summary}>
        {drawing.mode === 'asIs' ? 'The flow as it runs today' : 'The flow with this plan'}
      </summary>
      <Sequence flowId={drawing.flowId} mode={drawing.mode} model={model} />
      <div className={styles.tools}>
        <CopyMermaid text={drawing.mermaid} />
      </div>
    </details>
  );
}

function Query({ model, id, today }: ThingExtrasProps) {
  const doc = operationDocumentOf(model, id, today);
  if (doc === null) return null;
  return (
    <details className={styles.extra} open>
      <summary className={styles.summary}>
        {doc.mode === 'asIs' ? 'The query as it runs today' : 'The query with this plan'}
      </summary>
      <TintedDocument id={id} mode={doc.mode} model={model} />
      <div className={styles.tools}>
        <CopyButton text={doc.text}>Copy the query</CopyButton>
      </div>
    </details>
  );
}

function IssueState({ issue }: { readonly issue: IssuePreview }) {
  if (issue.state === null) return <Badge>not filed</Badge>;
  if (issue.state === 'open') return <Badge tone="accent">open</Badge>;
  const on = issue.closedOn === null ? '' : ` ${shortDate(issue.closedOn, new Date())}`;
  return <Badge tone="added">{`closed${on}`}</Badge>;
}

function Issue({ model, id }: Omit<ThingExtrasProps, 'today'>) {
  const issue = issuePreviewOf(model, id);
  if (issue === null) return null;
  const name = `${issue.repo ?? ''}${issue.number}`;
  return (
    <section aria-label="Its GitHub issue" className={styles.extra}>
      <div className={styles.head}>
        <span className={styles.title}>{issue.title}</span>
        <IssueState issue={issue} />
        {issue.url === null ? (
          <span className={styles.repo}>{name}</span>
        ) : (
          <a className={styles.repo} href={issue.url} rel="noopener noreferrer" target="_blank">
            {name === '' ? 'Open on GitHub' : name} ↗
          </a>
        )}
      </div>
      <details>
        <summary className={styles.summary}>The issue as filed</summary>
        <pre className={styles.body}>{issue.body}</pre>
        <CopyButton text={`# ${issue.title}\n\n${issue.body}`}>Copy as text</CopyButton>
      </details>
    </section>
  );
}

interface ThingExtrasProps {
  readonly model: Model;
  readonly id: string;
  readonly today: boolean;
}

/** A flow's drawing, an operation's query and a work item's issue, under its facts. */
export function ThingExtras({ id, model, ...rest }: ThingExtrasProps) {
  return (
    <>
      <FlowDrawn id={id} model={model} {...rest} />
      <Query id={id} model={model} {...rest} />
      <Issue id={id} model={model} />
    </>
  );
}
