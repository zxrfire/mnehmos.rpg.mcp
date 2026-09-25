/**
 * The room settles a complaint, and the sentence happens to somebody.
 *
 * `complaintsBroughtTo` reads what a house holds about its own and
 * `settleAComplaint` marks one upheld or dismissed, and nothing followed from
 * upholding it: the row closed and the person it was about paid nothing. This is
 * the half that costs them something.
 *
 * `whatTheRoomDecides` does the deciding and this file does not repeat a word of
 * it. What is here is the carrying out, and every sentence is routed to the
 * instrument `WHO_CARRIES_IT_OUT` already names rather than to a second one
 * written here.
 *
 * ── A FINE IS THE WORK IT WOULD TAKE TO MAKE IT GOOD ─────────────────────
 *
 * Priced off `duties.ts` and not invented here: `CONTRIBUTION_BASE +
 * ordinal * CONTRIBUTION_PER_ORDINAL` is what this house pays for one errand at
 * this person's rung, and the fine is that many errands, one per band of
 * severity. So a fine at the bottom of the ladder and a fine at the top are the
 * same number of mornings, which is what makes it read as a sanction rather than
 * as a number that stops mattering at Core Formation.
 *
 * Stones move at the rate the same module already converts at. Both fall to what
 * the person actually has - `addContribution` floors at zero and `applyDeltas`
 * floors stones at zero - so a fine larger than somebody's whole standing takes
 * everything and does not go negative, and what was not paid is reported rather
 * than carried as a debt the ledger has no row for.
 *
 * ── AND THE HEAVY ONES TAKE WHAT THE STORE ACTUALLY HOLDS ────────────────
 *
 * The same floor, one tier up. A recall moves a world object row, a seal goes on
 * the person, a crippling writes an injury, and a death ends them and hands what
 * they had to the house. Where the store holds nothing to act on - no world is
 * running, the house has nothing out with them, nothing holds a record of them,
 * they stand at the bottom realm and have built no structure to break - NOTHING
 * IS WRITTEN and the report says which of those it was. A sentence reported as
 * carried out that moved no state is the defect this whole file exists to close,
 * and it does not get to reappear in the heavy half.
 *
 * ── AND "A RECORD" MEANS EITHER OF THE TWO ───────────────────────────────
 *
 * A person exists in `cultivators` and in `WorldState`, and for a long time only
 * the death branch knew it. The seal and the crippling both asked
 * `cultivators.getById` and refused anybody it did not answer for - so a house
 * could seal or cripple only somebody a run was being played through, which the
 * room never sentences, and every real offender was told there was no record to
 * carry it. Both now write whichever store holds them, and both where both do.
 * `NpcRecord.cultivation.seal` is the world's half of the first and
 * `carryingWounds` the world's half of the second.
 *
 * ── AND SOMEBODY GOES AND DOES IT ────────────────────────────────────────
 *
 * The object changed hands with no hand in it. `whoIsSentToCarryItOut` names the
 * party off the punishment hall's own holder and staff, and the party arrives
 * where the person is.
 *
 * FOUR SENTENCES HAVE SOMEBODY SENT, AND THE OTHER TWO ARGUE FOR THEMSELVES.
 * The seizure was the only one for a while, and the seal, the crippling and the
 * death moved state with nobody there - the same defect, one branch over. All
 * four now go through the one function. The fine and the rebuke do not, and that
 * is not an omission: a fine is contribution and stones moving in the house's
 * own books and a rebuke is a row in its ledger, and neither needs the person to
 * be anywhere for it to happen. Everything carried out on a person has somebody
 * standing there; everything carried out in a ledger does not.
 *
 * And a seizure is read out afterwards: `a-house-holds-its-own.ts` has always
 * said that taking back what a house GAVE *"is a seizure, which is a thing
 * houses do and is not a thing they can do quietly"*, and a loan called in is
 * not that act and gets no notice.
 *
 * ── AND IT REACHES THE ONE BEING PLAYED ──────────────────────────────────
 *
 * It could not. The offender was always somebody the world holds a row for and
 * where it happened was that row's place - and the played cultivator's row holds
 * `locationId: null` for as long as they are played, because presence belongs to
 * the play layer. A party had nowhere to come to and a notice had nowhere to be
 * read out.
 *
 * `offenderAt` is that field. Passing it means the caller owns where the person
 * stands: nothing here moves a row it was told about, and `heldAt` names the
 * room a seal puts somebody in so the caller can put them there.
 * `a-room-hands-one-down-to-you.ts` is that caller.
 *
 * ── AND THE HEAVY ONES ARE READ OUT ──────────────────────────────────────
 *
 * The seizure was announced and nothing else was, so a house could seal, cripple
 * or end one of its own and the world held only the hole.
 * `taking-people-is-not-a-quiet-thing.ts` is built on the gap between the two
 * records: sentences can be read end to end and holes can be counted, and
 * whether those two accounts reconcile is the question somebody playing gets to
 * ask. A house that never reads one out makes it unaskable.
 *
 * So the three that take a person out of the world are read out - the seal, the
 * crippling, the end - and the two that leave nobody missing are not. A fine and
 * a rebuke move money and a record inside one house; reading those to a province
 * is a house reciting its own bookkeeping. The notice carries the name and the
 * sentence and never the cause, which is the shape the seizure already uses.
 */

