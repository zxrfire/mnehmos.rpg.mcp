/** Private hunters meet a real beast and keep the actual pickups, without institutional credit. */
import type { WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import { isTheWorldsToMove, maxBodyOf, bodyStandingOn, theWorldMayEnd } from './npc-state.js';
import type { HistoricalFact } from './history.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { LocationRecord } from './locations.js';
import { pathTo, reachThrough } from './architecture.js';
import { theDoorKeysTheyActuallyCarry } from './door-key-custody.js';
import { whatGroundThisIs } from './what-ground-a-place-is.js';
import { whatIsOnThisGround, whatComesOffTheBody, bandOf } from './hunting-a-spirit-beast.js';
import { standUpTheOneOnThisGround, theOnesInParticularAt, idOfTheOneOnThisGround, theSpeciesItIs } from './a-beast-with-a-core-is-somebody-in-particular.js';
import { aPieceOfABodyNobodyHasTaken } from './a-beast-that-climbs-also-fights-and-dies.js';
import { combatantOf } from './gatherings.js';
import { resolveMelee, OUTCOME_FOR_FATE } from '../cultivation/combat.js';
import { A_BLOW_MEANT_TO_END_IT } from '../cultivation/how-a-blow-was-thrown.js';
import { forStream } from '../cultivation/rng.js';
import { whatTheConfrontationDidToThem, whatTheirFlightsCost } from './what-a-confrontation-does-to-somebody-the-world-holds.js';
import { writeTheNpcArtsActuallyUsed } from './the-arts-an-npc-actually-uses-in-a-fight.js';
import { whoBurnedATeleportationTalisman } from './a-talisman-is-one-act-somebody-already-paid-for.js';
import { aBreakingEntersTheWorld } from './a-thing-somebody-ended-is-a-fact.js';
import { oneAccountEach } from './what-a-change-of-hands-leaves.js';
import { createObligation, type ObligationInput } from '../social/grudges.js';
import { collectPrivatePartyFinds } from './private-party-finds.js';
import { playerAtTheContact } from './background-incident-draw.js';
import { putTheRouteToTheParty } from './a-party-answers-its-leader.js';

/** Background company resolves here; a met human party hands the real beast to shared combat. */
export function finishPrivatePartyHunt(state: WorldState, mission: HistoricalFact,
    members: NpcRecord[], venue: LocationRecord, day: number): NpcRecord[] {
    const currentRows = (people: readonly NpcRecord[]) => people.map(person =>
        state.npcs.find(row => row.id === person.id) ?? person);
    if (state.history.facts.some(fact => fact.data.privateHuntResolved === mission.id))
        return members.map(person => state.npcs.find(row => row.id === person.id)!).filter(person => person.status === 'alive');
    const pending = state.history.facts.find(fact => fact.data.privateHuntPending === mission.id);
    if (pending && members.some(person => person.status === 'alive' && !isTheWorldsToMove(person))) return members;
    const clock = { ...state, currentDay: Math.floor(day), currentHour: (day % 1) * 24 };
    const contact = playerAtTheContact(state);
    const party = members.filter(person => person.status === 'alive' && (person.locationId === venue.id
        || !isTheWorldsToMove(person) && contact?.id === person.id && contact.placeId === venue.id));
    if (!party.length || party.some(person => reachThrough(pathTo(state.locations, venue.id), {
        realmOrdinal: person.cultivation.realmOrdinal, onDay: day,
        keyIds: theDoorKeysTheyActuallyCarry(state.objects, person.id) }).stoppedAt !== null)) return members;
    const particular = theOnesInParticularAt(state.npcs, venue.id);
    const standingAt = new Map(particular.map(one => [one.species.id, one.asItStands.ordinal]));
    const gone = new Set(state.npcs.filter(person => person.status !== 'alive'
        && person.locationId === venue.id).flatMap(person => {
            const species = theSpeciesItIs(person);
            return species && person.id === idOfTheOneOnThisGround(species.id, venue.id) ? [species.id] : [];
        }));
    const rng = forStream(state.seed, 'private-hunt-beast', mission.id);
    const ground = whatIsOnThisGround({ sealed: venue.sealed, onAVein: venue.kind === 'vein',
        grounds: whatGroundThisIs(state, venue) ?? undefined }, Math.max(...party.map(person => person.cultivation.realmOrdinal)), rng.next(), { standingAt, gone });
    const pendingBeast = pending && state.npcs.find(person => person.id === pending.data.beastId
        && person.status === 'alive' && person.locationId === venue.id);
    const species = pending ? pendingBeast && theSpeciesItIs(pendingBeast)
        : ground.met ?? (ground.worthGoingAfter.length ? rng.pick([...ground.worthGoingAfter]) : null);
    if (!species) {
        appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: venue.id,
            causes: [mission.id], actors: party.map(person => ({ id: person.id, name: person.name, role: 'hunter' })),
            summary: 'The private hunt found no reachable beast.', data: { privateHuntResolved: mission.id, missionWork: mission.id, finished: false } }),
            { recur: false, bystanders: false });
        return currentRows(party);
    }
    const beastId = pendingBeast?.id ?? (bandOf(species) === 'counted' ? `npc-private-hunt:${mission.id}` : idOfTheOneOnThisGround(species.id, venue.id));
    let beast = state.npcs.find(person => person.id === beastId);
    if (!beast) {
        beast = { ...standUpTheOneOnThisGround({ beast: species, locationId: venue.id, seed: state.seed, onDay: day,
            takenNames: new Set(state.npcs.map(person => person.name)) }), id: beastId };
        state.npcs.push(beast);
    }
    if (party.some(person => !isTheWorldsToMove(person))) {
        const pending = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: venue.id,
            causes: [mission.id], actors: party.map(person => ({ id: person.id, name: person.name, role: 'hunter' })),
            summary: `The private hunting party met ${beast.name}.`,
            data: { privateHuntPending: mission.id, beastId: beast.id } }), { recur: false, bystanders: false });
        putTheRouteToTheParty(state, String(mission.data.leaderId), contact!.id, day, pending.id,
            `The private hunt has met ${beast.name}. Continue the hunt, rest or turn back?`);
        return currentRows(members);
    }
    const inputs = [...party, beast].map(person => combatantOf(person, clock));
    const byId = new Map([...party, beast].map(person => [person.id, person]));
    const result = resolveMelee([{ id: mission.id, name: 'The private hunting party', members: inputs.slice(0, -1) },
        { id: beast.id, name: beast.name, members: [inputs[inputs.length - 1]] }], {
        rng: forStream(state.seed, 'private-hunt-melee', mission.id), ambient: 'normal', turn: 1,
        intent: { thrown: A_BLOW_MEANT_TO_END_IT } });
    writeTheNpcArtsActuallyUsed(state, result.exchanges, `private-hunt:${mission.id}`, day);
    const escaped = new Set(whoBurnedATeleportationTalisman({ objects: state.objects, onDay: day,
        aboutToFall: result.combatants.filter(person => (person.fate === 'finished' || person.fate === 'body_destroyed')
            && theWorldMayEnd(byId.get(person.id)!)).map(person => person.id) }));
    const accounts: ObligationInput[] = [];
    for (const verdict of result.combatants) {
        const attacker = byId.get(verdict.felledBy ?? ''), original = byId.get(verdict.id)!;
        const mayEnd = theWorldMayEnd(original), withdrew = escaped.has(verdict.id) || !mayEnd && verdict.finished;
        const applied = whatTheConfrontationDidToThem(state, { npcId: verdict.id, byId: attacker?.id ?? beast.id,
            byName: attacker?.name ?? beast.name, day, wounds: verdict.injuries,
            outcome: withdrew ? 'withdrawal' : OUTCOME_FOR_FATE[verdict.fate], lost: verdict.felledBy !== null,
            finished: verdict.finished && mayEnd && !withdrew, terms: 'open', witnesses: Math.max(0, party.length - 1),
            flight: whatTheirFlightsCost(result.exchanges, verdict.id, inputs.find(person => person.id === verdict.id)!.maxHp) });
        accounts.push(...applied.opens);
        const at = state.npcs.findIndex(person => person.id === verdict.id), current = state.npcs[at];
        if (current.status === 'alive') {
            const scale = inputs.find(person => person.id === verdict.id)!.maxHp;
            state.npcs[at] = { ...current, cultivation: { ...current.cultivation,
                hp: Math.min(bodyStandingOn(current, day), Math.max(1, maxBodyOf(current) * verdict.hp / scale)), bodyOnDay: day }, updatedOnDay: day };
        }
    }
    state.obligations.push(...oneAccountEach(accounts).map(account => createObligation(account)));
    for (const exchange of result.exchanges) {
        const weapon = exchange.result.weapon;
        const object = weapon?.broke && state.objects.find(object => object.id === weapon.objectId);
        if (object) aBreakingEntersTheWorld(state, { actor: { id: exchange.attackerId,
            name: byId.get(exchange.attackerId)?.name ?? '', role: 'broke it' }, object, day, locationId: venue.id,
            how: `Broken in the private hunt: ${weapon!.exposure.cause}.` });
    }
    const killed = state.npcs.find(person => person.id === beast!.id)!.status === 'physically_dead';
    const survivors = party.map(person => state.npcs.find(row => row.id === person.id)!).filter(person => person.status === 'alive');
    const pieces = [];
    if (killed && survivors.length) for (const { material } of whatComesOffTheBody({ beast: species,
        takerOrdinal: Math.max(...survivors.map(person => person.cultivation.realmOrdinal)), killed }).taken) {
        const piece = aPieceOfABodyNobodyHasTaken({ npcId: beast.id, material, asItStands: species, itsName: beast.name,
            locationId: venue.id, placeName: venue.name, onDay: day, endedBy: 'Killed in the private hunt.' });
        if (!state.objects.some(object => object.id === piece.id)) state.objects.push(piece);
        pieces.push(state.objects.find(object => object.id === piece.id)!);
    }
    const fact = appendWorldFact(state, makeFact({ day, kind: 'opportunity', visibility: 'secret', locationId: venue.id,
        causes: [mission.id], actors: result.combatants.map(person => ({ id: person.id, name: person.name, role: person.fate })),
        summary: `The private hunt of ${beast.name} ended: ${result.outcome}.`,
        data: { privateHuntResolved: mission.id, missionWork: mission.id, finished: killed } }), { recur: false, bystanders: false });
    if (killed) collectPrivatePartyFinds(state, venue.id, survivors, String(mission.data.leaderId), day, fact.id, false, pieces);
    return currentRows(survivors);
}
