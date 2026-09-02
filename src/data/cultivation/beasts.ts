/**
 * Spirit beasts - the part of the world that is dangerous and is not a person.
 *
 * Everything else in this catalog directory is human: sects, disciples, rogues,
 * auditors, grave-readers. This file is the other half of the population, and
 * it is not a bestiary bolted onto the setting. Every entry here is generated
 * by premises the world already had.
 *
 * THEY CULTIVATE TOO
 * ------------------
 * One ladder, always. A beast at ordinal 19 is Core Formation Late, is as
 * dangerous as a cultivator at ordinal 19, and is described with the same
 * vocabulary - which is also how a cultivator estimates one across a valley.
 * `rankName(beast.ordinal)` is the only reading anybody gets, and it is the
 * reading that matters.
 *
 * What differs is the road, not the rungs. A beast has no manual, no teacher,
 * no sect and no pills. It sits on the best ground it can hold and does not
 * die, for a very long time, and that is the whole method. This is NOT a third
 * tradition: it has no transmission, no institutions and no quarrel with
 * anybody, so it does not belong in `traditions.ts`. It is what the ladder
 * looks like when nothing about it is taught.
 *
 * Two consequences the catalog leans on:
 *
 *   - A beast is slower per year than a Drawn cultivator on the same ground,
 *     and it never stops. Time is the only resource it has, and it has all of
 *     it. An old beast on a good vein is exactly as terrible as that sounds.
 *   - Condensing a core and taking a shape are DIFFERENT EVENTS, twelve rungs
 *     apart, and the gap between them is where this whole file earns its
 *     keep. See the two constants below.
 *
 * THE TWELVE RUNGS BETWEEN A CORE AND A VOICE
 * -------------------------------------------
 * Condensing a core and becoming a person are two events, twelve rungs apart:
 *
 *   `BEAST_CORE_ORDINAL`   17, Core Formation. It has a core.
 *   `BEAST_CHANGE_ORDINAL` 29, Void Refinement. It has a shape and a voice.
 *
 * Between those rungs sits an animal carrying something worth more than most
 * people will earn, which cannot say a word about it. That window IS the
 * hunting economy - collapse the two constants together and the first thing
 * worth killing for a core becomes the first thing that can ask you not to,
 * which leaves the whole material ladder with no honest supply.
 *
 * Below 29 a beast is an animal, however deep and however old. At and above
 * it, it is somebody:
 *
 *   > A beast past the change is a party to a conversation, and cultivators
 *   > who forget that are the ones who open with a sword.
 *
 * Reaching 29 is a MEGA RARE event and the catalog is built to keep it one.
 * Three entries speak. Every one is a named individual with a frequency of
 * six or less, and two hold ground no province can take. A fourth talking
 * beast is a bigger change than it looks: see the guard in
 * `tests/data/cultivation-beasts.test.ts` that prices this as a share of the
 * draw rather than as a count.
 *
 * THE THREE BANDS
 * ---------------
 * The two constants cut the population into three, and how a beast is HANDLED
 * follows from which band it is in. Neither line is a rule about beasts: the
 * first is `items.md`'s counted/tracked boundary and the second is the ladder.
 *
 *   below 17   an animal with qi in it.  COUNTED. "I hunt a spirit beast" is
 *              a generic act. No row, no identity, no provenance, the same
 *              way a bowl of millet has none. Pelts and sinew and tusks.
 *
 *   17 to 28   it has a core.            TRACKED. A core is worth money, and
 *              money is what makes a thing singular, so what comes off it is
 *              an object with a holder and a history somebody can ask about
 *              two centuries later.
 *
 *   29 and up  it has a shape and a      A PERSON. Its own row among the
 *              voice.                    people, holding what any cultivator
 *              holds - a rung, a house or none, wants, relationships, a name.
 *
 * The third band is why this catalog carries only three entries at 29 and
 * gives none of them materials: a thing that can answer you is not stock, and
 * the question of what anybody would do with its body is the ordinary one the
 * world asks about every cultivator - is this person worth more to you alive
 * or as material - answered by house alignment and by what they are worth,
 * not by anything written about beasts.
 *
 * THEY LIVE WHERE THE QI IS
 * -------------------------
 * Qi pools in veins, and a beast that wants to progress goes and sits on one.
 * So the richest ground in the world is contested with something before any
 * sect gets there, a vein is worth more and costs more than the survey says,
 * and the map has places nobody holds for a reason that is alive.
 *
 * A beast on a vein is also a competing draw on it. That is the same
 * arithmetic as `enc-valley-overdrawn`: qi taken by one is not available to
 * another, and a sect whose output has quietly fallen eleven percent has
 * either acquired disciples or acquired a neighbour.
 *
 * THE LATE AGE APPLIES TO THEM
 * ----------------------------
 * Drawn-down provinces have thin, degenerate populations. The culling
 * contracts in a poor district pay badly because what is on the ground is
 * barely worth taking, and the animals there are smaller than the ones in the
 * old surveys. The impressive things are inside the sealed places, along with
 * everything else that is impressive, which is one more reason sealed places
 * kill people. Something has been in there cultivating with no competition and
 * no interruptions since before the seal was cut.
 *
 * WHAT THIS FILE IS NOT
 * ---------------------
 * Inert data, like every catalog beside it. Nothing here rolls or resolves.
 * There are no stat blocks: danger is a realm ordinal, a place, and one line
 * saying what specifically makes the thing hard. If an entry needs a paragraph
 * to be frightening, it is not frightening.
 */

import { z } from 'zod';
import { RegardProfileSchema, TechniqueGradeSchema } from '../../schema/cultivation.js';
import { MAX_ORDINAL, rankName } from '../../engine/cultivation/realms.js';
import {
    narrowToOffered,
    regardOf,
    type Regard,
    type RegardAskerInput
} from '../../engine/cultivation/regard.js';
import { HerbBiomeSchema, type HerbBiome } from './herbs.js';

// ─────────────────────────────────────────────────────────────────────────
// SCHEMA
// No beast contract exists in `src/schema/cultivation.ts` yet - beasts are
// content with no engine-side persistence contract - so the Zod schemas are
// declared here and exported, ready to be lifted when storage needs them.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The ordinal at which a beast condenses a core.
 *
 * The same rung as Core Formation, because it IS Core Formation - a beast
 * does the thing the realm is named after, on the same ladder, by sitting
 * still for long enough. Nothing below this has a core, which is why the
 * bottom of the beast trade is pelts and sinew and the middle of it is not.
 *
 * A core at this rung can neither talk nor be talked to. It is an animal with
 * a very valuable stone in it, and that is the whole of the arrangement for
 * the next twelve rungs.
 */
export const BEAST_CORE_ORDINAL = 17;

/**
 * The ordinal at which a beast takes a shape and can speak.
 *
 * Void Refinement, which is also the rung at which heaven-grade material can
 * be worked at all - the same line `items.md` draws through the economy, met
 * from the other side. Below it a beast is an animal carrying qi, however
 * deep and however old. At and above it, it is somebody: it has a shape, it
 * has a voice, it can decline, and cultivators who forget that are the ones
 * who open with a sword.
 *
 * KEEP THIS CONSTANT SEPARATE FROM `BEAST_CORE_ORDINAL`. Bundling the two
 * is the mistake this pair exists to prevent: a single constant covering both
 * puts speech at Core Formation, which is inside every province's ordinary
 * range, and a thing a Foundation cultivator can expect to meet is not a rare
 * event. At 29 nothing that speaks is standing anywhere a province can reach
 * without a campaign, which is the intent.
 *
 * A beast at or above this rung is not handled by this catalog at all. It is
 * a person, and it belongs among the people - see THE THREE BANDS in the file
 * header.
 */
export const BEAST_CHANGE_ORDINAL = 29;

/** What sort of problem this is, before anything about its strength. */
export const BeastNatureSchema = z.enum([
    /** An animal with a little qi in it. Most of the world's beasts. */
    'ordinary',
    /** Moves in numbers. Tides come out of these, never out of solitaries. */
    'herd',
    /** Hunts, and has worked out that cultivators are worth more than deer. */
    'ambush',
    /** Holds ground, and the ground it holds usually has a vein under it. */
    'territorial',
    /** Has made the change. Takes a shape, speaks, and can be dealt with. */
    'intelligent',
    /** Was here before the compound above it. Still going. Still asleep. */
    'ancient'
]);
export type BeastNature = z.infer<typeof BeastNatureSchema>;

/** Where the Late Age has left this thing. */
export const BeastPersistenceSchema = z.enum([
    /** Survives on ordinary ground, and is duller than the old records say. */
    'open_world',
    /** What a drawn-down province still has: small, sparse, barely worth it. */
    'thin_remnant',
    /** Only where the ground is still rich, so always somebody's problem. */
    'vein_only',
    /** Only inside places nothing has drawn on. The reason seals are cut. */
    'sealed_only'
]);
export type BeastPersistence = z.infer<typeof BeastPersistenceSchema>;

