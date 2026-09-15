/**
 * A house that cannot pay its own people is a house with a reason.
 *
 * THE DEFECT, AS MEASURED. The yearly economy gives every house a real income
 * and a real payroll, and the spread across the catalog is an order of
 * magnitude. Seeded on `purse-a`, `purse-b` and `purse-c` and walked a century:
 * between one and eight of about thirty-five live houses were holding NOTHING -
 * `spirit_stones` clamped at zero, the stipend unpaid - and every one of them
 * held no vein. Nothing in the world did anything about it. A house could go
 * broke, stay broke for three hundred years, and behave exactly like the house
 * next door sitting on a mountain.
 *
 * THE RULING THESE ASSERTIONS ENCODE, in one line: a house that could not pay
 * its people reaches for the ground that would, and the reaching can fail.
 *
 * WHAT IS NOT ASSERTED, deliberately. Not which house, not which town, not how
 * many times. Those are the world's, and pinning one would pin the seed rather
 * than the rule. What is pinned is that the state is reached, that reaching it
 * changes what a house has a reason to do, that the room can still refuse, and
 * that with the motive switched off none of it happens in the same world.
 *
 * MEASURED ON THIS CHANGE, three seeds at three hundred years, both arms in one
 * command:
 *
 *     seed      acts   ground taken   people lost   acts with the motive off
 *     purse-a     13             6            26                          0
 *     purse-b      6             3            18                          0
 *     purse-c     14             3            48                          0
 *
 * The map is different between the arms in every world. It is different by more
 * than the transfers above, because turning the motive on changes which errands
 * happen at all and reseeds everything downstream - so the honest attributable
 * figure is the transfer count, not the map diff.
 */

import { describe, it, expect } from 'vitest';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import {
    A_YEAR_OF_WAGES,
    WHAT_A_HOUSE_KEEPS_IN_HAND,
    howThePurseIsRunning,
    whetherTheHouseReaches,
    whichGroundWouldPayIt,
    type GroundThatPays
} from '../../../src/engine/world/what-a-house-does-when-it-cannot-pay.js';
import {
    reasonsOpenTo,
    type HouseAsItStands
} from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { whatAHouseHasOnItsBoard } from '../../../src/engine/encounters/what-a-house-has-on-its-board.js';
import { A_STIPEND_PER_MEMBER_PER_YEAR } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE PURSE, READ AGAINST WHAT THE HOUSE OWES ITS OWN PEOPLE
// ─────────────────────────────────────────────────────────────────────────

