/**
 * Working on a person the way you would work on a wall: the simulation half of
 * the social layer.
 *
 * `engine/social/` is STORAGE and its charter forbids scoring, weighting and any
 * reading of the ladder. This directory does all three, so it sits beside it
 * rather than inside it and writes its results back through `social/`'s own
 * record types.
 */

export * from './an-attempt-to-move-somebody.js';
export * from './ground-trust.js';
export * from './what-somebody-would-take-for-a-thing-they-will-not-sell.js';
export * from './how-freely-somebody-parts-with-what-they-have.js';
export * from './what-a-house-will-do-about-it.js';
export * from './when-somebody-works-out-what-you-did.js';
export * from './going-further-than-an-agreed-bout-allowed.js';
export * from './what-somebody-does-about-being-wronged.js';
export * from './what-a-house-does-when-it-catches-you.js';
export * from './personal-alignment.js';
export * from './being-hunted.js';
export * from './what-a-body-wants-is-what-its-deciders-want.js';
export * from './what-an-elder-is-in-charge-of.js';
export * from './a-thing-is-missed-when-somebody-goes-looking-for-it.js';
