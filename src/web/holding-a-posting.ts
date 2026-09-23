/**
 * The player's side of a posting: being sent to one, taking it up, being
 * expected there, being looked in on, and the term's end.
 *
 * The engine half is `a-house-posts-the-one-being-played.ts`. Everything a
 * posting IS for the player lives in rows that already exist, and nothing here
 * adds a store:
 *
 *   the ask       a summons, kept on the one flag every summons is kept on
 *                 (`pending-summons.ts`), answered with the same three words.
 *                 Refusing and ignoring are the ordinary ones. Saying yes comes
 *                 here, because a posting is years in a town and not a span
 *                 spent at once
 *   the posting   the oath `acceptDuty` writes, which already holds who, for
 *                 which house, from which day and to which. The town is in its
 *                 catalog tag, and the day they got there in a tag beside it,
 *                 the way days served are kept (`recordDaysServed`)
 *   the merit     at the term's end, `whatServiceIsWorth` over the term, which
 *                 is what a posting served to its end counts for the world's own
 *                 people (`bringHomeWhoeverIsDue`)
 *
 * ── TWO KINDS OF POST, AND THE SECOND IS AN OFFICE ───────────────────────
 *
 * A town's watch is relieved: the post has somebody in it and the player takes
 * it over. A house's own Internal Affairs has nobody under it in any house in
 * the world, and its disciples are what cut the house's slips for its
 * disciples - the owner: *"probably his disciples craft them for disciples, the
 * elder crafts them for elders"* - so that one is put to a spare member as a
 * post inside the walls, for a tour read off the ladder
 * (`howLongATourUnderAnOfficeRuns`). Everything else about it is the same word,
 * the same arrival, the same look-ins and the same merit at the end.
 *
 * ── BEING EXPECTED THERE ─────────────────────────────────────────────────
 *
 * The post is as wide as the post is: a town's watch is the district it
 * watches, and a post inside the walls is the compound. Leaving it before the term is out is leaving the post, and that
 * is a consequence rather than a refusal - nothing stops the walk. The word is
 * closed as renounced and the house holds it against them as work taken on and
 * not finished (`refuseDuty`, `failed`), at the severity the ask carried.
 *
 * Read after every turn, beside what the house has issued, because arriving,
 * leaving, a term running out and a look-in falling due are all facts a dozen
 * verbs change, and a list of those verbs is the thing somebody forgets to
 * extend.
 */

import { DAYS_PER_YEAR } from '../engine/cultivation/cultivation.js';
import type { Duty } from '../engine/encounters/types.js';
import { postureFor } from '../engine/encounters/duties.js';
import { settleObligation, type ObligationRecord } from '../engine/social/grudges.js';
import { theProvinceAround } from '../engine/world/ground-holder.js';
import { theSeatOfTheCompound } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import {
    aPostTheHouseWouldSendThemTo,
    theOneBeingPlayedLeavesThePost,
    theOneBeingPlayedStandsAtThisPost,
    pairsCutForThem,
    theHouseSendsSomebodyToLookIn,
    theyAreRelieved
} from '../engine/world/a-house-posts-the-one-being-played.js';
import { whoReadsTheHall } from '../engine/world/a-communication-talisman-carries-word-home.js';
import { whatServiceIsWorth } from '../engine/world/what-a-house-counts-in-somebodys-favour.js';
import { aLookInFallsDue } from '../engine/world/what-a-house-hears-from-its-people-away.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { addToPouch } from '../server/consolidated/cultivation-support.js';
import { ledgerAbout, writeOneObligation } from '../storage/repos/obligation.repo.js';
import { acceptDuty, refuseDuty, type DatabaseHandle } from './encounters.js';
import { factsForToolResult } from './facts.js';
import {
    clearPendingSummons,
    readPendingSummons,
    rememberSummons,
    type PendingSummons
} from './pending-summons.js';
import {
    pouchIdForCommunicationTalismans,
    theCommunicationTalismansOnYou
} from './sending-word-on-a-communication-talisman.js';
import { positionIn } from './standing.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** The catalog tag a posting's word carries: `a-posting-at:<town id>:<day it was wanted by>`. */
export const A_POSTING_AT = 'a-posting-at:';

