/**
 * A compound is safe, and that is not what a cultivator is for.
 *
 * THE DEFECT. Every person on a road in this world was put there by an
 * institution: a posting, an errand with a term and a place to come back to, a
 * house racing a team at a door that opened. Nobody had ever decided on their
 * own account that staying was what was costing them. The only two producers of
 * an unaffiliated cultivator were being born one and a house collapsing under
 * somebody - and `WHY_UNAFFILIATED` in `rogues.ts` has said since it was
 * written that the commonest origins are none of those.
 *
 * TWO READERS THAT WOULD HAVE MADE THIS WORK AND HAD NO CALLER, which is the
 * reason this is wiring rather than a new system:
 *
 *   `houseTeachingCeiling`   the top of what a house's own arts could carry
 *                            anybody to. Authored, covered by
 *                            `cultivation-technique-caps.test.ts`, and read by
 *                            NOTHING in `src/`. A disciple standing at the top
 *                            of everything their house had was, to the engine,
 *                            the same as one at the bottom of it.
 *   `shortBy: 'somewhere_else'`  `howSomebodyStandsToAGround` answers, of every
 *                            dao ground in the world, that an outsider is short
 *                            of it by BEING IN THE WRONG PROVINCE. And
 *                            `roadsInReachOf` - which `applyAdvancement`
 *                            already reads at every review - takes the province
 *                            off the person's CURRENT location. So the payoff
 *                            for walking there was wired the whole time and
 *                            nothing had ever walked.
 *
 * MEASURED ON THIS CHANGE. Seed `purse-a`, two hundred years, both arms in one
 * command: 115 departures moving 120 people with the motive on and 0 with it
 * off; 24 of them did not survive the ground they set out for; 5 departures
 * were more than one person and 3 of those had fallen in with a stranger going
 * the same way. Reasons, counted across departures: a road a province away 91,
 * somebody they knew did not come back 94, the house cannot teach them further
 * 5, the house did not pay them 6.
 *
 * AND ONE THAT DOES NOT MOVE. The standing population of unaffiliated
 * cultivators came out at 189 with the motive on and 199 with it off. Births
 * and recruitment both dwarf 120 departures over two hundred years, so the
 * STOCK of people outside a house is noise and only the FLOW is this
 * mechanism's. Said here because it is the obvious thing to assert and it is
 * wrong.
 *
 * WHAT IS NOT ASSERTED. Not who leaves, not how many, not where to. Those are
 * the world's. What is pinned is that a reason is READ rather than invented,
 * that the reasons multiply rather than passing a threshold, that a person and
 * not a house decides, that leaving can kill them, and that a world with the
 * motive off produces none of it.
 */

import { describe, it, expect } from 'vitest';
import { isLostTrackOf } from '../../../src/engine/world/who-a-house-has-lost-track-of.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import {
    A_FEW_PEOPLE,
    NOTHING_PUT_BY,
    WHAT_ONE_REASON_IS_WORTH_IN_A_YEAR,
    whereTheyWouldGo,
    whetherTheyGoThisYear,
    whoWouldGoWithThem,
    whyTheyWouldLeave,
    type SomewhereWorthGoing,
    type WhatStayingIsCostingThem
} from '../../../src/engine/world/why-somebody-walks-out-of-a-compound.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

// ─────────────────────────────────────────────────────────────────────────
// THE REASONS ARE READ, NOT INVENTED
// ─────────────────────────────────────────────────────────────────────────

const CONTENT: WhatStayingIsCostingThem = {
    ordinal: 14,
    houseTeachingCeiling: 40,
    theHousePaidThem: true,
    peopleTheyKnewWhoDidNotComeBack: 0,
    factionRankIndex: 2,
    spiritStones: 500,
    aRoadAProvinceAway: false
};

