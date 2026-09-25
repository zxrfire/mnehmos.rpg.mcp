/**
 * A mission above the outer rung is a post, held rather than spent in one act.
 *
 * Outer chores run days to months and are served in one span, as any duty is. An inner or higher
 * mission runs months to decades, so taking it writes the word (`acceptDuty`) and keeps on it
 * where the post is, the realm and merit they took it at, and what the term pays. The holder stays
 * at the post's place and lives there as they like - cultivating, talking, anything - and the days
 * pass as they act. When the due day passes with them still there, the term is served and paid
 * through the rate it was taken at.
 *
 * Leaving before then, by walking away from the place or by saying so, closes the post. Whether
 * that costs anything is the house's view of the change (`whatTheHouseMakesOfAPostLeftEarly`): a
 * change it welcomes ends it cleanly and pays for the days served, and anything else is a post abandoned, which costs face by
 * how much of the term was left - the same face a fumbled delivery costs.
 *
 * Read after every turn, beside the house's own postings (`holding-a-posting.ts`), because the
 * things that end a post - a day passing, a walk - are done by a dozen verbs.
 */

import { THE_FACE_A_FUMBLE_TAKES } from '../engine/world/what-a-house-sends-its-sisters.js';
import { theirFaceMoves } from '../engine/world/what-a-face-is-worth.js';
import { aDeedEntersTheWorld } from '../engine/world/a-deed-enters-the-world-as-a-fact.js';
import { whatTheHouseMakesOfAPostLeftEarly } from '../engine/world/what-a-house-makes-of-a-post-left-early.js';
import { theProvinceAround } from '../engine/world/ground-holder.js';
import { theSeatOfTheCompound } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { WorldState } from '../engine/world/world-state.js';
import { realmForOrdinal, realmIndexOf, REALM_TIERS } from '../engine/cultivation/realms.js';
import { aMissionAsAnOffer, theMissionBehind } from '../engine/encounters/what-a-house-has-on-its-board.js';
import type { DutyCandidate } from '../engine/encounters/duties.js';
import type { Duty } from '../engine/encounters/types.js';
import { settleObligation, type ObligationRecord } from '../engine/social/grudges.js';
import { ledgerAbout, writeOneObligation } from '../storage/repos/obligation.repo.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { DatabaseHandle } from './encounters.js';
import { factsForToolResult, placeName } from './facts.js';
import { theirOpenPosting } from './holding-a-posting.js';
import { readPendingSummons } from './pending-summons.js';
import { theBoardTheyStandAt } from './the-mission-board-inside-a-house.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

/** What a post keeps on its word, as tags: `post-at:<location id>` and the rest. */
const AT = 'post-at:';
const REALM = 'post-realm:';
const MERIT = 'post-merit:';
const PAYS = 'post-pays:';
/** Set once they have stood at the post. Before it, being elsewhere is still getting there. */
const ARRIVED = 'post-arrived';

/** Whether a board line is a mission held as a post rather than spent in one act. */
export function isHeldAsAPost(entryId: string): boolean {
    const mission = theMissionBehind(entryId);
    return mission !== null && mission.rung !== 'outer';
}

/** The mission post this cultivator holds, or null. */
export function theMissionPostTheyHold(game: Pick<GameService, 'repos'>, cultivatorId: string): ObligationRecord | null {
    return ledgerAbout(game.repos.db as unknown as DatabaseHandle, cultivatorId).find(row =>
        row.kind === 'oath' && row.status === 'open' && row.holderId === cultivatorId
        && row.tags.includes('duty') && row.tags.some(tag => tag.startsWith(AT))) ?? null;
}

function tagged(record: ObligationRecord, prefix: string): string | null {
    const tag = record.tags.find(t => t.startsWith(prefix));
    return tag === undefined ? null : tag.slice(prefix.length);
}

function aNumber(value: string | null | undefined): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