/** What it does to a spiritual vein, which is what makes it political. */
export const VeinRelationSchema = z.enum([
    'indifferent',
    /** Moves to whatever ground is richest this decade, and arrives in numbers. */
    'follows',
    /** Territorial about one vein and will not be moved off it. */
    'holds',
    /** A competing draw. Measured output falls while it is there. */
    'drains'
]);
export type VeinRelation = z.infer<typeof VeinRelationSchema>;

/**
 * What a species can do because of what it is, rather than because of what it
 * climbed.
 *
 * TWO AXES, AND KEEPING THEM APART IS THE WHOLE POINT. The rung gives what it
 * gives every cultivator - one ladder, always, and a beast at ordinal 19 can
 * do what anybody at 19 can do. This is the other axis: something no amount of
 * cultivation confers on a human. A tortoise's defence, a fox's fire, a
 * tiger's leap.
 *
 * > **A fox is not a cultivator who learned a fire technique. The fire is what
 * > it is.**
 *
 * That is why a changed beast at 29 is a different proposition from a person
 * at 29 standing next to it, and it is why this is a trait rather than an
 * entry in `techniques.ts`. It cannot be taught, cannot be stolen off a
 * shelf, and cannot be put down.
 *
 * ONE ABILITY PER SPECIES, AUTHORED ONCE. It is written here at full strength
 * and the three bands scale it - see `abilityAt` in
 * `src/engine/world/hunting-a-spirit-beast.ts`. Do not author three versions:
 * the bands come off `BEAST_CORE_ORDINAL` and `BEAST_CHANGE_ORDINAL`, which
 * already decide two other things, and a species with a well-judged ability
 * therefore gets a well-judged progression for free. **If this ever needs a
 * threshold of its own, something has drifted.**
 */
export const BeastAbilitySchema = z.object({
    name: z.string().min(1),
    /** The axis it acts on, so two species can be compared without prose. */
    kind: z.enum([
        'defence', 'movement', 'breath', 'perception',
        'endurance', 'concealment', 'strength'
    ]),
    /** What it does at the final form. One line. The bands scale it down. */
    what: z.string().min(40)
});
export type BeastAbility = z.infer<typeof BeastAbilitySchema>;

export const BeastSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    nature: BeastNatureSchema,
    /** Realm ordinal. The only measure of danger this catalog carries. */
    ordinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** Same biome vocabulary the herb catalog uses, so ground resolves once. */
    biome: HerbBiomeSchema,
    persistence: BeastPersistenceSchema,
    veinRelation: VeinRelationSchema,
    /** Typical number encountered together. One means solitary. */
    groupSize: z.number().int().min(1),
    /**
     * Has made the change and can be spoken to. Never true below
     * `BEAST_CHANGE_ORDINAL`.
     *
     * A FLOOR, NOT AN IFF, and the distinction is load-bearing. Plenty of
     * things stand above the change and say nothing: the catalog carries two,
     * and they are the worst entries in it precisely because there is nothing
     * to negotiate with. Anything asking "is this somebody" must read this
     * field and never the ordinal.
     */
    speaks: z.boolean(),
    /** Draw weight when something is met. Larger is commoner. */
    frequency: z.number().int().min(1),
    /** What it can do because of what it is. Required: every species has one. */
    ability: BeastAbilitySchema,
    /** What specifically makes it hard. Not power - the shape of the problem. */
    hard: z.string().min(40),
    /** Materials it yields, by id. Everything here resolves in this file. */
    materialIds: z.array(z.string()),
    /** One line of flavour. If it needs two, it is not doing its job. */
    note: z.string().min(40),
    /**
     * The generic column. Absent everywhere here: `ordinal` is already what a
     * beast is pitched at, and it is the only measure of danger this catalog
     * carries, so the ordinary bands read it unaided.
     */
    regard: RegardProfileSchema.optional()
});
export type Beast = z.infer<typeof BeastSchema>;

/**
 * How a material comes off. A core comes off a corpse and prices accordingly;
 * a shed feather is what a poor cultivator can actually reach, which is the
 * whole bottom of the beast trade.
 */
export const MaterialTakingSchema = z.enum(['kill', 'shed', 'scavenge']);
export type MaterialTaking = z.infer<typeof MaterialTakingSchema>;

/**
 * Beast materials, in the herb catalog's idiom deliberately: same five grades,
 * same value bands, same rarity ceilings, same `harvestOrdinal` meaning "the
 * realm below which getting this will kill you". An alchemist buying a core
 * and an alchemist buying a root are running the same arithmetic.
 */
export const BeastMaterialSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    grade: TechniqueGradeSchema,
    sourceBeastId: z.string(),
    taking: MaterialTakingSchema,
    /**
     * True for the condensed cultivation of a beast past the change. This is
     * the single reason spirit beasts are hunted rather than avoided: a core
     * is somebody else's centuries, in a form that can be eaten or sold.
     */
    core: z.boolean(),
    /** Base market value in spirit stones. Same bands as herbs. */
    value: z.number().int().min(1),
    /** Draw weight on the salvage table. Larger is commoner. */
    rarityWeight: z.number().int().min(1),
    /** Realm ordinal below which taking this is not survivable. */
    harvestOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    description: z.string().min(40)
});
export type BeastMaterial = z.infer<typeof BeastMaterialSchema>;

/**
 * A beast tide is a regional event with a cause, not a random encounter.
 *
 * Something changed - a vein moved, a seal failed, the ground dried - and a
 * population that was living on the old arrangement had to be somewhere else.
 * The tide is the symptom. Killing the front of it does not address the cause,
 * and the sects that treat a tide as a monster problem rather than a survey
 * problem are the ones it happens to twice.
 */
export const BeastTideSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    regionId: z.string(),
    /** Why it is happening. Always a change to the ground or to a seal. */
    cause: z.string().min(80),
    /** Whether anybody local has worked the cause out. Often not. */
    causeKnownLocally: z.boolean(),
    /** What was observable beforehand, for anyone who reads ground. */
    precursors: z.array(z.string().min(30)).min(2),
    /** Ordinal window of what is actually in it. */
    minOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    maxOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    /**
     * The thing at the back of it, when there is one. A tide driven by a
     * predator has one; a tide driven by dry ground does not, and the second
     * kind is worse because there is nothing to kill.
     */
    driverBeastId: z.string().nullable(),
    beastIds: z.array(z.string()).min(1),
    /** Who pays for it, which is rarely who caused it. */
    whoAbsorbsIt: z.string().min(60),
    aftermath: z.string().min(60)
});
export type BeastTide = z.infer<typeof BeastTideSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE ROAD THEY ARE ON
// ─────────────────────────────────────────────────────────────────────────

/**
 * The beast road, stated once so no entry has to restate it.
 *
 * Not a tradition. A tradition has transmission, institutions and an opinion
 * about the other tradition; this has none of those. It is the same ladder
 * with everything human taken off it.
 */
export const THE_BEAST_ROAD = {
    method:
        'Sit on the best ground you can hold and do not die. There is no manual, no teacher, no medicine and no crossing ceremony. Progress is time multiplied by the density of the air, and nothing else enters the calculation.',
    rate:
        'Slower per year than a Drawn cultivator on the same ground, by a wide margin, and it never stops. A cultivator sleeps, travels, argues with a sect and spends forty years on a feud. A beast on a vein does none of that.',
    theChange:
        `Two events, not one, and twelve rungs apart. At ordinal ${BEAST_CORE_ORDINAL} a beast condenses a core - and can say nothing about it, which is the whole of why it can be hunted for one. At ordinal ${BEAST_CHANGE_ORDINAL} it takes a shape and a voice, and is thereafter a party who can be talked to and who can decline. Everything in between is an animal carrying somebody's ransom.`,
    whyTheyAreHunted:
        'The core is the cultivation, condensed and portable. Killing an old beast is the only way to take centuries off something that will not sell them, which is why every province has a culling trade and why nothing above the change is naive about people.',
    death:
        `Below ordinal ${BEAST_CHANGE_ORDINAL} the body is the whole of them. No nascent soul leaves, no seam regrows, and nothing comes back, and a beast that is killed is finished - a simplicity neither human tradition has, and the reason the culling trade works at all. Past the change none of that holds, because what is standing there is a person: it dies exactly the way anybody at its rung dies, soul and all, and anybody who takes the body for the ending will find out otherwise. Measured by playing rather than asserted - a confrontation with the Reader at Sweptground returns the ordinary nascent soul survival path, because the resolver is reading a rung and does not care what shape is standing on it.`,
    whatTheyLack: [
        'alchemy, formations and any art that has to be written down or shown',
        'allies, except the ones that share a herd and mostly do not help',
        'any way to buy their way past a bottleneck, so a beast that stalls stalls for centuries'
    ],
    whatTheyHave: [
        'time, in quantities no institution can match',
        'no obligation to anybody, so nothing recalls them, taxes them or audits them',
        'first claim on the good ground, because they were on it before the survey'
    ]
} as const;

/**
 * How a cultivator reads a beast in the field, and how the reading fails.
 *
 * The same problem as reading a foreign title one rank low, with the same
 * outcome. `TITLE_TRANSLATIONS` in `regions.ts` is the human version of this.
 */
