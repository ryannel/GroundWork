// A static export builds every address a route lists, and refuses a route that lists none. A site with no plans,
// or no images, still has those routes, so each lists one address that is never linked and answers "not found".

/** The segment the stand-in address uses wherever an id goes. */
export const NOTHING = '_none';

/** The params as they are, or the stand-in when there are none. */
export const orNothing = <T>(params: readonly T[], nothing: T): T[] =>
  params.length > 0 ? [...params] : [nothing];