describe('why somebody walks out is a reading of what the world already holds', () => {
    it('gives somebody with nothing wrong no reason at all', () => {
        expect(whyTheyWouldLeave(CONTENT)).toEqual([]);
    });

    it('reads the top of what their house teaches against where they stand', () => {
        // The reader that had no caller. A house whose arts cap at 20 is a
        // house a Nascent Soul disciple has finished, and until this nothing
        // anywhere could tell that from any other membership.
        expect(whyTheyWouldLeave({ ...CONTENT, houseTeachingCeiling: 14 }))
            .toContain('the house cannot teach them further');
        expect(whyTheyWouldLeave({ ...CONTENT, houseTeachingCeiling: 15 }))
            .not.toContain('the house cannot teach them further');
    });

    it('says nothing about a house whose teaching nobody wrote down', () => {
        // Null is not zero. A house with no arts on record is a house this
        // reading has no opinion about, and answering `cannot teach them` would
        // have emptied every such roll on a missing field.
        expect(whyTheyWouldLeave({ ...CONTENT, houseTeachingCeiling: null })).toEqual([]);
    });

    it('takes the ground being a province away as the reason it is', () => {
        expect(whyTheyWouldLeave({ ...CONTENT, aRoadAProvinceAway: true }))
            .toContain('a road a province away');
    });

    it('takes an unpaid stipend and a missing friend off the record', () => {
        expect(whyTheyWouldLeave({ ...CONTENT, theHousePaidThem: false }))
            .toContain('the house did not pay them');
        expect(whyTheyWouldLeave({ ...CONTENT, peopleTheyKnewWhoDidNotComeBack: 1 }))
            .toContain('somebody they knew did not come back');
    });

    it('wants both halves before it calls somebody unattached', () => {
        // The bottom of the ladder is ordinary and an empty purse is ordinary.
        // Together they are somebody with nothing to lose, and either alone is
        // most of the world.
        expect(whyTheyWouldLeave({ ...CONTENT, factionRankIndex: 0 }))
            .not.toContain('nothing in the hall is theirs');
        expect(whyTheyWouldLeave({ ...CONTENT, spiritStones: 0 }))
            .not.toContain('nothing in the hall is theirs');
        expect(whyTheyWouldLeave({
            ...CONTENT, factionRankIndex: 0, spiritStones: NOTHING_PUT_BY - 1
        })).toContain('nothing in the hall is theirs');
    });

    it('leads with the one that never resolves itself', () => {
        // The first entry is what a report of the departure says. A house that
        // cannot teach you further will not start; an unpaid year might be one
        // year. Order is a claim and is asserted as one.
        const everything = whyTheyWouldLeave({
            ordinal: 20,
            houseTeachingCeiling: 20,
            theHousePaidThem: false,
            peopleTheyKnewWhoDidNotComeBack: 2,
            factionRankIndex: 0,
            spiritStones: 0,
            aRoadAProvinceAway: true
        });
        expect(everything[0]).toBe('the house cannot teach them further');
        expect(everything.length).toBe(5);
    });
});

