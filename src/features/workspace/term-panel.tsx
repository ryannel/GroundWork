import type { LanguagePage, TermDetail } from '@/application/language-page';
import { Button } from '@/ui/button';
import { Markdown } from '@/ui/markdown';
import { Cluster, Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

import { Examples, Links, Names, Part, type Pick, Places, WordLink } from './term-parts';

interface TermPanelProps {
  readonly detail: TermDetail;
  readonly page: LanguagePage;
  readonly onPick: Pick;
}

function Head({ detail, onPick }: Omit<TermPanelProps, 'page'>) {
  const kind = detail.kind === 'key' ? 'Key term' : 'Word in the code';
  return (
    <Cluster align="start" as="header" spread>
      <Stack as="span" gap={1}>
        <Text caps mono size="sm" tone="faint">
          {detail.group === null ? kind : `${kind} · ${detail.group}`}
        </Text>
        <Text as="h3" size="xl" tone="strong">
          {detail.name}
        </Text>
      </Stack>
      <Button
        onClick={() => {
          onPick(null);
        }}
        size="sm"
      >
        Close
      </Button>
    </Cluster>
  );
}

/** Everything about one word: what it means, what else it is called, where it lives and what it relates to. */
export function TermPanel({ detail, page, onPick }: TermPanelProps) {
  const renderRef = (id: string) => (
    <WordLink id={id in page.details ? id : null} name={page.labels[id] ?? id} onPick={onPick} />
  );
  return (
    <Stack as="section" gap={3} label={detail.name}>
      <Head detail={detail} onPick={onPick} />
      <Markdown renderRef={renderRef} text={detail.means} />
      {detail.aliases.length === 0 ? null : (
        <Part title="Also called">
          <Text as="p">{detail.aliases.join(', ')}</Text>
        </Part>
      )}
      {detail.examples.length === 0 ? null : (
        <Part title="Examples">
          <Examples examples={detail.examples} />
        </Part>
      )}
      <Part title="Where it lives">
        <Places onPick={onPick} places={detail.places} />
      </Part>
      {detail.names.length === 0 ? null : (
        <Part title="What the code calls it">
          <Names names={detail.names} />
        </Part>
      )}
      {detail.relates.length === 0 ? null : (
        <Part title="Related">
          <Links links={detail.relates} onPick={onPick} />
        </Part>
      )}
      {detail.keyTerms.length === 0 ? null : (
        <Part title="Key terms anchored here">
          <Links links={detail.keyTerms} onPick={onPick} />
        </Part>
      )}
    </Stack>
  );
}
