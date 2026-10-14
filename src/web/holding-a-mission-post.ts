import { publicWatchTargetForPost } from '../engine/world/where-a-house-keeps-its-public-watch.js';
import { journeyTimeHasReached } from '../engine/world/places-on-the-way.js';
/**
 * A long mission or a named remote watch is a post held at its actual ground.
 *
 * Seat chores run days to months and are served in one span. A remote watch must first be
 * reached, even at the outer rung; its existing lamp-watch terms do not buy instant travel. An inner or higher
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
import { theDaysAPostsMeritCounts, type DutyCandidate } from '../engine/encounters/duties.js';
import type { Duty } from '../engine/encounters/types.js';
import { createObligation, settleObligation, type ObligationRecord } from '../engine/social/grudges.js';
import { settleHiredDuties } from '../engine/world/a-hired-duty-is-served.js';
import { whatTheyWouldDoItFor, whoAnswersForItAfterwards } from '../engine/encounters/passing-a-duty-down-to-somebody-else.js';
import { ledgerAbout, writeOneObligation } from '../storage/repos/obligation.repo.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { DatabaseHandle } from './encounters.js';
import { factsForToolResult, factsForRefusal, placeName } from './facts.js';
import { refused } from './tool-result-prose.js';
import { whatTheyCannotPutDown } from './a-teacher-giving-you-their-attention.js';
import { theirOpenPosting } from './holding-a-posting.js';
import { readPendingSummons } from './pending-summons.js';
import { theBoardTheyStandAt } from './the-mission-board-inside-a-house.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import { witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { hallServiceWorth } from '../engine/world/the-people-posted-to-a-houses-halls.js';
import { theOneBeingPlayedLeavesThePost } from '../engine/world/a-house-posts-the-one-being-played.js';
import { HALL_SERVICE, postTag, settleYourHallService } from './serving-in-your-houses-hall.js';

/** What a post keeps on its word, as tags: `post-at:<location id>` and the rest. */
const AT = 'post-at:';
const REALM = 'post-realm:';
const MERIT = 'post-merit:';
const PAYS = 'post-pays:';
/** Set once they have stood at the post. Before it, being elsewhere is still getting there. */
const ARRIVED = 'post-arrived';
const TERM = 'post-term-days:';
const PITCH = 'post-pitch:';
const CONTRACT = 'post-contractor-oath:';

/** The mission post this cultivator holds, or null. */
export function theMissionPostTheyHold(game: Pick<GameService, 'repos'>, cultivatorId: string): ObligationRecord | null {
    const posts = missionPostsHeld(game, cultivatorId);
    return posts.find(row => tagged(row, CONTRACT) === null) ?? posts[0] ?? null;
}

function missionPostsHeld(game: Pick<GameService, 'repos'>, cultivatorId: string): ObligationRecord[] {
    return ledgerAbout(game.repos.db as unknown as DatabaseHandle, cultivatorId).filter(row =>
        row.kind === 'oath' && row.status === 'open' && row.holderId === cultivatorId
        && row.tags.includes('duty') && row.tags.some(tag => tag.startsWith(AT)));
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
    const houseId = record.tags.includes(HALL_SERVICE) ? record.subjectId! : entryId.slice(entryId.indexOf('@') + 1);
    const houseName = world?.factions.find(f => f.id === houseId)?.name ?? 'the house';
    const title = mission
        ? aMissionAsAnOffer(mission, { id: houseId, name: houseName }, place?.name ?? null).name
            .replace(/ for the next [^,]+$/, '')
        : postTag(record, 'post-title:') ?? 'the post';
    return { entryId, mission, place, houseId, houseName, title };
}

/** The seat a place is, or is inside, or null. */
function theSeatOf(world: WorldState, place: LocationRecord): LocationRecord | null {
    return place.kind === 'sect_seat' ? place : theSeatOfTheCompound(world, place.id);
}

