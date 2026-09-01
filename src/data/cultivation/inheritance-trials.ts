/**
 * Inheritance trials and graves: what is actually behind the door, and the
 * three completely different questions a door can ask.
 *
 * `encounters.ts` produces the summary line that says an inheritance ground
 * has opened. It says nothing about what is in it, because from outside there
 * is nothing to say. This file holds the inside, and the whole point of the
 * shape below is that the inside stays where it is until somebody walks in.
 *
 * WHY TRIALS AND GRAVES ARE ONE FILE
 * ----------------------------------
 * They are not the same thing and the record shapes differ, which is why
 * `SiteSchema` is a discriminated union rather than one flattened object. A
 * trial was calibrated for a claimant by somebody who intended to be inherited
 * from. A grave was arranged for nobody. What they share is the only two
 * pieces of machinery that must never be duplicated: the three gate kinds, and
 * the accessor pair that keeps the interior out of the pre-entry view. Two
 * copies of that accessor pair in two files is exactly the leak this file
 * exists to prevent, so there is one copy and it serves both.
 *
 * THREE KINDS OF GATE, AND THEY ARE DIFFERENT IN KIND
 * ---------------------------------------------------
 * Not three difficulty numbers. Three unrelated questions:
 *
 *   strength         An ordinal, and a stated physical test at that ordinal.
 *                    A strike absorbed, a pressure held, a seal broken. Enough
 *                    power passes it reliably; below the ordinal there is no
 *                    clever route, and every strength gate says so in
 *                    `noWorkaround` so nothing downstream is tempted to add
 *                    one.
 *
 *   age_and_talent   What the run accumulated or was dealt: years, root grade,
 *                    foundation quality, an attribute, comprehension in a
 *                    named domain. Twice as strong and shallow fails these,
 *                    and `strengthDoesNotHelp` says why for each one. The
 *                    attribute measure deliberately does not accept `fortune`
 *                    at the schema level, so a talent gate can never quietly
 *                    become a luck roll.
 *
 *   fate             Not a check against the sheet at all. Being somewhere
 *                    nobody could have scheduled, having refused something,
 *                    carrying an obligation you did not take on, being the
 *                    wrong person on a day when wrong is the qualification.
 *                    `characterStat` is `z.null()` on every fate gate: the
 *                    schema itself refuses to hold a stat, because a hidden
 *                    luck number is a thing players grind and this is not
 *                    supposed to be grindable. See `FATE_IS_NOT_A_STAT`.
 *
 * WHAT THE LIGHTNING TOOK
 * -----------------------
 * The rule that decides what a grave holds is how the occupant died, and it
 * runs the opposite way to intuition. Heavenly tribulation destroys nearly
 * everything a cultivator was carrying, so a tribulation grave is a short
 * list - and every item on it survived the heaviest thing in the world, which
 * is a warranty no forge and no auction house can issue. Anybody who died some
 * other way, in bed at four hundred, in a duel over a survey line, interred by
 * a sect that could afford the masonry, leaves a full inventory that nothing
 * has ever tested.
 *
 * So the rich crypt is usually the weaker one. Grave-readers know this and
 * price accordingly. Raiding parties do not, which is why raiding parties go
 * to the rich crypt. See `WHAT_THE_LIGHTNING_TOOK` and `GRAVE_CONTENTS_BANDS`;
 * the bands are data so the tests assert against the same table the entries
 * were authored from.
 *
 * THE INTERIOR IS GATED
 * ---------------------
 * Every entry is split into `outside` and `interior`. The outside is the
 * marker, the rumour, what the last party said on the way in, and for a grave
 * the manner of death, which is the single most useful thing a knowledgeable
 * party reads off a headstone and the thing an ignorant one walks straight
 * past. The interior is the chamber, the gates, the contents, and how it kills
 * people.
 *
 * `outsideViewOf` returns a type that has no `interior` key, so the compiler
 * refuses the leak before any test has to catch it. `enterSite` returns the
 * whole entry and is named as a deliberate act. The server layer should hold
 * only `outsideViewOf` until the engine has recorded an entry.
 *
 * Naming follows the awareness precedent in `hierarchy.ts`: below `named`,
 * `outsideViewOf` withholds the attribution and the rumour, because a rumour
 * is how a name reaches somebody and a player with no knowledge record has not
 * had it reach them yet.
 *
 * A RESTING PLACE IS NOT A GRAVE
 * ------------------------------
 * The chambers in `sealed-ancestors.ts` are a third category and are not in
 * this file. The occupant is not dead, the site was not left to be found, and
 * opening one is a waking rather than a recovery. `A_RESTING_PLACE_IS_NOT_A_GRAVE`
 * states the separation; the tests enforce that no entry here sits on one.
 */

import { z } from 'zod';

import { MAX_ORDINAL } from '../../engine/cultivation/realms.js';
import { FoundationQualitySchema, InsightDomainSchema, InsightDegreeSchema } from '../../schema/cultivation.js';
import { AwarenessSchema, mayBeNamed, type Awareness } from './hierarchy.js';

// ─────────────────────────────────────────────────────────────────────────
// THE THREE GATES
// Stated once, and the entries below conclude from it rather than re-arguing
// it in every `test` string.
// ─────────────────────────────────────────────────────────────────────────

export const THE_THREE_GATES = {
    principle:
        'A door can ask three different questions, and they are not three settings of one dial. One asks how much you can take. One asks what you have become, which is years and a root and a foundation and cannot be borrowed on the day. One asks nothing about you at all and turns on a coincidence nobody arranged.',
    whyThree:
        'Because a ladder with one gate kind produces one kind of cultivator. If every door tested strength, the correct play would be to sit until strong enough and then walk through everything, and talent and history would be decoration. If every door tested talent, a bad roll at birth would close the world. And if nothing anywhere turned on coincidence, the world would be a solved arithmetic problem that a careful player finishes. Three kinds means three different sentences a player can be told about why they are not getting in, and only one of them is a sentence they can do anything about today.',
    whatEachRefuses: [
        'strength: refuses cleverness. There is no method, no formation reading, no negotiation and no third party. The thing is set at an ordinal and it does the same amount of work to everybody.',
        'age_and_talent: refuses power. It is indifferent to how hard the claimant hits and asks what they are made of, which was settled years ago by a root, a foundation and the time actually spent. A cultivator four ranks above the requirement fails it flat if the years are not there.',
        'fate: refuses preparation. There is no stat behind it, no roll to improve and nothing to buy. It is a question about what happened, and the honest engine-facing answer is that most claimants will never satisfy one and cannot be advised to try.'
    ],
    andTheyStack:
        'A trial may carry more than one, in the order they are met. Two of the entries below open a strength gate onto a talent gate, which is why the sects that could beat the door lost people at the second room, and their loss records read as though the first room killed them.'
} as const;

/**
 * The rule that keeps `fate` honest, stated once and enforced by the schema
 * rather than by discipline.
 *
 * A fate gate holds `characterStat: null`, which is not documentation: it is a
 * `z.null()` and nothing can be put there. The moment a fate condition reads a
 * number off the sheet it becomes a thing to farm, and a farmable coincidence
 * is not a coincidence, it is a stat check with atmosphere on it.
 *
 * `fortune` exists on the sheet and is used by the engine elsewhere. It is not
 * used here, and the age-and-talent attribute measure does not accept it
 * either, so there is no route by which either of the two non-strength gate
 * kinds can degrade into a luck roll.
 */
