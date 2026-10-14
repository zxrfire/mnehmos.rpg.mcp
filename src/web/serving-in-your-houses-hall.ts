/** A member requests actual hall work from Internal Affairs and keeps its ordinary duty word. */
import { realmIndexOf } from '../engine/cultivation/realms.js';
import { DAYS_PER_MONTH } from '../data/cultivation/mortal-world.js';
import { houseFloorsOf } from '../data/cultivation/the-three-floors-a-house-admits-at.js';
import { createObligation, settleObligation, type ObligationRecord } from '../engine/social/grudges.js';
import { witnessIndexFor } from '../engine/world/witness-reaction-index.js';
import { keepTheirHallCheckOnLeaving } from '../engine/world/what-the-roll-and-the-lamps-say.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { purposeOf } from '../engine/world/architecture.js';
import { HOUSE_HALLS } from '../engine/world/house-halls.js';
import { appointHouseWorker, houseAppointment, personnelManager } from '../engine/world/internal-affairs-puts-somebody-to-the-work.js';
import { hallServiceWorth } from '../engine/world/the-people-posted-to-a-houses-halls.js';
import { roomForHouseWork } from '../engine/world/where-a-house-does-its-work.js';
import { npcsWhereTheyStand } from '../engine/world/where-in-a-place-somebody-is-standing.js';
import { theSeatOfTheCompound } from '../engine/world/where-inside-a-house-somebody-is-standing.js';
import { theOneBeingPlayedLeavesThePost, theOneBeingPlayedStandsAtThisPost } from '../engine/world/a-house-posts-the-one-being-played.js';
import { settleHiredDuties } from '../engine/world/a-hired-duty-is-served.js';
import { ledgerAbout, writeOneObligation } from '../storage/repos/obligation.repo.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { factsForRefusal, factsForToolResult } from './facts.js';
import { refused } from './tool-result-prose.js';
import { positionIn } from './standing.js';
import { standInTheWorld } from './the-player-as-a-row-the-world-can-invite.js';
import { checkYourHallsRoll } from './checking-the-life-lamp-roll.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';
import type { DatabaseHandle } from './encounters.js';

export const HALL_SERVICE = 'hall-service';
export function postTag(record: ObligationRecord, prefix: string): string | null {
    return record.tags.find(tag => tag.startsWith(prefix))?.slice(prefix.length) ?? null;
}

/** A paid substitute holds the work; an unserved personal oath still occupies the member. */
export function holdsTheirBodyOnPost(word: ObligationRecord): boolean {
    return word.status === 'open' && word.kind === 'oath' && word.tags.includes('duty')
        && postTag(word, 'post-contractor-oath:') === null
        && word.tags.some(tag => tag.startsWith('post-at:') || tag.startsWith('a-posting-at:'));
}

/** Personnel requests reach a real person in the current scene. */
export function thePersonnelHolderHere(game: GameService, cultivator: Cultivator, houseId: string) {
    const world = game.atHand;
    if (!world) return null;
    const manager = personnelManager(world, houseId);
    if (!manager || manager.id === cultivator.id) return manager;
    const place = world.locations.find(row => row.id === game.worldPlaceOf(cultivator));
    return place && npcsWhereTheyStand(world, place, cultivator.standingIn, { id: cultivator.id })
        .some(person => person.id === manager.id) ? manager : null;
}

