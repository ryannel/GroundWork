import { createContext, useContext } from "react";

type HrefBuilder = (entityId: string, tab?: string) => string;

export const LinkContext = createContext<HrefBuilder | null>(null);

export function useEntityHref(entityId: string, tab?: string): string | undefined {
  const builder = useContext(LinkContext);
  return builder ? builder(entityId, tab) : undefined;
}
