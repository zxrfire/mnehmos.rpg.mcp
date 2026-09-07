/**
 * The engine declining to carry an act out does not unsay it.
 *
 * A declaration against a house on the other side of the map is refused, and it
 * was still a sentence somebody said in a full room. What used to happen was
 * nothing at all: the refusal named the honest route and the world did not
 * contain the fact that anybody had spoken.
 *
 * So the thing to look for here is never a flag. It is a row in the world's own
 * record, with the named house on it, reachable by the ordinary machinery that
 * carries every other fact - which is what makes it arrive at that house later
 * as somebody's account of a lunatic rather than as a state change.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { circulating } from '../../src/engine/world/what-people-are-saying';
import type { WorldState } from '../../src/engine/world/world-state';
import type { HistoricalFact } from '../../src/engine/world/history';

const said = (world: WorldState, id: string): HistoricalFact[] =>
    world.history.facts.filter(f =>
        f.kind === 'said_in_public' && f.actors.some(a => a.id === id));

describe('a declaration nobody could carry out', () => {
    /**
     * Somebody who serves no house declares war on one. The refusal is correct
     * and unchanged - a war is a thing between two houses - and the saying of
     * it is now a fact.
     */
    it('is refused, and the world still holds that it was said', async () => {
        const { game } = await makeGameInWorld({
            seed: 'declared', worldSeed: 'declared', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Probe');

        const before = (await game.loadWorld())!;
        expect(said(before, cultivator.id)).toHaveLength(0);

        const turn = await game.act('I declare war on the Azure Dew Sect');
        // The refusal stands and is unchanged. `engine.housePosture` came back
        // false, which is the correct answer to somebody who speaks for nobody.
        expect(turn.toolCalls.find(c => c.name === 'engine.housePosture')?.ok).toBe(false);

        const world = (await game.loadWorld())!;
        const spoken = said(world, cultivator.id);
        expect(spoken, 'the world contains the saying of it').toHaveLength(1);
        expect(spoken[0]!.factionIds, 'and it names the house it was about')
            .toContain('sect-azure-dew-sect');
    });

    /**
     * And it can travel. Not that it HAS - `airtimeOf` decides that, and a
     * boast from a nobody is meant to be near the bottom of what gets repeated.
     * What matters is that it is in the pool at all, because that is the whole
     * difference between a rumour system and a system with no writer.
     */
    it('is something somebody could repeat', async () => {
        // ITS OWN SEED, AND NOT THE ONE ABOVE. A world is cached by its seed
        // for the life of the test process, so two tests sharing one share the
        // world - and this one then reads a history that holds the OTHER
        // cultivator's saying and not its own. It failed that way intermittently
        // under a full-suite run and passed alone, which is what a shared cache
        // looks like from the outside. The test below already has its own.
        const { game } = await makeGameInWorld({
            seed: 'declared-and-repeated', worldSeed: 'declared-and-repeated', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Probe');
        await game.act('I declare war on the Azure Dew Sect');

        const world = (await game.loadWorld())!;
        const spoken = said(world, cultivator.id)[0]!;
        expect(spoken.visibility).not.toBe('secret');

        const them = world.npcs.find(n => n.id !== cultivator.id && n.status === 'alive')!;
        const inTheAir = circulating(world, {
            id: them.id,
            name: them.name,
            realmOrdinal: them.cultivation.realmOrdinal,
            regionId: null,
            factionId: them.factionId ?? null
        }, world.currentDay, 500);
        expect(inTheAir.map(f => f.id)).toContain(spoken.id);
    });

    /**
     * SAID TO AN EMPTY ROOM IS NOT SAID. Nothing about the verb decides this
     * and nothing about the house does: words nobody heard reached nobody, and
     * a world that recorded them would be a world that overhears everything.
     */
    it('is not a fact when nobody was there to hear it', async () => {
        const { game, db } = await makeGameInWorld({
            seed: 'alone', worldSeed: 'alone', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Probe');
        db.prepare("UPDATE cultivators SET location = 'nowhere-at-all' WHERE id = ?")
            .run(cultivator.id);

        await game.act('I declare war on the Azure Dew Sect');

        const world = (await game.loadWorld())!;
        expect(said(world, cultivator.id)).toHaveLength(0);
    });
});
