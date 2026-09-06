/**
 * A WAR THAT NEVER TOUCHED THE GROUND IT WAS FOUGHT OVER.
 *
 * The design owner: *"so a declaration at a sect at ordinal 44 might actually
 * be flattening their buildings [...] and then they'd have to pay spirit stones
 * and rebuild."*
 *
 * Wars were already fought. `war-melee.ts` puts the two rosters in front of the
 * melee resolver every year, the confrontation layer writes the bodies and the
 * grudges, and `war-spoils.ts` moves what was in the hold when it ends. What
 * none of it touched was the PLACE: a house could lose a war for a decade and
 * its halls stood exactly as they had.
 *
 * ── IT IS THE SAME ARITHMETIC THE DECLARATION PRINTED ────────────────────
 *
 * `whatBringingItDownWouldTake`, and not the melee's margin and not a die. A
 * house told its compound would come down is a house whose compound comes down,
 * which is what makes the declaration worth reading.
 *
 * ── AND ONLY WHAT IS STANDING CAN FALL ───────────────────────────────────
 *
 * Measured before `HALLS_DOWN` existed: a house that lost its compound in year
 * one had all twelve halls come down again in year two, and again in year
 * three, because nothing remembered they were already gone. A war re-flattening
 * rubble is not a harder war, it is a war that has stopped meaning anything.
 */

import { describe, expect, it } from 'vitest';

import { forStream } from '../../../src/engine/cultivation/rng';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { seedWorld } from '../../../src/engine/world/seeding';
import { fightTheWarsThisYear, whatAHouseCanPutOut } from '../../../src/engine/world/war-melee';
import {
    HALLS_DOWN,
    HOW_MANY_HALLS_A_COMPOUND_IS
} from '../../../src/engine/world/what-a-year-of-war-does-to-a-compound';
import { isRuined } from '../../../src/engine/world/possessions';
import type { FactionRecord, WorldState } from '../../../src/engine/world/world-state';

/** The strongest house in the world at war with the weakest, so the ground gives. */
async function aWarOneSideCannotSurvive(seed: string): Promise<{
    state: WorldState; strong: FactionRecord; weak: FactionRecord;
}> {
    const catalog = await loadCultivationCatalog();
    const { state } = seedWorld({ seed, catalog });

    const withPeople = state.factions.filter(f =>
        f.dissolvedOnDay === null
        && state.npcs.some(n => n.status === 'alive' && n.factionId === f.id));
    const ranked = [...withPeople].sort((a, b) =>
        Number(b.resources.power_ordinal ?? 0) - Number(a.resources.power_ordinal ?? 0));
    const strong = ranked[0]!;
    const weak = ranked[ranked.length - 1]!;
    strong.tags = strong.tags.concat('at_war');
    weak.tags = weak.tags.concat('at_war');

    state.schedule.push({
        id: 'e-a-war', kind: 'war_resolves', dueOnDay: 999_999, summary: 'a war',
        actorIds: [], locationId: null, factionId: strong.id, repeatDays: null,
        interrupts: false, chance: 1, fired: false, firedOnDay: null,
        data: {
            kind: 'war_resolution', sideA: strong.id, sideB: weak.id,
            magnitude: 0.7, openedOnDay: 0,
            musteredA: whatAHouseCanPutOut(state, strong.id).summed,
            musteredB: whatAHouseCanPutOut(state, weak.id).summed,
            ledA: 40, ledB: 10
        }
    } as never);

    return { state, strong, weak };
}

const hallsDown = (house: FactionRecord): number =>
    Number(house.resources[HALLS_DOWN] ?? 0);

describe('a year of war that reaches the ground', () => {
    it('spends the ward, brings the halls down, and empties the treasury paying for them',
        async () => {
            const { state, weak } = await aWarOneSideCannotSurvive('ground-1');
            const treasuryBefore = Number(weak.resources.spirit_stones ?? 0);
            expect(treasuryBefore, 'the house was seeded holding nothing').toBeGreaterThan(0);

            const first = fightTheWarsThisYear(state, 365, forStream('ground-1', 'war-melee', 1));
            const ground = first.fought[0]?.ground ?? null;
            expect(ground, 'the year did nothing to the ground at all').not.toBeNull();

            // THE WARD GOES FIRST, because it is the thing that was keeping
            // them out, and it is spent on the row like every other broken
            // thing in this world.
            expect(ground!.wardBroken).not.toBeNull();
            const ward = state.objects.find(o =>
                o.kind === 'formation' && o.ownerId === weak.id);
            expect(ward && isRuined(ward)).toBe(true);

            // AND THE HALLS, AND THE BILL.
            expect(ground!.buildingsDown).toBeGreaterThan(0);
            expect(Number(weak.resources.spirit_stones ?? 0)).toBeLessThan(treasuryBefore);
        });

    /**
     * ONLY WHAT IS STANDING CAN FALL, which is the whole of why the count is
     * kept. A compound already flat has nothing left to bring down.
     */
    it('never brings the same hall down twice', async () => {
        const { state, weak } = await aWarOneSideCannotSurvive('ground-2');
        for (let year = 1; year <= 6; year++) {
            const did = fightTheWarsThisYear(state, year * 365, forStream('ground-2', 'war-melee', year));
            for (const engagement of did.fought) {
                if (!engagement.ground) continue;
                expect(hallsDown(weak)).toBeLessThanOrEqual(HOW_MANY_HALLS_A_COMPOUND_IS);
            }
        }
        expect(hallsDown(weak)).toBeLessThanOrEqual(HOW_MANY_HALLS_A_COMPOUND_IS);
    });

    /**
     * AND A BLED HOUSE STAYS DOWN. Once the treasury is empty the halls lie
     * where they fell, which is a real state and is how being beaten persists
     * past the year it happened in.
     */
    it('leaves the halls down once there is nothing to raise them with', async () => {
        const { state, weak } = await aWarOneSideCannotSurvive('ground-3');
        for (let year = 1; year <= 6; year++) {
            fightTheWarsThisYear(state, year * 365, forStream('ground-3', 'war-melee', year));
        }
        expect(Number(weak.resources.spirit_stones ?? 0)).toBe(0);
        expect(hallsDown(weak)).toBeGreaterThan(0);
    });

    /**
     * AND THE WINNER'S OWN GROUND IS NEVER TOUCHED. A war is not symmetric
     * damage: what happens to a compound is one side reaching it.
     */
    it('does nothing to the side that won', async () => {
        const { state, strong } = await aWarOneSideCannotSurvive('ground-4');
        for (let year = 1; year <= 4; year++) {
            fightTheWarsThisYear(state, year * 365, forStream('ground-4', 'war-melee', year));
        }
        expect(hallsDown(strong)).toBe(0);
        const theirWard = state.objects.find(o =>
            o.kind === 'formation' && o.ownerId === strong.id);
        expect(theirWard && isRuined(theirWard)).toBe(false);
    });
});