import {
    CONTRIBUTION_BASE,
    CONTRIBUTION_PER_ORDINAL,
    STONES_PER_ERRAND_OF_CONTRIBUTION
} from '../engine/encounters/duties.js';
import {
    createDebt,
    createObligation,
    settleObligation,
    severityRank,
    type ObligationRecord,
    type Severity
} from '../engine/social/grudges.js';
import {
    whatTheRoomDecides,
    type Sentence,
    type TheSentence,
    type WhatWasBrought
} from '../engine/social-leverage/what-a-room-decides-about-one-of-its-own.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import {
    AGAINST_THEIR_OWN,
    theStructureTheyHave
} from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import {
    takeItBack,
    whatThisHouseHandedOver,
    whatTheFootingMeans,
    type TheFooting
} from '../engine/world/a-house-takes-back-what-it-handed-over.js';
import { whatLayingASealTakes } from '../engine/social/what-laying-a-qi-seal-takes.js';
import {
    carryingWounds,
    isActing,
    markDead,
    sealLaidOn,
    setLocation,
    theSealOn
} from '../engine/world/npc-state.js';
import { createInjury } from '../engine/cultivation/injuries.js';
import { forStream } from '../engine/cultivation/rng.js';
import { maxQiForOrdinal } from '../engine/cultivation/realms.js';
import { recordPermanentWounds } from '../engine/world/recording-the-day-a-wound-was-taken.js';
import { whatAnEndingLeavesToTheHouse } from '../engine/world/a-house-that-ends-one-of-its-own-keeps-what-they-had.js';
import { putIntoTheHouse } from '../engine/world/a-house-holds-its-own.js';
import { purposeOf } from '../engine/world/architecture.js';
import { THE_ROOM_COMPLAINTS_GO_TO } from '../engine/social-leverage/reporting-what-you-saw.js';
import {
    whoIsSentToCarryItOut,
    type SomebodyWasSent
} from '../engine/social-leverage/somebody-is-sent-to-carry-it-out.js';
import type { APortfolio } from '../engine/social-leverage/what-an-elder-is-in-charge-of.js';
import type { APost } from '../engine/social-leverage/who-works-in-an-elders-hall.js';
import { anAnnouncementEntersTheWorld } from '../engine/world/taking-people-is-not-a-quiet-thing.js';
import type { LocationRecord } from '../engine/world/locations.js';
import { getNpc, upsertNpc, upsertObject, type WorldState } from '../engine/world/world-state.js';
import { settleAComplaint } from './false-decree-reports.js';
import type { CultivationRepos } from '../server/consolidated/cultivation-support.js';
import { type DatabaseHandle } from './encounters.js';

/** The tag on the row a rebuke leaves, so a later read can tell one from a complaint. */
export const A_REBUKE_ON_THE_RECORD = 'a_rebuke_on_the_record';
/** The tag on the row a fine leaves. The row is the receipt, not the punishment. */
export const A_FINE_WAS_PAID = 'a_fine_was_paid';
/** The tag on the row a recall leaves. The thing being gone is the punishment. */
export const WHAT_THE_HOUSE_GAVE_IS_BACK = 'what_the_house_gave_is_back';
/** The tag on the row a term in the house's own hands leaves. */
export const SEALED_AND_HELD = 'sealed_and_held';
/** The tag on the row a crippling leaves. */
export const THE_CAPABILITY_WAS_TAKEN = 'the_capability_was_taken';
/** The tag on the row an execution leaves. */
export const THE_HOUSE_ENDED_THEM = 'the_house_ended_them';

/** What the house took back, where it took something. */
export interface WhatWentBack {
    objectId: string;
    name: string;
    footing: TheFooting;
}

/** What an execution left in the house's hands. */
export interface WhatTheHouseKept {
    /** Ids of the rows that moved. The rows themselves are in the world. */
    objectIds: string[];
    /** Their names, for a report that does not have to go back to the world. */
    names: string[];
    /** Stones taken off the person's own row and put into the house's purse. */
    stones: number;
}

