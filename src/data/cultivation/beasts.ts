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
 * What differs is the road, not the rungs. A beast has no manual, no teacher
 * and no pills. It sits on the best ground it can hold and does not die, for a
 * very long time, and that is the whole method. This is NOT a third tradition:
 * it has no transmission and no institutions, so it does not belong in
 * `traditions.ts`. It is what the ladder looks like when nothing about it is
 * taught.
 *
 * THAT IS ABOUT TRANSMISSION, AND IT IS NOT A STATEMENT THAT IT HAS NO SECT.
 * This paragraph used to say "no sect" and it overreached. A beast sits on the
 * best ground it can hold and a house wants the best ground it can hold, so the
 * two were always going to meet, and what happened after that meeting varies: a
 * debt, a founder's oath, a truce that hardened, or the guardian that has been
 * on the mountain since before the compound and that the disciples grew up
 * around. What it is NOT is ownership - it takes no orders, which is why a
 * house will not discuss the arrangement and cannot simply send it at anybody.
 * The chair such a thing stands in is `HouseProtectorSchema`, and a beast is
 * one of several occupants it takes; see `house-protector-pairing.ts`.
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
 *   `BEAST_CHANGE_ORDINAL` 29, Void Tribulation. It has a shape and a voice.
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
 * SPEECH IS THE RUNG AND NOTHING ELSE, so the set that speaks is exactly the
 * set standing at 29 or above - there is no column, and a species cannot be
 * authored mute above the change. Six entries qualify. Every one is a named
 * individual with a frequency of six or less, and three stand behind a seal
 * where nothing reaches them. A seventh is a bigger change than it looks: see the guard in
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
 * The third band is why this catalog carries only six entries at 29 and gives
 * the two it files as `intelligent` no materials: nobody has taken one of
 * those, so there is no grade and no price. The other four keep the figure the
 * catalog already put on them, and that is deliberate - the question of what
 * anybody would do with the body of a thing that can answer you is the
 * ordinary one the world asks about every cultivator - is this person worth
 * more to you alive or as material - answered by house alignment and by what
 * they are worth, not by anything written about beasts.
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
import {
    ElementSchema,
    RegardProfileSchema,
    SectAlignmentSchema,
    TechniqueGradeSchema,
    type SectAlignment
} from '../../schema/cultivation.js';
import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { HerbBiomeSchema } from './herbs.js';

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
 * Void Tribulation, which is also the rung at which heaven-grade material can
 * be worked at all - the same line `items.md` draws through the economy, met
 * from the other side. Below it a beast is an animal carrying qi, however
 * deep and however old. At and above it, it is somebody: it has a shape, it
 * has a voice, it can decline, and cultivators who forget that are the ones
 * who open with a sword.
 *
 * AND IT GOES BACK AS IT DIES. A beast that took a shape returns to the beast
 * shape at the point of death, so the core is cut out of an animal. It hides
 * nothing - who that was can still be established, and the killing leaves what
 * any killing leaves.
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

/**
 * Whether something standing at this rung speaks.
 *
 * THE RUNG IS THE WHOLE ANSWER. This replaced an authored `speaks` column on
 * every row, which the design owner overruled: *"species can't be categorized
 * as speaks false. under 29 = speaks false."* There is no species exception and
 * there cannot be one, so a catalog that could once carry a mute thing above
 * the change now cannot express the idea at all.
 *
 * The column and this function could not both stand. A stored flag beside a
 * derivation of the same fact is the drift this repo pays for most often, and
 * the ruling says which of the two survives.
 *
 * Takes an ordinal rather than a `Beast`, because the question is asked of
 * individuals as often as of species: a row's ordinal is where the catalog
 * places its KIND, and the one standing in front of somebody may have climbed
 * past it.
 */
export function anythingAtThisRungSpeaks(ordinal: number): boolean {
    return ordinal >= BEAST_CHANGE_ORDINAL;
}
/**
 * Why a house sends a party out over BEASTS, which is two of its reasons and
 * not all of them.
 *
 * A house puts people on the road for a marriage, for a war, to escort somebody,
 * to collect tribute from a subsidiary and to find out why a subsidiary has
 * stopped sending it, to answer a call for aid it cannot refuse, to open an
 * inheritance, and to go out and recruit. Those are not this. What is written
 * here is only
 * the pair of errands that beasts produce - going out after them, and standing
 * to when they come - which are one fact seen from either end, and the fact is
 * `BEAST_CHANGE_ORDINAL`. Below it a beast is an animal: a thing that may be
 * taken, and a thing that may arrive in numbers. Neither errand survives the
 * change, which is what puts a ceiling on this trade specifically and on none
 * of the others.
 *
 * This is the house-side statement. The beast side is in the file header and
 * in the tide schema above, and neither is restated here.
 */
export const WHY_A_HOUSE_GOES_OUT_AFTER_BEASTS = {
    toTake:
        'A core is the only high-grade material in this world that is nobody\'s '
        + 'property and cannot be written out again. Everything else at that grade '
        + 'is already in some house\'s hands, and a book at that grade is a book: a '
        + 'house that wants one can copy it, buy the copy, or be taught it. Material '
        + 'cannot be copied, so the supply of it is a hunting problem, and hunting is '
        + 'the one way a house acquires at that grade without taking from another '
        + 'house. That is the whole of why parties go out, and it is also why a poor '
        + 'house goes out more often than a rich one.',
    toStand:
        'Ground draws what ground draws. A house that holds a vein holds what the '
        + 'vein attracts, and the obligation is not charity: the settlements under it '
        + 'are its tithe, its intake and its cover, and a district that has been '
        + 'walked through twice stops being any of the three. A tide is a survey '
        + 'problem rather than a monster problem, for the reason the tide schema '
        + 'above gives, and the survey is the house\'s too, because nobody else on '
        + 'that ground can read it.',
    whyItIsJuniorsWhoGo:
        `Both errands stop at ordinal ${BEAST_CHANGE_ORDINAL}. A RIGHTEOUS house `
        + 'does not hunt a person, and that bar holds; a neutral one might, and for a '
        + 'neutral apex it is not a lapse but ordinary conduct. What is true of every '
        + 'house is only the operational half - nothing that speaks arrives in a tide, '
        + 'so the whole trade '
        + 'lives below the rung a house\'s own strongest are standing on. Sending an '
        + 'elder is not caution, it is waste, and a house that does it has usually '
        + 'mistaken a driver for the tide. So the party at the gate is juniors with '
        + 'one person on it who has seen this before, which is the arrangement that '
        + 'produces most of what a young cultivator in this world ever survives.',
    theSameGroundDoesBoth:
        'A rich vein makes the material and makes the tide. A house cannot take the '
        + 'first without eventually answering for the second, and a house that has '
        + 'spent forty years taking the first and calling the second bad luck is the '
        + 'ordinary case rather than the exception.'
} as const;

/**
 * Three roads to material off a changed beast, and which one a house may walk
 * is read off its alignment.
 *
 * Above `BEAST_CHANGE_ORDINAL` the thing carrying the material is a person, so
 * ASKING is a road and not a joke - which matters beyond the courtesy of it,
 * because it is the only road a righteous house can walk at all. Without it,
 * righteousness is locked out of the top of the artifact economy by arithmetic
 * rather than by anybody deciding so.
 *
 * AND IT IS ONE DERIVATION, NOT A SET OF RARE ROWS. A drop's grade is a
 * function of the source's rung when it died - `gradeOfWhatItYielded`, which is
 * the same call that answers for a dead cultivator. Same beast, same part: kill
 * it young and you get the earth-grade version, kill it old and you get the
 * heaven-grade one. The material never speaks; the thing it came off could.
 *
 * NO NEW CURRENCY. What an ask is made of is
 * `what-they-will-take-instead-of-money.ts` - stones, goods, a favour, a
 * service, a hold - and having done somebody a kindness is what puts you on the
 * FAVOUR rung with that person. It changes which rung you are standing on and
 * never the size of the ask, which is why goodwill is real and is usually not
 * enough on its own. Whether it is enough is `whatItWouldTake`'s arithmetic and
 * nothing here touches it.
 *
 * A refusal is ordinary and has to name the rung that would have worked, the
 * way every refusal in this engine does.
 */
export const THREE_ROADS_TO_WHAT_A_PERSON_CARRIES = {
    killItYoung: 'Below the change it is an animal, and what comes off it is the earth-grade version. Available to anybody, and it is what everybody does.',
    killItOld: 'The heaven-grade version only comes off a source at or above the change, and anything standing there has a shape and a voice and can decline. So this is killing somebody, and a righteous house may only do it to one behaving as a demonic party behaves. The bar is on the act rather than on the appearance of it: the body goes back to its beast shape as it dies, it hides nothing, and the bar holds whether or not anybody finds out.',
    ask: 'Open to anybody, steep, and refusable. The only road to the heaven-grade version a righteous house has, and the reason the righteous half of the world is not shut out of the top of the economy by arithmetic.',
    substitute: 'The Root Cauldron: supply people in place of the material. Ordinary conduct for a neutral apex and unavailable to a righteous one, which is the same fault line arriving at an object.',
    andWhyNobodyLetsOneGrowOld:
        'Falls out of the first two rather than being a rule. Everybody has a reason to take one early and a much larger reason not to, and the gap between those two reasons is the whole of why anything at that rung is rare.'
} as const;


/**
 * What it is inclined to do about people.
 *
 * ── THE SAME AXIS THE HOUSES STAND ON, AND DELIBERATELY NOT A NEW ONE ────
 *
 * `SectAlignment` - righteous, neutral, demonic - and it is the field a sect
 * row already carries, read by the code that already reads it. A second enum
 * beside it saying friendly/neutral/hostile would be a parallel catalog for the
 * same question, which is the mistake this repo has to undo most often.
 *
 * The axis is the one `demonic-sects-and-what-they-are-willing-to-do.ts` states
 * for the houses, and it is a property of the arrangement rather than of
 * anybody's intent:
 *
 * > **Who pays, and did they agree.**
 *
 *   righteous  Takes nothing from anybody who did not agree, and generally
 *              gives: the ground it holds is better for the people under it
 *              than ground without it. The White Ape charges passage in salt
 *              and in news and has kept every arrangement it made for a
 *              hundred and forty years, which is the whole of the definition.
 *   neutral    Takes what it needs and would take it from you if you were
 *              between it and the thing. Most of the world. A vein drunk dry
 *              is a property question and a real one; it is not predation.
 *   demonic    Takes from people who did not agree and cannot appeal. The
 *              Core-Taker waits for the second day of a seclusion and leaves
 *              the pouch on the belt, which is the same row the Still Blade Pavilion
 *              occupies among the houses: a third party who is not present.
 *
 * ── ORTHOGONAL TO THE RUNG, AND ORTHOGONAL TO `nature` ──────────────────
 *
 * Three axes, and each answers a different question. `ordinal` is how bad it
 * would be; `nature` is what shape the problem takes; this is what it is
 * inclined to do about people. A demonic thing at ordinal 13 and a righteous
 * thing at ordinal 31 are both in this catalog, and neither reading predicts
 * the other.
 *
 * ── AND HUNTING IS NEVER GATED BY IT ────────────────────────────────────
 *
 * **Anything here can be hunted, the righteous ones included.** Nothing in this
 * catalog or in `hunting-a-spirit-beast.ts` refuses a killing on the strength
 * of this field, and adding such a refusal would be the banning AGENTS.md
 * forbids. What the field decides is what the kill COSTS afterwards, and only
 * where somebody found out - which is
 * `src/engine/world/who-answers-for-a-beast-that-was-killed.ts`, and which is
 * the ordinary deed machinery rather than anything written for beasts.
 *
 * ── IT IS ONLY ANSWERABLE ABOVE THE COUNTED LINE ────────────────────────
 *
 * Below `BEAST_CORE_ORDINAL` a hunt returns an amount rather than an
 * individual - the same rule `items.md` applies to a bowl of millet, applied to
 * living things - so there is no particular animal for anybody to have had a
 * view about, and killing one is not a reputational event. The field is still
 * authored on every row, because an inclination is a fact about a species
 * whether or not any individual of it is tracked, and below the line it colours
 * what the ground is like to walk through and nothing more.
 *
 * The tracked band is where it bites, and that is where the interesting case
 * lives: something with a core worth more than most people earn, that has never
 * taken anything from anybody.
 */
export const BeastDispositionSchema = SectAlignmentSchema;
export type BeastDisposition = SectAlignment;

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
    /**
     * What it is inclined to do about people, on the houses' own axis.
     *
     * Read the block above `BeastDispositionSchema` before assigning one. It is
     * not a threat level and it is not a rung: it is who pays and whether they
     * agreed.
     */
    disposition: BeastDispositionSchema,
    /** Realm ordinal. The only measure of danger this catalog carries. */
    ordinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** Same biome vocabulary the herb catalog uses, so ground resolves once. */
    biome: HerbBiomeSchema,
    /**
     * What it is made of, on the same seven the spirit roots and the manuals
     * use. Null for the animals that are not made of anything in particular.
     *
     * HARDCODED BY SPECIES, AND NOTHING ROLLS IT. A fox is fire the way a fox
     * has four legs: 火狐, 雷鹏, 玄武. The design owner's ruling, and it is the
     * repo's own rule against inventing a system where a fact will do.
     *
     * NOT `ability.kind`, which is a capability axis - defence, movement,
     * breath - and answers a different question. The Reader's ability is
     * `breath` and its element is fire; the two are orthogonal and a reader
     * that collapses them will report a tortoise as having no element because
     * its ability is `defence`.
     *
     * NOTHING MAY BRANCH ON WHICH ELEMENT THIS IS. It exists to be compared
     * against a house's, which `house-elemental-character.ts` derives off that
     * house's manuals. An `element === 'fire'` anywhere is a defect.
     */
    element: ElementSchema.nullable(),
    persistence: BeastPersistenceSchema,
    veinRelation: VeinRelationSchema,
    /** Typical number encountered together. One means solitary. */
    groupSize: z.number().int().min(1),
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
     * What one of these is like in company once it has crossed. Manner only.
     *
     * A fox is seductive, a tortoise is blunt, a weasel wheedles. The folk
     * zoology this world's animals come out of gives every kind a temperament,
     * and a changed beast that behaves like nothing in particular is a person
     * carrying a species for no reason.
     *
     * NEVER ANATOMY AND NEVER EVIDENCE. The body is correct and looking harder
     * does not help - `WHAT_GIVES_A_CHANGED_BEAST_AWAY` states that and this
     * field does not reopen it. A manner proves nothing either: the province
     * is full of blunt men, and what actually catches one is the missing
     * reference for ordinary life, which is missing whatever the species.
     *
     * Authored on every row rather than on the six standing at the change,
     * because it is a fact about the kind and any of them has the road open.
     */
    changedManner: z.string().min(30),
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
        `Below ordinal ${BEAST_CHANGE_ORDINAL} the body is the whole of them. No nascent soul leaves, no seam regrows, and nothing comes back, and a beast that is killed is finished - a simplicity neither human tradition has, and the reason the culling trade works at all. Past the change none of that holds, because what is standing there is a person: it dies exactly the way anybody at its rung dies, soul and all, and anybody who takes the body for the ending will find out otherwise. Measured by playing rather than asserted - a confrontation with the Reader at Burnt Earth returns the ordinary nascent soul survival path, because the resolver is reading a rung and does not care what shape is standing on it.`,
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
        'Whether it has a shape or a voice, which puts a hard floor of Void Tribulation under it and admits of no argument. Almost nobody who reports one has actually seen one.'
    ],
    standardError:
        'Reading it a rank low, from size or from an old district survey. Culling notices are written from surveys and surveys are not redrawn when a beast has a good century, so the price on the notice is the price for what used to be there.',
    whoGetsItRight:
        'Bountiful Sheaf Sect, herb gatherers on guarded ground, and anybody who has been paid per head for long enough to have stopped guessing. Sect disciples are the worst at it, because they have never had to be right about it alone.'
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
// Grouped by nature, and by ordinal inside a group - the only ordering that
// means anything here. Each group runs its original rows in that order and
// then the rows added to give every province a ladder, in that order again,
// because the file is read by several people at once and a re-sort touching
// every row is a merge conflict with nothing in it for a reader.
// ─────────────────────────────────────────────────────────────────────────