describe('a purse is read in years of the wages it owes', () => {
    it('separates a house that cannot pay from one that merely could not for long', () => {
        const payroll = 1_000;
        expect(howThePurseIsRunning(0, payroll)).toBe('cannot_pay');
        expect(howThePurseIsRunning(payroll * A_YEAR_OF_WAGES - 1, payroll)).toBe('cannot_pay');
        expect(howThePurseIsRunning(payroll * A_YEAR_OF_WAGES, payroll)).toBe('thinning');
        expect(howThePurseIsRunning(
            payroll * WHAT_A_HOUSE_KEEPS_IN_HAND - 1, payroll)).toBe('thinning');
        expect(howThePurseIsRunning(
            payroll * WHAT_A_HOUSE_KEEPS_IN_HAND, payroll)).toBe('solvent');
    });

    it('is a ratio and not a sum, so the same purse reads differently by house size', () => {
        // The whole reason the band is years rather than stones: a thousand
        // stones is a fortune to a house of four and a fortnight to one of
        // forty. A figure in stones would have called both the same thing.
        const small = 4 * A_STIPEND_PER_MEMBER_PER_YEAR;
        const large = 40 * A_STIPEND_PER_MEMBER_PER_YEAR;
        expect(howThePurseIsRunning(1_000, small)).toBe('solvent');
        expect(howThePurseIsRunning(1_000, large)).toBe('cannot_pay');
    });

    it('calls a house that owes nobody anything solvent rather than broke', () => {
        // A body with an empty roll has no wages to be short of. Answering
        // `cannot_pay` here would have given every folded shell in the world a
        // reason to march.
        expect(howThePurseIsRunning(0, 0)).toBe('solvent');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE MOTIVE IS THE PREDICATE, AND THERE IS NO BRANCH ANYWHERE ELSE
// ─────────────────────────────────────────────────────────────────────────

const A_HOUSE: HouseAsItStands = {
    id: 'house-under-test',
    name: 'The Test Hall',
    holdsGround: false,
    standing: {},
    hasAFind: false
};

function reasonIds(house: HouseAsItStands): string[] {
    return reasonsOpenTo(house).map(r => r.id);
}

describe('only a house that cannot pay has the reason', () => {
    const TAKING = 'sending-to-take-the-ground-that-pays';

    it('does not offer it to a solvent house', () => {
        expect(reasonIds(A_HOUSE)).not.toContain(TAKING);
        expect(reasonIds({ ...A_HOUSE, knowsGroundThatWouldPayIt: true })).not.toContain(TAKING);
    });

    it('does not offer it to a broke house with nowhere to reach', () => {
        // Two facts and not one. A house that cannot pay and has nowhere to go
        // scatters or folds, and a single flag would have said it was marching.
        expect(reasonIds({ ...A_HOUSE, cannotPayItsPeople: true })).not.toContain(TAKING);
    });

    it('offers it to a broke house standing near ground that would pay it', () => {
        expect(reasonIds({
            ...A_HOUSE, cannotPayItsPeople: true, knowsGroundThatWouldPayIt: true
        })).toContain(TAKING);
    });

    it('puts it on the house board, so somebody standing there can read it', () => {
        // Visibility, and it costs nothing: `whatAHouseHasOnItsBoard` already
        // reads `reasonsOpenTo`, so the motive shows up on the wall the day it
        // arises. A world event nobody can perceive is a number moving in a file.
        const broke = {
            ...A_HOUSE, cannotPayItsPeople: true, knowsGroundThatWouldPayIt: true
        };
        const posted = whatAHouseHasOnItsBoard({ house: broke, ordinal: 12 });
        const solvent = whatAHouseHasOnItsBoard({ house: A_HOUSE, ordinal: 12 });
        expect(posted.some(e => e.id.includes(TAKING))).toBe(true);
        expect(solvent.some(e => e.id.includes(TAKING))).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHICH GROUND, AND IT IS NOT A DRAW
// ─────────────────────────────────────────────────────────────────────────

function ground(name: string, pays: number): GroundThatPays {
    return {
        locationId: `loc-${name}`,
        name,
        paysAYear: pays,
        heldById: null,
        heldByName: null,
        theirPowerOrdinal: 0
    };
}

describe('which ground a house reaches for is read off what it owes', () => {
    const board = [ground('hamlet', 200), ground('town', 900), ground('city', 1_800)];

    it('takes the smallest thing that would cover the payroll', () => {
        expect(whichGroundWouldPayIt(board, 500)?.name).toBe('town');
        expect(whichGroundWouldPayIt(board, 1_000)?.name).toBe('city');
    });

    it('takes the biggest thing there is when nothing would cover it', () => {
        // Surviving another decade of the problem is not the same as fixing it,
        // and a house with nothing that would fix it still reaches.
        expect(whichGroundWouldPayIt(board, 5_000)?.name).toBe('city');
    });

    it('answers differently for two houses looking at the same province', () => {
        // The whole of why this is a fact rather than a roll.
        expect(whichGroundWouldPayIt(board, 150)?.name)
            .not.toBe(whichGroundWouldPayIt(board, 1_500)?.name);
    });

    it('has nothing to say about a province with nothing in it', () => {
        expect(whichGroundWouldPayIt([], 500)).toBeNull();
        expect(whichGroundWouldPayIt([ground('ruin', 0)], 500)).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE ELDERS DECIDE, AND THE PURSE MOVES THEM
// ─────────────────────────────────────────────────────────────────────────

describe('the room is what makes one house march and the next one sit still', () => {
    const roll = [
        { id: 'head', rankIndex: 4 },
        { id: 'elder-a', rankIndex: 3 },
        { id: 'elder-b', rankIndex: 3 }
    ];

    function asked(purse: 'solvent' | 'thinning' | 'cannot_pay', reading: number): boolean {
        return whetherTheHouseReaches({
            what: 'taking_ground_that_pays',
            purse,
            roll,
            rankCount: 5,
            readingOf: () => reading
        }).reaches;
    }

    it('refuses a room of ordinary people while the house is solvent', () => {
        expect(asked('solvent', 0)).toBe(false);
        expect(asked('thinning', 0)).toBe(false);
    });

    it('agrees with the same room once the house cannot pay', () => {
        expect(asked('cannot_pay', 0)).toBe(true);
    });

    it('still refuses a close-handed room that cannot pay', () => {
        // The house's own character survives the emergency. This is what makes
        // "how many acted" smaller than "how many could have".
        expect(asked('cannot_pay', -0.6)).toBe(false);
    });

    it('does nothing at all where there is no room to ask', () => {
        const said = whetherTheHouseReaches({
            what: 'taking_ground_that_pays',
            purse: 'cannot_pay',
            roll: [],
            rankCount: 5
        });
        expect(said.reaches).toBe(false);
        expect(said.answer.leaning).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE WORLD, BOTH ARMS IN ONE COMMAND
// ─────────────────────────────────────────────────────────────────────────

const HORIZON_YEARS = 250;
const SEED = 'purse-a';

interface Arm {
    state: WorldState;
    acts: { summary: string; took: boolean; lost: number }[];
}

async function arm(actOnAnEmptyPurse: boolean): Promise<Arm> {
    const catalog = await loadCultivationCatalog();
    const { state } = seedWorld({ seed: SEED, catalog });
    advanceWorldYears(state, HORIZON_YEARS, {
        stopOnInterrupt: false,
        pressure: { housesActOnAnEmptyPurse: actOnAnEmptyPurse }
    });
    return {
        state,
        acts: state.history.facts
            .filter(f => f.data?.becauseItCannotPay === true)
            .map(f => ({
                summary: f.summary,
                took: f.data?.took === true,
                lost: Number(f.data?.lost ?? 0)
            }))
    };
}

describe('a world where houses act on an empty purse, against one where they do not', () => {
    let both: Promise<{ on: Arm; off: Arm }> | null = null;
    function arms() {
        both ??= (async () => ({ on: await arm(true), off: await arm(false) }))();
        return both;
    }

    it('reaches the state at all, and names the houses that did', async () => {
        const { on } = await arms();
        const payrollOf = (id: string): number => {
            let members = 0;
            for (const n of on.state.npcs) {
                if (n.status === 'alive' && n.factionId === id) members++;
            }
            return members * A_STIPEND_PER_MEMBER_PER_YEAR;
        };
        const broke = on.state.factions.filter(f =>
            f.dissolvedOnDay === null
            && howThePurseIsRunning(
                Number(f.resources.spirit_stones ?? 0), payrollOf(f.id)) === 'cannot_pay');
        // The condition is reachable and is not the whole world. Both halves
        // matter: an unreachable state is content nothing can get to, and a
        // universal one is not a state.
        expect(broke.length, 'no house in the world ever ran out of money').toBeGreaterThan(0);
        expect(broke.length).toBeLessThan(
            on.state.factions.filter(f => f.dissolvedOnDay === null).length);
    }, 900_000);

    it('acts on it, and the acting can fail', async () => {
        const { on } = await arms();
        expect(on.acts.length, 'nobody ever acted on an empty purse').toBeGreaterThan(0);
        expect(
            on.acts.some(a => !a.took),
            'every reach succeeded, which means nothing was at risk'
        ).toBe(true);
        expect(
            on.acts.filter(a => !a.took).reduce((s, a) => s + a.lost, 0),
            'a failed reach cost the house nobody'
        ).toBeGreaterThan(0);
    }, 900_000);

    it('moves ground, so the map says it happened', async () => {
        const { on } = await arms();
        const took = on.acts.filter(a => a.took);
        expect(took.length, 'no ground ever changed hands over a payroll').toBeGreaterThan(0);
    }, 900_000);

    it('does none of it with the motive switched off', async () => {
        const { off } = await arms();
        expect(off.acts.length).toBe(0);
    }, 900_000);

    it('leaves a different map behind', async () => {
        const { on, off } = await arms();
        const held = (state: WorldState): string => state.locations
            .filter(l => (l.kind === 'settlement' || l.kind === 'vein') && l.controllingFactionId)
            .map(l => `${l.id}=${l.controllingFactionId}`)
            .sort()
            .join(',');
        expect(held(on.state)).not.toBe(held(off.state));
    }, 900_000);
});
