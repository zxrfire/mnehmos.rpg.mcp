/**
 * Where phase 2 used to live, kept as a door so nothing has to move at once.
 *
 * The turn engine is `turn-engine.ts` now, and the verb families it dispatches
 * to are the other modules beside it. `game.ts` said nothing about what was in
 * it - it was the least informative name in this directory, on much the
 * largest file - and the thing it named is a turn: a sentence becomes an
 * action, the action becomes state, and the state becomes a row.
 *
 * This re-export exists because AGENTS.md says to rename by re-export in a
 * busy tree rather than by rewriting importers: every import line touched in
 * somebody else's file is a line swept into this commit along with whatever
 * they have unstaged there. The modules in this package have been pointed at
 * the real name; the callers outside it can migrate as they come free, and
 * this file can go when the last one has.
 */
export * from './turn-engine.js';