/** The tag the day they reached the post is kept under. */
const ARRIVED = 'arrived:';

export function entryIdForAPosting(townId: string, wantedByDay: number): string {
    return `${A_POSTING_AT}${townId}:${wantedByDay}`;
}

export function isAPosting(entryId: string): boolean {
    return entryId.startsWith(A_POSTING_AT);
}

/** The town a posting's tag names. */
export function theTownOf(entryId: string): string {
    const rest = entryId.slice(A_POSTING_AT.length);
    const at = rest.lastIndexOf(':');
    return at < 0 ? rest : rest.slice(0, at);
}

/** The posting word this cultivator is holding open, or null. */
export function theirOpenPosting(game: Pick<GameService, 'repos'>, cultivatorId: string): ObligationRecord | null {
    return ledgerAbout(game.repos.db as unknown as DatabaseHandle, cultivatorId).find(row =>
        row.kind === 'oath'
        && row.status === 'open'
        && row.holderId === cultivatorId
        && row.tags.includes('duty')
        && row.tags.some(isAPosting)) ?? null;
}

function arrivedOn(record: ObligationRecord): number | null {
    const tag = record.tags.find(t => t.startsWith(ARRIVED));
    const day = tag ? Number.parseInt(tag.slice(ARRIVED.length), 10) : Number.NaN;
    return Number.isFinite(day) ? day : null;
}

/** The ask as the duty layer holds one, rebuilt off the word for the ledger's own writers. */
function theDutyBehind(record: ObligationRecord, houseName: string): Duty {
    return {
        origin: 'summons',
        posture: 'assigned',
        factionId: record.subjectId,
        factionName: houseName,
        days: Math.max(0, (record.dueOnDay ?? record.incurredOnDay) - record.incurredOnDay),
        contribution: 0,
        stones: 0,
        pitchOrdinal: 0,
        dueOnDay: record.dueOnDay ?? record.incurredOnDay,
        refusal: {
            kind: 'grudge',
            cause: 'broken_oath',
            severity: record.severity,
            // THE TERM AND THE DAY, AND NOT WHAT THE HOUSE FELT ABOUT IT.
            // "The house had counted on it" is an inference about somebody
            // else's expectations, which nothing in the engine holds; the
            // narrator reading this line then writes it as fact. What is
            // actually known is how long the post ran and when it was walked
            // off, and both are on the row.
            description: `Posted by the house for ${
                Math.max(0, (record.dueOnDay ?? record.incurredOnDay) - record.incurredOnDay)
            } days from day ${record.incurredOnDay}, and did not hold the post${
                arrivedOn(record) === null ? '' : `, having reached it on day ${arrivedOn(record)}`
            }.`
        },
        scale: 'local',
        cohort: 0,
        takingOut: [],
        access: { granted: false, note: '' },
        spokenBy: null
    };
}

/**
 * Today on both clocks. The ledger's duty rows are written on the run's clock -
 * `goWhereTheHouseSentYou` and `refuseWhatTheHouseAsked` date them off
 * `run.elapsedDays` - and a world row's term is on the world's. The two are
 * joined at the advance (`catchUp`), so the gap between them is read once here
 * and a day is carried across it, never mixed.
 */
interface TheTwoClocks {
    runDay: number;
    worldDay: number;
}

function theTwoClocks(world: WorldState, run: Run): TheTwoClocks {
    return { runDay: Math.floor(run.elapsedDays), worldDay: Math.floor(world.currentDay) };
}

function years(days: number): string {
    const n = Math.round(days / DAYS_PER_YEAR);
    return `${n} year${n === 1 ? '' : 's'}`;
}

export interface WhatThePostingDid {
    lines: string[];
    structure: string[];
}

/**
 * Everything about a posting that the turn just changed, or null.
 *
 * `clockOnEntry` is the day the turn began, so a look-in falls due only across
 * days this turn actually spent.
 */
