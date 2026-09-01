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
 *   origin.ts        the third dealt thing: where you were born, and what it supplies
 *   rng.ts           seeded named sub-streams; why replays are stable
 *   ambient.ts       where you cultivate, and why the world does not shimmer
 *   cultivation.ts   progress accrual - an itemised rate, applied per day
 *   injuries.ts      the ratchet: damage that does not heal, and scar tempering
 *   foundation.ts    why two cultivators at the same ordinal diverge
 *   existence.ts     what happens when "body destroyed = dead" stops holding
 *   understanding.ts the third quantity: what a cultivator comprehends
 *   dao.ts           what a cultivator turns out to have been doing
 *   deviation.ts     cultivation going wrong inside the body
 *   toll.ts          the price of advancement, charged at every realm boundary
 *   breakthrough.ts  the centrepiece; the only routine way a run ends well
 *   tradition.ts     the two roads, and their different answers to being killed
 *   combat.ts        confrontation: the categorical gap, composite power, upsets
 *   regard.ts        how the world answers, by how far above or below the ask
 *                    somebody is standing - one table every catalog reads
 *   market.ts        the buy board read from the other side: what a buyer pays
 *   survival.ts      the death engine; the ONLY place death is decided
 *   escapes.ts       what a capped cultivator does next: partial volume sets,
 *                    the standing an exceptional manual asks for, and the one
 *                    place in the repo that writes a manual at runtime
 *   time-skip.ts     "I cultivate for ten years", resolved in one pass
 */

export * from './realms.js';
export * from './tradition.js';
export * from './spirit-roots.js';
export * from './rng.js';
export * from './origin.js';
export * from './ambient.js';
export * from './foundation.js';
export * from './manual-quality.js';
export * from './existence.js';
export * from './understanding.js';
export * from './dao.js';
export * from './cultivation.js';
export * from './injuries.js';
export * from './which-wound-an-ordinary-injury-is.js';
export * from './deviation.js';
export * from './toll.js';
export * from './breakthrough.js';
export * from './combat.js';
export * from './regard.js';
export * from './market.js';
export * from './survival.js';
export * from './escapes.js';
export * from './time-skip.js';