export interface WhatWasHandedDown {
    decided: TheSentence;
    /** The complaint, settled. Null where the room decided there was no case. */
    settled: ObligationRecord | null;
    /** The row the sentence itself left, where it leaves one. */
    wrote: ObligationRecord | null;
    /** Contribution actually taken. Zero where the sentence was not a fine. */
    contributionTaken: number;
    /** Stones actually taken. Zero where the sentence was not a fine. */
    stonesTaken: number;
    /** The thing that went back to the house, where one did. */
    tookBack: WhatWentBack | null;
    /** The day the seal lifts, where one went on. Null for a seal with no end. */
    sealedUntilDay: number | null;
    /** True where a seal went on at all, which `sealedUntilDay` being null cannot say. */
    sealed: boolean;
    /** The authored wound a crippling left, as a key into `wounds.ts`. */
    woundKey: string | null;
    /** True where the person's records were ended. */
    ended: boolean;
    /**
     * What the house took off them for good, where it ended one of its own.
     *
     * Empty for every other sentence, and for an execution that found them
     * holding nothing - which is the commoner answer, because most people are.
     */
    keptByTheHouse: WhatTheHouseKept | null;
    /**
     * Who the house sent. Null only for the sentences nobody is sent for - a
     * house with nobody to send answers here rather than by being absent.
     */
    whoWent: SomebodyWasSent | null;
    /** Where they found them. Null where the world holds no place for them. */
    wherePlace: string | null;
    /**
     * The room a seal puts them in, for a caller who owns where they stand.
     *
     * Named rather than moved when `offenderAt` was passed: presence is the play
     * layer's for the one being played, and a second write of it here is the
     * second copy of a fact that AGENTS.md is about.
     */
    heldAt: { id: string; name: string } | null;
    /** True where the house read the sentence out. A seizure is not done quietly. */
    readOut: boolean;
    /** True where a world row moved, so the caller owes a world commit. */
    theWorldMoved: boolean;
    /**
     * Set where the sentence is one this file did not carry out, naming the
     * module that would or the state that was missing. Never a silent success.
     */
    notCarriedOutHere: string | null;
    line: string;
}

export interface HandDownInput {
    repos: CultivationRepos;
    complaint: ObligationRecord;
    /** Who is settling it - the holder of the room, or the head. */
    byId: string;
    /** Their name, for the actor on the notice the house gives. */
    byName?: string;
    /**
     * The house's rooms and who holds them, and who is posted to each. Both are
     * derived reads (`whoIsInChargeOfWhat`, `whoStaffsWhat`) and are passed
     * rather than rebuilt here. Omitted means the house has nobody to send, and
     * the report says so rather than the thing moving by itself.
     */
    portfolios?: readonly APortfolio[];
    posts?: readonly APost[];
    offenderId: string;
    offenderName: string;
    offenderOrdinal: number;
    houseId: string;
    houseName: string;
    onDay: number;
    /** Everything the room reads, minus the severity, which comes off the row. */
    brought: Omit<WhatWasBrought, 'severity'>;
    /**
     * The world, where one is running. Null is a real answer - a run with world
     * simulation off has no object rows and nobody to move - and the sentences
     * that need one report that rather than pretending.
     */
    world?: WorldState | null;
    /**
     * The rung of whoever hands it down, for what a seal of that gap will hold.
     * Omitted means the seal cannot be priced and is reported, not guessed.
     */
    byOrdinal?: number;
    /** The run's turn, for the two records that are kept in turns. */
    onTurn?: number;
    /**
     * Where the offender is standing, for an offender whose world row stands
     * nowhere. See the banner: the played cultivator's row is `locationId: null`
     * by design, so a party has nowhere to come to unless the caller says.
     *
     * Passing it hands presence back to the caller. Nothing here moves a row it
     * was told about, and `heldAt` names where a seal would put them instead.
     */
    offenderAt?: { id?: string | null; name?: string | null };
}

/**
 * What a fine comes to, at this rung and this band.
 *
 * Exported so a refusal can say the figure before it is taken: a player told
 * what a fine would be and then fined is being told twice by one function, and
 * two functions is how the two answers start to differ.
 */
export function whatAFineComesTo(ordinal: number, severity: Severity): { contribution: number; stones: number } {
    const perErrand = CONTRIBUTION_BASE + Math.max(0, ordinal) * CONTRIBUTION_PER_ORDINAL;
    const errands = severityRank(severity) + 1;
    return {
        contribution: Math.max(1, Math.round(perErrand * errands)),
        stones: Math.max(1, Math.round(perErrand * STONES_PER_ERRAND_OF_CONTRIBUTION * errands))
    };
}

/**
 * The room this house hears complaints in, where the world has built one.
 *
 * Two branches want it - the seal puts somebody in it, the notice is read out
 * from it - and a second `find` with the same two predicates is how the two
 * would come to disagree about which room that is.
 */
function theRoomThisHouseHearsIn(world: WorldState, houseId: string): LocationRecord | null {
    return world.locations.find(place =>
        place.data?.factionId === houseId
        && purposeOf(place) === THE_ROOM_COMPLAINTS_GO_TO) ?? null;
}

/** Nothing moved on any of the axes. Each branch overrides what it actually did. */
const NOTHING_MOVED = {
    contributionTaken: 0,
    stonesTaken: 0,
    tookBack: null,
    sealedUntilDay: null,
    sealed: false,
    woundKey: null,
    ended: false,
    keptByTheHouse: null,
    whoWent: null,
    wherePlace: null,
    heldAt: null,
    readOut: false,
    theWorldMoved: false,
    notCarriedOutHere: null
} as const;

/**
 * Weigh it, settle the complaint, and do what was decided.
 *
 * The complaint is settled in both directions: upheld where a sentence followed,
 * `proven_false` where the room found no case. A complaint left open after the
 * room has read it is the officeless-elder problem again - standing with nothing
 * attached - and it is the state this whole arc exists to leave behind.
 */
