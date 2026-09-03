/**
 * Played: a member of a house could not name one person in it.
 *
 * `the-people-you-serve-with.ts` holds the rule. This is the proof that a
 * producer declaring on the seam actually reaches a player, and the measurement
 * that made the first build of it wrong: the authored roster carries
 * `member-yan-shuling` ids and the people standing on a house's ground are
 * `npc-78` world rows, and the overlap by id is ZERO. A rule that joined the
 * roll to the room would have found nobody for ever and looked exactly like a
 * rule that decided nobody qualified.
 */

import { makeGameInWorld } from './harness';
import { activeWorld } from '../../src/server/state/cultivation-world';
import { getMembersOf } from '../../src/data/cultivation/members';
import { getSect } from '../../src/data/cultivation/sects';

/** A member of whichever house actually has people standing together. */
async function anEnrolledMemberAmongTheirOwn(worldSeed: string) {
    const h = await makeGameInWorld({ seed: 'mem', worldSeed });
    const { cultivator } = await h.game.newRun('Elder');
    const w = await activeWorld();

    let best: { place: string; house: string; n: number } | null = null;
    for (const loc of w.state.locations) {
        const here = h.game.present({ ...cultivator, location: loc.name } as never);
        const byHouse = new Map<string, number>();
        for (const row of here) if (row.sectId) byHouse.set(row.sectId, (byHouse.get(row.sectId) ?? 0) + 1);
        for (const [house, n] of byHouse) if (n > (best?.n ?? 0)) best = { place: loc.name, house, n };
    }
    if (!best) return null;

    h.db.prepare('UPDATE cultivators SET realm_ordinal = 25, location = ? WHERE id = ?')
        .run(best.place, cultivator.id);
    h.game.repos.sects.addMember(best.house, cultivator.id, 4);
    const standing = { ...cultivator, location: best.place, realmOrdinal: 25 } as never;
    const own = h.game.present(standing).filter(row => row.sectId === best!.house);
    return { ...h, cultivator, best, own };
}

const nameable = (h: { game: { knowledge: { isAwareOf(a: string, b: 'cultivator', c: string): boolean } } },
    id: string, own: readonly { id: string }[]) =>
    own.filter(row => h.game.knowledge.isAwareOf(id, 'cultivator', row.id)).length;

describe('a member standing among their own', () => {
    it('can name people afterwards who were strangers before', async () => {
        const at = await anEnrolledMemberAmongTheirOwn('world-mem-1');
        if (!at) return;
        expect(at.own.length).toBeGreaterThan(1);
        expect(nameable(at, at.cultivator.id, at.own)).toBe(0);

        await at.game.act('who could teach me');

        expect(nameable(at, at.cultivator.id, at.own)).toBeGreaterThan(0);
    });

    /**
     * THE ROOM ALONE EARNS NOBODY, which is the guard that matters and the one
     * `presence.test.ts` exists for. Somebody standing in the same crowd who
     * serves nowhere learns not one name from being there.
     *
     * This used to assert that not everybody on the roll was named, and the
     * told-the-structure producer correctly broke it: at the Hollow Court every
     * member stands on the top two rungs, so being enrolled genuinely does
     * introduce all four of them. That is the told rule, not the presence rule,
     * and the height gate on the presence rule is asserted directly in
     * `tests/engine/social/the-people-you-serve-with.test.ts` where nothing else
     * can mask it.
     */
    it('teaches a non-member standing in the same crowd nobody at all', async () => {
        const at = await anEnrolledMemberAmongTheirOwn('world-mem-1');
        if (!at) return;
        // A second run in the same world, standing in the same place, serving
        // nowhere. `makeGameInWorld` pins the world, so the crowd is the same.
        const outsider = await makeGameInWorld({ seed: 'out', worldSeed: 'world-mem-1' });
        const born = await outsider.game.newRun('Nobody');
        outsider.db.prepare('UPDATE cultivators SET realm_ordinal = 25, location = ? WHERE id = ?')
            .run(at.best.place, born.cultivator.id);
        const before = outsider.game.knowledge.awareness(born.cultivator.id, 'cultivator').length;

        await outsider.game.act('who could teach me');

        expect(outsider.game.knowledge.awareness(born.cultivator.id, 'cultivator').length)
            .toBe(before);
    });

    /** The names reach the page, which is the whole of the reported defect. */
    it('says their names when asked who is here', async () => {
        const at = await anEnrolledMemberAmongTheirOwn('world-mem-1');
        if (!at) return;
        await at.game.act('who could teach me');
        const said = (await at.game.act('who is here')).narration ?? '';
        const named = at.own.filter(row =>
            at.game.knowledge.isAwareOf(at.cultivator.id, 'cultivator', row.id));
        expect(named.length).toBeGreaterThan(0);
        // Any of them. Which names the room read chooses to lead with is its
        // business; that a member's own people are named at all is the point.
        expect(named.some(row => said.includes(row.name)), said.slice(0, 200)).toBe(true);
    });
});

