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
 *   layers.ts        the one point where progression is also geography. Two
 *                    layers, ordered, and reaching ordinal 46 MOVES you to the
 *                    second one. Also the single statement of what crosses the
 *                    Lid in either direction, for people, objects, manuals and
 *                    information - the boundary is restricted both ways, and
 *                    that is what makes it mean anything.
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
 *                    anybody did it. Also the convergence pass, which is
 *                    deliberately NOT a weighted draw: something sealed opens
 *                    on its own schedule whether or not the year had a slot.
 *
 *   cascade.ts       the one thing pressure cannot do in a single step: a chain
 *                    of forced choices. A house is destroyed, the survivors
 *                    choose from options the world already prices, and if they
 *                    wake what is under the hall, that chooses too. Usually
 *                    stops at the first link; when it does not, the map is
 *                    permanently different. No branch on any faction id.
 *
 *   provenance.ts    ruins along four independent axes - who left it, how much
 *                    has been gone through, how long ago it fell, and who holds
 *                    the door. Reading a site is a skill answered by the
 *                    `understand` predicate rather than by rank, and knowledge
 *                    of a site is a RELATION rather than a flag, because what a
 *                    house knows is the residue of what it has done.
 *
 *   convergence.ts   a ruin is not a place you can go; it is a place that is
 *                    periodically reachable. The clock, what overstaying costs,
 *                    the space-folding escape that is never available to the
 *                    person who needs it, and whether anybody would come for
 *                    you - which makes a relationship a survival asset.
 *
 *   ruin-mechanics.ts  things a ruin does that are not damage: a map that
 *                    records rooms and never the edges, an identity worn in its
 *                    own era, qi as the only light, and a routine kept by the
 *                    dead. Each changes what the player knows, what they are,
 *                    or what the rules of the place are.
 *
 *   digest.ts        what the player actually learns, gated on channel and then
 *                    on attribution. An event involving a faction they have
 *                    never heard of reaches them as a closed road, never as a
 *                    named report.
 *
 *   legacy.ts        the world outlives the run. A dead cultivator leaves a
 *                    grave on the map with what they carried, a sect that
 *                    remembers what the crossing cost, an unfinished goal that
 *                    is now somebody's active goal, and inherited accounts. The
 *                    next run starts in that world - descendant, disciple, or
 *                    most often a stranger who finds the bones. Nothing
 *                    resurrects.
 *
 *   immortal-world.ts  the far side, materialised on contact and never before.
 *                    Ascension stops being an ending and becomes a transition:
 *                    the person keeps their id, their lineage, their grudges
 *                    and their history, loses everything they were carrying
 *                    because nothing goes through with them, and arrives
 *                    somewhere they are nobody. Both readings of them are
 *                    computed rather than asserted, and both are true at once.
 *
 *   ladder-odds.ts   how many people ever get this far, in three numbers that
 *                    are allowed to disagree: what the world BELIEVES (vague,
 *                    in-world, and all the player ever sees), what the
 *                    constants IMPLY, and what a seeded sweep through the real
 *                    breakthrough engine MEASURES. Admin sees all three.
 *
 *   origin-odds.ts   the same discipline applied to the third dealt thing:
 *                    whole lives run through the real engine, once per origin
 *                    tier, to measure whether being well-born is visible in the
 *                    outcome distribution or only in the opening position. It
 *                    is the test that is supposed to fail if an origin ever
 *                    becomes a difficulty setting.
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

export * from './layers.js';
export * from './history.js';
export * from './locations.js';
export * from './architecture.js';
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
export * from './provenance.js';
export * from './convergence.js';
export * from './ruin-mechanics.js';
export * from './cascade.js';
export * from './pressure.js';
export * from './the-ties-an-ordinary-life-produces.js';
export * from './when-somebody-does-not-come-back.js';
export * from './digest.js';
export * from './driver.js';
export * from './legacy.js';
export * from './immortal-world.js';
export * from './ladder-odds.js';
export * from './origin-odds.js';