export const ESTIMATING_A_BEAST = {
    tells: [
        'What the air does around it. A beast past Foundation moves qi the way a Drawn cultivator does, and it is visible at distance in cold weather.',
        'What else is living nearby. The reliable measure is absence: the ordinal is written in how far out the ordinary animals have gone.',
        'Size, which is the tell everyone uses and the worst one. Growth stops early on most roads and an old beast is often not large.',
        'Whether it has a shape or a voice, which puts a hard floor of Void Refinement under it and admits of no argument. Almost nobody who reports one has actually seen one.'
    ],
    standardError:
        'Reading it a rank low, from size or from an old district survey. Culling notices are written from surveys and surveys are not redrawn when a beast has a good century, so the price on the notice is the price for what used to be there.',
    whoGetsItRight:
        'Gleaners, herb gatherers on guarded ground, and anybody who has been paid per head for long enough to have stopped guessing. Sect disciples are the worst at it, because they have never had to be right about it alone.'
} as const;

/**
 * What actually gives a changed beast away.
 *
 * NOT THE BODY. A beast past the change cultivated its way into a human
 * shape, and the shape is correct - there is no wrong hand, no stillness held
 * a beat too long, no failure to blink. Looking harder does not help, and any
 * entry in this catalog that hints otherwise is wrong.
 *
 * ── AND THE POSITIVE HALF, WHICH IS THE PART THAT GETS FORGOTTEN ─────────
 *
 * Refusing the uncanny is not enough, because a rule stated only as a
 * prohibition gets read as licence for whatever it did not list. So, stated
 * plainly:
 *
 * > **The species shows as ordinary human variation, and nothing more.**
 *
 * A changed tortoise is a burly man. A changed serpent is a thin one. Build,
 * height, colouring, bearing - all of it inside the range a person walks past
 * in a market without thinking about twice. There is no grotesquery anywhere
 * in this catalog and no register in which a changed beast is *almost* human:
 * they are human-shaped, completely, and the variation between them is the
 * ordinary variation between people.
 *
 * **Which makes the species flavour and never evidence.** A heavy frame is a
 * heavy frame and the province is full of them. You can no more read a
 * tortoise off a broad back than off a pair of hands, and an entry that
 * invites somebody to try has turned a description into a clue - which is the
 * uncanny tell again, wearing a build instead of a face.
 *
 * > **The body is perfect. The upbringing is missing.**
 *
 * ── ONE STATE. DO NOT ENUMERATE WHAT IT LOOKS LIKE ──────────────────────
 *
 * **A changed beast begins with no records for ordinary life.** That is the
 * whole mechanism. It is not a behaviour, a trait or a disposition - it is an
 * absence of records, in the layer that already holds what somebody has a
 * reference for: `KnowingStage` in `src/engine/social/discovery.ts`, held per
 * subject, with `unaware` at the bottom.
 *
 * Every behaviour anybody would list falls out of that one fact:
 *
 *   asked what it is        no record, so they ask
 *   trying to use it        no record of what it is FOR, so they use it wrong
 *   accounting for itself   no reference class to build a plausible answer
 *                           out of, so the lie is wrong in a way a local
 *                           catches
 *
 * **Those are illustrations of one state, and they must never become data.**
 * No table of gaffes, no `awkwardMoments` array, nothing storing that a
 * chopstick gets held like a fork. A list repeats inside three meals and it
 * is the engine writing prose, which is the one thing this repo exists not to
 * do. The engine's job is to know this person has no record for this object;
 * what that looks like at the table is the narrator's, and it is different
 * every time.
 *
 * ── AND THE SECOND FACE OF IT IS THE BETTER SCENE ───────────────────────
 *
 * **A convincing lie needs a reference class.** To make something up you have
 * to know what a plausible answer looks like - which village names sound like
 * village names, what a cooper does all day, how long that road takes. A
 * changed beast has none of that, so the cover story fails for the same
 * reason the question did.
 *
 * Which produces the inversion worth having:
 *
 * > **A changed beast that knows it needs to pass is MORE catchable, not
 * > less. Effort is what exposes it.**
 *
 * That is a far better scene than obliviousness. Somebody sitting quietly
 * being baffled by chopsticks is a curiosity; somebody working hard at a
 * biography and getting the distance wrong is a person who has just told you
 * what they are.
 *
 * And it is `trust.md`'s own rule about fraud rather than a new one: a signal
 * is worth what the particular reader cannot check, and **a fabricator who
 * does not know what the listener knows cannot aim the lie.** So it fails on
 * exactly the person it most needed to convince - the local, the carter, the
 * one who has actually been there. Fraud is always downmarket.
 *
 * ── AND IT FADES WITH EXPOSURE, NEVER WITH RUNG ─────────────────────────
 *
 * A changed beast that has lived a century among people lies perfectly well,
 * and no amount of cultivation shortens that. **Reference is acquired by
 * living**, which is the whole difference between the two axes - and it is
 * also why the recluse at the top of the ladder cannot catch one. They have
 * the same hole.
 *
 * It did not have a childhood in a village. So it looks entirely right and
 * does not know what the chopsticks are - and that holds for every one of
 * them, the fox included. A fox's gift is seeming, and seeming makes the body
 * right; it does not supply twenty years of sitting at a table with people.
 *
 * ── WHICH IS A MECHANIC THIS WORLD ALREADY RUNS TWICE ────────────────────
 *
 * `docs/world/houses/trust.md` splits a reader on two axes: **realm is
 * capability, worldview is reference.** A changed beast is the purest case of
 * the second failing while the first is enormous - it can perceive anything
 * and has a reference for nothing. That is the same shape as the high-realm
 * recluse who reads a token perfectly and cannot say whose retinue that is,
 * and as the sealed ancestor who wakes asking whether that house still
 * stands. Three arrivals, three unrelated fictions, one rule, and the rule
 * was designed for none of them.
 *
 * So this needs NO FIELD and no species branching. What somebody has a
 * reference for is already modelled - `KnowingStage` in
 * `src/engine/social/discovery.ts` is that axis, held per subject, and
 * `perceivedButCouldNotPlaceIt` is already the engine's phrase for the rung
 * being enough while the reference was not. A changed beast is an ordinary
 * reader with an unusual profile, exactly as the sealed ancestor is.
 *
 * ── AND IT INVERTS WHO CATCHES ONE ───────────────────────────────────────
 *
 * Unreadable by looking, because the shape is flawless. Readable by TALKING,
 * if the talk goes on long enough about ordinary things. So the person who
 * spots one is not the strongest cultivator in the room - it is whoever sat
 * next to them at a meal. That hands an ordinary person something only they
 * can do, which `trust.md` argues is the one kind of authority in this world
 * that does not come off the ladder.
 */
