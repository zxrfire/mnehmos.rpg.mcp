/**
 * Somebody dies with things on them, and the things are still there afterwards.
 *
 * Played, in a pinned world, through `game.act` - which is the point of the
 * file. The module was tested in isolation first and that proved only that the
 * arithmetic was right; a death is not something you can arrange from outside,
 * so nothing was demonstrated until the turn engine did it on its own.
 *
 * Measured before any of it existed, on a starved cultivator holding pills,
 * herbs, a rated object and thirty stones: every pouch row still on the corpse,
 * the purse still at thirty, zero rows in `world_object_provenance` naming
 * them, zero rows in `world_chronicle_actors` naming them, their world row
 * still reading `alive`, and no grave anywhere. The cultivation layer had the
 * death right and the world was told none of it.
 *
 * Every assertion below is on state. The narration is never read.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld, type Harness } from './harness';
import { worldForRun } from '../../src/server/state/cultivation-world';
import { getNpc, getObject } from '../../src/engine/world/world-state';
import { othersPresent } from '../../src/web/hearsay';

/** ADMIN_MODE is read at call time, so a test can turn it on and put it back. */
async function withAdmin<T>(fn: () => Promise<T>): Promise<T> {
    const before = process.env.ADMIN_MODE;
    process.env.ADMIN_MODE = 'true';
    try {
        return await fn();
    } finally {
        if (before === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = before;
    }
}

/**
 * Spend a life until it runs out.
 *
 * At idle focus with no rations this is the survival layer doing what it does.
 * Nothing here decides the death and nothing asserts one before the engine
 * says so - the loop simply stops asking once the run is closed.
 */
async function liveUntilItEnds(harness: Harness): Promise<void> {
    for (let i = 0; i < 12; i += 1) {
        if (!harness.game.state().cultivator.alive) return;
        await harness.game.act('ADMIN advance_days years=5');
    }
}

/** The world as it now stands on disk, for the run that is loaded. */
async function worldNow(harness: Harness) {
    return worldForRun(harness.repos.runs.getById(harness.game.state().run.id)!);
}

function pouchRows(harness: Harness, cultivatorId: string): number {
    return (harness.db
        .prepare('SELECT COUNT(*) AS n FROM cultivator_pouch WHERE cultivator_id = ? AND quantity > 0')
        .get(cultivatorId) as { n: number }).n;
}

function count(harness: Harness, sql: string, ...args: unknown[]): number {
    return (harness.db.prepare(sql).get(...args) as { n: number }).n;
}

describe('a death moves what the dead were carrying', () => {
    it('empties the body into the ground where they fell, and the world records it', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'estate-alone', worldSeed: 'estate-world' });
            const { game, db } = harness;
            const { cultivator } = await game.newRun('Shen Ke');

            // Where they were born and where they will die. Nothing is moved
            // and nothing is emptied of people first: starving is not
            // something anybody did to them, so what they had goes into the
            // ground whoever else is in the town. See `somebodyDidThis`.
            const place = game.state().cultivator.location;

            // A rated object the world holds a row for and nobody is holding.
            // The two the seeder leaves unpossessed are the only ones a player
            // can come to hold without a house losing its property, which is
            // itself a finding and is reported rather than worked around - see
            // `trackedOnTheBody` in `estate-settlement.ts`.
            await game.act('ADMIN grant_item itemId=artifact-the-severed-ledger-blade');
            await game.act('ADMIN grant_item itemId=pill-qi-gathering quantity=2');
            await game.act('ADMIN grant_item itemId=herb-qi-grass quantity=3');

            expect(pouchRows(harness, cultivator.id)).toBeGreaterThan(0);
            const stonesHeld = game.state().cultivator.spiritStones;
            expect(stonesHeld).toBeGreaterThan(0);

            // NOTHING BELOW THIS LINE IS ARRANGED. The turn that kills them is
            // the turn that settles them.
            await liveUntilItEnds(harness);
            expect(game.state().cultivator.alive).toBe(false);

            // ── THE BODY ─────────────────────────────────────────────────
            expect(pouchRows(harness, cultivator.id)).toBe(0);
            expect(count(harness, 'SELECT spirit_stones AS n FROM cultivators WHERE id = ?', cultivator.id))
                .toBe(0);

            // ── THE GROUND ───────────────────────────────────────────────
            const cache = db
                .prepare("SELECT id, location, contents, discovered FROM cultivation_sites WHERE kind = 'cache'")
                .get() as { id: string; location: string; contents: string; discovered: number };
            expect(cache).toBeDefined();
            expect(cache.location).toBe(place);
            // Nobody has found it. It is not a discovered site.
            expect(cache.discovered).toBe(0);
            const goods = (JSON.parse(cache.contents) as {
                goods: { spiritStones: number; items: { itemId: string }[] };
            }).goods;
            expect(goods.spiritStones).toBe(stonesHeld);
            expect(goods.items.map(i => i.itemId).sort())
                .toEqual(['herb-qi-grass', 'pill-qi-gathering']);

            // ── THE TRACKED ROW, WITH THEIR NAME IN ITS CHAIN ────────────
            //
            // The state the report said a player could not reach: a row in
            // `world_object_provenance` keyed on the player's own id.
            expect(count(
                harness,
                'SELECT COUNT(*) AS n FROM world_object_provenance WHERE holder_id = ?',
                cultivator.id
            )).toBeGreaterThan(0);

            const world = await worldNow(harness);
            const blade = getObject(world, 'artifact-the-severed-ledger-blade');
            expect(blade).not.toBeNull();
            expect(blade!.possessorId).toBeNull();
            expect(blade!.ownerId).toBe(cultivator.id);
            expect(blade!.provenance.some(p => p.previousHolderId === cultivator.id)).toBe(true);

            // ── THE RECORD ───────────────────────────────────────────────
            expect(count(
                harness,
                'SELECT COUNT(*) AS n FROM world_chronicle_actors WHERE actor_id = ?',
                cultivator.id
            )).toBeGreaterThan(0);
            expect(count(harness, "SELECT COUNT(*) AS n FROM world_locations WHERE kind = 'grave'"))
                .toBeGreaterThan(0);

            // And the world knows they are dead. The row read `alive` for as
            // long as nothing put a player's death into the world, and the
            // end-of-turn refresh would write `alive` back over this if the
            // ordering in `act` were the other way round.
            expect(getNpc(world, cultivator.id)!.status).not.toBe('alive');
        });
    }, 300000);

    it('lets the next life dig it up at the place the last one fell', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'estate-dig', worldSeed: 'estate-world-dig' });
            const { game } = harness;
            await game.newRun('Shen Ke');
            const place = game.state().cultivator.location;

            await game.act('ADMIN grant_item itemId=pill-qi-gathering quantity=2');
            const stonesLeft = game.state().cultivator.spiritStones;

            await liveUntilItEnds(harness);
            expect(game.state().cultivator.alive).toBe(false);

            // The next life, in the same world, standing on the same ground.
            await game.act('ADMIN reset Lu Wen');
            expect(game.state().cultivator.alive).toBe(true);
            await game.act(`ADMIN set_location location=${place}`);
            expect(game.state().cultivator.location).toBe(place);

            const before = game.state().cultivator.spiritStones;
            await game.act('I dig here for anything somebody left in the ground');
            const after = game.state();

            // State, not prose: the purse moved and the stock arrived.
            expect(after.cultivator.spiritStones).toBe(before + stonesLeft);
            expect(pouchRows(harness, after.cultivator.id)).toBeGreaterThan(0);
        });
    }, 300000);

    /**
     * THE RULING THIS PINS, AND WHY IT NEEDS PINNING.
     *
     * The first version of the settlement handed the estate to anybody
     * `present` returned, and playing killed that within one run: a named
     * place is a market town or a stretch of wild ground, not a body's length
     * of dirt. Measured on this world - four people standing in the birth
     * town, seven at one stretch of wilds, four at another, and no place with
     * nobody in it that a life could also be spent in. So every death was a
     * robbery and nothing was ever left in the ground, which is a world with
     * no graves in it and the opposite of what the Late Age is made of.
     *
     * `somebodyDidThis` is the fix and this is the test that says so, because
     * the alternative reading is one line of plausible code away and nothing
     * else in the tree would notice it coming back.
     */
    it('does not hand it to bystanders: people were there and it still went into the ground', async () => {
        await withAdmin(async () => {
            const harness = await makeGameInWorld({ seed: 'estate-bystanders', worldSeed: 'estate-world' });
            const { game } = harness;
            const { cultivator } = await game.newRun('Shen Ke');
            await game.act('ADMIN grant_item itemId=pill-qi-gathering quantity=2');

            // Somebody real, standing exactly where the player is standing,
            // in addition to whoever the world already put there.
            await game.act('ADMIN spawn_encounter ordinal=6 name=Cao Antao');
            const watching = othersPresent(
                harness.repos,
                harness.repos.cultivators.getById(cultivator.id)!,
                await worldNow(harness)
            );
            expect(watching.length).toBeGreaterThan(0);

            await liveUntilItEnds(harness);
            expect(game.state().cultivator.alive).toBe(false);
            // Starving is not something any of them did to them.
            expect(game.state().run.deathCause).toBe('starvation');

            expect(count(harness, "SELECT COUNT(*) AS n FROM cultivation_sites WHERE kind = 'cache'"))
                .toBe(1);
            expect(pouchRows(harness, cultivator.id)).toBe(0);
        });
    }, 300000);
});

/**
 * WHAT IS NOT PLAYED HERE, AND WHY IT IS SAID RATHER THAN FAKED.
 *
 * The taken branch - somebody killed you and is therefore standing over you -
 * is covered at the engine level in `tests/engine/world/estate-at-death.test.ts`
 * and NOT played here, because a played combat death is not reliably reachable
 * from a fresh run. Measured, attacking a spawned hostile through `game.act`
 * on one pinned world, twenty attacks at each of six rung gaps (10, 12, 14,
 * 16, 18, 20): no death, at any of them. Four major realms up is refused
 * outright - "not a fight, a decision the stronger party makes alone" - and
 * the gaps below that were won or broken off. One death did occur at a gap of
 * six, once, and moving a single ADMIN turn earlier in the fixture made it
 * stop happening.
 *
 * So a seed that kills the player in a fight is a coincidence, and a test
 * pinned to one is pinning the coincidence rather than the rule - AGENTS.md
 * says so in as many words. The rule is pinned where it is deterministic and
 * the gap is recorded here rather than papered over with a lucky fixture.
 */
