import type { Model } from '@/application/plan/derive';

import { HandlerStory } from './handler-story';
import { StoreContents } from './store-contents';

/** What sits beneath a thing: what a store holds, and what runs when an endpoint is called or a message arrives. */
export function ThingInside({ model, id }: { readonly model: Model; readonly id: string }) {
  return (
    <>
      <StoreContents id={id} model={model} />
      <HandlerStory id={id} model={model} />
    </>
  );
}
