/**
 * The social memory layer.
 *
 * What the world remembers about people, and what it has wrong. This layer is
 * STORAGE: it guarantees that a grudge, a debt, a relationship, a false belief
 * or a stolen secret is still on file, exact and dated, forty years and three
 * generations later. The reasoning - whether the grudge is worth acting on,
 * whether the man is trustworthy, how the sect responds - belongs to the LLM,
 * which reasons from these records.
 *
 * Nothing here decays, scores, weights, or ranks anyone by cultivation.
 *
 * Reading order for anyone new to the module:
 *
 *   common.ts         day indices, stable ids, engine-owned seeded rolls
 *   relationships.ts  directed ties with type, strength, history and attitude
 *   grudges.ts        grudges, debts, favours, oaths and blood feuds; inherited
 *   knowledge.ts      objective reality kept apart from knows/believes/suspects
 *                     and from what the public believes. The heart of it.
 *   discovery.ts      the six-stage ladder of knowing, expressed as a property
 *                     of an ordinary knowledge record rather than a new table
 *   travellers.ts     who came through, and which names they brought with them
 *   secrets.ts        per-holder secret lifecycle, extending secret.repo.ts
 *   shame.ts          a fact about somebody that other people hold and that
 *                     lowers them - neither a grudge nor a secret, and the
 *                     third of the three things this layer keeps about a person
 *   how-near-you-stand-to-somebody.ts
 *                     how near one person stands to another, which is the only
 *                     thing that decides whether they get the story or the fact
 *   what-is-said-about-somebody.ts
 *                     reputation, DERIVED at read time from what reached them
 *                     and what they stand near enough to hold. Never stored
 *
 * Deliberately does NOT re-export `hearing.ts` or `stealth-perception.ts`,
 * which are the older D&D-substrate mechanics in this directory. They are
 * imported by path everywhere they are used and answer a different question
 * (who can physically hear you), so folding them in would make this barrel a
 * grab-bag rather than a subsystem.
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