export function settleWhereYourHouseHasPostedYou(
    game: GameService,
    cultivator: Cultivator,
    clockOnEntry: number
): WhatThePostingDid | null {
    const world = game.atHand;
    if (!world || !cultivator.alive) return null;
    const held = positionIn(game.repos, cultivator.id);
    if (!held) return null;
    const clocks = theTwoClocks(world, game.currentRun().run);
    const out: WhatThePostingDid = { lines: [], structure: [] };

    const posting = theirOpenPosting(game, cultivator.id);
    if (posting === null) {
        aPostingIsPutToThem(game, world, cultivator, held, clocks, out);
    } else {
        heldToThePost(game, world, cultivator, held.sectName, posting, clocks, clockOnEntry, out);
    }
    return out.lines.length === 0 && out.structure.length === 0 ? null : out;
}

function aPostingIsPutToThem(
    game: GameService,
    world: WorldState,
    cultivator: Cultivator,
    held: NonNullable<ReturnType<typeof positionIn>>,
    clocks: TheTwoClocks,
    out: WhatThePostingDid
): void {
    if (readPendingSummons(game.repos, cultivator.id)) return;
    const post = aPostTheHouseWouldSendThemTo(world, {
        houseId: held.sectId, playerId: cultivator.id, rankIndex: held.rankIndex,
        ordinal: cultivator.realmOrdinal, today: clocks.worldDay
    });
    if (!post) return;
    const today = clocks.runDay;
    const wantedBy = post.wantedByDay - clocks.worldDay + clocks.runDay;
    const entryId = entryIdForAPosting(post.townId, post.wantedByDay);
    // Asked once. A refusal or a lapse of this ask is on the house's ledger
    // with its tag, and the house does not put the same post to them again.
    const answered = ledgerAbout(game.repos.db as unknown as DatabaseHandle, cultivator.id)
        .some(row => row.tags.includes(entryId));
    if (answered) return;

    const reader = whoReadsTheHall(world, post.houseId);
    const mouth = reader ? world.npcs.find(n => n.id === reader.id) ?? null : null;
    const givenBy = mouth ? { rankIndex: mouth.factionRankIndex, isHead: mouth.factionRankIndex >= held.rankCount - 1 } : null;
    const membership = {
        factionId: held.sectId, factionName: held.sectName, rankIndex: held.rankIndex,
        rankCount: Math.max(1, held.rankCount), contribution: held.contribution
    };
    const duty: Duty = {
        origin: 'summons',
        posture: postureFor(membership, givenBy),
        factionId: post.houseId,
        factionName: post.houseName,
        days: post.termDays,
        contribution: Math.round(whatServiceIsWorth(cultivator.realmOrdinal, post.termDays)),
        stones: 0,
        pitchOrdinal: cultivator.realmOrdinal,
        dueOnDay: wantedBy,
        refusal: {
            kind: 'grudge',
            cause: 'broken_oath',
            severity: 'serious',
            // The term and the day it was wanted by, for the reason given on
            // the other grudge in this file: what the house counted on is not
            // a thing the engine holds.
            description: `Posted to ${post.townName} for ${post.termDays} days, `
                + `wanted there by day ${post.wantedByDay}, and did not go.`
        },
        scale: 'local',
        cohort: 0,
        takingOut: [],
        access: { granted: false, note: '' },
        spokenBy: mouth
            ? {
                id: mouth.id, name: mouth.name, rankIndex: mouth.factionRankIndex,
                realmOrdinal: mouth.cultivation.realmOrdinal, known: false, detail: null
            }
            : null
    };
    // A POST INSIDE THE WALLS RELIEVES NOBODY. The house's own office has no
    // disciple under it at all, which is why it is being put to anybody.
    const what = post.insideTheWalls
        ? `${post.houseName} posts you under its Internal Affairs Elder, at ${post.townName}, for `
          + `${years(post.termDays)}. Its disciples are what cut the house's slips for its disciples, `
          + 'and it has none.'
        : `${post.houseName} posts you to ${post.townName} for ${years(post.termDays)}, `
          + `relieving ${post.relievedName}, whose tour there ends on day ${wantedBy}.`;
    const pending: PendingSummons = { duty, entryId, what, spokenOnDay: today };
    rememberSummons(game.repos, cultivator.id, pending);
    out.lines.push(
        `${mouth ? `${mouth.name} brings word from ${post.houseName}` : `Word comes from ${post.houseName}`}: ${what} `
        + `The house counts ${duty.contribution} contribution for a tour served to its end. `
        + 'It wants an answer by that day.'
    );
    out.structure.push(
        `aPostTheHouseWouldSendThemTo: ${post.townId} `
        + (post.insideTheWalls
            ? 'under the office, nobody relieved'
            : `relieving ${post.relievedId} (tour ends ${post.wantedByDay})`)
        + `, term ${post.termDays} days. rememberSummons ${entryId}.`
    );
}

