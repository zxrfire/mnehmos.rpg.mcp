/**
 * A commission somebody agrees to is placed with them, made on its day, and
 * handed over; and the world can get in the way of it.
 *
 *   PLACED        the stones named move to the maker, and the maker is at the
 *                 work of their rank on the thing, until the day their hands
 *                 take, which puts them in the craft room and makes them busy
 *   BUSY          a maker already making something takes nothing else on
 *   MADE          on the day, the thing exists, is the asker's, and is in their
 *                 hands or held for them by the maker
 *   INTERRUPTED   a maker taken up by something else before the day set the
 *                 work down, and owes a paid-for thing; a maker who died took it
 *                 with them. Both are said.
 *
 * THE WORLD IS PINNED, because these read whoever is standing in the square.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { makeGameInWorld, type Harness } from './harness';
import type { WorldState } from '../../src/engine/world/world-state';
import type { NpcRecord } from '../../src/engine/world/npc-state';
import type { Cultivator } from '../../src/schema/cultivation';
import { readJsonFlag } from '../../src/server/consolidated/cultivation-support';
import {
    FLAG_COMMISSIONS_PLACED,
    type ACommissionPlaced
} from '../../src/web/a-commission-placed-with-a-maker';
import { whatIsBeingMade } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';

const WORLD = 'a-commission-is-placed';

type Turn = { narration: string; toolCalls: { summary: string }[] };

describe('a commission placed with a maker', () => {
    let h: Harness;
    let cultivatorId: string;
    const world = () => (h.game as unknown as { atHand: WorldState }).atHand;
    const said = (turn: unknown) => {
        const t = turn as Turn;
        return `${t.narration} ${t.toolCalls.map(c => c.summary).join(' ')}`;
    };
    const placed = () => readJsonFlag<ACommissionPlaced[]>(h.db, cultivatorId, FLAG_COMMISSIONS_PLACED) ?? [];
    const row = (id: string) => world().npcs.find(n => n.id === id)!;

    /** Ask each person standing here in turn until one of them takes the work. */
    async function placeWithSomebody(skip: ReadonlySet<string>): Promise<NpcRecord | null> {
        const cultivator = h.repos.cultivators.getById(cultivatorId)!;
        const here = (h.game as unknown as { present(c: Cultivator): { id: string; name: string }[] })
            .present(cultivator);
        for (const person of here) {
            if (skip.has(person.id)) continue;
            const before = placed().length;
            await h.game.act(`I pay ${person.name} 100 stones to cut me a talisman`);
            if (placed().length > before) return row(placed().at(-1)!.makerId);
        }
        return null;
    }

    beforeAll(async () => {
        h = await makeGameInWorld({ seed: WORLD, worldSeed: WORLD, worldEnabled: true });
        const { cultivator } = await h.game.newRun('Apprentice');
        cultivatorId = cultivator.id;
        h.repos.sects.addMember('sect-azure-cloud-pavilion', cultivatorId, 1);
        h.db.prepare('UPDATE cultivators SET spirit_stones = 9000 WHERE id = ?').run(cultivatorId);
        await h.game.act('I look around');
    }, 300_000);

    it('is paid for and sets the maker to the work until the day it is done', async () => {
        const purseBefore = h.repos.cultivators.getById(cultivatorId)!.spiritStones;
        const stonesBefore = new Map(world().npcs.map(n => [n.id, n.spiritStones]));
        const maker = await placeWithSomebody(new Set());
        expect(maker, 'nobody here would take the work').not.toBeNull();

        const one = placed().at(-1)!;
        const doing = maker!.activity!;
        expect(doing.kind).toBe('the_work_of_their_rank');
        expect(doing.thingId).toBe(one.thingId);
        expect(doing.untilDay).toBe(one.dueOnDay);
        expect(one.dueOnDay).toBeGreaterThan(Math.floor(world().currentDay) - 1);
        // A slip is cut wherever the cutter sits, so it moves nobody into a room.
        expect(whatIsBeingMade(one.thingId)).toBeNull();

        expect(one.stonesPaid).toBeGreaterThan(0);
        expect(h.repos.cultivators.getById(cultivatorId)!.spiritStones).toBe(purseBefore - one.stonesPaid);
        expect(maker!.spiritStones).toBe((stonesBefore.get(maker!.id) ?? 0) + one.stonesPaid);
    }, 600_000);

    it('and a maker already at work takes nothing else on', async () => {
        const one = placed().at(-1)!;
        const turn = await h.game.act(`I pay ${one.makerName} 100 stones to cut me a talisman`);
        expect(said(turn)).toMatch(/is at work already/);
        expect(placed().length).toBe(1);
    }, 300_000);

    it('is made on its day, and is the asker\'s', async () => {
        const one = placed().at(-1)!;
        await h.game.act('I wait 3 days');
        const thing = world().objects.find(o => o.id === one.thingId);
        expect(thing, 'nothing was made').toBeDefined();
        expect(thing!.ownerId).toBe(cultivatorId);
        expect([cultivatorId, one.makerId]).toContain(thing!.possessorId);
        expect(row(one.makerId).activity?.thingId ?? null).not.toBe(one.thingId);
    }, 300_000);

    it('is set down, and said, when something else takes the maker up before the day', async () => {
        const taken = new Set(placed().map(p => p.makerId));
        const found = await placeWithSomebody(taken);
        expect(found, 'nobody else here would take the work').not.toBeNull();
        const maker = found!;
        const one = placed().find(p => p.makerId === maker.id)!;
        const at = world().npcs.findIndex(n => n.id === maker.id);
        const today = Math.floor(world().currentDay);
        world().npcs[at] = {
            ...maker,
            activity: { kind: 'out_with_a_party', note: 'Sent out with a party.', withIds: [], sinceDay: today, untilDay: today + 90 }
        };
        const turn = await h.game.act('I look around');
        expect(said(turn)).toMatch(/set down the work/);
        expect(placed().some(p => p.thingId === one.thingId)).toBe(false);
        const owed = h.db.prepare('SELECT COUNT(*) AS n FROM obligations WHERE holder_id = ? AND subject_id = ?')
            .get(cultivatorId, maker.id) as { n: number };
        expect(owed.n).toBeGreaterThan(0);
    }, 600_000);

    it('and a maker who dies before the day took the work with them, which is said', async () => {
        const found = await placeWithSomebody(new Set(world().npcs.filter(n => n.activity?.thingId).map(n => n.id)));
        expect(found, 'nobody else here would take the work').not.toBeNull();
        const maker = found!;
        const one = placed().find(p => p.makerId === maker.id)!;
        const at = world().npcs.findIndex(n => n.id === maker.id);
        world().npcs[at] = { ...maker, status: 'physically_dead', diedOnDay: Math.floor(world().currentDay) };
        const turn = await h.game.act('I look around');
        expect(said(turn)).toMatch(new RegExp(`${maker.name} died before`));
        expect(placed().some(p => p.thingId === one.thingId)).toBe(false);
    }, 600_000);
});
