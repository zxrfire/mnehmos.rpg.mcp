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
// WHAT SORT OF PLACE IT IS
//
// `kind` is the RECORD SHAPE - a trial has a prize somebody arranged, a grave
// has an occupant and an inventory nobody arranged - and it must stay a
// two-member discriminator because the two records genuinely differ. It is not
// a statement about what the place was, and for a long time it was the only
// statement this file made, which left twenty-four entries reading as two sorts
// of thing when what is actually in them is a bench on burned ground, a
// courier yard, a refining hall, a curriculum cut into a ledge and a clan
// undercroft.
//
// `character` is the other axis and it is orthogonal on purpose: an archive can
// be a trial or a grave, and so can a workshop. Anything that walks the catalog
// looking for variety should read this, and anything that switches on the
// record shape should read `kind`.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What the category is called, and why it is not called ruins any more.
 *
 * "Ruin" was a plain English word doing work for something that now spans an
 * abandoned sect mountain, an inheritance somebody about to ascend left
 * addressed to a claimant, and a dead man's one-room cave. Two of those three
 * are not ruined and nobody would call them that.
 *
 * CLOSED GROUND is the term, and it was picked to match the register this
 * catalog already writes in rather than to sound impressive. The good names
 * here are concrete and slightly administrative - the Ninefold Ledger, the
 * Measured Span, the Unlit Gate, the Deep Survey, the Girdle of Nine Stones -
 * and none of them reaches for grandeur. So: ground that is closed. It says
 * what the category has in common, which is a door and something behind it, and
 * it says nothing about how the door got there, which is the part that varies.
 *
 * It also names the axis. `THE_THREE_WAYS_GROUND_IS_CLOSED` was already using
 * this vocabulary before the category needed a name, and what a place does over
 * time is stop being closed, which is a sentence the term makes available.
 *
 * Two sub-terms for the ends of the scale, and they are what people in the
 * world actually say:
 *
 *   A SHUT CAVE   the smallest thing that qualifies. One room, one door, one
 *                 person, a lifespan that ran out behind it.
 *   AN EMPTY SEAT the largest. A house's mountain with nobody in it, which is
 *                 the thing most people mean when they say ruin and is the only
 *                 one of these that a province remembers the opening of.
 *
 * Deliberately NOT `sealed ground`, which was the other candidate: `sealed` is
 * a boolean on `LocationRecord`, `sealed_domain` is a `LocationKind`, and
 * `sealed-ancestors.ts` is a live catalog of people behind doors. A fourth
 * meaning of the word would have been unreadable within a month.
 */
export const WHY_CLOSED_GROUND = {
    term: 'closed ground',
    whyNotRuins:
        'Because two thirds of the category is not ruined. An inheritance left by somebody preparing to ascend is in perfect order and was arranged last week by the standards of the world; a cave whose owner died in it is exactly as its owner left it. Ruin describes what happened to a sect mountain and describes nothing else here.',
    whatTheyHaveInCommon:
        'A door, something behind it, and nobody currently coming out. That is the whole of the category and it is why the term names the closing rather than the damage.',
    theEnds: [
        'a shut cave: one room, one door, one person, and a lifespan that ran out behind it. The smallest thing that qualifies and the commonest.',
        'an empty seat: a house\'s mountain with nobody in it. Halls, wards, a road that used to go there, and more than one person\'s worth of history.'
    ],
    andTheAxisIsTheCategorisation:
        'The old split was trial against grave, which froze two record shapes into two kinds of place. What actually varies is intent, and intent decays, so the categorisation runs along `IntentStanding` and not across it.'
} as const;

/**
 * A ruin is typically more epic than a cave.
 *
 * The correction that produced this section, in the design owner's own terms: a
 * dead cultivator's sealed cave is real and it is THE BOTTOM OF A SCALE rather
 * than the model for the category. The word should mostly conjure something
 * with scale to it.
 */
export const A_RUIN_IS_TYPICALLY_MORE_EPIC_THAN_A_CAVE = {
    correction:
        'A cave whose owner died in it is the very smallest type. It is not what the category is mostly made of and it is not what anybody pictures. A place with scale to it - a mountain a house held for six hundred years and then left, halls, wards, a road that used to go there - is the ordinary case.',
    whyTheDistinctionIsMechanical:
        'Scale decides things downstream that nothing else decides: what is inside, how many can go in at once, whether a house can simply claim it, whether its existence is public, and where the access band sits. A one-room cave is looted by a wandering rogue in an afternoon. An empty seat is an expedition, an argument between houses about who owns it, and a thing provinces remember the opening of.',
    andTheOriginsAreAFloor:
        'Three origins were named and the list is explicitly not closed. A house that gave up its seat, somebody who left what they had addressed to a claimant, and a door nobody opened again are three different sorts of place that should not read the same and should not be entered for the same reasons. There will be more.'
} as const;

/**
 * Where a piece of closed ground came from.
 *
 * A FLOOR AND NOT A TAXONOMY. The design owner has asked repeatedly for many
 * different types and has said the named ones are a starting point, so this
 * list is expected to grow and nothing downstream may assume it is complete -
 * every switch on it has a default.
 *
 * These are not the same kind of place and must not read the same:
 *
 *   `abandoned_by_a_house` is the big end and probably the commonest thing
 *   anybody means. Something HAPPENED to it: a war, a vein that failed, a line
 *   that ended. It has architecture, a planned layout, defences built against
 *   an enemy rather than against weather, and whatever the evacuation could not
 *   carry. The danger in one is decay and whatever moved in afterwards. The
 *   world produces these on its own - a house the simulation destroys leaves
 *   its mountain behind, which is the reserve being fed by the ordinary
 *   business of houses falling.
 *
 *   `left_addressed` is DELIBERATE, and it is a completely different object.
 *   Somebody at a great height arranged for what they had to be found later, by
 *   the right person, and addressed it rather than merely leaving it lying
 *   there. It can carry conditions on who may take it, a trial rather than a
 *   hazard, a message, an intent. THE DANGER IS THAT THE PERSON WHO BUILT IT
 *   MEANT TO SORT APPLICANTS AND THE CLAIMANT MAY NOT BE WHO THEY WERE SORTING
 *   FOR. An inheritance that is a ruin with better contents has thrown away the
 *   only thing that makes it interesting.
 *
 *   `a_door_nobody_opened_again` is the small end. One person, one door, a
 *   lifespan that ran out behind it, everything they owned still inside, and
 *   nobody told.
 */
export const RuinOriginSchema = z.enum([
    'abandoned_by_a_house',
    'left_addressed',
    'a_door_nobody_opened_again',
    /** A working site caught in the middle of an ordinary day. */
    'overrun_at_work',
    /** Nobody built it and nobody left it. The catastrophe or the sky made it. */
    'what_the_catastrophe_made',
    /** Two parties stopped each other on it and neither came back to collect. */
    'fought_over_and_left'
]);
export type RuinOrigin = z.infer<typeof RuinOriginSchema>;

/**
 * How big the thing is, which decides more than it looks like it should.
 *
 * See `A_RUIN_IS_TYPICALLY_MORE_EPIC_THAN_A_CAVE`. The ordering is meaningful
 * and `partiesItTakes`, `aHouseCanClaimIt` and `itsExistenceIsPublic` are read
 * off it rather than stated per entry, so a new place cannot disagree with the
 * scale it declares.
 */
export const RuinScaleSchema = z.enum(['one_room', 'a_building', 'a_compound', 'a_mountain']);
export type RuinScale = z.infer<typeof RuinScaleSchema>;

/** What each scale means for who can take it and whether anybody knows it is there. */
export const WHAT_SCALE_DECIDES: Readonly<Record<RuinScale, {
    partiesItTakes: number;
    aHouseCanClaimIt: boolean;
    itsExistenceIsPublic: boolean;
    note: string;
}>> = {
    one_room: {
        partiesItTakes: 1,
        aHouseCanClaimIt: false,
        itsExistenceIsPublic: false,
        note: 'One door and one room behind it. A wandering rogue does it in an afternoon and nobody hears about it, and there is nothing here for a house to hold because holding it would cost more than it contains.'
    },
    a_building: {
        partiesItTakes: 1,
        aHouseCanClaimIt: false,
        itsExistenceIsPublic: false,
        note: 'A store, a reading room, a working floor. One party, one trip, and the local villages usually know it is there and have not thought it worth anything.'
    },
    a_compound: {
        partiesItTakes: 3,
        aHouseCanClaimIt: true,
        itsExistenceIsPublic: true,
        note: 'Walls, several buildings and a layout somebody planned. Big enough that a house can put a claim on it and post people, and big enough that the claim is worth arguing about.'
    },
    a_mountain: {
        partiesItTakes: 8,
        aHouseCanClaimIt: true,
        itsExistenceIsPublic: true,
        note: 'A seat. Halls, wards, a road that used to go there and more than one person\'s worth of history in it. Opening one is an expedition, an argument between houses about who owns it, and a thing the province remembers the year of.'
    }
};

