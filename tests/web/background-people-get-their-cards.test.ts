/** The 8210cf97 thirty/three-hundred-year played setup timed out at900s.
 * The shared predicate describes the actual contact inputs: an unreacted
 * living witness, and an old local house member whose life and ties remain.
 * Reachability samples genuine source-keyed250/300-year worlds across two seeds.
 * Arranged native people/facts and a real sample pass into the SAME move/talk
 * scenario. No setup walk or increased timeout is needed. The old card's age
 * is completed years; the earlier316versus316.593 comparison mixed units.
 * A public conversation needs one actual hour that survives the move/reply,
 * not the previous conjunction of three different morning routines. The
 * scenario waits for that same predicate-derived hour through ordinary play. */
import { expect, it } from 'vitest';
import { makeGame, ScriptedProvider } from './harness.js';
import { activeWorld } from '../../src/server/state/cultivation-world.js';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import { WorldStateRepository } from '../../src/storage/repos/world-state.repo.js';
import { sampledWorld } from '../support/sampled-world.js';
import { seedWorld } from '../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../src/engine/world/catalog.js';
import { makeFaction, type WorldState } from '../../src/engine/world/world-state.js';
import { createNpc, setRealm, upsertRelationship, carryingWounds } from '../../src/engine/world/npc-state.js';
import { makeFact } from '../../src/engine/world/history.js';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened.js';
import { actorAndVictimOf, observationOf, witnessReactions } from '../../src/engine/world/witness-reactions.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from '../../src/engine/world/what-one-of-the-worlds-own-people-knows.js';
import { rankName } from '../../src/engine/cultivation/realms.js';
import { LESSER_ACTION_DAYS } from '../../src/web/lesser-action-costs.js';
import { routineTime } from '../../src/engine/world/npc-routines.js';
import type { ProviderCallOpts } from '../../src/agent/provider/types.js';

class ContactProvider extends ScriptedProvider {
    plan: { action: string; target: string; days?: number } = { action: 'talk', target: '' };
    override async call(opts: ProviderCallOpts) {
        const result = await super.call(opts);
        if (opts.messages.some(message => message.role === 'system' && message.content.startsWith('You are the intent router'))) {
            const text = JSON.stringify(this.plan);
            return { ...result, text, raw: text };
        }
        return result;
    }
}

