/**
 * Authority inside a house.
 *
 * Found by playtesting: a cultivator driven to `Sect Warden`, the top rung of
 * the Azure Dew Sect, could do nothing with it. "I order the disciples to gather
 * herbs" routed to a personal foraging action and the head of the house went and
 * picked herbs himself; "I expel an elder from the sect" did not parse at all.
 * The top of the ladder was a title and a bigger stipend, and the rungs below it
 * were worth nothing but a smaller one.
 *
 * These tests are about the shape of the replacement rather than its tuning:
 * that authority is the rank index and reaches every lower rung, that the elder
 * rung is derived from the ladder and lands on the real elders of every house in
 * the catalog, that backlash escalates in one order and is visible before it
 * bites, that a patient leader can eventually do all of it, and that an
 * impatient one loses the house.
 */

import { describe, it, expect } from 'vitest';
import { SECTS, getSect } from '../../../src/data/cultivation/sects.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import {
    BACKLASH_ORDER,
    CHALLENGE_AT,
    DEPARTURE_AT,
    ELDER_RUNG_FRACTION,
    ERRANDS,
    GRUMBLING_AT,
    OBSTRUCTION_AT,
    REMOVAL_AT,
    STANDING_CEILING,
    STANDING_FLOOR,
    STANDING_ON_JOINING,
    admissionCeilingFor,
    admissionChangeCost,
    affordable,
    authorityTier,
    backlashLevel,
    canOrder,
    challengeOutcome,
    commandableHands,
    curriculumChangeCost,
    departuresAt,
    distributeFollowing,
    elderRungOf,
    errandCost,
    expulsionCost,
    externalElderCost,
    holdsTheSeat,
    impliedHouseSize,
    isElderRank,
    obstructionChance,
    planDiscipleIntake,
    planGrowth,
    powerOrdinalDrift,
    powersAt,
    resolveAct,
    resolveErrand,
    rosterByRung,
    shieldedCost,
    standingAfterYears,
    type ActCost,
    type ElderFollowing,
    type HouseState
} from '../../../src/engine/cultivation/leadership.js';

/** The house playtesting actually broke on. Five rungs, admits at nothing. */
const DEW = 'sect-azure-dew-sect';

function dewHouse(overrides: Partial<HouseState> = {}): HouseState {
    const sect = getSect(DEW)!;
    const size = impliedHouseSize(sect.ranks.length);
    const rungs = [3, 3];
    const shares = distributeFollowing(rungs, size - rungs.length - 1);
    const elders: ElderFollowing[] = rungs.map((r, i) => ({
        id: `elder-${i}`,
        rankIndex: r,
        following: shares[i],
        source: 'house'
    }));
    return {
        standing: STANDING_ON_JOINING,
        elders,
        houseSize: size,
        ownFollowing: 0,
        hasPatron: true,
        holdsTheSeat: true,
        ...overrides
    };
}

// ─────────────────────────────────────────────────────────────────────────
// THE GENERAL RULE
// ─────────────────────────────────────────────────────────────────────────

describe('authority is the rank index', () => {
    it('reaches every lower rung in the same house and nothing at or above', () => {
        for (let giver = 0; giver < 6; giver++) {
            for (let receiver = 0; receiver < 6; receiver++) {
                expect(canOrder(giver, receiver), `${giver} -> ${receiver}`)
                    .toBe(receiver < giver);
            }
        }
    });

    it('gives the bottom rung nobody to send', () => {
        expect(powersAt(0, 5)).toEqual([]);
        expect(authorityTier(0, 5)).toBe('ordered');
    });

    it('opens ordering at rung one, decades before any leadership content', () => {
        // The playtest finding: an Outer Disciple of a five-rung house can send
        // servants for herbs, and that is the first thing membership buys.
        expect(powersAt(1, 5)).toContain('order');
        expect(authorityTier(1, 5)).toBe('ordering');
        expect(powersAt(1, 5)).not.toContain('recruit_disciples');
    });

    it('walks the Azure Dew ladder exactly as the house describes itself', () => {
        const ranks = getSect(DEW)!.ranks;
        const tiers = ranks.map((_, i) => authorityTier(i, ranks.length));
        expect(tiers).toEqual(['ordered', 'ordering', 'ordering', 'elder', 'seat']);
    });

    it('is cumulative: every tier holds what the tier below holds', () => {
        for (const rankCount of [3, 4, 5, 6]) {
            for (let i = 1; i < rankCount; i++) {
                const below = powersAt(i - 1, rankCount);
                const here = powersAt(i, rankCount);
                for (const power of below) {
                    expect(here, `rung ${i} of ${rankCount}`).toContain(power);
                }
            }
        }
    });
});