/** The post's own row, and the entry it was taken off. */
function thePost(world: WorldState | null, record: ObligationRecord) {
    const entryId = record.tags.find(tag => theMissionBehind(tag) !== null) ?? '';
    const mission = theMissionBehind(entryId);
    const place = world?.locations.find(row => row.id === tagged(record, AT)) ?? null;
    const houseId = entryId.slice(entryId.indexOf('@') + 1);
    const houseName = world?.factions.find(f => f.id === houseId)?.name ?? 'the house';
    const title = mission
        ? aMissionAsAnOffer(mission, { id: houseId, name: houseName }, place?.name ?? null).name
            .replace(/ for the next [^,]+$/, '')
        : 'the post';
    return { entryId, mission, place, houseId, houseName, title };
}

/** The seat a place is, or is inside, or null. */
function theSeatOf(world: WorldState, place: LocationRecord): LocationRecord | null {
    return place.kind === 'sect_seat' ? place : theSeatOfTheCompound(world, place.id);
}

/** Whether somebody here is at the post: inside the same walls, or in the same province where the post has none. */
function standsAtThePost(world: WorldState, hereId: string | null, post: LocationRecord): boolean {
    const here = hereId === null ? undefined : world.locations.find(row => row.id === hereId);
    if (!here) return false;
    if (here.id === post.id) return true;
    const walls = theSeatOf(world, post);
    if (walls !== null) return theSeatOf(world, here)?.id === walls.id;
    const province = theProvinceAround(world.locations, post.id);
    return province !== null && theProvinceAround(world.locations, here.id) === province;
}

/** The sheet's line for the post they hold, or null. */
export function theMissionPostOnTheSheet(game: GameService, cultivator: Cultivator): string | null {
    const record = theMissionPostTheyHold(game, cultivator.id);
    if (record === null) return null;
    const { title } = thePost(game.atHand, record);
    return `On post: ${title.charAt(0).toLowerCase()}${title.slice(1)}, until day ${record.dueOnDay ?? record.incurredOnDay}.`;
}

/**
 * Taking a post up, off the board. The word is already written; this keeps on it where the post
 * is and on what terms, and says so. No day passes.
 */
export function takeUpTheMissionPost(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    chosen: DutyCandidate,
    duty: Duty,
    sworn: ObligationRecord
): Execution {
    const world = game.atHand;
    const mission = theMissionBehind(chosen.entry.id)!;
    const houseId = chosen.entry.id.slice(chosen.entry.id.indexOf('@') + 1);
    const seat = theBoardTheyStandAt(world, cultivator);
    const ground = world?.locations.find(row => row.controllingFactionId === houseId) ?? null;
    const post = mission.at === 'its_ground' ? ground ?? seat : seat;
    const merit = game.repos.sects.getMembership(cultivator.id)?.contribution ?? 0;
    const there = world !== null && post !== null && standsAtThePost(world, game.worldPlaceOf(cultivator), post);
    const record = writeOneObligation(game.repos.db as unknown as DatabaseHandle, {
        ...sworn,
        tags: [
            ...sworn.tags,
            `${AT}${post?.id ?? ''}`,
            `${REALM}${realmIndexOf(cultivator.realmOrdinal)}`,
            `${MERIT}${merit}`,
            `${PAYS}${duty.contribution}:${duty.stones}`,
            ...(there ? [ARRIVED] : [])
        ]
    });
    const due = record.dueOnDay ?? duty.dueOnDay;
    const lines = [
        `You take up the post: ${chosen.entry.name}. It runs to day ${due}.`,
        `${duty.factionName ?? 'The house'} counts ${duty.contribution} contribution and pays ${duty.stones} spirit `
        + 'stones when it is served.',
        `Leaving ${post?.name ?? 'the post'} before then is leaving the post.`
    ];
    const facts = factsForToolResult('On post.', lines);
    facts.required = lines.slice();
    facts.structure.push(
        `takeUpTheMissionPost: ${record.id} for ${chosen.entry.id} at ${post?.id ?? 'nowhere'}, due ${due}, `
        + `pays ${duty.contribution} contribution and ${duty.stones} stones.`
    );
    const execution = game.freeAction(run, 'sect', facts);
    execution.calls = [{
        name: 'encounters.acceptDuty',
        action: 'sect',
        summary: `${chosen.entry.name} taken up as a post, due on day ${due}.`,
        ok: true
    }];
    return execution;
}