export const WHAT_GIVES_A_CHANGED_BEAST_AWAY = {
    notTheBody:
        'The shape is correct and looking harder does not help. It cultivated into that body rather than being fitted into one, and nothing about it is a costume that slips.',
    ordinaryVariation:
        'The species shows as ordinary human variation and nothing more. A changed tortoise is a burly man; a changed serpent is a thin one. Build, height, colouring and bearing all sit inside the range a person walks past in a market without thinking about twice, and there is no grotesquery anywhere in the catalog.',
    flavourNotEvidence:
        'Which makes the species flavour rather than a clue. A heavy frame is a heavy frame and the province is full of them, so nobody reads a tortoise off a broad back any more than off a pair of hands. An entry inviting somebody to try has turned a description into evidence, which is the uncanny tell again wearing a build instead of a face.',

    // ── THE WHOLE OF THE MECHANISM, AND IT IS ONE FACT ────────────────
    theState:
        'A changed beast begins with no records for ordinary life. That is the entire mechanism and there is nothing else to it: not a behaviour, not a trait, not a disposition - an absence of records, in the layer that already holds what somebody has a reference for.',
    whereItLives:
        'KnowingStage in src/engine/social/discovery.ts, held per subject, with unaware at the bottom. A changed beast is an ordinary reader whose records happen to be empty about chopsticks, villages, trades and roads. Nothing about it is special-cased and nothing should be.',
    andTheNarratorDoesTheRest:
        'The engine knows this person has no record for this object. What that looks like at the table belongs to the narrator, and it will be different every time - which is exactly what a list of gaffes can never be.',

    // ── WHAT MUST NOT BE BUILT ────────────────────────────────────────
    neverAList:
        'Do not enumerate the mistakes. No table of gaffes, no awkward-moments array, nothing that stores asking what the chopsticks are or holding one like a fork or naming a village that does not exist. A list repeats inside three meals, and it is the engine writing prose, which is the one thing this repo exists not to do. If an answer here needs a field, a list, or a branch on species, it has gone wrong.',

    // ── AND IT IS NOT A RULE ABOUT BEASTS ─────────────────────────────
    notAboutBeastsAtAll:
        'Anyone with no record for a thing behaves this way. The changed beast is only the most complete case, because it has the fewest records of anybody - not because it is a beast.',
    itFadesWithExposureNotRung:
        'Reference is acquired by living, so a changed beast that has spent a century among people passes perfectly well, and no amount of cultivation shortens that. It is why the recluse at the top of the ladder cannot catch one: they have the same hole.',
    howItSurfaces:
        'In conversation about ordinary things, over time, and never in a look. It shows twice from the one absence - not knowing when at ease, and inventing badly when trying - and the second is the sharper scene, because effort is what exposes it. A convincing lie needs a reference class to build a plausible answer out of, so a fabricator who does not know what the listener knows cannot aim the lie, and fails on exactly the person it most needed to convince.',
    whoNoticesFirst:
        'Whoever sat next to them, at whatever rung. This is the one reading in the world that gets harder rather than easier as the reader climbs, because a recluse at the top of the ladder has the same hole in their own reference and nothing to compare against.',
    everyOne:
        'True of all of them, the fox included. Seeming makes a body right; it does not supply twenty years of sitting at a table with people.',

    /**
     * Instances of the one rule, NOT a list of behaviours. Extending this is
     * how you record another fiction the same mechanic already covers; it is
     * never where a new kind of mistake gets written down.
     */
    theSameRuleElsewhere: [
        'the high-realm recluse, who reads a token perfectly and cannot say whose retinue that is',
        'the sealed ancestor, waking after centuries with a modern object in her hand',
        'somebody raised inside a sect who has never in their life bought anything',
        'somebody from four provinces over, who is not lying and still gets it wrong',
        'the changed beast, which is the same state with the fewest records of all'
    ]
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG
// Ordered by ordinal, which is the only ordering that means anything here.
// ─────────────────────────────────────────────────────────────────────────

export const BEASTS: readonly Beast[] = [
    // ═══════════════════════════════════════════════════════════════════
    // ORDINARY - animals with a little qi in them. The whole bottom of
    // the trade, and what a poor province has instead of monsters.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-stubble-hare',
        name: 'Stubble Hare',
        nature: 'ordinary',
        ordinal: 0,
        biome: 'farmland',
        persistence: 'thin_remnant',
        veinRelation: 'indifferent',
        groupSize: 6,
        speaks: false,
        frequency: 300,
        ability: {
            name: 'Bolt',
            kind: 'movement',
            what:
                'Covers ground in a straight line faster than anything its size has any business covering it, and changes direction without slowing.'
        },
        hard: 'Nothing about it is hard. It is here because a district with nothing better than this is a district with a ceiling, and the culling ledger says so in numbers.',
        materialIds: ['mat-hare-pelt'],
        note: 'Grey, fast, and faintly warm to hold. Two generations ago the district record was twice this size, and nobody has drawn the obvious conclusion out loud.'
    },
    {
        id: 'beast-ironhide-boar',
        name: 'Ironhide Boar',
        nature: 'ordinary',
        ordinal: 5,
        biome: 'forest',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        speaks: false,
        frequency: 140,
        ability: {
            name: 'Ironhide',
            kind: 'defence',
            what:
                'The hide turns an edge rather than resisting it, so a cut that should open it slides off along the grain instead.'
        },
        hard: 'It does not stop when hurt and it does not turn. A cultivator who has only fought people expects a fight to have a middle, and this one has a beginning and an end.',
        materialIds: ['mat-boar-hide', 'mat-boar-tusk'],
        note: 'Roots up herb ground for the qi in the roots, which is why gatherers and cullers are frequently the same person.'
    },
    {
        id: 'beast-cave-drain-bat',
        name: 'Drain Bat',
        nature: 'herd',
        ordinal: 6,
        biome: 'cave',
        persistence: 'open_world',
        veinRelation: 'follows',
        groupSize: 400,
        speaks: false,
        frequency: 120,
        ability: {
            name: 'Qi Draw',
            kind: 'endurance',
            what:
                'Takes qi rather than blood, out of the air and out of whoever is standing in it, and does not need to touch anybody to do it.'
        },
        hard: 'Individually beneath notice, and they take qi rather than blood. A cultivator fights them at full strength for two minutes and at nothing for the rest of it.',
        materialIds: ['mat-drain-bat-membrane'],
        note: 'Roost wherever the rock is richest, so a colony is a survey result. Prospectors follow them and do not mention it at the assay house.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // HERDS - what a tide is made of, and what makes a vein crowded
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-grey-wolf-pack',
        name: 'Grey Spirit Wolf',
        nature: 'herd',
        ordinal: 3,
        biome: 'forest',
        persistence: 'open_world',
        veinRelation: 'follows',
        groupSize: 9,
        speaks: false,
        frequency: 200,
        ability: {
            name: 'Pack Sense',
            kind: 'perception',
            what:
                'What one of them has seen, all of them have seen, without a sound passing between them and without a line of sight.'
        },
        hard: 'They do not scatter when one falls, and they have learned which of a party is the alchemist. A pack that has hunted cultivators before is a different animal from one that has not.',
        materialIds: ['mat-wolf-sinew'],
        note: 'The commonest paid work in the province and the commonest way a Qi Condensation cultivator dies at twenty-six.'
    },
    {
        id: 'beast-vein-deer',
        name: 'Vein Deer',
        nature: 'herd',
        ordinal: 8,
        biome: 'spirit_vein',
        persistence: 'vein_only',
        veinRelation: 'drains',
        groupSize: 30,
        speaks: false,
        frequency: 70,
        ability: {
            name: 'Vein Sense',
            kind: 'perception',
            what:
                'Knows where the ground is richest across a whole district and moves to it, months before a survey could say the same thing.'
        },
        hard: 'They are not dangerous and they are not the problem. A herd of thirty on a vein draws it down like thirty disciples would, and a sect that culls them is doing arithmetic rather than pest control.',
        materialIds: ['mat-vein-deer-antler'],
        note: 'Move to whichever holding is richest and are counted, every season, by people who will not say what they are counting.'
    },
    {
        id: 'beast-stone-ox',
        name: 'Stone Ox',
        nature: 'herd',
        ordinal: 11,
        biome: 'mountain',
        persistence: 'thin_remnant',
        veinRelation: 'follows',
        groupSize: 20,
        speaks: false,
        frequency: 55,
        ability: {
            name: 'Immovable',
            kind: 'strength',
            what:
                'Cannot be shifted, turned, lifted or knocked down by force applied from outside, whatever the force is or where it comes from.'
        },
        hard: 'Nothing individually. Twenty of them moving in one direction is a landscape event, and the villages between are not a consideration to them.',
        materialIds: ['mat-ox-horn'],
        note: 'Placid for decades and then, once, not. Marches herds are half the size of the ones in the old Low Fall surveys and about as heavy, which nobody has explained.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // AMBUSH - these hunt cultivators specifically, because a cultivator
    // is worth more than a deer and carries it in one place
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-mist-serpent',
        name: 'Mist Serpent',
        nature: 'ambush',
        ordinal: 10,
        biome: 'marsh',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        speaks: false,
        frequency: 60,
        ability: {
            name: 'Venom Breath',
            kind: 'breath',
            what:
                'Breathes a poison that hangs where it was breathed, so the ground of a fight stays dangerous long after the fight has finished.'
        },
        hard: 'Its breath is poison and it lingers where the fight was. Winning is routine; leaving the ground afterwards is what the pills are for.',
        materialIds: ['mat-serpent-gland'],
        note: 'Dens near roads rather than in deep marsh, because the roads are where people are.'
    },
    {
        id: 'beast-core-taker',
        name: 'Core-Taker',
        nature: 'ambush',
        ordinal: 13,
        biome: 'deep_forest',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        speaks: false,
        frequency: 30,
        ability: {
            name: 'Silence',
            kind: 'concealment',
            what:
                'Makes no sound and leaves no trace on qi, so nothing that reads a room reads it, and it is never where anybody watching believes it is.'
        },
        hard: 'It hunts cultivators and only cultivators, waits for the second day of a seclusion, and takes the core and nothing else. Every mortal in the district is safe and knows it, which is why no village will help.',
        materialIds: ['mat-core-taker-jaw'],
        note: 'Bodies are found unrobbed with the pouch still on the belt. Sects read that as a demonic cultivator for about a season, and then the fourth body arrives.'
    },
    {
        id: 'beast-glacier-lynx',
        name: 'Glacier Lynx',
        nature: 'ambush',
        ordinal: 19,
        biome: 'glacier',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        speaks: false,
        frequency: 18,
        ability: {
            name: 'Cold Hunt',
            kind: 'concealment',
            what:
                'Holds still against cold ground until it is not distinguishable from the ground, for as many days as the waiting takes.'
        },
        hard: 'It follows for days without closing and opens when the party is one member short of full strength. It is counting, and it is counting correctly.',
        materialIds: ['mat-lynx-pelt', 'mat-lynx-core'],
        note: 'The only thing in the ice field that ever hurries, and it does so twice a year.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // TERRITORIAL - what is already on the good ground, and why a vein
    // costs more than the survey says
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-thunder-hawk',
        name: 'Thunder Hawk',
        nature: 'territorial',
        ordinal: 17,
        biome: 'high_peak',
        persistence: 'vein_only',
        veinRelation: 'holds',
        groupSize: 1,
        speaks: false,
        frequency: 22,
        ability: {
            name: 'Storm Wing',
            kind: 'movement',
            what:
                'Rides weather rather than air, so it is fastest in exactly the conditions that ground everything else that flies.'
        },
        hard: 'It holds the air over a ledge and does not come down. Nothing that flies crosses its sight line, which closes the fast route between two of the province towns for anyone who cannot fight at its height.',
        materialIds: ['mat-hawk-feather', 'mat-hawk-core'],
        note: 'Nests on the one peak with a vein close to the surface, and has for longer than the sect below has held its charter.'
    },
    {
        // The world was already teaching an art named after this animal and
        // did not contain it. `white-tiger-rend` in `techniques.ts` is an
        // earth-grade metal art at required ordinal 14, described as "the
        // white tiger's four hooked lengths" and favoured by Foundation-stage
        // bodyguards. An art named for a beast implies the beast, and the
        // ordinal is chosen off that art rather than picked: the thing the
        // art is copied from stands a little above the people who can copy
        // it, which is why they copy it.
        id: 'beast-white-tiger',
        name: 'White Tiger',
        nature: 'territorial',
        ordinal: 20,
        biome: 'mountain',
        persistence: 'open_world',
        veinRelation: 'holds',
        groupSize: 1,
        speaks: false,
        frequency: 16,
        ability: {
            name: 'Rending Leap',
            kind: 'movement',
            what:
                'Closes any distance it can see across in a single movement, arriving with the four hooked lengths already extended.'
        },
        hard: 'It holds a ridge and it closes the distance in one movement, so there is no exchange to manage and no second decision to make. Everybody who has seen one describes the same four marks, and the province has an art copied off them.',
        note: 'The one animal in the range that mortals and cultivators name identically, and the reason a metal-element art nobody can trace an author for is taught in four separate houses.',
        materialIds: ['mat-tiger-fang', 'mat-tiger-pelt', 'mat-tiger-core']
    },
    {
        id: 'beast-earth-dragon',
        name: 'Earth Dragon',
        nature: 'territorial',
        ordinal: 26,
        biome: 'spirit_vein',
        persistence: 'vein_only',
        veinRelation: 'drains',
        groupSize: 1,
        speaks: false,
        frequency: 8,
        ability: {
            name: 'Stonewade',
            kind: 'movement',
            what:
                'Moves through rock the way anything else moves through water, so there is no wall between it and anywhere it wants to be.'
        },
        hard: 'It is inside the vein rather than on the ground above it, so it cannot be besieged, cannot be starved, and is drinking the thing that is being defended. Every month of delay is paid in the vein.',
        materialIds: ['mat-dragon-scale', 'mat-dragon-core'],
        note: 'A holding whose measured output has fallen eleven percent in a year has either taken on disciples or acquired one of these, and the sect will announce whichever answer is less embarrassing.'
    },
    {
        // The beast road's own emblem. Every other entry is on it; this one
        // IS it - sit on the best ground you can hold, do not die, and let
        // the arithmetic do the rest. It is also the only thing in the
        // catalog whose value to people is the thing this world's entire
        // economy is short of, which is years.
        id: 'beast-millennial-tortoise',
        name: 'Millennial Tortoise',
        nature: 'territorial',
        ordinal: 31,
        biome: 'lake_bottom',
        persistence: 'vein_only',
        veinRelation: 'holds',
        groupSize: 1,
        speaks: false,
        frequency: 4,
        ability: {
            name: 'Shellbound',
            kind: 'defence',
            what:
                'Takes the shell and everything under it out of reach at once, and can stay that way for as long as the other party can afford to wait.'
        },
        hard: 'Nothing it does is fast and nothing anybody does to it lands. It cannot be starved, cannot be drawn off the water, and outlasts any party that can afford to stay. Two expeditions have simply run out of provisions and gone home.',
        note: 'Sheds a plate about once a generation and the plates are dated by the households that own them, so the animal has a longer continuous record than the sect on the shore.',
        materialIds: ['mat-tortoise-scute', 'mat-tortoise-plastron', 'mat-tortoise-core']
    },
    {
        id: 'beast-abyss-leviathan',
        name: 'Abyssal Leviathan',
        nature: 'territorial',
        ordinal: 38,
        biome: 'abyss',
        persistence: 'sealed_only',
        veinRelation: 'holds',
        groupSize: 1,
        speaks: false,
        frequency: 2,
        ability: {
            name: 'Pressure',
            kind: 'strength',
            what:
                'Carries the weight of the water it lives under wherever it goes, and everything near it is under that weight too.'
        },
        hard: 'It is four realms above anything a province can field, and the realm gap is not a hard fight but an evacuation order. What can be done about it is logistics, not combat.',
        materialIds: ['mat-leviathan-core'],
        note: 'Surfaces from the rift about twice a century, is recorded, and goes back down. The recording is the entire response.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // INTELLIGENT - past the change, and therefore a party rather than a
    // problem. Cheaper to negotiate with, and it knows that too.
    //
    // ── A DEAD END WORTH SIGNPOSTING ─────────────────────────────────
    // If the change ever moves again, do not repair these two by setting
    // `speaks: false`. Neither is a beast that happens to talk. The White
    // Ape's entire entry is a hundred and forty years of kept
    // arrangements, and the Reader is named for what it does with
    // manuals - a mute Reader is a row contradicting its own name, and
    // that reads as a bug six months later rather than as a decision.
    // Move the entry, or raise the question. Do not silence it.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-white-ape-of-the-gorge',
        name: 'White Ape of the Gorge',
        nature: 'intelligent',
        ordinal: 29,
        biome: 'mountain',
        persistence: 'vein_only',
        veinRelation: 'holds',
        groupSize: 1,
        speaks: true,
        frequency: 6,
        ability: {
            name: 'Gorge Stride',
            kind: 'movement',
            what:
                'Holds and crosses sheer rock as though it were level ground, which is most of why the gorge above the Low Fall is its and not anybody else’s.'
        },
        hard: 'It will talk, and it is better at it than the disciples sent to do it. It knows what the gorge is worth, knows that nobody the sect can field is within three realms of it, and has never once opened first. The arrangement holds because it is the cheaper of the two things it could be doing.',
        materialIds: [],
        note: 'Holds the gorge above the Low Fall, charges passage in salt and in news, and has kept every arrangement it has made for a hundred and forty years.'
    },
    {
        id: 'beast-nine-tailed-reader',
        name: 'The Reader at Sweptground',
        nature: 'intelligent',
        ordinal: 29,
        biome: 'ruins',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        speaks: true,
        frequency: 3,
        ability: {
            name: 'Foxfire',
            kind: 'breath',
            what:
                'Breathes a fire that burns what it is aimed at and nothing beside it, and which goes out the moment it is no longer wanted.'
        },
        hard: 'It wants manuals it cannot read alone and will trade genuinely for them, which makes it the most useful thing in the province and the most expensive to be indebted to. It has never broken terms and has never once forgiven a breach.',
        materialIds: [],
        // THIS IS THE CATALOG'S FOX. Do not add a second one.
        //
        // The archetype the change is built around - a beast that takes human
        // form and can be spoken to - is a fox before it is anything else,
        // and this entry carries it. The id has said so since the file was
        // written. Anybody searching the repo for a fox should land here.
        //
        // AND A FOX WEARS THE SHAPE PERFECTLY. Seeming is the thing a fox is
        // best at, so there is no anatomical tell here and there must not be
        // one - a fox with wrong hands is a fox that is bad at being a fox.
        // What gives one away is in WHAT_GIVES_A_CHANGED_BEAST_AWAY, it is
        // not about the body, and it is not this species' problem alone.
        note: 'A nine-tailed fox in a plain human shape, worn perfectly, because seeming is the one thing a fox never had to learn. Sits in the temple ruin most evenings and is not, technically, trespassing.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // ANCIENT - the sealed places, and why they kill people
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-thing-under-nine-peaks',
        name: 'The Thing Under Nine Peaks',
        nature: 'ancient',
        ordinal: 33,
        biome: 'spirit_vein',
        persistence: 'sealed_only',
        veinRelation: 'drains',
        groupSize: 1,
        speaks: false,
        frequency: 1,
        ability: {
            name: 'Drinking the Vein',
            kind: 'endurance',
            what:
                'Draws off a vein faster than the vein refills, so anything sharing ground with it is on a clock that nobody standing there can see.'
        },
        hard: 'It has been cultivating on an undrawn vein since before the order above it was founded, it has never been interrupted, and nobody alive has established whether the seal was cut to keep it in or to keep the vein for it.',
        materialIds: ['mat-ancient-core'],
        note: 'The Ascetic Order lights nine of its forty-one nodes and has never applied to relight the four that sit over the lower chamber.'
    },
    {
        // Stands at 30 to keep an invariant, not for taste: every
        // `sealed_only` entry must be strictly above everything in the open
        // world, which is the Late Age's whole statement about where
        // anything impressive is left. The open-world ceiling is the Reader
        // at 29. Raise anything in the open world past this and the rule
        // breaks here first - the guard is in the beast tests.
        id: 'beast-sleeper-in-the-cut-face',
        name: 'The Sleeper in the Cut Face',
        nature: 'ancient',
        ordinal: 30,
        biome: 'cave',
        persistence: 'sealed_only',
        veinRelation: 'holds',
        groupSize: 1,
        speaks: true,
        frequency: 1,
        ability: {
            name: 'Seam-Held',
            kind: 'defence',
            what:
                'Has grown into the working face itself, so anything done to it is done to nine hundred years of mountain first.'
        },
        hard: 'It is walled into a working face on the Marches side, it is past the change, and it has been awake for some of the nine hundred years. Carvers who have cut near it report the dust hanging wrong and stop taking that grant.',
        materialIds: ['mat-sleeper-seam-core'],
        note: 'The Weir Office has refused four applications to open the face and has not given a reason in writing, which is itself the longest entry in the grant ledger.'
    }
] as const;

