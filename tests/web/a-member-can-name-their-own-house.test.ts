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
     * AND THE HEIGHT GATE STILL HOLDS. The Hollow Court's people stand nine and
     * more rungs above an ordinal-25 member, and the narrator's own line for the
     * tallest of them - "so far above that the question of comparison does not
     * arise" - is what staying unnamed looks like from the page.
     */
    it('does not hand over everybody merely for being enrolled', async () => {
        const at = await anEnrolledMemberAmongTheirOwn('world-mem-1');
        if (!at) return;
        await at.game.act('who could teach me');
        expect(nameable(at, at.cultivator.id, at.own)).toBeLessThan(at.own.length);
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