/**
 * How much of the arrangement still binds.
 *
 * THE AXIS, and the reason `left_addressed` and `abandoned_by_a_house` are not
 * two catalogs. An inheritance is a ruin plus an intent and intent has a
 * half-life; what wears it out is that the trial enforcing it IS A LIVE
 * FORMATION, and formations weaken. See `INTENT_HAS_A_HALF_LIFE` and
 * `how-far-gone-a-formation-is.ts`, which owns the clock.
 *
 *   `addressed`       Somebody arranged this for a claimant and the arrangement
 *                     still runs. The trial can still refuse people.
 *   `lapsed`          It was addressed and the sorting no longer works. The
 *                     conditions are still cut into the wall and nothing is
 *                     enforcing them, so the place admits whoever turns up -
 *                     which is what a ruin is.
 *   `never_addressed` Nobody arranged anything. A house left, or a man died, or
 *                     the sky did it.
 */
export const IntentStandingSchema = z.enum(['addressed', 'lapsed', 'never_addressed']);
export type IntentStanding = z.infer<typeof IntentStandingSchema>;

export const RuinCharacterSchema = z.enum([
    /** A house's seat, standing, with its formations unlit. */
    'compound',
    /** A refining or forging floor. The furnace is cold and the stock is not. */
    'workshop',
    /** Where a house kept what it wrote down. */
    'archive',
    /** Sealed on purpose, and the purpose is frequently still running. */
    'vault',
    /** Ground two parties ended each other on. Nobody built it and nobody left it. */
    'battlefield',
    /**
     * Ground the sky or the catastrophe fused. Not a battlefield - nobody was
     * fighting - and not open ground, because open ground is only unbuilt and a
     * scar is unbuilt and changed. `scar` is already a `LocationKind` for the
     * same reason.
     */
    'scar',
    /** A relay, a border post, a bridge house. The shallowest sort and the first found. */
    'waystation',
    /** A walled growing ground, gone feral and still walled. */
    'physic_garden',
    /** A node of something bigger that is no longer there, still carrying its share. */
    'array_anchor',
    /** Where a house kept its dead, which is not the same as where somebody died. */
    'ossuary',
    /** Where a curriculum was cut and taught out of. */
    'teaching_hall',
    /** A quarry, a shaft, a working face. Somebody was taking something out. */
    'cut',
    /** Somebody's own rooms, which is the smallest and most specific sort. */
    'dwelling',
    /** No building at all. A bench, a ledge, a depression, a stone in a field. */
    'open_ground'
]);
export type RuinCharacter = z.infer<typeof RuinCharacterSchema>;

// ─────────────────────────────────────────────────────────────────────────
// THE THREE WAYS GROUND IS CLOSED
//
// A gate is a question the DOOR asks the claimant about themselves. Access is
// a fact about the GROUND: what it does to a body standing in it, whether or
// not there is a door and whether or not anybody set anything. Most graves in
// this catalog have no gate at all and every one of them still has an access
// band, which is why this is not a fourth gate kind - it would be a gate that
// half the entries could not carry.
//
// It is also not a new mechanism. `LocationThresholds` in the world layer has
// carried `entry`/`survival` from the beginning and means exactly this; what
// the world layer had no way to say, and what the design owner asked for, is
// the other two.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The rung at which somebody is an elder somewhere.
 *
 * Core Formation, and the ladder's own note on that realm is the argument:
 * "Sects stop recruiting you and start negotiating with you." Below it a person
 * is somebody's disciple however senior they feel; at it they are a body a
 * house seats rather than trains. Stated once here so no entry re-derives it.
 */
export const ELDER_FLOOR_ORDINAL = 17;

export const THE_THREE_WAYS_GROUND_IS_CLOSED = {
    principle:
        'Ground is closed three ways and they are three different problems rather than three numbers on one row. A minimum makes a ruin a gamble. A cap makes it a thing you have to send somebody else into. An elder floor makes it an errand run for somebody who cannot come.',
    theMinimumIsTheOrdinaryCase:
        'Nothing forbids entry. A cultivator can always walk in, and the question is whether they walk out. The floor is not a rule, it is a description of what is down there, and where it sits relative to what the place holds is the whole of the site\'s risk against its reward. This is what most ruins have and it is what makes a ruin a decision rather than a queue.',
    theCapIsNotOneMechanism:
        'Some ground will not open to somebody too strong, and the reason has to differ between sites or it becomes one rule wearing thirteen hats. An entry array calibrated for a house\'s own disciples reads a pressure above that as an attack and shuts. A crawl cut for a body does not admit a field larger than a body. A floor over a void does not hold a heavy presence. A tally door answers to the token a disciple carried and does not know what an elder is. A containment tightens against power because power is the thing it was set against. What is in there goes to ground when something big walks in, and it was the thing worth having.',
    theElderFloorIsTheCapFromTheOtherEnd:
        'Both mean the person who enters and the person who gains are different people, and that is the fact worth making legible. Under a cap the beneficiary is above the line and sends somebody below it. Under an elder floor the beneficiary is below the line and cannot be sent at all, so somebody senior goes instead.',
    andWhyAnElderWouldBother:
        'Because they are not going for themselves. A senior cultivator with a long span and nothing further to gain personally goes into dangerous ground to bring something back for a junior, which is a motive that is not greed, an act that creates an obligation, and the only reason the high bands do anything at all in this part of the world. It is continuous with what the world already does: a house spends an irreplaceable material on the disciple stopped at a wall, an elder spends structural repair medicine on kin or on the house\'s chosen, and a house invests decades in a chosen before anybody asks what for. An elder going into a hole for an inheritor is that same relationship expressed as an expedition.',
    theTest:
        'For any proposed access band: does it change what somebody DOES, or only what number they need? A minimum changes whether they go. A cap changes who goes. An elder floor changes who it is for. If the answer is "they need a bigger number", it is a minimum and should be written as one.'
} as const;

export const RuinAccessSchema = z.discriminatedUnion('admits', [
    /**
     * The gamble. Anybody may walk in; below the floor they do not walk out.
     */
    z.object({
        admits: z.literal('anyone_who_survives_it'),
        /** Below this the place kills them. It is a fact, not a permission. */
        floorOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
        whatIsDownThere: z.string().min(80),
        whatItDoesToSomebodyShortOfIt: z.string().min(80)
    }),
    /**
     * The cap. Closed above a line, for a reason that is this site's own.
     */
    z.object({
        admits: z.literal('nobody_above_the_line'),
        floorOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
        ceilingOrdinal: z.number().int().min(0).max(MAX_ORDINAL),
        /** The specific thing that measures the person. Never the same twice. */
        whatReadsThePerson: z.string().min(80),
        whyItRefusesPower: z.string().min(80),
        /** Who ends up going, and for whom. The point of a cap. */
        soWhoGoesInstead: z.string().min(80)
    }),
    /**
     * The errand. High enough that only a senior survives it, and the senior is
     * not the one who gains.
     */
    z.object({
        admits: z.literal('elders_and_above'),
        floorOrdinal: z.number().int().min(ELDER_FLOOR_ORDINAL).max(MAX_ORDINAL),
        whyNobodyBelowComesBack: z.string().min(80),
        /** The junior it is being done for. Never the entrant. */
        whoTheyGoFor: z.string().min(60),
        whatComesBackForThatPerson: z.string().min(60)
    })
]);
export type RuinAccess = z.infer<typeof RuinAccessSchema>;

/**
 * Whether the body that goes in is the body that gains.
 *
 * False under a cap and under an elder floor, and that is the whole of what
 * those two have in common. A narrator that wants to say why somebody is
 * standing outside a door they could open should read this.
 */
export function entrantIsTheBeneficiary(access: RuinAccess): boolean {
    return access.admits === 'anyone_who_survives_it';
}

/** The band of ordinal this ground admits at all, inclusive. */
export function admittedBand(access: RuinAccess): { floor: number; ceiling: number | null } {
    return {
        floor: access.floorOrdinal,
        ceiling: access.admits === 'nobody_above_the_line' ? access.ceilingOrdinal : null
    };
}

export interface AdmissionReading {
    /** True when the ground will let this body in at all. */
    admitted: boolean;
    /** True when it will also let them out. Distinct, and the distinction is the point. */
    survives: boolean;
    /** Which way it is closed, where it is. */
    closedBy: 'below_the_floor' | 'above_the_line' | null;
    /** The site's own words for it. Never composed from a template. */
    account: string;
}

/**
 * What this ground does to a body at this ordinal.
 *
 * `admitted` and `survives` are two answers and not one, because the ordinary
 * case is a place that admits everybody and kills most of them. Collapsing
 * them would turn every minimum into a locked door, which is precisely what a
 * minimum is not.
 */
