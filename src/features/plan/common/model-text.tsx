import type { Model } from '@/application/plan/derive';
import { InlineMarkdown, Markdown } from '@/ui/markdown';

import { EntityMention } from './entity-chip';

interface ModelTextProps {
  readonly model: Model;
  readonly text: string | null | undefined;
}

// The plan's prose as React, with every [[id]] it cites drawn as a mention the inspector opens.
export function ModelText({ model, text }: ModelTextProps) {
  return <Markdown renderRef={(id) => <EntityMention id={id} model={model} />} text={text} />;
}

/** One line of the plan’s prose with its citations as mentions, with no paragraph around it. */
export function ModelInline({ model, text }: ModelTextProps) {
  return <InlineMarkdown renderRef={(id) => <EntityMention id={id} model={model} />} text={text} />;
}