/** Whether somebody here is at the post: inside the same walls, or in the same province where the post has none. */
function standsAtThePost(world: WorldState, hereId: string | null, post: LocationRecord, exact = false): boolean {
    const here = hereId === null ? undefined : world.locations.find(row => row.id === hereId);
    if (!here) return false;
    if (here.id === post.id) return true;
    if(exact)return false;
    const walls = theSeatOf(world, post);
    if (walls !== null) return theSeatOf(world, here)?.id === walls.id;
    const province = theProvinceAround(world.locations, post.id);
    return province !== null && theProvinceAround(world.locations, here.id) === province;
}

function whereThisPostIs(game: GameService, cultivator: Cultivator, entryId: string): LocationRecord | null {
    const houseId = entryId.slice(entryId.indexOf('@') + 1);
    const seat = theBoardTheyStandAt(game.atHand, cultivator);
    const ground = game.atHand?.locations.find(row => row.controllingFactionId === houseId) ?? null;
    const mission=theMissionBehind(entryId);
    if(mission?.at==='its_public_terminal')return game.atHand?publicWatchTargetForPost(game.atHand,houseId,entryId):null;
    return mission?.at === 'its_ground' ? ground ?? seat : seat;
}

/** The sheet's line for the post they hold, or null. */
export function theMissionPostOnTheSheet(game: GameService, cultivator: Cultivator, forTheirBody = false): string | null {
    const record = forTheirBody
        ? missionPostsHeld(game, cultivator.id).find(row => tagged(row, CONTRACT) === null) ?? null
        : theMissionPostTheyHold(game, cultivator.id);
    if (record === null) return null;
    const { title } = thePost(game.atHand, record);
    return `${tagged(record, CONTRACT) === null ? 'On post' : 'Hired out'}: `
        + `${title.charAt(0).toLowerCase()}${title.slice(1)}, until day ${record.dueOnDay ?? record.incurredOnDay}.`;
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
    const post = whereThisPostIs(game, cultivator, chosen.entry.id);
    const merit = game.repos.sects.getMembership(cultivator.id)?.contribution ?? 0;
    const there = world !== null && post !== null && standsAtThePost(world, game.worldPlaceOf(cultivator), post,
        theMissionBehind(chosen.entry.id)?.at==='its_public_terminal');
    const record = writeOneObligation(game.repos.db as unknown as DatabaseHandle, {
        ...sworn,
        tags: [
            ...sworn.tags,
            `${AT}${post?.id ?? ''}`,
            `${REALM}${realmIndexOf(cultivator.realmOrdinal)}`,
            `${MERIT}${merit}`,
            `${PAYS}${duty.contribution}:${duty.stones}`,
            `${PITCH}${duty.pitchOrdinal}`,
            ...(theMissionBehind(chosen.entry.id)?.at==='its_public_terminal'
                ?[`${TERM}${Math.max(0,(sworn.dueOnDay??duty.dueOnDay)-sworn.incurredOnDay)}`]:[]),
            ...(there ? [ARRIVED] : [])
        ]
    });
    const due = record.dueOnDay ?? duty.dueOnDay;
    const lines = [
        theMissionBehind(chosen.entry.id)?.at==='its_public_terminal'&&!there
            ?`You take up the post: ${chosen.entry.name}. Reach it before day ${due}; its ${tagged(record,TERM)} days of service begin there.`
            :`You take up the post: ${chosen.entry.name}. It runs to day ${due}.`,
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
    const termDays = Math.max(1, tagged(record,TERM)===null?due-record.incurredOnDay:aNumber(tagged(record,TERM)));
    const daysLeft = Math.max(0, due - leftFrom);
    const [contribution, stones] = (tagged(record, PAYS) ?? '0:0').split(':').map(aNumber);
    // The share of the term's contribution a stretch of it earns, on the post's own curve.
    const meritFor = (days: number): number =>
        record.tags.includes(HALL_SERVICE)
            ? hallServiceWorth(aNumber(tagged(record, PITCH)), days, JSON.parse(postTag(record, 'post-calendar:')!).rota)
            : Math.round(contribution! * theDaysAPostsMeritCounts(days) / theDaysAPostsMeritCounts(termDays));
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
        whatTheRestWasWorth: contribution! - meritFor(termDays - daysLeft),
        daysLeft,
        termDays
    });
    const db = game.repos.db as unknown as DatabaseHandle;
    const what = `${title.charAt(0).toLowerCase()}${title.slice(1)}`;
    if (verdict.welcome) {
        // PAID FOR THE DAYS SERVED: stones at the monthly rate, and contribution on the same
        // curve the whole term was priced on (`theDaysAPostsMeritCounts`).
        const served = Math.max(0, termDays - daysLeft);
        const paidContribution = Math.max(0, meritFor(served) - (record.tags.includes(HALL_SERVICE)
            ? Number(postTag(record, 'post-credited:') ?? 0) : 0));
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
    const answers = missionPostsHeld(game, cultivator.id)
        .map(record => settleThisMissionPost(game, cultivator, record))
        .filter((answer): answer is WhatThePostDid => answer !== null);
    return answers.length === 0 ? null : {
        lines: answers.flatMap(answer => answer.lines), structure: answers.flatMap(answer => answer.structure)
    };
}