export function handDownWhatTheRoomDecided(input: HandDownInput): WhatWasHandedDown {
    const decided = whatTheRoomDecides({ ...input.brought, severity: input.complaint.severity });
    const db = input.repos.db as unknown as DatabaseHandle;

    if (decided.sentence === 'no case') {
        const settled = settleAComplaint(input.repos, input.complaint, {
            verdict: 'dismissed',
            byId: input.byId,
            onDay: input.onDay,
            note: decided.line
        });
        return { ...NOTHING_MOVED, decided, settled, wrote: null, line: decided.line };
    }

    const settled = settleAComplaint(input.repos, input.complaint, {
        verdict: 'upheld',
        byId: input.byId,
        onDay: input.onDay,
        note: decided.line
    });

    /** The receipt every carried-out sentence leaves, minted the one way. */
    const receipt = (tag: string, description: string, terms: string | null = null) =>
        createObligation({
            kind: 'grudge',
            holderId: input.houseId,
            subjectId: input.offenderId,
            cause: input.complaint.cause,
            severity: input.complaint.severity,
            onDay: input.onDay,
            description,
            participants: [input.houseId, input.byId],
            tags: [AGAINST_THEIR_OWN, tag],
            triggeringEventId: input.complaint.triggeringEventId ?? null,
            terms
        });

    /** Carried out on the day, so the row is a receipt rather than an account. */
    const discharged = (row: ObligationRecord) => settleObligation(row, {
        resolution: 'compensated',
        onDay: input.onDay,
        byId: input.byId,
        note: 'Carried out on the day it was handed down.'
    });

    const routed = (why: string, said: string): WhatWasHandedDown => ({
        ...NOTHING_MOVED,
        decided, settled, wrote: null,
        notCarriedOutHere: why,
        line: `${decided.line} ${said}`
    });

    /**
     * Where the offender is standing.
     *
     * The world row first, and what the caller said where the row stands
     * nowhere. Both branches that need a place read this one, so a sentence
     * handed to the played cultivator and a sentence handed to anybody else
     * arrive at the same answer by the same route.
     */
    const whereTheyStand = (world: WorldState | null): {
        id: string | null; name: string | null; theWorldKnows: boolean;
    } => {
        const them = world === null ? null : getNpc(world, input.offenderId);
        const theWorldKnows = (them?.locationId ?? null) !== null;
        const id = them?.locationId ?? input.offenderAt?.id ?? null;
        return {
            id,
            theWorldKnows,
            name: (id === null || world === null
                ? null
                : world.locations.find(place => place.id === id)?.name ?? null)
                ?? input.offenderAt?.name ?? null
        };
    };

    /**
     * The house says the name and the sentence, and never why.
     *
     * From the room complaints go to where the house has built one, and from
     * wherever the person is where it has not - a house with no hall still has
     * a mouth.
     */
    const readItOut = (
        world: WorldState,
        sentenceInWords: string,
        at: { id: string | null; name: string | null }
    ): void => {
        const hall = theRoomThisHouseHearsIn(world, input.houseId);
        anAnnouncementEntersTheWorld(world, {
            day: input.onDay,
            names: [input.offenderName],
            readOutBy: {
                id: input.byId,
                name: input.byName ?? input.houseName,
                role: 'read it out'
            },
            summary:
                `${input.houseName} read out what the room decided about `
                + `${input.offenderName}: ${sentenceInWords}`,
            locationId: hall?.id ?? at.id,
            place: hall?.name ?? at.name,
            factionIds: [input.houseId]
        });
    };

    /**
     * The party the house sends, and its arrival where the person is standing.
     *
     * ONE ANSWER TO WHO COMES. The party's own rows are what move, so an
     * arrival is a world row rather than a clause in a report, and the
     * offender's row is never touched here - for the one being played, where
     * they stand is the caller's and `whereTheyStand` has already been told.
     *
     * A house with nobody over the room and nobody in it is reported as having
     * sent nobody, and the sentence still happens. The room decided it; being
     * short of hands is a fact about the house rather than a veto on what its
     * room settled, and it is the same answer the seizure has always given.
     */
    const somebodyGoes = (
        world: WorldState | null,
        sentence: Sentence,
        at: { id: string | null; name: string | null }
    ): SomebodyWasSent => {
        const sent = whoIsSentToCarryItOut({
            severity: input.complaint.severity,
            sentence,
            portfolios: input.portfolios ?? [],
            posts: input.posts ?? []
        });
        if (world === null || at.id === null) return sent;
        for (const id of sent.partyIds) {
            const goer = getNpc(world, id);
            if (goer === null || goer.locationId === at.id) continue;
            Object.assign(world, upsertNpc(world, setLocation(goer, at.id, input.onDay)));
        }
        return sent;
    };

    /** That they arrived, for the mechanical line. Empty where nobody did. */
    const theyCameLine = (
        sent: SomebodyWasSent,
        at: { id: string | null; name: string | null }
    ): string =>
        sent.partyIds.length > 0 && at.id !== null && at.name !== null
            ? ` They come to ${input.offenderName} at ${at.name}.`
            : '';

    // ── A REBUKE IS A ROW AND NOTHING ELSE ───────────────────────────────
    //
    // Which is not nothing: it is held by the house about the person, it is
    // open, and everything that reads what a house holds about its own will
    // find it - `whatTheyFeelAboutYou`, the next complaint's
    // `whatStandsBetween`, and any room that later asks what this person has
    // already been brought up for.
    if (decided.sentence === 'a rebuke') {
        const wrote = receipt(
            A_REBUKE_ON_THE_RECORD,
            `${input.houseName} rebuked ${input.offenderName} for it and took nothing else. `
            + 'The record is the sanction.'
        );
        writeOneObligation(db, wrote);
        return {
            ...NOTHING_MOVED, decided, settled, wrote,
            line: `${decided.line} ${input.offenderName} is rebuked, and it is on the record.`
        };
    }

    // ── A FINE MOVES WHAT THE HOUSE PAYS WORK IN ─────────────────────────
    if (decided.sentence === 'a fine') {
        const asked = whatAFineComesTo(input.offenderOrdinal, input.complaint.severity);

        const before = input.repos.sects.getMembership(input.offenderId);
        const had = before?.contribution ?? 0;
        input.repos.sects.addContribution(input.houseId, input.offenderId, -asked.contribution);
        const after = input.repos.sects.getMembership(input.offenderId);
        const contributionTaken = Math.max(0, had - (after?.contribution ?? 0));

        const hadStones = input.repos.cultivators.getById(input.offenderId)?.spiritStones ?? 0;
        input.repos.cultivators.applyDeltas(input.offenderId, { spiritStones: -asked.stones });
        const stonesLeft = input.repos.cultivators.getById(input.offenderId)?.spiritStones ?? 0;
        const stonesTaken = Math.max(0, hadStones - stonesLeft);

        const short = (asked.contribution - contributionTaken) + (asked.stones - stonesTaken);
        const row = createDebt({
            // The person owes it, so they hold it and the house is the subject -
            // `whichWayItPoints` reads a debt that way and this is not the place
            // to disagree with it.
            holderId: input.offenderId,
            subjectId: input.houseId,
            cause: 'other',
            severity: input.complaint.severity,
            onDay: input.onDay,
            description:
                `${input.houseName} fined ${input.offenderName} `
                + `${asked.contribution} contribution and ${asked.stones} stones. `
                + (short > 0
                    ? `They had ${contributionTaken} and ${stonesTaken} of it.`
                    : 'Paid in full.'),
            participants: [input.houseId, input.byId],
            tags: [AGAINST_THEIR_OWN, A_FINE_WAS_PAID],
            triggeringEventId: input.complaint.triggeringEventId ?? null,
            terms: short > 0
                ? 'What was not paid is what they did not have. The house is not owed the '
                  + 'remainder: a fine takes what is there.'
                : null
        });
        // A fine paid is a receipt, not an account. Left open it would read as
        // an unpaid debt to every reader of the ledger, which is the opposite
        // of what happened.
        const wrote = short > 0 ? row : settleObligation(row, {
            resolution: 'repaid',
            onDay: input.onDay,
            byId: input.byId,
            note: 'Taken on the day it was handed down.'
        });
        writeOneObligation(db, wrote);

        return {
            ...NOTHING_MOVED, decided, settled, wrote, contributionTaken, stonesTaken,
            line: `${decided.line} ${input.offenderName} pays ${contributionTaken} contribution `
                + `and ${stonesTaken} stones`
                + (short > 0 ? ', which is everything they had and less than was asked.' : '.')
        };
    }

    // ── WHAT THE HOUSE HANDED OVER COMES BACK ────────────────────────────
    //
    // The loan first and the bestowal only after: `whatThisHouseHandedOver`
    // orders them and says why. Nothing the house never handed over is
    // reachable from here at any severity.
    if (decided.sentence === 'what the house gave is taken back') {
        const world = input.world ?? null;
        if (world === null) {
            return routed(
                decided.carriedOutBy,
                'No world is running, so there is no object row to move and nothing is taken.'
            );
        }
        const handed = whatThisHouseHandedOver({
            objects: world.objects,
            houseId: input.houseId,
            houseName: input.houseName,
            fromId: input.offenderId,
            houseIds: new Set(world.factions.map(house => house.id))
        });
        const take = handed[0];
        if (take === undefined) {
            return routed(
                decided.carriedOutBy,
                `${input.offenderName} is holding nothing ${input.houseName} handed over, `
                + 'and nothing is taken.'
            );
        }

        // ── SOMEBODY GOES AND TAKES IT ───────────────────────────────────
        //
        // They travel to the person rather than the thing arriving: a sentence
        // carried out on somebody who is somewhere else is the silent state
        // change this leg closes.
        const at = whereTheyStand(world);
        const sent = somebodyGoes(world, decided.sentence, at);

        const note = `Taken back by ${input.houseName} on the room's word. `
            + whatTheFootingMeans(take.footing);
        Object.assign(world, upsertObject(world, takeItBack(take, {
            houseId: input.houseId,
            houseName: input.houseName,
            onDay: input.onDay,
            note
        })));

        // A seizure is read out and a loan called in is not. The house spent the
        // thing and is taking it back anyway, and that act is the one
        // `a-house-holds-its-own.ts` says cannot be done quietly; a loan ending
        // moved no register and is nobody else's business.
        const readOut = take.footing === 'seized';
        if (readOut) {
            readItOut(
                world,
                `${take.object.name}, which the house gave them, is taken back.`,
                at
            );
        }

        const wrote = discharged(receipt(
            WHAT_THE_HOUSE_GAVE_IS_BACK,
            `${input.houseName} took ${take.object.name} back off ${input.offenderName}. ${note} `
            + sent.line,
            whatTheFootingMeans(take.footing)
        ));
        writeOneObligation(db, wrote);

        return {
            ...NOTHING_MOVED, decided, settled, wrote,
            tookBack: {
                objectId: take.object.id, name: take.object.name, footing: take.footing
            },
            whoWent: sent,
            wherePlace: at.name,
            readOut,
            theWorldMoved: true,
            line: `${decided.line} ${sent.line}`
                + theyCameLine(sent, at)
                + ` ${take.object.name} goes back to ${input.houseName}. `
                + whatTheFootingMeans(take.footing)
                + (readOut
                    ? ` ${input.houseName} reads the sentence out. The name and the sentence `
                      + 'are said; what they did is not.'
                    : '')
        };
    }

    // ── A TERM IN THE HOUSE'S OWN HANDS ──────────────────────────────────
    //
    // The seal is the sentence and the hall is where they are put, and neither
    // does the other's job - which is `a-qi-seal-is-put-on-a-person.ts`'s own
    // ruling, applied rather than restated. Nothing here decides how long: the
    // term asked for is null, so `howLongASealOfThisGapHolds` answers off the
    // gap between the two of them, which is the one table there is.
    if (decided.sentence === 'years sealed and held') {
        if (input.byOrdinal === undefined) {
            return routed(
                decided.carriedOutBy,
                'Nobody\'s rung was given for whoever hands it down, so what a seal would hold '
                + 'cannot be read, and none goes on.'
            );
        }
        // WHICHEVER STORE HOLDS THEM, which is what the death branch below has
        // always done and this one did not. Sealing needed a `cultivators` row,
        // so a house could seal only somebody a run was being played through -
        // and the room sentences its own members, who are almost never that.
        // Everybody else was refused here and told, honestly and wrongly, that
        // there was no record to carry it.
        const world = input.world ?? null;
        const them = input.repos.cultivators.getById(input.offenderId);
        const npc = world === null ? null : getNpc(world, input.offenderId);
        const standing = (them !== null && them.alive) || (npc !== null && isActing(npc.status));
        if (!standing) {
            return routed(
                decided.carriedOutBy,
                `There is no record for ${input.offenderName} to carry a seal, and none goes on.`
            );
        }

        const laid = whatLayingASealTakes({
            sealerOrdinal: input.byOrdinal,
            sealerId: input.byId,
            subjectOrdinal: input.offenderOrdinal,
            subjectIsThere: standing,
            subjectAlreadySealed:
                (them?.qiSeal ?? null) !== null
                || (npc !== null && theSealOn(npc, input.onDay) !== null),
            onDay: input.onDay,
            // The ceiling, off whichever record is there. The world stores no
            // pool - `maxQiForOrdinal` derives it the way `maxBodyOf` derives
            // the body - so this is that derivation and never a second figure
            // kept beside the rung.
            subjectMaxQi: them?.maxQi ?? maxQiForOrdinal(
                npc!.cultivation.attributes.insight,
                npc!.cultivation.realmOrdinal
            ),
            forDays: null,
            note: `Held by ${input.houseName}. ${input.complaint.description}`
        });
        if (!laid.went) {
            return routed(decided.carriedOutBy, laid.line);
        }

        if (them !== null && them.alive) {
            input.repos.cultivators.update(input.offenderId, {
                qiSeal: laid.seal,
                // The lid goes on at once. A seal that let the surplus leak away
                // over months would be asking them to stop rather than stopping
                // them, which is the distinction `whatLayingASealTakes` draws.
                qi: Math.min(them.qi, laid.poolCutTo ?? them.qi)
            });
        }

        // ── AND SOMEBODY COMES FOR THEM ──────────────────────────────────
        //
        // Read where they are standing BEFORE the hall takes them, because the
        // party comes to the person and the person is put in the hall after,
        // and reading it the other way round has them arriving at the cell.
        const at = whereTheyStand(world);
        const sent = somebodyGoes(world, decided.sentence, at);

        const hall = world === null ? null : theRoomThisHouseHearsIn(world, input.houseId);
        // The seal and the hall in ONE write. A second `upsertNpc` would be
        // built off a record read before the first and would put the unsealed
        // row straight back.
        //
        // And the move is skipped where the caller owns where they stand. A seal
        // is the sentence and the hall is where they are put, and for the one
        // being played the second half is the play layer's - `heldAt` hands it
        // back rather than this writing a place onto a row that holds none.
        const sealWentOn = world !== null && npc !== null && isActing(npc.status);
        const theirsToMove = input.offenderAt === undefined;
        if (world !== null && npc !== null && sealWentOn) {
            const held = sealLaidOn(npc, laid.seal!, input.onDay);
            Object.assign(world, upsertNpc(
                world,
                hall && theirsToMove ? setLocation(held, hall.id, input.onDay) : held
            ));
        }
        if (world !== null) {
            readItOut(world, `they are sealed and held by ${input.houseName}.`, at);
        }

        const wrote = discharged(receipt(
            SEALED_AND_HELD,
            `${input.houseName} sealed ${input.offenderName} and holds them. ${laid.line} `
            + sent.line,
            laid.seal?.liftsOnDay === null
                ? 'No day was put on it. Nothing lifts it but the hand that laid it.'
                : null
        ));
        writeOneObligation(db, wrote);

        return {
            ...NOTHING_MOVED, decided, settled, wrote,
            sealed: true,
            sealedUntilDay: laid.seal?.liftsOnDay ?? null,
            heldAt: hall === null ? null : { id: hall.id, name: hall.name },
            whoWent: sent,
            wherePlace: at.name,
            readOut: world !== null,
            theWorldMoved: world !== null,
            line: `${decided.line} ${sent.line}`
                + theyCameLine(sent, at)
                + ` ${input.offenderName} is sealed`
                + (hall === null ? ' and held. ' : ` and put in ${hall.name}. `)
                + laid.line
        };
    }

    // ── WHAT THEY CLIMBED, TAKEN OFF THEM ────────────────────────────────
    //
    // `theStructureTheyHave` is the whole of the decision and it is somebody
    // else's: it names the authored wound for the realm below theirs, and
    // returns null at the bottom of the ladder, where there is nothing built to
    // break. The severity is the table's own and nothing here picks one.
    if (decided.sentence === 'the capability taken') {
        const woundKey = theStructureTheyHave(input.offenderOrdinal);
        if (woundKey === null) {
            return routed(
                decided.carriedOutBy,
                `${input.offenderName} has built nothing there is a way to take, and nothing `
                + 'is taken.'
            );
        }
        // THE SAME TWO STORES. This wrote only the `cultivators` table, so a
        // house could cripple only somebody a run was being played through, and
        // the world's own people walked out of the room whole - which is the
        // half of the sentence anybody else would ever have seen.
        const world = input.world ?? null;
        const them = input.repos.cultivators.getById(input.offenderId);
        const npc = world === null ? null : getNpc(world, input.offenderId);
        if ((them === null || !them.alive) && (npc === null || !isActing(npc.status))) {
            return routed(
                decided.carriedOutBy,
                `There is no living record for ${input.offenderName} to carry the wound, and `
                + 'nothing is taken.'
            );
        }

        // Somebody comes and does it, the same way and off the same two rooms
        // the seizure reads. Nothing about this one is carried out at a
        // distance.
        const at = whereTheyStand(world);
        const sent = somebodyGoes(world, decided.sentence, at);

        const said =
            `What ${input.offenderName} climbed was taken off them by ${input.houseName}, `
            + 'on the room\'s word, and it does not come back.';
        if (them !== null && them.alive) {
            input.repos.cultivators.addInjury(input.offenderId, {
                severity: 'crippling',
                source: 'other',
                description: said,
                sustainedOnTurn: Math.max(0, Math.round(input.onTurn ?? 0)),
                woundType: woundKey
            });
        }
        let theWorldMoved = false;
        if (world !== null && npc !== null && isActing(npc.status)) {
            // Minted through the call every other wound in the game is minted
            // through, so the penalties are the table's rather than this file's,
            // and laid on through `carryingWounds`, which is the world's one
            // write path for an injury and the only thing that keeps the count
            // honest against the list.
            const wound = createInjury(
                {
                    severity: 'crippling',
                    source: 'other',
                    description: said,
                    turn: Math.max(0, Math.round(input.onTurn ?? 0)),
                    woundType: woundKey
                },
                forStream(world.seed, 'a-room-takes-what-was-built', npc.id, input.onDay)
            );
            Object.assign(world, upsertNpc(world, carryingWounds(npc, [wound], input.onDay)));
            const after = getNpc(world, input.offenderId);
            // And its day in the ledger, the way every other permanent wound in
            // this world gets one. The receipt below is what the HOUSE holds;
            // this is what happened to the person.
            if (after) recordPermanentWounds(world, after, [wound], input.onDay);
            theWorldMoved = true;
        }
        if (world !== null) {
            readItOut(world, `what they climbed is taken off them by ${input.houseName}.`, at);
            theWorldMoved = true;
        }

        const wrote = discharged(receipt(
            THE_CAPABILITY_WAS_TAKEN,
            `${input.houseName} took what ${input.offenderName} had built. Wound: ${woundKey}. `
            + sent.line
        ));
        writeOneObligation(db, wrote);

        return {
            ...NOTHING_MOVED, decided, settled, wrote, woundKey, theWorldMoved,
            whoWent: sent,
            wherePlace: at.name,
            readOut: world !== null,
            line: `${decided.line} ${sent.line}`
                + theyCameLine(sent, at)
                + ` What ${input.offenderName} climbed is taken off them, and it `
                + 'does not come back.'
        };
    }

    // ── AND THE END OF IT ────────────────────────────────────────────────
    //
    // The ordinary act, as `WHO_CARRIES_IT_OUT` says: both records a person has
    // are ended through the two functions that already end them, and nothing
    // here is a second way to die. Whichever of the two stores holds them is
    // written; where neither does, nothing is.
    if (decided.sentence === 'death') {
        const them = input.repos.cultivators.getById(input.offenderId);
        const world = input.world ?? null;
        const npc = world === null ? null : getNpc(world, input.offenderId);
        if ((them === null || !them.alive) && (npc === null || npc.status !== 'alive')) {
            return routed(
                decided.carriedOutBy,
                `There is no living record for ${input.offenderName}, and nothing is ended.`
            );
        }

        // Read while they are still standing somewhere. Afterwards the row is a
        // corpse and where it fell is somebody else's subject. The party goes
        // before anything is done to them, for the same reason.
        const at = whereTheyStand(world);
        const sent = somebodyGoes(world, decided.sentence, at);

        const endNote = `${input.houseName} carried out the room's sentence on `
            + `${input.offenderName}.`;
        if (them !== null && them.alive) {
            input.repos.cultivators.markDead(
                input.offenderId,
                'obviously_fatal_choice',
                Math.max(0, Math.round(input.onTurn ?? 0)),
                endNote
            );
        }
        // ── AND WHAT THEY HAD GOES TO THE HOUSE ──────────────────────
        //
        // The design owner: *"the artifacts go to the sect treasury."* Before
        // this the things stayed on the corpse - an executed member's sword sat
        // in the register under their own dead name forever, because the estate
        // path takes a `Cultivator` and reads a pouch, and the person a room
        // sentences is almost always somebody the world holds and no run was
        // ever played through.
        //
        // Read BEFORE `markDead`, because the rows are keyed on the possessor
        // and a corpse is still the possessor until something moves them. What
        // does the moving is `transferPossession` with `confiscated` on the
        // chain, which is the same link `takeItBack` writes for the lighter
        // sentence above.
        let keptByTheHouse: WhatTheHouseKept | null = null;
        if (world !== null && npc !== null && npc.status === 'alive') {
            const kept = whatAnEndingLeavesToTheHouse({
                objects: world.objects,
                stones: npc.spiritStones,
                offenderId: npc.id,
                houseId: input.houseId,
                houseName: input.houseName,
                onDay: input.onDay,
                note: `Taken by ${input.houseName} when it carried out the room's sentence on `
                    + `${input.offenderName}.`
            });
            for (const object of kept.objects) {
                Object.assign(world, upsertObject(world, object));
            }
            const house = world.factions.find(row => row.id === input.houseId) ?? null;
            if (house !== null && kept.stones > 0) {
                // The one purse, through the one function that moves it, so a
                // house that has just executed somebody can pay its people with
                // what it took.
                house.resources.spirit_stones = putIntoTheHouse(
                    Number(house.resources.spirit_stones ?? 0),
                    kept.stones,
                    'indemnity'
                ).after;
            }
            keptByTheHouse = {
                objectIds: kept.objects.map(object => object.id),
                names: kept.objects.map(object => object.name),
                stones: house === null ? 0 : kept.stones
            };
            Object.assign(world, upsertNpc(world, {
                ...markDead(npc, input.onDay, endNote),
                // Emptied only once the stones are somewhere else, which is the
                // rule `estate-settlement.ts` states for the played path: a
                // corpse emptied into nothing is worse than one never emptied.
                spiritStones: house === null ? npc.spiritStones : 0
            }));
        }

        // THE ONE THE RULING NAMES IN SO MANY WORDS: a house announces that
        // somebody has been caught and sentenced to death. The name and the
        // sentence; what they did is not in it.
        if (world !== null) {
            readItOut(world, `they are put to death by ${input.houseName}.`, at);
        }

        const wrote = discharged(receipt(
            THE_HOUSE_ENDED_THEM,
            `${endNote} ${sent.line}`
            + (keptByTheHouse === null || keptByTheHouse.objectIds.length === 0
                ? ''
                : ` ${input.houseName} keeps what they were carrying: `
                  + `${keptByTheHouse.names.join(', ')}.`)
        ));
        writeOneObligation(db, wrote);

        return {
            ...NOTHING_MOVED, decided, settled, wrote,
            ended: true,
            keptByTheHouse,
            whoWent: sent,
            wherePlace: at.name,
            readOut: world !== null,
            theWorldMoved: world !== null,
            line: `${decided.line} ${sent.line}`
                + theyCameLine(sent, at)
                + ` ${endNote}`
                + (keptByTheHouse === null
                    || (keptByTheHouse.objectIds.length === 0 && keptByTheHouse.stones === 0)
                    ? ''
                    : ` What ${input.offenderName} was carrying goes to ${input.houseName}: `
                      + [
                          ...keptByTheHouse.names,
                          ...(keptByTheHouse.stones > 0
                              ? [`${keptByTheHouse.stones} spirit stones`]
                              : [])
                      ].join(', ') + '.')
        };
    }

    // Unreachable while `SENTENCES_IN_ORDER` has seven members and the seven
    // above are them. Left rather than cast away, so a new rung on that ladder
    // arrives here as an honest report instead of falling off the end.
    return routed(decided.carriedOutBy, 'This handler does not reach it yet.');
}
