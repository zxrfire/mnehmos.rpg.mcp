/**
 * The wall outside a compound carries more than intakes.
 *
 * THE DEFECT, MEASURED. `billsOnTheWall` was the only thing a house could ever
 * publish: one channel carrying one message, RECRUITMENT, and only from the
 * houses at the bottom of the field. So a rogue cultivator standing in a market
 * town could read that three failing houses would hear them, and nothing else -
 * while every house in the world, including the ones that would never admit
 * them, wants materials, wants hands, and has ground it answers for.
 *
 * That is the same failure as the duty board returning `[]`:
 * NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING NOTHING.
 * The inner board stays shut. The wall outside carries exactly the work a house
 * is willing to give somebody who is not its own, which is where a rogue's
 * early career comes from in this genre.
 *
 * What these tests hold down:
 *
 *   RECRUITMENT IS NOW ONE KIND, AND THE OLD READ IS UNCHANGED. `billsOnTheWall`
 *   still draws on the `recruiting_bills` stream and still answers exactly what
 *   it answered, so a run that reads a wall is not perturbed by this file
 *   existing. The notices draw on their own stream.
 *
 *   THE ASK IS NOT THE GATE. A house that admits nobody still posts work. The
 *   whole point of the channel is that being unable to join is not being unable
 *   to see, and a derivation that quietly reused the recruitment filter would
 *   put the rogue back in front of the same three failing houses.
 *
 *   A DATE THE WORLD STATES DOES NOT MOVE BECAUSE SOMEBODY LOOKED AT IT. The
 *   recruiting half was fixed hours before this file was written - `opensOnDay`
 *   was anchored to the reader, so one house named thirty different intake days
 *   inside one ninety-day window. Every notice keeps the same property, and the
 *   cheapest way to keep it is to state no date at all unless the paper has one.
 */

import { describe, it, expect } from 'vitest';
import {
    A_BILL_STAYS_UP_FOR_DAYS,
    A_DATED_PAPER_TAKES_ONE_NAIL,
    BILLS_A_WALL_CARRIES,
    billsOnTheWall,
    noticesOnTheWall,
    whatANoticeGrants,
    type DoorInTheField,
    type HouseWithSomethingToSay
} from '../../../src/engine/world/houses-that-have-to-advertise-for-disciples.js';

function field(): DoorInTheField[] {
    const rows: DoorInTheField[] = [];
    for (let i = 0; i < 9; i++) {
        rows.push({
            id: `house-${i}`,
            name: `House ${i}`,
            admissionOrdinal: i,
            powerOrdinal: 10 + i * 3,
            provinceId: i % 2 === 0 ? 'province-a' : 'province-b',
            postsInPublic: true
        });
    }
    return rows;
}

/**
 * Three houses with something to say, and not one of them is on the
 * recruitment list: two sit at the top of the field and the third holds no
 * ground at all in the province being read.
 */
function speaking(): HouseWithSomethingToSay[] {
    return [
        {
            id: 'house-8',
            name: 'House 8',
            provinceId: 'province-a',
            postsInPublic: true,
            asks: [
                { kind: 'work', what: 'Out after beast bone at mortal grade.', days: 40, hands: 5 },
                { kind: 'warning', what: 'Something is moving toward the settlements under the vein.' }
            ]
        },
        {
            id: 'house-7',
            name: 'House 7',
            provinceId: 'province-a',
            postsInPublic: true,
            asks: [{ kind: 'missing', who: 'Mo Qingzhi', unseenForDays: 120 }]
        },
        {
            id: 'house-5',
            name: 'House 5',
            provinceId: 'province-b',
            postsInPublic: true,
            asks: [{ kind: 'work', what: 'An escort that has to arrive.', days: 60, hands: 4 }]
        }
    ];
}

const WALL = {
    placeName: 'Iron Ridge',
    ground: 'city' as const,
    placeProvinceId: 'province-a',
    onDay: 400,
    seed: 'wall-seed'
};