export interface WhatThePostDid {
    lines: string[];
    structure: string[];
}

/**
 * The post closed before its day: welcomed, or abandoned and paid for in face. `how` is what
 * ended it, for the ledger's note.
 */
function thePostIsLeft(
    game: GameService,
    cultivator: Cultivator,
    record: ObligationRecord,
    today: number,
    how: string,
    /** The day the unserved part is counted from: `today`, or the day it was taken where it never was. */
    leftFrom = today
): WhatThePostDid {
    const world = game.atHand;
    const { title, houseId, houseName, place } = thePost(world, record);
    const due = record.dueOnDay ?? today;
    const termDays = Math.max(1, due - record.incurredOnDay);
    const daysLeft = Math.max(0, due - leftFrom);
    const [contribution, stones] = (tagged(record, PAYS) ?? '0:0').split(':').map(aNumber);
    const merit = game.repos.sects.getMembership(cultivator.id)?.contribution ?? 0;
    const then = aNumber(tagged(record, REALM));
    const pending = readPendingSummons(game.repos, cultivator.id);
    const verdict = whatTheHouseMakesOfAPostLeftEarly({
        realmWhenTaken: { index: then, name: REALM_TIERS[then]?.name ?? 'the realm you had' },
        realmNow: { index: realmIndexOf(cultivator.realmOrdinal), name: realmForOrdinal(cultivator.realmOrdinal).name },
        houseAtWar: world?.factions.find(f => f.id === houseId)?.tags.includes('at_war') ?? false,
        // Since the post was taken: a summons of its own waiting, or a posting it put them on.
        sentForByTheHouse: (pending !== null && pending.duty.factionId === houseId
                && pending.spokenOnDay >= record.incurredOnDay)
            || (theirOpenPosting(game, cultivator.id)?.incurredOnDay ?? -1) >= record.incurredOnDay,
        meritSinceTaken: Math.max(0, merit - aNumber(tagged(record, MERIT))),
        whatTheRestWasWorth: Math.round(contribution! * daysLeft / termDays),
        daysLeft,
        termDays
    });
    const db = game.repos.db as unknown as DatabaseHandle;
    const what = `${title.charAt(0).toLowerCase()}${title.slice(1)}`;
    if (verdict.welcome) {
        // PAID FOR THE DAYS SERVED. The term's pay is the monthly rate times the days, so the
        // share of it the served days make is the same arithmetic run over fewer of them.
        const served = Math.max(0, termDays - daysLeft);
        const paidContribution = Math.round(contribution! * served / termDays);
        const paidStones = Math.round(stones! * served / termDays);
        game.repos.db.transaction(() => {
            writeOneObligation(db, settleObligation(record, {
                resolution: 'oath_released', onDay: today, byId: houseId,
                note: `Left on day ${today}, ${how}; the house let it go and paid ${served} of ${termDays} days.`
            }));
            if (record.subjectId && paidContribution > 0) {
                game.repos.sects.addContribution(record.subjectId, cultivator.id, paidContribution);
            }
            if (paidStones > 0) game.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: paidStones });
        })();
        return {
            lines: [`You are off your post (${what}) with ${daysLeft} days of it left. ${verdict.because} `
                + `It ends cleanly: ${houseName} pays for the ${served} days served, ${paidContribution} contribution `
                + `and ${paidStones} spirit stones, and nothing is held against you.`],
            structure: [`thePostIsLeft: ${record.id} released on day ${today} (${how}); welcomed; paid ${served}/${termDays} `
                + `days: +${paidContribution} contribution, +${paidStones} stones.`]
        };
    }
    writeOneObligation(db, settleObligation(record, {
        resolution: 'renounced', onDay: today, byId: cultivator.id, note: `Left on day ${today}, ${how}, before day ${due}.`
    }));
    const face = THE_FACE_A_FUMBLE_TAKES[verdict.severity];
    if (world) {
        const worldDay = Math.floor(world.currentDay);
        theirFaceMoves(world, cultivator.id, -face, worldDay);
        aDeedEntersTheWorld(world, {
            kind: 'said_in_public',
            weight: verdict.severity,
            day: worldDay,
            locationId: place?.id ?? null,
            place: placeName(cultivator),
            actors: [{ id: cultivator.id, name: cultivator.name, role: 'left a post before its term' }],
            factionIds: [houseId],
            summary: `${cultivator.name} left a post for ${houseName} with ${daysLeft} days of it still to serve.`,
            unattributed: `Somebody left a post for ${houseName} before its term.`
        });
        game.theWorldMoved();
    }
    return {
        lines: [`You have left your post (${what}) before day ${due}. ${verdict.because} It costs you face, `
            + 'and nothing is paid for it.'],
        structure: [`thePostIsLeft: ${record.id} renounced on day ${today} (${how}); face -${face} (${verdict.severity}).`]
    };
}