/**
 * The post is theirs no longer, so the world may fill it again.
 *
 * Called at all three ends - served out, lapsed unserved, walked off - because
 * a stamp nothing clears is a way to hold a town forever by having once stood
 * in it, which is the same defect as the one the stamp is for with the sign
 * flipped.
 */
function theHouseCanFillItAgain(
    game: GameService,
    world: WorldState,
    cultivator: Cultivator,
    clocks: TheTwoClocks,
    out: WhatThePostingDid
): void {
    if (!theOneBeingPlayedLeavesThePost(world, { playerId: cultivator.id, today: clocks.worldDay })) return;
    game.theWorldMoved();
    out.structure.push(
        `theOneBeingPlayedLeavesThePost: ${cultivator.id} is no longer stationed anywhere, so the `
        + 'house may put somebody at the post again.'
    );
}

function heldToThePost(
    game: GameService,
    world: WorldState,
    cultivator: Cultivator,
    houseName: string,
    posting: ObligationRecord,
    clocks: TheTwoClocks,
    clockOnEntry: number,
    out: WhatThePostingDid
): void {
    const today = clocks.runDay;
    const entryId = posting.tags.find(isAPosting)!;
    const townId = theTownOf(entryId);
    const town = world.locations.find(l => l.id === townId);
    const townName = town?.name ?? 'the post';
    const due = posting.dueOnDay ?? posting.incurredOnDay;
    const here = game.worldPlaceOf(cultivator);
    // BEING AT THE POST IS AS WIDE AS THE POST IS. A town's watch is the
    // district it watches, so the province answers it; a post inside a house's
    // own walls is the compound, and a disciple of Internal Affairs who walks to
    // the refectory has not left it.
    const inside = theSeatOfTheCompound(world, townId);
    const post = theProvinceAround(world.locations, townId);
    const atThePost = here !== null && (here === townId
        || (inside !== null && theSeatOfTheCompound(world, here)?.id === inside.id)
        || (inside === null && post !== null && theProvinceAround(world.locations, here) === post));
    const arrived = arrivedOn(posting);
    const db = game.repos.db as unknown as DatabaseHandle;
    const duty = theDutyBehind(posting, houseName);

    // ── THE TERM IS OUT ──────────────────────────────────────────────────
    if (today >= due) {
        if (arrived === null) {
            writeOneObligation(db, settleObligation(posting, {
                resolution: 'renounced', onDay: today, byId: cultivator.id, note: 'Never took up the post.'
            }));
            const walked = refuseDuty({
                repos: game.repos, cultivator, duty, onDay: today, entryId, what: `The posting at ${townName}.`, outcome: 'lapsed'
            });
            out.lines.push(`The tour at ${townName} ran out on day ${due} and you never took up the post. ${walked.line}`);
            out.structure.push(`posting ${posting.id} lapsed unserved; refuseDuty lapsed ${walked.obligation.id}.`);
            theHouseCanFillItAgain(game, world, cultivator, clocks, out);
            return;
        }
        const credit = Math.round(whatServiceIsWorth(cultivator.realmOrdinal, due - posting.incurredOnDay));
        game.repos.db.transaction(() => {
            writeOneObligation(db, settleObligation(posting, {
                resolution: 'oath_fulfilled', onDay: today, byId: cultivator.id, note: `Served to day ${due}.`
            }));
            if (credit > 0 && posting.subjectId) game.repos.sects.addContribution(posting.subjectId, cultivator.id, credit);
        })();
        out.lines.push(
            `Your tour at ${townName} is served, to day ${due}. ${houseName} counts ${credit} contribution for it, `
            + 'and you are no longer posted anywhere.'
        );
        out.structure.push(`posting ${posting.id} fulfilled; whatServiceIsWorth(${cultivator.realmOrdinal}, ${due - posting.incurredOnDay}) = ${credit} credited.`);
        theHouseCanFillItAgain(game, world, cultivator, clocks, out);
        return;
    }

    // ── GETTING THERE ────────────────────────────────────────────────────
    if (arrived === null) {
        if (!atThePost) return;
        writeOneObligation(db, { ...posting, tags: [...posting.tags, `${ARRIVED}${today}`] });
        out.lines.push(`You are at your posting at ${townName}, for ${houseName}, until day ${due}.`);
        out.structure.push(`posting ${posting.id}: arrived on day ${today}.`);
        return;
    }

    // ── LEAVING IT ───────────────────────────────────────────────────────
    if (!atThePost) {
        writeOneObligation(db, settleObligation(posting, {
            resolution: 'renounced', onDay: today, byId: cultivator.id, note: `Left the post on day ${today}, before day ${due}.`
        }));
        const walked = refuseDuty({
            repos: game.repos, cultivator, duty, onDay: today, entryId, what: `The posting at ${townName}.`, outcome: 'failed'
        });
        out.lines.push(
            `You have left your posting at ${townName} before its term was out on day ${due}. You are no longer `
            + `posted there, nothing is counted for the years you held it, and ${walked.line}`
        );
        out.structure.push(`posting ${posting.id} renounced on leaving the province; refuseDuty failed ${walked.obligation.id}.`);
        theHouseCanFillItAgain(game, world, cultivator, clocks, out);
        return;
    }

    // ── AND LOOKED IN ON ─────────────────────────────────────────────────
    const lookIn = aLookInFallsDue(arrived, due, Math.floor(clockOnEntry) + 1, today);
    if (lookIn === null || posting.subjectId === null) return;
    const visitor = theHouseSendsSomebodyToLookIn(world, {
        houseId: posting.subjectId, postedId: cultivator.id, postedName: cultivator.name, townId: here ?? townId,
        today: clocks.worldDay
    });
    if (!visitor) {
        out.structure.push(`look-in on ${cultivator.id} due day ${lookIn}: nobody the house could spare.`);
        return;
    }
    const carrying = theCommunicationTalismansOnYou(game.db, cultivator.id)
        .find(s => s.houseId === posting.subjectId)?.count ?? 0;
    const pairs = pairsCutForThem(world, {
        houseId: posting.subjectId, holderId: cultivator.id, holderName: cultivator.name, carrying,
        today: clocks.worldDay
    });
    if (pairs > 0) addToPouch(game.db, cultivator.id, pouchIdForCommunicationTalismans(posting.subjectId), 'talisman', pairs);
    game.theWorldMoved();
    out.lines.push(
        `${visitor.name} of ${houseName} has come to ${townName} to look in on you, and is here.`
        + (pairs > 0
            ? ` ${visitor.name} brings ${pairs} communication talisman${pairs === 1 ? '' : 's'} keyed to you, their twins kept in the house's hall.`
            : '')
    );
    out.structure.push(
        `look-in on ${cultivator.id} due day ${lookIn}: ${visitor.id} put at ${here ?? townId} out_with_a_party; `
        + `${pairs} pair(s) cut from the treasury.`
    );
}

