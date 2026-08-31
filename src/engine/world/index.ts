/**
 * The world layer.
 *
 * Storage, retrieval, time, randomness and state updates. That is the whole
 * remit. The LLM is the reasoning engine - it decides what happens, what people
 * do, and what any of it means; this layer decides what is TRUE, keeps it true
 * for the next three hundred years, and hands it back on request.
 *
 * There is deliberately no simulation here: no NPC tick loop, no behaviour
 * trees, no political engine, no consequence propagator. A world advances
 * because dated consequences fall due and durable rates get multiplied out, not
 * because thousands of agents were stepped.
 *
 * Reading order for anyone new to the module:
 *
 *   history.ts       ground truth and what survives of it. The three event
 *                    kinds (historical / concurrent / witnessed) are computed
 *                    per observer, never stored. `truth` can say `unresolved`,
 *                    which is what stops the database secretly knowing
 *                    everything. Near-misses are ordinary rows with a flag, and
 *                    are the antidote to a history where everything tried
 *                    worked. Also seeds several prior ages at world creation.
 *
 *   locations.ts     places as `origin -> changes -> current state`, separately
 *                    queryable. Environment (spiritual density, danger,
 *                    resources, climate, control, special rules, known secrets,
 *                    historical scars) is what makes ten years in a city
 *                    resolve differently from ten years on a spirit mountain.
 *                    Catastrophes patch existing places: the map never grows,
 *                    it scars.
 *
 *   capability.ts    five predicates - attempt / survive / succeed / understand
 *                    / force - answered together, with reasons. The engine
 *                    never says "your realm is too low, action unavailable"; it
 *                    says what happens when you try. Realm is a capability
 *                    class, and a class is POTENTIAL: whether a cultivator
 *                    holds any particular grant within it is separate state.
 *                    This is the anti-hallucination primitive.
 *
 *   opportunities.ts dated windows that open and close whether or not anyone is
 *                    watching, so the player can miss things permanently -
 *                    including things they never heard about.
 *
 *   possessions.ts   possession, ownership, claim and knowledge-of-ownership
 *                    kept separable, plus provenance on anything that matters.
 *
 *   lineage.ts       the parent/descendant edge and what travels down it. What
 *                    long time-skips land on, and where `heirsOf` produces the
 *                    array the social layer's `inheritLedgerOnDeath` wants.
 *
 *   npc-state.ts     NPCs as small durable records: identity, cultivation,
 *                    location, faction, goals, relationships, history,
 *                    memories. Goals are five fields and outlive their holder.
 *                    Existence is multi-valued; `missing` and `unknown` are
 *                    correct answers, not placeholders.
 *
 *   memory.ts        durable memories with search, and the write path for
 *                    LLM-driven compression. The engine chooses what may be
 *                    compressed and refuses to lose a betrayal, a promise or a
 *                    debt; the LLM writes the summaries.
 *
 *   world-state.ts   the authoritative store: date, locations, factions, NPCs,
 *                    actors, lineages, opportunities, objects, schedule,
 *                    durable processes, history and memories. Plain
 *                    serialisable data, pure mutations, persistence at the
 *                    edges.
 *
 *   catalog.ts       the narrow view of `src/data/cultivation/` that seeding
 *                    needs, mapped in one auditable place so content churn
 *                    cannot take down the world engine.
 *
 *   seeding.ts       turns the catalogs into a world that is already running:
 *                    regions with veins and gating, factions with real members,
 *                    hundreds of NPCs whose realms are DERIVED from their own
 *                    rolled inputs rather than assigned, lineages, dated
 *                    opportunities and the grant renewals that fall due later.
 *
 *   pressure.ts      the world changing on its own. Weighted templates that
 *                    bind to real entities and write real state: a vein changes
 *                    hands, an elder dies, a border moves, a faction folds. It
 *                    schedules THAT something happened; it never simulates why
 *                    anybody did it.
 *
 *   digest.ts        what the player actually learns, gated on channel and then
 *                    on attribution. An event involving a faction they have
 *                    never heard of reaches them as a closed road, never as a
 *                    named report.
 *
 *   driver.ts        `advanceWorldForPlay(state, {days, access})`. One call:
 *                    clock, then pressure, then the filtered digest. This is
 *                    what the play loop wires to.
 *
 *   time.ts          `advanceTime(days)`. Moves the date, fires what fell due,
 *                    applies durable rates, settles deaths, and reports what
 *                    the observer missed. Long actions are interrupted by world
 *                    events rather than fast-forwarded. Cost is a function of
 *                    what is on the books, never of how many days passed.
 *
 * Three rules hold across all of it:
 *
 *   - Randomness belongs to the engine. Everything stochastic derives from the
 *     world seed through `forStream`, because a reasoning engine asked to pick
 *     a number picks the one that suits the story it is telling.
 *   - Belief is not stored here. Ground truth and the surviving record are;
 *     what any given person knows, believes or suspects lives in the social
 *     layer's `knowledge.ts` and references facts by id.
 *   - Nothing reads the player. There is no branch anywhere in this layer that
 *     scales an outcome to how a run is going.
 */

export * from './history.js';
export * from './locations.js';
export * from './capability.js';
export * from './opportunities.js';
export * from './possessions.js';
export * from './lineage.js';
export * from './npc-state.js';
export * from './memory.js';
export * from './world-state.js';
export * from './time.js';
export * from './catalog.js';
export * from './seeding.js';
export * from './pressure.js';
export * from './digest.js';
export * from './driver.js';
