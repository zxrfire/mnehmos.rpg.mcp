/**
 * Moved to `parties-under-pressure.ts`.
 *
 * A "cascade" could be anything. This is the chain of decisions a party makes when something has gone badly wrong for it, and what the next party does about that.
 *
 * Re-export rather than a rewrite of every importer, because rewriting an
 * import line in somebody else's file sweeps their unstaged work into your
 * commit. Migrate as those files come free, then delete this.
 */
export * from './parties-under-pressure.js';
