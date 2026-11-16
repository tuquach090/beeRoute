/**
 * Shapes shared between the server queries and the client components.
 *
 * Kept out of queries.ts because that file is `import "server-only"`, and a
 * client component needs these types.
 */

/** The start point new routes begin at, when one has been set. */
export type DefaultStart = { label: string; lat: number; lng: number };

export type UserSettings = {
  defaultStart: DefaultStart | null;
};

export const NO_SETTINGS: UserSettings = { defaultStart: null };