/**
 * Everything about the post the turn just changed, or null: the term served, or the post walked
 * away from.
 */
export function settleTheMissionPostTheyHold(game: GameService, cultivator: Cultivator): WhatThePostDid | null {
    const world = game.atHand;
    if (!world || !cultivator.alive) return null;
    const record = theMissionPostTheyHold(game, cultivator.id);
    if (record === null) return null;
    const today = Math.floor(game.currentRun().run.elapsedDays);
    const due = record.dueOnDay ?? today;
    const { title, houseName, place } = thePost(world, record);
    const at = place === null || standsAtThePost(world, game.worldPlaceOf(cultivator), place);
    const arrived = record.tags.includes(ARRIVED);

    // NEVER TAKEN UP: the whole term was left.
    if (today >= due && !arrived) return thePostIsLeft(game, cultivator, record, today, 'by never reaching it', record.incurredOnDay);
    if (today >= due) {
        const [contribution, stones] = (tagged(record, PAYS) ?? '0:0').split(':').map(aNumber);
        game.repos.db.transaction(() => {
            writeOneObligation(game.repos.db as unknown as DatabaseHandle, settleObligation(record, {
                resolution: 'oath_fulfilled', onDay: today, byId: cultivator.id, note: `Served to day ${due}.`
            }));
            if (record.subjectId && contribution! > 0) {
                game.repos.sects.addContribution(record.subjectId, cultivator.id, contribution!);
            }
            if (stones! > 0) game.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: stones! });
        })();
        return {
            lines: [`Your post is served, to day ${due}: ${title.charAt(0).toLowerCase()}${title.slice(1)}. `
                + `${houseName} counts ${contribution} contribution and pays ${stones} spirit stones, and you are `
                + 'on post no longer.'],
            structure: [`settleTheMissionPostTheyHold: ${record.id} fulfilled on day ${today}; +${contribution} `
                + `contribution, +${stones} stones.`]
        };
    }
    if (!arrived && at) {
        writeOneObligation(game.repos.db as unknown as DatabaseHandle, { ...record, tags: [...record.tags, ARRIVED] });
        return {
            lines: [`You are at your post, until day ${due}: ${title.charAt(0).toLowerCase()}${title.slice(1)}.`],
            structure: [`settleTheMissionPostTheyHold: ${record.id} reached on day ${today}.`]
        };
    }
    if (arrived && !at) return thePostIsLeft(game, cultivator, record, today, 'by walking away from it');
    return null;
}

/** Saying they leave the post, or null where they hold none. */
export function leaveTheMissionPost(game: GameService, run: Run, cultivator: Cultivator): Execution | null {
    const record = theMissionPostTheyHold(game, cultivator.id);
    if (record === null) return null;
    const left = thePostIsLeft(game, cultivator, record, Math.floor(run.elapsedDays), 'by saying so');
    const facts = factsForToolResult('Off post.', left.lines);
    facts.required = left.lines.slice();
    facts.structure.push(...left.structure);
    return game.freeAction(run, 'oath', facts);
}
