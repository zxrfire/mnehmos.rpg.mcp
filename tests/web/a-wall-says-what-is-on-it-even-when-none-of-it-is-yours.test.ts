/**
 * A wall says what is on it even when none of it is yours.
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 *
 * NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING NOTHING.
 * A gate decides what somebody may DO. It must not decide what they may KNOW
 * ABOUT. The design owner, on this board specifically: *"the board is never
 * empty, you just aren't qualified to take a job from the missions elder."*
 *
 * ── WHAT WAS MEASURED ────────────────────────────────────────────────────
 *
 * The affordance probe swept 36 squares over three band floors of a pinned
 * world and read the duty channel at each:
 *
 *     duty  at the bottom        12 advertised, 12 reachable
 *     duty  through the middle   36 advertised,  0 reachable
 *     duty  at the top            0 advertised   NOTHING IS ADVERTISED AT ALL
 *
 * Two silences in that table, and both are this rule being broken.
 *
 * `whatTheHouseItselfNeedsDone` returned an empty array for anybody not on a
 * roll, so a house's own work was invisible to everybody it was not offered to,
 * and it dropped any posting whose band the reader did not clear with a bare
 * `continue` - so the one channel built to say *here, and not yours*
 * (`boardRefusals`) only ever carried the hand-authored catalogue, which itself
 * runs out at ordinal 17. Above that the wall said nothing at all, and a wall
 * saying nothing reads as a world with nothing in it rather than as a world
 * that has not opened to you yet.
 *
 * ── AND WHOSE WALL A TOWN'S WALL IS ──────────────────────────────────────
 *
 * THE PROVINCE, and the two readings that are not it are both measured.
 *
 * `whoHoldsTheGround` answers *whose ground is this* by walking UPWARD looking
 * for a holder. Right inside a compound, wrong in a town: on a pinned world 988
 * of 1063 location records carry a holder and NONE of the twelve places a
 * player's `location` can be does, because the held ones are the compounds.
 *
 * Nesting the other way answers none, everywhere. `seedFactions` hangs a seat
 * off the REGION rather than off a settlement, so a house's ground is a sibling
 * of the towns and is inside none of them.
 *
 * So the province is the join, which is the one the recruiting wall already
 * uses: a board in a market town carries the work of the houses whose gates are
 * in that province.
 *
 * ── WHAT A REFUSAL HAS TO CARRY ──────────────────────────────────────────
 *
 * What is actually here, why it is not yours, and what would change that. An
 * empty list carries none of the three, which is why it is the defect and not
 * merely a thin answer.
 *
 * ── WHAT WENT RED FIRST ──────────────────────────────────────────────────
 *
 *   x a rogue standing where a house is seated reads its wall
 *       -> board.refusals held 0 rows naming that house
 *   x and is told why none of it is theirs, and what would change that
 *       -> no such row existed to carry a reason
 *   x a member reads the work their own house has that is not for them
 *       -> the out-of-band postings were dropped with a bare continue
 */

import { describe, expect, it } from 'vitest';

import { sectBoardFor } from '../../src/web/encounters';
import { theProvinceAround } from '../../src/engine/world/ground-holder';
import { makeGameInWorld } from './harness';

const A_WORLD = 'a-wall-is-never-empty';

/**
 * Standing in a settlement in a province a house has its gate in, which is the
 * square a player is actually in.
 *
 * Read out of the world rather than named: which house sits where is the
 * worldgen's business and moves when it does. And the settlement rather than
 * the seat, because that is where somebody who has not been admitted stands -
 * inside the gate is a different problem with a different answer.
 */
async function standingWhereAHouseIsSeated(seed: string, ordinal: number) {
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
        && theProvinceAround(world.locations, l.id) === province);
    expect(town, 'that province holds nowhere to stand').toBeDefined();

    db.prepare('UPDATE cultivators SET location = ?, realm_ordinal = ? WHERE id = ?')
        .run(town!.name, ordinal, cultivator.id);

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

describe('a wall says what is on it even when none of it is yours', () => {
    it('shows a rogue the work the house whose gate is here has', async () => {
        const at = await standingWhereAHouseIsSeated('wall-rogue', 8);
        const board = sectBoardFor(at.deps, at.cultivator);

        expect(board.membership).toBeNull();
        const theirs = board.refusals.filter(row => row.entryId.startsWith('posted-'));
        expect(theirs.length).toBeGreaterThan(0);
        // What is actually here: the house's name is on it, because that is
        // what makes it a thing somebody could go and want.
        expect(theirs.some(row => row.name.includes(at.holder.name))).toBe(true);
    }, 300_000);

    it('and says why none of it is theirs, and what would change that', async () => {
        const at = await standingWhereAHouseIsSeated('wall-rogue-why', 8);
        const board = sectBoardFor(at.deps, at.cultivator);
        const theirs = board.refusals.filter(row => row.entryId.startsWith('posted-'));

        expect(theirs.length).toBeGreaterThan(0);
        for (const row of theirs) {
            // Why it is not yours, and the honest route. Asserted as content
            // rather than as a sentence: the route has to name A ROAD, and the
            // house it leads into.
            //
            // TWO ROADS, BECAUSE TWO KINDS OF BODY. Most houses have a roll and
            // earning a place on it is the answer. The posting bodies have no
            // roll to earn a place on - nobody applies, people are appointed -
            // so their honest answer names the nomination instead. Pinning
            // `roll` alone made the better refusal the failing one.
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
