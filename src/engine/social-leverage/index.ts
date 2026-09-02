/**
 * Working on a person the way you would work on a wall.
 *
 * The simulation half of the social layer. `engine/social/` is STORAGE and its
 * charter forbids scoring, weighting and any reading of the ladder; this
 * directory does all three, so it sits beside it rather than inside it and
 * writes its results back through `social/`'s own record types.
 *
 *   an-attempt-to-move-somebody.ts       one attempt: the odds, the four
 *                                        outcomes, and the marks it leaves
 *   how-freely-somebody-parts-with-what-they-have.ts
 *                                        one number per person, drawn from
 *                                        their id and never from their house,
 *                                        so that a kind elder and a grasping
 *                                        one answer the same request
 *                                        differently
 *   what-a-house-will-do-about-it.ts     the alignment split, entirely
 *                                        downstream of the roll
 *   when-somebody-works-out-what-you-did.ts
 *                                        the delayed discovery, and the grudge
 *                                        that opens years later
 *   going-further-than-an-agreed-bout-allowed.ts
 *                                        the same job for a fight two people
 *                                        arranged: identical wound, different
 *                                        bill, and none of it touching the wound
 *   what-somebody-would-take-for-a-thing-they-will-not-sell.ts
 *                                        the price of something above the cash
 *                                        line, and whether what is on the table
 *                                        meets it. One scale, no list of
 *                                        currencies, and it cannot answer what
 *                                        somebody NEEDS - that is
 *                                        `world/what-an-open-need-does-to-an-
 *                                        ask-and-to-a-price.ts` and this
 *                                        consumes it
 */

export * from './an-attempt-to-move-somebody.js';
export * from './what-somebody-would-take-for-a-thing-they-will-not-sell.js';
export * from './how-freely-somebody-parts-with-what-they-have.js';
export * from './what-a-house-will-do-about-it.js';
export * from './when-somebody-works-out-what-you-did.js';
export * from './going-further-than-an-agreed-bout-allowed.js';
