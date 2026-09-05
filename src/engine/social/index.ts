/**
 * The social memory layer: what the world remembers about people, and what it
 * has wrong. Storage only - a grudge, a debt, a tie, a false belief or a stolen
 * secret stays on file exact and dated three generations later; whether it is
 * worth acting on is the LLM's. Nothing here decays, scores, weights or ranks
 * anyone by cultivation. `knowledge.ts` is the heart of it.
 *
 * Deliberately does NOT re-export `hearing.ts` or `stealth-perception.ts`:
 * they answer who can physically hear you, and are imported by path.
 */

export * from './common.js';
export * from './relationships.js';
export * from './grudges.js';
export * from './knowledge.js';
export * from './discovery.js';
export * from './travellers.js';
export * from './secrets.js';
export * from './shame.js';
export * from './how-near-you-stand-to-somebody.js';
export * from './what-is-said-about-somebody.js';