async function cardScenario(startingWorld: WorldState) {
    expect(isABackgroundCardState(startingWorld)).toBe(true);
    const provider = new ContactProvider({
        narrations: ['The person answers from what they remember.'] });
    const h = makeGame({ worldEnabled: true, seed: 'card-contact', adminMode: true, provider });
    new WorldStateRepository(h.db).saveWorld(startingWorld);
    resetCultivationWorlds();
    try {
        const world = (await activeWorld()).state;
        h.game.atHand = world;
        expect(isABackgroundCardState(world)).toBe(true);
        const people = new Map(world.npcs.map(person => [person.id, person]));
        const missed = world.history.facts.flatMap(fact => {
            const parties = actorAndVictimOf(fact);
            if (!parties || observationOf(fact).wrong === null || !observationOf(fact).sawAct
                || people.get(parties.actorId)?.status !== 'alive') return [];
            return fact.witnessIds.filter(id => id !== parties.actorId && id !== parties.victimId
                && people.get(id)?.status === 'alive' && people.get(id)?.locationId !== null
                && people.get(id)!.cultivation.lifespanEndsOnDay > world.currentDay + 3
                && !witnessReactions(world, parties.actorId, id).some(row => row.fact.id === fact.id))
                .map(id => ({ fact, person: people.get(id)!, actorId: parties.actorId }));
        });
        expect(missed.length, 'the background draw leaves a surviving real witness to meet').toBeGreaterThan(0);
        const { cultivator } = await h.game.newRun('Reader');
        const waitForContact = async (id: string) => {
            for (let attempt = 0; attempt < 8; attempt++) {
                const hours = publicConversationHours(world, id);
                expect(hours.length, 'the shared contact precondition still holds').toBeGreaterThan(0);
                const hour = (routineTime(world) % 1) * 24;
                const gap = Math.min(...hours.map(at => (at - hour + 24) % 24));
                if (gap < 1e-6) return;
                provider.plan = { action: 'wait', target: '', days: gap / 24 };
                await h.game.act('I wait for the public contact hour');
            }
            throw new Error('Repeated ordinary waits did not reach a public contact hour.');
        };
        const areaAfter = (id: string, days: number) => {
            const person = world.npcs.find(npc => npc.id === id)!;
            const place = world.locations.find(row => row.id === person.locationId)!;
            const time = routineTime(world) + days;
            const read = theAreasOf({ ...world, currentDay: time, currentHour: (time % 1) * 24 }, place);
            return read.areas.find(row => row.id === read.whereIs.get(id));
        };
        const staysForConversation = (id: string) => {
            const arrival = areaAfter(id, LESSER_ACTION_DAYS.move);
            const reply = areaAfter(id, LESSER_ACTION_DAYS.move + LESSER_ACTION_DAYS.interact);
            return arrival !== undefined && arrival.for !== 'room' && arrival.id === reply?.id;
        };
        const chosen = [...missed].reverse().find(row => world.locations.some(place => place.id === row.person.locationId
            && place.kind === 'settlement' && publicForConversation(world, row.person.id)))!;
        expect(chosen, 'a skipped witness stays in a reachable town area through contact').toBeDefined();
        await waitForContact(chosen.person.id);
        expect(staysForConversation(chosen.person.id)).toBe(true);
        const meet = async (id: string) => {
            const person = world.npcs.find(npc => npc.id === id)!;
            const place = world.locations.find(row => row.id === person.locationId)!;
            // Arrange only the journey's starting place; walking the area and talking are played.
            h.repos.cultivators.update(cultivator.id, { location: place.name, standingIn: null });
            const time = routineTime(world) + LESSER_ACTION_DAYS.move;
            const where = theAreasOf({ ...world, currentDay: time, currentHour: (time % 1) * 24 }, place);
            const area = where.areas.find(row => row.id === where.whereIs.get(id))!;
            expect(area, 'the real person has an area').toBeDefined();
            const arrival = where.areas.find(row => row.id !== area.id) ?? area;
            h.repos.cultivators.standIn(cultivator.id, arrival.id);
            h.game.knowledge.learnIfNew({ holderId: cultivator.id, kind: 'cultivator', id, name: person.name,
                onDay: world.currentDay, sourceKind: 'witnessed', sourceNote: 'Met here.', stage: 'known' });
            provider.plan = { action: 'move', target: area.name };
            await h.game.act(`I move to ${area.name}`);
            expect(h.game.present(h.game.currentRun().cultivator).map(row => row.id)).toContain(id);
            return h.game.company(h.game.currentRun().cultivator).named.find(row => row.name === person.name)!;
        };
        expect(witnessReactions(world, chosen.actorId, chosen.person.id).some(row => row.fact.id === chosen.fact.id)).toBe(false);
        const card = await meet(chosen.person.id);
        expect(card.remembers?.some(line => line.includes('lived through it'))).toBe(true);
        const reaction = witnessReactions(world, chosen.actorId, chosen.person.id).find(row => row.fact.id === chosen.fact.id)!;
        expect(reaction).toBeDefined();
        expect(reaction.observation.state).not.toBe('pending');
        expect(whatOneOfTheWorldsOwnPeopleKnows(world)(chosen.person.id, 'event', chosen.fact.id)).toBe('known');
        const before = JSON.stringify({ reaction: chosen.fact.data.witnessReactions, obligations: world.obligations });
        provider.plan = { action: 'talk', target: chosen.person.name };
        await h.game.act(`I talk to ${chosen.person.name}`);
        expect(provider.calls.some(call => call.messages.some(message => message.content.includes('lived through it')))).toBe(true);
        expect(JSON.stringify({ reaction: chosen.fact.data.witnessReactions, obligations: world.obligations })).toBe(before);

        const elder = world.npcs.find(person => isAnOldLocalCardMember(world, person.id))!;
        expect(elder, 'an old life remains available to meet').toBeDefined();
        await waitForContact(elder.id);
        expect(staysForConversation(elder.id)).toBe(true);
        const oldCard = await meet(elder.id);
        const settled = world.npcs.find(person => person.id === elder.id)!;
        expect(oldCard.ordinal).toBe(settled.cultivation.realmOrdinal);
        expect(rankName(oldCard.ordinal)).toBeTruthy();
        expect(oldCard.houseId).toBe(settled.factionId);
        expect(oldCard.age).toBe(Math.floor((world.currentDay - settled.identity.bornOnDay) / 365));
        for (const tie of settled.relationships) expect(world.npcs.some(person => person.id === tie.targetId)).toBe(true);
        expect(whatOneOfTheWorldsOwnPeopleKnows(world)(settled.id, 'sect', settled.factionId!)).not.toBe('unaware');
    } finally { h.db.close(); }
}

/** Stable public contact is part of both starting states, not an extra fixture assumption. */
function publicForConversation(world: WorldState, id: string): boolean {
    return publicConversationHours(world, id).length > 0;
}

function publicConversationHours(world: WorldState, id: string): number[] {
    const person = world.npcs.find(row => row.id === id);
    const place = world.locations.find(row => row.id === person?.locationId && row.kind === 'settlement');
    if (!person || !place) return [];
    return Array.from({ length: 24 }, (_, hour) => hour).filter(hour => {
        const at = (days: number) => {
            const now = routineTime(world), currentHour = (now % 1) * 24;
            const time = Math.floor(now) + hour / 24 + (hour + 1e-6 < currentHour ? 1 : 0) + days;
            const areas = theAreasOf({ ...world, currentDay: time, currentHour: (time % 1) * 24 }, place);
            return areas.areas.find(area => area.id === areas.whereIs.get(id));
        };
        const arrival = at(LESSER_ACTION_DAYS.move), reply = at(LESSER_ACTION_DAYS.move + LESSER_ACTION_DAYS.interact);
        return arrival !== undefined && arrival.for !== 'room' && arrival.id === reply?.id;
    });
}