/** Named hall work is personnel work; ordinary board notices keep their existing path. */
export function requestHallService(game: GameService, run: Run, cultivator: Cultivator,
    target?: string, requestedDays?: number, nomination?: { factId?: string; sourceId: string }): Execution | null {
    const name = target?.trim().replace(/\s+(?:duty|service|work)$/i, '').toLowerCase();
    const rota = name === 'chore rota';
    const named = HOUSE_HALLS.find(hall => hall.name.toLowerCase() === name);
    if (!named && !rota && name !== 'hall service') return null;
    const no = (line: string) => refused('sect.hallService', 'sect',
        factsForRefusal('No hall appointment.', line, 'No service word or payment was made.'));
    const world = game.atHand;
    const member = positionIn(game.repos, cultivator.id);
    if (!world || !member) return no('Only a member can take the house\'s hall service.');
    const here = game.worldPlaceOf(cultivator);
    const house = world.factions.find(row => row.id === member.sectId && row.dissolvedOnDay === null);
    const compound = here ? theSeatOfTheCompound(world, here) : null;
    if (!house || here !== house.seatLocationId && compound?.id !== house.seatLocationId)
        return no('Reach your house before asking Internal Affairs for a hall appointment.');
    const ledger = ledgerAbout(game.repos.db as unknown as DatabaseHandle, cultivator.id);
    if (ledger.some(holdsTheirBodyOnPost))
        return no('Your existing post must be served or left before taking another appointment.');
    const uncovered = HOUSE_HALLS.find(row => row.chores
        && roomForHouseWork(world.locations, member.sectId, row.chores.room)
        && !world.npcs.some(person => person.factionId === member.sectId
            && person.status === 'alive' && houseAppointment(world, person)?.data.job === `menial_${row.id.replaceAll('-', '_')}`));
    const hall = named ?? (rota ? uncovered : HOUSE_HALLS.find(row => row.id === 'internal-affairs'));
    if (!hall || rota && !hall.chores) return no('The house has no uncovered chore rota to assign.');
    const purpose = rota ? hall.chores!.room : hall.id === 'internal-affairs' ? 'life_lamp_hall' : hall.rooms[0]!;
    const room = roomForHouseWork(world.locations, member.sectId, purpose);
    if (!room) return no(`The house has no place for ${hall.name}'s work.`);
    const days = requestedDays ?? DAYS_PER_MONTH;
    if (!Number.isFinite(days) || days <= 0) return no('A service term needs a positive number of days.');
    const day = routineTime(world);
    const applicant = standInTheWorld(world, cultivator, { factionId: member.sectId,
        rankIndex: member.rankIndex, contribution: member.contribution }, day);
    if (!applicant) return no('This house cannot appoint you to its lower-world hall work.');
    if (!thePersonnelHolderHere(game, cultivator, member.sectId))
        return no('The person responsible for Internal Affairs is not here to hear your request.');
    const calendar = { periodDays: rota ? 2 : 1, offset: Math.floor(day) % (rota ? 2 : 1),
        shift: 'day' as const, rota };
    const job = `${rota ? 'chores' : 'serving'}_${hall.id.replaceAll('-', '_')}`;
    const beforeReview = world.history.facts.length;
    const proposed = nomination?.factId ? witnessIndexFor(world).byId.get(nomination.factId) : null;
    const acceptedNomination = proposed?.data.houseWorkAppointment === true
        && proposed.data.houseId === member.sectId && proposed.locationId === room.id
        && proposed.actors.some(actor => actor.id === cultivator.id && actor.role === 'appointed_worker');
    const appointed = acceptedNomination ? null : appointHouseWorker(world, { houseId: member.sectId, job, room, day,
        posted: true, applicant: { ...applicant, locationId: here }, calendar, purpose,
        note: rota ? hall.chores!.work : `Serving ${hall.name}: ${hall.duties.join('; ')}.`,
        suitable: person => !rota || person.factionRankIndex === (houseFloorsOf(member.sectId)?.hasMenialTier ? 1 : 0) });
    game.theWorldMoved();
    if (!appointed && !acceptedNomination) {
        const line = 'Internal Affairs has not appointed you to that work.';
        if (world.history.facts.length === beforeReview) return no(line);
        const facts = factsForToolResult('Appointment declined.', [line]);
        facts.required = [line];
        return game.freeAction(run, 'sect', facts);
    }
    const appointmentId = acceptedNomination ? proposed!.id : appointed!.activity!.houseWorkFactId!;
    const title = rota ? `the ${hall.name} chore rota` : `service in ${hall.name}`;
    const contribution = Math.max(1, hallServiceWorth(cultivator.realmOrdinal, days, rota));
    const record = writeOneObligation(game.repos.db as unknown as DatabaseHandle, createObligation({
        kind: 'oath', holderId: cultivator.id, subjectId: member.sectId, cause: 'service_term', severity: 'serious',
        onDay: run.elapsedDays, dueOnDay: run.elapsedDays + days,
        triggeringEventId: appointmentId,
        description: `${cultivator.name} accepted ${title} for ${house.name}.`,
        tags: ['duty', HALL_SERVICE, ...(nomination ? [nomination.sourceId] : []), `post-at:${room.id}`, `post-title:${title}`,
            `post-pitch:${cultivator.realmOrdinal}`, `post-realm:${realmIndexOf(cultivator.realmOrdinal)}`,
            `post-merit:${member.contribution}`, `post-term-days:${days}`, `post-pays:${contribution}:0`,
            `post-calendar:${JSON.stringify(calendar)}`]
    }));
    const lines = [`Internal Affairs appoints you to ${title}, at ${room.name}, for ${days} days of service.`,
        `The house counts ${contribution} contribution for the term, settled as it is served.`,
        `Your service starts when you reach ${room.name}.`];
    const facts = factsForToolResult('Hall appointment accepted.', lines);
    facts.structure.push(`Hall duty ${record.id}; real body remains at ${here}; appointment ${record.triggeringEventId}.`);
    return game.freeAction(run, 'sect', facts);
}

