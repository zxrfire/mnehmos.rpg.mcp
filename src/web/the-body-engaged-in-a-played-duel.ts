/** A stored duel interrupts the actual person's ordinary activity at contact. */
import type { GameService } from './turn-engine.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { StandingFight } from './fight-answers.js';
import { isTheWorldsToMove } from '../engine/world/npc-state.js';
import { routineTime } from '../engine/world/npc-routines.js';
import { theAreasOf } from '../engine/world/where-in-a-place-somebody-is-standing.js';

export function holdTheBodyInThisDuel(game: GameService, body: Cultivator, fight: StandingFight): void {
    const world = game.atHand;
    // Actual group and carrier courses retain their own engagement authority.
    if (!world || fight.foregroundParty || fight.alongside) return;
    const at = world.npcs.findIndex(person => person.id === fight.party.id);
    const person = world.npcs[at];
    if (!person || person.status !== 'alive' || !isTheWorldsToMove(person)
        || person.activity?.playedFight?.id === fight.state.id
        || !game.present(body).some(other => other.id === person.id)) return;
    const place = world.locations.find(place => place.id === person.locationId);
    if (!place) return;
    const area = theAreasOf(world, place).whereIs.get(person.id);
    if (!area) return;
    const previous = person.activity?.playedFight?.previous ?? person.activity;
    world.npcs[at] = { ...person, activity: {
        kind: 'their_own_business', note: 'In a fight.', withIds: [body.id],
        sinceDay: routineTime(world), standingIn: area,
        playedFight: { id: fight.state.id, previous }
    } };
    game.theWorldMoved();
}

export function releaseTheBodyInThisDuel(game: GameService, fight: StandingFight): void {
    const world = game.atHand;
    if (!world) return;
    const at = world.npcs.findIndex(person => person.id === fight.party.id);
    const person = world.npcs[at], activity = person?.activity;
    if (!person || !activity || activity.playedFight?.id !== fight.state.id) return;
    const previous = activity.playedFight.previous;
    const delay = Math.max(0, routineTime(world) - activity.sinceDay);
    const { playedFight, ...whereTheBodyWas } = activity;
    world.npcs[at] = { ...person, activity: person.status === 'alive'
        ? previous ? { ...previous, sinceDay: previous.sinceDay + delay,
            untilDay: previous.untilDay == null ? null : previous.untilDay + delay } : null
        : { ...whereTheBodyWas, note: '', withIds: [] } };
    game.theWorldMoved();
}