export const FATE_IS_NOT_A_STAT = {
    rule: 'A fate gate reads world state, never the character sheet. `characterStat` is null at the schema level on every one of them.',
    whatWorldStateMeans:
        'History, knowledge records, standing obligations, who was present at an event, what a party refused and had that refusal recorded. All of it is written by things that happened, and none of it is a number that rises when the player does the same activity more times.',
    theFarmingTest:
        'The question to ask of any proposed fate condition: could a patient player produce it on purpose, repeatedly, by doing something? If yes it is not a fate condition, it is a quest step, and it should be written as one. Every entry here carries `whyItCannotBeFarmed` and has to answer that question in the specific rather than the abstract.',
    andMostPeopleNeverPass:
        'That is the intended distribution. A fate gate is not content the player is expected to clear; it is content that exists so that the one run in a hundred which happens to satisfy it gets something no amount of sitting could have bought. The other ninety-nine are told plainly that the door did not open and there is nothing to try.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// GATES
// ─────────────────────────────────────────────────────────────────────────

export const GateKindSchema = z.enum(['strength', 'age_and_talent', 'fate']);
export type GateKind = z.infer<typeof GateKindSchema>;

/**
 * Root grades, restated as a zod enum because `spirit-roots.ts` exports a TS
 * type rather than a schema. The test asserts this list equals the set of
 * grades actually present in `SPIRIT_ROOTS`, so extending that table without
 * extending this one fails loudly.
 */
export const SpiritRootGradeSchema = z.enum(['single', 'dual', 'triple', 'quad', 'muddled', 'mutated']);

/**
 * The things a talent gate is allowed to measure. Every one of them is either
 * settled before the run began or accumulated slowly over it, and none of them
 * is `fortune` - the attribute measure enumerates the three it will take and
 * luck is not among them.
 */
export const AgeTalentRequirementSchema = z.discriminatedUnion('measure', [
    z.object({
        measure: z.literal('years_cultivated'),
        atLeast: z.number().int().min(1),
        note: z.string().min(40)
    }),
    z.object({
        measure: z.literal('spirit_root_grade'),
        oneOf: z.array(SpiritRootGradeSchema).min(1),
        note: z.string().min(40)
    }),
    z.object({
        measure: z.literal('spirit_root'),
        /** Root keys from `SPIRIT_ROOTS`. Resolved by the test. */
        oneOf: z.array(z.string().min(3)).min(1),
        note: z.string().min(40)
    }),
    z.object({
        measure: z.literal('foundation_quality'),
        oneOf: z.array(FoundationQualitySchema).min(1),
        note: z.string().min(40)
    }),
    z.object({
        measure: z.literal('attribute'),
        /** Deliberately not `fortune`. See `FATE_IS_NOT_A_STAT`. */
        attribute: z.enum(['might', 'insight', 'charm']),
        atLeast: z.number().int().min(1).max(4),
        note: z.string().min(40)
    }),
    z.object({
        measure: z.literal('insight'),
        domain: InsightDomainSchema,
        atLeast: InsightDegreeSchema,
        note: z.string().min(40)
    })
]);
export type AgeTalentRequirement = z.infer<typeof AgeTalentRequirementSchema>;

/** The kinds of coincidence a fate gate is allowed to turn on. */
export const FateCoincidenceSchema = z.enum([
    /** Present when a thing happened that nobody could have scheduled. */
    'was_present',
    /** Turned something down, and the refusal is on a record somewhere. */
    'refused_something',
    /** Carrying an obligation that was not taken on deliberately. */
    'carries_an_obligation',
    /** Descent. Nobody chooses it and nobody can acquire it. */
    'bloodline',
    /** Disqualified by every ordinary reading, and that is the qualification. */
    'wrong_person',
    /** Got here without having gone looking, which looking destroys. */
    'arrived_without_looking'
]);
export type FateCoincidence = z.infer<typeof FateCoincidenceSchema>;

export const StrengthGateSchema = z.object({
    kind: z.literal('strength'),
    /** The realm ordinal the thing is set at. Compared against the claimant. */
    ordinal: z.number().int().min(0).max(MAX_ORDINAL),
    /** What is physically done to whoever is standing there. */
    test: z.string().min(100),
    /** What being under the ordinal costs. */
    below: z.string().min(100),
    /** Stated per gate so nothing downstream invents a side door. */
    noWorkaround: z.string().min(80)
});

export const AgeTalentGateSchema = z.object({
    kind: z.literal('age_and_talent'),
    requires: z.array(AgeTalentRequirementSchema).min(1),
    test: z.string().min(100),
    /** Why a cultivator far above the ordinal still walks out empty. */
    strengthDoesNotHelp: z.string().min(100),
    below: z.string().min(80)
});

export const FateGateSchema = z.object({
    kind: z.literal('fate'),
    coincidence: FateCoincidenceSchema,
    /** The predicate, phrased as a question about the world rather than the sheet. */
    worldStateCheck: z.string().min(100),
    /** Null, and the schema will not hold anything else. See `FATE_IS_NOT_A_STAT`. */
    characterStat: z.null(),
    whyItCannotBeFarmed: z.string().min(150),
    /** Who has ever satisfied it, which is frequently nobody. */
    whoHasEverPassed: z.string().min(80),
    below: z.string().min(80)
});

export const GateSchema = z.discriminatedUnion('kind', [
    StrengthGateSchema,
    AgeTalentGateSchema,
    FateGateSchema
]);
export type Gate = z.infer<typeof GateSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE PRE-ENTRY FACE
// Everything a party can learn without going in. Nothing here may restate
// anything from the interior.
// ─────────────────────────────────────────────────────────────────────────

export const OutsideSchema = z.object({
    /**
     * What is physically at the threshold. Names nobody: a marker that names
     * its occupant is a rumour with a stone under it, and the two are kept
     * apart so the awareness rule has something to withhold.
     */
    marker: z.string().min(80),
    /** What is said locally. May name the occupant. Withheld below `named`. */
    rumour: z.string().min(80),
    /** Attribution where anybody has one. Withheld below `named`. */
    attributedTo: z.string().min(2).nullable(),
    /**
     * What the last party to go in said before they went in. Never after,
     * because there is no after for most of them, and the ones who came out
     * did not describe the interior to anybody.
     */
    lastPartySaid: z.string().min(60).nullable(),
    /** The reading somebody who understands the world takes off the outside. */
    whatAKnowledgeablePartyReads: z.string().min(120),
    /** The reading everybody else takes. It is usually the expensive one. */
    whatAnIgnorantPartyConcludes: z.string().min(120),
    /** Where a fresh cultivator starts on the ladder of knowing. */
    startingAwareness: AwarenessSchema,
    /**
     * The ordinal the outside advertises, where it advertises one. This is the
     * number in the rumour, not the number in the room, and three entries here
     * disagree with their own interior on purpose.
     */
    advertisedOrdinal: z.number().int().min(0).max(MAX_ORDINAL).nullable()
});
export type Outside = z.infer<typeof OutsideSchema>;

// ─────────────────────────────────────────────────────────────────────────
// TRIALS
// ─────────────────────────────────────────────────────────────────────────

/**
 * What is on the far side. `immortalItemId` is `z.null()`: no trial in this
 * world hands out a golden pill or a talisman that came down, because
 * `immortal-items.ts` states the supply exists only as a grave and never as a
 * cache, and a trial is a cache with a door on it.
 */
export const PrizeSchema = z.object({
    /** Technique ids from `techniques.ts`. Resolved by the test. */
    techniqueIds: z.array(z.string().min(3)),
    /** Anything with no catalog entry, described plainly. */
    other: z.array(z.string().min(40)),
    immortalItemId: z.null()
});
export type Prize = z.infer<typeof PrizeSchema>;

export const TrialInteriorSchema = z.object({
    /** The room, physically, once somebody is standing in it. */
    chamber: z.string().min(150),
    /** Who set it and for whom. Nothing here adjusts to the claimant. */
    setBy: z.string().min(120),
    /** In the order they are met. */
    gates: z.array(GateSchema).min(1),
    /** How it kills, specifically. Not "a test of resolve". */
    howItKills: z.string().min(120),
    prize: PrizeSchema,
    /** What the site is once somebody has taken it. Usually: nothing. */
    afterwards: z.string().min(100)
});
export type TrialInterior = z.infer<typeof TrialInteriorSchema>;

export const InheritanceTrialSchema = z.object({
    id: z.string(),
    kind: z.literal('trial'),
    name: z.string().min(1),
    /** Faction ids from the sect catalog, living or destroyed. */
    factionIds: z.array(z.string()),
    outside: OutsideSchema,
    interior: TrialInteriorSchema
});
export type InheritanceTrial = z.infer<typeof InheritanceTrialSchema>;

// ─────────────────────────────────────────────────────────────────────────
// GRAVES
// ─────────────────────────────────────────────────────────────────────────

/**
 * How the occupant died, which decides what is left. The first two are the
 * tribulation cases and behave completely differently from the rest.
 */
export const MannerOfDeathSchema = z.enum([
    /** Struck down by heavenly tribulation at a boundary. A body is left. */
    'heavenly_tribulation',
    /** The last crossing, attempted and failed. There is no body. */
    'failed_crossing',
    'old_age',
    'duel',
    'killed_in_a_fight',
    'died_of_injuries'
]);
export type MannerOfDeath = z.infer<typeof MannerOfDeathSchema>;

/** What happened to the remains afterwards, which is a separate question. */
export const BurialSchema = z.enum([
    'left_where_they_fell',
    'interred_by_a_sect',
    'family_crypt',
    /** Not a burial at all: a scar with things lying on it. */
    'scar_field'
]);
export type Burial = z.infer<typeof BurialSchema>;

export const GraveGoodSchema = z.object({
    what: z.string().min(30),
    /**
     * True only where the item was on the body through a tribulation and is
     * still here. It is a warranty rather than a grade: nothing in the world
     * tests an object harder, and no forge can issue the equivalent claim.
     */
    proven: z.boolean(),
    /** What it survived. Null wherever nothing has ever tested it. */
    survived: z.string().min(40).nullable(),
    /** Technique id where the good is a manual the catalog already holds. */
    techniqueId: z.string().nullable(),
    /** Item id from `immortal-items.ts`. Almost always null, and correctly so. */
    immortalItemId: z.string().nullable()
});
export type GraveGood = z.infer<typeof GraveGoodSchema>;

export const GraveInteriorSchema = z.object({
    scene: z.string().min(150),
    /**
     * Almost always false. A grave is indifferent, and indifference is what
     * kills people at one: nothing on a corpse was calibrated to whoever finds
     * it. The exceptions are the interments, where somebody did arrange it.
     */
    arrangedForAFinder: z.boolean(),
    /** May be empty. An unguarded grave is the ordinary case. */
    gates: z.array(GateSchema),
    /**
     * Where the gate came from. `placed` is somebody's work, `accreted` grew
     * on the site after the fact, and `circumstance` is neither: the gate is a
     * property of the situation rather than of the ground, which is what a
     * site four days off any track has instead of a door. `none` is the
     * ordinary case and means the grave is open to anybody who finds it.
     */
    gateOrigin: z.enum(['placed', 'accreted', 'circumstance', 'none']),
    contents: z.array(GraveGoodSchema).min(1),
    /** What the manner of death did to the inventory, said plainly. */
    whatTheDeathDidToTheContents: z.string().min(120),
    afterwards: z.string().min(100)
});
export type GraveInterior = z.infer<typeof GraveInteriorSchema>;

export const GraveSchema = z.object({
    id: z.string(),
    kind: z.literal('grave'),
    name: z.string().min(1),
    factionIds: z.array(z.string()),
    /** The rank the occupant died at. */
    occupantOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
    yearsDead: z.number().int().min(1),
    /**
     * Top level rather than interior, because it is legible from the marker
     * and is the whole of the useful outside reading. See
     * `WHAT_THE_LIGHTNING_TOOK`.
     */
    mannerOfDeath: MannerOfDeathSchema,
    burial: BurialSchema,
    outside: OutsideSchema,
    interior: GraveInteriorSchema
});
export type Grave = z.infer<typeof GraveSchema>;

export const SiteSchema = z.discriminatedUnion('kind', [InheritanceTrialSchema, GraveSchema]);
export type Site = z.infer<typeof SiteSchema>;

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE LIGHTNING TOOK
// The inverse relationship, stated once, expressed as bands so the tests
// assert against the same table the entries were written from.
// ─────────────────────────────────────────────────────────────────────────

export const WHAT_THE_LIGHTNING_TOOK = {
    rule:
        'Heavenly tribulation destroys nearly everything the cultivator was carrying. What comes off a tribulation grave is a short list, and every item on it has survived the heaviest thing in the world. Anybody who died any other way leaves a full inventory that nothing has ever tested.',
    theInversion:
        'So the rich crypt is usually the weaker one. Three objects off a scar field beat forty out of an interment, item for item, and the party that took the forty is carrying more weight and better stories and worse equipment.',
    whyProvenIsWorthMore:
        'Because there is no other way to get the claim. A forge states what it intended, an assay house states what it measured, and both are opinions about behaviour under conditions nobody applied. An object that was on a body through a tribulation and is still an object has been through the only test that is not an opinion, and the people who understand this will pay a multiple for it that looks insane to anybody reading the inventory count.',
    whoKnowsThis:
        'Grave-readers, first and universally: it is the whole of their trade and the reason they can tell a grave from an inheritance on sight. The Gleaners know it as a working rule without having a theory about it. The Ninefold Ledger prices it correctly because it prices everything correctly. Raiding parties do not know it, sect expeditions know it and go to the rich crypt anyway because a scar field cannot be split nine ways, and the Thousand Treasure Pavilion catalogues by count because count is what buyers ask for.',
    theExceptionIsNotAnException:
        'A tribulation grave with a long inventory has been salted, and the salting is always the same trick: ordinary goods laid on a real scar so the provenance rubs off on them. Two of the three frauds the Ledger has established in four centuries were exactly this.',
    andAFailedCrossingLeavesNoBody:
        'The last crossing does not leave remains. What is on that ground is what fell out of a hand, and there is no body, no pouch, no arrangement and nobody to have arranged one. It is the shortest list in the world and it is the best.'
} as const;

/**
 * The two profiles, as data. `tribulation` covers `heavenly_tribulation` and
 * `failed_crossing`; `intact` covers everything else. The bands do not
 * overlap, which is the point: the shortest intact inventory is longer than
 * the longest tribulation one.
 */
export const GRAVE_CONTENTS_BANDS = {
    tribulation: { minItems: 1, maxItems: 3, allProven: true },
    intact: { minItems: 5, maxItems: 14, allProven: false }
} as const;

/**
 * The third category, kept out of this file on purpose.
 *
 * A sealed ancestor's chamber is not a grave. The occupant is not dead, the
 * site was not left to be found, nothing in it was arranged for a claimant,
 * and opening one is a waking rather than a recovery, with an entirely
 * different set of consequences and an entirely different catalog
 * (`sealed-ancestors.ts`) holding them.
 *
 * The distinction is load-bearing rather than tidy. A party that treats a
 * resting place as a grave is robbing somebody who is going to be awake in a
 * minute, and a party that treats a grave as a resting place leaves the best
 * find of their career on the floor because they are frightened of it.
 */
export const A_RESTING_PLACE_IS_NOT_A_GRAVE = {
    rule: 'A chamber in `sealed-ancestors.ts` holds a live person and is not in this catalog under any circumstances.',
    theThreeCategories: [
        'trial: arranged deliberately, calibrated for a claimant who was expected to arrive, and it does not adjust to the one who does.',
        'grave: arranged for nobody. Whatever the occupant was carrying is where they stopped, and none of it is the right size for the finder.',
        'resting place: occupied. Not this file. Opening it wakes somebody, and what happens next is a conversation rather than a recovery.'
    ],
    theOverlapThatIsRealAnyway:
        'One entry here is a grave that shares a wall with a resting place, which happens because the world is not tidy: a man went in on a wager, died on the far side of the Gleaners\' sealed part, and the Company sealed it again with him inside. He is a grave. What is deeper in that building is not, and the entry says so rather than letting a reader blur them.',
    howToTell:
        'The marker. A resting place has maintenance on it - a swept floor, a repaired channel, a schedule somebody keeps - because somebody is keeping something alive. A grave has weather on it.'
} as const;

// ─────────────────────────────────────────────────────────────────────────
// THE TRIALS
// ─────────────────────────────────────────────────────────────────────────

export const INHERITANCE_TRIALS: readonly InheritanceTrial[] = [
    // ── strength ──────────────────────────────────────────────────────
    {
        id: 'trial-the-outer-gate-that-does-not-adjust',
        kind: 'trial',
        name: 'The Outer Gate of a Sect That No Longer Exists',
        factionIds: ['sect-nine-peaks-ascetic-order'],
        outside: {
            marker: 'A double gate in a hillside, cut for people rather than for effect, with a worn step and a bar socket on the inside face. The stone around the sockets is polished to a shine by four centuries of hands and nothing else about it is decorated at all.',
            rumour: 'The ascetics call it the low gate and say it is where a dead order used to test its intake, which is why nobody serious goes: an intake test is for children, and everything worth having is behind the intake test rather than at it.',
            attributedTo: 'An order the Nine Peaks absorbed the remnants of, whose name the ascetics use and do not write down',
            lastPartySaid: 'Three from a Scarwater culling crew went in saying it was an afternoon and that the only risk was the walk. All three were at Qi Condensation and none of them had been told what the intake ordinal of a Foundation-grade order looks like.',
            whatAKnowledgeablePartyReads: 'An intake gate is calibrated for the intake of the sect that cut it, and a Foundation-grade order tested its applicants at Foundation. The bar socket is on the inside, so it was barred by the people running the test and not by the applicants, which means the test was supervised and the supervision is what is missing now. Nothing supervises it. It simply runs.',
            whatAnIgnorantPartyConcludes: 'That an outer gate is the easy one, because in a living sect the outer gate is where the fourteen-year-olds queue. The word outer is doing all the work in that sentence and it is a word about position rather than difficulty.',
            startingAwareness: 'named',
            advertisedOrdinal: 4
        },
        interior: {
            chamber: 'A stone hall thirty paces long with a raised walk down the middle and a channel either side, both dry. At the far end is a plain bronze plate on a pivot, sized for a person to put both hands on, and there is nothing else in the room at all. The channels were for water, and the water was so the supervisors could see where somebody fell.',
            setBy: 'The order that cut it, as a working intake test for applicants at Foundation Establishment, run four times a year for something over three hundred years with a physician standing at the far end of the walk. The physician is the part that is gone.',
            gates: [
                {
                    kind: 'strength',
                    ordinal: 13,
                    test: 'The plate discharges the accumulated pressure of the hall into whoever has both hands on it, in one push, at the load an applicant at Foundation Establishment Early was expected to hold for a count of six. It is not a trick and there is nothing to read. It is a measured amount of force applied to a body, and the measurement has not changed since the order that took it stopped existing.',
                    below: 'Below Foundation the body has nothing to spread the load through, and what happens is the thing the channels were cut to drain. Qi Condensation cultivators are killed by it outright at the lower layers and crippled at the upper ones, which is the outcome the Scarwater crew got and the reason two of them are in the margins catalog now.',
                    noWorkaround: 'There is no approach, no partial contact and no way to take it in stages. The plate is the door and the door is one event. Parties have tried levering the pivot, which discharges it into the lever and then into them.'
                }
            ],
            howItKills: 'By doing exactly what it was built to do to somebody it was not built for. Nobody is ambushed here and nothing is concealed: the applicant puts their hands on the plate because that is plainly what the plate is for, and the load arrives. The deaths are all the same death and the site has been producing it four times a year for nobody, for four hundred years.',
            prize: {
                techniqueIds: [],
                other: [
                    'The order\'s intake standard, cut into the reverse of the plate: what it required, at what rank, and the physician\'s note on the three ways applicants failed it. The third way is not one the Nine Peaks currently teaches against.',
                    'A rack of forty-one applicant tallies behind the plate, each one a name and a result, which is the only surviving roll of that order and is worth a great deal to anybody arguing an ancestral claim.'
                ],
                immortalItemId: null
            },
            afterwards: 'The plate discharges once and then takes about eleven years to build back up, which the order knew and scheduled around. A party that takes the tallies has taken everything; a party that comes back in twelve years finds the door working again and nothing behind it.'
        }
    },
    {
        id: 'trial-the-eighth-stone',
        kind: 'trial',
        name: 'The Chamber Under the Eighth Stone',
        factionIds: ['house-girdle-of-nine-stones', 'house-anchorhold'],
        outside: {
            marker: 'One of eight standing stones on a dead province\'s perimeter, all still upright, all still doing something. This one has a shaft cut down beside it at an angle, lined, with a rail bracket every four paces and the rail long gone.',
            rumour: 'Perimeter people call it the eighth and will tell you the shaft goes to a maintenance chamber, which is true. What they will not tell you, because the Anchorhold employs them, is that the maintenance chamber is where the house that cut the stones kept its method.',
            attributedTo: 'The Girdle of Nine Stones',
            lastPartySaid: 'An Anchorhold survey team went down eleven years ago to document the shaft for the standard. Their report is one page, describes the lining and the brackets, and stops.',
            whatAKnowledgeablePartyReads: 'Eight stones are standing and the ninth socket is empty and the wrong size. A containment ring that lost a stone did not stop containing; it redistributed, and the load the missing stone carried is now spread across the eight. This one has a chamber under it, so this one is where the redistribution is measured, which means this one is carrying more than its share and has been for nine hundred years.',
            whatAnIgnorantPartyConcludes: 'That eight standing stones out of nine is a ruin in good condition. The arithmetic runs the other way: a ring at full strength is inert, and a ring carrying a ninth of itself extra is a thing under load with a chamber at the bottom of the worst-loaded leg.',
            startingAwareness: 'whisper',
            advertisedOrdinal: 20
        },
        interior: {
            chamber: 'A round room at the foot of the shaft, floored in a single piece, with the stone\'s foot coming through the ceiling and standing clear of it by a finger all the way round. The gap is deliberate and is the only decoration in the room. On the wall opposite the shaft is the method, cut in full, in a hand the Anchorhold does not use.',
            setBy: 'The Girdle, as a maintenance chamber and as a test at once, because a house whose principle was fixity did not distinguish between them: the person allowed to read the method was the person who could stand where the method was, and standing there was the qualification. It was calibrated for the Girdle\'s own perimeter staff at Deity Transformation, and the redistribution has raised it since.',
            gates: [
                {
                    kind: 'strength',
                    ordinal: 26,
                    test: 'Crossing the floor puts the stone\'s share of the ring on the claimant, because the gap between the stone\'s foot and the ceiling is where the load is read and a body in the room is read as part of the ring. It is a steady, unvarying, entirely impersonal compression that does not build and does not stop. It was set at Deity Transformation for a house that had nine stones, and it is being carried by eight.',
                    below: 'It puts people on the floor in the first ten paces and then keeps them there, which is survivable for as long as somebody outside is willing to come in and drag them out, and nobody outside is. The shaft is forty paces of angle and the last party to try a recovery lost the recovery team as well.',
                    noWorkaround: 'The load is the room. There is no shielded corner, the gap cannot be packed, and a formation laid on the floor is read as part of the ring and loaded accordingly. Three attempts have been made to prop the ceiling; the props are still there and the room does not care.'
                }
            ],
            howItKills: 'Slowly and without any drama at all. Nobody is struck. People walk in, get a third of the way, stop being able to stand, and are still alive when they stop being able to breathe, which takes long enough that every recovery attempt in the site\'s history was launched on good information and arrived too late anyway.',
            prize: {
                techniqueIds: ['anchor-nail-of-the-broken-girdle'],
                other: [
                    'The containment method cut in full on the far wall, which is the partial manual the Anchorhold will not cite, complete, with the section the Anchorhold\'s copy is missing.',
                    'The load figures for all nine stones as they were before the eastern nail went, which is the only document in the world that proves the Girdle\'s containment was intact when it was broken.'
                ],
                immortalItemId: null
            },
            afterwards: 'Nothing changes. The stone carries what it carries, the room is still the room, and a second party can walk in the next day and be killed by it in the same way. This is the only trial in the catalog that does not spend itself, because it was never a trial: it is a working part of a machine that is still running.'
        }
    },
    {
        id: 'trial-the-nine-hundred-year-strike',
        kind: 'trial',
        name: 'The Hall That Has Been Winding Up',
        factionIds: ['sect-nine-abyss-flame-sect'],
        outside: {
            marker: 'A refining hall at the end of a spur, roof intact, doors gone, with a single node lit at the back of it and the floor swept clean by the draught. Standing outside, the air over the threshold moves against the wind.',
            rumour: 'The caldera villages say it is a hall that never went out and that the Flame Sect leaves it alone out of respect. The Flame Sect leaves it alone because it has read the node.',
            attributedTo: null,
            lastPartySaid: 'A four-person Gleaner crew took a contract on it eighteen years ago and the leader said the sensible thing, which was that a single lit node in a dead hall is a fortune and the risk is the roof.',
            whatAKnowledgeablePartyReads: 'A node that is lit and drawing and has nothing to spend on is a node that is storing, and a formation that has been storing for nine hundred years has one number attached to it. The air moving against the wind at the threshold is the discharge condition being nearly met by a person walking through it.',
            whatAnIgnorantPartyConcludes: 'That a lit node is loot and that nine centuries of nobody touching it is nine centuries of nobody bothering. The Flame Sect is four days away and has a refining guild in its pocket; the reason it has not collected a live node off its own doorstep is the whole of the information available from outside, and it is available for free.',
            startingAwareness: 'whisper',
            advertisedOrdinal: 12
        },
        interior: {
            chamber: 'A single long room with the furnace bed down the middle, cold, and the node at the far end on a plinth at chest height. Everything between the door and the plinth is clear floor. The hall was built to discharge into one person standing at the plinth, and it has never done it.',
            setBy: 'A refining house of the caldera, as the last stage of its own mastery examination: the candidate stood at the plinth and took what the hall had stored since the previous candidate, which in a working house was two or three years. The house was ended in a season and nobody stood at the plinth again.',
            gates: [
                {
                    kind: 'strength',
                    ordinal: 31,
                    test: 'The hall discharges nine hundred years of stored draw into whoever reaches the plinth, in one event, as fire. There is no rising edge and no warning: the condition is proximity and the discharge is complete. It was designed to deliver two years of storage to a Core Formation candidate and it is holding four hundred and fifty times that.',
                    below: 'Everything under Void Refinement Third Tempering is cinders, immediately, along with anything they were carrying and anything within about nine paces of them. The eighteen-year-old Gleaner contract is the most recent instance and the site is measurably cleaner for it.',
                    noWorkaround: 'The condition is a body at the plinth. Sending a construct, a beast, a hired man or a corpse discharges it into that instead, which is a legitimate way to empty the hall and is what the Flame Sect would do if it wanted the node. It does not get anybody the thing on the plinth, because the thing on the plinth is destroyed by the discharge as well.'
                }
            ],
            howItKills: 'Instantly, completely, and to everyone in the room rather than only the one who triggered it. There is no wounded and there is no witness, which is why the site has no accumulated warning attached to it and keeps taking crews on the same reasoning as the last crew.',
            prize: {
                techniqueIds: ['cinder-of-the-first-sun'],
                other: [
                    'The node itself, intact, which after the discharge is an ordinary dead node and worth what the stone is worth.',
                    'The house\'s examination record, in a case under the plinth, listing every candidate it passed and the two it did not, with the reasons.'
                ],
                immortalItemId: null
            },
            afterwards: 'Empty, permanently. The hall stored because it was drawing on a vein branch that the caldera\'s own workings have since cut, so it discharges once and then it is a long room with a cold furnace in it. Whoever takes it takes the only one there will be.'
        }
    },

    // ── age and talent ────────────────────────────────────────────────
    {
        id: 'trial-the-audit-bench',
        kind: 'trial',
        name: 'The Bench at the Burned Seat',
        factionIds: ['house-tally-court', 'house-ninefold-ledger', 'sect-sweptground-temple'],
        outside: {
            marker: 'A stone bench and a stone table on the burned ground at Sweptground, both original, both cut for somebody to sit at one and put documents on the other. There is no building. Debts sworn on this ground do not settle and never have.',
            rumour: 'The monks say the bench is where the old house heard cases and that sitting on it is bad luck, which is the Temple being polite. The Ledger says nothing about the bench in any document anybody outside the Ledger has read.',
            attributedTo: 'The Tally Court',
            lastPartySaid: 'A Ledger circuit arbiter sat at it nine years ago on her own initiative, spent two hours, stood up and wrote nothing. She has been asked and says that it was not a matter for the house.',
            whatAKnowledgeablePartyReads: 'A karma house left a working bench on ground where obligations do not discharge, which is not a monument. It is a bench that is still in session. And the Ledger, which destroyed that house and holds nine sealed volumes with no subject line, has had an arbiter sit at it and produce no record, which is the loudest thing the Ledger has ever not said.',
            whatAnIgnorantPartyConcludes: 'That it is furniture on a burned site and the site itself is the curiosity. Parties camp on the ground, swear things to each other for the novelty of watching the oath not take, and go home without having sat down.',
            startingAwareness: 'named',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'Sitting down is entering. The table acquires a ledger, which was not there and is not an illusion, open at a page in the middle, in a hand that has been out of use for two thousand three hundred years. There is no room, no door and nothing to fight. There is a bench, a table, an open book and however long the claimant is willing to sit there.',
            setBy: 'The Tally Court, as the bench itself rather than as a test set on the bench: a karma house did not build examinations, it built instruments, and the instrument is a case waiting to be heard. What it wants is a reading, and it has been waiting for one since the house was ended by its own auditors.',
            gates: [
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'insight',
                            domain: 'karma',
                            atLeast: 3,
                            note: 'Sword intent and karmic intent are the same order of thing: the point at which comprehension stops being description and starts being able to act on the subject.'
                        },
                        {
                            measure: 'attribute',
                            attribute: 'insight',
                            atLeast: 3,
                            note: 'The hand is dead, the accounting convention is dead, and the ledger does not explain itself. Reading it is a matter of what the reader can hold in their head at once.'
                        },
                        {
                            measure: 'years_cultivated',
                            atLeast: 60,
                            note: 'The page is a running total of obligations across four generations of a bloodline, and somebody who has not watched three of anything happen has no shape to fit it to.'
                        }
                    ],
                    test: 'Read the open page and say what the total is. That is the whole of it. The page is the Tally Court\'s working of what the crossings have taken out of everyone, carried forward two millennia, and the entry the bench is waiting on is the one the house was in the middle of when it was ended.',
                    strengthDoesNotHelp: 'Nothing in the room can be pushed, broken, opened or outlasted, and the bench does not care how hard the person sitting on it can hit. A Body Integration cultivator with no karmic comprehension sits there for a day and reads a column of numbers in an unfamiliar hand, which is exactly what it is, and stands up having learned nothing.',
                    below: 'Nothing happens. That is the failure state, and it is worse than a hostile one: the claimant sits, reads, works, does not get it, and leaves believing the bench is inert, which is the account every party who has failed it has given and the reason the Temple thinks it is furniture.'
                }
            ],
            howItKills: 'It does not, and that is the trap. Nobody has ever died at the bench. What it costs is the thing a karma house always charged: a reader who gets far enough to be entered as having read, and then stops, is entered as having taken the matter up, and the Sweptground ground does not discharge what is sworn on it. Two of the four people known to have got that far carry an obligation they cannot identify and cannot pay, and one of them is a bloodline in the eastern towns.',
            prize: {
                techniqueIds: ['severed-thread-audit', 'unpayable-tally-brand'],
                other: [
                    'The page itself, which is the Tally Court\'s total, and the identity of the party it entered as owing it. The Ledger has nine sealed volumes and has never opened them; this is the other half of that.',
                    'Standing, at the bench, to hear anything sworn on that ground. It is a real office with no institution behind it and no way to resign.'
                ],
                immortalItemId: null
            },
            afterwards: 'The bench is still there and still in session. What changes is that it now has somebody sitting at it, in the record it keeps, and the next party to sit down is a second reader rather than the first. Nobody has established what that does.'
        }
    },
    {
        id: 'trial-the-swept-frame',
        kind: 'trial',
        name: 'The Gate Frame With No Gate In It',
        factionIds: ['house-unlit-gate', 'house-measured-span'],
        outside: {
            marker: 'A stone frame standing in the yard of a Measured Span relay station, swept daily by the station staff because it is in the way of the cart line and they have always swept it. Nothing is in the frame. Standing anywhere in the yard, it is a doorway with a wall of the yard visible through it.',
            rumour: 'The couriers say the Span keeps it for the look of the thing and that the old house it came from opened a span it could not hold. Station staff say it is a nuisance and that the founder\'s wife would not let it be moved.',
            attributedTo: 'The Unlit Gate House',
            lastPartySaid: 'Nobody has gone in, because there is nothing to go into. The last person to take the frame seriously was a Span surveyor forty years ago who measured it, found it eleven fingers out of square, remeasured it from the other side and found it square, and did not write the second measurement down.',
            whatAKnowledgeablePartyReads: 'Thirty-one terminals, twenty-two closed and nine still answering, and this one is swept daily by people who do not know what they are sweeping. A frame that measures differently from two sides is not out of square. It is open, at a width nothing can pass, and it has been open the whole time.',
            whatAnIgnorantPartyConcludes: 'That an empty frame is a ruin with the interesting part missing. Everybody who has ever stood in that yard has walked through it without incident, which is the strongest possible evidence that nothing is there and is the reason nobody looks twice.',
            startingAwareness: 'named',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'Standing in the frame with the right comprehension, the yard on the far side is not the yard. It is a terminal hall, unlit, with thirty-one arches around it and a floor of unswept dust holding no footprints at all. Nine of the arches are answering. Four of those open somewhere a person can breathe. The claimant is in the hall and the yard is behind them at a width nothing can pass.',
            setBy: 'The Unlit Gate House, which did not build a test and did not need to: a space house left its terminal hall open and let the frame do the sorting, on the reasoning that anybody who could see the hall was already somebody the house could talk to. The house went to war for eleven years and burned in a season, and the sorting has been running unattended for fourteen hundred years.',
            gates: [
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'insight',
                            domain: 'formation',
                            atLeast: 4,
                            note: 'Not reading a formation. Seeing the frame as the working part rather than the empty part, which is a change of subject rather than a degree of skill.'
                        },
                        {
                            measure: 'spirit_root_grade',
                            oneOf: ['single', 'dual', 'mutated'],
                            note: 'A span is held open through the aperture the claimant draws through, and a muddled root cannot hold a width. The house recruited on this and said so.'
                        },
                        {
                            measure: 'years_cultivated',
                            atLeast: 40,
                            note: 'Formation comprehension at this degree does not arrive early in anybody, and the house never took a candidate under forty years in.'
                        }
                    ],
                    test: 'See the frame. That is all, and it is not a metaphor: the frame is open and has been open continuously, and the entire test is whether the person standing in it perceives the hall or the yard. Everybody who has walked through it has walked through the yard, correctly, because the yard is also there.',
                    strengthDoesNotHelp: 'There is nothing to apply force to. A Grand Ascension cultivator with a muddled root and no formation comprehension walks through a stone frame in a courier yard and arrives in a courier yard, every time, and could do it a thousand times. The frame is not resisting them. It is not addressed to them.',
                    below: 'Nothing at all. The claimant walks through a doorway and comes out the other side of a doorway, and there is no indication that anything failed, because from that side nothing did.'
                },
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'attribute',
                            attribute: 'insight',
                            atLeast: 4,
                            note: 'Nine arches are answering, four are survivable, and the difference between them is legible for about as long as it takes to walk to one.'
                        }
                    ],
                    test: 'Pick an arch, or leave. Nine answer. Four open somewhere a person can breathe and five do not, the marks that distinguish them are in the house\'s own convention, and the convention is on the hall floor under fourteen hundred years of dust that holds no footprints because nothing has walked on it.',
                    strengthDoesNotHelp: 'The five bad arches are not fights. They are places, and the objection they raise to a body is not one that force is a reply to. Whatever a claimant could survive at their rank is irrelevant to whether there is air.',
                    below: 'A wrong arch is the end of the entry, immediately, and the frame in the courier yard measures eleven fingers out of square the next morning and nobody notices.'
                }
            ],
            howItKills: 'By offering nine doors when four are doors. There is no violence in the hall and nothing pursues anybody: the claimant reaches a terminal that opens onto vacuum, or onto pressure, or onto somewhere that is not a place, and the arch does not close behind them because it was never closed. Five of the twenty-two shut terminals were shut from this side by somebody who had been through them.',
            prize: {
                techniqueIds: ['gate-that-was-closed'],
                other: [
                    'The house\'s terminal convention, on the hall floor, which is what makes the nine answering gates in the world usable rather than lethal by anyone who holds it.',
                    'Four working terminals, and the standing ability to reach a courier yard in the Low Fall from wherever the other ends of them are. The Measured Span has spent nine hundred years and a great deal of money on the problem this solves.'
                ],
                immortalItemId: null
            },
            afterwards: 'The hall is unchanged and the frame is still open and still in the way of the cart line. Anybody who can see it can go back, which makes this the only entry in the catalog that is not spent by being taken, and the reason the prize is a convention rather than an object.'
        }
    },
    {
        id: 'trial-the-cold-curriculum',
        kind: 'trial',
        name: 'The Curriculum Cut Above the Ice Field',
        factionIds: ['sect-frostmirror-court'],
        outside: {
            marker: 'A ledge two days above the Frostmirror ice field with a face of dressed stone across it, cut over with a script that is legible, complete, and in the ordinary hand of the province. Anybody who can read can read it. It is a curriculum: nine sections, in order, with the exercises written out.',
            rumour: 'The Court makes no secret of it and will give directions. Court disciples are taken up in their first year and shown it, and the phrase used is that it is the older curriculum and that it is not for them.',
            attributedTo: 'Whoever cut the ice curriculum the Frostmirror Court teaches out of, before the Court existed',
            lastPartySaid: 'The Court sends a party every eleven years as a matter of standing practice. Nine of the last twelve came back down having read the whole face and understood every word of it, and said so in identical language.',
            whatAKnowledgeablePartyReads: 'A curriculum in plain script on an open ledge, in a province where every institution hoards, and the sect that lives below it has been unable to use it for four hundred years despite reading it annually. Nothing is hidden. The obstacle is not the text.',
            whatAnIgnorantPartyConcludes: 'That the Court is sitting on an open transmission out of institutional stupidity, and that a competent outsider could take it in an afternoon. Six outside parties have attempted it in living memory on exactly that reasoning.',
            startingAwareness: 'named',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'The ledge is the chamber. Working the first section is entering, and the first section takes about four hours. There is no door, nothing closes, and a claimant can walk away at any point up until the sixth section, after which walking away is the failure rather than the exit.',
            setBy: 'Whoever dug the curriculum out of the glacier, for their own students, without a thought that it might need to be legible to anybody else, because it was written by somebody teaching a room of people who all had the same aperture and it never occurred to them that this was a fact about the room.',
            gates: [
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'spirit_root',
                            oneOf: ['mutated_ice'],
                            note: 'The exercises route qi through a channel a wuxing root does not have. It is not harder for a fire root; it is not addressed to one, and the fourth section is the point at which that stops being an inconvenience.'
                        },
                        {
                            measure: 'years_cultivated',
                            atLeast: 25,
                            note: 'Nine sections, each of which is a working exercise rather than a reading, and the sixth cannot be held by anybody who has not done a great deal of ordinary sitting first.'
                        },
                        {
                            measure: 'foundation_quality',
                            oneOf: ['exceptional', 'stable'],
                            note: 'The seventh section takes the foundation apart and puts it back. An unstable one does not go back.'
                        }
                    ],
                    test: 'Work the nine sections in order, on the ledge, which takes about five weeks. The text is complete and there is nothing to decipher. What is being tested is whether the body doing the exercises is the kind of body they were written for, and the answer arrives at the fourth section and is not negotiable.',
                    strengthDoesNotHelp: 'The Court has sent Nascent Soul and Core Formation cultivators up every eleven years for four hundred years and it has changed nothing, because the fourth section is a channel a root either has or does not, and rank does not open one. This is the clearest case in the catalog: the strongest party ever sent up that ledge got no further than the weakest.',
                    below: 'A wuxing root that pushes past the fourth section on determination tears something in the fifth, and the tear is the ordinary meridian injury that the ordinary pill fixes if it is bought inside a season. Nobody has died on the ledge. Four people have come down with a permanent one because the Court\'s stipend does not cover the pill.'
                }
            ],
            howItKills: 'It does not kill and it never has, which is precisely why the Court can send a party every eleven years and why six outside parties have tried it. What it does is cost five weeks and, for the ones who push, the thing a torn meridian costs somebody who cannot afford sixty stones. The site\'s casualty record is entirely in the margins catalog and none of it looks like a trial death.',
            prize: {
                techniqueIds: ['void-tide-breathing-canon'],
                other: [
                    'The nine sections, held rather than read, which is the older and better version of what the Frostmirror Court currently teaches and which the Court would recognise in one demonstration.',
                    'The last section, which is not an exercise. It is the author\'s note on where the glacier material came from and what she thought it was, and it does not agree with the Court\'s account.'
                ],
                immortalItemId: null
            },
            afterwards: 'The face is stone and does not wear. Anybody with the root can go and do it, which the Court knows, which is why the Court\'s entire recruiting posture is built on finding ice roots before anybody else does. One in a hundred, and the Court survives on the intake.'
        }
    },
    {
        id: 'trial-the-foundation-that-was-not-finished',
        kind: 'trial',
        name: 'The Cave That Checks the Work',
        factionIds: ['sect-azure-cloud-pavilion'],
        outside: {
            marker: 'A cultivation cave in the Nine Peaks with a cut lintel, a sealed inner door, and an outer chamber somebody has plainly lived in. On the outer chamber floor, in the original hand, is a single line: what is behind the door was laid slowly and will not be given to anybody who did not.',
            rumour: 'Sect towns have known about it for two centuries and treat it as a joke about the Pavilion, which recruits hard and pushes intake through Foundation fast. The line on the floor is quoted in taverns.',
            attributedTo: null,
            lastPartySaid: 'Eleven parties are recorded at the door in the last century. Every one of them read the line, and every one of them concluded it was rhetoric, because it is exactly the thing an elder says and never the thing a door checks.',
            whatAKnowledgeablePartyReads: 'That the line is not rhetoric and is a specification. Somebody who cut a door and then wrote what it opens for was describing a mechanism, and foundation quality is a real property of a real structure that a formation can read as easily as it reads a rank.',
            whatAnIgnorantPartyConcludes: 'That it is a moralising inscription, which every ruin has, and that the door is a door. Nine of the eleven parties tried to open it by force and the two who did not were the ones who could not afford the attempt.',
            startingAwareness: 'named',
            advertisedOrdinal: 17
        },
        interior: {
            chamber: 'A single seat chamber with a spirit gathering array cut into the floor, still running at a fraction, and a chest at the back. The array is the reader: sitting in it for the length of a single circulation is the whole examination, and the chest opens or it does not.',
            setBy: 'A Core Formation cultivator of no particular reputation who laid her foundation over nineteen years in thin qi and finished it, and who left what she had to whoever had done the same. She did not care about rank, sect, root or lineage, and the door does not check any of them.',
            gates: [
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'foundation_quality',
                            oneOf: ['exceptional', 'stable'],
                            note: 'The array reads the structure directly. A foundation with a part that was never formed reads as a foundation with a part that was never formed, at any rank, forever.'
                        },
                        {
                            measure: 'years_cultivated',
                            atLeast: 19,
                            note: 'Her own number, used as the floor rather than as a comparison. She took nineteen years and thought anybody who took less had been given something.'
                        }
                    ],
                    test: 'Sit in the array through one full circulation, which is about half an hour, and let it read the foundation. There is nothing to do well. The array is not measuring the circulation; the circulation is how the array gets a look at the structure underneath it.',
                    strengthDoesNotHelp: 'Rank is not foundation quality and the world is full of people who prove it. A Nascent Soul cultivator who was pushed through Foundation on a borrowed pill in thin qi reads exactly as incomplete as they did at Foundation Establishment Early, because that is what incomplete means, and the chest stays shut for them and opens for a Core Formation cultivator four ranks below.',
                    below: 'The chest does not open and the array puts the claimant out of the room, gently, in the sense that they are outside and unhurt and the door is shut. It is the only trial in the catalog with a polite failure, which is why the eleven parties all escalated to force: nothing had happened yet and force was the obvious next step.'
                }
            ],
            howItKills: 'By being forced. The array is not a defence and has none, but the inner door is cut into a Nine Peaks vein wall, and every party that has tried to open a vein wall by force in that province has learned what the Ascetic Order does about it. Two of the nine recorded attempts ended at the door; the other seven ended two days later on the Order\'s terms.',
            prize: {
                techniqueIds: ['lifespring-of-the-jade-pool'],
                other: [
                    'Her method, written out over nineteen years in the plainest prose in the catalog, on how to lay a foundation slowly in thin qi with nothing bought. It is worth almost nothing to anybody past Foundation and everything to the four-fifths of the world that will never leave it.',
                    'A chest of ordinary goods: her pills, her stones, her spare robe. She was not rich and did not pretend to be.'
                ],
                immortalItemId: null
            },
            afterwards: 'The array keeps running and the chest is empty. The method is the part that matters and it copies, which she intended: the note on the lid says to take it and leave the door open, and every party that has ever got in has shut it again.'
        }
    },

    // ── fate ──────────────────────────────────────────────────────────
    {
        id: 'trial-the-witness-door',
        kind: 'trial',
        name: 'The Door That Wants Somebody Not In the Record',
        factionIds: ['house-girdle-of-nine-stones', 'house-anchorhold', 'house-held-names'],
        outside: {
            marker: 'A door in the perimeter wall of the dead province, on the inside face, with no handle, no seam visible and no formation anybody has been able to read. Girdle descendants living at the perimeter have known it was a door for nine hundred years and have never seen it open.',
            rumour: 'The descendants say it opens for a witness and will not say to what, because the answer they have is the family answer and has been repeated for thirty generations without being understood. The Anchorhold\'s standard lists the wall and does not list the door.',
            attributedTo: 'The Girdle of Nine Stones',
            lastPartySaid: 'Nobody goes. There is no attempt record because there is nothing to attempt: parties arrive, find a flat piece of wall that is known to be a door, and leave.',
            whatAKnowledgeablePartyReads: 'A house whose principle was fixity, destroyed by a house that broke its nail and then wrote the history, left a door on the inside face of the wall the argument was about. What such a house wants preserved is testimony, and what it built to preserve it is not going to accept a testifier the surviving house could have arranged.',
            whatAnIgnorantPartyConcludes: 'That it is a sealed door on a dead perimeter and that the seal is the problem. Four formation readers have been paid to look at it in the last century and all four reported that there is nothing there to read, which is correct.',
            startingAwareness: 'whisper',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'A room the size of a stair landing with a single bench, and on the wall opposite the bench, cut small and close, the Girdle\'s own account of the four days: what the load did, in what order, and what the perimeter staff were doing while it happened. It is not a manifesto. It is a duty log, and it runs to the hour the province died.',
            setBy: 'The Girdle, in the four days, by somebody who understood what was about to be written about them and could not do anything about it except leave the log where the winning house would not think to look and could not open if it did.',
            gates: [
                {
                    kind: 'fate',
                    coincidence: 'was_present',
                    worldStateCheck: 'Was the claimant present at an event that a surviving institution has since given an official account of, and does the claimant appear nowhere in that account? Both halves are required. The door is not looking for a witness; it is looking for a witness who was left out, which is a fact about somebody else\'s paperwork.',
                    characterStat: null,
                    whyItCannotBeFarmed: 'The second half destroys itself the moment it is pursued. Being absent from an official record is not an achievement a person can work towards, because any action taken to secure it is itself the kind of action that gets recorded, and the institutions that write these accounts write them about the people who were doing things. The claimants who satisfy it are the ones who were standing somewhere when something happened and were not important enough to name, and a cultivator who has arranged to be unimportant at a specific event has been noticed arranging it.',
                    whoHasEverPassed: 'Twice in nine hundred years, and neither of them was looking for the door. One was a Girdle descendant who had been at a perimeter failure the Anchorhold wrote up without mentioning the perimeter staff. The other was a caravan cook.',
                    below: 'The wall is a wall. There is no reaction, no partial opening and no indication that the claimant was assessed, which is why the descendants have a family answer they cannot check.'
                }
            ],
            howItKills: 'It does not, and nothing in the room is dangerous. What it costs is what the log costs: it is dated, specific, and directly contradicts the founding account of a house that administers eleven perimeters and employs most of the people who live near this wall. Both people who have read it understood inside a page what carrying it would mean, and one of them left it where it was.',
            prize: {
                techniqueIds: [
                    'nameless-witness-stance',
                    // The wide-span treasure, and the only door onto it.
                    //
                    // It is here rather than anywhere else because the gates
                    // agree. The door opens for somebody a house wrote an
                    // account of an event without troubling to name, and the
                    // book was written by somebody who held one method from
                    // the foundation to the integrated body and appears never
                    // to have learned that everybody else changes books - which
                    // is not a thing that happens to a person with colleagues.
                    // Its own gate is `domain: 'void'` at the deepest degree
                    // the catalog uses, and a comprehension of absence is what
                    // this door has always been measuring.
                    'single-road-treatise'
                ],
                other: [
                    'The duty log of the four days, in the Girdle\'s hand, which is the only document in the world that establishes the containment was intact when the eastern nail was broken.',
                    'The names of the perimeter staff, which the House of Held Names does not have and which the descendants at the wall have been unable to claim rank on for nine hundred years.'
                ],
                immortalItemId: null
            },
            afterwards: 'The door shuts and does not open for the same person twice. The log stays where it is, because it is cut into the wall, so what a claimant leaves with is what they can carry in their head and the ability to say they read it, which the Anchorhold will contest and cannot disprove.'
        }
    },
    {
        id: 'trial-the-oath-with-no-party',
        kind: 'trial',
        name: 'The Oath Room Under a Dyer\'s Yard',
        factionIds: ['house-tally-court', 'house-bound-word', 'house-ninefold-ledger'],
        outside: {
            marker: 'A vault head in the eastern towns, brick, in the corner of a yard behind a dyer\'s, with the surround cut in a pattern the dyer\'s family has repainted for six generations without knowing it is writing.',
            rumour: 'The towns say the branded families keep something in the yard, which the branded families deny, and the denial is honest: they know the vault is there and none of them has ever been able to open it.',
            attributedTo: 'The Tally Court',
            lastPartySaid: 'The Ninefold Ledger surveyed the yard forty years ago on an unrelated audit, recorded the vault head as a disused cistern, and moved on. Nobody has attempted it since, because the Ledger said it was a cistern.',
            whatAKnowledgeablePartyReads: 'A karma house that was ended left standing oaths behind it, and an oath sworn to a party that no longer exists does not lapse, it simply has nobody to discharge it to. A vault in the middle of the bloodline that inherits an unidentifiable obligation is where the other end of those oaths is kept.',
            whatAnIgnorantPartyConcludes: 'That it is a cistern, on the authority of the institution best placed to know, which is a reasonable thing to believe and is the reason the vault has been sitting behind a dyer\'s for two thousand three hundred years.',
            startingAwareness: 'unaware',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'Four steps down into a dry brick chamber with racking on three walls and, on the racking, oath tokens. Several thousand of them, each one a physical object somebody swore on, each still current, none of them discharged, all of them owed to a house that has not existed since before the current calendar.',
            setBy: 'The Tally Court, as ordinary business. This is not a treasury and was never a trial; it is the filing room for a class of obligation the house held, and it is shut to everybody because the house that could open it was dissolved and the lock is the house.',
            gates: [
                {
                    kind: 'fate',
                    coincidence: 'carries_an_obligation',
                    worldStateCheck: 'Does the claimant carry an obligation whose counterparty no longer exists, that they did not take on and cannot identify? The vault reads the obligation rather than the person: the branded bloodline satisfies it by descent, and so does anybody who swore on the burned ground at Sweptground, and so does anybody who was made surety for somebody else by a party that has since been dissolved.',
                    characterStat: null,
                    whyItCannotBeFarmed: 'The requirement is that the counterparty is gone, and a person cannot arrange to owe something to a dissolved house, because the swearing has to have happened while the house was alive and every such house is two millennia dead. The only live routes into the category are inheritance, which is descent, and the Sweptground bench, which produces the obligation as a side effect of a failure rather than as a reward for one. Nobody has ever obtained one on purpose. Two people have obtained one by trying to get something else.',
                    whoHasEverPassed: 'Nobody, in the whole recorded history of the eastern towns. The branded families satisfy the condition and none of them has ever known the vault was a vault, which is the entire situation in one sentence.',
                    below: 'The steps are not there. From the yard it is a brick surround over filled ground, and a claimant who does not carry the obligation can dig it out and find soil, which two people have done.'
                }
            ],
            howItKills: 'It does not kill and it cannot be forced, and the danger is entirely downstream. Several thousand current oaths with no holder is not treasure; it is a position, and the party that holds it can call on obligations that predate every institution now standing. The Ninefold Ledger was founded by the auditors who ended the Tally Court and holds nine sealed volumes on the subject, and it would arrive.',
            prize: {
                // No technique. A karma house filed obligations here rather than
                // arts, and the third Tally Court fragment is grave-only in
                // `techniques.ts`, which a trial is not.
                techniqueIds: [],
                other: [
                    'The oath tokens, and with them standing to call on several thousand obligations that have had nobody to answer to for two thousand three hundred years.',
                    'The register the tokens are filed against, which names the branded bloodline\'s original obligation and what it was for. Thirty generations have inherited it without being told, and the answer is in the first drawer.'
                ],
                immortalItemId: null
            },
            afterwards: 'The vault stays open for whoever opened it and shuts to everybody else, permanently, on the same condition. It is the one entry here that produces an ongoing institutional position rather than an object, and the reason it is written that way is that a karma house did not build anything else.'
        }
    },
    {
        id: 'trial-the-door-that-wants-a-refusal',
        kind: 'trial',
        name: 'The Step That Was Put Down Again',
        factionIds: ['sect-azure-cloud-pavilion', 'sect-the-severed', 'house-narrow-hour'],
        outside: {
            marker: 'A cut chamber mouth high on a spur above the Pavilion\'s outer holdings, open, unsealed, with a stone box on a plinth just inside the threshold and nothing else visible from outside. The box is closed. It has been closed for six hundred years and it is not locked.',
            rumour: 'The Pavilion knows about it, has sent people, and describes it in its own records as an empty cave with a box in it that will not open. Outer disciples are told the story as an example of how much of the world is nothing.',
            attributedTo: 'A Pavilion elder who was given something and gave it back',
            lastPartySaid: 'A Pavilion inner disciple went up nine years ago with a stated intention to break the box, which is on the record because she filed the intention. She came down having not broken it and having declined to say why.',
            whatAKnowledgeablePartyReads: 'The Pavilion holds seven of the nine known lower-grade Unearned Steps, is the deepest stock in the world, and has a six-hundred-year-old cave above its own holdings with an unlocked box in it that its own people cannot open. An institution that holds seven does not leave an eighth in a cave by accident. Somebody refused one, and what is in the box is the refusal.',
            whatAnIgnorantPartyConcludes: 'That an unlocked box that will not open is a formation problem, and that the Pavilion has failed to solve it because the Pavilion is complacent. Every party that has gone up has arrived holding that sentence.',
            startingAwareness: 'whisper',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'A single chamber, swept, with a seat cut into the floor, a plinth, and the box. On the wall behind the seat is the elder\'s note, four lines, which says what he was offered, by whom, on what terms, and that he sat here for a season and then walked down and said no. It does not say why and the fourth line says explicitly that it is nobody\'s business.',
            setBy: 'The elder, who put it here because he wanted the thing kept and did not want it used, and who worked out that the only custodian who would not spend it is one who had already declined to.',
            gates: [
                {
                    kind: 'fate',
                    coincidence: 'refused_something',
                    worldStateCheck: 'Has the claimant refused an offer that would have advanced them, from a party in a position to make it, and is the refusal on somebody\'s record? The box reads a recorded refusal - the kind `immortal-items.ts` calls a recorded refusal, held by the party who was turned down rather than by the one who did the turning.',
                    characterStat: null,
                    whyItCannotBeFarmed: 'Because the offer is not the claimant\'s to arrange. Somebody with standing has to have decided to advance them and been told no, and a cultivator cannot cause the first half: the parties who make such offers make them for their own reasons, rarely, to people they have already chosen. What a player controls is only the answer, and the answer is only available to somebody who was asked. Manufacturing the ask - arranging to be offered something in order to decline it - has been attempted once, by somebody who understood the box, and the party making the offer withdrew it when the arrangement became apparent, which is what such parties do.',
                    whoHasEverPassed: 'One person in six hundred years, who was not looking for the cave and had refused a placement from the Ninefold Ledger eleven years earlier over something unrelated.',
                    below: 'The box does not open, cannot be broken, and is not protected. Parties have taken it away with them; it is a stone box a hundred paces down the spur and it still does not open, and eventually somebody carries it back up because carrying it down was the whole of the idea.'
                }
            ],
            howItKills: 'It does not, and the elder was specific about that in the note: he did not want a guarded thing, he wanted an unspendable one. The cost is entirely in what opening it makes true about the claimant, because the Pavilion knows what is in the box and will know within a season who has it, and the House of the Narrow Hour has had a standing sighting on the cave for four hundred years.',
            prize: {
                techniqueIds: [],
                other: [
                    'A lower-grade Unearned Step, unspent, which is the object `immortal-items.ts` says never appears in an inheritance and which is here for the only reason that rule allows: it was not left as a prize, it was put down by somebody who did not want it, and the box is not a cache because there is not and never will be a second one.',
                    'The elder\'s four lines, which are the only first-hand account in either province of being offered one and declining, written by the person who did it.'
                ],
                immortalItemId: null
            },
            afterwards: 'The box is empty and stays where it is. The Pavilion sends somebody within the year and does not attempt to recover the Step, which would be an admission, and instead opens a lineage audit on the claimant, which is the response its records show it has already decided on.'
        }
    },
    {
        id: 'trial-the-ground-that-wants-the-wrong-claimant',
        kind: 'trial',
        name: 'The Ground That Is Waiting For Somebody It Should Not Want',
        factionIds: ['sect-bone-lantern-cult', 'sect-lantern-hall'],
        outside: {
            marker: 'A cleared circle in the burn zone, forty paces across. The burnt floor inside it has not been disturbed since the catastrophe and the burnt floor outside it is walked flat. Nothing grows in either. Crews have used the edge as a landmark for four generations and none of them steps in, for reasons nobody in the Marches has ever been able to state.',
            rumour: 'Gleaners say the circle takes people and that it is one of the honest hazards, meaning one that does not pretend. The Bone Lantern Cult has sent parties and describes it, in its own vocabulary, as ground that is still owed something.',
            attributedTo: null,
            lastPartySaid: 'Six people have walked into the circle in recorded memory. Five of them walked out, unhurt, within a minute, and reported that there was nothing there. The sixth did not come out and there is no body.',
            whatAKnowledgeablePartyReads: 'Five out of six is not a hazard and it is not a trial either. It is a filter with a very narrow acceptance, and the one who did not come out was the one it accepted. Everything the Gleaners avoid it for is wrong, and the reason it is not more dangerous is that it is almost never interested.',
            whatAnIgnorantPartyConcludes: 'That the five who walked out prove it is empty and the sixth had bad luck, which is the reading five of the six themselves gave and is why the Cult has stopped sending parties.',
            startingAwareness: 'whisper',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'Standing in the middle of the circle with the condition satisfied, the burnt floor is gone and the circle is a floor, and the floor is the top of something the catastrophe drove into the stone with a person still working in it. The working is unfinished. It is a preparation for a transfer of a kind the Lantern Hall would recognise and the Bone Lantern Cult would pay a great deal for, and the party it was prepared for did not arrive.',
            setBy: 'Somebody in the catastrophe who had four thousand years less warning than they needed and set up a transfer with the vessel condition left open, on the reasoning that a specified vessel is a vessel who has to survive the same event and an unspecified one is anybody. It has been open ever since and has been offered exactly once.',
            gates: [
                {
                    kind: 'fate',
                    coincidence: 'wrong_person',
                    worldStateCheck: 'Is the claimant somebody the transfer would ordinarily reject - damaged identity continuity, a soul that has already been moved once, a body that is not the one they were born in - and are they standing in the circle? The condition is a disqualification everywhere else in the world, and here it is the qualification, because a vessel that has already been transferred once is the only kind this working can take without a specified counterpart.',
                    characterStat: null,
                    whyItCannotBeFarmed: 'Because the qualifying state is the outcome of a catastrophe that happened to the claimant, not a preparation they made. Everybody in the world who satisfies it acquired it by going into a sealed site and not entirely coming out, or by having a vessel arranged for them in an emergency by somebody who is usually dead now. Nobody has ever done that on purpose to open a door, and the Cult, which has thought about it, has established that a deliberately damaged continuity reads as deliberate and is refused - which is a rule it obtained the expensive way.',
                    whoHasEverPassed: 'The sixth, who was a Gleaner with three days she could not account for and had been carrying it for eleven years when she stepped in on a dare.',
                    below: 'Nothing. The claimant stands on burnt ground for a minute and walks out, and every one of the five said afterwards that they had felt something look at them and lose interest, and every one of them was told they had imagined it.'
                }
            ],
            howItKills: 'By completing. Nobody is attacked and nothing resists: the working takes the claimant because that is what it is for, and what comes out the other side is a question about identity continuity rather than about survival. The sixth is not recorded as dead anywhere. She is also not recorded as anything else, and the Lantern Hall, which keeps the lists of people no longer remembered by anyone who knew them, has an entry.',
            prize: {
                techniqueIds: ['severed-fate-mending-art'],
                other: [
                    'The working, complete, which is a method for a transfer with an open vessel condition and is the thing the Bone Lantern Cult has been trying to reconstruct for four hundred years.',
                    'Whatever the person in the stone was, at whatever fraction of themselves survived four thousand years of an unfinished preparation, and no guarantee whatever about which party the result answers to.'
                ],
                immortalItemId: null
            },
            afterwards: 'The circle is burnt ground and stays burnt ground. Whether it is spent depends on what the working did, and nobody has ever been in a position to establish it, because the only person who knows is the only person the question is about.'
        }
    },

    // ── the two apex doors ────────────────────────────────────────────
    // Everything above holds a heaven- or immortal-grade inheritance and is
    // gated in that band. These two are the only sites in the catalog set at
    // the top of the ladder, and they are set there because the arts behind
    // them were written by people standing at Grand Ascension and above. The
    // gate ordinals are not decoration: a party that can beat the door can
    // also, by construction, survive being at the door, and nothing here
    // adjusts downward for a party that cannot.
    {
        id: 'trial-the-fourth-branch-station',
        kind: 'trial',
        name: 'The Station At the Bottom of the Fourth Branch',
        factionIds: ['apex-deep-survey', 'court-kiln'],
        outside: {
            marker: 'A stair head cut into the floor of a dry arterial gallery, treads worn on the left side only, with a bracket for a rail every four paces and no rail. A depth figure is cut at every hundredth tread. The stair goes down further than the gallery is high and does not turn.',
            rumour: 'Gallery crews call it the counting stair and will tell you it goes to a pumping chamber, which is what a stair with depth marks on it usually goes to. What is at the bottom of it is a survey station, and the house that cut it does not answer questions about the fourth branch from anybody who is not already in it.',
            attributedTo: 'The Deep Survey',
            lastPartySaid: 'A Gleaner crew took a paid descent nine years ago on a contract that specified the first thousand treads and no further. They came back up on schedule, were paid, and one of them has since twice refused to say what the air was like below the eight hundredth.',
            whatAKnowledgeablePartyReads: 'Depth marks on a stair are not decoration, they are a working instrument, and an instrument is cut by somebody who intended to take readings for a long time. A stair with a figure at every hundredth tread and no rail was used by people who went down it constantly and were not carrying anything. What is at the bottom is therefore an occupied post rather than a store, and a post at the bottom of an arterial branch was abandoned for a reason that is still down there.',
            whatAnIgnorantPartyConcludes: 'That a maintained stair with numbers on it goes somewhere administrative, and that the danger of a deep gallery is the walk. The walk is not the danger and never was: the stair is in good order the whole way down because nothing has been able to get up it to damage anything, and the party that reads good order as safety has drawn exactly the wrong conclusion from exactly the right observation.',
            startingAwareness: 'whisper',
            advertisedOrdinal: 24
        },
        interior: {
            chamber: 'A cut room at the foot of the stair, twelve paces by nine, with a working bench along one wall and a sump gate in the floor. The gate is a hand span across, faced in worked stone, and shut. Beyond it is water the branch has never lifted and no light has ever been in. The far wall is the station record, cut rather than written, in two courses: the upper course is how the gate is opened and shut, and the lower course is the anatomy of the thing the station spent two hundred years measuring through it.',
            setBy: 'The Deep Survey, as a working station rather than as a test, calibrated for its own surveyors and for nobody else. It was staffed continuously for two hundred and ten years by people who went down that stair every day, took a reading through the sump gate, and came back up, and it does not adjust for anybody: the room is the room it was, the water is at the pressure it is at, and the last surveyor to leave shut the gate behind her and went up.',
            gates: [
                {
                    kind: 'strength',
                    ordinal: 36,
                    test: 'The bottom third of the stair is below the branch and the air in it is under the head of the whole column. It is a steady, unvarying load applied to a body for the eleven hours of the descent, and it does not build, warn or stop. The Survey set nothing here at all; the depth is the test and the figure the depth works out to is Body Integration Marrow, which is where its own surveyors stood.',
                    below: 'The load begins telling somewhere around the six hundredth tread and is unsurvivable by the thousandth, and the failure is entirely ordinary: a cultivator under the ordinal keeps descending because nothing has happened yet, and the point at which something happens is a long way below the point at which they could still have walked back up. Two of the Survey\'s own losses in two centuries were this and both were experienced.',
                    noWorkaround: 'There is no staged descent and no cache that helps. A rest at depth costs more than it returns because the load is continuous rather than cumulative, and every attempt to lower somebody on a line has ended with a line and no body on it. The stair is eleven hours down and eleven hours back and both halves are paid at the same rate.'
                },
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'insight',
                            domain: 'element',
                            atLeast: 3,
                            note: 'The upper course is a gate onto water at a pressure the reader has to hold in their head while reading it, and a reader without water intent gets the sequence right and the timing wrong, which opens the gate and does not shut it.'
                        },
                        {
                            measure: 'years_cultivated',
                            atLeast: 120,
                            note: 'The station hand is a survey notation rather than a script, abbreviated by people who used it daily for two centuries, and nobody reads an abbreviation they have not spent decades around.'
                        }
                    ],
                    test: 'Reading two courses of survey notation off a wall in a room the reader cannot stay in indefinitely. The upper course is the gate and the lower course is what is on the other side of it, and they are cut in the order the Survey used them rather than in the order a stranger would want them.',
                    strengthDoesNotHelp: 'The Gleaner crew that reached the nine hundredth tread nine years ago included a Body Integration cultivator on hire who could have walked into the room and did not, because the contract stopped where it stopped. Somebody who does walk in and cannot read the wall is standing in a cut room with a shut gate in the floor and no reason to open it, and the ones who open it anyway are why the Survey shut the station.',
                    below: 'The wall stays a wall. Nothing kills anybody for failing to read it, and a party that gets to the bottom and cannot read the courses has made the most expensive wasted journey available in either province.'
                }
            ],
            howItKills: 'By the descent, in almost every case, and by the sump gate in the rest. The gate opens onto water at the head of a branch that has never been lifted, and a reader who has the sequence and not the timing opens a hand-span hole into it inside a twelve-pace room with one stair out. The room fills in under a minute. Three of the four bodies the Survey recovered in two centuries were recovered from the stair rather than the room, because they had got most of the way up.',
            prize: {
                techniqueIds: ['abyssal-gate-torrent', 'dragonbone-severing-decree'],
                other: [
                    'Two hundred and ten years of readings off the fourth branch, in sequence, which is the only continuous record of an arterial branch anybody has ever taken and is the document the Deep Survey has been quietly reconstructing from memory for eight hundred years.',
                    'The last surveyor\'s closing note, four lines, giving the date the station was shut and the reason, and the reason is not the one the Survey now records.'
                ],
                immortalItemId: null
            },
            afterwards: 'The station is a room and stays a room. The gate can be opened again and the water is not going anywhere, so the site does not spend itself and a second party can go down and be killed by it in the same two ways. What does change is that the courses can be cut out of the wall, and the first party to do that takes the only copy.'
        }
    },
    {
        id: 'trial-the-four-inward-faces',
        kind: 'trial',
        name: 'The Four Stones That Face the Standing Ground',
        factionIds: ['apex-long-cut', 'court-ninth-face'],
        outside: {
            marker: 'A ring of boundary stones on high open ground, set at a spacing nobody local uses, enclosing about two hundred paces of ground on which nothing grows and nothing has for a very long time. Four of the stones are cut on the faces that point inward. From outside the ring the four faces cannot be seen at all.',
            rumour: 'The Marches will tell you it is where the authorisations are taken, and that a person is walked up there and left, and that whoever walks up does not walk down. All three parts are true and none of them is what the stones are for.',
            attributedTo: 'The Long Cut',
            lastPartySaid: 'Nobody organises an entry. Herders cross the ring every season on the shortest line between two grazings and have done for centuries, and not one of them has ever had a reason to walk to a stone and look at the side facing away from them.',
            whatAKnowledgeablePartyReads: 'A ring is an enclosure and an enclosure has an inside. Cutting on the inward faces means the cutting was done by somebody who was already inside and expected the reader to be inside too, and the only people who have ever been inside that ring on purpose are candidates who were walked up there to attempt the last crossing. Four faces means four of them stopped on the way to their own death and cut something, which is not a thing a person does casually.',
            whatAnIgnorantPartyConcludes: 'That the ring is a marked hazard, which it is, and that the stones are the marking, which they are not. Every account of the site in either province describes it from outside, because describing it from outside is free and does not involve standing on two hundred paces of ground that has taken nine hundred years of what comes down at a crossing.',
            startingAwareness: 'whisper',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'Two hundred paces of open ground under open sky, with four cut faces on it that can only be read from where the candidate stood. Each face carries one character in a different hand from a different century, and the four hands are separated by three hundred years at the widest. The four characters are the same character. They are cut at the same size, with the same stroke order, and they agree with each other exactly, which is the whole of what the site has to say and is not a small thing to have established.',
            setBy: 'Four candidates of the Long Cut, separately, none of whom knew what the others had done, each in the hours before an attempt at the last crossing. Nobody arranged it and nobody calibrated it for anybody; it is four people writing down the one thing they had that they did not want to take up with them, in the only place they were certain a later candidate would be standing.',
            gates: [
                {
                    kind: 'strength',
                    ordinal: 37,
                    test: 'The ring returns nothing and takes steadily, and the reading is not quick: four faces at four points of a two-hundred-pace ring, each of which has to be worked out rather than glanced at, in ground that has absorbed nine centuries of authorised attempts and has not recovered from any of them. A claimant on that ground spends continuously from the moment they cross the line and cannot stop spending until they are off it.',
                    below: 'Below Grand Ascension the reserve does not cover the reading. It comfortably covers a crossing of the ring, which is why herders are fine and why every account of the ground says it is harmless, and it does not cover standing still on it for the two or three days the four faces actually take. The bodies are always found inside the ring and always sitting down.',
                    noWorkaround: 'Nothing carried supplies the difference, for the same reason nothing does on any tribulation ground: a pill or a stone gives back qi the ground then takes at the same rate. Copying a face and reading it elsewhere has been done twice, and what comes off the stone is one character, which is not the transmission and never was.'
                },
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'insight',
                            domain: 'void',
                            atLeast: 4,
                            note: 'The character does not name a thing. What a reader has to arrive at is what four people about to die thought was worth one stroke each, and a reader below the fourth degree gets a shape they can copy and cannot say.'
                        }
                    ],
                    test: 'Establishing that the four hands agree. Any reader can see four characters; what the site is actually offering is the fact that four people three centuries apart cut the identical thing, which means the thing is fixed and therefore sayable, which is the entire content of the inheritance.',
                    strengthDoesNotHelp: 'Two parties have crossed the ring at strength, read all four faces, copied them accurately and left with nothing, because a copy of a character is not a pronunciation and neither is four copies. The Long Cut holds both sets of rubbings in its own archive and has never got anything out of them either.',
                    below: 'The reader leaves with four accurate copies of one character and no art. It is the commonest outcome by a distance and it is not a punishment; it is simply what a written record of a sound is worth to somebody who has never heard the sound.'
                }
            ],
            howItKills: 'By the ground, and only by the ground. Nothing on this site is hostile, nothing is concealed and nothing was set for anybody: a claimant walks in, begins reading, spends at a rate they have not budgeted for because the ring gives nothing back, and sits down. Six bodies have been recovered inside the ring in four hundred years and every one of them was found sitting, upright, facing a stone, at a distance from the line they could have walked twice over on the morning they arrived.',
            prize: {
                techniqueIds: ['calamity-word-of-the-open-sky'],
                other: [
                    'Four names, four dates and four ranks at the moment of attempt, cut small at the foot of each face, which is a better record of what the last crossing takes than anything the Long Cut has ever published.',
                    'The plain fact that the four hands agree, which is worth more to the House of Held Names than the art is, and which the Long Cut would prefer stayed on the stones.'
                ],
                immortalItemId: null
            },
            afterwards: 'Nothing changes and nothing is spent. The stones are stones, the ring is still ground that gives nothing back, and the next claimant reads the same four faces. What the site loses when somebody takes it is exclusivity, which the Long Cut has never had and has never wanted, because a candidate who cannot get to the ring is not a candidate it would have authorised.'
        }
    }
];