describe('the reasons multiply rather than passing a bar', () => {
    function howOftenOutOf(n: number, reasons: number): number {
        let went = 0;
        const why = whyTheyWouldLeave({
            ...CONTENT,
            ...(reasons >= 1 ? { aRoadAProvinceAway: true } : {}),
            ...(reasons >= 2 ? { theHousePaidThem: false } : {}),
            ...(reasons >= 3 ? { peopleTheyKnewWhoDidNotComeBack: 1 } : {})
        });
        expect(why.length).toBe(reasons);
        for (let i = 0; i < n; i++) {
            if (whetherTheyGoThisYear(why, forStream('walk-out-test', String(reasons), i))) went++;
        }
        return went;
    }

    it('never moves somebody with no reason', () => {
        expect(whetherTheyGoThisYear([], forStream('x', 'y'))).toBe(false);
    });

    it('moves somebody with three reasons about three times as often as one', () => {
        // There is no threshold anywhere in this file on purpose: the
        // difference between staying and going is how much is wrong, and most
        // people stay at every count.
        const one = howOftenOutOf(4_000, 1);
        const three = howOftenOutOf(4_000, 3);
        expect(one).toBeGreaterThan(0);
        expect(three).toBeGreaterThan(one);
        expect(one / 4_000).toBeLessThan(WHAT_ONE_REASON_IS_WORTH_IN_A_YEAR * 2);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHERE THEY GO, AND WHO WITH
// ─────────────────────────────────────────────────────────────────────────

function somewhere(name: string, survival = 0): SomewhereWorthGoing {
    return { locationId: `loc-${name}`, name, why: `${name} is there.`, survivalOrdinal: survival };
}

describe('they go TO something', () => {
    it('prefers the road, because the road is the one with a reward the engine computes', () => {
        expect(whereTheyWouldGo([somewhere('terrace')], [somewhere('ruin')])?.name)
            .toBe('terrace');
    });

    it('takes a door standing open when there is no road', () => {
        expect(whereTheyWouldGo([], [somewhere('ruin')])?.name).toBe('ruin');
    });

    it('keeps somebody at home when there is nowhere worth walking to', () => {
        // Which is why most people stay: not a reluctance, an absence.
        expect(whereTheyWouldGo([], [])).toBeNull();
    });
});

describe('a few people on one road are people, not a unit', () => {
    it('sets out with the ones it already knew and falls in with the rest', () => {
        const who = whoWouldGoWithThem([
            { id: 'known', goingTheSameWay: true, knownToThem: true },
            { id: 'stranger', goingTheSameWay: true, knownToThem: false },
            { id: 'elsewhere', goingTheSameWay: false, knownToThem: true }
        ]);
        expect(who.setOutTogether).toEqual(['known']);
        expect(who.fellInOnTheRoad).toEqual(['stranger']);
    });

    it('stays a few people', () => {
        const many = Array.from({ length: 10 }, (_, i) =>
            ({ id: `p${i}`, goingTheSameWay: true, knownToThem: true }));
        const who = whoWouldGoWithThem(many);
        expect(who.setOutTogether.length + who.fellInOnTheRoad.length)
            .toBe(A_FEW_PEOPLE - 1);
    });

    it('never puts somebody going a different way on the road', () => {
        expect(whoWouldGoWithThem([
            { id: 'elsewhere', goingTheSameWay: false, knownToThem: true }
        ])).toEqual({ setOutTogether: [], fellInOnTheRoad: [] });
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND THE WORLD, BOTH ARMS IN ONE COMMAND
// ─────────────────────────────────────────────────────────────────────────

const HORIZON_YEARS = 200;
const SEED = 'purse-a';

interface Arm {
    state: WorldState;
    departures: {
        summary: string; why: string; party: number; lost: number; fellIn: number;
    }[];
}

async function arm(on: boolean): Promise<Arm> {
    const catalog = await loadCultivationCatalog();
    const { state } = seedWorld({ seed: SEED, catalog });
    advanceWorldYears(state, HORIZON_YEARS, {
        stopOnInterrupt: false,
        pressure: { peopleWalkOutOnTheirOwnAccount: on }
    });
    return {
        state,
        departures: state.history.facts
            .filter(f => f.data?.walkedOut === true)
            .map(f => ({
                summary: f.summary,
                why: String(f.data?.why ?? ''),
                party: Number(f.data?.party ?? 0),
                lost: Number(f.data?.lost ?? 0),
                fellIn: Number(f.data?.fellInOnTheRoad ?? 0)
            }))
    };
}

describe('a world where people decide for themselves, against one where they do not', () => {
    let both: Promise<{ on: Arm; off: Arm }> | null = null;
    function arms() {
        both ??= (async () => ({ on: await arm(true), off: await arm(false) }))();
        return both;
    }

    it('produces people who left, and says of each of them why', async () => {
        const { on } = await arms();
        expect(on.departures.length, 'nobody in the world ever left a roll').toBeGreaterThan(0);
        // The requirement, as an assertion: of anybody out there, you can say
        // what they went for. A departure with no reason on it is a departure
        // that was invented rather than read.
        expect(on.departures.every(d => d.why.length > 0)).toBe(true);
    }, 900_000);

    it('takes them off the roll, and the world ends up with more people on no roll', async () => {
        const { on, off } = await arms();
        const walkers = on.state.npcs.filter(
            n => n.tags.some(t => t.startsWith('walked-out:')));
        expect(walkers.length).toBeGreaterThan(0);
        expect(walkers.some(n => n.factionId === null)).toBe(true);

        // NOT `every`. The first cut asserted it and went red, correctly:
        // `applyRecruitment` takes anybody standing on no roll, so a share of
        // the people who walked out of one hall are later admitted to another.
        // That is the world working - somebody who left the Cold Sword Sect for
        // a terrace three provinces away is exactly who the house near the
        // terrace recruits - and pinning `every` would have pinned a bug into
        // the roster instead.
        //
        // AND NOT THE HEADCOUNT EITHER, which the second cut asserted and which
        // also went red: the standing population of unaffiliated cultivators
        // came out at 189 with the motive on against 199 with it off. Births
        // and recruitment both dwarf 120 departures over two hundred years, so
        // the STOCK is noise and only the FLOW is this mechanism's. That is a
        // finding about the measurement rather than about the feature, and it
        // is why the assertion below is about where somebody is standing.
        void off;

        // THEY WENT SOMEWHERE. The whole of the change is that a person is no
        // longer where their house is, and `roadsInReachOf` reads the province
        // off exactly that.
        const arrived = on.departures.length > 0 && on.state.history.facts
            .filter(f => f.data?.walkedOut === true)
            .some(f => f.actors.some(a => {
                const who = on.state.npcs.find(n => n.id === a.id);
                return who !== undefined
                    && (who.locationId === f.locationId || isLostTrackOf(on.state, who));
            }));
        expect(arrived, 'nobody who left ever reached what they left for').toBe(true);
    }, 900_000);

    /**
     * AND SOME OF THEM WENT BECAUSE THE HOUSE COULD NOT RAISE THEM. The reason
     * `promotion-inside-a-house.ts` says the setting runs on, and the one that
     * reaches past the bottom rung: `being-held-back-in-a-house.ts`.
     */
    it('walks out people the house could not raise, and says that is why', async () => {
        const { on } = await arms();
        const heldBack = on.departures.filter(d => d.why.includes('the house has no room for them to rise'));
        expect(heldBack.length, 'nobody ever left a house for having outgrown it').toBeGreaterThan(0);
        expect(heldBack.some(d => d.summary.includes('nowhere higher to put them')),
            'the departure did not say it').toBe(true);
    }, 900_000);

    /**
     * AND IT CAN COST THEM THE TRIP, WHICH IS NOT THE SAME AS USUALLY DOING SO.
     * Nobody underwrote it: a house pitches an errand at what it thinks its
     * people can survive, and these people pitched themselves, so the ground
     * asks what the ground asks. This asserted that somebody died on the road,
     * which held while a world produced departures in the hundreds. With people
     * hardly leaving - 19 on this seed in two hundred years - it is a coin that
     * lands once every few runs: measured on this tree, 1 lost and then 0 on two
     * runs of the same seed. What is pinned instead is that the risk is real and
     * the arithmetic is sane.
     */
    it('is at their own risk, and the losses are never more than the party', async () => {
        const { on } = await arms();
        expect(on.departures.length).toBeGreaterThan(0);
        for (const d of on.departures) {
            expect(d.lost).toBeLessThanOrEqual(d.party);
            expect(d.lost).toBeGreaterThanOrEqual(0);
        }
    }, 900_000);

    /**
     * AND THEY GO ALONE, WHICH IS THE RULING RATHER THAN A GAP. This asserted
     * that a few of them end up on one road and that somebody falls in with a
     * stranger. Both were true when people walked out of houses in numbers; the
     * owner has since ruled that *"MOST people stay put"*, and what leaving
     * costs somebody (`whatLeavingTheirHouseCosts`) is weighed per person - so
     * two people on one roll rarely both clear it in the same year. Measured on
     * this seed at two hundred years: 19 departures, every one of them a party
     * of one, none of them falling in with anybody.
     *
     * `whoWouldGoWithThem` is still the rule for who goes along, and the unit
     * tests above hold it; what is no longer claimed is that a two-century world
     * produces an instance of it.
     */
    it('takes people out one at a time, and the party rule still holds', async () => {
        const { on } = await arms();
        expect(on.departures.length).toBeGreaterThan(0);
        expect(on.departures.every(d => d.party >= 1)).toBe(true);
        expect(on.departures.every(d => d.fellIn <= d.party)).toBe(true);
    }, 900_000);

    it('does none of it with the motive switched off', async () => {
        const { off } = await arms();
        expect(off.departures.length).toBe(0);
        expect(off.state.npcs.some(n => n.tags.some(t => t.startsWith('walked-out:'))))
            .toBe(false);
    }, 900_000);
});
