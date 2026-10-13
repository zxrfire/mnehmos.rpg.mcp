/**
 * A commission somebody agrees to is placed with them, made on its day, and
 * handed over; and the world can get in the way of it.
 * Completed work also earns face. Disabling face writes made that assertion
 * fail; restoring them passed in the same command.
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
 * Replies and approaches now spend time. Meet each maker in their current
 * area rather than asking an earlier crowd from another area; the busy check
 * is made beside the maker before its due day, retaining the pending-work
 * assertion. Waiting for completion and actual interruption stay unchanged.
 * The interruption fixture later reached day 365004 for work due on 365004;
 * the piece was already made and held. That cannot interrupt pending work.
 * It now arranges another paid word at the exact clock, using the native work
 * duration, before taking its maker away. The other controls still play placing.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { makeGameInWorld, type Harness } from './harness';
import type { WorldState } from '../../src/engine/world/world-state';
import type { NpcRecord } from '../../src/engine/world/npc-state';
import { readJsonFlag, writeFlag } from '../../src/server/consolidated/cultivation-support';
import {
    FLAG_COMMISSIONS_PLACED,
    type ACommissionPlaced
} from '../../src/web/a-commission-placed-with-a-maker';
import { whatIsBeingMade } from '../../src/engine/world/where-inside-a-house-somebody-is-standing';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { worldLocationFor } from '../../src/web/entities';
import { standWhereThePeopleAre } from './standing-where-the-people-are';
import { routineTime } from '../../src/engine/world/npc-routines';
import { daysAtTheWork } from '../../src/engine/social-leverage/commissioning-a-craft';

const WORLD = 'a-commission-is-placed';
// A late-day order finished at midnight because both ends floored the clock.
// Keep the actual agreed work span, including the pre-completion cancellation.

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
        const place = worldLocationFor(world(), cultivator.location)!;
        const placement = theAreasOf(world(), place);
        const here = world().npcs.filter(n => n.status === 'alive' && placement.whereIs.has(n.id)
            && n.id !== cultivator.id);
        for (const person of here) {
            if (skip.has(person.id)) continue;
            await standWhereThePeopleAre(h, cultivatorId, new Set([person.id]));
            if (!h.game.present(h.repos.cultivators.getById(cultivatorId)!).some(p => p.id === person.id)) continue;
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
        await standWhereThePeopleAre(h, cultivatorId, new Set([one.makerId]));
        expect(Math.floor(world().currentDay), 'the busy check must precede delivery').toBeLessThan(one.dueOnDay);
        const turn = await h.game.act(`I pay ${one.makerName} 100 stones to cut me a talisman`);
        expect(said(turn)).toMatch(/is at work already/);
        expect(placed().length, JSON.stringify({ day: world().currentDay, due: one.dueOnDay,
            activity: row(one.makerId).activity, calls: (turn as unknown as Turn).toolCalls })).toBe(1);
    }, 300_000);

    it('is made on its day, and is the asker\'s', async () => {
        const one = placed().at(-1)!;
        const faceBefore = row(one.makerId).face ?? 0;
        await h.game.act('I wait 3 days');
        const thing = world().objects.find(o => o.id === one.thingId);
        expect(thing, 'nothing was made').toBeDefined();
        expect(thing!.ownerId).toBe(cultivatorId);
        expect([cultivatorId, one.makerId]).toContain(thing!.possessorId);
        expect(row(one.makerId).activity?.thingId ?? null).not.toBe(one.thingId);
        expect(row(one.makerId).face ?? 0).toBeGreaterThan(faceBefore);
    }, 300_000);

    it('is set down, and said, when something else takes the maker up before the day', async () => {
        const taken = new Set(placed().map(p => p.makerId));
        const found = await placeWithSomebody(taken);
        expect(found, 'nobody else here would take the work').not.toBeNull();
        const maker = found!;
        const previous = placed().find(p => p.makerId === maker.id)!;
        const today = routineTime(world());
        const one: ACommissionPlaced = { ...previous, thingId: `pending-interruption:${previous.thingId}`,
            placedOnDay: today, dueOnDay: today + daysAtTheWork(previous.ask.grade, maker.cultivation.realmOrdinal,
                { aSlip: Boolean(previous.ask.slip) }), held: false, heldIds: undefined };
        writeFlag(h.db, cultivatorId, FLAG_COMMISSIONS_PLACED, JSON.stringify([...placed(), one]));
        const payer = h.repos.cultivators.getById(cultivatorId)!;
        h.repos.cultivators.update(cultivatorId, { spiritStones: payer.spiritStones - one.stonesPaid });
        const at = world().npcs.findIndex(n => n.id === maker.id);
        expect(one.held, 'the interruption must precede completion').toBe(false);
        world().npcs[at] = {
            ...maker, spiritStones: maker.spiritStones + one.stonesPaid,
            activity: { kind: 'out_with_a_party', note: 'Sent out with a party.', withIds: [], sinceDay: today, untilDay: today + 90 }
        };
        const turn = await h.game.act('I look around');
        expect(today).toBeLessThan(one.dueOnDay);
        expect(said(turn), JSON.stringify({ actualMaker: row(maker.id), commission: one, calls: (turn as unknown as Turn).toolCalls })).toMatch(/set down the work/);
        expect(placed().some(p => p.thingId === one.thingId)).toBe(false);
        const owed = h.db.prepare('SELECT COUNT(*) AS n FROM obligations WHERE holder_id = ? AND subject_id = ?')
            .get(cultivatorId, maker.id) as { n: number };
        expect(owed.n).toBeGreaterThan(0);
    }, 600_000);

    it('and a maker who dies before the day took the work with them, which is said', async () => {
        const maker = world().npcs.find(n => n.status === 'alive')!;
        const day = Math.floor(world().currentDay);
        const one: ACommissionPlaced = {
            makerId: maker.id, makerName: maker.name,
            ask: { named: 'a mortal talisman', grade: 'mortal', slip: 'a_strike' },
            placedOnDay: day, dueOnDay: day + 1,
            thingId: `commission-that-${maker.id}-took`, stonesPaid: 1, held: false
        };
        writeFlag(h.db, cultivatorId, FLAG_COMMISSIONS_PLACED, JSON.stringify([one]));
        const at = world().npcs.findIndex(n => n.id === maker.id);
        world().npcs[at] = { ...maker, status: 'physically_dead', diedOnDay: day };
        const turn = await h.game.act('I look around');
        expect(said(turn)).toMatch(new RegExp(`${maker.name} died before`));
        expect(placed().some(p => p.thingId === one.thingId)).toBe(false);
    }, 600_000);
});
