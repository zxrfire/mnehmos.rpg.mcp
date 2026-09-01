/**
 * Moved to `the-top-of-the-world.ts`.
 *
 * Its own first line already said it: the top of the world, and whether it can be moved.
 *
 * Re-export rather than a rewrite of every importer, because rewriting an
 * import line in somebody else's file sweeps their unstaged work into your
 * commit. Migrate as those files come free, then delete this.
 */
export * from './the-top-of-the-world.js';
