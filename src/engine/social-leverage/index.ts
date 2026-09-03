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
 *   what-somebody-does-about-being-wronged.ts
 *                                        what the person in front of you does
 *                                        about it, there and then, and the one
 *                                        answer somebody has when the gap
 *                                        cannot be closed any other way
 *   ground-trust.ts                      what the ground under two people does
 *                                        to whether one believes the other,
 *                                        priced on whether anybody answers for
 *                                        what is done here rather than on what
 *                                        kind of house is standing over it
 *   what-a-house-does-when-it-catches-you.ts
 *                                        and what the house does about it
 *                                        afterwards: whether acting would cost
 *                                        them, whether you are worth the
 *                                        trouble, and only then what kind of
 *                                        house caught you
 *   personal-alignment.ts                what a PERSON is, off the ledger of
 *                                        what they have done, rather than off
 *                                        whose roll they are on. Righteous,
 *                                        neutral and demonic are the same three
 *                                        words a house wears and a different
 *                                        source answers them
 *   being-hunted.ts                      who among the people holding something
 *                                        against them is actually in a position
 *                                        to use it, and who has written the name
 *                                        down with nothing behind it
 *   what-a-body-wants-is-what-its-       what a HOUSE is, by the same move one
 *   deciders-want.ts                     rung up: an institution has no
 *                                        preferences of its own, so its answer
 *                                        is its deciders' weighted, plus what
 *                                        the asker has already done to each of
 *                                        them, over three tiers that close into
 *                                        a loop rather than a hierarchy
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
