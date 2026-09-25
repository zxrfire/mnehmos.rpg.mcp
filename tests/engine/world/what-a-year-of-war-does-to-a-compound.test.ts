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
    HOW_MANY_HALLS_A_COMPOUND_IS,
    whatTheYearDidToTheGround
} from '../../../src/engine/world/what-a-year-of-war-does-to-a-compound';
import { isRuined, makeObject } from '../../../src/engine/world/possessions';
import { isBroken, isHoled } from '../../../src/engine/world/object-damage';
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
            // them out. It is broken on the row and still answers, at half.
            expect(ground!.wardBroken).not.toBeNull();
            const ward = state.objects.find(o =>
                o.kind === 'formation' && o.ownerId === weak.id);
            expect(ward && isBroken(ward)).toBe(true);
            expect(ward && isRuined(ward)).toBe(false);

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

describe('a year that got past the ward and stopped at the walls', () => {
    /**
     * The ward took the year's force and did not keep them out, so what that
     * did to it is the one damage resolver's answer: below its rung nothing,
     * and past what it is made for a hole or its end. A hole is a rung off
     * what it answers at, and it stays.
     */
    it('can leave the ward holed rather than spent, and never touches it from below', async () => {
        const catalog = await loadCultivationCatalog();
        const { state } = seedWorld({ seed: 'a-ward-holed', catalog });
        const houses = state.factions.filter(f => f.dissolvedOnDay === null && f.seatLocationId !== null);
        const [loser, winner] = [houses[0]!, houses[1]!];
        const day = state.currentDay;
        const WARD_AT = 12;
        const withAWard = (): WorldState => {
            const copy = JSON.parse(JSON.stringify(state)) as WorldState;
            copy.objects = copy.objects.filter(o =>
                !(o.kind === 'formation' && o.locationId === loser.seatLocationId));
            copy.objects.push(makeObject({
                id: 'a-ward', name: 'the ward', kind: 'formation', power: WARD_AT,
                locationId: loser.seatLocationId, ownerId: loser.id,
                data: { ratedWhole: WARD_AT, raisedOnDay: day }
            }));
            return copy;
        };
        const at = (copy: WorldState, reach: number, onDay: number) => {
            const ground = whatTheYearDidToTheGround(copy, {
                winner: copy.factions.find(f => f.id === winner.id)!,
                loser: copy.factions.find(f => f.id === loser.id)!,
                winnerReach: reach,
                day: onDay
            });
            return { ground, ward: copy.objects.find(o => o.id === 'a-ward')! };
        };

        const below = at(withAWard(), WARD_AT - 1, day);
        expect(below.ground).toBeNull();
        expect(below.ward.power).toBe(WARD_AT);

        // Within a realm of it the ward is what it was made for; one to three
        // realms past it the year's force holes it, and past three it breaks
        // it. Pooled over years, both happen.
        let holed = 0;
        let broke = 0;
        for (let year = 0; year < 12; year++) {
            for (let reach = WARD_AT; reach < 29; reach++) {
                const { ground, ward } = at(withAWard(), reach, day + year * 365);
                // The walls held, so nothing came down and no bill was paid.
                expect(ground).toBeNull();
                if (isHoled(ward)) {
                    expect(ward.power).toBe(WARD_AT - 1);
                    holed++;
                } else if (isBroken(ward)) {
                    expect(ward.power).toBe(WARD_AT);
                    broke++;
                }
            }
        }
        expect(holed).toBeGreaterThan(0);
        expect(broke).toBeGreaterThan(0);
    });
});