// ─────────────────────────────────────────────────────────────────────────
// MATERIALS
// Same five grades, same value bands and rarity ceilings as `herbs.ts`, so
// the alchemy and salvage economies price off one ladder rather than two.
// ─────────────────────────────────────────────────────────────────────────

export const BEAST_MATERIALS: readonly BeastMaterial[] = [
    // ── mortal: the culling trade, which is most of the trade ─────────
    {
        id: 'mat-hare-pelt',
        name: 'Stubble Hare Pelt',
        grade: 'mortal',
        sourceBeastId: 'beast-stubble-hare',
        taking: 'kill',
        core: false,
        value: 3,
        rarityWeight: 380,
        harvestOrdinal: 0,
        description: 'Sold by the dozen and bought by the dozen. The district clerk records the count and never the size, which is how the decline stayed invisible.'
    },
    {
        id: 'mat-wolf-sinew',
        name: 'Spirit Wolf Sinew',
        grade: 'mortal',
        sourceBeastId: 'beast-grey-wolf-pack',
        taking: 'kill',
        core: false,
        value: 14,
        rarityWeight: 190,
        harvestOrdinal: 3,
        description: 'Holds a bowstring or a formation cord without stretching. The standing rate has not moved in forty years and the cullers have noticed.'
    },
    {
        id: 'mat-boar-hide',
        name: 'Ironhide Plate',
        grade: 'mortal',
        sourceBeastId: 'beast-ironhide-boar',
        taking: 'kill',
        core: false,
        value: 30,
        rarityWeight: 130,
        harvestOrdinal: 5,
        description: 'Worth four times as much intact, which is why an ironhide boar is killed badly by everyone who needs the money.'
    },
    {
        id: 'mat-boar-tusk',
        name: 'Ironhide Tusk',
        grade: 'mortal',
        sourceBeastId: 'beast-ironhide-boar',
        taking: 'scavenge',
        core: false,
        value: 8,
        rarityWeight: 220,
        harvestOrdinal: 2,
        description: 'Found where something else finished the job. The commonest honest income of a hungry cultivator and the commonest thing a dishonest one claims to have hunted.'
    },
    {
        id: 'mat-drain-bat-membrane',
        name: 'Drain Bat Membrane',
        grade: 'mortal',
        sourceBeastId: 'beast-cave-drain-bat',
        taking: 'scavenge',
        core: false,
        value: 20,
        rarityWeight: 150,
        harvestOrdinal: 3,
        description: 'Swept off a roost floor by the sackful. Holds qi briefly and badly, which is exactly what a cheap talisman needs.'
    },

    // ── earth: guarded ground, and the first real money ────────────────
    {
        id: 'mat-serpent-gland',
        name: 'Mist Serpent Gland',
        grade: 'earth',
        sourceBeastId: 'beast-mist-serpent',
        taking: 'kill',
        core: false,
        value: 90,
        rarityWeight: 70,
        harvestOrdinal: 10,
        description: 'Cut within the hour or it is worth nothing. Half of what a poison specialist uses and all of what kills the apprentices who cut it wrong.'
    },
    {
        id: 'mat-vein-deer-antler',
        name: 'Vein Deer Antler',
        grade: 'earth',
        sourceBeastId: 'beast-vein-deer',
        taking: 'shed',
        core: false,
        value: 130,
        rarityWeight: 60,
        harvestOrdinal: 6,
        description: 'Shed on the vein each spring, so it can be gathered without a cull - which is why sects that own a vein count the sheds and price them as a crop.'
    },
    {
        id: 'mat-ox-horn',
        name: 'Stone Ox Horn',
        grade: 'earth',
        sourceBeastId: 'beast-stone-ox',
        taking: 'kill',
        core: false,
        value: 180,
        rarityWeight: 48,
        harvestOrdinal: 11,
        description: 'The one beast material the Quiet Marches can supply in quantity, and the reason Kettle has a horn market at all.'
    },
    {
        id: 'mat-core-taker-jaw',
        name: 'Core-Taker Jaw',
        grade: 'earth',
        sourceBeastId: 'beast-core-taker',
        taking: 'kill',
        core: false,
        value: 260,
        rarityWeight: 30,
        harvestOrdinal: 13,
        description: 'Bought at a premium by anybody who has been paid to prove the thing is dead, and by a small number of people who wanted it for the other reason.'
    },
    {
        id: 'mat-hawk-feather',
        name: 'Thunder Hawk Feather',
        grade: 'earth',
        sourceBeastId: 'beast-thunder-hawk',
        taking: 'shed',
        core: false,
        value: 400,
        rarityWeight: 26,
        harvestOrdinal: 12,
        description: 'Gathered off the scree below the ledge by people who never go up it. The only lightning reagent in the province a Foundation cultivator can afford or reach.'
    },
    {
        id: 'mat-tiger-fang',
        name: 'White Tiger Fang',
        grade: 'earth',
        sourceBeastId: 'beast-white-tiger',
        taking: 'scavenge',
        core: false,
        value: 150,
        rarityWeight: 55,
        harvestOrdinal: 12,
        description: 'Picked up below a ridge where something else lost an argument. Four of them mounted on a cord is the standing sign of a bodyguard who wants the question settled before it is asked.'
    },
    {
        id: 'mat-tortoise-scute',
        name: 'Shed Tortoise Scute',
        grade: 'earth',
        sourceBeastId: 'beast-millennial-tortoise',
        taking: 'shed',
        core: false,
        value: 300,
        rarityWeight: 40,
        harvestOrdinal: 14,
        description: 'Comes off the shell about once a generation and washes up whole. Households on the shore date them, keep them, and will not sell the oldest at any offer, which the assay houses have stopped arguing about.'
    },
    {
        id: 'mat-tiger-pelt',
        name: 'White Tiger Pelt',
        grade: 'earth',
        sourceBeastId: 'beast-white-tiger',
        taking: 'kill',
        core: false,
        value: 420,
        rarityWeight: 20,
        harvestOrdinal: 20,
        description: 'Sold whole or not at all, and the four marks a fight leaves on it are the reason most are not sold whole. Buyers price the damage down and the story up.'
    },
    {
        id: 'mat-lynx-pelt',
        name: 'Glacier Lynx Pelt',
        grade: 'earth',
        sourceBeastId: 'beast-glacier-lynx',
        taking: 'kill',
        core: false,
        value: 460,
        rarityWeight: 22,
        harvestOrdinal: 19,
        description: 'Holds cold the way emberleaf holds heat, and is worn by exactly the people who do not need it.'
    },

    // ── heaven: cores. Somebody else's centuries, portable ─────────────
    {
        id: 'mat-hawk-core',
        name: 'Thunder Hawk Core',
        grade: 'heaven',
        sourceBeastId: 'beast-thunder-hawk',
        taking: 'kill',
        core: true,
        value: 1_400,
        rarityWeight: 12,
        harvestOrdinal: 17,
        description: 'The first core most cultivators ever see priced. Assay houses grade it by the realm it came off and shave the price if it was cut rather than taken whole.'
    },
    {
        id: 'mat-lynx-core',
        name: 'Glacier Lynx Core',
        grade: 'heaven',
        sourceBeastId: 'beast-glacier-lynx',
        taking: 'kill',
        core: true,
        value: 2_400,
        rarityWeight: 9,
        harvestOrdinal: 19,
        description: 'Cold enough to burn a bare hand. Two centuries of an animal sitting still on an ice field, and it will be spent in one refinement.'
    },
    {
        id: 'mat-tiger-core',
        name: 'White Tiger Core',
        grade: 'heaven',
        sourceBeastId: 'beast-white-tiger',
        taking: 'kill',
        core: true,
        value: 2_900,
        rarityWeight: 10,
        harvestOrdinal: 20,
        description: 'The core a working cultivator is likeliest to actually take in a life, and the one most often sold before its holder finds out what it was for. Metal-heavy, and refiners bid against each other for it.'
    },
    {
        id: 'mat-tortoise-plastron',
        name: 'Tortoise Plastron',
        grade: 'heaven',
        sourceBeastId: 'beast-millennial-tortoise',
        taking: 'scavenge',
        core: false,
        value: 3_200,
        rarityWeight: 8,
        harvestOrdinal: 24,
        description: 'Recovered from the shallows after one dies of nothing at all, which is how they end. Every longevity formula in the province that does not need an ancient ingredient needs this one instead.'
    },
    {
        id: 'mat-dragon-scale',
        name: 'Earth Dragon Scale',
        grade: 'heaven',
        sourceBeastId: 'beast-earth-dragon',
        taking: 'scavenge',
        core: false,
        value: 3_600,
        rarityWeight: 7,
        harvestOrdinal: 21,
        description: 'Sheared off inside the vein and washed out at the tap-head, which is how a holding finds out what it has. Nobody sells one without first being asked where it came from.'
    },

    // ── immortal: the ones wars are fought over ────────────────────────
    {
        id: 'mat-dragon-core',
        name: 'Earth Dragon Core',
        grade: 'immortal',
        sourceBeastId: 'beast-earth-dragon',
        taking: 'kill',
        core: true,
        value: 24_000,
        rarityWeight: 3,
        harvestOrdinal: 26,
        description: 'Worth more than the vein it was drinking is worth in a decade, which is the argument the sect elders actually have.'
    },
    {
        id: 'mat-tortoise-core',
        name: 'Millennial Tortoise Core',
        grade: 'immortal',
        sourceBeastId: 'beast-millennial-tortoise',
        taking: 'kill',
        core: true,
        value: 30_000,
        rarityWeight: 3,
        harvestOrdinal: 31,
        description: 'A thousand years of not dying, in a form that can be spent in an afternoon. The three recorded sales were all to houses with an heir who was running out of time, and none of the three were to the highest bidder.'
    },
    {
        id: 'mat-leviathan-core',
        name: 'Leviathan Core',
        grade: 'immortal',
        sourceBeastId: 'beast-abyss-leviathan',
        taking: 'kill',
        core: true,
        value: 46_000,
        rarityWeight: 2,
        harvestOrdinal: 38,
        description: 'No confirmed sale in the current records. The price is an estimate maintained by an auction house that has never had one and expects never to.'
    },

    // ── chaos: one of these is a plot, not a purchase ──────────────────
    {
        id: 'mat-ancient-core',
        name: 'Core of Something Older Than the Sect Above It',
        grade: 'chaos',
        sourceBeastId: 'beast-thing-under-nine-peaks',
        taking: 'kill',
        core: true,
        value: 200_000,
        rarityWeight: 1,
        harvestOrdinal: 33,
        description: 'Uninterrupted cultivation on undrawn qi for longer than the current records run. Nothing alive has taken one, and the price is what the ledgers think it would fetch.'
    },
    {
        id: 'mat-sleeper-seam-core',
        name: 'Seam-Held Core',
        grade: 'chaos',
        sourceBeastId: 'beast-sleeper-in-the-cut-face',
        taking: 'kill',
        core: true,
        value: 120_000,
        rarityWeight: 1,
        harvestOrdinal: 30,
        description: 'A core that has grown into worked stone rather than sitting in a body, which no Low Fall alchemist has a method for and no Marches carver will sell. Both facts are the entire market.'
    }
] as const;