/**
 * AND THE STRUCTURE, WHICH NEEDS NOBODY IN THE ROOM.
 *
 * The owner's ruling: being enrolled means being told what the ranks are and
 * who leads. `told`, not `witnessed` - so `stageFromSource` clamps it at
 * `placed`, and knowing the head's name never becomes having met them.
 *
 * The composition is the part worth getting right: told gives you the shape and
 * the top of your own house; presence gives you the specific people you are
 * actually around. A servant knows the head because they were told, knows the
 * people they stand with because they stand with them, and knows nobody else.
 */
describe('what being enrolled told them', () => {
    async function aBrandNewServant() {
        const h = await makeGameInWorld({ seed: 'told', worldSeed: 'world-told-1' });
        const { cultivator } = await h.game.newRun('Servant');
        const w = await activeWorld();
        const house = 'sect-azure-cloud-pavilion';
        // Alone, so nothing can arrive through presence.
        const empty = w.state.locations.find(
            l => h.game.present({ ...cultivator, location: l.name } as never).length === 0
        )!;
        h.db.prepare('UPDATE cultivators SET realm_ordinal = 2, location = ? WHERE id = ?')
            .run(empty.name, cultivator.id);
        // Rank 0. The newest servant there is.
        h.game.repos.sects.addMember(house, cultivator.id, 0);
        return { ...h, cultivator, house, roll: getMembersOf(house), ranks: getSect(house)!.ranks };
    }

    it('names the head to a servant standing alone in an empty room', async () => {
        const at = await aBrandNewServant();
        const held = () => at.roll.filter(
            m => at.game.knowledge.isAwareOf(at.cultivator.id, 'cultivator', m.id));
        expect(held()).toHaveLength(0);

        await at.game.act('who could teach me');

        const top = Math.max(...at.roll.map(m => m.rankIndex));
        expect(held().some(m => m.rankIndex === top)).toBe(true);
    });

    it('does not hand over the servants and the outer disciples', async () => {
        const at = await aBrandNewServant();
        await at.game.act('who could teach me');
        const held = at.roll.filter(
            m => at.game.knowledge.isAwareOf(at.cultivator.id, 'cultivator', m.id));
        expect(held.length).toBeGreaterThan(0);
        expect(held.length).toBeLessThan(at.roll.length);
        // Nobody is withholding a herb boy's name - it simply was not part of
        // what anybody recited to them.
        const bottom = Math.min(...at.roll.map(m => m.rankIndex));
        expect(held.some(m => m.rankIndex === bottom)).toBe(false);
    });

    /**
     * `told` and its ceiling. `placed` is knowing who they are and where they
     * stand; `encountered` would be having dealt with them, which no member has
     * done merely by joining.
     */
    it('grants being told, not having met', async () => {
        const at = await aBrandNewServant();
        await at.game.act('who could teach me');
        const held = at.roll.filter(
            m => at.game.knowledge.isAwareOf(at.cultivator.id, 'cultivator', m.id));
        for (const m of held) {
            expect(at.game.knowledge.stageOf(at.cultivator.id, 'cultivator', m.id)).toBe('placed');
        }
    });
});