export const BEASTS: readonly Beast[] = [
    // ═══════════════════════════════════════════════════════════════════
    // ORDINARY - animals with a little qi in them. The whole bottom of
    // the trade, and what a poor province has instead of monsters.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-stubble-hare',
        name: 'Grass Rabbit',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 0,
        biome: 'farmland',
        element: null,
        persistence: 'thin_remnant',
        veinRelation: 'indifferent',
        groupSize: 6,
        frequency: 300,
        ability: {
            name: 'Bolt',
            kind: 'movement',
            what:
                'Covers ground in a straight line faster than anything its size has any business covering it, and changes direction without slowing.'
        },
        hard: 'Nothing about it is hard. It is here because a district with nothing better than this is a district with a ceiling, and the culling ledger says so in numbers.',
        materialIds: ['mat-hare-pelt'],
        note: 'Grey, fast, and faintly warm to hold. Two generations ago the district record was twice this size, and nobody has drawn the obvious conclusion out loud.',
        changedManner: 'Agrees with whoever spoke last, leaves a room the moment a voice rises in it, and is three streets away before anybody has noticed it went.'
    },
    {
        id: 'beast-ironhide-boar',
        name: 'Ironhide Boar',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 5,
        biome: 'forest',
        element: 'metal',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 140,
        ability: {
            name: 'Ironhide',
            kind: 'defence',
            what:
                'The hide turns an edge rather than resisting it, so a cut that should open it slides off along the grain instead.'
        },
        hard: 'It does not stop when hurt and it does not turn. A cultivator who has only fought people expects a fight to have a middle, and this one has a beginning and an end.',
        materialIds: ['mat-boar-hide', 'mat-boar-tusk'],
        note: 'Roots up herb ground for the qi in the roots, which is why gatherers and cullers are frequently the same person.',
        changedManner: 'Obstinate. Once it has said what it will do it does that and nothing adjacent to it, and a change of plan has to be argued from the beginning as though the first one had never happened.'
    },
    {
        id: 'beast-cave-drain-bat',
        name: 'Qi-Devouring Bat',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 6,
        biome: 'cave',
        element: null,
        persistence: 'open_world',
        veinRelation: 'follows',
        groupSize: 400,
        frequency: 120,
        ability: {
            name: 'Qi Draw',
            kind: 'endurance',
            what:
                'Takes qi rather than blood, out of the air and out of whoever is standing in it, and does not need to touch anybody to do it.'
        },
        hard: 'Individually beneath notice, and they take qi rather than blood. A cultivator fights them at full strength for two minutes and at nothing for the rest of it.',
        materialIds: ['mat-drain-bat-membrane'],
        note: 'Roost wherever the rock is richest, so a colony is a survey result. Prospectors follow them and do not mention it at the assay house.',
        changedManner: 'Talks over people without noticing, and keeps talking while somebody else is talking, because a roost is nine hundred voices at once and silence is where it stops being able to tell where anything is.'
    },
    {
        id: 'beast-blind-cave-fish',
        name: 'Blind Grotto Fish',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 1,
        biome: 'cave',
        element: 'water',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 12,
        frequency: 150,
        ability: {
            name: 'Reads the Water',
            kind: 'perception',
            what:
                'Knows the shape of a flooded chamber and everything moving in it from what the water does, and is not inconvenienced by the dark at all.'
        },
        hard: 'Nothing. It is in the catalog because a flooded gallery with nothing in it but these is a gallery nothing has drawn on, and a grant clerk prices a face off exactly that.',
        materialIds: ['mat-cave-fish-oil'],
        note: 'White and eyeless, in still water a long way in. Rendered by the jar into a lamp oil that burns without smoke, which is what makes deep carving possible at all.',
        changedManner: 'Answers a beat late and correctly, having listened to the whole room rather than to the sentence, which reads as slowness until it turns out not to have been.'
    },
    {
        id: 'beast-ringed-pheasant',
        name: 'Ringed Pheasant',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 1,
        biome: 'forest',
        element: null,
        persistence: 'thin_remnant',
        veinRelation: 'indifferent',
        groupSize: 5,
        frequency: 250,
        ability: {
            name: 'Standing Flush',
            kind: 'movement',
            what:
                'Leaves the ground straight up out of cover with no run and no warning, and is above the canopy before anything below it has turned.'
        },
        hard: 'Nothing, and that is the entry. The district record has the cock birds at two catties heavier a century ago and the clerks have gone on weighing them without once writing the trend down.',
        materialIds: ['mat-pheasant-tail'],
        note: 'Snared by children and sold at the gate by the pair. The long tail feathers go to the opera troupes and are worth more than the bird.',
        changedManner: 'Dresses above its station and will not be seen in the same coat twice, and takes an insult to the coat as an insult to the person in it.'
    },
    {
        id: 'beast-night-cat',
        name: 'Dusk Cat',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 3,
        biome: 'deep_forest',
        element: null,
        persistence: 'thin_remnant',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 145,
        ability: {
            name: 'Moonless Eye',
            kind: 'perception',
            what:
                'Sees in what a person would call no light at all, and sees colour in it, which is why nothing it hunts has ever learned to hide by going still.'
        },
        hard: 'It is not hard and it is not worth the trip. Two of them a night was the old rate for a snare line and the current rate is two a week, on the same line, set by the same family.',
        materialIds: ['mat-night-cat-pelt'],
        note: 'Spotted, knee-high, and taken for the winter pelt. The trade is the only thing keeping four households in the deep valley in salt.',
        changedManner: 'Comes and goes without announcing either, sits where it can see the door, and gives no sign at all of having been fond of anybody until it turns up the one time it matters.'
    },
    {
        id: 'beast-reed-heron',
        name: 'Reed Heron',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 4,
        biome: 'marsh',
        element: 'water',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 2,
        frequency: 140,
        ability: {
            name: 'Held Still',
            kind: 'concealment',
            what:
                'Holds a position without moving for as long as the wait takes, including the breathing, so that nothing watching the reeds resolves it as an animal at all.'
        },
        hard: 'It is not dangerous. It is protected in three districts by a plume tax nobody enforces, which means the only people taking them are the ones who cannot afford the fine.',
        materialIds: ['mat-heron-plume'],
        note: 'Drops the breeding plumes in one week of the year and the gatherers camp for it. A hat with four of them on says what the wearer earns without a word.',
        changedManner: 'Waits out a conversation. Will let a silence run past the point anybody else can stand it, and then says the one sentence it came to say.'
    },
    {
        id: 'beast-pine-marten',
        name: 'Pine Marten',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 6,
        biome: 'mountain',
        element: 'wood',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 2,
        frequency: 115,
        ability: {
            name: 'Up the Bark',
            kind: 'movement',
            what:
                'Goes up a trunk or a wall face as fast as it crosses level ground, and turns on it, so height is not a way out of a room it is in.'
        },
        hard: 'Nothing about the animal. The winter pelt is worth a month of ordinary work and the trap line runs through the sect boundary, which is where the trouble comes from.',
        materialIds: ['mat-marten-pelt'],
        note: 'Taken in the cold months on the high slopes. Two houses have a standing dispute over which of them the north line is on and neither will put it to a Dao house.',
        changedManner: 'Cannot sit still and cannot be in a room without handling what is in it, and has usually pocketed something small before anybody has finished the greeting.'
    },
    {
        id: 'beast-honey-bear',
        name: 'Honey Bruin',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 12,
        biome: 'forest',
        element: 'earth',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 50,
        ability: {
            name: 'Shoulder In',
            kind: 'strength',
            what:
                'Puts its whole weight through one shoulder and keeps it there, so a door, a hive or a formation post comes apart at the fixing rather than at the face.'
        },
        hard: 'It does not want a fight and it does not leave one either, and it can take the first exchange off a Qi Condensation cultivator standing still. Most deaths are from the second decision, not the first.',
        materialIds: ['mat-bear-gall'],
        note: 'Raids the hives above the villages every autumn and the villages pay a culler rather than lose the crop. The gall is worth four times the rest of the animal.',
        changedManner: 'Unhurried to the point of rudeness, eats first and talks after, and will simply not be moved once it has decided where it is sitting.'
    },
    {
        id: 'beast-tusked-deer',
        name: 'Tusked Deer',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 13,
        biome: 'riverbank',
        element: 'wood',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 4,
        frequency: 44,
        ability: {
            name: 'Wind-Wise',
            kind: 'concealment',
            what:
                'Stays downwind of whatever is looking for it for as long as the search lasts, moving when the wind moves, which is why a line of beaters never finds one twice.'
        },
        hard: 'Nothing in a fight. It is hard to be within a hundred paces of on purpose, and every alchemist in the province wants the gland, so the price is set by how many days it takes rather than by any danger.',
        materialIds: ['mat-deer-musk'],
        note: 'Small, tusked rather than antlered, and the reason four riverbank villages keep dogs they cannot otherwise afford to feed.',
        changedManner: 'Nervy in a crowd and steadier alone, keeps its back to a wall, and leaves a room the moment the conversation turns to where it lives.'
    },
    {
        id: 'beast-rock-mole',
        name: 'Rock Mole',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 14,
        biome: 'cave',
        element: 'earth',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 34,
        ability: {
            name: 'Reads the Face',
            kind: 'perception',
            what:
                'Knows where a rock face is thin, where it is holding, and where the water behind it is, from the other side of the stone and without touching it.'
        },
        hard: 'It comes through a working face into an occupied gallery, which is a fight in the dark in a space nobody can swing in. The carvers lose two a year to them and price the grant accordingly.',
        materialIds: ['mat-mole-claw'],
        note: 'Every carver in the Buddha Precipice would rather follow one than a surveyor, and every grant ledger says a face is opened on the survey.',
        changedManner: 'Blunt about what will not work and vague about everything else, and says the wall is bad without ever explaining how it knows.'
    },
    {
        id: 'beast-cloud-crane',
        name: 'Cloud Crane',
        nature: 'ordinary',
        // Takes nothing from anybody and is generally where somebody is about
        // to need it seen. Righteous on the axis is not gentleness: it is that
        // nobody who did not agree has ever paid it anything.
        disposition: 'righteous',
        ordinal: 15,
        biome: 'high_peak',
        element: 'wood',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 3,
        frequency: 30,
        ability: {
            name: 'Long Glide',
            kind: 'movement',
            what:
                'Crosses a range on one column of rising air without a wingbeat, so distance costs it nothing and weather decides its route rather than its speed.'
        },
        hard: 'Nothing wants to fight one and one has never started anything. What is hard is reaching a nest site at all: they are on ledges above the last water, and two parties a decade go up for the feathers and come back short.',
        materialIds: ['mat-crane-feather'],
        note: 'Paired for life and dated by the households below them, some of which have been watching the same ledge for three generations.',
        changedManner: 'Ceremonious. Will not be hurried through a greeting, treats a rushed one as a slight, and is visibly counting how long since anybody last asked after its house.'
    },
    {
        id: 'beast-iron-eating-bear',
        name: 'Iron-Eating Beast',
        nature: 'ordinary',
        disposition: 'neutral',
        ordinal: 16,
        biome: 'bamboo_sea',
        element: 'metal',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 20,
        ability: {
            name: 'Iron Chew',
            kind: 'strength',
            what:
                'Takes worked metal apart with its jaws and eats it, so a blade held against it is spent stock and a formation post is a meal that was left out.'
        },
        hard: 'It is not hunting anybody. It wants what the party brought, so a fight it did not start ends with the swords gone and the party four days from the nearest smith.',
        materialIds: ['mat-iron-bear-tooth'],
        note: 'Eats bamboo for eleven months and cooking pots for the twelfth. Villages in the bamboo bury the iron in that month and have done for longer than anyone can say why.',
        changedManner: 'Asks for things outright, in company, without the approach anybody else would make first, and takes a refusal without any sign of having minded.'
    },

    {
        // ── THE ASHFALL BASIN, WHICH HAD NOTHING ON IT UNTIL NOW ──────
        // `prefecture-ashfall` was authored with the political layer and
        // its `places[]` stayed empty, so `volcanic` was a biome in the
        // herb vocabulary that no square in the world declared. The map
        // has three volcanic rows now and this catalog has four kinds
        // standing on them, spread from a rat a beginner can take to
        // something that holds the seam under all three.
        id: 'beast-ember-crane',
        name: 'Ember Crane',
        nature: 'ordinary',
        // It has never taken anything from anybody and the villages under
        // the flank have had two hundred years of free warning off it.
        disposition: 'righteous',
        ordinal: 6,
        biome: 'volcanic',
        element: 'fire',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 60,
        ability: {
            name: 'Sees the Blaze Coming',
            kind: 'perception',
            what:
                'Knows which ground is going to burn about a day before it does, and is standing somewhere else well before it happens.'
        },
        hard: 'It is gone before a party arrives and it is gone because it knew they were coming, so taking one is the problem of arriving unannounced on ground that announces everybody. Nobody has managed it twice on the same flank.',
        materialIds: ['mat-ember-crane-plume'],
        note: 'The settlements under the flank move their stock when one goes up, and the two that stopped doing it lost a season each to the fall before they started again.',
        changedManner: 'Leaves early, every time, and says on the way out exactly why - which is taken for rudeness right up until the reason arrives.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // HERDS - what a tide is made of, and what makes a vein crowded
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-grey-wolf-pack',
        name: 'Grey Spirit Wolf',
        nature: 'herd',
        disposition: 'demonic',
        ordinal: 3,
        biome: 'forest',
        element: null,
        persistence: 'open_world',
        veinRelation: 'follows',
        groupSize: 9,
        frequency: 200,
        ability: {
            name: 'Troop Sense',
            kind: 'perception',
            what:
                'What one of them has seen, all of them have seen, without a sound passing between them and without a line of sight.'
        },
        hard: 'They do not scatter when one falls, and they have learned which of a party is the alchemist. A pack that has hunted cultivators before is a different animal from one that has not.',
        materialIds: ['mat-wolf-sinew'],
        note: 'The commonest paid work in the province and the commonest way a Qi Condensation cultivator dies at twenty-six.',
        changedManner: 'Works out who in a room is owed deference and gives it exactly, and will not conduct any business at all with somebody it has placed below itself.'
    },
    {
        id: 'beast-vein-deer',
        name: 'Vein Deer',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 8,
        biome: 'spirit_vein',
        element: 'wood',
        persistence: 'vein_only',
        veinRelation: 'drains',
        groupSize: 30,
        frequency: 70,
        ability: {
            name: 'Vein Sense',
            kind: 'perception',
            what:
                'Knows where the ground is richest across a whole district and moves to it, months before a survey could say the same thing.'
        },
        hard: 'They are not dangerous and they are not the problem. A herd of thirty on a vein draws it down like thirty disciples would, and a sect that culls them is doing arithmetic rather than pest control.',
        materialIds: ['mat-vein-deer-antler'],
        note: 'Move to whichever holding is richest and are counted, every season, by people who will not say what they are counting.',
        changedManner: 'Knows which house is doing well this year and says so, and has moved on to the next one before the reason it gave has stopped being true.'
    },
    {
        id: 'beast-stone-ox',
        name: 'Stone Ox',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 11,
        biome: 'mountain',
        element: 'earth',
        persistence: 'thin_remnant',
        veinRelation: 'follows',
        groupSize: 20,
        frequency: 55,
        ability: {
            name: 'Immovable',
            kind: 'strength',
            what:
                'Cannot be shifted, turned, lifted or knocked down by force applied from outside, whatever the force is or where it comes from.'
        },
        hard: 'Nothing individually. Twenty of them moving in one direction is a landscape event, and the villages between are not a consideration to them.',
        materialIds: ['mat-ox-horn'],
        note: 'Placid for decades and then, once, not. Buddha Precipice herds are half the size of the ones in the old Jade Gorge surveys and about as heavy, which nobody has explained.',
        changedManner: 'Literal. Answers the question that was asked and not the one that was meant, and does the thing it agreed to do exactly, including the part everybody assumed was a figure of speech.'
    },
    {
        id: 'beast-grain-sparrow',
        name: 'Stubble Sparrow',
        nature: 'herd',
        // Takes from people who did not agree and cannot appeal, which is the
        // definition and has nothing to do with how frightening it is. A
        // demonic thing at ordinal 1 is the clearest statement the axis makes.
        disposition: 'demonic',
        ordinal: 1,
        biome: 'farmland',
        element: null,
        persistence: 'thin_remnant',
        veinRelation: 'follows',
        groupSize: 300,
        frequency: 280,
        ability: {
            name: 'One Turn Ahead',
            kind: 'perception',
            what:
                'The flock lifts before the person raising the pole has finished deciding to raise it, and comes down again the moment the decision is abandoned.'
        },
        hard: 'Nothing, unless the crop is the thing being defended. A district that loses a fifth of the grain every autumn has lost the argument about whether this is a beast problem or a tax problem.',
        materialIds: ['mat-sparrow-down'],
        note: 'Netted by the sackful at harvest and eaten by the household doing the netting. The sect tithe is assessed before the birds arrive, which is the whole of the complaint.',
        changedManner: 'Cannot be alone. Attaches to whichever group is nearest within an hour of arriving, repeats its opinions, and has no opinion that did not come out of that group.'
    },
    {
        id: 'beast-dune-jerboa',
        name: 'Dune Jerboa',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 2,
        biome: 'desert',
        element: null,
        persistence: 'thin_remnant',
        veinRelation: 'indifferent',
        groupSize: 20,
        frequency: 200,
        ability: {
            name: 'Standing Jump',
            kind: 'movement',
            what:
                'Leaves the ground from stillness and lands going the other way, over and over, so nothing following a line of tracks is following anything.'
        },
        hard: 'Nothing, and the Burial Sands has little else at this rung. A culling contract written for these pays in salt because the district has no stones to pay in.',
        materialIds: ['mat-jerboa-pelt'],
        note: 'Dug out of the cool sand in daylight by children with sticks, which is the whole of the trade and most of the meat in three settlements.',
        changedManner: 'Changes the subject twice in a sentence and moves seat mid-conversation, and is genuinely surprised that anybody found this difficult to follow.'
    },
    {
        id: 'beast-burn-crow',
        name: 'Scorch Crow',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 2,
        biome: 'battlefield',
        element: null,
        persistence: 'open_world',
        veinRelation: 'follows',
        groupSize: 60,
        frequency: 230,
        ability: {
            name: 'Early Arrival',
            kind: 'perception',
            what:
                'Is already sitting on the right ground before the fighting starts, and moves to the next ground before the fighting there has been decided on either.'
        },
        hard: 'Nothing, and the birds are not the finding. A column that sees them settling on a ridge ahead is being told something by an animal that has been right about it for a hundred and forty years.',
        materialIds: ['mat-crow-quill'],
        note: 'Two pickers work the burn edge behind them for whatever the birds turn up, and pay the Six Li Patrol a share for being allowed to.',
        changedManner: 'Tells people bad news before anybody has asked for it, accurately, and is confused by being disliked for it.'
    },
    {
        id: 'beast-verge-magpie',
        name: 'Verge Magpie',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 4,
        biome: 'roadside',
        element: null,
        persistence: 'open_world',
        veinRelation: 'follows',
        groupSize: 12,
        frequency: 210,
        ability: {
            name: 'Carried Voice',
            kind: 'perception',
            what:
                'Gives back a sound it heard days ago and a long way off, exactly, including a voice, and does it without any idea of what it is repeating.'
        },
        hard: 'Nothing. What is hard is that a courier who says something at a post house has said it to whatever is on the roof, and one confession in the prefecture records was worked back to exactly that.',
        materialIds: ['mat-magpie-tail'],
        note: 'Follows carts for the spill and is counted lucky for it. Nobody has proposed removing them from the post road and nobody could.',
        changedManner: 'Repeats what it heard elsewhere, to whoever is in front of it, without weighing whether either party wanted the other to know.'
    },
    {
        id: 'beast-frost-marmot',
        name: 'Frost Marmot',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 4,
        biome: 'glacier',
        element: 'ice',
        persistence: 'thin_remnant',
        veinRelation: 'indifferent',
        groupSize: 25,
        frequency: 160,
        ability: {
            name: 'Winter Sleep',
            kind: 'endurance',
            what:
                'Stops, entirely, for as long as the cold lasts, and starts again from exactly where it stopped with nothing owed for the interval.'
        },
        hard: 'Nothing. The old White Stair records have colonies on ledges that are bare ice now, and the Court has never published the comparison.',
        materialIds: ['mat-marmot-fat'],
        note: 'Dug out of the scree at the end of the cold and rendered for lamp fat and for the salve every ice-field household keeps by the door.',
        changedManner: 'Goes quiet for a season at a time, returns without explaining the absence, and picks the conversation up at the sentence it left.'
    },
    {
        id: 'beast-cliff-goat',
        name: 'Cliff Goat',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 5,
        biome: 'high_peak',
        element: 'earth',
        persistence: 'thin_remnant',
        veinRelation: 'indifferent',
        groupSize: 10,
        frequency: 120,
        ability: {
            name: 'Hoof on Nothing',
            kind: 'movement',
            what:
                'Stands and turns on rock too small to be called a ledge, at any angle, carrying weight, which is why a herd is above the last route and not on it.'
        },
        hard: 'Nothing about the animal. Everything about where it is standing, which is why the province prices a goat at four times a hare and nobody argues.',
        materialIds: ['mat-cliff-goat-horn'],
        note: 'The only meat above the tree line and the reason the high hamlets exist at all. Taken with a bow from below, because nothing goes up after one.',
        changedManner: 'Contrary on principle, takes the other side of whatever was just said, and holds it long after being shown to be wrong about it.'
    },
    {
        id: 'beast-paper-moth',
        name: 'Paper Weevil',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 6,
        biome: 'ruins',
        element: null,
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 150,
        frequency: 100,
        ability: {
            name: 'Lives On Ink',
            kind: 'endurance',
            what:
                'Eats worked paper and the ink on it and needs nothing else, so a sealed room full of records is a full larder and a closed door is not an obstacle.'
        },
        hard: 'Nothing to fight. A house that loses a shelf to these has lost the copies and not the art, which is the difference between an expensive year and a transmission ending.',
        materialIds: ['mat-moth-dust'],
        note: 'The reason a copyist is a standing post rather than a task, and the reason an archive is cold, dry, and checked by somebody every month.',
        changedManner: 'Quotes. Has whole passages by heart, deploys them instead of an answer, and gets visibly unmoored when asked what it thinks rather than what the page said.'
    },
    {
        id: 'beast-spoil-rat',
        name: 'Spoil Rat',
        nature: 'herd',
        disposition: 'demonic',
        ordinal: 6,
        biome: 'battlefield',
        element: null,
        persistence: 'thin_remnant',
        veinRelation: 'indifferent',
        groupSize: 200,
        frequency: 170,
        ability: {
            name: 'Nothing Wasted',
            kind: 'endurance',
            what:
                'Lives on what nothing else will touch, including the parts of a field that have been picked over twice, and breeds on exactly that.'
        },
        hard: 'Individually nothing. Two hundred of them go through a grain store, a casualty tent or a picket line in a night, and the Iron Crest ledger records the cost as spoilage every year without a second line.',
        materialIds: ['mat-spoil-rat-pelt'],
        note: 'Sold by weight to the glue-boilers at a rate that has not moved in a generation, and the boilers say the animals are smaller.',
        changedManner: 'Keeps count of everything, including what it is owed and what it has lent, and produces the figure years later to the day.'
    },
    {
        id: 'beast-stone-swift',
        name: 'Stone Swift',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 6,
        biome: 'sky_island',
        element: null,
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 80,
        frequency: 70,
        ability: {
            name: 'Off the Underside',
            kind: 'movement',
            what:
                'Lives in the air and on the underside of overhanging rock, and does not come to ground at all, so there is nowhere to wait for one.'
        },
        hard: 'Nothing, and everything about the nest. The colony is on the underside of the floating stone and the men who go for it go on the tether, which is inspected once a year by people who cannot repair it.',
        materialIds: ['mat-swift-nest'],
        note: 'The nests are built of the birds themselves and are worth more than the weight in silver at any pill hall in the province.',
        changedManner: 'Will not sit down. Conducts the whole of its business standing, near a door, and leaves before the meal it was invited to arrives.'
    },
    {
        id: 'beast-gate-carp',
        name: 'Gate Carp',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 7,
        biome: 'riverbank',
        element: 'water',
        persistence: 'open_world',
        veinRelation: 'follows',
        groupSize: 40,
        frequency: 90,
        ability: {
            name: 'Against the Fall',
            kind: 'movement',
            what:
                'Goes up water that is coming down, including a fall, and keeps going up it for as long as the water lasts.'
        },
        hard: 'Nothing. A run arriving at a mill race is a week of free food for a village and a week of nobody grinding anything, and the miller is never the one who gets to decide.',
        materialIds: ['mat-carp-scale'],
        note: 'Runs the falls in the fourth month. The story that one that finishes the climb becomes something else is told at every fall in the province and has never once been witnessed.',
        changedManner: 'Will not let a thing go. Comes back to the same refused request a year later, then again, with no apparent memory of having been embarrassed the first time.'
    },
    {
        id: 'beast-blood-sweat-horse',
        name: 'Blood-Lather Horse',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 9,
        biome: 'desert',
        element: 'fire',
        persistence: 'thin_remnant',
        veinRelation: 'follows',
        groupSize: 14,
        frequency: 60,
        ability: {
            name: 'Never Blown',
            kind: 'endurance',
            what:
                'Runs the whole day out at one pace and is fit to do it again in the morning, on water a mule would not finish the afternoon on.'
        },
        hard: 'Catching one. Nothing in the Burial Sands can run a band down, so they are taken at water or not at all, and a caught one is worth more than the party that caught it earns in a decade.',
        materialIds: ['mat-red-sweat'],
        note: 'Sweats red on the shoulder under work, which the caravan masters read as a grade and the alchemists buy by the flask.',
        changedManner: 'Restless in a settlement and will not stay anywhere past a season, and treats an invitation to settle as a thing to be forgiven rather than refused.'
    },
    {
        id: 'beast-mire-buffalo',
        name: 'Marsh Buffalo',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 15,
        biome: 'marsh',
        element: 'earth',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 12,
        frequency: 30,
        ability: {
            name: 'Keeps Its Feet',
            kind: 'strength',
            what:
                'Stands and fights on ground that will not hold anything else, and takes the footing away from whatever came out to meet it there.'
        },
        hard: 'It has to be fought where it lives, which is where nobody else can stand, and a party that draws one onto firm ground has spent longer arranging that than the fight is worth.',
        materialIds: ['mat-buffalo-horn'],
        note: 'Herded rather than hunted by two marsh clans who will not say how, and sold on at the Pearl Ocean ports as though it had been taken wild.',
        changedManner: 'Says little, agrees to less, and once it has agreed cannot be talked out of it by anybody, including the person who talked it in.'
    },
    {
        id: 'beast-gold-cicada',
        name: 'Gold Cicada',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 15,
        biome: 'spirit_vein',
        element: 'metal',
        persistence: 'vein_only',
        veinRelation: 'drains',
        groupSize: 40,
        frequency: 40,
        ability: {
            name: 'Left Husk',
            kind: 'concealment',
            what:
                'Comes out of its own shell whole and leaves the shell standing where it was, so what anybody is holding, watching or has just struck is the part it had finished with.'
        },
        hard: 'Forty of them sit on a vein for seventeen years doing nothing and drawing the whole time, and a holding that cuts them out finds the ground still short until the brood underground comes up.',
        materialIds: ['mat-cicada-shell'],
        note: 'The shells are gathered off the trunks in one week of the year, whole and empty and still gripping the bark, and every pill hall in the province buys them.',
        changedManner: 'Gives a name and a trade and both turn out later to have been left behind somewhere, intact, with nobody in them.'
    },

    {
        id: 'beast-cinder-rat',
        name: 'Cinder Rat',
        nature: 'herd',
        disposition: 'neutral',
        ordinal: 2,
        biome: 'volcanic',
        element: 'fire',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 30,
        frequency: 130,
        ability: {
            name: 'Unburnt',
            kind: 'endurance',
            what:
                'Beds in cinder still hot enough to fire a pot and takes nothing from it, so there is no part of a burning flank it cannot cross and wait on.'
        },
        hard: 'Nothing a party can do to it is worse than where it already lives, so it goes back into the hot cinder and waits them out. What ends an infestation is the cinder cooling, which is a matter for the mountain rather than for anybody holding a sword.',
        materialIds: ['mat-cinder-rat-fleece'],
        note: 'The fleece is woven into a cloth that is laundered by being put in the fire, and the Ashen Anvil Clan has hung its gate with the same four panels for two hundred years.',
        changedManner: 'Will not be the only one in a room if it can be helped, defers to whoever else is there from habit, and agrees with anything said loudly before working out whether it does.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // AMBUSH - these hunt cultivators specifically, because a cultivator
    // is worth more than a deer and carries it in one place
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-mist-serpent',
        name: 'Mist Serpent',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 10,
        biome: 'marsh',
        element: 'water',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 60,
        ability: {
            name: 'Venom Breath',
            kind: 'breath',
            what:
                'Breathes a poison that hangs where it was breathed, so the ground of a fight stays dangerous long after the fight has finished.'
        },
        hard: 'Its breath is poison and it lingers where the fight was. Winning is routine; leaving the ground afterwards is what the pills are for.',
        materialIds: ['mat-serpent-gland'],
        note: 'Dens near roads rather than in deep marsh, because the roads are where people are.',
        changedManner: 'Devoted, to one person, out of all proportion to what passed between them, and the person is usually somebody who did it a small kindness a long time ago.'
    },
    {
        id: 'beast-core-taker',
        name: 'Core-Taker',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 13,
        biome: 'deep_forest',
        element: null,
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 30,
        ability: {
            name: 'Silence',
            kind: 'concealment',
            what:
                'Makes no sound and leaves no trace on qi, so nothing that reads a room reads it, and it is never where anybody watching believes it is.'
        },
        hard: 'It hunts cultivators and only cultivators, waits for the second day of a seclusion, and takes the core and nothing else. Every mortal in the district is safe and knows it, which is why no village will help.',
        materialIds: ['mat-core-taker-jaw'],
        note: 'Bodies are found unrobbed with the pouch still on the belt. Sects read that as a demonic cultivator for about a season, and then the fourth body arrives.',
        changedManner: 'Asks what a person is carrying and what rung they are on, early, in an ordinary voice, and has no small talk to put it in.'
    },
    {
        id: 'beast-glacier-lynx',
        name: 'Glacier Lynx',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 19,
        biome: 'glacier',
        element: 'ice',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 18,
        ability: {
            name: 'Stone Patience',
            kind: 'concealment',
            what:
                'Holds still against cold ground until it is not distinguishable from the ground, for as many days as the waiting takes.'
        },
        hard: 'It follows for days without closing and opens when the party is one member short of full strength. It is counting, and it is counting correctly.',
        materialIds: ['mat-lynx-pelt', 'mat-lynx-core'],
        note: 'The only thing in the ice field that ever hurries, and it does so twice a year.',
        changedManner: 'Patient past the point of comfort. Lets a negotiation run for months, says nothing new in any of it, and closes on the day the other side is shortest of time.'
    },
    {
        id: 'beast-bamboo-viper',
        name: 'Bamboo-Leaf Viper',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 4,
        biome: 'bamboo_sea',
        element: 'wood',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 150,
        ability: {
            name: 'Stem Shade',
            kind: 'concealment',
            what:
                'Is the colour of the standing stem it is on, at any season, and does not move while anything is looking at the stem.'
        },
        hard: 'It is at hand height on a stem somebody is about to push aside. The bite is survivable and the four days after it are the part that ends the trip.',
        materialIds: ['mat-bamboo-viper-fang'],
        note: 'Cutters in the bamboo work in pairs and the second one carries the pills, which is a rule nobody in the trade has to be told twice.',
        changedManner: 'Still and close. Stands nearer than anybody else in the room would, says nothing for long stretches, and is already answering before the question has finished.'
    },
    {
        id: 'beast-yellow-weasel',
        name: 'Yellow Weasel',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 9,
        biome: 'farmland',
        element: 'metal',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 85,
        ability: {
            name: 'Through the Gap',
            kind: 'movement',
            what:
                'Goes through an opening smaller than its own head, at speed, carrying something, so no store, coop or strongbox is shut against it.'
        },
        hard: 'It takes the thing rather than the fight, and it takes the thing a party cannot go on without. A pouch of pills is gone before anybody has drawn, and it is the second night that is the problem.',
        materialIds: ['mat-weasel-tail-hair'],
        note: 'Every village has a household that leaves food out for them and will not be argued with about it, including by the household next door that lost the coop.',
        changedManner: 'Wheedles. Asks for a small thing, gets it, asks for the next one on the strength of the first, and is halfway into the house before anybody has agreed to a visit.'
    },
    {
        id: 'beast-trunk-hound',
        name: 'Trunk Jackal',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 10,
        biome: 'deep_forest',
        element: 'wood',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 62,
        ability: {
            name: 'Out of the Trunk',
            kind: 'concealment',
            what:
                'Lies inside a standing trunk with nothing showing and nothing to read on the qi of it, and comes out of the trunk rather than out of the undergrowth.'
        },
        hard: 'Nobody is watching the tree they are about to fell. Timber parties lose the axeman first, which is the member of a party nobody has armed.',
        materialIds: ['mat-trunk-hound-hide'],
        note: 'Black, tailless, and about the size of a dog. Four timber grants in the deep valley have been let and surrendered twice each in ten years.',
        changedManner: 'Arrives where it was not expected, in the middle of something, and treats the interruption as though it had been invited to that exact moment.'
    },
    {
        id: 'beast-black-eel',
        name: 'Black Eel',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 12,
        biome: 'lake_bottom',
        element: 'water',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 55,
        ability: {
            name: 'Undertow Coil',
            kind: 'strength',
            what:
                'Takes a hold and closes it slowly and does not let go, under water, where the other party is spending something it cannot replace.'
        },
        hard: 'It does not have to win. It has to hold on for as long as a person can hold a breath, and the arithmetic is finished before the fight is.',
        materialIds: ['mat-black-eel-skin'],
        note: 'Works the deep weed off the drop-offs. Net crews cut a line rather than bring one up and price the lost net into the season.',
        changedManner: 'Does not raise its voice and does not let a thing drop, and is still on the same point an hour later in the same tone.'
    },
    {
        id: 'beast-shrine-spider',
        name: 'Shrine Spider',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 13,
        biome: 'ruins',
        element: null,
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 40,
        ability: {
            name: 'Between the Boards',
            kind: 'concealment',
            what:
                'Lives in the gap under a floor or behind a wall panel and takes from underneath, so the room a party cleared is the room it is in.'
        },
        hard: 'It opens after a party has stopped, put the packs down and decided the building is empty. Two of the province refusals to shelter in a ruin overnight are written against this and name it.',
        materialIds: ['mat-shrine-silk'],
        note: 'The silk under the floor of a temple ruin is worth the trip on its own, which is why the buildings keep being entered.',
        changedManner: 'Listens from the edge of a room, contributes nothing, and turns out afterwards to have had every detail and to have been waiting for the useful one.'
    },
    {
        id: 'beast-cart-mantis',
        name: 'Cart Mantis',
        nature: 'ambush',
        disposition: 'neutral',
        ordinal: 14,
        biome: 'roadside',
        element: 'wood',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 34,
        ability: {
            name: 'Raised Arms',
            kind: 'strength',
            what:
                'Puts both hooked arms up against whatever is coming and does not give ground to it, whatever the size of the thing or the number of them.'
        },
        hard: 'It does not run, so a party that opens on one has committed to finishing it, in the road, in front of whoever else is on the road that day.',
        materialIds: ['mat-mantis-blade'],
        note: 'Stands in the cart ruts at chest height with the arms up. Carters go around and the story of the one that did not is told at every post house on the route.',
        changedManner: 'Will not back down from anything, in front of anybody, and cannot tell the difference between a fight worth having and a fight it has been handed.'
    },
    {
        id: 'beast-crevasse-worm',
        name: 'Crevasse Grub',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 16,
        biome: 'glacier',
        element: 'ice',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 24,
        ability: {
            name: 'Under the Blue',
            kind: 'concealment',
            what:
                'Waits directly under clear ice, in plain sight and unrecognisable as anything but more ice, and comes up through it rather than around.'
        },
        hard: 'The ground opens where the party is standing, and it opens under whoever is roped in the middle. Recovering a body from a crevasse costs a day the party does not have at that altitude.',
        materialIds: ['mat-crevasse-chitin'],
        note: 'The White Stair guides walk the long way round three named fields and charge for the extra day without itemising it.',
        changedManner: 'Says nothing for the length of an acquaintance and then says the one thing it has been waiting the whole time to say.'
    },
    {
        id: 'beast-tomb-centipede',
        name: 'Tomb Centipede',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 17,
        biome: 'desert',
        element: 'fire',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 20,
        ability: {
            name: 'Every Claw At Once',
            kind: 'movement',
            what:
                'Crosses a wall, a ceiling or a shaft at the same speed as a floor, and turns a corner without slowing, so there is no direction it is not coming from.'
        },
        hard: 'It is in the shaft the party came down, between them and the surface, and it got there after they passed. Every account of one is written by somebody who went in with more people.',
        materialIds: ['mat-centipede-segment', 'mat-centipede-core'],
        note: 'Grave crews in the Burial Sands work with a second rope and a second way out, and the ones who do not are the ones who have not met one.',
        changedManner: 'Takes offence at a slight nobody else registered and repays it exactly, years later, having said nothing about it in the meantime.'
    },
    {
        id: 'beast-cloud-marked-leopard',
        name: 'Cloud-Spotted Leopard',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 18,
        biome: 'bamboo_sea',
        element: 'wood',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 15,
        ability: {
            name: 'Down the Stem',
            kind: 'movement',
            what:
                'Comes down a standing stem head first at the speed of a fall and stops at the bottom of it, which is why nothing it takes has looked up.'
        },
        hard: 'The bamboo closes over a party at head height, so nobody sees the canopy and nobody can raise a weapon above the shoulder. It takes the rear of a line and the front does not hear it.',
        materialIds: ['mat-leopard-pelt', 'mat-leopard-core'],
        note: 'The pelt is the one bamboo-country good a Jade Gorge house will accept in place of stones, and the cutters price a season by whether one is working their block.',
        changedManner: 'Elegant and unhurried in company and impossible to arrange anything with, because it will agree to a time and simply be somewhere else.'
    },
    {
        id: 'beast-crying-salamander',
        name: 'Crying Salamander',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 20,
        biome: 'lake_bottom',
        element: 'water',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 12,
        ability: {
            name: 'Sounds Like a Child',
            kind: 'concealment',
            what:
                'Makes a sound nothing can hear as an animal, from under the water, and keeps making it for as long as anybody is still coming toward it.'
        },
        hard: 'Nobody arrives at one ready. Everything that reaches it has come at a run, alone, and gone into the water on purpose, and the fight is under the water from the first moment.',
        materialIds: ['mat-salamander-skin', 'mat-salamander-core'],
        note: 'Lake villages teach children the sound before they teach them to swim, and two prefectures have standing orders that no boat goes out for it at night.',
        changedManner: 'Asks for help before it asks for anything else, gets it, and turns out to have been in no difficulty at all.'
    },
    {
        id: 'beast-ink-squid',
        name: 'Ink Squid',
        nature: 'ambush',
        disposition: 'neutral',
        ordinal: 20,
        biome: 'abyss',
        element: 'water',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 9,
        ability: {
            name: 'Own Dark',
            kind: 'concealment',
            what:
                'Puts out a dark that holds where it was put and does not thin, so the fight continues inside a volume nothing can perceive through, itself included.'
        },
        hard: 'It comes up out of water nothing has measured the bottom of, takes what is on the surface, and goes back down. There is no ground to hold and no way to follow it.',
        materialIds: ['mat-squid-ink', 'mat-squid-core'],
        note: 'The deep-water crossings are priced by the season rather than the distance, and the underwriters at the ports will not say what the difference is for.',
        changedManner: 'Gives an account of itself that is complete, plausible and different every time, and does not appear to be keeping track of which one anybody got.'
    },
    {
        id: 'beast-year-beast',
        name: 'Nian Beast',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 21,
        biome: 'farmland',
        element: 'fire',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 9,
        ability: {
            name: 'Through the Byre',
            kind: 'strength',
            what:
                'Goes through a stock wall, a byre and a house front in one line without turning, and what it wanted is behind the third of them.'
        },
        hard: 'It comes once a year, to a settlement, at a date everybody knows, and a party that wants it has to stand in a village street and hold ground it cannot give away.',
        materialIds: ['mat-year-beast-hide', 'mat-year-beast-core'],
        note: 'Villages hang red and beat pans at the turn of the year across four provinces, including in districts that have not seen one in two hundred years and no longer say what it is for.',
        changedManner: 'Turns up in the same place at the same time every year without being asked, expects to be fed, and is offended in a way that lasts if it is not.'
    },
    {
        id: 'beast-sun-eater',
        name: 'Sun-Eater',
        nature: 'ambush',
        disposition: 'demonic',
        ordinal: 23,
        biome: 'sky_island',
        element: 'fire',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 5,
        ability: {
            name: 'Comes Down Burning',
            kind: 'movement',
            what:
                'Arrives from above at the speed of a falling stone and burning, and arrives on the one place in the district it was aiming for.'
        },
        hard: 'It is not on the ground to be found. It chooses the ground and the hour, and the only warning is that the light goes wrong for as long as it takes to say so.',
        materialIds: ['mat-sun-eater-hide', 'mat-sun-eater-core'],
        note: 'The province records a darkening in the year books every few generations and the astronomers and the herders have never once agreed about what was written down.',
        changedManner: 'Eats and drinks everything in front of it, immediately, and asks for the next thing while the table is still being cleared.'
    },

    {
        id: 'beast-sulphur-toad',
        name: 'Sulphur Toad',
        nature: 'ambush',
        // It sits where people have to walk and takes from whoever comes
        // past. Nobody it has ever taken from agreed to it or could appeal.
        disposition: 'demonic',
        ordinal: 9,
        biome: 'volcanic',
        element: 'earth',
        persistence: 'thin_remnant',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 45,
        ability: {
            name: 'Yellow Breath',
            kind: 'breath',
            what:
                'Puts out a gout of the same air the vents put out, about as far as a person can throw a stone, and nothing inside it can go on breathing.'
        },
        hard: 'It sits in a vent mouth where the air is already bad, so a party is short of breath before anything has happened to them. The old surveys record them at twice the present size, which is the only concession the ground has made to anybody.',
        materialIds: ['mat-sulphur-toad-gland'],
        note: 'The Ashen Anvil gate ledger counts them by the season, and the count has not been over forty in three generations.',
        changedManner: 'Says the unpleasant thing first and on purpose, then watches to see who in the room flinched before deciding which of them to deal with.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // TERRITORIAL - what is already on the good ground, and why a vein
    // costs more than the survey says
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-thunder-hawk',
        name: 'Thunder Hawk',
        nature: 'territorial',
        disposition: 'neutral',
        ordinal: 17,
        biome: 'high_peak',
        element: 'lightning',
        persistence: 'vein_only',
        veinRelation: 'holds',
        groupSize: 1,
        frequency: 22,
        ability: {
            name: 'Storm Wing',
            kind: 'movement',
            what:
                'Rides weather rather than air, so it is fastest in exactly the conditions that ground everything else that flies.'
        },
        hard: 'It holds the air over a ledge and does not come down. Nothing that flies crosses its sight line, which closes the fast route between two of the province towns for anyone who cannot fight at its height.',
        materialIds: ['mat-hawk-feather', 'mat-hawk-core'],
        note: 'Nests on the one peak with a vein close to the surface, and has for longer than the sect below has held its charter.',
        changedManner: 'Short with everybody and shorter under a roof, and conducts anything that matters outside, standing, in whatever weather is happening.'
    },
    {
        // THE CASE THE DISPOSITION AXIS EXISTS FOR, and the catalog had no
        // entry that made it. Above `BEAST_CORE_ORDINAL`, so it is a tracked
        // individual somebody can have a view about; below
        // `BEAST_CHANGE_ORDINAL`, so killing it is killing an animal and not a
        // person; and righteous, so the animal in question has never taken
        // anything from anybody and is carrying a core worth more than the
        // district earns in a year.
        //
        // Everything above 17 in this catalog was a problem to be solved. A
        // hunting window in which every target deserved it is a window with no
        // decision in it.
        id: 'beast-cairn-hound',
        name: 'Grave Jackal',
        nature: 'territorial',
        disposition: 'righteous',
        ordinal: 18,
        biome: 'mountain',
        element: 'earth',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 14,
        ability: {
            name: 'Ground Memory',
            kind: 'perception',
            what:
                'Knows what is under every stone in the ground it walks, and knows which of them has been lifted since the last time it passed.'
        },
        hard: 'It will not leave the cairns and it will not open on anybody who is not digging, so a party that wants it has to start the fight themselves and then finish it against something standing on ground it has known for ninety years.',
        materialIds: ['mat-cairn-hound-tooth', 'mat-cairn-hound-core'],
        note: 'Three hill districts date their grave rolls by which hound was walking, and none of the three has ever paid it anything or been asked to.',
        changedManner: 'Loyal to a place rather than to a person, and will not be talked into leaving it even by somebody it likes and even when staying has stopped making sense.'
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
        disposition: 'neutral',
        ordinal: 20,
        biome: 'mountain',
        element: 'metal',
        persistence: 'open_world',
        veinRelation: 'holds',
        groupSize: 1,
        frequency: 16,
        ability: {
            name: 'Rending Leap',
            kind: 'movement',
            what:
                'Closes any distance it can see across in a single movement, arriving with the four hooked lengths already extended.'
        },
        hard: 'It holds a ridge and it closes the distance in one movement, so there is no exchange to manage and no second decision to make. Everybody who has seen one describes the same four marks, and the province has an art copied off them.',
        note: 'The one animal in the range that mortals and cultivators name identically, and the reason a metal-element art nobody can trace an author for is taught in four separate houses.',
        materialIds: ['mat-tiger-fang', 'mat-tiger-pelt', 'mat-tiger-core'],
        changedManner: 'Direct to the point of discourtesy and will not be crowded, and answers a threat the first time it is made rather than working out whether it was meant.'
    },
    {
        id: 'beast-earth-dragon',
        name: 'Earth Dragon',
        nature: 'territorial',
        disposition: 'neutral',
        ordinal: 26,
        biome: 'spirit_vein',
        element: 'earth',
        persistence: 'vein_only',
        veinRelation: 'drains',
        groupSize: 1,
        frequency: 8,
        ability: {
            name: 'Stonewade',
            kind: 'movement',
            what:
                'Moves through rock the way anything else moves through water, so there is no wall between it and anywhere it wants to be.'
        },
        hard: 'It is inside the vein rather than on the ground above it, so it cannot be besieged, cannot be starved, and is drinking the thing that is being defended. Every month of delay is paid in the vein.',
        materialIds: ['mat-dragon-scale', 'mat-dragon-core'],
        note: 'A holding whose measured output has fallen eleven percent in a year has either taken on disciples or acquired one of these, and the sect will announce whichever answer is less embarrassing.',
        changedManner: 'Talks about ground - whose it is, what is under it, what was paid for it - and brings every other subject back to that inside two turns of a conversation.'
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
        // Righteous, above the change, and therefore able to answer. A thousand
        // years of taking nothing from anybody, carrying a core worth thirty
        // thousand stones, standing at a rung where killing it is killing a
        // person - and a person who can be asked instead. Every part of the
        // design's sharpest case is already in this one row.
        disposition: 'righteous',
        ordinal: 31,
        biome: 'lake_bottom',
        element: 'water',
        persistence: 'vein_only',
        veinRelation: 'holds',
        groupSize: 1,
        frequency: 4,
        ability: {
            name: 'Shellbound',
            kind: 'defence',
            what:
                'Takes the shell and everything under it out of reach at once, and can stay that way for as long as the other party can afford to wait.'
        },
        hard: 'Nothing it does is fast and nothing anybody does to it lands. It cannot be starved, cannot be drawn off the water, and outlasts any party that can afford to stay. Two expeditions have simply run out of provisions and gone home.',
        note: 'Sheds a plate about once a generation and the plates are dated by the households that own them, so the animal has a longer continuous record than the sect on the shore.',
        materialIds: ['mat-tortoise-scute', 'mat-tortoise-plastron', 'mat-tortoise-core'],
        changedManner: 'Blunt. Says the thing in the fewest words it will go in, does not soften it, does not repeat it, and does not appear to know that it has been rude.'
    },
    {
        id: 'beast-abyss-leviathan',
        name: 'Abyssal Leviathan',
        nature: 'territorial',
        disposition: 'neutral',
        ordinal: 38,
        biome: 'abyss',
        element: 'water',
        persistence: 'sealed_only',
        veinRelation: 'holds',
        groupSize: 1,
        frequency: 2,
        ability: {
            name: 'Pressure',
            kind: 'strength',
            what:
                'Carries the weight of the water it lives under wherever it goes, and everything near it is under that weight too.'
        },
        hard: 'It is four realms above anything a province can field, and the realm gap is not a hard fight but an evacuation order. What can be done about it is logistics, not combat.',
        materialIds: ['mat-leviathan-core'],
        note: 'Surfaces from the rift about twice a century, is recorded, and goes back down. The recording is the entire response.',
        changedManner: 'Speaks at the pace of something that has never had a reason to hurry, finishes every sentence it starts, and does not register having been interrupted.'
    },
    {
        id: 'beast-toll-lion',
        name: 'Guardian Lion',
        nature: 'territorial',
        disposition: 'neutral',
        ordinal: 17,
        biome: 'roadside',
        element: 'metal',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 20,
        ability: {
            name: 'Takes It In',
            kind: 'strength',
            what:
                'Swallows metal, stone and anything else put in front of it, and nothing that goes in comes back out of it in any form.'
        },
        hard: 'It holds a stretch of road rather than a place, so it cannot be gone around by anybody who has to arrive with a cart. What it wants is what the cart is carrying, and it does not distinguish between the tribute and the escort.',
        materialIds: ['mat-toll-lion-mane', 'mat-toll-lion-core'],
        note: 'The stone pairs at the ends of the province bridges were carved off these, and the carvers got the mouth right because the carvers had seen one.',
        changedManner: 'Takes what is offered and gives nothing back, in a plain way that reads as poor manners rather than as theft, and is genuinely puzzled to be told so.'
    },
    {
        id: 'beast-ridge-lizard',
        name: 'Crest Lizard',
        nature: 'territorial',
        // Nothing under the ridge it sits on has burned in a century and none
        // of them has ever paid it anything or been asked to. That is the
        // whole of what righteous means on this axis.
        disposition: 'righteous',
        ordinal: 18,
        biome: 'ruins',
        element: 'water',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 14,
        ability: {
            name: 'Swallows Flame',
            kind: 'breath',
            what:
                'Takes fire in and puts water out, in the quantity the fire was, so a burning roof stops burning and nothing decided to stop it.'
        },
        hard: 'It will not leave the ridge it has taken and it opens on nobody, so a party that wants it has to start the fight on a roof, over a building somebody lives under, in front of them.',
        materialIds: ['mat-ridge-lizard-scale', 'mat-ridge-lizard-core'],
        note: 'The tailless figures on the roof ridges are copied off it, and the four temple quarters that still have one have not lost a hall to fire in a hundred years.',
        changedManner: 'Puts out an argument by stepping into the middle of it, says the flat thing that ends it, and has no interest at all in which side was right.'
    },
    {
        id: 'beast-one-horn-ram',
        name: 'One-Horn Ram',
        nature: 'territorial',
        disposition: 'righteous',
        ordinal: 19,
        biome: 'battlefield',
        element: 'earth',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 12,
        ability: {
            name: 'First Blow',
            kind: 'perception',
            what:
                'Reads which of two parties struck first off the ground they stood on and what was left there, hours or a century afterwards, and does not get it wrong.'
        },
        hard: 'It grazes an old field and opens on nobody who has not already opened on somebody there. A party that wants the core has to strike first in front of it and then fight something that has been standing on a burn edge for sixty years.',
        materialIds: ['mat-ram-horn', 'mat-ram-core'],
        note: 'Two district magistrates have taken a disputed killing out to a field with one on it and stood well back, and both records note only that the matter was settled.',
        changedManner: 'States who started it, in company, at the moment everybody has agreed to leave that part alone.'
    },
    {
        id: 'beast-hill-borer',
        name: 'Knoll-Borer',
        nature: 'territorial',
        disposition: 'neutral',
        ordinal: 21,
        biome: 'cave',
        element: 'earth',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 10,
        ability: {
            name: 'Overlapped Plate',
            kind: 'defence',
            what:
                'Wears plate that lies over plate in every direction, so nothing reaches between them at any angle, and it does not have to face what is hitting it.'
        },
        hard: 'It goes through a hill rather than along the galleries, so it cannot be cut off, trapped in a face or starved out, and a working it has taken an interest in is a working with a new opening every week.',
        materialIds: ['mat-borer-scale', 'mat-borer-core'],
        note: 'Sheds plates the length of a hand into its own runs. Every pill hall in the province buys them and every carver in the Buddha Precipice knows which runs to walk.',
        changedManner: 'Shrugs off an insult and a compliment the same way, and cannot be got at by either, which most people read as not listening.'
    },
    {
        id: 'beast-flood-serpent',
        name: 'Deluge Serpent',
        nature: 'territorial',
        disposition: 'demonic',
        ordinal: 22,
        biome: 'riverbank',
        element: 'water',
        persistence: 'open_world',
        veinRelation: 'holds',
        groupSize: 1,
        frequency: 8,
        ability: {
            name: 'Rising Water',
            kind: 'breath',
            what:
                'Brings the water up over the bank it lies under and holds it there, so the ground a fight was arranged on is under the river before the fight begins.'
        },
        hard: 'It takes a reach of river and everything living on both banks pays for it, in a year that a village upstream reads as weather. The house that holds the district finds out when the tithe does not arrive.',
        materialIds: ['mat-flood-serpent-hide', 'mat-flood-serpent-core'],
        note: 'Three river villages make an offering at the deep bend and two of them will not say to what. The offering is grain and the grain goes.',
        changedManner: 'Speaks softly and takes the whole of what was under discussion, and the other party leaves the table certain it was a fair meeting.'
    },
    {
        id: 'beast-hoar-stag',
        name: 'Hoar Stag',
        nature: 'territorial',
        disposition: 'righteous',
        ordinal: 23,
        biome: 'glacier',
        element: 'ice',
        persistence: 'open_world',
        veinRelation: 'holds',
        groupSize: 1,
        frequency: 7,
        ability: {
            name: 'Over the Crust',
            kind: 'movement',
            what:
                'Crosses snow that will not carry anything else at any weight and any speed, so the ground it fights on is ground the other party is standing in.'
        },
        hard: 'It holds the one crossing of the upper ice and it has never once closed the route to anybody. A party that wants the core has to open on something that has been letting them pass for as long as any of them has been alive.',
        materialIds: ['mat-hoar-antler', 'mat-hoar-stag-core'],
        note: 'Drops the antlers at the top of the ice each year, where the guides find them and bring them down, and where nobody has ever had to fight anything for one.',
        changedManner: 'Formal to strangers, refuses gifts, and settles a debt the same day it is incurred, which people mistake for coldness.'
    },
    {
        id: 'beast-cloud-roc',
        name: 'Cloud Roc',
        nature: 'territorial',
        disposition: 'neutral',
        ordinal: 24,
        biome: 'high_peak',
        element: 'metal',
        persistence: 'open_world',
        veinRelation: 'holds',
        groupSize: 1,
        frequency: 6,
        ability: {
            name: 'Single Stoop',
            kind: 'movement',
            what:
                'Comes down the whole height of the sky in one movement and takes what it came for off the ground without landing.'
        },
        hard: 'It holds the air over a range rather than a ledge, so there is no ground to besiege and no route that is not under it. Anybody who fights one fights it at its own height or waits for it to come down, which it does once.',
        materialIds: ['mat-roc-pinion', 'mat-roc-core'],
        note: 'The flying routes over the White Stair are drawn around one bird and have been redrawn twice in living memory, both times after it moved.',
        changedManner: 'Looks past whoever is speaking to it and answers the room, and cannot be made to attend to anything smaller than what it came for.'
    },
    {
        id: 'beast-water-parting-rhino',
        name: 'Water-Parting Rhino',
        nature: 'territorial',
        disposition: 'neutral',
        ordinal: 25,
        biome: 'deep_forest',
        element: 'earth',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 5,
        ability: {
            name: 'The Line In the Horn',
            kind: 'perception',
            what:
                'Perceives through standing water, fog and smoke as though none of them were there, and is never fighting the thing anybody thought it was fighting.'
        },
        hard: 'Nothing in the deep valley can put anything between it and them, which is the whole of what a party at Foundation has to work with. It does not pursue and it does not need to.',
        materialIds: ['mat-rhino-horn', 'mat-rhino-core'],
        note: 'The horn is the ingredient two of the province longevity formulas will not substitute for, and the price has been going one way for a century.',
        changedManner: 'Says the thing everybody was talking around, once, and then will not be drawn on it again.'
    },
    {
        // The Grave Jackal's case, one whole realm up and with an immortal-grade
        // core on it. Righteous, silent, and standing in an ordinary forest a
        // Foundation party can walk into: the decision is not whether it can be
        // taken but what taking it costs, and the catalog is supposed to make
        // that sting.
        id: 'beast-green-qilin',
        name: 'Cyan Qilin',
        nature: 'territorial',
        disposition: 'righteous',
        ordinal: 26,
        biome: 'forest',
        element: 'wood',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
        frequency: 3,
        ability: {
            name: 'Treads On Nothing',
            kind: 'movement',
            what:
                'Puts its weight down without marking what it is standing on, over any distance and any ground, so nothing it has crossed can be tracked back or read.'
        },
        hard: 'It has never struck anything, which means a party gets the whole first exchange for free and then has to survive the second against something at Deity Transformation. Both parties of record got the first exchange.',
        materialIds: ['mat-qilin-hair', 'mat-qilin-core'],
        note: 'Eats nothing living and walks through standing crops without laying a stem down. Four households in the old wood have seen one and none of them reported it.',
        changedManner: 'Will not be the first to take offence, or to raise a voice, or to reach for anything, and holds to that after it has stopped being wise.'
    },

    {
        id: 'beast-firevein-serpent',
        name: 'Firevein Serpent',
        nature: 'territorial',
        disposition: 'neutral',
        ordinal: 24,
        biome: 'volcanic',
        element: 'fire',
        persistence: 'open_world',
        veinRelation: 'holds',
        groupSize: 1,
        frequency: 6,
        ability: {
            // NOT `Seam`-ANYTHING, and the collision is why. An ability name is
            // part of what a species is called - `theSpeciesTheyMeant` reads it
            // so that `fox` reaches the Reader - and the Sleeper in the Cut
            // Face is `Seam-Held`. A second seam made `seam` ambiguous and the
            // reader answers null on an ambiguity, which silently took a
            // species away from anybody who typed its ordinary name.
            name: 'Runs the Hot Rock',
            kind: 'movement',
            what:
                'Travels a seam of molten rock the way anything else travels a road, and comes up wherever that rock comes up.'
        },
        hard: 'What it holds is not a place but everywhere one seam of hot rock goes, so a party that has driven it off the rim meets it again at the vent and again at the flank, and it has not been moved off its own ground once.',
        materialIds: ['mat-firevein-serpent-hide', 'mat-firevein-serpent-core'],
        note: 'The Ashen Anvil Clan has never applied to clear it, and the caldera grant the Nine Abyss Flame Sect is said to hold does not mention it either.',
        changedManner: 'Arrives without being sent for, at whatever moment it decides the conversation concerns it, and does not accept that it was not already part of it.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // INTELLIGENT - past the change, and therefore a party rather than a
    // problem. Cheaper to negotiate with, and it knows that too.
    //
    // A GROUPING AND NOT A PERMISSION. Speech is the rung and nothing else -
    // `anythingAtThisRungSpeaks` - so every entry below this heading that
    // stands at or past the change speaks too, `ancient` and `territorial`
    // ones included. What `nature: intelligent` still says is what sort of
    // problem the species is before its rung is read.
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-white-ape-of-the-gorge',
        name: 'White Ape of the Gorge',
        nature: 'intelligent',
        // Charges passage in salt and in news, and has kept every arrangement
        // it made for a hundred and forty years. Nobody pays it who did not
        // agree to, which is the whole of what righteous means on this axis.
        disposition: 'righteous',
        ordinal: 29,
        biome: 'mountain',
        element: 'metal',
        persistence: 'vein_only',
        veinRelation: 'holds',
        groupSize: 1,
        frequency: 6,
        ability: {
            name: 'Gorge Clamber',
            kind: 'movement',
            what:
                'Holds and crosses sheer rock as though it were level ground, which is most of why the gorge above the Jade Gorge is its and not anybody else\'s.'
        },
        hard: 'It will talk, and it is better at it than the disciples sent to do it. It knows what the gorge is worth, knows that nobody the sect can field is within three realms of it, and has never once opened first. The arrangement holds because it is the cheaper of the two things it could be doing.',
        materialIds: [],
        note: 'Holds the gorge above the Jade Gorge, charges passage in salt and in news, and has kept every arrangement it has made for a hundred and forty years.',
        changedManner: 'Mocking, and accurate about it. Gets the measure of a delegation in a sentence, says it out loud, and then keeps to the terms exactly as agreed.'
    },
    {
        id: 'beast-nine-tailed-reader',
        name: 'The Reader at Burnt Earth',
        nature: 'intelligent',
        // It trades genuinely, has never broken terms, and has never once
        // forgiven a breach. Both halves of that are neutral: it prices
        // everything, including you, and it tells you the price first.
        disposition: 'neutral',
        ordinal: 29,
        biome: 'ruins',
        element: 'fire',
        persistence: 'open_world',
        veinRelation: 'indifferent',
        groupSize: 1,
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
        note: 'A nine-tailed fox in a plain human shape, worn perfectly, because seeming is the one thing a fox never had to learn. Sits in the temple ruin most evenings and is not, technically, trespassing.',
        // THE GENRE TROPE, AND IT STAYS. An earlier pass removed it as though
        // it were an invention: *"that's a genuine genre trope, you should
        // keep it cuz it's part of asian fantasy."* It is a manner and not a
        // body, which is the line every row on this field holds.
        changedManner: 'Seductive, in the plain sense that agreeing with one is easier than not, and it does not stop being that when the business is a manual and a price.'
    },

    // ═══════════════════════════════════════════════════════════════════
    // ANCIENT - the sealed places, and why they kill people
    // ═══════════════════════════════════════════════════════════════════
    {
        id: 'beast-thing-under-nine-peaks',
        name: 'The Thing Under Nine Peaks',
        nature: 'ancient',
        // It is drinking a vein an order of four hundred people live on, and
        // none of them can see the clock or appeal it. That is the Still Blade Pavilion's
        // own row among the houses: a third party who is not present.
        disposition: 'demonic',
        ordinal: 33,
        biome: 'spirit_vein',
        element: 'earth',
        persistence: 'sealed_only',
        veinRelation: 'drains',
        groupSize: 1,
        frequency: 1,
        ability: {
            name: 'Drinking the Vein',
            kind: 'endurance',
            what:
                'Draws off a vein faster than the vein refills, so anything sharing ground with it is on a clock that nobody standing there can see.'
        },
        hard: 'It has been cultivating on an undrawn vein since before the order above it was founded, it has never been interrupted, and nobody alive has established whether the seal was cut to keep it in or to keep the vein for it.',
        materialIds: ['mat-ancient-core'],
        note: 'The Ascetic Sect lights nine of its forty-one nodes and has never applied to relight the four that sit over the lower chamber.',
        changedManner: 'Speaks of the ground as its own and of everybody standing on it as a recent arrival, which is not a claim so much as a date.'
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
        disposition: 'neutral',
        ordinal: 30,
        biome: 'cave',
        element: 'earth',
        persistence: 'sealed_only',
        veinRelation: 'holds',
        groupSize: 1,
        frequency: 1,
        ability: {
            name: 'Seam-Held',
            kind: 'defence',
            what:
                'Has grown into the working face itself, so anything done to it is done to nine hundred years of mountain first.'
        },
        hard: 'It is walled into a working face on the Buddha Precipice side, it is past the change, and it has been awake for some of the nine hundred years. Carvers who have cut near it report the dust hanging wrong and stop taking that grant.',
        materialIds: ['mat-sleeper-seam-core'],
        note: 'Clearwater Ward has refused four applications to open the face and has not given a reason in writing, which is itself the longest entry in the grant ledger.',
        changedManner: 'Asks who holds the district now, and then who held it before that, and works forward through nine hundred years of it before it will discuss anything else.'
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
        name: 'Grass Rabbit Pelt',
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
        name: 'Qi-Devouring Bat Membrane',
        grade: 'mortal',
        sourceBeastId: 'beast-cave-drain-bat',
        taking: 'scavenge',
        core: false,
        value: 20,
        rarityWeight: 150,
        harvestOrdinal: 3,
        description: 'Swept off a roost floor by the sackful. Holds qi briefly and badly, which is exactly what a cheap talisman needs.'
    },

    {
        id: 'mat-sparrow-down',
        name: 'Sparrow Down',
        grade: 'mortal',
        sourceBeastId: 'beast-grain-sparrow',
        taking: 'scavenge',
        core: false,
        value: 1,
        rarityWeight: 400,
        harvestOrdinal: 0,
        description: 'Swept out of a netting shed by the basket and stuffed into winter coats. The cheapest thing in the catalog and the only one a child is paid for.'
    },
    {
        id: 'mat-jerboa-pelt',
        name: 'Dune Jerboa Pelt',
        grade: 'mortal',
        sourceBeastId: 'beast-dune-jerboa',
        taking: 'kill',
        core: false,
        value: 2,
        rarityWeight: 330,
        harvestOrdinal: 2,
        description: 'Sold in sewn squares of forty because one is the size of a palm. Paid for in salt at the Burial Sands, which has no stones to pay in.'
    },
    {
        id: 'mat-spoil-rat-pelt',
        name: 'Spoil Rat Pelt',
        grade: 'mortal',
        sourceBeastId: 'beast-spoil-rat',
        taking: 'kill',
        core: false,
        value: 2,
        rarityWeight: 280,
        harvestOrdinal: 6,
        description: 'Bought by weight by the glue-boilers at a rate that has not moved in a generation. The boilers say the animals are smaller and the clerk records the weight.'
    },
    {
        id: 'mat-crow-quill',
        name: 'Scorch Crow Quill',
        grade: 'mortal',
        sourceBeastId: 'beast-burn-crow',
        taking: 'shed',
        core: false,
        value: 3,
        rarityWeight: 350,
        harvestOrdinal: 0,
        description: 'Picked up off a burn edge by the handful and cut into pens. Half the district paperwork in the Quiet Marches is written with one.'
    },
    {
        id: 'mat-pheasant-tail',
        name: 'Pheasant Plume',
        grade: 'mortal',
        sourceBeastId: 'beast-ringed-pheasant',
        taking: 'shed',
        core: false,
        value: 4,
        rarityWeight: 320,
        harvestOrdinal: 0,
        description: 'Gathered off the forest floor in the moult and sold to the opera troupes, who pay more for the pair than the butcher pays for the bird.'
    },
    {
        id: 'mat-cave-fish-oil',
        name: 'Grotto Fish Oil',
        grade: 'mortal',
        sourceBeastId: 'beast-blind-cave-fish',
        taking: 'kill',
        core: false,
        value: 5,
        rarityWeight: 300,
        harvestOrdinal: 1,
        description: 'Burns without smoke, which is the whole of why deep carving is possible. A face working nine hundred paces in gets through a jar a shift.'
    },
    {
        id: 'mat-moth-dust',
        name: 'Paper Weevil Dust',
        grade: 'mortal',
        sourceBeastId: 'beast-paper-moth',
        taking: 'scavenge',
        core: false,
        value: 5,
        rarityWeight: 260,
        harvestOrdinal: 2,
        description: 'Swept off the floor of a ruined archive, and the ink of whatever was on the shelf is in it. Talisman makers buy it and say why only when pressed.'
    },
    {
        id: 'mat-magpie-tail',
        name: 'Magpie Plume',
        grade: 'mortal',
        sourceBeastId: 'beast-verge-magpie',
        taking: 'shed',
        core: false,
        value: 6,
        rarityWeight: 300,
        harvestOrdinal: 1,
        description: 'Picked up along the post road and sold at the gate as a luck token. The post houses buy them back and nobody at either end calls it a trade.'
    },
    {
        id: 'mat-night-cat-pelt',
        name: 'Dusk Cat Pelt',
        grade: 'mortal',
        sourceBeastId: 'beast-night-cat',
        taking: 'kill',
        core: false,
        value: 9,
        rarityWeight: 250,
        harvestOrdinal: 3,
        description: 'The winter coat is worth three times the summer one, so the snare line runs from the eleventh month. Four households in the deep valley live on it.'
    },
    {
        id: 'mat-marmot-fat',
        name: 'Frost Marmot Fat',
        grade: 'mortal',
        sourceBeastId: 'beast-frost-marmot',
        taking: 'kill',
        core: false,
        value: 11,
        rarityWeight: 240,
        harvestOrdinal: 4,
        description: 'Rendered for lamp fat and for the salve kept by the door of every ice-field house. The Court buys the surplus and does not say what for.'
    },
    {
        id: 'mat-carp-scale',
        name: 'Gate Carp Scale',
        grade: 'mortal',
        sourceBeastId: 'beast-gate-carp',
        taking: 'kill',
        core: false,
        value: 12,
        rarityWeight: 180,
        harvestOrdinal: 7,
        description: 'Taken off the run at the falls in the fourth month and glued in overlapping courses onto cheap scale armour that turns one blow and then does not.'
    },
    {
        id: 'mat-cliff-goat-horn',
        name: 'Cliff Goat Horn',
        grade: 'mortal',
        sourceBeastId: 'beast-cliff-goat',
        taking: 'kill',
        core: false,
        value: 16,
        rarityWeight: 200,
        harvestOrdinal: 5,
        description: 'Cut into cups and bow nocks in the high hamlets. Priced at four times a hare, entirely for where the animal was standing when it was shot.'
    },
    {
        id: 'mat-bamboo-viper-fang',
        name: 'Bamboo Viper Fang',
        grade: 'mortal',
        sourceBeastId: 'beast-bamboo-viper',
        taking: 'kill',
        core: false,
        value: 18,
        rarityWeight: 170,
        harvestOrdinal: 4,
        description: 'Sold in pairs to the poison halls and in singles to cutters, who wear one and say it is for luck. The halls do not correct them.'
    },

    {
        id: 'mat-cinder-rat-fleece',
        name: 'Cinder Rat Fleece',
        grade: 'mortal',
        sourceBeastId: 'beast-cinder-rat',
        taking: 'shed',
        core: false,
        value: 12,
        rarityWeight: 300,
        harvestOrdinal: 0,
        description: 'Combed out of the hot cinder they bed in rather than taken off anything, and cleaned by being put back in the fire, which is most of what the cloth is bought for.'
    },
    {
        id: 'mat-ember-crane-plume',
        name: 'Ember Crane Plume',
        grade: 'mortal',
        sourceBeastId: 'beast-ember-crane',
        taking: 'shed',
        core: false,
        value: 9,
        rarityWeight: 240,
        harvestOrdinal: 2,
        description: 'Found on the rim after a burn and sold at the flank gate to people who want a day of warning and will settle for a token of one.'
    },
    {
        id: 'mat-sulphur-toad-gland',
        name: 'Sulphur Toad Gland',
        grade: 'mortal',
        sourceBeastId: 'beast-sulphur-toad',
        taking: 'kill',
        core: false,
        value: 26,
        rarityWeight: 160,
        harvestOrdinal: 9,
        description: 'Bought by the smelting halls, who use a measure of it to sour a batch on purpose, and by two apothecaries who will not say what for.'
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
        description: 'The one beast material the Buddha Precipice can supply in quantity, and the reason Iron Crest has a horn market at all.'
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
        id: 'mat-cairn-hound-tooth',
        name: 'Grave Jackal Tooth',
        grade: 'earth',
        sourceBeastId: 'beast-cairn-hound',
        taking: 'scavenge',
        core: false,
        value: 240,
        rarityWeight: 34,
        harvestOrdinal: 12,
        description: 'Shed onto the stones and left where it fell, and the hill households pick them up and keep them rather than sell them. A stall holding four of these is a stall that has been somewhere it should not have been.'
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

    {
        id: 'mat-heron-plume',
        name: 'Reed Heron Plume',
        grade: 'earth',
        sourceBeastId: 'beast-reed-heron',
        taking: 'shed',
        core: false,
        value: 60,
        rarityWeight: 85,
        harvestOrdinal: 2,
        description: 'Dropped in one week of the year and gathered by people camped for it. A hat with four says what the wearer earns without a word being said.'
    },
    {
        id: 'mat-marten-pelt',
        name: 'Pine Marten Pelt',
        grade: 'earth',
        sourceBeastId: 'beast-pine-marten',
        taking: 'kill',
        core: false,
        value: 70,
        rarityWeight: 80,
        harvestOrdinal: 6,
        description: 'A month of ordinary work for one winter skin, which is why the trap line runs through the sect boundary and why the dispute over it is sixty years old.'
    },
    {
        id: 'mat-weasel-tail-hair',
        name: 'Weasel Brush-Hair',
        grade: 'earth',
        sourceBeastId: 'beast-yellow-weasel',
        taking: 'kill',
        core: false,
        value: 95,
        rarityWeight: 65,
        harvestOrdinal: 9,
        description: 'The best writing brush there is, so every copyist, clerk and talisman maker in the province is buying from somebody who has had to catch one.'
    },
    {
        id: 'mat-trunk-hound-hide',
        name: 'Trunk Jackal Pelt',
        grade: 'earth',
        sourceBeastId: 'beast-trunk-hound',
        taking: 'kill',
        core: false,
        value: 120,
        rarityWeight: 58,
        harvestOrdinal: 10,
        description: 'Black and without a seam anywhere a tail would have been. Timber grants in the deep valley are let cheaper where one has recently been taken.'
    },
    {
        id: 'mat-black-eel-skin',
        name: 'Black Eel Skin',
        grade: 'earth',
        sourceBeastId: 'beast-black-eel',
        taking: 'kill',
        core: false,
        value: 140,
        rarityWeight: 52,
        harvestOrdinal: 12,
        description: 'Wraps a hilt and does not slip wet, which is the only reason anybody goes down after one. Net crews cut the line instead and price it into the season.'
    },
    {
        id: 'mat-red-sweat',
        name: 'Red Lather',
        grade: 'earth',
        sourceBeastId: 'beast-blood-sweat-horse',
        taking: 'shed',
        core: false,
        value: 160,
        rarityWeight: 60,
        harvestOrdinal: 5,
        description: 'Scraped off the shoulder of a working animal at a water stop and sold by the flask. The caravan masters read the colour as a grade and are usually right.'
    },
    {
        id: 'mat-shrine-silk',
        name: 'Shrine Silk',
        grade: 'earth',
        sourceBeastId: 'beast-shrine-spider',
        taking: 'scavenge',
        core: false,
        value: 175,
        rarityWeight: 47,
        harvestOrdinal: 8,
        description: 'Lifted in sheets from under a temple floor. Worth the trip on its own, which is why parties keep entering buildings a district has stopped entering.'
    },
    {
        id: 'mat-mole-claw',
        name: 'Rock Mole Claw',
        grade: 'earth',
        sourceBeastId: 'beast-rock-mole',
        taking: 'kill',
        core: false,
        value: 200,
        rarityWeight: 45,
        harvestOrdinal: 14,
        description: 'Set into a carver tool, it finds the grain of a face the way the animal did. Every grant ledger records the face as opened on the survey.'
    },
    {
        id: 'mat-swift-nest',
        name: 'Stone Swift Nest',
        grade: 'earth',
        sourceBeastId: 'beast-stone-swift',
        taking: 'scavenge',
        core: false,
        value: 210,
        rarityWeight: 55,
        harvestOrdinal: 3,
        description: 'Built out of the birds themselves and worth more than its weight in silver at any pill hall. Taken off the underside of a floating stone, on a tether.'
    },
    {
        id: 'mat-bear-gall',
        name: 'Honey Bruin Gall',
        grade: 'earth',
        sourceBeastId: 'beast-honey-bear',
        taking: 'kill',
        core: false,
        value: 220,
        rarityWeight: 50,
        harvestOrdinal: 12,
        description: 'Worth four times the rest of the animal, which is why the village pays a culler and the culler leaves the carcass for the village.'
    },
    {
        id: 'mat-mantis-blade',
        name: 'Cart Mantis Blade',
        grade: 'earth',
        sourceBeastId: 'beast-cart-mantis',
        taking: 'kill',
        core: false,
        value: 230,
        rarityWeight: 44,
        harvestOrdinal: 14,
        description: 'Hafted as it comes off, and it holds an edge no smith can put back on it once it is gone. Post houses buy them and hang them where the story is told.'
    },
    {
        id: 'mat-buffalo-horn',
        name: 'Marsh Buffalo Horn',
        grade: 'earth',
        sourceBeastId: 'beast-mire-buffalo',
        taking: 'kill',
        core: false,
        value: 260,
        rarityWeight: 42,
        harvestOrdinal: 15,
        description: 'Sold at the Pearl Ocean ports as taken wild, by two marsh clans who herd them and will not say how.'
    },
    {
        id: 'mat-squid-ink',
        name: 'Deep Ink',
        grade: 'earth',
        sourceBeastId: 'beast-ink-squid',
        taking: 'scavenge',
        core: false,
        value: 260,
        rarityWeight: 36,
        harvestOrdinal: 14,
        description: 'Recovered off a deck or a hull after one has been and gone. A talisman drawn in it holds in water, and the only supply is somebody having been unlucky.'
    },
    {
        id: 'mat-cicada-shell',
        name: 'Gold Cicada Husk',
        grade: 'earth',
        sourceBeastId: 'beast-gold-cicada',
        taking: 'shed',
        core: false,
        value: 290,
        rarityWeight: 38,
        harvestOrdinal: 8,
        description: 'Whole, empty, and still gripping the bark. Gathered in one week of the year off the trunks on a vein, and bought by every pill hall in the province.'
    },
    {
        id: 'mat-centipede-segment',
        name: 'Tomb Centipede Segment',
        grade: 'earth',
        sourceBeastId: 'beast-tomb-centipede',
        taking: 'scavenge',
        core: false,
        value: 300,
        rarityWeight: 30,
        harvestOrdinal: 12,
        description: 'Found in a shaft after a moult, which is the only way most people ever see one. Ground for the poison halls, who pay more for the head segments.'
    },
    {
        id: 'mat-iron-bear-tooth',
        name: 'Iron-Eating Beast Tooth',
        grade: 'earth',
        sourceBeastId: 'beast-iron-eating-bear',
        taking: 'kill',
        core: false,
        value: 300,
        rarityWeight: 35,
        harvestOrdinal: 16,
        description: 'Takes an edge off a blade without chipping, so the refiners buy them in fours and the bamboo villages will not sell them at all.'
    },
    {
        id: 'mat-crevasse-chitin',
        name: 'Crevasse Grub Chitin',
        grade: 'earth',
        sourceBeastId: 'beast-crevasse-worm',
        taking: 'kill',
        core: false,
        value: 310,
        rarityWeight: 32,
        harvestOrdinal: 16,
        description: 'Cut in plates off a thing killed in a hole in the ice, which is where it has to be carried up from. The guides charge for the day either way.'
    },
    {
        id: 'mat-toll-lion-mane',
        name: 'Guardian Lion Mane',
        grade: 'earth',
        sourceBeastId: 'beast-toll-lion',
        taking: 'scavenge',
        core: false,
        value: 320,
        rarityWeight: 28,
        harvestOrdinal: 11,
        description: 'Combed off the thorn at the roadside where one has passed. Sold as proof a stretch is worked, which is worth more to a carter than the hair is.'
    },
    {
        id: 'mat-ram-horn',
        name: 'One-Horn Ram Horn',
        grade: 'earth',
        sourceBeastId: 'beast-one-horn-ram',
        taking: 'scavenge',
        core: false,
        value: 330,
        rarityWeight: 27,
        harvestOrdinal: 13,
        description: 'Shed on an old field every few years and picked up by whoever is walking it. Two magistrates keep one on the desk and neither will explain the practice.'
    },
    {
        id: 'mat-deer-musk',
        name: 'Deer Musk',
        grade: 'earth',
        sourceBeastId: 'beast-tusked-deer',
        taking: 'kill',
        core: false,
        value: 340,
        rarityWeight: 40,
        harvestOrdinal: 13,
        description: 'Half the fixing agent in the province and the reason four riverbank villages keep dogs they cannot otherwise afford to feed.'
    },
    {
        id: 'mat-ridge-lizard-scale',
        name: 'Crest Lizard Scale',
        grade: 'earth',
        sourceBeastId: 'beast-ridge-lizard',
        taking: 'scavenge',
        core: false,
        value: 350,
        rarityWeight: 26,
        harvestOrdinal: 12,
        description: 'Found in the gutters of a hall that has not burned in a century. The temple quarters that still have one on the ridge will not let them be gathered.'
    },
    {
        id: 'mat-crane-feather',
        name: 'Cloud Crane Feather',
        grade: 'earth',
        sourceBeastId: 'beast-cloud-crane',
        taking: 'shed',
        core: false,
        value: 380,
        rarityWeight: 30,
        harvestOrdinal: 9,
        description: 'Comes down off a ledge above the last water, so it is gathered by parties who went up for it and not by anybody who happened past.'
    },
    {
        id: 'mat-borer-scale',
        name: 'Knoll-Borer Scale',
        grade: 'earth',
        sourceBeastId: 'beast-hill-borer',
        taking: 'shed',
        core: false,
        value: 400,
        rarityWeight: 24,
        harvestOrdinal: 14,
        description: 'The length of a hand and shed into its own runs, so the carvers who know which runs to walk are collecting off an animal they have never met.'
    },
    {
        id: 'mat-leopard-pelt',
        name: 'Cloud-Spotted Leopard Pelt',
        grade: 'earth',
        sourceBeastId: 'beast-cloud-marked-leopard',
        taking: 'kill',
        core: false,
        value: 430,
        rarityWeight: 21,
        harvestOrdinal: 18,
        description: 'The one bamboo-country good a Jade Gorge house will take in place of stones, which is how the cutters pay a tithe in a year with no cash in it.'
    },
    {
        id: 'mat-hoar-antler',
        name: 'Hoar Stag Antler',
        grade: 'earth',
        sourceBeastId: 'beast-hoar-stag',
        taking: 'shed',
        core: false,
        value: 460,
        rarityWeight: 19,
        harvestOrdinal: 15,
        description: 'Dropped at the top of the ice each year and carried down by the guides. Nobody has ever had to fight anything for one and the price does not reflect it.'
    },
    {
        id: 'mat-salamander-skin',
        name: 'Crying Salamander Skin',
        grade: 'earth',
        sourceBeastId: 'beast-crying-salamander',
        taking: 'kill',
        core: false,
        value: 470,
        rarityWeight: 20,
        harvestOrdinal: 20,
        description: 'Bought whole by the drum makers and by two pill halls that want it for something else. Neither trade asks where a lake village got it.'
    },
    {
        id: 'mat-year-beast-hide',
        name: 'Nian Beast Pelt',
        grade: 'earth',
        sourceBeastId: 'beast-year-beast',
        taking: 'kill',
        core: false,
        value: 480,
        rarityWeight: 19,
        harvestOrdinal: 21,
        description: 'Takes fire badly and takes a blade worse. A village that has one nailed up over the gate has a date it no longer needs to keep.'
    },
    {
        id: 'mat-sun-eater-hide',
        name: 'Sun-Eater Pelt',
        grade: 'earth',
        sourceBeastId: 'beast-sun-eater',
        taking: 'kill',
        core: false,
        value: 490,
        rarityWeight: 18,
        harvestOrdinal: 23,
        description: 'Comes off scorched through and worth less for it, and every buyer knows the damage is the animal rather than the killing.'
    },
    {
        id: 'mat-flood-serpent-hide',
        name: 'Deluge Serpent Skin',
        grade: 'earth',
        sourceBeastId: 'beast-flood-serpent',
        taking: 'kill',
        core: false,
        value: 490,
        rarityWeight: 17,
        harvestOrdinal: 22,
        description: 'Sold by the length to the boatwrights, who sheathe a hull in it and charge twice. Three river villages would rather it had been left in the bend.'
    },
    {
        id: 'mat-roc-pinion',
        name: 'Cloud Roc Pinion',
        grade: 'earth',
        sourceBeastId: 'beast-cloud-roc',
        taking: 'shed',
        core: false,
        value: 495,
        rarityWeight: 16,
        harvestOrdinal: 16,
        description: 'The length of a man and found where the wind put it. The flying routes over the White Stair are drawn around the bird that dropped it.'
    },

    {
        id: 'mat-firevein-serpent-hide',
        name: 'Firevein Serpent Skin',
        grade: 'earth',
        sourceBeastId: 'beast-firevein-serpent',
        taking: 'shed',
        core: false,
        value: 300,
        rarityWeight: 40,
        harvestOrdinal: 18,
        description: 'Comes off whole and is found lying along a seam mouth a few times a century. Two of the four known panels are in the same clan hall and neither has been priced.'
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
        id: 'mat-cairn-hound-core',
        name: 'Grave Jackal Core',
        grade: 'heaven',
        sourceBeastId: 'beast-cairn-hound',
        taking: 'kill',
        core: true,
        value: 1_700,
        rarityWeight: 11,
        harvestOrdinal: 18,
        description: 'Ninety years of an animal walking the same stones, and it prices exactly as any other core at the rung does. The assay houses have never once recorded where one came from, and the hill districts have never once been asked.'
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

    {
        id: 'mat-centipede-core',
        name: 'Tomb Centipede Core',
        grade: 'heaven',
        sourceBeastId: 'beast-tomb-centipede',
        taking: 'kill',
        core: true,
        value: 1_500,
        rarityWeight: 12,
        harvestOrdinal: 17,
        description: 'The cheapest core the Burial Sands produces and the one most often sold in a hurry, because the party that took it is usually short of a member.'
    },
    {
        id: 'mat-toll-lion-core',
        name: 'Guardian Lion Core',
        grade: 'heaven',
        sourceBeastId: 'beast-toll-lion',
        taking: 'kill',
        core: true,
        value: 1_600,
        rarityWeight: 12,
        harvestOrdinal: 17,
        description: 'Comes out with a century of swallowed metal around it, and the assay houses shave the price for every piece the cutter failed to separate.'
    },
    {
        id: 'mat-ridge-lizard-core',
        name: 'Crest Lizard Core',
        grade: 'heaven',
        sourceBeastId: 'beast-ridge-lizard',
        taking: 'kill',
        core: true,
        value: 1_800,
        rarityWeight: 11,
        harvestOrdinal: 18,
        description: 'Water-heavy, and the two recorded sales were both to houses that lost a hall to fire in the year they bought it.'
    },
    {
        id: 'mat-leopard-core',
        name: 'Cloud-Spotted Leopard Core',
        grade: 'heaven',
        sourceBeastId: 'beast-cloud-marked-leopard',
        taking: 'kill',
        core: true,
        value: 1_900,
        rarityWeight: 11,
        harvestOrdinal: 18,
        description: 'The one core a bamboo-country party can realistically take, and the reason a cutting block with one working it is bid for rather than avoided.'
    },
    {
        id: 'mat-ram-core',
        name: 'One-Horn Ram Core',
        grade: 'heaven',
        sourceBeastId: 'beast-one-horn-ram',
        taking: 'kill',
        core: true,
        value: 2_100,
        rarityWeight: 10,
        harvestOrdinal: 19,
        description: 'Prices as any core at the rung does. What it took to get one onto a field where it could be killed is not a thing the assay houses ask about.'
    },
    {
        id: 'mat-squid-core',
        name: 'Ink Squid Core',
        grade: 'heaven',
        sourceBeastId: 'beast-ink-squid',
        taking: 'kill',
        core: true,
        value: 2_500,
        rarityWeight: 9,
        harvestOrdinal: 20,
        description: 'Every one on the market was taken on a deck rather than in the water. The port underwriters know the count and do not publish it.'
    },
    {
        id: 'mat-salamander-core',
        name: 'Crying Salamander Core',
        grade: 'heaven',
        sourceBeastId: 'beast-crying-salamander',
        taking: 'kill',
        core: true,
        value: 2_600,
        rarityWeight: 9,
        harvestOrdinal: 20,
        description: 'Two centuries of an animal lying under a lake calling, and a pill hall will spend it in one refinement on something for a cough.'
    },
    {
        id: 'mat-rhino-horn',
        name: 'Water-Parting Horn',
        grade: 'heaven',
        sourceBeastId: 'beast-water-parting-rhino',
        taking: 'scavenge',
        core: false,
        value: 2_800,
        rarityWeight: 8,
        harvestOrdinal: 18,
        description: 'The ingredient two province longevity formulas will not substitute for, and the price has gone one way for a century.'
    },
    {
        id: 'mat-year-beast-core',
        name: 'Nian Beast Core',
        grade: 'heaven',
        sourceBeastId: 'beast-year-beast',
        taking: 'kill',
        core: true,
        value: 3_000,
        rarityWeight: 8,
        harvestOrdinal: 21,
        description: 'Taken in a village street on a known date, which is the only reason any exist. Every recorded sale was split between a party and a settlement.'
    },
    {
        id: 'mat-borer-core',
        name: 'Knoll-Borer Core',
        grade: 'heaven',
        sourceBeastId: 'beast-hill-borer',
        taking: 'kill',
        core: true,
        value: 3_100,
        rarityWeight: 8,
        harvestOrdinal: 21,
        description: 'Earth-heavy and bid for by formation houses, who want it for a footing rather than for a pill and will say so at the auction.'
    },
    {
        id: 'mat-qilin-hair',
        name: 'Cyan Qilin Hair',
        grade: 'heaven',
        sourceBeastId: 'beast-green-qilin',
        taking: 'shed',
        core: false,
        value: 3_400,
        rarityWeight: 7,
        harvestOrdinal: 20,
        description: 'Caught on a thorn in the old wood and worth a year of a house. Four households have found one and none of the four reported where.'
    },
    {
        id: 'mat-flood-serpent-core',
        name: 'Deluge Serpent Core',
        grade: 'heaven',
        sourceBeastId: 'beast-flood-serpent',
        taking: 'kill',
        core: true,
        value: 3_500,
        rarityWeight: 7,
        harvestOrdinal: 22,
        description: 'The village that stops making the offering at the bend is the village that has heard one of these was cut out, and they are usually right.'
    },
    {
        id: 'mat-hoar-stag-core',
        name: 'Hoar Stag Core',
        grade: 'heaven',
        sourceBeastId: 'beast-hoar-stag',
        taking: 'kill',
        core: true,
        value: 3_600,
        rarityWeight: 7,
        harvestOrdinal: 23,
        description: 'The guides know within a season when one has been taken, because the upper crossing closes and stays closed.'
    },
    {
        id: 'mat-sun-eater-core',
        name: 'Sun-Eater Core',
        grade: 'heaven',
        sourceBeastId: 'beast-sun-eater',
        taking: 'kill',
        core: true,
        value: 3_800,
        rarityWeight: 7,
        harvestOrdinal: 23,
        description: 'Fire-heavy and still warm a decade after. No party has ever gone out for one; every recorded core was taken where the thing came down.'
    },
    {
        id: 'mat-roc-core',
        name: 'Cloud Roc Core',
        grade: 'heaven',
        sourceBeastId: 'beast-cloud-roc',
        taking: 'kill',
        core: true,
        value: 4_200,
        rarityWeight: 6,
        harvestOrdinal: 24,
        description: 'Has to be fought for at its own height, so the buyers are also the only people who could have taken one, and the market is four houses deep.'
    },
    {
        id: 'mat-rhino-core',
        name: 'Water-Parting Rhino Core',
        grade: 'heaven',
        sourceBeastId: 'beast-water-parting-rhino',
        taking: 'kill',
        core: true,
        value: 4_600,
        rarityWeight: 6,
        harvestOrdinal: 25,
        description: 'The top of the heaven band and the last core anybody takes without a campaign. Sold with the horn or not at all, because the horn proves the core.'
    },

    {
        id: 'mat-firevein-serpent-core',
        name: 'Firevein Serpent Core',
        grade: 'heaven',
        sourceBeastId: 'beast-firevein-serpent',
        taking: 'kill',
        core: true,
        value: 4_000,
        rarityWeight: 6,
        harvestOrdinal: 24,
        description: 'Has to be taken where the seam runs, which is ground nobody can stand on for long, so the two recorded takings were both done by parties that lost people doing it.'
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

    {
        id: 'mat-qilin-core',
        name: 'Cyan Qilin Core',
        grade: 'immortal',
        sourceBeastId: 'beast-green-qilin',
        taking: 'kill',
        core: true,
        value: 26_000,
        rarityWeight: 3,
        harvestOrdinal: 26,
        description: 'Off an animal that has never struck anything, standing in a wood a Foundation party can walk into. Two recorded sales, and the auction house entered the species and left the rest of the line blank.'
    },

    // ── chaos: one of these is a plot, not a purchase ──────────────────
    {
        id: 'mat-ancient-core',
        name: 'Core of Something Predating the Sect Above It',
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
        description: 'A core that has grown into worked stone rather than sitting in a body, which no Jade Gorge alchemist has a method for and no Buddha Precipice carver will sell. Both facts are the entire market.'
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
            'measured output at the Ascetic Sect fell before anything was seen, and was reported as a survey error',
            'vein deer arrived on three neighbouring holdings at once, out of season, and were culled as pests'
        ],
        minOrdinal: 3,
        maxOrdinal: 19,
        driverBeastId: 'beast-thing-under-nine-peaks',
        beastIds: ['beast-grey-wolf-pack', 'beast-vein-deer', 'beast-stone-ox', 'beast-thunder-hawk'],
        whoAbsorbsIt:
            'The river villages between the mountain and the province town, none of which are inside any sect recall order, and the Clear River Alliance, which counts the crossings and will call in the debt afterwards.',
        aftermath:
            'The front of it is killed within a month and the cause is not addressed, because addressing it means opening the lower chamber. The same tide is expected again and no date is offered.'
    },
    {
        id: 'tide-failed-seal-upstream',
        name: 'The Surge Out of a Broken Sigil',
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
        name: 'Nine Hundred Paces Advance',
        regionId: 'region-quiet-marches',
        cause:
            'The burn edge moved about nine hundred paces since the survey was drawn, and the thin population living behind it ran out of ground with anything in it at all. Nothing is driving them and there is nothing at the back of it to kill.',
        causeKnownLocally: true,
        precursors: [
            'the Six Li Patrol repainted the stakes twice in one year and the second repaint was not published',
            'horn prices at Iron Crest fell, because everything arriving at market was undersized and everyone could see it',
            'hares reached the sorting yard at Willow Village, which they have no business doing and had not done before'
        ],
        minOrdinal: 0,
        maxOrdinal: 11,
        driverBeastId: null,
        beastIds: ['beast-stubble-hare', 'beast-stone-ox', 'beast-grey-wolf-pack'],
        whoAbsorbsIt:
            'Iron Crest, which has a grant queue and an assay house and no pill trade, so the injuries are treated the mortal way at a splint and a month per casualty.',
        aftermath:
            'Nothing in it is worth taking, everything in it has to be killed anyway, and the district ends the season poorer than it started. This is the tide the Buddha Precipice actually gets, and it is not a story anybody tells.'
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
        'A contract of this kind is witnessed the way any other agreement is - a house of the Vermilion Sigil Terrace takes the fee, records the terms and holds the penalty clause. Beasts past the change insist on it more often than cultivators do, because they have less recourse and know it.',
    whyItIsRare:
        'Both sides must be able to talk, both must have something the other cannot get otherwise, and both must expect to be alive long enough for the terms to be worth writing. Most encounters fail the second condition and all of them fail the first below Void Tribulation, which is nearly all of them - the other party has to be one of a handful of things in the world.',
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

export function getBeast(id: string): Beast | undefined {
    return BEAST_BY_ID.get(id);
}

export function getBeastMaterial(id: string): BeastMaterial | undefined {
    return MATERIAL_BY_ID.get(id);
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
 * Nothing below `BEAST_CORE_ORDINAL` has a core to take. Above it, the two
 * species the catalog files as `intelligent` carry no material entry, which is
 * not an oversight: nobody has taken one, so there is no grade, no price and no
 * assay standard, and a party proposing to establish one is proposing a
 * specific and well-understood kind of afternoon.
 *
 * CHANGED BEASTS ARE PRICED ANYWAY - four of the six, since speech became the
 * rung - and it is left that way deliberately. A thing that speaks and carries
 * a figure reads as a contradiction and is the thesis: a person's body can be
 * worth money, and what anybody does about that is the ordinary question this
 * world asks about every cultivator alive - is this person worth more to you
 * alive, or as material. Tidying it away would make "a changed beast is a
 * person" mean "a changed beast is exempt", and nothing in this world is
 * exempt. What keeps them from being farmed is what keeps everything from
 * being farmed: three of the four are behind a seal, every one of them draws
 * at frequency 4 or less, and cutting one wants a realm almost nobody reaches.
 */
export function coreOf(beastId: string): BeastMaterial | undefined {
    return materialsOf(beastId).find(m => m.core);
}