// ─────────────────────────────────────────────────────────────────────────
// TIDES
// A regional event with a cause. The tide is the symptom.
// ─────────────────────────────────────────────────────────────────────────

export const BEAST_TIDES: readonly BeastTide[] = [
    {
        id: 'tide-nine-peaks-displacement',
        name: 'The Nine Peaks Displacement',
        regionId: 'region-low-fall',
        cause:
            'Something at Deity Transformation moved into the deep vein under Nine Peaks and everything below it left the mountain in the same season. The tide is not an attack; it is a population that has been evicted and has nowhere above the gorge to go.',
        causeKnownLocally: false,
        precursors: [
            'the ordinary animals went first and went far, which is the tell every gatherer knows and no sect records',
            'measured output at the Ascetic Order fell before anything was seen, and was reported as a survey error',
            'vein deer arrived on three neighbouring holdings at once, out of season, and were culled as pests'
        ],
        minOrdinal: 3,
        maxOrdinal: 19,
        driverBeastId: 'beast-thing-under-nine-peaks',
        beastIds: ['beast-grey-wolf-pack', 'beast-vein-deer', 'beast-stone-ox', 'beast-thunder-hawk'],
        whoAbsorbsIt:
            'The river villages between the mountain and the province town, none of which are inside any sect recall order, and the Clear River Fordhall, which counts the crossings and will call in the debt afterwards.',
        aftermath:
            'The front of it is killed within a month and the cause is not addressed, because addressing it means opening the lower chamber. The same tide is expected again and no date is offered.'
    },
    {
        id: 'tide-failed-seal-upstream',
        name: 'The Tide Out of a Broken Seal',
        regionId: 'region-low-fall',
        cause:
            'A seal failed somewhere upstream and a pocket of qi nothing had drawn on began venting into the open world. Everything within a hundred li moved toward the surge, arrived together, and started competing over ground that will be ordinary again within the year.',
        causeKnownLocally: true,
        precursors: [
            'a spirit tide was declared on the same watercourse and the sects mobilised for the qi rather than for what the qi would attract',
            'herds that do not share ground were seen sharing it, moving in one direction, unbothered by people',
            'two culling contracts in adjacent districts were filled in a week and then could not be filled at all'
        ],
        minOrdinal: 0,
        maxOrdinal: 17,
        driverBeastId: null,
        beastIds: ['beast-cave-drain-bat', 'beast-grey-wolf-pack', 'beast-vein-deer', 'beast-mist-serpent'],
        whoAbsorbsIt:
            'Whoever holds ground under the surge, which in practice means two sects with a prior claim on the same water and a hired screen of unaffiliated cultivators between them and it.',
        aftermath:
            'The surge closes, the ground reverts to its old ambient, and the population that came for it starves in place across the following two seasons. The second year is worse than the first.'
    },
    {
        id: 'tide-dead-verge-advance',
        name: 'The Dead Verge Advance',
        regionId: 'region-quiet-marches',
        cause:
            'The burn edge moved about nine hundred paces since the survey was drawn, and the thin population living behind it ran out of ground with anything in it at all. Nothing is driving them and there is nothing at the back of it to kill.',
        causeKnownLocally: true,
        precursors: [
            'the Sixmile Wardens repainted the stakes twice in one year and the second repaint was not published',
            'horn prices at Kettle fell, because everything arriving at market was undersized and everyone could see it',
            'hares reached the sorting yard at Hollowmarket, which they have no business doing and had not done before'
        ],
        minOrdinal: 0,
        maxOrdinal: 11,
        driverBeastId: null,
        beastIds: ['beast-stubble-hare', 'beast-stone-ox', 'beast-grey-wolf-pack'],
        whoAbsorbsIt:
            'Kettle, which has a grant queue and an assay house and no pill trade, so the injuries are treated the mortal way at a splint and a month per casualty.',
        aftermath:
            'Nothing in it is worth taking, everything in it has to be killed anyway, and the district ends the season poorer than it started. This is the tide the Marches actually gets, and it is not a story anybody tells.'
    }
] as const;

