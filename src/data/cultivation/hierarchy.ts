/**
 * Moved to `governance-and-water-rights.ts`.
 *
 * "Hierarchy" says nothing about which hierarchy. Its own first line: governance - who holds the water, and on what terms.
 *
 * Re-export rather than a rewrite of every importer, because rewriting an
 * import line in somebody else's file sweeps their unstaged work into your
 * commit. Migrate as those files come free, then delete this.
 */
export * from './governance-and-water-rights.js';
