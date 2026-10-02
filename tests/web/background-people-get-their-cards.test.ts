/**
 * Background draws left real witnesses without reactions, and cards read those
 * gaps as a settled life. Walk thirty years, find a surviving witness the draw
 * skipped, then meet and talk through the played card path. The original fact
 * owns the reaction; a second card must neither reroll nor duplicate its account.
 * The same world is met after three centuries to check its surviving life facts.
 */
import { expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness.js';
import { activeWorld } from '../../src/server/state/cultivation-world.js';
import { advanceWorldForPlay } from '../../src/engine/world/driver.js';
import { actorAndVictimOf, observationOf, witnessReactions } from '../../src/engine/world/witness-reactions.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { whatOneOfTheWorldsOwnPeopleKnows } from '../../src/engine/world/what-one-of-the-worlds-own-people-knows.js';
import { rankName } from '../../src/engine/cultivation/realms.js';
import type { ProviderCallOpts } from '../../src/agent/provider/types.js';

class ContactProvider extends ScriptedProvider {
    plan = { action: 'talk', target: '' };
    override async call(opts: ProviderCallOpts) {
        const result = await super.call(opts);
        if (opts.messages.some(message => message.role === 'system' && message.content.startsWith('You are the intent router'))) {
            const text = JSON.stringify(this.plan);
            return { ...result, text, raw: text };
        }
        return result;
    }
}

it('settles skipped witnesses before a played card and keeps centuries of life coherent', async () => {
    const provider = new ContactProvider({
        narrations: ['The person answers from what they remember.'] });
    const h = await makeGameInWorld({ worldSeed: 'demography', seed: 'card-contact', adminMode: true, provider });
    try {
        const world = (await activeWorld()).state;
        h.game.atHand = world;
        advanceWorldForPlay(world, { days: 30 * 365, stopOnInterrupt: false });
        h.game.theWorldMoved();
        const people = new Map(world.npcs.map(person => [person.id, person]));
        const missed = world.history.facts.flatMap(fact => {
            const parties = actorAndVictimOf(fact);
            if (!parties || observationOf(fact).wrong === null || !observationOf(fact).sawAct
                || people.get(parties.actorId)?.status !== 'alive') return [];
            return fact.witnessIds.filter(id => id !== parties.actorId && id !== parties.victimId
                && people.get(id)?.status === 'alive' && people.get(id)?.locationId !== null
                && !witnessReactions(world, parties.actorId, id).some(row => row.fact.id === fact.id))
                .map(id => ({ fact, person: people.get(id)!, actorId: parties.actorId }));
        });
        expect(missed.length, 'the background draw leaves a surviving real witness to meet').toBeGreaterThan(0);
        const chosen = [...missed].reverse().find(row => world.locations.some(place => place.id === row.person.locationId
            && place.kind === 'settlement' && theAreasOf(world, place).areas.length > 1))!;
        expect(chosen, 'a skipped witness stands in a town the player can walk through').toBeDefined();
        const { cultivator } = await h.game.newRun('Reader');
        const meet = async (id: string) => {
            const person = world.npcs.find(npc => npc.id === id)!;
            const place = world.locations.find(row => row.id === person.locationId)!;
            // Arrange only the journey's starting place; walking the area and talking are played.
            h.repos.cultivators.update(cultivator.id, { location: place.name, standingIn: null });
            const where = theAreasOf(world, place);
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

        advanceWorldForPlay(world, { days: 270 * 365, stopOnInterrupt: false });
        h.game.theWorldMoved();
        const elder = world.npcs.find(person => person.status === 'alive' && person.factionId !== null
            && world.locations.some(place => place.id === person.locationId && place.kind === 'settlement')
            && person.relationships.length > 0
            && world.currentDay - person.identity.bornOnDay >= 200 * 365)!;
        expect(elder, 'an old life remains available to meet').toBeDefined();
        const oldCard = await meet(elder.id);
        const settled = world.npcs.find(person => person.id === elder.id)!;
        expect(oldCard.ordinal).toBe(settled.cultivation.realmOrdinal);
        expect(rankName(oldCard.ordinal)).toBeTruthy();
        expect(oldCard.houseId).toBe(settled.factionId);
        expect(oldCard.age).toBeCloseTo((world.currentDay - settled.identity.bornOnDay) / 365, 0);
        for (const tie of settled.relationships) expect(world.npcs.some(person => person.id === tie.targetId)).toBe(true);
        expect(whatOneOfTheWorldsOwnPeopleKnows(world)(settled.id, 'sect', settled.factionId!)).not.toBe('unaware');
    } finally { h.db.close(); }
}, 900_000);