// ─────────────────────────────────────────────────────────────────────────
// CONTRACTS
// Rare, costly and mutual. Not an acquisition, not a summon, not a pet.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What a contract with a beast actually is.
 *
 * Only something past the change can enter one, which puts a floor of Core
 * Formation under the other party and means the cultivator is very rarely the
 * senior partner. The beast is not being recruited. It is agreeing to
 * something, for reasons of its own, at a price it named.
 *
 * The cost is the interesting half and it comes straight out of `qi.md`: a
 * bonded beast is a second draw on whatever ground the cultivator holds. Two
 * parties cultivating off one vein progress more slowly than one, and the
 * contract does not exempt anybody from that arithmetic. A cultivator with a
 * contract is measurably slower than the same cultivator without one, forever,
 * and takes it anyway because of what the other party can do.
 */
export const THE_CONTRACT = {
    whatItIsNot: [
        'not a purchase, because nothing past the change is for sale and everything below it cannot agree to anything',
        'not a summoning, because there is nowhere to summon from - the other party is somewhere specific, doing something, and has to travel',
        'not obedience. A contract states what each side will do, and a beast that has kept terms for a century will still decline anything outside them'
    ],
    whatTheBeastWants: [
        'ground it cannot hold alone, or passage across ground somebody else holds',
        'not being hunted for its core by the sect whose charter covers its mountain',
        'something it cannot do without hands: a manual read aloud, a seal examined, a message carried to somebody who will not meet it'
    ],
    whatTheCultivatorGives: [
        'a permanent share of their own draw, because the other party cultivates too and cultivates off the same air',
        'the standing obligation, which is enforceable and which their sect will treat as a competing loyalty',
        'a witness fee to a Dao house, since an unwitnessed contract binds nobody and the beast knows the law better than most disciples do'
    ],
    witnessing:
        'A contract of this kind is witnessed the way any other agreement is - a house of the Bound Word takes the fee, records the terms and holds the penalty clause. Beasts past the change insist on it more often than cultivators do, because they have less recourse and know it.',
    whyItIsRare:
        'Both sides must be able to talk, both must have something the other cannot get otherwise, and both must expect to be alive long enough for the terms to be worth writing. Most encounters fail the second condition and all of them fail the first below Void Refinement, which is nearly all of them - the other party has to be one of a handful of things in the world.',
    howItBreaks: [
        'the beast keeps cultivating and outgrows the terms, which it will, because it never stops',
        'the cultivator loses the ground the contract was about, at which point there is nothing to share and nothing to hold',
        'a sect treats the beast as an asset rather than a party, once, in writing'
    ],
    whatItIsWorth:
        'A party who does not sleep, does not need feeding, cannot be audited, cannot be subpoenaed by a Dao house, and reads ground better than any surveyor. And a permanent tax on the cultivator\'s own progress for as long as it holds.'
} as const;

