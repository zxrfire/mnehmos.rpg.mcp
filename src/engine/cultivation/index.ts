/**
 * The cultivation engine.
 *
 * Deterministic, seed-reproducible, and completely free of I/O, database access
 * and MCP concerns. Everything in this module is a pure function of state plus
 * a seeded stream: the LLM narrates what comes out of here, and never decides
 * any of it.
 *
 * Reading order for anyone new to the module:
 *
 *   realms.ts        the 45-rank ladder every other system is a function of
 *   spirit-roots.ts  the talent you are dealt once and never redraw
 *   rng.ts           seeded named sub-streams; why replays are stable
 *   ambient.ts       where you cultivate, and why the world does not shimmer
 *   cultivation.ts   progress accrual - an itemised rate, applied per day
 *   injuries.ts      the ratchet: damage that does not heal, and scar tempering
 *   foundation.ts    why two cultivators at the same ordinal diverge
 *   deviation.ts     cultivation going wrong inside the body
 *   toll.ts          the Vault's instalment, charged at every realm boundary
 *   breakthrough.ts  the centrepiece; the only routine way a run ends well
 *   survival.ts      the death engine; the ONLY place death is decided
 *   time-skip.ts     "I cultivate for ten years", resolved in one pass
 */

export * from './realms.js';
export * from './spirit-roots.js';
export * from './rng.js';
export * from './ambient.js';
export * from './foundation.js';
export * from './cultivation.js';
export * from './injuries.js';
export * from './deviation.js';
export * from './toll.js';
export * from './breakthrough.js';
export * from './survival.js';
export * from './time-skip.js';
