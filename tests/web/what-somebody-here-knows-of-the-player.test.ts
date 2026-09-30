/**
 * The scene card used to carry a person's house knowledge without reading what
 * they know of the player. The live company read now supplies open accounts
 * through the existing proximity rule. Sharing a square grants no private fact;
 * sharing a house or witnessing the event does. Only the addressed character's
 * private card receives these facts, never the room's observations.
 * Red-checked by removing the ledger from the live company read.
 */
import { describe, expect, it } from 'vitest';
import { makeGame } from './harness';
import { createWorld } from '../../src/engine/world/world-state';
import { createNpc } from '../../src/engine/world/npc-state';
import { makeLocation } from '../../src/engine/world/locations';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { createFavor, createGrudge } from '../../src/engine/social/grudges';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';
import { SECTS } from '../../src/data/cultivation/sects';
import { thePeopleHere } from '../../src/web/the-narrator-plays-the-world';

describe('what a character knows of the player', () => {
    it('reads proximity and witnesses into the addressed private card', async () => {
        const { game, repos, db } = makeGame({ seed: 'private-accounts' });
        const { cultivator } = await game.newRun('Traveller');
        const world = createWorld({ seed: 'private-accounts-world', regionCount: 0, skipPriorAges: true });
        const place = makeLocation({ id: 'square', name: cultivator.location!, kind: 'settlement' });
        const observer = createNpc(world.seed, {
            id: 'observer', name: 'The Reader', locationId: place.id, bornOnDay: -20 * 365, onDay: 0
        });
        world.locations.push(place);
        world.npcs.push(observer);
        game.atHand = world;
        const here = { ...cultivator, standingIn: theAreasOf(world, place).whereIs.get(observer.id)! };
        game.knowledge.learnIfNew({
            holderId: cultivator.id, kind: 'cultivator', id: observer.id, name: observer.name,
            onDay: 0, sourceKind: 'told', stage: 'placed', statement: 'They introduced themselves.'
        });
        const grudge = createGrudge({
            holderId: 'victim', subjectId: cultivator.id, cause: 'robbery', severity: 'serious',
            onDay: 0, description: 'Goods were taken.'
        });
        writeOneObligation(db, grudge);
        expect(game.company(here).named[0]!.ownMind?.knowsOfPlayer).toEqual([]);

        const house = SECTS.find(s => s.ranks.length > 0)!;
        repos.sects.addMember(house.id, cultivator.id);
        world.npcs[0] = { ...observer, factionId: house.id };
        const company = game.company(here);
        expect(company.named[0]!.ownMind?.knowsOfPlayer?.join(' ')).toContain('robbery');
        const awareness = game.knowledge.awareness(cultivator.id);
        expect(thePeopleHere(company, here.realmOrdinal, awareness, observer.name).join('\n')).toContain('knows of the player:');
        expect(thePeopleHere(company, here.realmOrdinal, awareness, null).join('\n')).not.toContain('knows of the player:');

        world.npcs[0] = observer;
        writeOneObligation(db, { ...grudge, participants: [observer.id] });
        expect(game.company(here).named[0]!.ownMind?.knowsOfPlayer?.join(' ')).toContain('robbery');

        writeOneObligation(db, createFavor({
            holderId: cultivator.id, subjectId: observer.id, cause: 'sheltered', severity: 'serious',
            onDay: 0, description: 'The traveller sheltered the reader.'
        }));
        const facts = game.company(here).named[0]!.ownMind!.knowsOfPlayer!.join(' ');
        expect(facts).toContain('grudge is held against you');
        expect(facts).toContain('favor is owed to you');
    });
});