export const postingVerbs = {
    /**
     * Saying yes to a posting: the word is given, the one relieved goes home,
     * and the player is told where they are expected and until when. Nothing
     * moves the player; getting there is theirs to do.
     */
    async takeUpAPosting(
        this: GameService,
        run: Run,
        cultivator: Cultivator,
        pending: PendingSummons
    ): Promise<Execution> {
        this.atHand = this.atHand ?? await this.loadWorld();
        const world = this.atHand;
        // The ledger's clock for the word, the world's for the rows. See `theTwoClocks`.
        const today = Math.floor(run.elapsedDays);
        const worldToday = Math.floor(world?.currentDay ?? run.elapsedDays);
        const duty = pending.duty;
        const townId = theTownOf(pending.entryId);
        const townName = world?.locations.find(l => l.id === townId)?.name ?? 'the post';
        const provinceId = world ? theProvinceAround(world.locations, townId) : null;
        const provinceName = world?.locations.find(l => l.id === provinceId)?.name ?? townName;
        const sworn = acceptDuty({
            repos: this.repos,
            cultivator,
            duty: { ...duty, dueOnDay: today + duty.days },
            onDay: today,
            entryId: pending.entryId,
            what: `${pending.what} Answered on day ${today}.`
        });
        clearPendingSummons(this.repos, cultivator.id);

        const lines = [
            `You take up the posting at ${townName} for ${duty.factionName ?? 'your house'}, until day ${today + duty.days}. `
            + `The house expects you there, and counts ${duty.contribution} contribution when the tour is served.`,
            `Leaving ${provinceName} before then is leaving the post.`
        ];
        const structure = [`encounters.acceptDuty: ${sworn.id} for ${pending.entryId}, due ${today + duty.days}.`];
        if (world && duty.factionId) {
            const relieved = world.npcs.find(n => n.activity?.kind === 'stationed' && n.locationId === townId
                && n.factionId === duty.factionId && n.id !== cultivator.id);
            if (relieved && theyAreRelieved(world, { relievedId: relieved.id, townId, today: worldToday })) {
                lines.push(`${relieved.name}, who held it, is relieved and goes home.`);
                structure.push(`theyAreRelieved: ${relieved.id} tour ends world day ${worldToday}.`);
            }
            // ── AND THE WORLD IS TOLD THE POST IS HELD ───────────────────
            //
            // `applyPostings` fills the posts nobody is standing at, off the
            // whole roll and the player's row with it. Without this the house
            // posts one of its own people to the town the player just took and
            // pays for two: the stamp is the one thing the world has to know
            // about where the player is, and it is cleared the moment the tour
            // ends or they walk off it.
            if (theOneBeingPlayedStandsAtThisPost(world, {
                playerId: cultivator.id, townId, houseId: duty.factionId,
                sinceDay: worldToday, untilDay: worldToday + duty.days
            })) {
                structure.push(
                    `theOneBeingPlayedStandsAtThisPost: ${cultivator.id} stationed at ${townId} `
                    + `from world day ${worldToday} to ${worldToday + duty.days}.`
                );
            }
            const carrying = theCommunicationTalismansOnYou(this.db, cultivator.id)
                .find(s => s.houseId === duty.factionId)?.count ?? 0;
            const pairs = pairsCutForThem(world, {
                houseId: duty.factionId, holderId: cultivator.id, holderName: cultivator.name, carrying,
                today: worldToday
            });
            if (pairs > 0) {
                addToPouch(this.db, cultivator.id, pouchIdForCommunicationTalismans(duty.factionId), 'talisman', pairs);
                lines.push(`You are issued ${pairs} communication talisman${pairs === 1 ? '' : 's'} keyed to you for the post.`);
            }
            this.theWorldMoved();
        }
        const facts = factsForToolResult(`Posted to ${townName}.`, lines);
        facts.required = lines.slice(0, 2);
        facts.structure.push(...structure);
        const execution = this.freeAction(run, 'sect', facts);
        execution.calls = [{
            name: 'encounters.acceptDuty',
            action: 'sect',
            summary: `Posting at ${townName} taken up: ${duty.days} day(s), due on day ${today + duty.days}.`,
            ok: true
        }];
        return execution;
    }
};
