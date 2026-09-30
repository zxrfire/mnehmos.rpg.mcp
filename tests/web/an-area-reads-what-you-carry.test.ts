/**
 * Everybody in the area reads the thing in the player's hand, not only the one
 * being fought.
 *
 * `whatTheySawYouCarrying` read one observer, the opponent, so a house's own
 * blade drawn in front of one of that house's people was recognised by nobody
 * unless that person was the one being struck. `whoHereRecognisesIt` read the
 * room and had no caller. The area is `present`, three at most.
 *
 * Arranged rather than played to the swing: which people share an area and who
 * a sentence would strike are the world's draw, and this is about who reads the
 * blade once a fight is standing. The people and the area are asked of the
 * engine, never named.
 *
 * RED-CHECKED: reading only `held.theirRecord` again leaves the bystander off
 * `knownOwnershipBy` and fails the first assertion.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { makeObject } from '../../src/engine/world/possessions';

const WORLD = 'an-area-reads-a-blade';

describe('an area reads what you carry', () => {
    it('writes every recogniser in the area onto the thing, and says so once', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'area-blade', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Carrier');
        const world = (await game.loadWorld())!;
        expect(world, 'the run opened without a world').toBeTruthy();

        // A place where the player's area holds two people the world keeps, one
        // of them on a house's roll.
        let arranged: { opponent: string; bystander: string } | null = null;
        for (const place of world.locations) {
            repos.cultivators.update(cultivator.id, { location: place.name });
            const me = repos.cultivators.getById(cultivator.id)!;
            const here = game.present(me)
                .filter(row => row.alive && world.npcs.some(npc => npc.id === row.id));
            const bystander = here.find(row => row.sectId !== null);
            const opponent = here.find(row => row.id !== bystander?.id);
            if (bystander && opponent) {
                arranged = { opponent: opponent.id, bystander: bystander.id };
                break;
            }
        }
        expect(arranged, 'no area in this world holds two people and a house member').not.toBeNull();

        const me = repos.cultivators.getById(cultivator.id)!;
        const bystander = world.npcs.find(npc => npc.id === arranged!.bystander)!;
        const opponent = world.npcs.find(npc => npc.id === arranged!.opponent)!;
        const house = world.factions.find(row => row.id === bystander.factionId)!;

        // The bystander's own house's blade, in the player's hand.
        const blade = makeObject({
            id: 'obj-a-house-blade',
            name: 'Test Blade Of The House',
            kind: 'artifact',
            significance: 'notable',
            power: bystander.cultivation.realmOrdinal,
            possessorId: me.id,
            ownerId: house.id,
            ownerName: house.name
        });
        world.objects.push(blade);

        const execution = game.whatTheySawYouCarrying(me, {
            self: { weapon: { id: blade.id, name: blade.name, power: blade.power } },
            theirRecord: opponent,
            party: { id: opponent.id, name: opponent.name },
            verb: 'attack'
        } as never, {
            facts: { headline: '', prose: '', lines: [], structure: [] },
            calls: []
        } as never);

        const after = world.objects.find(row => row.id === blade.id)!;
        expect(
            after.knownOwnershipBy,
            'a member of the owning house stood in the area and did not recognise its blade'
        ).toContain(bystander.id);
        const said = execution.facts.lines.join(' ');
        expect(said).toMatch(/on sight, and whose it is/);
        // One line for the one being fought and one for everybody else.
        expect(said.match(/on sight/g)!.length).toBeLessThanOrEqual(2);
    }, 180_000);
});
