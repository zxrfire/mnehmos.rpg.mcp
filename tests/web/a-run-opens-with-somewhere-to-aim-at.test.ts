/**
 * A run used to open with nothing to aim at.
 *
 * Measured on a live world, before this: twelve ruins, twelve of them sealed and
 * undiscovered, and *"what ruins are there around here"* answering with nothing
 * on turn one. The discovery pass produces 4-5 openings per century and that is
 * the right long-run rate; what was wrong was the first day.
 *
 * Ruled by the design owner:
 *
 *   "it should open, you should know about it, and you should not go at ordinal
 *    0. a player can hear gossip above their realm and that's okay"
 *
 * Three statements and the third is the one that makes it work. **Knowing a
 * thing exists and being able to survive it are separate facts**, and knowledge
 * running ahead of capability is the point rather than an exception to it: it
 * turns a ruin into something aimed at for twenty rungs instead of a door that
 * says no. There is no warning gate here and there must not be one - being told
 * plainly what it will cost and being allowed to go anyway is the texture.
 *
 * Played rather than asserted off the tables, because the whole class of defect
 * this belongs to is a system that binds the simulation and never reaches the
 * played game. The world is pinned: a played test that pins a seed to an
 * outcome without pinning the world is pinning a coincidence.
 */

import { makeGameInWorld } from './harness';

/** Where the seeded stock lives, whatever the world called them this time. */
function ruinsIn(game: { atHand?: { locations: readonly { kind: string }[] } | null }) {
    return (game.atHand?.locations ?? []).filter(l => l.kind === 'ruin');
}

describe('a fresh world has one piece of closed ground already open', () => {
    it('opens exactly one, and leaves the rest to the discovery pass', async () => {
        const { game } = await makeGameInWorld({ seed: 'aim', worldSeed: 'world-aim-1' });
        await game.newRun('Aimer');
        const ruins = ruinsIn(game as never) as readonly {
            name: string; sealed: boolean; discovered: boolean;
            thresholds: { entry: number; survival: number };
        }[];
        expect(ruins.length).toBeGreaterThan(1);
        const open = ruins.filter(r => !r.sealed && r.discovered);
        expect(open, 'exactly one ruin open at world creation').toHaveLength(1);
    });

    /**
     * AND THE VERB RETURNS IT ON TURN ONE. `seedStartingAwareness` hands out the
     * whole county on the argument that everybody from here can point at it, and
     * it reads `REGIONS` - so the floor everybody has stopped at the edge of the
     * static catalog, because the world made these compounds and the catalog has
     * never heard of them. `foundGroundIn` carries the same rule over them.
     */
    it('answers the question a player asks first, before they have been told anything', async () => {
        const { game } = await makeGameInWorld({ seed: 'aim', worldSeed: 'world-aim-1' });
        await game.newRun('Aimer');

        const acted = await game.act('what ruins are there around here');
        const open = (ruinsIn(game as never) as readonly { name: string; sealed: boolean }[])
            .find(r => !r.sealed)!;

        const said = `${acted.narration ?? ''}`;
        expect(said, 'the one open ruin is not named on turn one').toContain(open.name);
    });

    /**
     * AND GOING THERE AT THE BOTTOM KILLS THEM. Not a refusal - a ruin nobody
     * holds turns nobody away (`ruin-gatekeepers.ts`) - but the survival bar is
     * geology and applies to whoever walks in. Admitted, and being taken apart
     * by the day.
     */
    it('is out of reach of the body that can name it', async () => {
        const { game } = await makeGameInWorld({ seed: 'aim', worldSeed: 'world-aim-1' });
        await game.newRun('Aimer');
        const open = (ruinsIn(game as never) as readonly {
            sealed: boolean; thresholds: { entry: number; survival: number };
        }[]).find(r => !r.sealed)!;

        // Nothing forbids the entry. The seal is off and nobody is left to
        // refuse anybody, so the entry bar is not what stops them.
        const { standingConsequence } = await import('../../src/engine/world/locations');
        const atTheBottom = standingConsequence(open as never, { realmOrdinal: 0 });
        expect(atTheBottom.level).toBe('lethal');
        expect(atTheBottom.admitted).toBe(true);
        expect(atTheBottom.dailyHpFraction).toBeGreaterThan(0.15);

        // And it stays out of reach for a good while, which is what makes it
        // something to aim at rather than a first errand.
        expect(open.thresholds.survival).toBeGreaterThan(3);
    });
});