function isAnOldLocalCardMember(world: WorldState, id: string): boolean {
    const person = world.npcs.find(row => row.id === id);
    return !!person && person.status === 'alive' && person.factionId !== null
        && world.factions.some(house => house.id === person.factionId && house.dissolvedOnDay === null)
        && person.relationships.length > 0 && world.currentDay - person.identity.bornOnDay >= 200 * 365
        && person.cultivation.lifespanEndsOnDay > world.currentDay + 3
        && publicForConversation(world, person.id);
}

function isABackgroundCardState(world: WorldState): boolean {
    const people = new Map(world.npcs.map(person => [person.id, person]));
    const witness = world.history.facts.some(fact => {
        const parties = actorAndVictimOf(fact);
        return parties !== null && observationOf(fact).wrong !== null && observationOf(fact).sawAct
            && people.get(parties.actorId)?.status === 'alive'
            && fact.witnessIds.some(id => id !== parties.actorId && id !== parties.victimId
                && people.get(id)?.status === 'alive'
                && people.get(id)!.cultivation.lifespanEndsOnDay > world.currentDay + 3
                && publicForConversation(world, id)
                && !witnessReactions(world, parties.actorId, id).some(row => row.fact.id === fact.id));
    });
    return witness && world.npcs.some(person => isAnOldLocalCardMember(world, person.id));
}

async function arrangedCards(): Promise<WorldState> {
    const world = seedWorld({ seed: 'arranged-background-card', catalog: await loadCultivationCatalog() }).state;
    const town = world.locations.find(place => place.kind === 'settlement')!;
    const house = makeFaction({ id: 'card-house', name: 'Reed Card House', seatLocationId: town.id });
    world.factions.push(house);
    const names = () => new Set(world.npcs.map(person => person.name));
    const actor = createNpc(world.seed, { id: 'card-actor', locationId: town.id, takenNames: names(),
        onDay: world.currentDay, bornOnDay: world.currentDay - 30 * 365 });
    world.npcs.push(actor);
    let elderId: string | null = null;
    for (let draw = 0; draw < 128; draw++) {
        const elder = upsertRelationship(setRealm(createNpc(world.seed, { id: 'card-elder-' + draw, takenNames: names(),
            factionId: house.id, factionRankIndex: 0, locationId: town.id, onDay: world.currentDay,
            bornOnDay: world.currentDay - 220 * 365 }), 30, world.currentDay),
        { targetId: actor.id, targetName: actor.name, kind: 'ally', standing: .4, note: 'An existing companion.',
            factIds: [], inheritedFromId: null }, world.currentDay);
        world.npcs.push(elder);
        if (publicForConversation(world, elder.id)) { elderId = elder.id; break; }
        world.npcs.pop();
    }
    expect(elderId, 'a real public routine permits the two contact acts').not.toBeNull();
    const victim = carryingWounds(createNpc(world.seed, { id: 'card-victim', locationId: town.id, takenNames: names(),
        onDay: world.currentDay, bornOnDay: world.currentDay - 25 * 365 }),
    [{ id: 'card-wound', severity: 'minor', source: 'combat', description: 'A cut.', sustainedOnTurn: 0,
        treated: false, cultivationPenalty: .1, breakthroughPenalty: .05, woundType: null }], world.currentDay);
    world.npcs.push(victim);
    appendWorldFact(world, makeFact({ day: world.currentDay, kind: 'injury', locationId: town.id,
        summary: actor.name + ' wounded ' + victim.name + '.', visibility: 'public',
        actors: [{ id: actor.id, name: actor.name, role: 'attacker' }, { id: victim.id, name: victim.name, role: 'victim' }],
        witnessIds: [elderId!] }), { recur: false, bystanders: false });
    expect(isABackgroundCardState(world)).toBe(true);
    return world;
}

const samples = [['demography', 250], ['drift-guard', 250], ['demography', 300], ['drift-guard', 300]] as const;
it('reaches the shared background-card state across sampled aged worlds', async () => {
    const reached: boolean[] = [];
    for (const [seed, years] of samples) reached.push(isABackgroundCardState(await sampledWorld(seed, { years })));
    expect(reached.some(Boolean)).toBe(true);
}, 120_000);

it('settles witnesses and reads an old life from an arranged state', async () => {
    await cardScenario(await arrangedCards());
}, 120_000);

it('passes a real reached state through the same played card scenario', async () => {
    for (const [seed, years] of samples) {
        const world = await sampledWorld(seed, { years });
        if (!isABackgroundCardState(world)) continue;
        await cardScenario(world);
        return;
    }
    throw new Error('No sampled world satisfies the shared card precondition.');
}, 120_000);