function wall(over: Partial<Parameters<typeof noticesOnTheWall>[0]> = {}) {
    return noticesOnTheWall({ ...WALL, field: field(), speaking: speaking(), ...over });
}

describe('recruitment is one kind of notice, not the only one', () => {
    it('carries the intakes it always carried, worded as they always were', () => {
        const intakes = wall().filter(n => n.kind === 'intake');
        const bills = billsOnTheWall({ ...WALL, field: field() });
        expect(intakes.map(n => n.saying)).toEqual(bills.map(b => b.saying));
        expect(intakes.map(n => n.houseId)).toEqual(bills.map(b => b.houseId));
    });

    it('does not perturb the recruiting draw by existing', () => {
        const alone = billsOnTheWall({ ...WALL, field: field() });
        wall();
        expect(billsOnTheWall({ ...WALL, field: field() })).toEqual(alone);
    });

    /**
     * THE CLOSED SET GREW, AND THE GUARANTEE DID NOT MOVE.
     *
     * `open_competition` was added as a fourth ask - a house holding a
     * competition anybody may enter, which is the only forward-looking dated
     * thing on a wall. Putting it in the ask pool cost this assertion
     * immediately and correctly: the pool emits one of each kind before a second
     * of any, so four kinds against three nails made WHICH kind was dropped a
     * property of the seeded draw, and a wall that had stopped posting work is
     * the exact defect this module was written against.
     *
     * The fix was a budget of its own rather than a fourth competitor for the
     * same three nails - the shape the intakes already have. So the three
     * ordinary kinds keep the guarantee they had, and the list below is longer
     * because the wall genuinely carries a fourth kind now, not because the
     * guarantee was relaxed to accommodate it.
     */
    it('carries the other three kinds beside them', () => {
        const kinds = new Set(wall().map(n => n.kind));
        expect(kinds.has('work')).toBe(true);
        expect([...kinds].every(
            k => ['intake', 'work', 'warning', 'missing', 'open_competition'].includes(k)
        )).toBe(true);
    });
});

describe('a house that would never admit you still wants something from you', () => {
    /**
     * The rule the whole channel exists for. `housesThatHaveToAdvertise` picks
     * the bottom of the field; every house in `speaking()` is outside that set,
     * and every one of them reaches the wall.
     */
    it('posts work from houses no intake would ever come from', () => {
        const posted = wall();
        const advertisers = new Set(billsOnTheWall({ ...WALL, field: field() }).map(b => b.houseId));
        const others = posted.filter(n => n.kind !== 'intake');
        expect(others.length).toBeGreaterThan(0);
        expect(others.some(n => !advertisers.has(n.houseId))).toBe(true);
    });

    it('says what is wanted and how long it takes, so it can be acted on', () => {
        const work = wall().find(n => n.kind === 'work')!;
        expect(work.saying).toContain(work.houseName);
        expect(work.saying).toMatch(/\d+ days/);
    });

    /** A body that cannot afford an address does not post any of it. */
    it('leaves off a house that does not put its name in public', () => {
        const quiet = speaking().map(h => ({ ...h, postsInPublic: false }));
        expect(wall({ speaking: quiet }).filter(n => n.kind !== 'intake')).toEqual([]);
    });

    /** A house's word reaches the province its ground is in, and no further. */
    it('does not carry a house from another province', () => {
        const ids = wall().filter(n => n.kind !== 'intake').map(n => n.houseId);
        expect(ids).not.toContain('house-5');
    });

    /**
     * THE BOUND WAS RESTATED, NOT RELAXED. It used to read "non-intake paper is
     * at most `BILLS_A_WALL_CARRIES[ground]`", which was the same sentence as
     * "standing business is at most that" for as long as everything on a wall
     * was standing business. An open-competition notice is an appointment: it
     * goes up inside `A_NOTICE_GOES_UP_DAYS` of falling and is gone afterwards,
     * and it takes `A_DATED_PAPER_TAKES_ONE_NAIL` on top rather than one of the
     * three - which was measured rather than chosen, since making it share meant
     * either a wall that had stopped posting work or, when it was given only
     * leftover nails, a feature that reached ZERO city walls on the shipped map
     * across three years. See `noticesOnTheWall`.
     *
     * So the claim this test exists for - a village wall does not read like a
     * city one - is asserted unchanged, and the ceiling is stated against the
     * two budgets it is now made of.
     */
    it('carries less paper in a village than in a city, and none in a hamlet', () => {
        const city = wall({ ground: 'city' }).filter(n => n.kind !== 'intake').length;
        const village = wall({ ground: 'village' }).filter(n => n.kind !== 'intake').length;
        expect(city).toBeGreaterThan(village);
        expect(wall({ ground: 'hamlet' })).toEqual([]);

        const standing = (ground: 'city' | 'village') => wall({ ground })
            .filter(n => n.kind !== 'intake' && n.kind !== 'open_competition').length;
        expect(standing('city')).toBeLessThanOrEqual(BILLS_A_WALL_CARRIES.city);
        expect(standing('village')).toBeLessThanOrEqual(BILLS_A_WALL_CARRIES.village);
        expect(city).toBeLessThanOrEqual(
            BILLS_A_WALL_CARRIES.city + A_DATED_PAPER_TAKES_ONE_NAIL);
    });
});

