'use client';

import { Button } from '@/ui/button';
import { Callout } from '@/ui/callout';
import { Stack } from '@/ui/stack';
import { Text } from '@/ui/text';

function retry() {
  globalThis.location.reload();
}

export function HistoryError() {
  return (
    <Callout title="Historical evidence could not be read">
      <Stack>
        <Text>The selected archive could not be verified.</Text>
        <Button onClick={retry}>Try again</Button>
      </Stack>
    </Callout>
  );
}