/**
 * What the engine would need before a contract could resolve mechanically
 * rather than being narrated. Stated here so the next implementer does not
 * have to reconstruct it from the prose.
 */
export const CONTRACT_ENGINE_REQUIREMENTS: readonly string[] = [
    'a cultivator-side draw share, so a bonded beast subtracts from the holder\'s cultivation rate the way an extra disciple subtracts from a valley - the arithmetic already exists in the ambient system and nothing currently spends it on a second party',
    'a beast as a persistable actor with its own realmOrdinal and its own progress, since the whole point is that it keeps advancing while the cultivator does and can pass them',
    'an oath record with a penalty clause and a witnessing faction, which is the Dao house contract shape rather than a new one',
    'a termination path per break condition, with the state each leaves behind: outgrown terms, lost ground, a sect that wrote the wrong thing down',
    'a location link, because a contracted beast is somewhere specific and travels at a stated speed rather than being carried'
] as const;

// ─────────────────────────────────────────────────────────────────────────
// INDICES + LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

const BEAST_BY_ID: ReadonlyMap<string, Beast> = new Map(BEASTS.map(b => [b.id, b]));
const MATERIAL_BY_ID: ReadonlyMap<string, BeastMaterial> = new Map(BEAST_MATERIALS.map(m => [m.id, m]));
const TIDE_BY_ID: ReadonlyMap<string, BeastTide> = new Map(BEAST_TIDES.map(t => [t.id, t]));

const BEASTS_BY_BIOME: ReadonlyMap<HerbBiome, readonly Beast[]> = (() => {
    const map = new Map<HerbBiome, Beast[]>();
    for (const b of BEASTS) {
        const bucket = map.get(b.biome);
        if (bucket) bucket.push(b);
        else map.set(b.biome, [b]);
    }
    return map;
})();

const BEASTS_BY_NATURE: ReadonlyMap<BeastNature, readonly Beast[]> = (() => {
    const map = new Map<BeastNature, Beast[]>();
    for (const b of BEASTS) {
        const bucket = map.get(b.nature);
        if (bucket) bucket.push(b);
        else map.set(b.nature, [b]);
    }
    return map;
})();

export function getBeast(id: string): Beast | undefined {
    return BEAST_BY_ID.get(id);
}

export function requireBeast(id: string): Beast {
    const b = BEAST_BY_ID.get(id);
    if (!b) throw new Error(`Unknown beast: ${id}`);
    return b;
}

export function getBeastsByBiome(biome: HerbBiome): readonly Beast[] {
    return BEASTS_BY_BIOME.get(biome) ?? [];
}

export function getBeastsByNature(nature: BeastNature): readonly Beast[] {
    return BEASTS_BY_NATURE.get(nature) ?? [];
}

export function getBeastMaterial(id: string): BeastMaterial | undefined {
    return MATERIAL_BY_ID.get(id);
}

export function requireBeastMaterial(id: string): BeastMaterial {
    const m = MATERIAL_BY_ID.get(id);
    if (!m) throw new Error(`Unknown beast material: ${id}`);
    return m;
}

/** Everything that comes off one beast, resolved. */
export function materialsOf(beastId: string): BeastMaterial[] {
    const beast = getBeast(beastId);
    if (!beast) return [];
    return beast.materialIds
        .map(id => MATERIAL_BY_ID.get(id))
        .filter((m): m is BeastMaterial => m !== undefined);
}

/**
 * The condensed cultivation of a beast past the change, when the catalog
 * carries the material at all.
 *
 * Nothing below `BEAST_CORE_ORDINAL` has a core to take. Above it, the ones
 * anybody could actually negotiate with carry no material entry, which is not
 * an oversight: nobody has taken one, so there is no grade, no price and no
 * assay standard, and a party proposing to establish one is proposing a
 * specific and well-understood kind of afternoon.
 *
 * ONE CHANGED BEAST IS PRICED ANYWAY, and it is left that way deliberately.
 * The Sleeper in the Cut Face speaks and carries a figure, which reads as a
 * contradiction and is the thesis: a person's body can be worth money, and
 * what anybody does about that is the ordinary question this world asks about
 * every cultivator alive - is this person worth more to you alive, or as
 * material. Tidying it away would make "a changed beast is a person" mean "a
 * changed beast is exempt", and nothing in this world is exempt. What keeps
 * it from being farmed is what keeps everything from being farmed: it is
 * behind a seal, its frequency is 1, and cutting it wants a realm almost
 * nobody reaches.
 */
export function coreOf(beastId: string): BeastMaterial | undefined {
    return materialsOf(beastId).find(m => m.core);
}

export function getBeastTide(id: string): BeastTide | undefined {
    return TIDE_BY_ID.get(id);
}

export function tidesInRegion(regionId: string): BeastTide[] {
    return BEAST_TIDES.filter(t => t.regionId === regionId);
}

/** What is actually in a tide, resolved. */
export function beastsInTide(tideId: string): Beast[] {
    const tide = getBeastTide(tideId);
    if (!tide) return [];
    return tide.beastIds
        .map(id => BEAST_BY_ID.get(id))
        .filter((b): b is Beast => b !== undefined);
}

/**
 * The only reading of a beast anybody gets, and the reading a cultivator
 * makes across a valley. One ladder, so the realm vocabulary applies to a
 * boar exactly as it applies to a disciple.
 */
export function describeBeastRealm(beast: Beast): string {
    return rankName(beast.ordinal);
}

/** Beasts a cultivator at this ordinal could take without a realm gap. */
export function findBeastsForOrdinal(ordinal: number, biome?: HerbBiome): Beast[] {
    const cap = clampOrdinal(ordinal);
    const pool = biome ? getBeastsByBiome(biome) : BEASTS;
    return pool.filter(b => b.ordinal <= cap);
}

/**
 * What is on this ground and above the cultivator, which is the question that
 * actually kills people. A four-rank gap is not a hard fight; it is a death,
 * and the caller is entitled to know before walking in.
 */
export function findThreatsAboveOrdinal(ordinal: number, biome?: HerbBiome): Beast[] {
    const floor = clampOrdinal(ordinal);
    const pool = biome ? getBeastsByBiome(biome) : BEASTS;
    return pool.filter(b => b.ordinal > floor);
}

/**
 * What meeting this thing costs, against a base the caller owns.
 *
 * Same resolver as everything else; the beast's `ordinal` is its gate and the
 * damage multiplier comes straight off the band. A four-rank gap is not a hard
 * fight, it is a death, and this is the arithmetic that says so outside combat
 * as well as inside it.
 */
export function beastRegard(beast: Beast, asker: RegardAskerInput): Regard {
    return regardOf(beast, asker);
}

export function beastDamage(beast: Beast, baseDamage: number, asker: RegardAskerInput): number {
    return Math.max(0, Math.round(baseDamage * beastRegard(beast, asker).damageMultiplier));
}

/** Things that are a competing draw on, or sitting on top of, a vein. */
export function veinContenders(): Beast[] {
    return BEASTS.filter(b => b.veinRelation === 'holds' || b.veinRelation === 'drains');
}

/** What only exists behind a seal, which is most of what is impressive. */
export function sealedOnlyBeasts(): Beast[] {
    return BEASTS.filter(b => b.persistence === 'sealed_only');
}

/** Everything that can be talked to. Never anything below the change. */
export function negotiableBeasts(): Beast[] {
    return BEASTS.filter(b => b.speaks);
}

/**
 * Weighted draw from a uniform [0,1) sample. Takes the sample rather than an
 * RNG so the caller owns seeding, matching `rollHerb` and `rollEncounter`.
 * Returns undefined when nothing in this biome is reachable at this ordinal.
 */
export function rollBeast(
    ordinal: RegardAskerInput,
    sample: number,
    biome?: HerbBiome
): Beast | undefined {
    const rung = typeof ordinal === 'number' ? ordinal : ordinal.ordinal;
    // Reachable first, then narrowed to what is still worth meeting. A rat the
    // asker is twenty rungs past does not get drawn as an encounter; it gets
    // walked past. Where nothing survives the narrowing the reachable set comes
    // back, because a ground with only rats on it still has rats on it.
    const pool = narrowToOffered(findBeastsForOrdinal(rung, biome), ordinal);
    if (pool.length === 0) return undefined;
    const total = pool.reduce((sum, b) => sum + b.frequency, 0);
    let cursor = Math.max(0, Math.min(0.999999999, sample)) * total;
    for (const b of pool) {
        cursor -= b.frequency;
        if (cursor < 0) return b;
    }
    return pool[pool.length - 1];
}

function clampOrdinal(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}
