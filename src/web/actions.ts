/**
 * The closed action set - phase 1 of the narrator loop.
 *
 * The model is never asked "what happens?". It is asked exactly one question:
 * *which of these nine verbs did the player mean, and with what duration?* The
 * answer comes back as JSON, is parsed by the schema below, and anything that
 * does not fit is thrown away in favour of the deterministic parser at the
 * bottom of this file.
 *
 * Two properties make this the authority boundary rather than a suggestion:
 *
 *  1. THE ENUM IS CLOSED. `action` is a Zod enum over ACTION_NAMES. A model
 *     that answers `"ascend"`, `"gain_spirit_stones"` or `"set_realm"` fails
 *     validation, and a failed validation is not an error path the player
 *     notices - it falls back to the keyword parser and the game continues.
 *
 *  2. THE OBJECT STRIPS. Zod's default object mode drops unknown keys, so a
 *     response of `{"action":"cultivate","realmOrdinal":24,"spiritStones":9999}`
 *     yields exactly `{action:'cultivate'}`. There is no code path anywhere in
 *     src/web that reads a number out of a model response and writes it to the
 *     database; the only numeric field that survives here is `days`, and `days`
 *     is an *input* to a deterministic simulation, not an outcome of one.
 */

// ── WHY THIS FILE IS NOTHING BUT RE-EXPORTS ──────────────────────────────
//
// It was 8,031 lines and its name was a category. What lived in it was seven
// different subjects, and every one of them is now in a file named after
// itself:
//
//   verb-day-costs.ts          how long each verb takes
//   sentence-parts.ts          reading the parts of a sentence
//   action-set.ts              the closed set, and how each verb is classed
//   planned-action.ts          the object both paths hand the engine
//   asking-is-not-doing.ts     a question about an act is not the act
//   verb-pattern-table.ts      which verb a phrasing reaches
//   match-, site-, sect-, institution-phrasings.ts
//                              four verb families, each words plus its step
//
// The barrel stays, and it is not a leftover. Twenty-four files import
// `./actions.js`, and the spelling repair harvests its dictionary out of this
// module's namespace - so keeping the name and forwarding everything is what
// makes the whole split invisible to every consumer. `export *` from a module
// that itself re-exports carries the forwarded names too, which is why one line
// reproduces the surface exactly: 204 exported names, 1497 harvested words,
// checked at every commit of the split.
//
// AGENTS.md is the authority for both halves of this: name a file after what is
// in it, and rename by re-export rather than by rewriting importers.

export * from './verb-pattern-table.js';
