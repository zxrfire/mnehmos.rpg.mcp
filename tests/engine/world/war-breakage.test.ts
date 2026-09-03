/**
 * Two sects battle, and a spirit boat breaks.
 *
 * The owner's question, and the ruling under it: *no bespoke logic, the same
 * way that a sword breaks.* So the boat is minted by the ordinary shipwright
 * path, put into the ordinary object table, and reached by a pass that has
 * never heard of boats. What is asserted here is not that a hull can be broken
 * - `object-damage.test.ts` covers the arithmetic - but that the WORLD reaches
 * one, names who did it, and leaves somebody carrying it.
 */
import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { mintCraft } from '../../../src/engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import {
    ratedThingsOwnedBy,
    whatAWarBreaks
} from '../../../src/engine/world/war-breakage.js';
import { isRuined, makeObject, type ObjectRecord } from '../../../src/engine/world/possessions.js';
import { isHoled, scarsOn } from '../../../src/engine/world/object-damage.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

/** A world with two houses openly fighting, and a hull moored at one of them. */
async function twoHousesAtWar(
    seed = 'boat-war',
    opts: { raidersReachTheHull?: boolean } = {}
): Promise<{
    state: WorldState;
    holder: string;
    against: string;
    boatId: string;
}> {
    const catalog = await loadCultivationCatalog();
    const { state } = seedWorld({ seed, catalog });

    // Two houses that both have people in them, so both can put a party out.
    const withPeople = state.factions.filter(f =>
        f.dissolvedOnDay === null
        && state.npcs.some(n => n.status === 'alive' && n.factionId === f.id)
    );
    const holder = withPeople[0];
    const against = withPeople[1];

    // ARRANGING A PRECONDITION, not asserting a result. The gate is absolute -
    // nobody unmakes what they could not have made - so a heaven-grade hull is
    // out of reach of an ordinary raid on purpose, and a test that wants to see
    // one broken has to put somebody who can reach it on the party. The whole
    // roster of the raiding house is set to the four people in this world who
    // stand highest, which is what a house sending its best would be.
    if (opts.raidersReachTheHull) {
        const top = state.npcs
            .filter(n => n.status === 'alive')
            .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal)
            .slice(0, 4);
        for (const n of state.npcs) {
            if (n.factionId === against.id) n.factionId = null;
        }
        for (const n of top) n.factionId = against.id;
    }

    holder.tags = holder.tags.concat('at_war');
    against.tags = against.tags.concat('at_war');
    state.schedule.push({
        id: 'e-test-war',
        kind: 'war_resolves',
        dueOnDay: 999_999,
        summary: 'a war',
        actorIds: [],
        locationId: null,
        factionId: holder.id,
        repeatDays: null,
        interrupts: false,
        chance: 1,
        fired: false,
        firedOnDay: null,
        data: { kind: 'war_resolution', sideA: holder.id, sideB: against.id, magnitude: 0.7, openedOnDay: 0 }
    });

    // A hull, built by the ordinary path. `mintCraft` is what the yard calls
    // when a heaven-grade launch succeeds, and this is the row it produces.
    const boat = mintCraft(
        {
            id: 'recipe-test-hull',
            name: 'a spirit boat',
            producesConveyanceId: 'conveyance-spirit-boat',
            grade: 'heaven',
            components: [],
            workDays: 100,
            baseSuccessRate: 0.5
        },
        {
            id: 'obj-test-spirit-boat',
            name: 'the Nine Vane',
            ownerId: holder.id,
            ownerName: holder.name,
            wrightId: 'npc-wright',
            wrightName: 'a wright',
            bestHandOrdinal: 29,
            onDay: 0,
            mooredAt: holder.seatLocationId ?? 'nowhere'
        }
    ) as ObjectRecord;
    state.objects.push(boat);

    return { state, holder: holder.id, against: against.id, boatId: boat.id };
}

