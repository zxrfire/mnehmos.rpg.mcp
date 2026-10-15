/** Plague reads and changes the SQL body; a world mirror supplies no illness or health. */
import type { GameService } from './turn-engine.js';
import { activePlague, contractPlague, plagueHealthCeiling, plagueHasBecomeFatal,
    plagueSusceptibility, PLAGUE_COURSE_DAYS } from '../engine/cultivation/plague.js';
import { plagueHere, beginPlagueOutbreak, exposeOneToPlague, settleNativePlague } from '../engine/world/plague-in-a-place.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { isTheWorldsToMove } from '../engine/world/npc-state.js';
import { forStream } from '../engine/cultivation/rng.js';
import { makeFact } from '../engine/world/history.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { describeDeath } from '../engine/cultivation/survival.js';
import { getLocation } from '../engine/world/world-state.js';
import { isStatusRunningOn } from '../engine/world/what-is-true-of-a-place-right-now.js';
import type { Cultivator } from '../schema/cultivation.js';

/** Native MCP borrows the same reader without constructing a second game service. */
export type ActualPlagueServices = Pick<GameService, 'atHand' | 'currentRun' | 'repos' | 'db' | 'worldPlaceOf' | 'theWorldMoved'>
    & { present?(body: Cultivator): readonly { id: string }[] };

/** Contact and real span boundaries use this same exact reader. Returned lines contain no future outcome. */
export function settlePlagueOnActualBody(game: ActualPlagueServices): string[] {
    const world = game.atHand;
    if (!world) return [];
    const now = routineTime(world), life = game.currentRun();
    let body = game.repos.cultivators.getById(life.cultivator.id);
    if (!body?.alive) return [];
    // With no course and no outbreak there is nothing to settle or transmit.
    // Keep this read outside a write transaction, including ordinary reads.
    if (!body.plague && !world.npcs.some(person => person.cultivation.plague)
        && !world.statuses.some(status => status.kind === 'plague' && isStatusRunningOn(status, now))) return [];
    const lines: string[] = [], beforeFacts = world.history.facts.length;
    game.db.transaction(() => {
        for (const person of world.npcs.filter(person => person.cultivation.plague)) settleNativePlague(world, person.id, now);
        const placeId = game.worldPlaceOf(body!);
        let outbreak = plagueHere(world, placeId, now);
        const course = body!.plague;
        const origin = course && world.statuses.find(status => status.id === course.outbreakId);
        const atOrigin = (() => {
            const seen = new Set<string>();
            let place = getLocation(world, placeId ?? '');
            while (place && !seen.has(place.id)) {
                if (place.id === origin?.areaId) return true;
                seen.add(place.id); place = place.parentId ? getLocation(world, place.parentId) : null;
            }
            return false;
        })();
        if (course && origin && !isStatusRunningOn(origin, now) && atOrigin
            && (course.fatalOnDay === null || origin.liftedOnDay !== null && origin.liftedOnDay < course.fatalOnDay)) {
            game.repos.cultivators.update(body!.id, { plague: null });
            lines.push('Your plague ended with the local outbreak.');
        } else if (course && plagueHasBecomeFatal(body!, now)) {
            game.repos.cultivators.markDead(body!.id, 'plague', life.run.turn, describeDeath('plague', body!));
            lines.push('You died of plague.');
        } else if (course && (plagueSusceptibility(body!) === 0 || now >= course.endsOnDay)) {
            game.repos.cultivators.update(body!.id, { plague: null });
            lines.push('Your plague ended.');
        } else if (activePlague(body!, now) && placeId && !outbreak) {
            outbreak = beginPlagueOutbreak(world, placeId, now);
        }
        body = game.repos.cultivators.getById(body!.id);
        if (!body?.alive) { game.theWorldMoved(); return; }
        if (outbreak && !activePlague(body, now)) {
            const window = Math.floor((now - outbreak.beganOnDay) / PLAGUE_COURSE_DAYS);
            const already = body.plague?.outbreakId === outbreak.id
                && body.plague.contractedOnDay >= outbreak.beganOnDay + window * PLAGUE_COURSE_DAYS;
            const caught = already ? null : contractPlague(body, outbreak.id, now, outbreak.reviewOnDay,
                forStream(world.seed, 'plague-exposure', outbreak.id, body.id, window),
                forStream(world.seed, 'plague-course', outbreak.id, body.id, window));
            if (caught) {
                game.repos.cultivators.update(body.id, { plague: caught,
                    hp: Math.min(body.hp, plagueHealthCeiling(body.maxHp, { ...body, plague: caught }, now)) });
                appendWorldFact(world, makeFact({ day: now, kind: 'opportunity', visibility: 'secret', locationId: placeId,
                    actors: [{ id: body.id, name: body.name, role: 'stricken' }], summary: `${body.name} contracted plague.`,
                    data: { plagueInfection: true, outbreakId: outbreak.id, personId: body.id } }), { recur: false, bystanders: false });
                lines.push('Plague has begun weakening your body.');
            }
        }
        body = game.repos.cultivators.getById(body.id)!;
        if (activePlague(body, now)) {
            const ceiling = plagueHealthCeiling(body.maxHp, body, now);
            if (body.hp > ceiling) game.repos.cultivators.update(body.id, { hp: ceiling });
        }
        for (const present of game.present?.(body) ?? []) {
            const person = world.npcs.find(person => person.id === present.id && isTheWorldsToMove(person));
            if (!person) continue;
            const local = plagueHere(world, person.locationId, now);
            if (local) exposeOneToPlague(world, person.id, local.id, now);
        }
        if (lines.length || world.history.facts.length !== beforeFacts) game.theWorldMoved();
    })();
    return lines;
}

/** A reported plague encounter establishes the real outbreak at the reached ground. */
export function plagueEncounterAtActualBody(game: ActualPlagueServices): string[] {
    const world = game.atHand, body = game.currentRun().cultivator;
    const placeId = game.worldPlaceOf(body);
    if (!world || !placeId || !body.alive) return [];
    beginPlagueOutbreak(world, placeId, routineTime(world));
    game.theWorldMoved();
    return settlePlagueOnActualBody(game);
}