describe('the elder rung is derived from the ladder, not hardcoded', () => {
    it('lands on the rung every house in the catalog calls its elders', () => {
        // Ladders run four rungs to six here, and the elder sits at a different
        // index in each. A fraction is the only thing that gets all of them.
        for (const sect of SECTS) {
            const rung = elderRungOf(sect.ranks.length);
            expect(rung, sect.id).toBeGreaterThan(0);
            expect(rung, sect.id).toBeLessThanOrEqual(sect.ranks.length - 1);
        }
        expect(getSect(DEW)!.ranks[elderRungOf(5)]).toBe('Dew Elder');
        expect(getSect('sect-azure-cloud-pavilion')!.ranks[elderRungOf(6)]).toBe('Sword Elder');
        expect(getSect('sect-hollow-bell-wanderers')!.ranks[elderRungOf(5)]).toBe('Road Elder');
        expect(getSect('sect-hollow-court')!.ranks[elderRungOf(4)]).toBe('Elder');
    });

    it('sits at the same relative height whatever the ladder length', () => {
        for (const rankCount of [3, 4, 5, 6, 8]) {
            const height = elderRungOf(rankCount) / (rankCount - 1);
            expect(height, `ladder of ${rankCount}`).toBeGreaterThanOrEqual(ELDER_RUNG_FRACTION - 0.2);
            expect(height, `ladder of ${rankCount}`).toBeLessThanOrEqual(1);
        }
    });

    it('gives the seat every power and reserves four of them to it', () => {
        for (const sect of SECTS) {
            const top = sect.ranks.length - 1;
            expect(holdsTheSeat(top, sect.ranks.length), sect.id).toBe(true);
            expect(isElderRank(top, sect.ranks.length), sect.id).toBe(true);
            const seat = powersAt(top, sect.ranks.length);
            expect(seat, sect.id).toContain('set_admission');
            expect(seat, sect.id).toContain('set_curriculum');
            expect(seat, sect.id).toContain('expel_elder');
            expect(seat, sect.id).toContain('grow');
            expect(powersAt(top - 1, sect.ranks.length), sect.id).not.toContain('expel_elder');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE SHAPE OF A HOUSE
// ─────────────────────────────────────────────────────────────────────────

describe('a house is a pyramid, which is why authority is worth anything', () => {
    it('seats everybody, with exactly one on the top rung', () => {
        for (const sect of SECTS) {
            const size = impliedHouseSize(sect.ranks.length);
            const roster = rosterByRung(size, sect.ranks.length);
            expect(roster.reduce((a, b) => a + b, 0), sect.id).toBe(size);
            expect(roster[sect.ranks.length - 1], sect.id).toBe(1);
        }
    });

    it('never puts more people on a rung than on the one below it', () => {
        const roster = rosterByRung(impliedHouseSize(6), 6);
        for (let i = 1; i < roster.length; i++) {
            expect(roster[i]).toBeLessThanOrEqual(roster[i - 1]);
        }
    });

    it('gives a more senior rung more hands to call on', () => {
        const size = impliedHouseSize(5);
        const outer = commandableHands(1, 0, size, 5);
        const inner = commandableHands(2, 0, size, 5);
        const seat = commandableHands(4, 0, size, 5);
        expect(outer).toBeGreaterThan(0);
        expect(inner).toBeGreaterThan(outer);
        expect(seat).toBeGreaterThan(inner);
    });

    it('gives nobody hands from a rung at or above their own', () => {
        const size = impliedHouseSize(5);
        expect(commandableHands(2, 2, size, 5)).toBe(0);
        expect(commandableHands(2, 3, size, 5)).toBe(0);
        expect(commandableHands(0, 0, size, 5)).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ORDERING
// ─────────────────────────────────────────────────────────────────────────

describe('an order spends somebody else\'s days and a little of their goodwill', () => {
    it('scales linearly in hands and days, so ten times the herbs needs the rank for it', () => {
        const one = resolveErrand({ errand: 'gather', hands: 1, days: 10, toRankIndex: 0 });
        const ten = resolveErrand({ errand: 'gather', hands: 10, days: 10, toRankIndex: 0 });
        expect(ten.handDays).toBe(one.handDays * 10);
        expect(ten.standingCost).toBeCloseTo(one.standingCost * 10, 6);
    });

    it('returns more from a senior rung than from the servants', () => {
        const servants = resolveErrand({ errand: 'carry', hands: 4, days: 30, toRankIndex: 0 });
        const inner = resolveErrand({ errand: 'carry', hands: 4, days: 30, toRankIndex: 2 });
        expect(inner.delivered).toBeGreaterThan(servants.delivered);
    });

    it('costs something every time, because people notice being used', () => {
        for (const errand of Object.keys(ERRANDS) as (keyof typeof ERRANDS)[]) {
            const result = resolveErrand({ errand, hands: 5, days: 30, toRankIndex: 0 });
            expect(result.standingCost, errand).toBeGreaterThan(0);
            expect(errandCost(errand, result).standingCost, errand).toBeGreaterThan(0);
        }
    });

    it('lets a rung that orders constantly run itself into obstruction', () => {
        // The bottom of the escalation, and it is the same escalation the head
        // of the house is on. An unpopular Inner Disciple finds the outer
        // disciples have become slow.
        let house = dewHouse({ holdsTheSeat: false, ownFollowing: 0 });
        let outcome = resolveAct(house, errandCost('gather', resolveErrand(
            { errand: 'gather', hands: 8, days: 30, toRankIndex: 0 }
        )));
        let orders = 1;
        while (outcome.obstructionChance === 0 && orders < 500) {
            house = { ...house, standing: outcome.standingAfter };
            outcome = resolveAct(house, errandCost('gather', resolveErrand(
                { errand: 'gather', hands: 8, days: 30, toRankIndex: 0 }
            )));
            orders++;
        }
        expect(orders).toBeLessThan(500);
        expect(outcome.obstructionChance).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// FOLLOWINGS
// ─────────────────────────────────────────────────────────────────────────

describe('every elder has a following, and it is the arithmetic behind everything', () => {
    it('places every disciple with somebody and invents none', () => {
        for (const unattached of [0, 1, 7, 40, 137]) {
            const shares = distributeFollowing([2, 3, 3, 4], unattached);
            expect(shares.reduce((a, b) => a + b, 0)).toBe(unattached);
        }
    });

    it('gives the senior elder the larger line', () => {
        const shares = distributeFollowing([2, 4], 100);
        expect(shares[1]).toBeGreaterThan(shares[0]);
    });

    it('is deterministic, so a player can read the house before crossing anybody', () => {
        expect(distributeFollowing([2, 3, 4], 61)).toEqual(distributeFollowing([2, 3, 4], 61));
    });

    it('prices a dismissal off the following rather than a flat penalty', () => {
        const small = expulsionCost(2, 64, 0);
        const large = expulsionCost(32, 64, 0);
        expect(large.standingCost).toBeGreaterThan(small.standingCost * 1.5);
    });

    it('charges more for each elder already dismissed, because the rest can count', () => {
        const first = expulsionCost(10, 64, 0);
        const fourth = expulsionCost(10, 64, 3);
        expect(fourth.standingCost).toBeGreaterThan(first.standingCost * 3);
    });

    it('lands the day it is spoken, which is why the price is all on the far side', () => {
        expect(expulsionCost(10, 64, 0).years).toBe(0);
        expect(admissionChangeCost(0, 3).years).toBeGreaterThan(0);
        expect(curriculumChangeCost(['a'], ['b'], null).years).toBeGreaterThan(0);
    });
});

describe('a following is armour', () => {
    it('discounts every act in proportion to the share of the house you brought in', () => {
        const raw = 40;
        expect(shieldedCost(raw, 0, 64)).toBe(raw);
        expect(shieldedCost(raw, 32, 64)).toBeLessThan(raw);
        expect(shieldedCost(raw, 32, 64)).toBeLessThan(shieldedCost(raw, 8, 64));
    });

    it('is insulation and never immunity', () => {
        // Even a head who recruited the whole house pays real money to retire a
        // scripture. The people they did not recruit will not be talked round.
        expect(shieldedCost(40, 64, 64)).toBeGreaterThan(0);
        expect(shieldedCost(40, 640, 64)).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// BACKLASH
// ─────────────────────────────────────────────────────────────────────────

describe('backlash is graduated and escalates in one order', () => {
    it('orders its thresholds strictly downward', () => {
        expect(GRUMBLING_AT).toBeGreaterThan(OBSTRUCTION_AT);
        expect(OBSTRUCTION_AT).toBeGreaterThan(DEPARTURE_AT);
        expect(DEPARTURE_AT).toBeGreaterThan(CHALLENGE_AT);
        expect(CHALLENGE_AT).toBeGreaterThan(REMOVAL_AT);
        expect(REMOVAL_AT).toBeGreaterThan(STANDING_FLOOR);
    });

    it('never skips a rung and never goes back up as standing falls', () => {
        let previous = -1;
        for (let standing = STANDING_CEILING; standing >= STANDING_FLOOR; standing--) {
            const index = BACKLASH_ORDER.indexOf(backlashLevel(standing, true));
            expect(index, `standing ${standing}`).toBeGreaterThanOrEqual(previous);
            expect(index - previous, `standing ${standing}`).toBeLessThanOrEqual(1);
            previous = index;
        }
        expect(BACKLASH_ORDER[previous]).toBe('removal');
    });

    it('telegraphs before it costs anything', () => {
        // Grumbling fires while standing is still positive, so nobody is
        // ambushed by the first obstruction.
        expect(GRUMBLING_AT).toBeGreaterThan(0);
        expect(backlashLevel(GRUMBLING_AT, false)).toBe('grumbling');
        expect(obstructionChance(GRUMBLING_AT)).toBe(0);
    });

    it('stops at a challenge for a house that answers to nobody', () => {
        expect(backlashLevel(REMOVAL_AT - 20, false)).toBe('challenge');
        expect(backlashLevel(REMOVAL_AT - 20, true)).toBe('removal');
    });

    it('takes its odds from accumulated standing and nothing else', () => {
        expect(obstructionChance(1)).toBe(0);
        expect(obstructionChance(OBSTRUCTION_AT)).toBe(0);
        expect(obstructionChance(DEPARTURE_AT)).toBe(1);
        expect(obstructionChance(DEPARTURE_AT / 2)).toBeGreaterThan(0);
        expect(obstructionChance(DEPARTURE_AT / 2)).toBeLessThan(1);
    });

    it('reads departures off state rather than rolling them', () => {
        const elders: ElderFollowing[] = [
            { id: 'a', rankIndex: 3, following: 4, source: 'house' },
            { id: 'b', rankIndex: 3, following: 30, source: 'house' },
            { id: 'c', rankIndex: 3, following: 12, source: 'house' }
        ];
        expect(departuresAt(0, elders).leaving).toHaveLength(0);
        const first = departuresAt(DEPARTURE_AT - 1, elders);
        // The one with somewhere to go is the one who can afford to walk, so
        // the leader loses the biggest bite first.
        expect(first.leaving.map(e => e.id)).toEqual(['b']);
        expect(first.disciplesLost).toBe(30);

        const all = departuresAt(CHALLENGE_AT, elders);
        expect(all.leaving).toHaveLength(3);
        expect(all.disciplesLost).toBe(46);
    });

    it('lands on the head\'s elders and on a lower rung\'s own disciples', () => {
        const cost: ActCost = {
            act: 'order', standingCost: 200, standingEarned: 0, years: 0, insult: 'x'
        };
        const head = resolveAct(dewHouse({ standing: 0 }), cost);
        expect(head.eldersLeaving.length).toBeGreaterThan(0);
        expect(head.ownFollowingLost).toBe(0);
        expect(head.seatChallenged).toBe(true);
        expect(head.dismissedFromTheHouse).toBe(false);

        const disciple = resolveAct(
            dewHouse({ standing: 0, holdsTheSeat: false, ownFollowing: 12 }),
            cost
        );
        expect(disciple.eldersLeaving).toHaveLength(0);
        expect(disciple.ownFollowingLost).toBeGreaterThan(0);
        expect(disciple.seatChallenged).toBe(false);
        expect(disciple.dismissedFromTheHouse).toBe(true);
    });

    it('spends the standing whether or not the act lands', () => {
        // An order that was ignored was still given, and the giving is what cost.
        const house = dewHouse();
        const outcome = resolveAct(house, admissionChangeCost(0, 5));
        expect(outcome.standingAfter).toBeLessThan(house.standing);
        expect(outcome.standingSpent).toBeGreaterThan(0);
    });

    it('never reports a standing outside the scale', () => {
        const enormous: ActCost = {
            act: 'grow', standingCost: 0, standingEarned: 10_000, years: 0, insult: 'x'
        };
        expect(resolveAct(dewHouse(), enormous).standingAfter).toBe(STANDING_CEILING);
        const ruinous: ActCost = {
            act: 'expel_elder', standingCost: 10_000, standingEarned: 0, years: 0, insult: 'x'
        };
        expect(resolveAct(dewHouse(), ruinous).standingAfter).toBe(STANDING_FLOOR);
    });

    it('settles a challenge off state, so a leader who also cultivated keeps the seat', () => {
        expect(challengeOutcome(30, 24).held).toBe(true);
        expect(challengeOutcome(20, 24).held).toBe(false);
        expect(challengeOutcome(24, 24).held).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE STANDARD AND THE METHODS
// ─────────────────────────────────────────────────────────────────────────

describe('the recruitment standard', () => {
    it('charges the distance, so there is no free direction', () => {
        expect(admissionChangeCost(4, 8).standingCost)
            .toBe(admissionChangeCost(8, 4).standingCost);
        expect(admissionChangeCost(4, 4).standingCost).toBe(0);
    });

    it('never lets a house set a bar that strands its own top rank', () => {
        // `promote` measures every rung from the admission ordinal, so a bar set
        // too high makes the last promotion unreachable for anybody alive.
        for (const sect of SECTS) {
            const ceiling = admissionCeilingFor(sect.ranks.length, 4, MAX_ORDINAL);
            expect(ceiling + (sect.ranks.length - 1) * 4, sect.id).toBeLessThanOrEqual(MAX_ORDINAL);
            expect(ceiling, sect.id).toBeGreaterThanOrEqual(sect.admissionOrdinal);
        }
    });

    it('couples to recruitment: a higher bar is a slower intake', () => {
        const open = planDiscipleIntake(3, 0, 2);
        const closed = planDiscipleIntake(3, 29, 2);
        expect(closed.years).toBeGreaterThan(open.years * 5);
        expect(open.count).toBe(3);
    });
});

describe('the foundational methods', () => {
    it('costs more to retire something than to add something', () => {
        const added = curriculumChangeCost(['a'], ['a', 'b'], null);
        const retired = curriculumChangeCost(['a', 'b'], ['a'], null);
        expect(retired.standingCost).toBeGreaterThan(added.standingCost);
    });

    it('charges most for retiring the art the house is known for', () => {
        const sect = getSect(DEW)!;
        const signature = sect.signatureTechniqueId!;
        const ordinary = curriculumChangeCost(
            sect.teaches, sect.teaches.filter(t => t !== 'foundation-tempering-scripture'), signature
        );
        const theirs = curriculumChangeCost(
            sect.teaches, sect.teaches.filter(t => t !== signature), signature
        );
        expect(theirs.standingCost).toBeGreaterThan(ordinary.standingCost);
    });

    it('is generational, and lands over decades rather than on the day', () => {
        const cost = curriculumChangeCost(['a'], ['b'], null);
        expect(cost.years).toBeGreaterThanOrEqual(30);
    });

    it('costs nothing and takes no time when nothing actually changed', () => {
        const cost = curriculumChangeCost(['a', 'b'], ['b', 'a'], 'a');
        expect(cost.standingCost).toBe(0);
        expect(cost.years).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// GROWTH
// ─────────────────────────────────────────────────────────────────────────

describe('growing the house is the only act that earns credit', () => {
    it('earns rather than spends', () => {
        const plan = planGrowth(64, 2, 2, 3, 'seat');
        expect(plan.standingEarned).toBeGreaterThan(0);
        expect(plan.intake).toBeGreaterThan(0);
    });

    it('is slow and expensive, and compounds', () => {
        const one = planGrowth(64, 2, 2, 1, 'seat');
        const five = planGrowth(64, 2, 2, 5, 'seat');
        expect(one.years).toBe(10);
        expect(five.years).toBe(50);
        expect(five.intake).toBeGreaterThan(one.intake * 5);
        expect(five.stonesRequired).toBeGreaterThan(0);
    });

    it('makes delegation the interesting decision: faster, cheaper in credit, theirs', () => {
        const seat = planGrowth(64, 2, 2, 3, 'seat');
        const elders = planGrowth(64, 2, 2, 3, 'elders');
        expect(elders.intake).toBeGreaterThan(seat.intake);
        expect(elders.standingEarned).toBeLessThan(seat.standingEarned);
        expect(seat.attachesTo).toBe('the leader');
        expect(elders.attachesTo).toBe('the elders');
    });

    it('draws more intake to a house with a wider working library', () => {
        const narrow = planGrowth(64, 2, 2, 5, 'seat');
        const wide = planGrowth(64, 2, 9, 5, 'seat');
        expect(wide.intake).toBeGreaterThan(narrow.intake);
    });

    it('moves the house\'s standing power slowly and in both directions', () => {
        expect(powerOrdinalDrift(64, 64)).toBe(0);
        expect(powerOrdinalDrift(128, 64)).toBe(1);
        expect(powerOrdinalDrift(32, 64)).toBe(-1);
        expect(powerOrdinalDrift(64_000, 64)).toBeLessThanOrEqual(4);
        expect(powerOrdinalDrift(1, 64_000)).toBeGreaterThanOrEqual(-4);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE TWO LEADERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * The head of a house, doing all four things the seat can do.
 *
 * `waitYears` is the whole difference between the two runs below. A leader who
 * lets the house forget between fights can have everything; one who does not
 * cannot have any of it.
 */
function reign(
    house: HouseState,
    waitYears: number
): { years: number; landed: number; ended: string } {
    const sect = getSect(DEW)!;
    const acts: ActCost[] = [
        admissionChangeCost(sect.admissionOrdinal, sect.admissionOrdinal + 3),
        curriculumChangeCost(sect.teaches, [...sect.teaches, 'iron-thread-finger'], sect.signatureTechniqueId),
        expulsionCost(house.elders[0]?.following ?? 0, house.houseSize, 0),
        curriculumChangeCost(
            sect.teaches,
            sect.teaches.filter(t => t !== sect.signatureTechniqueId),
            sect.signatureTechniqueId
        ),
        externalElderCost(1, 0),
        expulsionCost(house.elders[1]?.following ?? 0, house.houseSize, 1)
    ];

    let current = house;
    let years = 0;
    let landed = 0;
    let ended = 'held the seat';

    for (const act of acts) {
        // A patient leader waits for the house to forget; an impatient one does
        // not, and `waitYears` of zero means the waiting never happens.
        let waited = 0;
        while (waitYears > 0 && !affordable(current, act).safe && waited < 400) {
            current = { ...current, standing: standingAfterYears(current.standing, waitYears) };
            years += waitYears;
            waited += waitYears;
        }

        const outcome = resolveAct(current, act);
        current = { ...current, standing: outcome.standingAfter };
        years += outcome.years;

        if (outcome.eldersLeaving.length > 0) {
            const goneIds = new Set(outcome.eldersLeaving.map(e => e.id));
            current = {
                ...current,
                elders: current.elders.filter(e => !goneIds.has(e.id)),
                houseSize: Math.max(
                    1, current.houseSize - outcome.eldersLeaving.length - outcome.disciplesLeaving
                )
            };
        }
        if (outcome.removedByPatron) { ended = 'removed by the patron'; break; }
        if (outcome.seatChallenged) { ended = 'the seat was challenged'; break; }
        if (outcome.obstructionChance > 0) { ended = 'obstructed'; }
        landed++;
    }

    return { years, landed, ended };
}

describe('a patient leader can eventually do all of it', () => {
    it('does every act, keeps the seat, and never spends past obstruction', () => {
        // Not a trap. A head who spends credit well ends up with the standard
        // they wanted, the library they wanted, and elders who are theirs.
        const run = reign(dewHouse({ ownFollowing: 0 }), 5);
        expect(run.landed).toBe(6);
        expect(run.ended).toBe('held the seat');
        // Long, because none of it is instant, and well inside a cultivator's life.
        expect(run.years).toBeGreaterThan(100);
        expect(run.years).toBeLessThan(1_000);
    });

    it('does it faster with a following built as an elder first', () => {
        const bare = reign(dewHouse({ ownFollowing: 0 }), 5);
        const backed = reign(dewHouse({ ownFollowing: 24 }), 5);
        expect(backed.landed).toBe(6);
        expect(backed.years).toBeLessThan(bare.years);
    });
});

describe('an impatient leader loses the house', () => {
    it('runs out of credit and is removed by the patron', () => {
        const run = reign(dewHouse({ ownFollowing: 0 }), 0);
        expect(run.landed).toBeLessThan(6);
        expect(['removed by the patron', 'the seat was challenged']).toContain(run.ended);
    });

    it('gets a challenge rather than a letter when nobody stands above the house', () => {
        const run = reign(dewHouse({ ownFollowing: 0, hasPatron: false }), 0);
        expect(run.ended).toBe('the seat was challenged');
    });

    it('shrinks the house it was trying to grow', () => {
        // The punch: departures take the biggest lines first, so the leader
        // loses precisely the part they were building.
        const house = dewHouse({ standing: DEPARTURE_AT + 1 });
        const outcome = resolveAct(house, expulsionCost(20, house.houseSize, 2));
        expect(outcome.eldersLeaving.length).toBeGreaterThan(0);
        expect(outcome.disciplesLeaving).toBeGreaterThan(0);
    });
});
