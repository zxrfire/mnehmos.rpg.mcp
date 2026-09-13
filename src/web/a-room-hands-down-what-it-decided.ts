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
 * The same floor, one tier up. A recall moves a world object row, a seal writes
 * `qiSeal`, a crippling writes an injury and a death ends both records the
 * person has. Where the store holds nothing to act on - no world is running, the
 * house has nothing out with them, there is no cultivator row, they stand at the
 * bottom realm and have built no structure to break - NOTHING IS WRITTEN and the
 * report says which of those it was. A sentence reported as carried out that
 * moved no state is the defect this whole file exists to close, and it does not
 * get to reappear in the heavy half.
 */

import {
    CONTRIBUTION_BASE,
    CONTRIBUTION_PER_ORDINAL,
    STONES_PER_ERRAND_OF_CONTRIBUTION
} from '../engine/encounters/duties.js';
import {
    createObligation,
    settleObligation,
    severityRank,
    type ObligationRecord,
    type Severity
} from '../engine/social/grudges.js';
import {
    whatTheRoomDecides,
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
import { markDead, setLocation } from '../engine/world/npc-state.js';
import { purposeOf } from '../engine/world/architecture.js';
import { THE_ROOM_COMPLAINTS_GO_TO } from '../engine/social-leverage/reporting-what-you-saw.js';
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

/** Nothing moved on any of the axes. Each branch overrides what it actually did. */
const NOTHING_MOVED = {
    contributionTaken: 0,
    stonesTaken: 0,
    tookBack: null,
    sealedUntilDay: null,
    sealed: false,
    woundKey: null,
    ended: false,
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
        const row = createObligation({
            kind: 'debt',
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

        const note = `Taken back by ${input.houseName} on the room's word. `
            + whatTheFootingMeans(take.footing);
        Object.assign(world, upsertObject(world, takeItBack(take, {
            houseId: input.houseId,
            houseName: input.houseName,
            onDay: input.onDay,
            note
        })));

        const wrote = discharged(receipt(
            WHAT_THE_HOUSE_GAVE_IS_BACK,
            `${input.houseName} took ${take.object.name} back off ${input.offenderName}. ${note}`,
            whatTheFootingMeans(take.footing)
        ));
        writeOneObligation(db, wrote);

        return {
            ...NOTHING_MOVED, decided, settled, wrote,
            tookBack: {
                objectId: take.object.id, name: take.object.name, footing: take.footing
            },
            theWorldMoved: true,
            line: `${decided.line} ${take.object.name} goes back to ${input.houseName}. `
                + whatTheFootingMeans(take.footing)
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
        const them = input.repos.cultivators.getById(input.offenderId);
        if (them === null) {
            return routed(
                decided.carriedOutBy,
                `There is no record for ${input.offenderName} to carry a seal, and none goes on.`
            );
        }

        const laid = whatLayingASealTakes({
            sealerOrdinal: input.byOrdinal,
            sealerId: input.byId,
            subjectOrdinal: input.offenderOrdinal,
            subjectIsThere: them.alive,
            subjectAlreadySealed: them.qiSeal !== null,
            onDay: input.onDay,
            subjectMaxQi: them.maxQi,
            forDays: null,
            note: `Held by ${input.houseName}. ${input.complaint.description}`
        });
        if (!laid.went) {
            return routed(decided.carriedOutBy, laid.line);
        }

        input.repos.cultivators.update(input.offenderId, {
            qiSeal: laid.seal,
            // The lid goes on at once. A seal that let the surplus leak away
            // over months would be asking them to stop rather than stopping
            // them, which is the distinction `whatLayingASealTakes` draws.
            qi: Math.min(them.qi, laid.poolCutTo ?? them.qi)
        });

        const world = input.world ?? null;
        const hall = world === null ? null : world.locations.find(place =>
            place.data?.factionId === input.houseId
            && purposeOf(place) === THE_ROOM_COMPLAINTS_GO_TO);
        const npc = world === null ? null : getNpc(world, input.offenderId);
        if (world !== null && npc !== null && hall !== undefined && hall !== null) {
            Object.assign(world, upsertNpc(world, setLocation(npc, hall.id, input.onDay)));
        }

        const wrote = discharged(receipt(
            SEALED_AND_HELD,
            `${input.houseName} sealed ${input.offenderName} and holds them. ${laid.line}`,
            laid.seal?.liftsOnDay === null
                ? 'No day was put on it. Nothing lifts it but the hand that laid it.'
                : null
        ));
        writeOneObligation(db, wrote);

        return {
            ...NOTHING_MOVED, decided, settled, wrote,
            sealed: true,
            sealedUntilDay: laid.seal?.liftsOnDay ?? null,
            theWorldMoved: hall !== undefined && hall !== null && npc !== null,
            line: `${decided.line} ${input.offenderName} is sealed`
                + (hall === undefined || hall === null
                    ? ' and held. '
                    : ` and put in ${hall.name}. `)
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
        const them = input.repos.cultivators.getById(input.offenderId);
        if (them === null || !them.alive) {
            return routed(
                decided.carriedOutBy,
                `There is no living record for ${input.offenderName} to carry the wound, and `
                + 'nothing is taken.'
            );
        }

        input.repos.cultivators.addInjury(input.offenderId, {
            severity: 'crippling',
            source: 'other',
            description:
                `What ${input.offenderName} climbed was taken off them by ${input.houseName}, `
                + 'on the room\'s word, and it does not come back.',
            sustainedOnTurn: Math.max(0, Math.round(input.onTurn ?? 0)),
            woundType: woundKey
        });

        const wrote = discharged(receipt(
            THE_CAPABILITY_WAS_TAKEN,
            `${input.houseName} took what ${input.offenderName} had built. Wound: ${woundKey}.`
        ));
        writeOneObligation(db, wrote);

        return {
            ...NOTHING_MOVED, decided, settled, wrote, woundKey,
            line: `${decided.line} What ${input.offenderName} climbed is taken off them, and it `
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
        if (world !== null && npc !== null && npc.status === 'alive') {
            Object.assign(world, upsertNpc(world, markDead(npc, input.onDay, endNote)));
        }

        const wrote = discharged(receipt(THE_HOUSE_ENDED_THEM, endNote));
        writeOneObligation(db, wrote);

        return {
            ...NOTHING_MOVED, decided, settled, wrote,
            ended: true,
            theWorldMoved: world !== null && npc !== null && npc.status === 'alive',
            line: `${decided.line} ${endNote}`
        };
    }

    // Unreachable while `SENTENCES_IN_ORDER` has seven members and the seven
    // above are them. Left rather than cast away, so a new rung on that ladder
    // arrives here as an honest report instead of falling off the end.
    return routed(decided.carriedOutBy, 'This handler does not reach it yet.');
}