/** Each live appointment authorises its work room, including a post hired out for the member. */
export function theHallsYourDutiesCallYouTo(game: GameService, cultivator: Cultivator): ReadonlySet<string> {
    const world = game.atHand;
    const member = game.repos.sects.getMembership(cultivator.id);
    const rooms = new Set<string>();
    if (!world || !member) return rooms;
    const day = game.currentRun().run.elapsedDays;
    for (const word of ledgerAbout(game.repos.db as unknown as DatabaseHandle, cultivator.id)) {
        if (word.status !== 'open' || word.holderId !== cultivator.id || word.subjectId !== member.sectId
            || !word.tags.includes(HALL_SERVICE)
            || word.dueOnDay !== null && word.dueOnDay <= day) continue;
        const fact = word.triggeringEventId ? witnessIndexFor(world).byId.get(word.triggeringEventId) : null;
        const room = postTag(word, 'post-at:');
        if (room && fact?.data.houseWorkAppointment === true && fact.data.houseId === member.sectId
            && fact.locationId === room && fact.actors.some(actor => actor.id === cultivator.id && actor.role === 'appointed_worker'))
            rooms.add(room);
    }
    return rooms;
}

/** SQL membership owns player pay; the world row only makes the real post visible. */
export function settleYourHallService(game: GameService, cultivator: Cultivator, record: ObligationRecord, left: (word: ObligationRecord, day: number, how: string, leftFrom?: number) => { lines: string[]; structure: string[] }): {
    lines: string[]; structure: string[];
} {
    const world = game.atHand!;
    const today = game.currentRun().run.elapsedDays;
    const here = game.worldPlaceOf(cultivator);
    const post = postTag(record, 'post-at:')!;
    const room = world.locations.find(place => place.id === post);
    const seat = theSeatOfTheCompound(world, post);
    const at = here === post || !!seat && !!here && (here === seat.id || theSeatOfTheCompound(world, here)?.id === seat.id);
    const sinceTag = postTag(record, 'post-served-since:');
    const since = sinceTag === null ? null : Number(sinceTag);
    const contractId = postTag(record, 'post-contractor-oath:');
    const due = record.dueOnDay!;
    const db = game.repos.db as unknown as DatabaseHandle;
    const lines: string[] = [], structure: string[] = [];
    const title = postTag(record, 'post-title:')!;
    const membership = game.repos.sects.getMembership(cultivator.id);
    const house = world.factions.find(row => row.id === record.subjectId && row.dissolvedOnDay === null);
    if (!house || membership?.sectId !== record.subjectId || !room) {
        writeOneObligation(db, settleObligation(record, { resolution: 'oath_released', onDay: today,
            byId: record.subjectId!, note: 'The house, membership or work room no longer supports this appointment.' }));
        theOneBeingPlayedLeavesThePost(world, { playerId: cultivator.id, today: world.currentDay });
        game.theWorldMoved();
        return { lines: ['Your hall appointment has ended. You no longer hold that work for the house.'], structure };
    }
    if (postTag(record, 'post-pause-since:') !== null) return { lines, structure };
    if (contractId) {
        settleHiredDuties(world, world.currentDay);
        const contract = world.obligations.find(word => word.id === contractId);
        if (contract?.status === 'open') return { lines, structure };
        if (contract?.settlement?.resolution !== 'oath_fulfilled') {
            writeOneObligation(db, settleObligation(record, { resolution: 'broken', onDay: today,
                byId: cultivator.id, note: 'The hired hall duty was not served.' }));
            writeOneObligation(db, createObligation({ kind: 'grudge', holderId: record.subjectId!, subjectId: cultivator.id,
                cause: 'broken_oath', severity: record.severity, onDay: today,
                description: `${cultivator.name}'s hired hall duty was not served.`, tags: ['duty', 'failed', record.id] }));
            game.theWorldMoved();
            return { lines: ['The hired hall duty was not served. The house records the failure against you.'], structure };
        }
    } else if (since === null) {
        if (here !== post) {
            return today >= due ? left(record, today, 'by never reaching the hall post', record.incurredOnDay) : { lines, structure };
        }
        const term = Number(postTag(record, 'post-term-days:'));
        const offset = world.currentDay - today;
        const reached = { ...record, dueOnDay: today + term,
            tags: [...record.tags, 'post-arrived', `post-served-since:${today}`] };
        writeOneObligation(db, reached);
        theOneBeingPlayedStandsAtThisPost(world, { playerId: cultivator.id, houseId: record.subjectId!,
            townId: post, sinceDay: world.currentDay, untilDay: reached.dueOnDay + offset });
        const worker = world.npcs.find(person => person.id === cultivator.id);
        if (worker?.activity) {
            worker.activity.houseWorkFactId = record.triggeringEventId!;
            worker.activity.houseWorkSchedule = JSON.parse(postTag(record, 'post-calendar:')!);
        }
        game.theWorldMoved();
        return { lines: [`You begin ${title} at ${room?.name}, until day ${reached.dueOnDay}.`], structure };
    }
    const through = Math.min(today, due);
    const rota = JSON.parse(postTag(record, 'post-calendar:')!).rota === true;
    const calculated = hallServiceWorth(Number(postTag(record, 'post-pitch:')),
        Math.max(0, through - (since ?? record.incurredOnDay) - Number(postTag(record, 'post-paused-days:') ?? 0)), rota);
    const quoted = Number((postTag(record, 'post-pays:') ?? '0:0').split(':')[0]);
    const earned = today >= due ? Math.max(calculated, quoted) : calculated;
    const already = Number(postTag(record, 'post-credited:') ?? 0);
    if (earned > already) {
        game.repos.sects.addContribution(record.subjectId!, cultivator.id, earned - already);
        lines.push(`The house counts ${earned - already} contribution for ${title}.`);
    }
    let next = { ...record, tags: [...record.tags.filter(tag => !tag.startsWith('post-credited:')), `post-credited:${earned}`] };
    if (!contractId && !at) {
        const ended = left(next, today, 'by leaving the compound');
        theOneBeingPlayedLeavesThePost(world, { playerId: cultivator.id, today: world.currentDay });
        game.theWorldMoved();
        return { lines: [...lines, ...ended.lines], structure: [...structure, ...ended.structure] };
    }
    if (today >= due) {
        next = settleObligation(next, { resolution: 'oath_fulfilled',
            onDay: today, byId: cultivator.id, note: 'The hall term was served.' });
        theOneBeingPlayedLeavesThePost(world, { playerId: cultivator.id, today: world.currentDay });
        game.theWorldMoved();
        lines.push(`Your ${title} term is served.`);
    } else if (!contractId && room && purposeOf(room) === 'life_lamp_hall' && here === post) {
        const checked = checkYourHallsRoll(game, cultivator, record.subjectId!);
        if (checked) { lines.push(...checked.lines); structure.push(...checked.structure); }
    }
    writeOneObligation(db, next);
    return { lines, structure };
}