// ─────────────────────────────────────────────────────────────────────────
// THE GRAVES
// The manner of death is on the outside because it is legible from the
// marker, and it is the whole of the useful reading. See
// `WHAT_THE_LIGHTNING_TOOK`.
// ─────────────────────────────────────────────────────────────────────────

export const GRAVES: readonly Grave[] = [
    // ── the matched pair ──────────────────────────────────────────────
    {
        id: 'grave-shen-guyi',
        kind: 'grave',
        name: 'The Interment of Shen Guyi',
        factionIds: ['court-third-sill'],
        occupantOrdinal: 44,
        yearsDead: 160,
        mannerOfDeath: 'old_age',
        burial: 'interred_by_a_sect',
        outside: {
            marker: 'A dressed chamber front in a hillside above an arterial branch, faced in worked stone, with a course of inscription along the lintel giving a name, a rank at the end of Tribulation Transcendence, a date, and the words that he sat. The masonry is maintained. Somebody comes.',
            rumour: 'Nothing in the Low Fall knows what the court is, so the rumour is that a very old cultivator is buried up there and that whoever put him there had money. Both halves are true and neither is the interesting part.',
            attributedTo: 'Shen Guyi',
            lastPartySaid: 'Two parties are known to have gone in. The second, forty years ago, was eleven people out of three sects who pooled the cost of the approach and said openly that a Tribulation Transcendence interment was the largest single haul available in the province.',
            whatAKnowledgeablePartyReads: 'That he sat. The lintel says it and the lintel is not being poetic: he reached the end of the ladder and did not attempt the crossing, so nothing he owned was ever tested by anything, and he had eleven years of knowing he was going to die in which to give away everything with a name on it. What is behind that stonework is the residue of a very long life and not one item of it has been through anything.',
            whatAnIgnorantPartyConcludes: 'That a maintained interment of somebody at ordinal forty-four is the richest thing in the province, which is true by count and by weight and by resale, and which is why the eleven went in and why they were correct about the money and wrong about everything else.',
            startingAwareness: 'named',
            advertisedOrdinal: 44
        },
        interior: {
            scene: 'Three connected chambers, dry, swept before they were closed. He is seated in the third with his hands on his knees and has not decayed, because at that rank the body does not, and the effect on people who were expecting remains is documented in both entry accounts. The chambers are full. There are eleven years of a life at the top of the ladder in them and none of it is arranged for display, because he was not arranging anything, he was living somewhere and then he stopped.',
            arrangedForAFinder: false,
            gates: [
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'attribute',
                            attribute: 'insight',
                            atLeast: 3,
                            note: 'The inner door is closed against the divestment ledger, which is a list of what he gave away and to whom, and the door wants the list read back in the order he gave it.'
                        },
                        {
                            measure: 'years_cultivated',
                            atLeast: 30,
                            note: 'The order is a courtesy order rather than a chronological one, and nobody who has not spent decades watching institutions take precedence from each other can reconstruct it.'
                        }
                    ],
                    test: 'The first two chambers are open. The third is closed against the sequence of his divestment, which is cut on the inside of the second chamber door in full: forty-one entries, recipient and item, in the order he chose. Saying the order back is the door.',
                    strengthDoesNotHelp: 'The eleven pooled a Nascent Soul cultivator for the approach and got through the outer stonework in a morning. The third door is not stone, it is a reading, and they spent nine days on it and took what was in the first two chambers, which is why the third is still shut.',
                    below: 'The third chamber stays closed and the outer two are open to anybody, which is the arrangement that has held for a hundred and sixty years and has been robbed twice.'
                }
            ],
            gateOrigin: 'placed',
            contents: [
                {
                    what: 'Six sets of robes at a quality nobody in the province manufactures, folded, in a chest that is itself worth a year of a culler\'s gross.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A sitting mat he used for something over two hundred years, worn through in the same two places every mat is worn through.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Eleven pill cases, ten of them empty and labelled, one full and labelled for a crossing.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'His own annotated copies of four manuals whose originals are named in the divestment ledger as having gone to four different institutions.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A working set of formation plates, complete, ordinary, of the kind a person at that rank would have owned for convenience rather than for power.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Spirit stones, loose, in quantity, none of it counted or bagged.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A copy of an art at immortal grade that he had held for a century and a half and never had occasion to use.',
                    proven: false,
                    survived: null,
                    techniqueId: 'void-fold-pilgrimage',
                    immortalItemId: null
                },
                {
                    what: 'The divestment ledger itself, in the third chamber, which is the only document in the province that says who currently holds forty-one specific objects.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'The one incomplete copy anybody knows of the Chaos Origin Scripture, open, in the third chamber, on a stand at the height of a seated man. It is the thing he was still doing on the day he stopped, it is not in the divestment ledger, and the ledger is in the same room, which is as close as the record comes to saying he meant to keep it.',
                    proven: false,
                    survived: null,
                    techniqueId: 'chaos-origin-scripture',
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'Nothing whatever, and that is the entire point of the entry. He died of old age at the top of the ladder in a chamber somebody had built for him, so every object in it is exactly as it was when he acquired it, tested by nothing, warranted by nobody, and the eleven who took the first two chambers sold it all at a fair price and were not cheated and did not get anything good.',
            afterwards: 'The court replaced the outer stonework after the second robbery, which is the only visible act it has ever performed in the province, and did not pursue anybody. The third chamber is still shut.'
        }
    },
    {
        id: 'grave-yun-baiheng',
        kind: 'grave',
        name: 'Eleven Li of Ground In the High Marches',
        factionIds: ['court-ninth-face', 'sect-weir-office'],
        occupantOrdinal: 44,
        yearsDead: 90,
        mannerOfDeath: 'failed_crossing',
        burial: 'scar_field',
        outside: {
            marker: 'Eleven li of high ground that has not held qi in ninety years and will not again. There is no stone, no name and no mound, because there is nothing to put one over. The boundary of it is exact and visible from a distance in the way the vegetation stops.',
            rumour: 'The Marches knows what it is. It is the most recent attempt anybody in either province can date and everybody local can point at it, and what they will tell you is that a person went up there alone one spring and the sky came down on her.',
            attributedTo: 'Yun Baiheng',
            lastPartySaid: 'Nobody has organised an entry, because there is no entry. Gleaners walk the scar every few years on the way to somewhere else and pick things up off the surface, which is exactly the correct method and none of them thinks of it as a dig.',
            whatAKnowledgeablePartyReads: 'A failed crossing leaves no body and almost no goods, and everything still lying on that ground went through the heaviest event that occurs anywhere in the world and is still an object. There are perhaps three things on eleven li of ground. Each of them is warranted by the only test that is not somebody\'s opinion, and no forge, no assay house and no auction in either province can issue the equivalent claim about anything.',
            whatAnIgnorantPartyConcludes: 'That eleven li of dead ground with three things on it is a poor site, which by count and by weight it is, and that the interment forty days south with a maintained stone front is where the money is. Every party that has had to choose between the two has chosen the interment.',
            startingAwareness: 'named',
            advertisedOrdinal: 44
        },
        interior: {
            scene: 'Open ground, and the whole of the site is walking on it. There are no chambers, no seal and no arrangement; the crossing was attempted in the open because that is how it is attempted, and what did not go up and did not burn is lying where it landed under ninety years of nothing growing over it. The ground itself does not hold qi and a cultivator crossing it draws on their own reserve the entire way, which is the only thing here that has killed anybody.',
            arrangedForAFinder: false,
            gates: [
                {
                    kind: 'strength',
                    ordinal: 21,
                    test: 'Crossing eleven li of ground that returns nothing. A cultivator on the scar spends and does not recover, at a rate that does not vary and does not care who they are, and the far end of it is five days at a walking pace from the nearest ground that gives anything back.',
                    below: 'Below Nascent Soul the reserve does not last the crossing at any pace, and the failure is the ordinary one: somebody sits down in the middle of eleven li of dead ground to rest and does not get up. Four of the six recorded deaths on the scar are this, and all four were experienced people who had correctly assessed everything except the arithmetic of the distance.',
                    noWorkaround: 'Nothing can be carried that supplies the difference, because pills and stones both give back qi the ground then takes, at the same rate, which is the property the tribulation left in it. Two parties have tried staging caches and found the caches inert.'
                }
            ],
            gateOrigin: 'accreted',
            contents: [
                {
                    what: 'A sword she had carried for two hundred years, on the surface, unmarked, with the fittings burned off it and the blade untouched.',
                    proven: true,
                    survived: 'The heavenly tribulation of the last crossing, in direct contact, which is the heaviest event that occurs anywhere under the Lid and the only test in the world that is not an opinion about behaviour under conditions nobody applied.',
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A single formation plate out of a set of nine, the other eight of which are not on the scar and are not anywhere.',
                    proven: true,
                    survived: 'The same event, at whatever distance it was from her when it happened, and the eight that are missing are the measure of what that means.',
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A case of the court\'s own manufacture, closed, containing the countersigned authorisation for the attempt and nothing else. She was carrying the paperwork.',
                    proven: true,
                    survived: 'The crossing, closed, which the Weir Office has been told about and has never been able to get the Long Cut to acknowledge in writing.',
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'It took everything else, including her. A failed crossing does not leave a body and it did not leave a pouch, a manual, a stone, a pill or a robe: what is on eleven li of ground is three objects, and they are three objects because the lightning went through everything she had and these did not stop being things. The inverse is exact - the poorest inventory in this catalog and the only one with a warranty on it.',
            afterwards: 'The scar is permanent and will not hold qi again. What comes off it comes off it once, and the Long Cut has not authorised a candidate since, which means there is unlikely to be another site of this kind in either province in anybody\'s lifetime.'
        }
    },

    // ── the rest of the tribulation cases ─────────────────────────────
    {
        id: 'grave-the-forty-first-boundary',
        kind: 'grave',
        name: 'The One Who Was Struck At the Boundary',
        factionIds: ['sect-storm-tyrant-court', 'house-ninefold-ledger'],
        occupantOrdinal: 40,
        yearsDead: 410,
        mannerOfDeath: 'heavenly_tribulation',
        burial: 'left_where_they_fell',
        outside: {
            marker: 'A tribulation scar about two hundred paces across on a shoulder of open moor, four hundred years old, with the ground inside it fused to a depth nobody has dug through. There is a body in it, visible, not buried, which is the part every account of the site opens with.',
            rumour: 'It is on the local maps as the burned man. The Ninefold Ledger holds the name in its ledgers and has never released it, and the Storm Tyrant Court has twice asked for it and been refused on a procedural ground.',
            attributedTo: null,
            lastPartySaid: 'Nine parties are recorded. The most recent, sixty years ago, was four people who said the sensible thing: that a Grand Ascension cultivator struck at the last boundary would have been carrying everything and that four centuries of weather is not enough to move it.',
            whatAKnowledgeablePartyReads: 'He was struck going into Tribulation Transcendence, which means he was at Grand Ascension Rising Dao and carrying a lifetime, and it means the lightning had all of it. Whatever is still on that ground is what forty thousand years of accumulated everything could not put in front of it fast enough. There will be two or three things and they will be extraordinary, and the reason nine parties have come away with nothing is that they were looking for a hoard.',
            whatAnIgnorantPartyConcludes: 'That a visible body at ordinal forty is the most valuable single object in the province and that the goods are under it or near it in quantity. Six of the nine parties spent their whole expedition digging out the fused ground on that reasoning.',
            startingAwareness: 'named',
            advertisedOrdinal: 40
        },
        interior: {
            scene: 'Fused ground, a body lying face up in the middle of it in the position it landed in, and, close to the right hand, two objects. That is the site. The digging pits from six expeditions are around the edge and none of them found anything, because there was never anything to find below the surface: what survived was in contact with him and what was not in contact with him is gone.',
            arrangedForAFinder: false,
            gates: [
                {
                    kind: 'strength',
                    ordinal: 29,
                    test: 'The fused ground still discharges. Four hundred years on it holds a residual that lifts and earths itself through anything crossing the last thirty paces to the body, in irregular events, at a measured output that the Ledger surveyed once and recorded.',
                    below: 'Under Void Refinement the discharge is lethal on a bad interval and crippling on a good one, and the intervals are not periodic and have never been predicted by anybody. Three of the nine parties lost people to it and all three were working the outer pits when it happened, which is why the pits are where they are: nobody has ever got closer.',
                    noWorkaround: 'Insulation does not work, because what earths through a body earths through whatever the body is standing in. Two parties have tried approaching along a laid conductor and both discovered that the conductor is a better route than the ground and that they were standing on it.'
                }
            ],
            gateOrigin: 'accreted',
            contents: [
                {
                    what: 'A jade slip in his right hand, whole, containing a chaos-grade art that no institution below the Lid can transmit and that the Ledger\'s own index does not list.',
                    proven: true,
                    survived: 'The tribulation at the last mortal boundary, in a closed hand, which is a warranty nobody in either province can issue about anything and the reason a single slip off this scar is worth more than the eleven-man haul out of a maintained interment.',
                    techniqueId: 'kalpa-fire-that-eats-heaven',
                    immortalItemId: null
                },
                {
                    what: 'A ring, plain, on the same hand, which is a storage ring and is empty. Everything in it went and the ring did not.',
                    proven: true,
                    survived: 'The same event, and the emptiness is the evidence: whatever was inside was destroyed through a container that was not, which nobody has an account of.',
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'It destroyed a lifetime at Grand Ascension and left two objects touching a hand. Everything a cultivator at ordinal forty owns, and there is no way to overstate that quantity, went through the boundary tribulation and did not come out, including the contents of a storage ring that itself came out. Two items. Both proven. That ratio is the rule this catalog is built on and this is the cleanest instance of it.',
            afterwards: 'The residual is not diminishing at any measurable rate and the body is not decaying. Whoever takes the two things leaves a site that is exactly as dangerous and has nothing on it, which the Ledger will know within a season because the Ledger holds the name and has been watching who asks for it.'
        }
    },

    // ── the intact ones ───────────────────────────────────────────────
    {
        id: 'grave-the-forge-clan-vault',
        kind: 'grave',
        name: 'The Clan Undercroft That Opens For Blood',
        factionIds: ['sect-ashen-forge-clan'],
        occupantOrdinal: 27,
        yearsDead: 240,
        mannerOfDeath: 'old_age',
        burial: 'family_crypt',
        outside: {
            marker: 'A vault door in the floor of a clan hall that is still in use, walked over daily, with the clan mark inlaid in the leaf and the leaf worn smooth by two hundred and forty years of feet. It is not hidden and it is not guarded. The clan holds its meetings standing on it.',
            rumour: 'Everybody in the district knows what it is, including every party that would like to rob it, and the clan makes no secret of the contents because secrecy is not what is keeping them.',
            attributedTo: 'The third Forge Ancestor of the Ashen Forge Clan',
            lastPartySaid: 'Two serious attempts in two hundred years. The second, which was a Crimson Abyss raiding party of nineteen, killed eleven of the clan, stood on the leaf for two days and left with the hall\'s furniture.',
            whatAKnowledgeablePartyReads: 'A clan vault that opens for descent is the one lock in the world that cannot be picked, bought, forced or negotiated, and the clan can therefore leave it in the floor of a room it holds meetings in. It is also a full inventory of a Deity Transformation cultivator who died in bed at two hundred and eighty, which means it is large and none of it has ever been tested against anything.',
            whatAnIgnorantPartyConcludes: 'That a vault nobody is guarding is a vault nobody thinks is worth guarding. Nineteen people acted on that and it cost the clan eleven dead and cost the raiders their reputation, which in that province is the more expensive of the two.',
            startingAwareness: 'named',
            advertisedOrdinal: 27
        },
        interior: {
            scene: 'A dry stone room under the hall floor with racking down both sides and the ancestor seated at the end of it, in armour, which is the clan\'s custom and is not a defence. Everything he owned is on the racks in the order the clan\'s custom prescribes: work first, then wealth, then the things that were his. It is a large room and it is full.',
            arrangedForAFinder: true,
            gates: [
                {
                    kind: 'fate',
                    coincidence: 'bloodline',
                    worldStateCheck: 'Does the claimant descend from the occupant? The leaf reads descent and nothing else - not clan membership, not adoption, not a name, not the clan mark, and not the current clan head, who is not descended from this ancestor and has never been able to open it.',
                    characterStat: null,
                    whyItCannotBeFarmed: 'Because descent is settled before the run begins and there is no procedure anywhere in the world that produces it. It cannot be bought, forged, married into or earned; the House of Held Names, which is the institution best placed to fake one, holds that a register entry is a claim about descent rather than descent itself and has never asserted otherwise even when it was being paid to. What can be done is finding out that you have it, which several people have, and one of them was working as a porter at a barrow yard four hundred li away.',
                    whoHasEverPassed: 'Nine people in two hundred and forty years, all of them clan, all of them descended, and none of them has ever taken anything out, because the custom is that the vault is the ancestor and the ancestor is not divisible.',
                    below: 'Nothing. The leaf is a slab of stone with a mark on it and the clan holds meetings standing on it, and a party without the descent can dig the hall out from around it and be looking at a slab of stone in a hole.'
                }
            ],
            gateOrigin: 'placed',
            contents: [
                {
                    what: 'His working tools, complete, which are a forge master\'s and are the best set anybody in the province has seen.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Nine finished pieces he never sold, at a grade the clan can no longer produce and can no longer read the method for.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'The clan\'s original forging method, in full, in his hand, which the clan has a copy of and the copy is missing two sections.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A heaven-grade art the clan has never known it holds, on a slip in a case with his personal things rather than with the work.',
                    proven: false,
                    survived: null,
                    techniqueId: 'worldroot-strangling-vine',
                    immortalItemId: null
                },
                {
                    what: 'Spirit stones and materials in trade quantity, which is what a working forge holds and is the largest part of the vault by weight.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'The armour he is wearing, ceremonial, never used, made by somebody else as a gift.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Two hundred and forty years of clan offerings, which are small, numerous and individually worthless, and which are what the racking nearest the door is entirely occupied by.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'Nothing. He was two hundred and eighty and died in bed in a clan that could afford the masonry, so the inventory is complete, catalogued, in good condition and entirely unwarranted: the nine finished pieces are exceptional because he was exceptional at making things, which is a claim about his skill rather than about what they have been through, and the clan has never had cause to test one.',
            afterwards: 'It shuts. It has shut nine times and opened nine times and the clan\'s expectation is that it will keep doing so, which is correct as long as the line runs, and the line currently runs through four people, two of whom do not know.'
        }
    },
    {
        id: 'grave-the-channel-physician',
        kind: 'grave',
        name: 'The Physician Who Was Working On the Channels',
        factionIds: ['sect-verdant-spring-hall'],
        occupantOrdinal: 15,
        yearsDead: 70,
        mannerOfDeath: 'died_of_injuries',
        burial: 'interred_by_a_sect',
        outside: {
            marker: 'A low walled plot at the top of the terraced herb valley with nine physicians in it, ordinary Hall interments, and one at the end with a longer stone. The longer stone lists a name, a rank at Foundation Establishment Late, and then eleven lines of what she was working on, which is not the Hall\'s custom and was done at her request.',
            rumour: 'The Hall tells it as a sad story about somebody who took a channel repair too seriously and was crushed doing it. Ninety physicians work in that building every day and about six of them could tell you what was on the stone.',
            attributedTo: 'A Hall physician of the last century',
            lastPartySaid: 'Nobody robs a physician\'s plot in a working valley. The only person who has opened it is the Hall\'s own mason, who reset the stone twenty years ago and reported the interior undisturbed.',
            whatAKnowledgeablePartyReads: 'Eleven lines of a research problem on a headstone is a person telling whoever comes next where she got to. The stone names the channels, the crack interval, and the fact that the repairs are the wrong material, which is the single most consequential unread sentence in the province and has been sitting outdoors in a walled plot for seventy years.',
            whatAnIgnorantPartyConcludes: 'That it is a Foundation Establishment physician in a sect plot and there is nothing in it, which is correct about the valuables and is why nobody has ever gone in.',
            startingAwareness: 'named',
            advertisedOrdinal: 15
        },
        interior: {
            scene: 'A single brick-lined chamber, small, with her interred properly and her working materials in with her at her request, which the Hall thought was eccentric and granted because it cost nothing. There are notebooks. There are eleven years of them, and they are in the order she left them.',
            arrangedForAFinder: true,
            gates: [
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'insight',
                            domain: 'formation',
                            atLeast: 2,
                            note: 'The notes are not medical. She worked out in year four that the channels were not irrigation and spent the remaining seven on what they actually are, and the notation from year five onward is a formation notation she invented as she went.'
                        },
                        {
                            measure: 'attribute',
                            attribute: 'insight',
                            atLeast: 2,
                            note: 'Eleven years of one person\'s private shorthand, undocumented, with the key nowhere in it because she never expected to need one.'
                        }
                    ],
                    test: 'The chamber is not locked. Reading the notebooks is the gate: what is in them is worthless to anybody who cannot follow the notation, and the Hall\'s mason has had them in his hands twice.',
                    strengthDoesNotHelp: 'There is nothing to open. A cultivator at any rank can walk in, pick up eleven years of notebooks, look at them, and put them down, which is what has happened twice.',
                    below: 'The claimant takes away a set of illegible notebooks and a fair impression that a Foundation Establishment physician wasted eleven years, which is the Hall\'s own view of it.'
                }
            ],
            gateOrigin: 'placed',
            contents: [
                {
                    what: 'Eleven years of working notebooks in a shorthand she invented, in order, with the year-five change of subject clearly marked.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A survey of every channel in the valley with the crack interval measured against the material used in each repair, which is the whole of the argument in one document.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Her medical case, complete, ordinary, of no interest to anybody.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Thirty-one fired clay samples taken out of repairs, each labelled with the date of the repair, which is the physical evidence and is the part the Hall would find hardest to argue with.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A letter to the Hall she wrote and did not send, which states the conclusion in plain language in four sentences and is the only thing in the chamber that needs no notation to read.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Her own copy of an ordinary Hall medical text, annotated for eleven years, worth about what the paper is worth.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'Nothing. She was crushed by a channel section and the Hall interred her intact with her working materials, so everything she had is here and none of it has been tested by anything at all. The value of this grave is the lowest in the catalog by resale and one of the highest by consequence, which is the same inversion the tribulation rule describes arriving from the other direction.',
            afterwards: 'The chamber can be closed again and the Hall would prefer it were. What leaves with a reader is a conclusion the Hall cannot reach on its own and would act on immediately, and the thing under the terraced valley that the channels are part of the sealing work for gets nine hundred years further away from being disturbed.'
        }
    },
    {
        id: 'grave-deep-gleaner-xun',
        kind: 'grave',
        name: 'The Man Behind the Company\'s Own Wall',
        factionIds: ['sect-gleaners-company', 'sect-weir-office'],
        occupantOrdinal: 12,
        yearsDead: 30,
        mannerOfDeath: 'killed_in_a_fight',
        burial: 'left_where_they_fell',
        outside: {
            marker: 'The resealed part of the sorting-yard ruin at Hollowmarket, which is a wall the Company put back thirty years ago with its own hands and works alongside every day. There is no marker. His name is on the Company\'s wager board, which was never taken down, with the amount still written next to it.',
            rumour: 'Every Gleaner knows. He went in on a wager and did not come back, the Company sealed it again and raised the wager, and that is the whole of the region\'s risk assessment and is told as a joke about the Marches.',
            attributedTo: 'Deep Gleaner Xun',
            lastPartySaid: 'Nobody has gone in after him in thirty years. Two crews have discussed it seriously and both stopped at the same place, which is that a recovery is indistinguishable from an entry and the Company would have to decide which it was afterwards.',
            whatAKnowledgeablePartyReads: 'That there is a grave immediately behind the wall and something else deeper in, and that they are two different things. He is a man who died thirty years ago carrying a full deep-diving kit; what is further in is not a grave and is not his and is not in this catalog. Confusing the two is the specific error that gets a recovery crew killed, because a party that has decided it is going in to fetch a body treats the far chambers as background.',
            whatAnIgnorantPartyConcludes: 'That the sealed part is one thing with one hazard in it, and that thirty years is long enough for whatever took him to have moved on. Outsiders do not know the sealed part exists, so this is a conclusion available only to the Company itself, and two crews have reached it.',
            startingAwareness: 'named',
            advertisedOrdinal: null
        },
        interior: {
            scene: 'Six paces behind the wall, in the fourth chamber, on the floor. He got that far in and no further and he was not moved afterwards. His lamp is beside him, burned out. Everything he took in is on him, because he was thirty years dead in a sealed room and nothing in the Marches has been in there since.',
            arrangedForAFinder: false,
            gates: [
                {
                    kind: 'strength',
                    ordinal: 24,
                    test: 'Whatever is in the fourth chamber is still in the fourth chamber and did to him what it does. The Company has never established what it is, and the only measurement anybody has is that it went through a Deep Gleaner at Qi Condensation Layer 13 in less time than it took him to get his lamp lit twice.',
                    below: 'The same thing happens. It has happened once in living memory and the sample is one, which is the entirety of what anybody knows and is why the two crews that discussed it stopped: there is no way to size it from outside and the only party who could report is on the floor.',
                    noWorkaround: 'The wall is the Company\'s own and can be taken down in a morning by anybody with a hammer, which is what makes this a strength gate rather than a sealed one. Nothing is stopping entry. Something is stopping exit.'
                }
            ],
            gateOrigin: 'accreted',
            contents: [
                {
                    what: 'A full deep-diving kit, thirty years old, complete, of the quality a Company Deep Gleaner buys with his own money.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'His sorting notes for the three front chambers, which are better than the Company\'s current ones and cover two nodes the Company has since decided are dead.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A hand copy of eleven characters off the deep inscription, made in the third chamber on the way in, which is more of that inscription than exists anywhere else.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Two pills he did not take, still in the case, of a grade a Deep Gleaner does not usually carry.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'The wager, in writing, folded, which names the four people who put money on it and is the reason the Company has never formally investigated.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'His lamp, burned out, which the Company would want back and would not say why.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'Nothing, and the sealed room preserved it. He was killed in a fight in an enclosed space thirty years ago, so his kit is a thirty-year-old kit in good condition, none of it tested by anything except the six paces he got, and the most valuable object in the inventory is eleven characters he copied off a wall on the way past.',
            afterwards: 'The Company would have to decide what a recovery was, and the Weir Office would receipt the notification and the Ninth Face would answer it at the next revision, up to twenty years later. What is deeper in the building is unaffected by any of this and is not in this catalog.'
        }
    },
    {
        id: 'grave-the-remote-carrier',
        kind: 'grave',
        name: 'Somebody Who Came Down and Stopped Somewhere',
        factionIds: ['house-ninefold-ledger', 'sect-bone-lantern-cult'],
        occupantOrdinal: 33,
        yearsDead: 600,
        mannerOfDeath: 'died_of_injuries',
        burial: 'left_where_they_fell',
        outside: {
            marker: 'A dry overhang on a spur that is not on any route and is four days from the nearest track, with a person under it who sat down against the rock and did not get up. There is no cutting, no cairn and no arrangement of any kind. Weather has done everything that has been done to the site.',
            rumour: 'There is none, because nobody knows it is there. Two claims of this kind of find have been made in four hundred years, both were established as forgeries by the Ninefold Ledger, and the effect on the third claim is the obvious one.',
            attributedTo: null,
            lastPartySaid: 'Nobody. There is no attempt record, no camp, no pit and no path. Whoever finds it will be the first party to stand there in six hundred years.',
            whatAKnowledgeablePartyReads: 'That everything about the site is wrong for a planted one. A forgery is placed where people look, because a forgery has to be found; this is four days from a track on a spur with no reason to be walked. The correct reading is available only to somebody standing there, which is the whole difficulty with the category.',
            whatAnIgnorantPartyConcludes: 'That a body under an overhang with a full pouch is the ordinary grave the Marches is full of, worth a fair price, and that the small unlabelled box in the middle of the inventory is a curio. This is also what two of the three parties who have handled a genuine one concluded.',
            startingAwareness: 'unaware',
            advertisedOrdinal: null
        },
        interior: {
            scene: 'A man at Body Integration Sinew, six hundred years dead, sitting against rock with his goods where he put them down. He was injured before he got here and he came a long way with it: the goods are laid out in the order of somebody who was treating himself and stopped. Nothing about the site is remarkable and nothing about it has been arranged.',
            arrangedForAFinder: false,
            gates: [
                {
                    kind: 'fate',
                    coincidence: 'arrived_without_looking',
                    worldStateCheck: 'Did the claimant reach this site while doing something else? The condition is on the arrival rather than on the claimant: the site is four days off any route and has no rumour attached, so a party that got here was going somewhere else, was lost, or was following something. A party that came looking for it did not come looking for this one, because this one has never been described to anybody.',
                    characterStat: null,
                    whyItCannotBeFarmed: 'Because searching for it is what makes it not be found. There is no rumour to follow and no record to consult; the two claims in four hundred years were both forgeries and forgeries are planted where searchers go, so the entire effect of deciding to look for one of these is to arrive at the places somebody has arranged for searchers to arrive at. The Bone Lantern Cult works more graves than anybody, states plainly that it has never seen one, and does not expect to, and it is not saying that out of modesty.',
                    whoHasEverPassed: 'Twice in recorded history, on the Ledger\'s own count, and both times by somebody who was not in the business of finding one.',
                    below: 'Not applicable in the ordinary way. There is no door and nothing refuses anybody: the gate is whether the claimant is ever standing here at all, and for almost every run in the world the answer is no and there is nothing to be told.'
                }
            ],
            gateOrigin: 'circumstance',
            contents: [
                {
                    // THE TOP PRIZE IN THE SETTING, on a body, unprotected,
                    // in a pouch with four changes of clothing.
                    //
                    // It is here rather than behind a door because of what he
                    // was: somebody who came down and stopped somewhere, at
                    // thirty-three, of injuries. The canon ends at forty-five.
                    // He was twelve rungs short of finishing the book he was
                    // carrying and there is no indication anywhere on him that
                    // he knew what it was worth, which is the ordinary way the
                    // most valuable things in this world change hands.
                    what: 'A sixth manual, at the bottom of the pouch, water-damaged along one edge and folded rather than cased. It is the only thing he was carrying that nobody has been able to price.',
                    proven: false,
                    survived: null,
                    techniqueId: 'first-and-last-breath-canon',
                    immortalItemId: null
                },
                {
                    what: 'A storage pouch with the ordinary contents of a Body Integration cultivator on the road: stones, materials, four changes of clothing.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A medical case, open, mostly used, with the sequence of what he took still laid out beside it.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Two manuals, one at immortal grade and one at heaven, neither of them hidden or protected in any way.',
                    proven: false,
                    survived: null,
                    techniqueId: 'star-quenching-blade-domain',
                    immortalItemId: null
                },
                {
                    what: 'A small box, unlabelled, plainly part of the object inside it rather than packaging for it, holding a golden pill smaller than expected with an inscription on the lid in no script anybody below the Lid can read.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: 'immortal-unearned-step'
                },
                {
                    what: 'A sword, good, ordinary for the rank, with the wear of somebody who used it.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A travelling formation set, laid but never lit, which is what he was doing when he stopped.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'Nothing at all. He died of injuries under an overhang, so the inventory is full, ordinary, untested and long, and the object that matters is the fourth item in a list of six and looks like the least interesting thing there. This is the one entry where the catalog\'s own rule is the wrong tool: the inventory is intact and unproven exactly as the rule predicts, and the rule says nothing about the box, because nothing in the world tests one of those either.',
            afterwards: 'The Ledger opens a lineage audit on anybody who spends one without being able to say where it came from, and it will not accept this account, because it has heard this account twice and established both as forgeries. The correct move is not to spend it, which nobody has ever managed.'
        }
    },
    {
        id: 'grave-the-survey-line-duel',
        kind: 'grave',
        name: 'Two Graves On a Survey Line',
        factionIds: ['sect-azure-cloud-pavilion', 'sect-stonewright-consortium', 'house-anchorhold'],
        occupantOrdinal: 18,
        yearsDead: 12,
        mannerOfDeath: 'duel',
        burial: 'left_where_they_fell',
        outside: {
            marker: 'Two cairns eleven paces apart on a surveyed line above Scarwater, both raised by the same party on the same afternoon, both with a stone standing at the head and neither with a name on it. The Anchorhold\'s perimeter mark is on the rock between them and was there first.',
            rumour: 'Everybody local knows what happened, has an opinion about who was in the right, and can name both parties. It was twelve years ago and there are people in Scarwater who were there.',
            attributedTo: 'Two Core Formation cultivators of the Pavilion and the Consortium',
            lastPartySaid: 'Nobody has opened either. There is no reason to think there is anything in them and the families are alive and local.',
            whatAKnowledgeablePartyReads: 'Two Core Formation cultivators died in a duel over a survey line twelve years ago and were cairned where they fell by the survivors, which means both of them went into the ground with everything they had on that day and none of it has been through anything except an afternoon. It is a fair haul at a fair price and it is exactly what it looks like.',
            whatAnIgnorantPartyConcludes: 'The same thing, correctly. This is the entry where the ignorant reading and the knowledgeable one agree, and it is here so the catalog does not imply that every grave is a puzzle: most of them are two cairns on a hillside with the ordinary goods of ordinary people in them.',
            startingAwareness: 'named',
            advertisedOrdinal: 18
        },
        interior: {
            scene: 'Loose stone over two bodies in the clothes they were wearing, twelve years on a hillside, with their equipment beside them because the survivors were not thieves and were in a hurry. There is nothing else. Neither cairn is deeper than a man is long.',
            arrangedForAFinder: false,
            gates: [],
            gateOrigin: 'none',
            contents: [
                {
                    what: 'Two swords, both good, both Core Formation working weapons of the kind a sect issues and expects back.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Two storage pouches with a season\'s stones in each and the ordinary contents of somebody on a survey job.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'The Consortium man\'s survey instruments, which are worth more than his sword and which his employer wrote off.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A sect token each, which is the part that makes robbing them a problem rather than a crime, because both institutions still exist and both keep records of where their people fell.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'The disputed survey note, on the Pavilion man, which is the document the whole thing was about and which nobody has ever asked for.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'Nothing. A duel is a fight between two people and it does not damage what they are carrying in any interesting way, so both inventories are complete, current, twelve years old and warranted by nobody. It is the ordinary case, and the ordinary case is a full inventory of untested goods, which is why the catalog\'s rule is worth stating: the exception is the short list, and the short list is the good one.',
            afterwards: 'Both sects find out, because both keep records of where their people fell, and what arrives is not a request for the goods back. The survey line is still disputed and the Anchorhold\'s mark is still on the rock.'
        }
    },
    {
        id: 'grave-the-culler-nobody-buried',
        kind: 'grave',
        name: 'A Culler On the Kettle Circuit',
        factionIds: ['sect-verdant-spring-hall'],
        occupantOrdinal: 6,
        yearsDead: 3,
        mannerOfDeath: 'died_of_injuries',
        burial: 'left_where_they_fell',
        outside: {
            marker: 'A man in a ditch off the Kettle circuit with his contract still in his coat, three years there, found and reported twice by people who did not want the trouble of moving him. The village has a note of it.',
            rumour: 'He is known about. He took a culling notice priced off an old survey, the notice was wrong by four ranks, and the village has not amended it and does not intend to.',
            attributedTo: 'A culler of the Kettle circuit',
            lastPartySaid: 'Two people have gone through his pockets and both left the contract, which is the only object at the site anybody has any use for and neither of them could read.',
            whatAKnowledgeablePartyReads: 'That there is nothing here, and that the contract in his coat is the mispriced notice and is evidence, and that a party who takes it to the Weir Office is doing something for somebody rather than for themselves.',
            whatAnIgnorantPartyConcludes: 'The same. Nobody is wrong about this grave. It is in the catalog because a file about inheritance needs the floor of the distribution in it, and the floor is a man in a ditch with a splint on and a contract that killed him.',
            startingAwareness: 'named',
            advertisedOrdinal: 6
        },
        interior: {
            scene: 'A ditch. He is on his side with a splint on his left forearm that he made himself out of what was to hand, which is what a culler does when the pill costs five months of gross, and the injury that killed him is not the one in the splint.',
            arrangedForAFinder: false,
            gates: [],
            gateOrigin: 'none',
            contents: [
                {
                    what: 'A culling spear, mortal-grade, resharpened past the point where resharpening it helps.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Four spirit stones, loose, in a coat pocket rather than a pouch, because he did not own a pouch.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'The village culling notice, in his coat, priced at a rank four below what was actually on the ground and written off a survey that is decades old.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A splint he made himself, still on, which is the single most informative object at the site about how the world he lived in works.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A Verdant Spring Hall dosage card for a pill he could not afford, folded small and carried long enough to have worn through at the folds.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'Nothing, and there was nothing for it to do anything to. He died of injuries in a ditch and the inventory is five items of which four are worthless and the fifth is a piece of paper that would embarrass a village if anybody took it anywhere. The intact profile holds here as exactly as it holds at the clan vault, and it is worth noticing that the profile says nothing about value: it says the list is long and untested, and this list is long and untested and comes to about nine stones.',
            afterwards: 'The village would rather he stayed in the ditch and will not say so directly. If the notice goes to the Weir Office the notice is amended and the next culler on that circuit lives, and nobody involved will ever connect the two events.'
        }
    },

    // ── the two that carry a forbidden art ────────────────────────────
    // Both of these exist because the arts on them exist. A forbidden art is
    // never taught and never cached, so the only way a copy is anywhere is
    // that somebody was carrying it when they stopped, and the entries below
    // are the somebodies. Neither of them is a villain with a plan; both are
    // people who took a shorter road, got further along it than anybody
    // expected, and were charged for it on schedule.
    {
        id: 'grave-the-collector-in-arrears',
        kind: 'grave',
        name: 'The Collector Who Was Made to Settle',
        factionIds: ['house-tally-court', 'house-ninefold-ledger'],
        occupantOrdinal: 34,
        yearsDead: 2_280,
        mannerOfDeath: 'killed_in_a_fight',
        burial: 'left_where_they_fell',
        outside: {
            marker: 'A dry watercourse four days off the eastern road with a body in it that has not gone the way a body goes. The cloth is gone and the bones are in order, and there is a brand across the front of the skull which is cut rather than burned and is the same mark that is on a stone at the head of the watercourse.',
            rumour: 'The eastern towns know the mark and will not say the name attached to it. What they will tell you is that people from a house that no longer exists used to come out this way to collect, that one of them did not go back, and that the families who owe whatever it is they owe still cannot say what it is.',
            attributedTo: 'A collector of the Tally Court',
            lastPartySaid: 'A Bone Lantern rotation crew logged the site ninety years ago, dated it correctly to within a century, and did not work it. Their note gives the reason as bad flowering, which is not what the flowering says and is the only entry in that rotation book with a reason in it at all.',
            whatAKnowledgeablePartyReads: 'A body that has not decayed in twenty-three centuries was at Body Integration when it stopped, and a cultivator at Body Integration does not end up in a watercourse four days from anywhere unless somebody made a point of it. The brand is on the skull and on the stone, which means it was cut twice, once into him and once into the place, and cutting a mark into the ground is what you do when you want the ground to hold the record after you have gone.',
            whatAnIgnorantPartyConcludes: 'That an undecayed body in a ditch is a haunting and that the mark is a warding, and that the correct response to both is to leave. It is a reasonable reading of everything visible and it is why the site is still intact after two thousand three hundred years, in a province where nothing at that rank stays intact for eleven.',
            startingAwareness: 'whisper',
            advertisedOrdinal: null
        },
        interior: {
            scene: 'A watercourse, dry for longer than anybody can date, with a body lying along the bottom of it in the position of somebody who was put down rather than who fell. Everything he was carrying is still on him and none of it has been disturbed. The mark on the stone at the head of the course faces down the watercourse rather than up it, so it is legible only to somebody standing where he is, which is the arrangement the auditors made and the reason the site has never been read correctly by anybody who happened past it.',
            arrangedForAFinder: false,
            gates: [
                {
                    kind: 'fate',
                    coincidence: 'carries_an_obligation',
                    worldStateCheck: 'Whether the claimant is carrying an inherited obligation that nobody, including the claimant, can identify or discharge. The eastern branded bloodline is the known case and is not the only one; the Court entered obligations against parties who had not been born, and the entries outlived the Court, the ledger volumes and everybody who could have read them out.',
                    characterStat: null,
                    whyItCannotBeFarmed: 'Because the obligation is descent and nothing else. It cannot be bought, because the Court took consideration in kind and there is no party left to pay; it cannot be sworn into, because the oath that would do it needs a counterparty and the counterparty was dissolved twenty-three centuries ago; and it cannot be discovered by looking, because the entire diagnostic value of the thing is that the carrier does not know what it is. The Ninefold Ledger has tried to acquire one deliberately, twice, in writing, and the file on the second attempt runs to nine years and ends without a finding.',
                    whoHasEverPassed: 'Nobody on record. Two of the branded families are known to the Ledger by name and neither has ever been within two provinces of the watercourse, and the Ledger has never told either of them that anything about their line is unusual.',
                    below: 'The body is a body and the mark is a mark. Everything on him can be taken by anybody who walks down the watercourse and picks it up, and the manual comes off him as a sealed case that does not open, has never opened for anybody, and cannot be forced, because what holds it shut is the same entry that is holding the family.'
                }
            ],
            gateOrigin: 'circumstance',
            contents: [
                {
                    what: 'A sealed case of Tally Court manufacture holding the collector\'s working copy of the art he was out there to use, which is the only route by which a copy of it reaches anybody and is the reason the auditors left the body where it was instead of burning it.',
                    proven: false,
                    survived: null,
                    techniqueId: 'debt-collection-in-arrears',
                    immortalItemId: null
                },
                {
                    what: 'His route book, giving eleven collections in order with the settled column filled in for ten of them, and the eleventh entry written out and not closed.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A Court seal on a chain, still on him, which any of four institutions would take as proof of a claim they have each spent centuries arguing they do not have.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Thirty-one brand blanks in a roll, unused, cut and ready, each one a debt that was going to be entered against somebody and never was.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A pouch of ordinary travelling money in denominations two provinces have not minted since the Court fell.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A second seal, not his, in the bottom of the same pouch, which belongs to one of the auditors who founded the Ninefold Ledger the following year.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'Nothing at all, which is the ordinary intact case and is doing unusual work here. He was killed by people who wanted the arithmetic to be visible rather than the goods to be gone, so they did not take a single item, and the result is a complete two-thousand-year-old collector\'s kit lying in the open in a province where a Foundation Establishment corpse gets stripped inside a season. Nobody has stripped this one because everybody who has found it has read the mark correctly enough to be frightened and not correctly enough to understand it.',
            afterwards: 'The watercourse stays what it is and the mark on the stone does not fade, because it was cut by a house whose entire discipline was making a record outlast the parties to it. A claimant who opens the case has closed the eleventh entry in the route book, which is the transaction the whole site is, and the Ledger will know inside a year without anybody having told it.'
        }
    },
    {
        id: 'grave-the-count-that-outlived-him',
        kind: 'grave',
        name: 'The Glass Where the Count Stopped',
        factionIds: ['sect-bone-lantern-cult', 'house-ninefold-ledger'],
        occupantOrdinal: 42,
        yearsDead: 340,
        mannerOfDeath: 'heavenly_tribulation',
        burial: 'left_where_they_fell',
        outside: {
            marker: 'About four hundred paces of fen fused to green glass, flat, with the reeds still visible in it standing upright where they were. The edge of it is a clean line. At the centre there is a shallow depression with three objects in it, and they are the only things on the whole sheet that are not part of the sheet.',
            rumour: 'The fen villages date it to a single night three hundred and forty years ago and say the sky came down on a man nobody knew, twice, and that the second one was longer. Nobody claims him, no sect has ever posted a name, and the standing local view is that whoever it was had earned it.',
            attributedTo: 'Not established. Four institutions have opinions and none of them has a name',
            lastPartySaid: 'A Thousand Treasure buyer walked the edge eleven years ago with a hired Nascent Soul cultivator, priced the sheet by count at three objects, and declined to fund a crossing. The buyer\'s note calls it the thinnest apex site in the province, which is correct by count and is the exact error the trade is famous for.',
            whatAKnowledgeablePartyReads: 'A tribulation at that scale burns everything the person was carrying, so three objects on four hundred paces of glass is not a poor site, it is the profile: whatever is out there went through the heaviest event in the world in direct contact and is still an object. The depression at the centre is where he was, and a body at Tribulation Transcendence does not decay, so the absence of one says the strike went on long enough to take it.',
            whatAnIgnorantPartyConcludes: 'That three items on four hundred paces is not worth the crossing, and that a site with no name attached to it has no provenance and therefore no resale. Both are true as stated and both are reasoning by count, which is the reasoning that sends every party in the province to the maintained crypt instead.',
            startingAwareness: 'named',
            advertisedOrdinal: 42
        },
        interior: {
            scene: 'A sheet of fused fen with nothing standing on it and nothing growing through it in three hundred and forty years. The centre is a depression about two paces across, glazed smooth, with three objects lying in it, and there is no body, no remains of one and no mark where one lay. What is underneath the glass is fen water that never boiled off, which is why the sheet rings when it is walked on and why it has never been safe to walk on.',
            arrangedForAFinder: false,
            gates: [
                {
                    kind: 'strength',
                    ordinal: 32,
                    test: 'Crossing two hundred paces of glass over standing water that the strike vitrified and did not drain. The sheet carries a person and does not carry the qi a person uses to spread their weight; anything laid on it to distribute the load is read as part of the sheet and cracks it. What the crossing costs is a continuous unshielded draw from the ground beneath, which is fen and returns nothing.',
                    below: 'Below Void Refinement Final Tempering the sheet goes at some point between the edge and the centre, and what is under it is three feet of fen water with a glass lid that closes again. Four of the five recorded losses here are that, and none of the four was recovered, because a recovery means a second person on the same sheet.',
                    noWorkaround: 'The sheet has been approached from every side and it is the same sheet. Boats do not help because there is no open water; boards do not help because a load spread over boards is still a load and the glass is two fingers thick at the thinnest. Two parties have tried breaking a channel in from the edge and found that a broken sheet floods and takes what is on it to the bottom.'
                }
            ],
            gateOrigin: 'accreted',
            contents: [
                {
                    what: 'A manual case, closed, with a tally cut into the outer face in a hand that changes across the course of it, and the tally is the count the art keeps rather than one he kept.',
                    proven: true,
                    survived: 'The heavenly tribulation of a Tribulation Transcendence boundary, in direct contact, at the centre of it, which took the body it was lying against and did not take the case.',
                    techniqueId: 'heart-of-the-ten-thousand-corpses',
                    immortalItemId: null
                },
                {
                    what: 'A second case, of ordinary make and much younger, holding the art he bought the last four ranks with and holding it open at the section on what the spending does to a tribulation.',
                    proven: true,
                    survived: 'The same event, lying a pace from the first, and the fact that both cases survived and the man between them did not is the entire reading of this site.',
                    techniqueId: 'lifespan-devouring-heaven-theft',
                    immortalItemId: null
                },
                {
                    what: 'A short rod of notched bone, worn smooth at one end from being carried in a hand, with the notches running most of its length and stopping about a thumb short of the top.',
                    proven: true,
                    survived: 'The strike, in the depression, and it is the only object here that tells anybody anything about the person rather than about the arts.',
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'It took him and left the arithmetic. Everything he owned went except the two manuals and the rod, which is the short list the profile predicts and which happens here to be the two things he had spent a life buying and the object he had used to keep score with. Nobody in the world holds a warranted copy of either art and nobody ever will again, because the only way to issue that warranty is to carry the thing to a boundary and lose.',
            afterwards: 'The sheet does not repair and does not drain, and the glass will still be there when everybody currently arguing about who he was is dead. What comes off it comes off it once. The Bone Lantern Cult has had the site in its rotation for two centuries and has passed on it every cycle, on the stated ground that the crossing costs more than three objects are worth, which is the first time in four hundred years the Cult has been wrong about a piece of ground.'
        }
    }
];

/** Everything in this file, as one addressable set. */
export const SITES: readonly Site[] = [...INHERITANCE_TRIALS, ...GRAVES];

// ─────────────────────────────────────────────────────────────────────────
// ACCESSORS
//
// Two of them matter. `outsideViewOf` returns a type with no `interior` key,
// so a caller that has only the outside view cannot reach the inside even by
// mistake, and the compiler says so before any test runs. `enterSite` returns
// the whole entry and is named as a deliberate act, because it is one.
// ─────────────────────────────────────────────────────────────────────────

const SITE_BY_ID: ReadonlyMap<string, Site> = new Map(SITES.map(s => [s.id, s]));

/**
 * What a party can have without going in.
 *
 * The type is deliberately not derived from `Site` by omission: it is written
 * out, so adding a field to an interior can never widen this by accident.
 * A grave carries the manner of death and the burial here because both are
 * legible from the marker, and the manner of death is the one reading that
 * separates a party who knows the world from one who does not.
 */
export type SiteOutsideView =
    | {
        id: string;
        kind: 'trial';
        /** Null where the claimant's awareness does not permit naming. */
        name: string | null;
        outside: Outside;
    }
    | {
        id: string;
        kind: 'grave';
        name: string | null;
        mannerOfDeath: MannerOfDeath;
        burial: Burial;
        occupantOrdinal: number;
        yearsDead: number;
        outside: Outside;
    };

/**
 * The pre-entry face, and nothing else.
 *
 * Below `named` the attribution and the rumour are withheld, following the
 * awareness rule in `hierarchy.ts`: a rumour is how a name reaches somebody,
 * and a cultivator with no knowledge record has not had it reach them. The
 * marker survives at every awareness, because a marker is a physical object
 * standing in a place and is not knowledge about anybody.
 */
export function outsideViewOf(id: string, awareness: Awareness = 'named'): SiteOutsideView | undefined {
    const site = SITE_BY_ID.get(id);
    if (!site) return undefined;
    const named = mayBeNamed(awareness);
    const outside: Outside = {
        ...site.outside,
        rumour: named ? site.outside.rumour : '',
        attributedTo: named ? site.outside.attributedTo : null,
        startingAwareness: awareness
    };
    if (site.kind === 'grave') {
        return {
            id: site.id,
            kind: 'grave',
            name: named ? site.name : null,
            mannerOfDeath: site.mannerOfDeath,
            burial: site.burial,
            occupantOrdinal: site.occupantOrdinal,
            yearsDead: site.yearsDead,
            outside
        };
    }
    return { id: site.id, kind: 'trial', name: named ? site.name : null, outside };
}

/**
 * The whole entry, interior included. Call this only once the engine has
 * recorded that the cultivator went in.
 */
export function enterSite(id: string): Site | undefined {
    return SITE_BY_ID.get(id);
}

export function getSite(id: string): Site | undefined {
    return SITE_BY_ID.get(id);
}

export function requireSite(id: string): Site {
    const s = SITE_BY_ID.get(id);
    if (!s) throw new Error(`Unknown inheritance site: ${id}`);
    return s;
}

export function getTrial(id: string): InheritanceTrial | undefined {
    const s = SITE_BY_ID.get(id);
    return s && s.kind === 'trial' ? s : undefined;
}

export function getGrave(id: string): Grave | undefined {
    const s = SITE_BY_ID.get(id);
    return s && s.kind === 'grave' ? s : undefined;
}

/** Every gate on a site, in the order they are met. */
export function gatesOf(site: Site): readonly Gate[] {
    return site.interior.gates;
}

/** Sites carrying at least one gate of this kind. */
export function sitesWithGateKind(kind: GateKind): Site[] {
    return SITES.filter(s => s.interior.gates.some(g => g.kind === kind));
}

/** Which trials guard a given technique. Answers "where does this come from". */
export function trialsGuarding(techniqueId: string): InheritanceTrial[] {
    return INHERITANCE_TRIALS.filter(t => t.interior.prize.techniqueIds.includes(techniqueId));
}

/** Which graves hold a copy of one. A grave is the other half of that question. */
export function gravesHolding(techniqueId: string): Grave[] {
    return GRAVES.filter(g => g.interior.contents.some(c => c.techniqueId === techniqueId));
}

export function gravesByMannerOfDeath(manner: MannerOfDeath): Grave[] {
    return GRAVES.filter(g => g.mannerOfDeath === manner);
}

/**
 * Whether the manner of death is one the lightning was present for. The two
 * profiles in `GRAVE_CONTENTS_BANDS` are selected by this predicate and by
 * nothing else, so there is one place the rule lives.
 */
export function tribulationTouched(manner: MannerOfDeath): boolean {
    return manner === 'heavenly_tribulation' || manner === 'failed_crossing';
}

/** The band a grave's contents must fall inside, given how the occupant died. */
export function contentsBandFor(manner: MannerOfDeath): typeof GRAVE_CONTENTS_BANDS[keyof typeof GRAVE_CONTENTS_BANDS] {
    return tribulationTouched(manner) ? GRAVE_CONTENTS_BANDS.tribulation : GRAVE_CONTENTS_BANDS.intact;
}

/** Items with the warranty. Empty for every grave that is not a tribulation one. */
export function provenContents(grave: Grave): GraveGood[] {
    return grave.interior.contents.filter(c => c.proven);
}

/**
 * The reading a party takes off the outside, as one line, with the manner of
 * death first for a grave because that is the order a grave-reader reads in.
 */
export function describeOutside(view: SiteOutsideView): string {
    const head = view.name ?? 'An unattributed site';
    if (view.kind === 'grave') {
        return `${head}. Died: ${view.mannerOfDeath.replace(/_/g, ' ')}, ${view.yearsDead} years ago, at ordinal ${view.occupantOrdinal}. Burial: ${view.burial.replace(/_/g, ' ')}. ${view.outside.marker}`;
    }
    return `${head}. ${view.outside.marker}`;
}