describe('a wall does not change because somebody looked at it', () => {
    it('says the same thing twice on the same day', () => {
        expect(wall()).toEqual(wall());
    });

    /** The same houses, saying the same kinds of thing, for the whole season. */
    it('holds the same paper for the life of the paper', () => {
        const posted = (day: number) =>
            wall({ onDay: day }).map(n => `${n.kind}|${n.houseId}`);
        const first = posted(WALL.onDay);
        for (let day = WALL.onDay + 1; day < WALL.onDay + 40; day++) {
            expect(posted(day), `the wall changed on day ${day}`).toEqual(first);
        }
    });

    /**
     * The property the intake fix bought, asserted over every kind: a day the
     * paper has NAMED does not move while it is still ahead of the reader.
     *
     * The one legal jump is the intake having happened - a fallen date rolls on
     * by a whole window, which is the paper naming the next one rather than the
     * old one receding. That is the exact difference between the fix and the
     * defect, so it is asserted as a bound rather than assumed.
     */
    it('never moves a date that has not yet fallen', () => {
        const promised = new Map<string, number>();
        let checked = 0;
        // One window, because the next window is a different wall: the paper
        // comes down and what goes up in its place owes the old date nothing.
        const from = Math.floor(WALL.onDay / A_BILL_STAYS_UP_FOR_DAYS) * A_BILL_STAYS_UP_FOR_DAYS;
        for (let day = from; day < from + A_BILL_STAYS_UP_FOR_DAYS; day++) {
            for (const notice of wall({ onDay: day })) {
                if (notice.onDay === null) continue;
                const key = `${notice.kind}|${notice.houseId}`;
                const said = promised.get(key);
                // Strictly ahead: the intake rolls on the morning it falls,
                // which `never advertises a day that has already gone past`
                // next door pins from the other side.
                if (said !== undefined && day < said) {
                    expect(notice.onDay, `${key} moved a date that had not fallen`).toBe(said);
                    checked += 1;
                } else {
                    expect(notice.onDay).toBeGreaterThan(day);
                    promised.set(key, notice.onDay);
                }
            }
        }
        expect(checked).toBeGreaterThan(0);
    });
});

describe('a notice grants the name of the house that posted it', () => {
    it('hands the knowledge layer a placed name off a read source', () => {
        const work = wall().find(n => n.kind === 'work')!;
        const grant = whatANoticeGrants(work);
        expect(grant).toMatchObject({
            kind: 'sect',
            id: work.houseId,
            name: work.houseName,
            sourceKind: 'read',
            stage: 'placed'
        });
        expect(grant.statement).toContain(work.houseName);
    });
});