function settleThisMissionPost(game: GameService, cultivator: Cultivator, record: ObligationRecord): WhatThePostDid | null {
    if (record.tags.includes(HALL_SERVICE)) return settleYourHallService(game, cultivator, record,
        (word, day, how, leftFrom) => thePostIsLeft(game, cultivator, word, day, how, leftFrom));
    const world = game.atHand!;
    const { title, houseName, place, mission } = thePost(world, record);
    const today = mission?.at==='its_public_terminal'?game.currentRun().run.elapsedDays:Math.floor(game.currentRun().run.elapsedDays);
    const due = record.dueOnDay ?? today;
    const contractId = tagged(record, CONTRACT);
    if (contractId !== null) {
        settleHiredDuties(world, Math.floor(world.currentDay));
        game.theWorldMoved();
        const contract = world.obligations.find(row => row.id === contractId);
        if (contract?.status === 'open') return null;
        if (contract?.settlement?.resolution !== 'oath_fulfilled') {
            // The house judges the unserved term when the work is due.
            if (today < due) return null;
            game.repos.db.transaction(() => {
                writeOneObligation(game.repos.db as unknown as DatabaseHandle, settleObligation(record, {
                    resolution: 'broken', onDay: today, byId: cultivator.id,
                    note: 'The hired duty was not served.'
                }));
                if (record.subjectId !== null) writeOneObligation(game.repos.db as unknown as DatabaseHandle, createObligation({
                    kind: 'grudge', holderId: record.subjectId, subjectId: cultivator.id,
                    cause: 'broken_oath', severity: record.severity, onDay: today,
                    description: `${cultivator.name}'s hired duty for ${houseName} was not served.`,
                    tags: ['duty', 'failed', record.id]
                }));
            })();
            return { lines: [`The hired work was not done. ${houseName} records the failure against you.`],
                structure: [`${record.id} broken; contractor term ${contractId} failed; member answerable.`] };
        }
    }
    const at = place === null || standsAtThePost(world, game.worldPlaceOf(cultivator), place,
        mission?.at==='its_public_terminal');
    const arrived = record.tags.includes(ARRIVED);

    // Actual departure is read before a reached deadline can declare service complete.
    if (contractId === null && arrived && !at) {
        return thePostIsLeft(game, cultivator, record, today, 'by walking away from it');
    }

    // NEVER TAKEN UP: the whole term was left.
    if (journeyTimeHasReached(today,due) && !arrived) return thePostIsLeft(game, cultivator, record, today, 'by never reaching it', record.incurredOnDay);
    if (!arrived && at && mission?.at==='its_public_terminal') {
        const servedUntil=today+(tagged(record,TERM)===null?mission.days:aNumber(tagged(record,TERM)));
        writeOneObligation(game.repos.db as unknown as DatabaseHandle,{...record,dueOnDay:servedUntil,tags:[...record.tags,ARRIVED]});
        return {lines:[`You are at your post, until day ${servedUntil}: ${title.charAt(0).toLowerCase()}${title.slice(1)}.`],
            structure:[`${record.id} reached on day ${today}; its full terminal service runs to ${servedUntil}.`]};
    }
    if (journeyTimeHasReached(today,due)) {
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
    return null;
}

/** Hire a person in this area to serve the rest of the member's standing post. */
export function hireForYourDuty(game: GameService, run: Run, cultivator: Cultivator, target?: string): Execution {
    const world = game.atHand;
    const record = theMissionPostTheyHold(game, cultivator.id);
    const no = (line: string) => refused('encounters.hireForYourDuty', 'sect',
        factsForRefusal('No hire agreed.', line, 'No new contractor was hired or paid.'));
    if (!world) return no('There is nobody here to hire.');
    // Finish an expired hire before another one replaces the worker's activity.
    settleHiredDuties(world, routineTime(world));
    game.theWorldMoved();
    if (!record) return no('Take a mission for subcontracting at the board before hiring somebody to serve it.');
    if (tagged(record, CONTRACT) !== null) return no('Somebody is already hired for this post.');
    const party = game.partyPutTo(cultivator, target ?? '', game.scopeFor(cultivator),
        game.somebodyAtHand(target ?? '', cultivator));
    const workerAt = world.npcs.findIndex(n => n.id === party?.id);
    const worker = world.npcs[workerAt];
    if (!worker || worker.id === cultivator.id || worker.status !== 'alive'
        || !game.present(cultivator).some(p => p.id === worker.id)) return no('The person you would hire is not here.');
    if (whatTheyCannotPutDown(worker, cultivator.id, Math.floor(world.currentDay))) {
        return no('They are already committed to other work.');
    }
    const { place, title, houseName, mission } = thePost(world, record);
    if (!place || !standsAtThePost(world, worker.locationId, place,mission?.at==='its_public_terminal' || record.tags.includes(HALL_SERVICE))) return no('The contractor must reach the post before taking it over.');
    const today = record.tags.includes(HALL_SERVICE) ? run.elapsedDays : Math.floor(run.elapsedDays);
    const days = (record.dueOnDay ?? today) - today;
    if (days <= 0) return no('The term has already ended.');
    const [contribution, stones] = (tagged(record, PAYS) ?? '0:0').split(':').map(aNumber);
    const fraction = days / Math.max(1, (record.dueOnDay ?? today) - record.incurredOnDay);
    const price = whatTheyWouldDoItFor({
        days, stones: Math.round(stones! * fraction), contribution: Math.round(contribution! * fraction),
        pitchOrdinal: aNumber(tagged(record, PITCH))
    }, { id: worker.id, ordinal: worker.cultivation.realmOrdinal, spiritStones: worker.spiritStones ?? 0 });
    if (cultivator.spiritStones < price.askStones) return no(`They ask ${price.askStones} spirit stones; you hold ${cultivator.spiritStones}.`);
    const worldDay = record.tags.includes(HALL_SERVICE) ? routineTime(world) : Math.floor(world.currentDay);
    const contract = createObligation({
        kind: 'oath', holderId: worker.id, subjectId: cultivator.id, cause: 'service_term',
        severity: record.severity, onDay: worldDay, dueOnDay: worldDay + days,
        description: `${worker.name} was hired to serve ${title} for ${cultivator.name}.`,
        tags: ['hired-duty', ...(record.tags.includes(HALL_SERVICE) ? ['hall-duty', `hall-job:${witnessIndexFor(world).byId.get(record.triggeringEventId ?? '')?.data.job ?? ''}`] : []), `${AT}${worker.locationId}`, record.id]
    });
    game.repos.db.transaction(() => {
        game.repos.cultivators.applyDeltas(cultivator.id, { spiritStones: -price.askStones });
        writeOneObligation(game.repos.db as unknown as DatabaseHandle, {
            ...record, tags: [...record.tags.filter(t => t !== ARRIVED), ARRIVED, `${CONTRACT}${contract.id}`]
        });
        world.obligations.push(contract);
        world.npcs[workerAt] = { ...worker, spiritStones: (worker.spiritStones ?? 0) + price.askStones,
            activity: { kind: 'stationed', note: `Serving ${title} for ${cultivator.name}.`, withIds: [],
                sinceDay: worldDay, untilDay: worldDay + days } };
        if (record.tags.includes(HALL_SERVICE)) {
            theOneBeingPlayedLeavesThePost(world, { playerId: cultivator.id, today: world.currentDay });
            world.npcs[workerAt]!.activity!.houseWorkSchedule = JSON.parse(postTag(record, 'post-calendar:')!);
        }
        game.theWorldMoved();
    })();
    game.theyGaveTheirName(cultivator, run, worker);
    const lines = [`${worker.name} takes over ${title} for ${days} days, for ${price.askStones} spirit stones.`,
        whoAnswersForItAfterwards(cultivator.name, houseName)];
    const facts = factsForToolResult('Contractor hired.', lines);
    facts.structure.push(`Contract ${contract.id}; member oath ${record.id}; ${price.askStones} stones transferred.`);
    return game.freeAction(run, 'sect', facts);
}

/** Saying they leave the post, or null where they hold none. */
export function leaveTheMissionPost(game: GameService, run: Run, cultivator: Cultivator): Execution | null {
    let record = theMissionPostTheyHold(game, cultivator.id);
    if (record === null) return null;
    const earned = record.tags.includes(HALL_SERVICE) ? settleYourHallService(game, cultivator, record,
        (word, day, how, leftFrom) => thePostIsLeft(game, cultivator, word, day, how, leftFrom)) : null;
    record = theMissionPostTheyHold(game, cultivator.id);
    if (!record) {
        const facts = factsForToolResult('Off post.', earned?.lines ?? []);
        return game.freeAction(run, 'oath', facts);
    }
    const left = thePostIsLeft(game, cultivator, record, record.tags.includes(HALL_SERVICE) ? run.elapsedDays : Math.floor(run.elapsedDays), 'by saying so');
    if (earned) { left.lines.unshift(...earned.lines); left.structure.unshift(...earned.structure); }
    const world = game.atHand;
    if (world && record.tags.includes(HALL_SERVICE)) {
        theOneBeingPlayedLeavesThePost(world, { playerId: cultivator.id, today: world.currentDay });
        game.theWorldMoved();
    }
    const contractAt = world?.obligations.findIndex(row => row.id === tagged(record, CONTRACT)) ?? -1;
    const contract = world?.obligations[contractAt];
    if (world && contract?.status === 'open') {
        world.obligations[contractAt] = settleObligation(contract, {
            resolution: 'oath_released', onDay: Math.floor(world.currentDay), byId: cultivator.id,
            note: 'The member ended the post and released the contractor.'
        });
        const at = world.npcs.findIndex(n => n.id === contract.holderId);
        const worker = world.npcs[at];
        if (worker?.activity?.kind === 'stationed' && worker.activity.sinceDay === contract.incurredOnDay
            && worker.activity.untilDay === contract.dueOnDay) world.npcs[at] = { ...worker, activity: null };
        game.theWorldMoved();
    }
    const facts = factsForToolResult('Off post.', left.lines);
    facts.required = left.lines.slice();
    facts.structure.push(...left.structure);
    return game.freeAction(run, 'oath', facts);
}