/** Lying still for paid care suspends the duty rather than earning service for it. */
export function pauseYourHallServiceForCare(game: GameService, cultivator: Cultivator): string | null {
    const world = game.atHand;
    if (!world) return null;
    const word = ledgerAbout(game.repos.db as unknown as DatabaseHandle, cultivator.id).find(row =>
        row.status === 'open' && row.tags.includes(HALL_SERVICE) && !postTag(row, 'post-contractor-oath:')
        && postTag(row, 'post-served-since:') !== null && postTag(row, 'post-pause-since:') === null);
    if (!word) return null;
    const today = game.currentRun().run.elapsedDays;
    writeOneObligation(game.repos.db as unknown as DatabaseHandle,
        { ...word, tags: [...word.tags, `post-pause-since:${today}`] });
    const worker = world.npcs.find(person => person.id === cultivator.id);
    if (worker?.activity) {
        keepTheirHallCheckOnLeaving(world, worker, world.currentDay);
        // Retain the appointment, but no longer present a patient as working in the hall.
        worker.activity = { ...worker.activity, kind: 'the_work_of_their_rank', note: 'Under paid clinical care.' };
    }
    game.theWorldMoved();
    return word.id;
}

/** Resume from the actual care endpoint; the service term still owes those days. */
export function resumeYourHallServiceAfterCare(game: GameService, cultivator: Cultivator, wordId: string | null): string[] {
    if (!wordId || !game.atHand) return [];
    const world = game.atHand;
    const word = ledgerAbout(game.repos.db as unknown as DatabaseHandle, cultivator.id).find(row => row.id === wordId);
    const paused = word && postTag(word, 'post-pause-since:');
    if (!word || word.status !== 'open' || paused === null || paused === undefined) return [];
    const today = game.currentRun().run.elapsedDays;
    const days = Math.max(0, today - Number(paused));
    const next = { ...word, dueOnDay: word.dueOnDay === null ? null : word.dueOnDay + days,
        tags: [...word.tags.filter(tag => !tag.startsWith('post-pause-since:') && !tag.startsWith('post-paused-days:')),
            `post-paused-days:${Number(postTag(word, 'post-paused-days:') ?? 0) + days}`] };
    writeOneObligation(game.repos.db as unknown as DatabaseHandle, next);
    if (cultivator.alive) {
        theOneBeingPlayedStandsAtThisPost(world, { playerId: cultivator.id, houseId: word.subjectId!,
            townId: postTag(word, 'post-at:')!, sinceDay: world.currentDay,
            untilDay: world.currentDay + (next.dueOnDay ?? today) - today });
        const worker = world.npcs.find(person => person.id === cultivator.id);
        if (worker?.activity) {
            worker.activity.houseWorkFactId = word.triggeringEventId!;
            worker.activity.houseWorkSchedule = JSON.parse(postTag(word, 'post-calendar:')!);
        }
    }
    game.theWorldMoved();
    return [`Your hall service was suspended for ${days} days of care. Its term now runs to day ${next.dueOnDay}.`];
}
