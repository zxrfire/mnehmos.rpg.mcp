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
 *   what-a-house-will-do-about-it.ts     the alignment split, entirely
 *                                        downstream of the roll
 *   when-somebody-works-out-what-you-did.ts
 *                                        the delayed discovery, and the grudge
 *                                        that opens years later
 */

export * from './an-attempt-to-move-somebody.js';
export * from './what-a-house-will-do-about-it.js';
export * from './when-somebody-works-out-what-you-did.js';