export function readAdmission(access: RuinAccess, ordinal: number): AdmissionReading {
    if (access.admits === 'nobody_above_the_line' && ordinal > access.ceilingOrdinal) {
        return {
            admitted: false,
            survives: false,
            closedBy: 'above_the_line',
            account: `${access.whatReadsThePerson} ${access.whyItRefusesPower} ${access.soWhoGoesInstead}`
        };
    }
    if (ordinal < access.floorOrdinal) {
        const account = access.admits === 'anyone_who_survives_it'
            ? `${access.whatIsDownThere} ${access.whatItDoesToSomebodyShortOfIt}`
            : access.admits === 'elders_and_above'
                ? `${access.whyNobodyBelowComesBack} ${access.whoTheyGoFor}`
                : access.whatReadsThePerson;
        // Admitted and not survived. The door is not what stops them.
        return { admitted: true, survives: false, closedBy: 'below_the_floor', account };
    }
    return {
        admitted: true,
        survives: true,
        closedBy: null,
        account: access.admits === 'anyone_who_survives_it'
            ? access.whatIsDownThere
            : access.admits === 'elders_and_above'
                ? access.whatComesBackForThatPerson
                : access.whatReadsThePerson
    };
}

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
    /** What sort of place it is. Orthogonal to `kind`. See `RuinCharacterSchema`. */
    character: RuinCharacterSchema,
    /** Where it came from. A floor rather than a taxonomy. */
    origin: RuinOriginSchema,
    /** How big it is, and therefore who can take it. See `WHAT_SCALE_DECIDES`. */
    scale: RuinScaleSchema,
    /** How much of the arrangement still binds. The axis, not a category. */
    intent: IntentStandingSchema,
    /** What the ground does to a body standing in it. See `RuinAccessSchema`. */
    access: RuinAccessSchema,
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
    character: RuinCharacterSchema,
    origin: RuinOriginSchema,
    scale: RuinScaleSchema,
    intent: IntentStandingSchema,
    access: RuinAccessSchema,
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
        name: 'Handworn Gate',
        character: 'compound',
        origin: 'abandoned_by_a_house',
        scale: 'a_mountain',
        intent: 'lapsed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 13,
            whatIsDownThere: 'A hall that discharges a measured load into a body at the far end of it, at the figure a Foundation Establishment applicant was expected to hold for a count of six, four times a year, for nobody.',
            whatItDoesToSomebodyShortOfIt: 'Below Foundation there is nothing in the body to spread the load through. The channels either side of the walk were cut to drain what happens, which is the whole of the description anybody needs.'
        },
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
        name: 'The Eighth Stone',
        character: 'array_anchor',
        origin: 'abandoned_by_a_house',
        scale: 'a_compound',
        intent: 'never_addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 26,
            whatIsDownThere: 'A ninth of a containment ring, redistributed onto eight stones instead of nine, read off any body standing in the room at the foot of the worst-loaded leg. It does not build and it does not stop.',
            whatItDoesToSomebodyShortOfIt: 'Puts them on the floor in the first ten paces and keeps them there until they stop breathing, which is slow enough that every recovery attempt in the site\'s history was launched on good information and arrived late.'
        },
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
                techniqueIds: [
                    'anchor-nail-of-the-broken-girdle',
                ],
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
        name: 'The Indrawn Hall',
        character: 'workshop',
        origin: 'overrun_at_work',
        scale: 'a_building',
        intent: 'lapsed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 31,
            whatIsDownThere: 'Nine hundred years of stored draw on a plinth at chest height, in a hall built to deliver two years of it to one candidate standing in exactly that spot, holding about four hundred and fifty times what it was sized for.',
            whatItDoesToSomebodyShortOfIt: 'Cinders, immediately, along with everything they were carrying and everything within about nine paces of them. There is no wounded and there is no witness, which is why the site keeps taking crews on the same reasoning as the last crew.'
        },
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
        name: 'The Burned Bench',
        character: 'open_ground',
        origin: 'left_addressed',
        scale: 'one_room',
        intent: 'addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'A bench, a table and a book. Nobody has ever been hurt at this site and nobody ever will be, which is the most dangerous thing about it and the reason the Temple calls it furniture.',
            whatItDoesToSomebodyShortOfIt: 'Nothing, because there is nobody it is above. The floor is zero and it is honestly zero: the cost of this ground is charged to whoever reads far enough to be entered as having read, and a villager can incur it.'
        },
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
                techniqueIds: [
                    // Forty-one benches for settling what is owed between people, and
                    // the art for cutting the thread instead. The Tally Court kept
                    // both and used only one.
                    'severance-of-the-standing-thread',
                    'severed-thread-audit', 'unpayable-tally-brand',
                ],
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
        name: 'The Empty Frame',
        character: 'waystation',
        origin: 'abandoned_by_a_house',
        scale: 'a_compound',
        intent: 'lapsed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'A terminal hall with thirty-one arches, nine of them answering and four of those opening somewhere a person can breathe. The hall is indifferent to rank and has been open continuously for fourteen hundred years.',
            whatItDoesToSomebodyShortOfIt: 'Nothing. Station staff sweep the yard around the frame daily and walk through it, and the frame has never done anything to any of them, because the yard is also there and the yard is what they are in.'
        },
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
                techniqueIds: [
                    // A room swept, left tidy, and still exactly as it was left. The art
                    // in it is the reason, and nobody who has catalogued the site has
                    // connected the two facts.
                    'stillness-of-the-turning-year',
                    'gate-that-was-closed',
                ],
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
        name: 'The Written Ledge',
        character: 'teaching_hall',
        origin: 'abandoned_by_a_house',
        scale: 'a_building',
        intent: 'never_addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'Nine sections of working exercise cut into a stone face on an open ledge, in the ordinary hand of the province, legible to anybody who can read. The obstacle at this site has never been the text and is never the rank.',
            whatItDoesToSomebodyShortOfIt: 'Nothing kills on the ledge and nothing ever has. What the fifth section does to a wuxing root that pushed past the fourth is the ordinary meridian injury, which the ordinary pill fixes inside a season and which four people are carrying permanently because the Court\'s stipend does not cover the pill.'
        },
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
        name: 'The Slow Door',
        character: 'dwelling',
        origin: 'left_addressed',
        scale: 'one_room',
        intent: 'addressed',
        access: {
            admits: 'nobody_above_the_line',
            floorOrdinal: 13,
            ceilingOrdinal: 20,
            whatReadsThePerson: 'The gathering array cut into the floor, which was laid to read a foundation by sitting a body in it for one circulation. It is a measuring instrument and it has the range a measuring instrument has.',
            whyItRefusesPower: 'Above Core Formation the foundation has been built on top of so many times that what the array gets back is not a reading of a foundation at all, and an instrument that cannot read does not open a chest on a guess. The strongest party ever to sit in it got the same answer as an empty room.',
            soWhoGoesInstead: 'A house that understands the site sends the disciple whose foundation it is proudest of, which is precisely backwards from how a house sends anybody anywhere else, and is why the two sects that have worked it out do not say so.'
        },
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
        name: 'The Seamless Door',
        character: 'compound',
        origin: 'left_addressed',
        scale: 'a_building',
        intent: 'addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'A room with a log in it. Nothing in it is dangerous, nothing is set for anybody and nothing has ever hurt a person who got inside, which is the honest reading and not a reassurance.',
            whatItDoesToSomebodyShortOfIt: 'Nothing at all. Girdle descendants have lived against the outside of this door for nine hundred years without it doing anything to any of them, and the cost of the site is entirely in what the log says once somebody is holding it.'
        },
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
                    // A door that opens for somebody a house wrote an account of without
                    // troubling to name, holding the art for taking a name back. The
                    // pairing is not commented on anywhere in the room.
                    'unsaying-of-a-given-name',
                    'nameless-witness-stance',
                    // The art that makes a person act, in the one room in the
                    // world whose whole subject is what a person said and
                    // whether they meant it. Whoever put the log here also
                    // left the thing that would have made the log worthless,
                    // and did not explain the pairing.
                    'sixteen-thread-command',
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
        name: 'The Dyer\'s Vault',
        character: 'archive',
        origin: 'abandoned_by_a_house',
        scale: 'a_building',
        intent: 'never_addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'A filing room. Several thousand live obligations with nobody holding them, in a brick vault under a working yard, and not one thing in it that was ever meant to injure a person.',
            whatItDoesToSomebodyShortOfIt: 'Nothing, and it cannot be forced either, so a mortal and an immortal get exactly the same result from trying. The danger at this site is all downstream of holding the position, which is a thing a person acquires rather than survives.'
        },
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
        name: 'The Unlocked Box',
        character: 'vault',
        origin: 'left_addressed',
        scale: 'one_room',
        intent: 'addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'A stone box on a plinth just inside an open threshold, closed for six hundred years and not locked. The elder who put it here wrote down that he did not want a guarded thing, he wanted an unspendable one.',
            whatItDoesToSomebodyShortOfIt: 'Nothing whatever. Anybody can walk in, and anybody can put both hands on the box, and the six hundred years of it staying shut are six hundred years of people who could have opened it deciding on the threshold that they would rather have it.'
        },
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
                techniqueIds: [
                    // A door that opens only for somebody who refuses it, holding the art
                    // for returning a chooser to the doorway. Whoever set this was
                    // making a point and left no note explaining it.
                    'the-hour-that-was-not-taken',
                ],
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
        name: 'The Unwalked Circle',
        character: 'scar',
        origin: 'what_the_catastrophe_made',
        scale: 'a_compound',
        intent: 'addressed',
        access: {
            admits: 'nobody_above_the_line',
            floorOrdinal: 0,
            ceilingOrdinal: 24,
            whatReadsThePerson: 'The working itself, which is a transfer with the vessel condition left open and therefore has to take hold of whoever stands in the circle before it can do anything at all.',
            whyItRefusesPower: 'Past Nascent Soul there is too much of the claimant\'s own settled self for the transfer to get purchase on, so it does not engage and nothing happens. This is why the circle is four generations old, sits beside a walked track, and has never once taken one of the strong people who have stood in it out of curiosity.',
            soWhoGoesInstead: 'Nobody sends anybody, and the two houses that understand the circle have both decided independently not to. The single recorded attempt was a party who sent a junior in without telling him what the ground was for, which is the whole of why the burn crews will not step over the line.'
        },
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
                techniqueIds: [
                    // Ground that will not accept the claimant it was left
                    // for, holding the art for unsetting a mark somebody set
                    // on purpose. Every claim in the room is resting on a line
                    // and the thing behind the door dissolves lines.
                    'unfixing-of-the-set-mark',
                    'severed-fate-mending-art'
                ],
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
        name: 'The Counted Stair',
        character: 'cut',
        origin: 'abandoned_by_a_house',
        scale: 'a_compound',
        intent: 'never_addressed',
        access: {
            admits: 'elders_and_above',
            floorOrdinal: 33,
            whyNobodyBelowComesBack: 'The descent, not the station. The stair goes down further than the gallery is high, does not turn, and is what kills in almost every recorded case; the sump gate at the bottom takes the rest. The Deep Survey staffed it continuously for two hundred and ten years with people who walked it daily and it has killed everybody who has tried it since on the way down.',
            whoTheyGoFor: 'The Survey\'s own readers-in-training, who will spend their careers on the branch sequence and cannot make the descent to fetch it, and who are the reason a seated surveyor goes down at all.',
            whatComesBackForThatPerson: 'The station\'s working sequence, which is the thing a reader needs before the fourth branch is anything but a hole, and which is carried up by somebody who will never use it themselves.'
        },
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
                techniqueIds: [
                    // The art for taking the qi out of a place, in a station built to
                    // measure how much of it a branch was carrying. Whoever shelved it
                    // here filed it with the surveys rather than with the weapons.
                    'quenching-of-the-standing-air',
                    'abyssal-gate-torrent', 'dragonbone-severing-decree',
                ],
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
        name: 'The Inward Faces',
        character: 'array_anchor',
        origin: 'left_addressed',
        scale: 'a_compound',
        intent: 'lapsed',
        access: {
            admits: 'elders_and_above',
            floorOrdinal: 37,
            whyNobodyBelowComesBack: 'The ground, and only the ground. Nothing on the site is hostile and nothing is concealed: reading the inward faces spends at a rate nobody budgets for because nobody expects a stone to charge for being looked at, and the ring is two hundred paces across with nothing in it to draw on.',
            whoTheyGoFor: 'Whoever in the reader\'s house is going to stand where those four candidates stood, which at Grand Ascension is always somebody younger and is never the reader.',
            whatComesBackForThatPerson: 'Four separate accounts of the hours before an attempt at the last crossing, written by four people who did not know about each other and did not come back, which is the only document of its kind anybody holds.'
        },
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
                techniqueIds: [
                    'calamity-word-of-the-open-sky',
                    // Four faces looking inward, and the art in the room with
                    // them is the one for making a second body. Whoever set
                    // this did not think that needed explaining.
                    'hollow-second-body'
                ],
                other: [
                    'Four names, four dates and four ranks at the moment of attempt, cut small at the foot of each face, which is a better record of what the last crossing takes than anything the Long Cut has ever published.',
                    'The plain fact that the four hands agree, which is worth more to the House of Held Names than the art is, and which the Long Cut would prefer stayed on the stones.'
                ],
                immortalItemId: null
            },
            afterwards: 'Nothing changes and nothing is spent. The stones are stones, the ring is still ground that gives nothing back, and the next claimant reads the same four faces. What the site loses when somebody takes it is exclusivity, which the Long Cut has never had and has never wanted, because a candidate who cannot get to the ring is not a candidate it would have authorised.'
        }
    },

    // ── ground that is closed against strength ────────────────────────
    //
    // Four entries whose access band is a CAP, and the reason differs at
    // every one of them, which is the whole requirement: an array with a
    // calibrated range, a ward that classifies by weight, a floor over a
    // void, and a door that only knows one kind of token. A cap makes a
    // site a thing somebody has to be SENT into, and the four of them
    // together are the argument that this is a property of ground rather
    // than one rule wearing four hats.
    {
        id: 'trial-the-beds-that-read-weight',
        kind: 'trial',
        name: 'The Eleven Beds',
        character: 'physic_garden',
        origin: 'overrun_at_work',
        scale: 'a_building',
        intent: 'never_addressed',
        access: {
            admits: 'nobody_above_the_line',
            floorOrdinal: 0,
            ceilingOrdinal: 16,
            whatReadsThePerson: 'A grazing ward laid over eleven beds, which does one thing: it decides whether the thing that has come over the wall is a person or an animal, and it decides by weight of presence because that is the only measure a herbalist had that a deer could not fake.',
            whyItRefusesPower: 'A cultivator past Foundation Establishment reads to the ward as something very large and very hungry, and the ward does what it was built to do about something large and hungry, which is fold the beds down into the ground and stay folded until the thing goes away. Nothing is destroyed and nobody is attacked. The garden simply is not there any more.',
            soWhoGoesInstead: 'The Hall\'s youngest, which the Hall has been doing without knowing why for a hundred and ten years: the standing instruction is that the walled ground is a task for a first-year, everyone assumes it is because the work is menial, and it is the only reason the Hall gets anything out of it at all.'
        },
        factionIds: ['sect-frostmirror-court', 'house-measured-span'],
        outside: {
            marker: 'A dry-stone wall about chest height enclosing rather more ground than a garden needs, with a gate that has rotted off its hangings and been left where it fell. Inside, eleven long beds are still visible as ridges under the grass, and the grass over them is a different colour from the grass everywhere else.',
            rumour: 'The valley calls it the old physic wall and says the beds went over to weeds four generations back. Herb crews cut through it as a shortcut and have never once brought anything out of it, which everybody treats as settled evidence.',
            attributedTo: 'A growing house that supplied the terraced valley before the Hall did',
            lastPartySaid: 'A Span forage contractor walked the wall two years ago at Core Formation, wrote that the beds were extinct, and cut the survey short because there was demonstrably nothing there.',
            whatAKnowledgeablePartyReads: 'That grass grows a different colour over ground that is still being worked, and that eleven ridges holding their line under a century of turf are eleven ridges something is holding. A walled growing ground that empties every time a strong person looks at it is not empty. It is a garden with an opinion about who is standing in it, and the opinion is one a herbalist would have built on purpose.',
            whatAnIgnorantPartyConcludes: 'That the beds are dead, because every competent person who has ever gone to check has found dead beds, and the stronger the person who checked the more certain the conclusion. The evidence is unanimous, it is first-hand, it has been gathered repeatedly over a century, and it is produced by the act of gathering it.',
            startingAwareness: 'named',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'Standing in the enclosure at the right weight, the ridges are beds and the beds are worked: eleven of them, planted in a rotation, each one carrying a crop that has been running unattended and unharvested for a hundred and ten years and has therefore run to a maturity nothing in cultivation ever reaches. At the head of the fourth bed there is a slate with the rotation cut into it and the intervals marked in a hand that used numbers the valley stopped using.',
            setBy: 'A growing house that lost its people in a bad decade and left the ward running because there was nobody left who knew how to take it down. It was never a test and was never meant to keep anybody out. It was a fence against deer, built by somebody who had lost a season to deer and had decided it would not happen twice.',
            gates: [
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'years_cultivated',
                            atLeast: 6,
                            note: 'The rotation is on a slate in an obsolete numbering and reading it is a matter of having seen enough seasons pass to know what a rotation is for.'
                        },
                        {
                            measure: 'attribute',
                            attribute: 'insight',
                            atLeast: 2,
                            note: 'Eleven beds at eleven different points of a cycle, and cutting the wrong one at the wrong point ends that bed for good rather than costing a harvest.'
                        }
                    ],
                    test: 'Read the slate at the head of the fourth bed and cut in the order it gives. The whole of the difficulty is that the beds do not look different from each other to somebody who has not read it, and a person who cuts by eye takes the two that were nearly ready and destroys the nine that were not.',
                    strengthDoesNotHelp: 'There is nothing here to apply force to and force is what closes the site in the first place. The one thing a strong claimant could do about this garden is stand outside the wall and send somebody, which is the correct play and is what the access band is describing.',
                    below: 'A claimant who cuts by eye gets one useful harvest and leaves an enclosure of destroyed beds, which is what four of the six recorded harvests have been and is why the site is thought to be nearly worked out when it has never once been worked properly.'
                }
            ],
            howItKills: 'It does not, and nothing in the enclosure has ever hurt anybody. What it costs is the beds: a rotation cut in the wrong order does not recover, and eleven beds that have been running for a hundred and ten years are eleven things that cannot be started again by anybody now living. Every party that has taken something out of this garden has taken it by ending part of the garden, and none of them knew that at the time.',
            prize: {
                techniqueIds: [],
                other: [
                    'Eleven beds of a rotation nobody has interrupted for a hundred and ten years, which is a length of undisturbed growth that cannot be bought, cannot be forced and cannot be started again inside the life of anybody now alive.',
                    'The rotation itself, cut on the slate at the head of the fourth bed, in the intervals the growing house actually used rather than the ones the Hall teaches, which differ at three points and differ in the direction that matters.'
                ],
                immortalItemId: null
            },
            afterwards: 'The beds that were cut correctly come back on their own interval, so a party that read the slate can come back in eleven years and find the garden working. A party that cut by eye has left an enclosure with grass in it. This is the only site in the catalog whose value depends on how carefully it was taken rather than on whether it was taken.'
        }
    },
    {
        id: 'trial-the-floor-over-the-old-cut',
        kind: 'trial',
        name: 'The Long Rope',
        character: 'cut',
        origin: 'overrun_at_work',
        scale: 'a_building',
        intent: 'never_addressed',
        access: {
            admits: 'nobody_above_the_line',
            floorOrdinal: 4,
            ceilingOrdinal: 28,
            whatReadsThePerson: 'The floor, which is two spans of dressed slab laid across the head of a worked-out shaft on the understanding that nobody would ever need to stand on it for long, and which is holding up a ceiling as well as a walkway.',
            whyItRefusesPower: 'Weight here is not a number in a ledger, it is a load on stone. A cultivator past Deity Transformation does not walk on a floor so much as press on it, and the slab over the shaft head has about the margin a two-hundred-year-old slab has. Three parties have gone through it and the shaft under it is four hundred paces of nothing.',
            soWhoGoesInstead: 'Whoever in the party is smallest, roped, with everybody heavy standing on the gallery side of the door. This is the ordinary practice of every survey house and it is written into the Deep Survey\'s own procedure, which does not explain why and does not have to.'
        },
        factionIds: ['house-anchorhold', 'house-measured-span'],
        outside: {
            marker: 'A door in the side of a dry gallery, propped, with a working floor visible beyond it and a rope still tied off to the frame. The rope goes through the doorway and down, which is not where a rope for a floor goes. There is a chalk line across the threshold that somebody has redrawn several times.',
            rumour: 'Gallery crews say the old cut behind that door was worked out before anybody\'s grandfather and that the floor is safe because people have walked it for two hundred years. Both halves are true and they are not the same claim.',
            attributedTo: null,
            lastPartySaid: 'Four from a salvage crew went through six years ago. The two at the back are alive. Their account is that the floor was fine right up until it was not, and that nothing had changed except who was standing on it.',
            whatAKnowledgeablePartyReads: 'That a rope tied off at a doorway and running down through it is a rope for the shaft rather than for the floor, and that somebody redraws a chalk line on the threshold for a reason. A worked-out cut with a dressed floor over the shaft head is a place where the last crew laid a lid and left, and a lid is sized for the people who laid it.',
            whatAnIgnorantPartyConcludes: 'That two hundred years of people crossing a floor is two hundred years of evidence the floor holds, which it is, for the sort of person who has been crossing it. The stronger the party, the more confident it is, and the more confident it is the fewer of them go through the door one at a time.',
            startingAwareness: 'whisper',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'A working floor about thirty paces square with the stock still on it: cut faces stacked against the far wall in the sizes the house used, a dressing bench with the tools laid out in order along the back of it, and the shaft head under the middle of the floor with two spans of slab across it. Everything on this floor was left tidy by people who expected to come back on the Monday, and the tidiness is what makes it legible.',
            setBy: 'Nobody. There is no test here and nothing was arranged: a cutting house closed a worked-out face at the end of a season, laid a floor over the shaft so the gallery could still be used, stacked the last of the stock and went home. The house was gone inside two years for reasons that had nothing to do with this cut.',
            gates: [
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'insight',
                            domain: 'formation',
                            atLeast: 2,
                            note: 'The stock against the wall is cut to a house standard and the standard is the document. Reading it off the sizes is a formation reader\'s habit rather than a mason\'s.'
                        },
                        {
                            measure: 'years_cultivated',
                            atLeast: 12,
                            note: 'Twelve years is about how long it takes anybody to have seen enough working floors to know which of the tools on the bench is the one that is not ordinary.'
                        }
                    ],
                    test: 'Read the stack. The house cut its stone to a standard that encodes what the stone was for, and the sizes against the far wall are an inventory of everything the house was building at the moment it stopped, in a notation that was never written down anywhere because the people who used it were looking at it every day.',
                    strengthDoesNotHelp: 'The floor is the reason a strong claimant is not in this room, and if one were the stack would still be a stack of cut stone in sizes that mean nothing to somebody who has not spent years around a dressing bench. Nothing on this floor can be lifted into revealing anything.',
                    below: 'A claimant who cannot read the stack takes the tools, which are good tools and are worth about what good tools are worth, and leaves the thing they came for standing against the wall in plain sight.'
                }
            ],
            howItKills: 'By the floor, and only in one direction. Nothing on the site is hostile, nothing is concealed and the shaft is not hidden - the slab over it is the most visible thing in the room. What kills is a heavy body standing on a lid that was laid for the crew who laid it, and the fall is four hundred paces of worked-out shaft with the ladders taken out at the end of the season.',
            prize: {
                techniqueIds: [],
                other: [
                    'The house\'s cutting standard, readable off the stock against the far wall, which states what every size was for and is the only surviving statement of what that house was actually building in its last season.',
                    'A dressing tool on the bench that is not one of the eleven a mason carries, and which is the reason a cutting house was able to work a face that three houses since have called unworkable.'
                ],
                immortalItemId: null
            },
            afterwards: 'The stack stays where it is, because reading it does not consume it and a second reader gets the same standard off the same stones. What is spent is the tool on the bench, which is one object and leaves with whoever takes it. The floor goes on holding whatever it can hold until it does not.'
        }
    },
    {
        id: 'trial-the-door-that-only-knows-tokens',
        kind: 'trial',
        name: 'The Low Slot',
        character: 'vault',
        origin: 'abandoned_by_a_house',
        scale: 'a_building',
        intent: 'never_addressed',
        access: {
            admits: 'nobody_above_the_line',
            floorOrdinal: 0,
            ceilingOrdinal: 12,
            whatReadsThePerson: 'A tally door on an outer store, which opens to a disciple\'s draw token and to nothing else. It was built to let an errand-runner take a sack of grain out without finding a seated member of the house to ask.',
            whyItRefusesPower: 'The door does not refuse power, it does not know what power is. It knows tokens, and a token was a thing carried by somebody at the bottom of a house that issued them to its intake and to nobody above Qi Condensation, because above Qi Condensation you sent somebody. A Nascent Soul cultivator standing at that door is standing in front of a mechanism with no concept she fits into.',
            soWhoGoesInstead: 'Somebody\'s errand-runner, exactly as it always was. Two houses have worked this out and both of them handle it the same way, which is to hand a token to their newest intake and to tell them nothing, and one of those houses has been doing it for sixty years.'
        },
        factionIds: ['sect-nine-peaks-ascetic-order', 'house-ninefold-ledger'],
        outside: {
            marker: 'A store front built into a bank at the edge of a compound that has otherwise fallen in, with a slot beside the door at about the height of a boy\'s chest and a shallow dish worn into the stone underneath it. The door is intact, the lintel is intact, and the roof of everything behind it is on the floor.',
            rumour: 'Locals say the stores at the old compound were emptied within a month of the sect going and that the last door is stuck. The children of the two nearest villages have been putting things in the slot for as long as anybody remembers, on a dare, and nothing has ever happened.',
            attributedTo: 'The sect that held the compound, whose intake tokens are still turned up by ploughing',
            lastPartySaid: 'A Ledger valuation clerk came out four years ago to price the site for a client, spent a morning on the door, and wrote that it was a common tally lock, that the tallies were long gone, and that the store was therefore closed permanently.',
            whatAKnowledgeablePartyReads: 'That the slot is at the height of a boy\'s chest and the dish under it is worn, which means the door was used constantly by short people carrying things and was never a security fitting at all. A tally lock on an outer store is the least serious lock a house owns, and the reason it is the only door still standing is that nobody has ever bothered to break something that was not worth breaking.',
            whatAnIgnorantPartyConcludes: 'That an intact door on a fallen compound is the door worth opening, and that a lock nobody has beaten in four hundred years is a serious lock. Eleven parties have attacked this door and none of them has looked at the height of the slot, which is the entire answer and is visible from the road.',
            startingAwareness: 'named',
            advertisedOrdinal: 6
        },
        interior: {
            chamber: 'A store: four bays of shelving on the left, a counting table under the slot on the right with the tally box still on it, and a run of sacks along the back wall that went to dust several centuries ago and left their shapes. On the counting table, under the box, is the issue book, which records every token drawn and returned for the last eleven years the house existed and is written in the hand of whichever child was on the counter that day.',
            setBy: 'A quartermaster, as a convenience. There is no test here, nothing was calibrated for a claimant, and nobody intended this room to survive anything: it is the least important door in a compound that had thirty, and it is the only one left because importance is what people come and break.',
            gates: [
                {
                    kind: 'strength',
                    ordinal: 2,
                    test: 'The door is heavy and it is stiff, and once the tally is in the slot it still has to be pulled. That is the whole of the physical test and it is set at about what a two-year intake could manage, because a two-year intake is who it was set for and there was never a reason to make it harder.',
                    below: 'A child or a mortal who has the tally cannot shift the leaf, which is the only reason the village children who have been putting things in that slot for generations have never got it open. Every one of them has satisfied the lock and none of them has satisfied the door.',
                    noWorkaround: 'There is none and there does not need to be one. It is a heavy leaf on a stiff hinge and either the person pulling it can pull it or they cannot; the ordinal is low enough that this has never been what stopped anybody.'
                },
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'attribute',
                            attribute: 'insight',
                            atLeast: 2,
                            note: 'The issue book is eleven years of a rotating series of children\'s hands and it takes some holding in the head to see that the same three names keep drawing against a bay that has no stock in it.'
                        },
                        {
                            measure: 'years_cultivated',
                            atLeast: 3,
                            note: 'Long enough to have been somebody\'s junior and to know what a draw book is for, which is a thing nobody who was never anybody\'s junior thinks to ask.'
                        }
                    ],
                    test: 'Read the issue book. It is a complete record of what a house of that size actually consumed, week by week, for its last eleven years, and it is the only document of its kind anybody holds, because a house\'s own quartermaster book is the first thing a raiding party burns and the last thing a raiding party values.',
                    strengthDoesNotHelp: 'The book is on the table in the open and a claimant of any rank can pick it up. What a claimant of any rank cannot do is see that the fourth bay was being drawn against by three people for two years after the fourth bay was formally struck off the inventory, which is the thing the book is actually worth.',
                    below: 'The claimant takes a store room with nothing in it and an old ledger, correctly values both at nothing, and leaves. This is what nine of the eleven recorded openings of similar doors have produced and it is why nobody prices a quartermaster book.'
                }
            ],
            howItKills: 'It does not, and there is nothing in this room that could hurt anybody. What the store costs is entirely a matter of who reads the fourth bay: three names drawing against struck stock for two years is a house feeding somebody it had stopped admitting to feeding, and two of those three names are on stones in the province with dates that do not match the account their descendants give.',
            prize: {
                techniqueIds: [],
                other: [
                    'The issue book: eleven years of one house\'s actual weekly consumption, in the hands of the children who kept the counter, which is the only surviving document of what a body of that size really cost to run.',
                    'The tally box, still on the counting table, holding forty-one returned tokens with the bearers\' marks on them, which is a roll of the house\'s intake for its last year and is the sort of thing an ancestral claim turns on.'
                ],
                immortalItemId: null
            },
            afterwards: 'The door stays open, because a tally door that has been opened does not shut itself and nobody is coming to reset it. The book leaves with whoever takes it. The store is then a store room with four empty bays in it, which is what everybody thought it was for four hundred years and what it will now genuinely be.'
        }
    },
    {
        id: 'trial-the-reading-room-that-was-not-shut',
        kind: 'trial',
        name: 'The Steady Draught',
        character: 'archive',
        origin: 'overrun_at_work',
        scale: 'a_compound',
        intent: 'never_addressed',
        access: {
            admits: 'elders_and_above',
            floorOrdinal: 25,
            whyNobodyBelowComesBack: 'The room is under a collapsed hall on a vein that has been drawing without a draw for eight hundred years, and the approach is a chimney of settled rubble that has to be held apart for as long as somebody is inside it. Below Deity Transformation nobody can hold it and go in as well, and the four parties that tried to do it in shifts are all in the chimney.',
            whoTheyGoFor: 'The junior the reader is bringing up, because a reading room is not a thing an elder needs and is exactly the thing somebody two realms below them is stopped for want of.',
            whatComesBackForThatPerson: 'A road. What is on the shelves is the working notes of a house that thought in one particular direction for two hundred years, which is the sort of thing that gives somebody a way of seeing they did not have and cannot be handed a technique for.'
        },
        factionIds: ['house-tally-court', 'sect-sweptground-temple'],
        outside: {
            marker: 'A fallen hall on a low rise with a chimney of settled rubble at one corner that goes down rather than in, and a draught coming out of it that does not vary with the weather and has not varied within living memory. The rubble around the mouth is polished on the underside where things have been dragged out of it.',
            rumour: 'The Temple lists it as a collapsed hall and has done for eight centuries. The draught is well known and is generally explained as a cave under the rise, which is a reasonable explanation and is the one the Temple prefers.',
            attributedTo: 'A house the Temple absorbed the ground of and not the people',
            lastPartySaid: 'Four went down in shifts eleven years ago on the theory that two could hold the chimney while two worked. The two who were holding it are the ones who are still in it.',
            whatAKnowledgeablePartyReads: 'A draught that does not vary with the weather is a draught with a vein behind it rather than a cave, and eight hundred years of a vein drawing into a sealed space under a fallen hall is a space that has not been touched. The polish on the underside of the rubble is people dragging things out, which means the chimney has been open and worked before, and the things that came out are not in any account anybody has published.',
            whatAnIgnorantPartyConcludes: 'That a collapsed hall is a collapsed hall, and that the draught means a cave, and that a cave under a rise in a province full of caves is not worth four days. The Temple has said so in writing for eight hundred years and the Temple is not lying: it does not know either.',
            startingAwareness: 'whisper',
            advertisedOrdinal: null
        },
        interior: {
            chamber: 'A reading room, whole, under the fallen hall: eight desks in two rows, the shelves down both long walls with the volumes still standing on them in order, and the lamps still in their brackets with oil in them because the room has had no air moving through it in eight hundred years. Somebody\'s work is open on the third desk with a marker in it, and the marker is a strip of cloth rather than paper, which is what a person uses when they mean to come back before the end of the day.',
            setBy: 'Nobody, and that is the point of it. This was a working reading room in a house that was in the middle of an ordinary morning when the hall came down on top of it, and every arrangement in the room is the arrangement of people who were about to have lunch. Nothing here was calibrated for a claimant because nobody in this room knew there was going to be one.',
            gates: [
                {
                    kind: 'age_and_talent',
                    requires: [
                        {
                            measure: 'insight',
                            domain: 'karma',
                            atLeast: 2,
                            note: 'The shelves are ordered by the house\'s own subject scheme and the scheme is the argument. Reading the order is reading what the house thought the world was made of.'
                        },
                        {
                            measure: 'attribute',
                            attribute: 'insight',
                            atLeast: 3,
                            note: 'Two hundred years of working notes by people who all agreed with each other, and the useful part is the three places where they stopped agreeing.'
                        },
                        {
                            measure: 'years_cultivated',
                            atLeast: 45,
                            note: 'A house\'s direction of thought is visible only against other houses\' directions, and nobody has seen enough of those in under half a century.'
                        }
                    ],
                    test: 'Read the shelves as an order rather than as a list. Two hundred years of one house\'s working notes, shelved by a scheme that house invented, is a complete statement of how those people saw and it is legible only to somebody who can hold the whole arrangement at once.',
                    strengthDoesNotHelp: 'Getting into this room takes Deity Transformation and getting anything out of it does not care. An elder who holds the chimney open, walks in, and reads a shelf of somebody else\'s notes without the comprehension to see the order is standing in a library with a headache, and four of the six who have got in are exactly that.',
                    below: 'The claimant carries out an armful of volumes, which are worth what old volumes are worth, and leaves the order on the shelves where the order is. The order is the thing and it does not travel in an armful.'
                }
            ],
            howItKills: 'By the chimney, in both directions, and it kills on the way out more often than on the way in because a party going out is carrying something and is tired. Nothing in the reading room itself has ever hurt anybody: the lamps have oil in them, the desks are desks, and the eight hundred years of stillness in there is the most benign thing on the site.',
            prize: {
                techniqueIds: [],
                other: [
                    'Two hundred years of one house\'s working notes, in their own shelf order, which is a complete statement of a way of seeing and is the only route by which that way of seeing is still available to anybody.',
                    'The work open on the third desk with a cloth marker in it, which is the last thing anybody in that house was doing and stops in the middle of a sentence.'
                ],
                immortalItemId: null
            },
            afterwards: 'The room is still there and the chimney still needs holding, so it stays an errand rather than becoming a route. What a second party finds is a reading room with a gap on one shelf and the third desk cleared, and the order the first party read is still readable because an order is not a thing that can be carried away.'
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
        name: 'The Tended Tomb',
        character: 'ossuary',
        origin: 'left_addressed',
        scale: 'a_building',
        intent: 'addressed',
        access: {
            admits: 'elders_and_above',
            floorOrdinal: 33,
            whyNobodyBelowComesBack: 'A chamber cut and dressed for a man who sat down at the end of Tribulation Transcendence, with what he was carrying still in it. Nothing in it was sized for a visitor and nothing in it has been made safe, and the masonry being maintained is not the same fact as the chamber being survivable.',
            whoTheyGoFor: 'The house\'s own chosen, who is the reason a seated elder is willing to open a door that everybody agrees should stay shut.',
            whatComesBackForThatPerson: 'What a man at the top of the ladder was still carrying when he stopped, none of which is the right size for the person who goes in and all of which is the right size for the person it is being fetched for.'
        },
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
        name: 'The Stopped Ground',
        character: 'scar',
        origin: 'what_the_catastrophe_made',
        scale: 'a_mountain',
        intent: 'never_addressed',
        access: {
            admits: 'elders_and_above',
            floorOrdinal: 29,
            whyNobodyBelowComesBack: 'Eleven li of ground that has not held qi in ninety years and will not again. There is nothing to draw on anywhere inside the boundary, so the crossing is paid entirely out of whatever the crosser walked in with, and the middle is further from either edge than most pools reach.',
            whoTheyGoFor: 'Anybody the crosser intends to outlive them, which after a failed crossing is the only reason left to walk onto ground that took the person who made it.',
            whatComesBackForThatPerson: 'What fell out of a hand. There is no body, no pouch and nothing anybody arranged, and it is the shortest list in the world and the best one.'
        },
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
        name: 'Struck Stone',
        character: 'scar',
        origin: 'what_the_catastrophe_made',
        scale: 'a_compound',
        intent: 'never_addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 24,
            whatIsDownThere: 'Two hundred paces of moor fused to a depth nobody has dug through, four hundred years old, with a body lying on top of it that was never buried and is the first thing every account of the site mentions.',
            whatItDoesToSomebodyShortOfIt: 'The residue is still in the ground and still discharging into anything that crosses it slowly enough. Below Nascent Soul a person gets about as far as the fused edge before what is left in the moor finishes what the lightning started.'
        },
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
                    what: 'A second slip in his left hand, unremarked in every account of the site, on a method for taking a piece of ground out of the world for an hour. It is the more useful of the two and nobody has ever mentioned it.',
                    proven: true,
                    survived: 'The tribulation that ended him, in his closed left hand, which is the only warranty any object in this world can carry and is one no forge can issue.',
                    techniqueId: 'sealed-field-of-the-shut-hour',
                    immortalItemId: null
                },
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
        name: 'The Worn Leaf',
        character: 'vault',
        origin: 'left_addressed',
        scale: 'a_building',
        intent: 'addressed',
        access: {
            admits: 'nobody_above_the_line',
            floorOrdinal: 0,
            ceilingOrdinal: 26,
            whatReadsThePerson: 'The clan, standing on the leaf. The undercroft is in the floor of a hall that is in daily use, walked over by forty people, and the only route in that does not end the clan is one the clan opens itself.',
            whyItRefusesPower: 'A house does not open its own floor for somebody who could take the hall off it afterwards, and there is no rank at which that stops being true - it gets worse. Above Deity Transformation the clan reads a visitor as the end of the clan and the leaf stays shut whatever is offered for it.',
            soWhoGoesInstead: 'Kin, or somebody a senior of the house has chosen to send in their place and has vouched for by name, which is the entire reason the clan mark is inlaid in the leaf where two hundred and forty years of feet can wear it smooth.'
        },
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
                    what: 'A manual at the back of the vault, older than the clan, describing how to put spears into the ground out of nothing - which the clan has held for four hundred years without a single member ever having had the rung to open it.',
                    proven: false,
                    survived: null,
                    techniqueId: 'thousand-spear-summoning',
                    immortalItemId: null
                },
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
        name: 'The Longer Stone',
        character: 'ossuary',
        origin: 'left_addressed',
        scale: 'one_room',
        intent: 'lapsed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'A low walled plot at the top of a terraced herb valley with ten physicians in it, nine of them ordinary Hall interments and one with a longer stone. Nothing here was ever set against anybody.',
            whatItDoesToSomebodyShortOfIt: 'Nothing, and the plot is walked into by the Hall\'s own students on the ordinary rounds. The eleven lines on the long stone are the whole of the site and they can be read by anybody standing in front of them, which is why the site has been open for a century and has not been taken.'
        },
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
                    what: 'A slim ancient volume kept separately from the notebooks, on a method for moving vitality out of one body and into another, with her own annotations arguing against it in the margins of every page.',
                    proven: false,
                    survived: null,
                    techniqueId: 'vessel-borrowing-palm',
                    immortalItemId: null
                },
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
        name: 'The Resealed Wall',
        character: 'workshop',
        origin: 'overrun_at_work',
        scale: 'a_compound',
        intent: 'never_addressed',
        access: {
            admits: 'nobody_above_the_line',
            floorOrdinal: 8,
            ceilingOrdinal: 24,
            whatReadsThePerson: 'The gap the Company left when it put the wall back by hand, which is a crawl about the width of a sorting hatch and was never meant to be a door at all.',
            whyItRefusesPower: 'A cultivator past Nascent Soul does not fit a crawl in the sense that matters: the field a body at that height carries is larger than the body, and a hole cut for a body reads it as the wall and closes on it. Two Gleaners have died going in the correct way round and one very strong outsider has died going in sideways.',
            soWhoGoesInstead: 'The Company sends its own small people, which is a sentence the Company would object to and is exactly what the wager board records: everybody whose name is on it went in at Foundation or under, and the amount is still written next to his.'
        },
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
                    what: 'A folded manual in the bottom of the kit, kept with the tools rather than with the valuables, in a hand and a vocabulary that is not modern. He had it for thirty years and used it as equipment.',
                    proven: false,
                    survived: null,
                    techniqueId: 'hundred-pace-step',
                    immortalItemId: null
                },
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
        name: 'The Dry Overhang',
        character: 'open_ground',
        origin: 'a_door_nobody_opened_again',
        scale: 'one_room',
        intent: 'never_addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'A dry overhang with a person under it who sat down against the rock and did not get up. There is no cutting, no cairn and no arrangement of any kind, and weather has done everything that has been done to the site.',
            whatItDoesToSomebodyShortOfIt: 'Nothing, which is precisely the problem: what closes this site is four days off the nearest track in either direction, and distance charges the same to a villager and to a Grand Ascension cultivator who does not know it is there.'
        },
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
        name: 'The Two Cairns',
        character: 'battlefield',
        origin: 'fought_over_and_left',
        scale: 'one_room',
        intent: 'never_addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'Two cairns eleven paces apart, raised by the same party on the same afternoon, with a stone standing at the head of each and no name on either. There is nothing else and there never was.',
            whatItDoesToSomebodyShortOfIt: 'Nothing. This is the plainest site in the catalog and the ordinary case for a grave: unguarded, unsealed, walked past by surveyors twice a season, and the only thing keeping anything in it is that nobody has thought it worth the digging.'
        },
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
                    // The manual that makes the site read differently, on the
                    // body of one of the two. Both of them were at the same
                    // rung, both died on the same afternoon, and the canon says
                    // the pairing ends when one of you does and that the
                    // survivor does not reliably survive it. The official
                    // account is a duel over a survey line, everybody local can
                    // name both parties, and nobody has ever asked why the
                    // second cairn was needed.
                    what: 'A worn earth-grade canon in the pouch of the cairn on the western side, on a method for two people cultivating as one circuit, with two names written inside the cover in the same hand.',
                    proven: false,
                    survived: null,
                    techniqueId: 'paired-breath-canon',
                    immortalItemId: null
                },
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
        name: 'The Ditch Culler',
        character: 'open_ground',
        origin: 'a_door_nobody_opened_again',
        scale: 'one_room',
        intent: 'never_addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'A man in a ditch with his contract still in his coat, three years there, reported twice by people who did not want the trouble of moving him. The village has a note of it and nothing else has happened.',
            whatItDoesToSomebodyShortOfIt: 'Nothing whatever, and the site is a hundred paces from a walked circuit. What has kept it is not danger and not concealment, it is that two separate people looked at a dead culler and decided he was somebody else\'s business.'
        },
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
        name: 'The Cut Brand',
        character: 'open_ground',
        origin: 'fought_over_and_left',
        scale: 'one_room',
        intent: 'never_addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 12,
            whatIsDownThere: 'A dry watercourse with a body in it that has not gone the way a body goes, laid in order, with a brand cut across the front of the skull that repeats on a stone at the head of the channel.',
            whatItDoesToSomebodyShortOfIt: 'Whatever was done to him is still being done, at the rate it has been done for as long as the channel has been dry, and a body below Foundation that lies down in that watercourse does not get up either. Nobody set this and nobody maintains it; it is a property of what happened here.'
        },
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
        name: 'The Green Glass',
        character: 'scar',
        origin: 'what_the_catastrophe_made',
        scale: 'a_compound',
        intent: 'never_addressed',
        access: {
            admits: 'elders_and_above',
            floorOrdinal: 34,
            whyNobodyBelowComesBack: 'Four hundred paces of fen fused to green glass with the reeds still standing in it, and the depression is at the centre. The sheet does not repair and does not drain; what it does is charge for the crossing, both ways, at a rate the Bone Lantern Cult has priced every cycle for two centuries and declined every cycle.',
            whoTheyGoFor: 'Whoever the crosser has already decided to leave things to, because the Cult\'s arithmetic is right and nobody makes this crossing for their own benefit.',
            whatComesBackForThatPerson: 'Three objects, two of them warranted copies of arts nobody in the world holds a warranted copy of and nobody ever will again, because the only way to issue that warranty is to carry the thing to a boundary and lose.'
        },
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
    },

    // ── the shallowest sort, and the sort under a battle ──────────────
    //
    // Two entries that exist because the catalog had nothing at either
    // end of the range. A border post is the sort of ruin that gets found
    // first and is worth least, which is what the shallow end of a
    // reserve actually looks like; a field where two houses stopped each
    // other is the sort nobody built and nobody left, and it has an
    // ordinary minimum with a hard number on it.
    {
        id: 'grave-the-post-at-the-upper-ford',
        kind: 'grave',
        name: 'The Chalked Board',
        character: 'waystation',
        origin: 'overrun_at_work',
        scale: 'a_building',
        intent: 'never_addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 0,
            whatIsDownThere: 'A two-room post with a stove in it, a duty board on the wall and a man on the floor of the back room who was on his own watch when whatever happened happened. Nothing here was ever dangerous to anybody.',
            whatItDoesToSomebodyShortOfIt: 'Nothing. This is the shallowest sort of site there is and it is the sort that gets found first, worked in an afternoon and written up as disappointing, which it is, and which is exactly what the easy end of the ground looks like.'
        },
        factionIds: ['house-measured-span'],
        occupantOrdinal: 4,
        yearsDead: 210,
        mannerOfDeath: 'killed_in_a_fight',
        burial: 'left_where_they_fell',
        outside: {
            marker: 'A two-room stone post above a ford, roof half on, with a stove in the front room and a duty board still nailed to the wall beside the door. The board has a week of watches chalked on it and the chalk is still legible under the overhang where the rain has never reached.',
            rumour: 'The ford villages know there is a body in the back room and have known for as long as anybody has been alive. Nobody has moved him and nobody has taken the stove, which is a good stove, on the general principle that you do not take things out of a room with a man in it.',
            attributedTo: 'The relay house that kept the crossing before the present one did',
            lastPartySaid: 'A carter looked in about thirty years ago to get out of the weather, saw the back room, and went and stood in the rain instead.',
            whatAKnowledgeablePartyReads: 'A duty board with a week chalked on it and a man in the back room is a post that was overrun between one watch and the next, and a post that was overrun is a post whose day book was never squared off. The chalk on the board names four people, three of whom are not in the relay house\'s roll for that year, and that is the whole of what this site is worth.',
            whatAnIgnorantPartyConcludes: 'That it is a shack with a corpse in it, which is precisely what it is. Every party that has looked at this post has correctly valued the stove, correctly valued the body, and gone away, and the valuation is right by every measure except the one nobody applies to a border post.',
            startingAwareness: 'named',
            advertisedOrdinal: null
        },
        interior: {
            scene: 'Two rooms. The front one has the stove, a table, and the duty board by the door with a week of watches on it in three different hands. The back room has a bed frame, a chest with the lid up, and a man on the floor between them who was reaching for something on the far side of the chest and did not get there. What he was reaching for is still on the far side of the chest and is the only thing in the post that was not standard issue.',
            arrangedForAFinder: false,
            gates: [],
            gateOrigin: 'none',
            contents: [
                {
                    what: 'The duty board off the wall, with a week of watches on it in three hands, naming four people of whom three are not in the relay house\'s roll for that year.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A standard-issue post sabre, notched, of the pattern the relay houses issued for two centuries and stopped issuing when the pattern was found to bend.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A stove of the good sort, cast rather than built, which is worth more than everything else in the post together and is the thing every visitor has priced.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A chest of ordinary post kit: blankets, a spare coat, a tally of what came over the ford, and four months of a wage nobody collected.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'The thing on the far side of the chest that he was reaching for, which is a courier\'s seal from a house that had no business being on that road, unbroken.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'Nothing at all, which is the whole profile for a death that is not a tribulation: he was killed on his own floor by somebody who took nothing, so the post is a complete inventory of what a border post held on an ordinary week, untested by anything and worth about what it looks like. The one item that matters is the one he died reaching for, and it is worth what it is worth because of where it was rather than what it is.',
            afterwards: 'Somebody takes the stove, eventually, and the post becomes two rooms with a bed frame in them. Nothing regenerates and nothing was ever going to; this is a site that is used up in an afternoon and stays used up, and a world that only had sites like this one would have run out of them centuries ago.'
        }
    },
    {
        id: 'grave-the-field-where-both-of-them-stopped',
        kind: 'grave',
        name: 'The Slow Field',
        character: 'battlefield',
        origin: 'fought_over_and_left',
        scale: 'a_mountain',
        intent: 'never_addressed',
        access: {
            admits: 'anyone_who_survives_it',
            floorOrdinal: 21,
            whatIsDownThere: 'About a mile of ground that two houses spent a day on, with what they were carrying still in it and the formation both of them were standing inside still holding at the setting it was left at.',
            whatItDoesToSomebodyShortOfIt: 'The array is still up and it is still doing to anything inside it what it was doing to them, which was designed to hold a Nascent Soul cultivator in place long enough to be reached. Below that it does not hold, it stops: nine of the eleven bodies added to the field since the battle are people who walked in under it.'
        },
        factionIds: ['house-anchorhold', 'house-girdle-of-nine-stones'],
        occupantOrdinal: 23,
        yearsDead: 340,
        mannerOfDeath: 'duel',
        burial: 'left_where_they_fell',
        outside: {
            marker: 'A mile of open field with the crop line going round it rather than through it, and a scatter of low mounds across the middle that nobody has raised and nobody has levelled. Standing at the edge, the air over the field is very slightly slower than the air at the edge, and it has been for three hundred years.',
            rumour: 'The farms either side both say the field is bad ground and both give a different reason. One says a battle, which is right. The other says the ploughing turns things up, which is also right and is the more useful of the two.',
            attributedTo: 'Two houses that ended a boundary argument on it and each other with it',
            lastPartySaid: 'A salvage party of six went in eleven years ago at Foundation and Core Formation. Two came back to the edge. Their account is that the field got heavier as they went and that they could not turn round.',
            whatAKnowledgeablePartyReads: 'That air moving slower over a field than beside it is an array holding rather than weather, and that an array which has held for three hundred and forty years is an array both sides were standing inside when it stopped mattering to either of them. The mounds are where the holding worked. The crop line going round is four generations of farmers agreeing about something without ever writing it down.',
            whatAnIgnorantPartyConcludes: 'That an old battlefield with the finds still in it is the easiest money in the province, which it would be, and that three hundred years of nobody clearing it means three hundred years of nobody bothering. Eleven parties have gone in on that reasoning and nine of them are among the mounds now, which the farms either side both know and neither mentions.',
            startingAwareness: 'named',
            advertisedOrdinal: 21
        },
        interior: {
            scene: 'A mile of field with the grass grown normally over everything and the ground under it holding what two houses were carrying on the day. There are no chambers, no doors and nothing arranged: the array is a lattice laid across the whole of it by one side and answered across the whole of it by the other, and the two of them have been holding against each other since before anybody now farming here was born. Walking into it is walking into a room with no walls and a ceiling that comes down.',
            arrangedForAFinder: false,
            gates: [
                {
                    kind: 'strength',
                    ordinal: 21,
                    test: 'The lattice reads a body crossing it and closes on it at the weight it was set to hold a Nascent Soul opponent at, which is what both houses were fielding and is therefore what both of them calibrated against. It does not escalate and it does not choose; it applies the same holding to a farmer, to a salvage crew and to a Deity Transformation cultivator, and only the third of those can walk out of it.',
                    below: 'Below Nascent Soul the holding is not a hindrance, it is the end of the trip. The party gets progressively further in because the lattice is denser toward the middle, discovers at about the halfway point that turning round is a separate problem from walking, and joins the mounds. Nine of the eleven post-battle bodies in the field arrived exactly this way.',
                    noWorkaround: 'There is nothing to disarm. The two arrays are answering each other rather than answering the ground, so cutting either one releases the other at full strength across the whole mile, and the one recorded attempt to do that is why there is a strip along the eastern edge where the crop still will not take.'
                }
            ],
            gateOrigin: 'accreted',
            contents: [
                {
                    what: 'The field-weight equipment of two houses, scattered across a mile: blades, braces, carried nodes and the harness a formation crew wears, in the ground where it fell.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'The Girdle\'s lattice, entire, still running, which is the only complete example of that house\'s field work standing anywhere and is readable by anybody who can stand inside it long enough to read.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'The Anchorhold\'s answer to it, laid across the same ground on the same day by people who were reading it live, which is a document about what the Anchorhold understood of the Girdle at the moment the two of them stopped talking.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Two sets of house marks on the same field, which settles a boundary question both surviving houses still argue about and settles it against the account both of them give.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'Eleven later bodies among the mounds, with eleven parties\' worth of equipment on them, which is a running record of who has tried this field and what they thought they needed.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                },
                {
                    what: 'A carried node of the Girdle pattern, cracked but not spent, lying about two hundred paces in from the western edge where somebody dropped it running.',
                    proven: false,
                    survived: null,
                    techniqueId: null,
                    immortalItemId: null
                }
            ],
            whatTheDeathDidToTheContents: 'Nothing removed anything. Two houses stopped each other in a field and neither of them was in a condition afterwards to come back and collect, so everything either side carried onto that ground is still on it, untested by anything except three hundred and forty winters. It is a long inventory of good equipment and not one item of it has a warranty on it, which is the ordinary case and is why a party that reads the field as loot is reading it correctly and pricing it wrongly.',
            afterwards: 'The lattice keeps holding, because nothing that has happened since has been the sort of thing that stops an array both halves of which are being maintained by each other. A party that takes equipment out has taken equipment out; the field is the same field the next morning and will hold the next party at the same weight. This site does not empty and does not need to be found twice.'
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
