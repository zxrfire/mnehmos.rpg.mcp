/**
 * A board says what is on it even when none of it is yours, to whoever stands at it.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 *
 * NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING NOTHING.
 * The design owner, on this board specifically: *"the board is never empty, you
 * just aren't qualified to take a job from the missions elder."* So whoever
 * stands at a board reads all of it, and what is not theirs is refused with what
 * is there, why it is not theirs, and what would change that.
 *
 * ── AND THE BOARD IS INSIDE ──────────────────────────────────────────────
 *
 * The owner: "a sects board is internal", "i mean they can't see the board",
 * "the board is INSIDE", "they are outside". This read used to join a town to
 * every house seated in its province and hand a rogue in the market each
 * house's postings as refusals, which is the board read from outside the walls.
 * What a house wants from outsiders is its notices, on the town's wall, and the
 * disciple on its gate. So a rogue in a town reads none of a house's board, and
 * one standing at the seat reads it all.
 *
 * ── WHAT WENT RED FIRST ──────────────────────────────────────────────────
 *
 *   x a member reads the work their own house has that is not for them
 *       -> the out-of-band postings were dropped with a bare continue
 */

import { describe, expect, it } from 'vitest';

import { sectBoardFor } from '../../src/web/encounters';
import { theProvinceAround } from '../../src/engine/world/ground-holder';
import { makeGameInWorld } from './harness';

const A_WORLD = 'a-wall-is-never-empty';

/**
 * Standing in a settlement in a province a house has its gate in, or at that
 * house's seat.
 *
 * Read out of the world rather than named: which house sits where is the
 * worldgen's business and moves when it does.
 */
async function standingWhereAHouseIsSeated(seed: string, ordinal: number, atTheSeat = false) {
    const { game, repos, db } = await makeGameInWorld({
        seed, worldSeed: A_WORLD, worldEnabled: true
    });
    const { cultivator } = await game.newRun('Passerby');
    const loaded = await game.loadWorld();
    expect(loaded, 'the run opened without a world').toBeTruthy();
    const world = loaded!;

    const holder = world.factions.find(f =>
        f.dissolvedOnDay === null
        && theProvinceAround(world.locations, f.seatLocationId) !== null);
    expect(holder, 'no house in this world has a seat in a province').toBeDefined();

    const province = theProvinceAround(world.locations, holder!.seatLocationId)!;
    const town = world.locations.find(l =>
        l.id !== province
        && l.kind !== 'region'
        && l.kind !== 'sect_seat'
        && theProvinceAround(world.locations, l.id) === province);
    expect(town, 'that province holds nowhere to stand').toBeDefined();
    const seat = world.locations.find(l => l.id === holder!.seatLocationId)!;

    db.prepare('UPDATE cultivators SET location = ?, realm_ordinal = ? WHERE id = ?')
        .run(atTheSeat ? seat.name : town!.name, ordinal, cultivator.id);

    const deps = {
        repos, world,
        knowledge: { knows: () => true, isAwareOf: () => true, learn: () => undefined }
    } as never;
    return {
        game, repos, db, deps, town: town!,
        holder: holder!,
        cultivator: repos.cultivators.getById(cultivator.id)!
    };
}

describe('a board says what is on it even when none of it is yours', () => {
    it('shows a rogue in a town none of a house board, which is inside its walls', async () => {
        const at = await standingWhereAHouseIsSeated('wall-rogue', 8);
        const board = sectBoardFor(at.deps, at.cultivator);

        expect(board.membership).toBeNull();
        expect(board.refusals.filter(row => row.entryId.startsWith('posted-'))).toEqual([]);
        expect(board.offers.filter(row => row.entry.id.startsWith('posted-'))).toEqual([]);
    }, 300_000);

    it('shows a stranger at the seat all of it, and why none of it is theirs', async () => {
        const at = await standingWhereAHouseIsSeated('wall-rogue-why', 8, true);
        const board = sectBoardFor(at.deps, at.cultivator);
        const theirs = board.refusals.filter(row => row.entryId.startsWith('posted-'));

        expect(theirs.length).toBeGreaterThan(0);
        // What is actually here: the house's name is on it.
        expect(theirs.some(row => row.name.includes(at.holder.name))).toBe(true);
        for (const row of theirs) {
            // Why it is not yours, and the honest route. TWO ROADS, BECAUSE TWO
            // KINDS OF BODY: most houses have a roll to earn a place on, and the
            // posting bodies, which appoint, name the nomination instead.
            expect(row.reason.toLowerCase()).toMatch(/roll|nomination/);
        }
        expect(theirs.some(row => row.reason.includes(at.holder.name))).toBe(true);
    }, 300_000);

    it('and a member sees the work their own house has that is not for them', async () => {
        // Pitched far enough below the reader that `summonable` drops it, which
        // is the branch that used to be a bare continue.
        const at = await standingWhereAHouseIsSeated('wall-member', 8);
        at.repos.sects.addMember(at.holder.id, at.cultivator.id, 0);
        at.db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
            .run(40, at.cultivator.id);
        const member = at.repos.cultivators.getById(at.cultivator.id)!;

        const board = sectBoardFor(at.deps, member);
        expect(board.membership).not.toBeNull();
        // Everything the house has is either offered or refused with a reason.
        // Nothing vanishes.
        const accounted = board.offers.length
            + board.refusals.filter(r => r.entryId.startsWith('posted-')).length;
        expect(accounted).toBeGreaterThan(0);
    }, 300_000);
});