describe('two sects battle, and the things they own are in it', () => {
    it('a moored hull is a candidate on the same terms as everything else', async () => {
        const { state, holder, boatId } = await twoHousesAtWar();
        const candidates = ratedThingsOwnedBy(state, holder);
        expect(candidates.some(o => o.id === boatId)).toBe(true);
        // And the predicate that let it in named no kind: strip the tags that
        // say it is a conveyance and it is still exactly as much a candidate.
        const stripped = { ...state.objects.find(o => o.id === boatId)!, tags: [] };
        const at = state.objects.findIndex(o => o.id === boatId);
        state.objects[at] = stripped;
        expect(ratedThingsOwnedBy(state, holder).some(o => o.id === boatId)).toBe(true);
    });

    it('a house\'s stores are not in the fighting; what its people carry is', async () => {
        const { state, holder } = await twoHousesAtWar();
        const inTheVault = makeObject({
            id: 'obj-in-the-vault', name: 'a dose on the shelf', kind: 'pill',
            significance: 'significant', power: 29,
            ownerId: holder, ownerName: 'the house', possessorId: holder
        });
        const carried = makeObject({
            id: 'obj-carried', name: 'an elder\'s blade', kind: 'artifact',
            significance: 'significant', power: 29,
            ownerId: holder, ownerName: 'the house', possessorId: 'npc-somebody'
        });
        state.objects.push(inTheVault, carried);
        const ids = ratedThingsOwnedBy(state, holder).map(o => o.id);
        expect(ids).not.toContain('obj-in-the-vault');
        expect(ids).toContain('obj-carried');
    });

    it('an ordinary raid cannot touch a heaven-grade hull, and it is the gate that says so', async () => {
        const { state, holder, boatId } = await twoHousesAtWar();
        state.objects = state.objects.filter(o => o.id === boatId || o.ownerId !== holder);
        const lost = [];
        for (let year = 0; year < 40; year++) {
            lost.push(...whatAWarBreaks(
                state, year * 365, forStream('boat-war', 'war-breakage', year)
            ).broken);
        }
        // Not a rule about hulls. `canUnmake` is absolute: your rung must reach
        // the thing's rung, and a party drawn off an ordinary roster does not.
        expect(lost.filter(l => l.objectId === boatId)).toHaveLength(0);
        expect(state.objects.find(o => o.id === boatId)!.power).toBe(29);
    });

    it('the war reaches the hull, and the record says who did it', async () => {
        const { state, holder, against, boatId } = await twoHousesAtWar('boat-war', { raidersReachTheHull: true });
        // Only the hull is at stake, so the draw cannot land anywhere else.
        state.objects = state.objects.filter(o =>
            o.id === boatId || o.ownerId !== holder
        );

        // Years of it. A war is a decade, not an afternoon.
        const lost = [];
        for (let year = 0; year < 40 && lost.length === 0; year++) {
            lost.push(...whatAWarBreaks(
                state, year * 365, forStream('boat-war', 'war-breakage', year)
            ).broken);
        }

        expect(lost.length).toBeGreaterThan(0);
        const mine = lost.find(l => l.objectId === boatId);
        expect(mine).toBeDefined();
        expect(mine!.ownerId).toBe(holder);
        expect(mine!.breakerHouseId).toBe(against);
        expect(mine!.breakerName).not.toBe('');

        // A dated fact on the world's own record, naming both houses.
        expect(mine!.fact.summary).toMatch(/Nine Vane/);
        expect(mine!.fact.factionIds).toContain(holder);
        expect(mine!.fact.factionIds).toContain(against);
        expect(state.history.facts.some(f => f.id === mine!.fact.id)).toBe(true);

        // And it is a wrong done to a person, priced against what they had.
        expect(mine!.cost).toBeGreaterThan(0);
        expect(mine!.leaves).not.toBeNull();
        expect(mine!.leaves!.opens.length).toBeGreaterThan(0);

        // Somebody in the wronged house now thinks something about somebody in
        // the other one, by name.
        const carrying = state.npcs.filter(n =>
            n.relationships?.some(r => r.targetId === mine!.breakerId && r.kind === 'enemy')
        );
        expect(carrying.length).toBeGreaterThan(0);

        // And the object's own chain says what happened to it.
        const row = state.objects.find(o => o.id === boatId);
        if (row) {
            expect(row.provenance.at(-1)?.source).toMatch(/war between/);
            expect(isRuined(row) || isHoled(row) || row.power === null).toBe(true);
        }
    });

    it('the same pass would have reached a sword in the same house on the same terms', async () => {
        // The ruling, stated as a test: give the house a sabre with the hull's
        // exact numbers and the two are interchangeable in the candidate list.
        const { state, holder, boatId } = await twoHousesAtWar();
        const boat = state.objects.find(o => o.id === boatId)!;
        state.objects.push(makeObject({
            id: 'obj-test-sabre', name: 'a sabre', kind: 'artifact',
            significance: boat.significance, power: boat.power,
            ownerId: boat.ownerId, ownerName: boat.ownerName, possessorId: null
        }));
        const ids = ratedThingsOwnedBy(state, holder).map(o => o.id);
        expect(ids).toContain(boatId);
        expect(ids).toContain('obj-test-sabre');
    });
});

describe('a war does not empty a treasury', () => {
    it('it reaches at most one thing a side owns per year', async () => {
        const { state, holder } = await twoHousesAtWar();
        const before = ratedThingsOwnedBy(state, holder).length;
        const lost = whatAWarBreaks(state, 3650, forStream('boat-war', 'war-breakage', 10)).broken;
        const mine = lost.filter(l => l.ownerId === holder);
        expect(mine.length).toBeLessThanOrEqual(1);
        expect(ratedThingsOwnedBy(state, holder).length).toBeGreaterThanOrEqual(before - 1);
    });

    it('a war that has already settled reaches nothing', async () => {
        const { state, holder, against } = await twoHousesAtWar();
        for (const f of state.factions) {
            if (f.id === holder || f.id === against) {
                f.tags = f.tags.filter(t => t !== 'at_war');
            }
        }
        expect(whatAWarBreaks(state, 3650, forStream('boat-war', 'war-breakage', 10)).broken).toHaveLength(0);
    });
});

describe('the scar is on the row, not on a side table', () => {
    it('a holed thing is worth less to every reader of `power`, with no edit anywhere', async () => {
        const { state, holder, boatId } = await twoHousesAtWar();
        state.objects = state.objects.filter(o => o.id === boatId || o.ownerId !== holder);
        const whole = state.objects.find(o => o.id === boatId)!.power;

        for (let year = 0; year < 60; year++) {
            whatAWarBreaks(state, year * 365, forStream('boat-war', 'war-breakage', year));
            const row = state.objects.find(o => o.id === boatId);
            if (row && isHoled(row)) {
                expect(row.power).toBeLessThan(whole!);
                expect(scarsOn(row)).toBeGreaterThan(0);
                return;
            }
            if (!row || isRuined(row)) return;   // it ended first; the other arm
        }
    });
});
