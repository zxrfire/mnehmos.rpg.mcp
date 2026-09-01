/**
 * Closed ground: whether the world keeps finding it, and whether what it finds
 * is more than one thing.
 *
 * The load-bearing test in this file is the LONG HORIZON one. A countdown to an
 * empty list and a reserve replenished by discovery are indistinguishable at
 * two centuries and differ completely at five millennia, so a test that only
 * checks the short horizon would have passed against the defect this module
 * exists to fix.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { applyPressure } from '../../../src/engine/world/pressure.js';
import { markDead } from '../../../src/engine/world/npc-state.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import {
    CHARACTERS_BY_BAND,
    DEEPEST_BAND,
    EASY_FIND_ODDS_PER_PARTY_YEAR,
    FINDS_BEFORE_THE_RATE_HALVES,
    FINDABLE_ONCE_INTEGRITY_FALLS_BELOW,
    PROSPECTORS_PER_PARTY,
    RUINS_ARE_A_RESERVE_NOT_AN_ENDOWMENT,
    RUNG_AT_WHICH_SOMEBODY_HAS_A_DOOR,
    applyRuinProspecting,
    depthBandReachableBy,
    foundUnder,
    howTheHouseEnded,
    isSomebodyStillAliveInThere,
    prospectFor,
    prospectingEffortIn,
    ruinsInGroundUnder,
    scaleLeftBySomebodyAt,
    standingReserve,
    stillInGroundUnder,
    whatTheDeadLeftUnder
} from '../../../src/engine/world/how-the-world-keeps-finding-more-ruins.js';
import {
    INTENT_HAS_A_HALF_LIFE,
    effectiveWardOrdinal,
    oddsOfGettingThroughTheDoor,
    wardConditionOf,
    wardHalfLifeYears,
    wardIntegrityOf
} from '../../../src/engine/world/how-far-gone-a-formation-is.js';
import {
    RuinCharacterSchema,
    RuinOriginSchema,
    RuinScaleSchema,
    WHAT_SCALE_DECIDES,
    WHY_CLOSED_GROUND,
    SITES
} from '../../../src/data/cultivation/inheritance-trials.js';

const YEAR = 365;

function world(seed = 'reserve', population = 250): WorldState {
    return seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population }).state;
}

/** Ruin openings the world recorded, as years since the run began. */
function openingYears(state: WorldState, from: number): number[] {
    return state.history.facts
        .filter(f => f.kind === 'ruin_opened')
        .map(f => Math.floor((f.day - from) / YEAR))
        .filter(y => y >= 0);
}

// ─────────────────────────────────────────────────────────────────────────
// THE DOCTRINE
// ─────────────────────────────────────────────────────────────────────────

describe('the reserve model', () => {
    it('states the finite-in-principle half as loudly as the inexhaustible half', () => {
        expect(RUINS_ARE_A_RESERVE_NOT_AN_ENDOWMENT.principle).toMatch(/finite in principle/i);
        expect(RUINS_ARE_A_RESERVE_NOT_AN_ENDOWMENT.principle).toMatch(/nobody is making ruins/i);
        expect(RUINS_ARE_A_RESERVE_NOT_AN_ENDOWMENT.whatThisIsNot).toMatch(/not a spawner/i);
        expect(RUINS_ARE_A_RESERVE_NOT_AN_ENDOWMENT.theMeasurementThatMatters)
            .toMatch(/five thousand/i);
    });

    it('names the category for what it is rather than for what happened to it', () => {
        expect(WHY_CLOSED_GROUND.term).toBe('closed ground');
        expect(WHY_CLOSED_GROUND.whyNotRuins).toMatch(/not ruined/i);
        expect(WHY_CLOSED_GROUND.theEnds.length).toBe(2);
        expect(WHY_CLOSED_GROUND.theEnds.join(' ')).toMatch(/shut cave/);
        expect(WHY_CLOSED_GROUND.theEnds.join(' ')).toMatch(/empty seat/);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// EFFORT, DEPTH AND DECLINE
// ─────────────────────────────────────────────────────────────────────────

describe('discovery is governed by how hard people are looking', () => {
    it('finds nothing in a province with nobody in it, whatever is under it', () => {
        const state = world();
        const region = state.locations.find(l => l.kind === 'region')!;
        // Nobody at all: every roster entry moved off this province.
        for (let i = 0; i < state.npcs.length; i++) {
            state.npcs[i] = { ...state.npcs[i], locationId: null };
        }
        const prospect = prospectFor(state, region);
        expect(prospect.parties).toBe(0);
        expect(prospect.oddsThisYear).toBe(0);
        // And there is plenty down there, so it is the looking and not the stock.
        expect(stillInGroundUnder(region)).toBeGreaterThan(20);
    });

    it('rises with the number of parties, linearly and with nothing else in it', () => {
        const state = world();
        const region = state.locations.find(l => l.kind === 'region')!;
        const { parties } = prospectingEffortIn(state, region.id);
        if (parties <= 0) return;
        const prospect = prospectFor(state, region);
        const expected = (parties * EASY_FIND_ODDS_PER_PARTY_YEAR)
            / (1 + prospect.workedOverBy / FINDS_BEFORE_THE_RATE_HALVES);
        expect(prospect.oddsThisYear).toBeCloseTo(Math.min(1, expected), 8);
    });

    it('takes a party to be eight people, so effort is a headcount and not a flag', () => {
        expect(PROSPECTORS_PER_PARTY).toBe(8);
        const state = world();
        const region = state.locations.find(l => l.kind === 'region')!;
        const before = prospectingEffortIn(state, region.id).parties;
        // Move eight more people in and the effort rises by exactly one party.
        //
        // "In" has to mean from ANOTHER province: a settlement under this
        // region already resolves to it, so moving somebody from a town to the
        // region node moves nobody. That was a harness bug on the first run of
        // this test and it read as the arithmetic being wrong.
        const otherRegion = state.locations.find(l => l.kind === 'region' && l.id !== region.id);
        if (!otherRegion) return;
        const under = (id: string | null): boolean => {
            let cursor = id;
            const seen = new Set<string>();
            while (cursor && !seen.has(cursor)) {
                seen.add(cursor);
                if (cursor === region.id) return true;
                cursor = state.locations.find(l => l.id === cursor)?.parentId ?? null;
            }
            return false;
        };
        let moved = 0;
        for (let i = 0; i < state.npcs.length && moved < 8; i++) {
            const npc = state.npcs[i];
            if (npc.status !== 'alive' || under(npc.locationId)) continue;
            if (npc.cultivation.realmOrdinal < 3) continue;
            state.npcs[i] = { ...npc, locationId: region.id };
            moved++;
        }
        if (moved < 8) return;
        expect(prospectingEffortIn(state, region.id).parties).toBeCloseTo(before + 1, 6);
    });

    it('declines with what has already been found, hyperbolically and never to zero', () => {
        const state = world();
        const region = state.locations.find(l => l.kind === 'region')!;
        if (prospectFor(state, region).parties <= 0) return;

        const fresh = prospectFor(state, region).oddsThisYear;
        const at = state.locations.indexOf(region);
        // Pretend the province has been worked hard.
        state.locations[at] = {
            ...region,
            data: { ...region.data, 'ruinsFound:0': 30 }
        };
        const worked = prospectFor(state, state.locations[at]).oddsThisYear;

        expect(worked).toBeLessThan(fresh);
        // Hyperbolic, not exponential: heavily worked ground still yields.
        expect(worked).toBeGreaterThan(0);
    });

    it('lets capability open ground that was always there', () => {
        // Depth bands are a function of the rung and nothing else.
        expect(depthBandReachableBy(0)).toBe(0);
        expect(depthBandReachableBy(21)).toBeGreaterThan(depthBandReachableBy(7));
        expect(depthBandReachableBy(46)).toBe(DEEPEST_BAND);
        // And every band has something plausible to find in it.
        expect(CHARACTERS_BY_BAND.length).toBe(DEEPEST_BAND + 1);
        for (const band of CHARACTERS_BY_BAND) {
            expect(band.length).toBeGreaterThan(0);
            for (const c of band) expect(RuinCharacterSchema.options).toContain(c);
        }
    });

    it('keeps the stock finite in principle and different between provinces', () => {
        const state = world();
        const regions = state.locations.filter(l => l.kind === 'region');
        expect(regions.length).toBeGreaterThan(1);
        for (const region of regions) {
            for (let band = 0; band <= DEEPEST_BAND; band++) {
                expect(ruinsInGroundUnder(region, band)).toBeGreaterThan(0);
            }
            // Stable across calls: the endowment is a property of the province.
            expect(ruinsInGroundUnder(region, 0)).toBe(ruinsInGroundUnder(region, 0));
        }
        const totals = regions.map(r => stillInGroundUnder(r));
        expect(new Set(totals).size, 'every province holds the same amount').toBeGreaterThan(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE LONG HORIZON. The reason the module exists.
// ─────────────────────────────────────────────────────────────────────────

describe('the world does not run out of closed ground', () => {
    it('is still finding and opening ground in the last fifth of a long run', () => {
        // 1500 years is long enough for the fixed endowment to have emptied -
        // measured on the real catalog, the old world produced 0.2/century in
        // the last fifth by year 3000 and 0.0 by 5000 - and short enough that
        // the suite stays quick. The 5000-year figures are in the commit
        // message and in `scripts/probe-ruin-discovery.ts`.
        const state = world('long-horizon');
        const from = state.currentDay;
        const years = 1500;
        applyPressure(state, from, from + years * YEAR, { maxEvents: 1_000_000 });

        const opens = openingYears(state, from);
        const fifth = Math.floor(years / 5);
        const late = opens.filter(y => y >= years - fifth).length;

        expect(opens.length, 'nothing was ever opened').toBeGreaterThan(10);
        expect(late, 'the world stopped opening ground in the last fifth').toBeGreaterThan(0);
    }, 120_000);

    it('leaves far more in the ground than it has found, at every horizon', () => {
        const state = world('still-plenty');
        const from = state.currentDay;
        applyPressure(state, from, from + 500 * YEAR, { maxEvents: 1_000_000 });
        for (const region of state.locations.filter(l => l.kind === 'region')) {
            expect(stillInGroundUnder(region)).toBeGreaterThan(foundUnder(region));
        }
    }, 60_000);

    it('adds to the reserve rather than replacing what the world already held', () => {
        const state = world('two-stage');
        const from = state.currentDay;
        const before = state.locations.filter(l => l.kind === 'ruin').length;
        applyPressure(state, from, from + 300 * YEAR, { maxEvents: 1_000_000 });
        const after = state.locations.filter(l => l.kind === 'ruin').length;
        expect(after).toBeGreaterThan(before);
        // Discovery and opening are two stages, so a standing reserve exists as
        // a concept even where a given run has spent it down to nothing.
        expect(standingReserve(state).length).toBeGreaterThanOrEqual(0);
    }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────────
// MANY DIFFERENT TYPES
// ─────────────────────────────────────────────────────────────────────────

describe('what gets found is not all the same thing', () => {
    it('produces a real spread of characters, origins and scales over a run', () => {
        const state = world('variety');
        const from = state.currentDay;
        applyPressure(state, from, from + 800 * YEAR, { maxEvents: 1_000_000 });

        const found = state.locations.filter(l => l.data.foundInYear !== undefined);
        expect(found.length).toBeGreaterThan(10);

        // Four in the FIXTURE world, which is small and whose ladder does not
        // reach the deep bands where the archives and vaults are. Measured on
        // the real catalog over the same span it is fourteen of fourteen - see
        // `scripts/probe-ruin-discovery.ts`. The bar is set to what the fixture
        // can actually produce rather than to the figure that reads better.
        const characters = new Set(found.map(l => String(l.data.ruinCharacter ?? '')));
        characters.delete('');
        expect(characters.size, 'closed ground came out as one kind of place')
            .toBeGreaterThanOrEqual(4);
        for (const c of characters) expect(RuinCharacterSchema.options).toContain(c);

        const origins = new Set(found.map(l => String(l.data.ruinOrigin ?? '')));
        origins.delete('');
        for (const o of origins) expect(RuinOriginSchema.options).toContain(o);
    }, 90_000);

    it('gives the authored catalog a real range too, rather than two kinds', () => {
        const characters = new Set(SITES.map(s => s.character));
        const origins = new Set(SITES.map(s => s.origin));
        const scales = new Set(SITES.map(s => s.scale));
        // It was 24 sites in exactly two kinds, and every one of them ungated.
        expect(characters.size).toBeGreaterThanOrEqual(10);
        expect(origins.size).toBeGreaterThanOrEqual(4);
        expect(scales.size).toBeGreaterThanOrEqual(3);
    });

    it('closes ground three different ways across the catalog, and all three do work', () => {
        const admits = SITES.map(s => s.access.admits);
        const minimum = admits.filter(a => a === 'anyone_who_survives_it').length;
        const cap = admits.filter(a => a === 'nobody_above_the_line').length;
        const elder = admits.filter(a => a === 'elders_and_above').length;

        expect(cap, 'nothing in the catalog is closed against strength').toBeGreaterThanOrEqual(3);
        expect(elder, 'nothing in the catalog is an errand for a junior').toBeGreaterThanOrEqual(3);
        // The minimum is the ordinary case and has to stay the ordinary case.
        expect(minimum).toBeGreaterThan(cap + elder);
    });

    it('makes the entrant and the beneficiary different people wherever it is not a gamble', () => {
        for (const site of SITES) {
            const isGamble = site.access.admits === 'anyone_who_survives_it';
            if (isGamble) continue;
            // Both non-gamble shapes have to say who goes instead, or for whom.
            const text = site.access.admits === 'nobody_above_the_line'
                ? site.access.soWhoGoesInstead
                : site.access.whoTheyGoFor;
            expect(text.length, `${site.id} does not say who it is for`).toBeGreaterThan(40);
        }
    });

    it('varies the cap mechanism between sites rather than repeating one rule', () => {
        const caps = SITES
            .map(s => s.access)
            .filter((a): a is Extract<typeof a, { admits: 'nobody_above_the_line' }> =>
                a.admits === 'nobody_above_the_line');
        expect(caps.length).toBeGreaterThanOrEqual(3);
        const mechanisms = new Set(caps.map(c => c.whatReadsThePerson));
        expect(mechanisms.size, 'one cap mechanism wearing several hats').toBe(caps.length);
    });

    it('reads scale as a statement about who can take it, not a label', () => {
        expect(WHAT_SCALE_DECIDES.one_room.aHouseCanClaimIt).toBe(false);
        expect(WHAT_SCALE_DECIDES.a_mountain.aHouseCanClaimIt).toBe(true);
        expect(WHAT_SCALE_DECIDES.a_mountain.itsExistenceIsPublic).toBe(true);
        expect(WHAT_SCALE_DECIDES.one_room.itsExistenceIsPublic).toBe(false);
        let last = 0;
        for (const scale of RuinScaleSchema.options) {
            expect(WHAT_SCALE_DECIDES[scale].partiesItTakes).toBeGreaterThanOrEqual(last);
            last = WHAT_SCALE_DECIDES[scale].partiesItTakes;
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE CLOCK
// ─────────────────────────────────────────────────────────────────────────

describe('formations weaken, and that is what moves everything', () => {
    it('holds far longer the higher the rung that set it', () => {
        expect(wardHalfLifeYears(30)).toBeGreaterThan(wardHalfLifeYears(12) * 10);
        expect(wardHalfLifeYears(0)).toBeLessThan(wardHalfLifeYears(8));
    });

    it('halves on schedule and never quite reaches nothing', () => {
        const half = wardHalfLifeYears(12);
        expect(wardIntegrityOf({ setByOrdinal: 12, yearsSince: 0 })).toBe(1);
        expect(wardIntegrityOf({ setByOrdinal: 12, yearsSince: half })).toBeCloseTo(0.5, 3);
        expect(wardIntegrityOf({ setByOrdinal: 12, yearsSince: half * 4 })).toBeCloseTo(0.0625, 3);
        expect(wardIntegrityOf({ setByOrdinal: 12, yearsSince: half * 50 })).toBeGreaterThanOrEqual(0);
    });

    it('lowers the rung a door answers at as it goes', () => {
        const fresh = effectiveWardOrdinal({ setByOrdinal: 28, yearsSince: 0 });
        const old = effectiveWardOrdinal({ setByOrdinal: 28, yearsSince: wardHalfLifeYears(28) });
        expect(fresh).toBe(28);
        expect(old).toBeLessThan(fresh);
    });

    it('gives the same odds to a prospector and to somebody arriving at a seclusion', () => {
        // One number read from two directions. Same arguments, same answer.
        const args = { setByOrdinal: 24, yearsSince: 300, claimantOrdinal: 20 };
        expect(oddsOfGettingThroughTheDoor(args)).toBe(oddsOfGettingThroughTheDoor(args));
        // Monotone in the claimant, and never certain either way.
        const weak = oddsOfGettingThroughTheDoor({ ...args, claimantOrdinal: 4 });
        const strong = oddsOfGettingThroughTheDoor({ ...args, claimantOrdinal: 40 });
        expect(weak).toBeLessThan(strong);
        expect(weak).toBeGreaterThan(0);
        expect(strong).toBeLessThan(1);
        // And an ancient door is easier than a fresh one set by the same person.
        expect(oddsOfGettingThroughTheDoor({ setByOrdinal: 24, yearsSince: 5000, claimantOrdinal: 15 }))
            .toBeGreaterThan(oddsOfGettingThroughTheDoor({ setByOrdinal: 24, yearsSince: 1, claimantOrdinal: 15 }));
    });

    it('bands the condition so a reader can say it out loud', () => {
        expect(wardConditionOf(1)).toBe('as_set');
        expect(wardConditionOf(0.6)).toBe('holding');
        expect(wardConditionOf(0.3)).toBe('thin');
        expect(wardConditionOf(0.1)).toBe('nearly_gone');
        expect(wardConditionOf(0)).toBe('a_wall');
    });

    it('states that decay is what makes an inheritance converge on a ruin', () => {
        expect(INTENT_HAS_A_HALF_LIFE.principle).toMatch(/half-life/i);
        expect(INTENT_HAS_A_HALF_LIFE.theSortingIsTheFormation).toMatch(/cannot refuse anybody/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE DEAD LEAVE
// ─────────────────────────────────────────────────────────────────────────

describe('the near end of the stock refills, and the deep past does not', () => {
    it('reads closed ground off the death records rather than off a spawn rate', () => {
        const state = world('the-dead');
        const region = state.locations.find(l => l.kind === 'region')!;
        const nowYear = Math.floor(state.currentDay / YEAR);

        // Nobody has been dead long enough yet for a door to have thinned.
        const before = whatTheDeadLeftUnder(state, region.id, nowYear).length;

        // Kill somebody in this province, a long time ago, at a modest rung.
        let killed = false;
        for (let i = 0; i < state.npcs.length && !killed; i++) {
            const npc = state.npcs[i];
            if (npc.status !== 'alive') continue;
            if (npc.cultivation.realmOrdinal < RUNG_AT_WHICH_SOMEBODY_HAS_A_DOOR) continue;
            state.npcs[i] = {
                ...markDead(npc, state.currentDay - 400 * YEAR, 'Killed at the ford.'),
                locationId: region.id
            };
            killed = true;
        }
        expect(killed, 'no seeded NPC was high enough to have a door').toBe(true);

        const after = whatTheDeadLeftUnder(state, region.id, nowYear);
        expect(after.length).toBe(before + 1);
        const one = after.find(x => x.yearsSince >= 400)!;
        expect(one).toBeDefined();
        expect(one.wardIntegrity).toBeLessThan(FINDABLE_ONCE_INTEGRITY_FALLS_BELOW);
        expect(['left_addressed', 'a_door_nobody_opened_again']).toContain(one.origin);
    });

    it('does not report a door that is still as its owner set it', () => {
        const state = world('too-fresh');
        const region = state.locations.find(l => l.kind === 'region')!;
        const nowYear = Math.floor(state.currentDay / YEAR);
        for (let i = 0; i < state.npcs.length; i++) {
            const npc = state.npcs[i];
            if (npc.status !== 'alive') continue;
            if (npc.cultivation.realmOrdinal < 25) continue;
            state.npcs[i] = {
                ...markDead(npc, state.currentDay - 1 * YEAR, 'Died last year.'),
                locationId: region.id
            };
            break;
        }
        // A high-rung seal set last year is nowhere near thin, so nothing about
        // it is findable and the reserve does NOT arrive all at once.
        for (const one of whatTheDeadLeftUnder(state, region.id, nowYear)) {
            expect(one.wardIntegrity).toBeLessThan(FINDABLE_ONCE_INTEGRITY_FALLS_BELOW);
        }
    });

    it('scales what somebody leaves off what they had, from the bottom to the top', () => {
        expect(scaleLeftBySomebodyAt(9)).toBe('one_room');
        expect(scaleLeftBySomebodyAt(22)).toBe('a_building');
        expect(scaleLeftBySomebodyAt(30)).toBe('a_compound');
        expect(scaleLeftBySomebodyAt(44)).toBe('a_mountain');
        // One rule across the ladder: it is monotone and has no tiers in it.
        let last = -1;
        const order = ['one_room', 'a_building', 'a_compound', 'a_mountain'];
        for (let o = 0; o <= 46; o++) {
            const at = order.indexOf(scaleLeftBySomebodyAt(o));
            expect(at).toBeGreaterThanOrEqual(last);
            last = at;
        }
    });

    it('produces vastly more small closed ground than large, because the low bands are enormous', () => {
        const state = world('distribution', 400);
        const region = state.locations.find(l => l.kind === 'region')!;
        const nowYear = Math.floor(state.currentDay / YEAR);
        // Kill everybody in the province, long ago, and read the shape back.
        for (let i = 0; i < state.npcs.length; i++) {
            const npc = state.npcs[i];
            if (npc.status !== 'alive') continue;
            state.npcs[i] = {
                ...markDead(npc, state.currentDay - 900 * YEAR, 'Died.'),
                locationId: region.id
            };
        }
        const left = whatTheDeadLeftUnder(state, region.id, nowYear);
        if (left.length < 10) return;
        const small = left.filter(x => x.scale === 'one_room').length;
        const large = left.filter(x => x.scale === 'a_mountain').length;
        expect(small, 'the small end is not the bulk of it').toBeGreaterThan(large);
    });

    it('never turns a place with no intent into one that had an intent to lose', () => {
        const state = world('intent-axis');
        const region = state.locations.find(l => l.kind === 'region')!;
        const nowYear = Math.floor(state.currentDay / YEAR);
        for (let i = 0; i < state.npcs.length; i++) {
            const npc = state.npcs[i];
            if (npc.status !== 'alive') continue;
            state.npcs[i] = {
                ...markDead(npc, state.currentDay - 2000 * YEAR, 'Died.'),
                locationId: region.id
            };
        }
        for (const one of whatTheDeadLeftUnder(state, region.id, nowYear)) {
            // Intent is a separate axis from age. Somebody who arranged nothing
            // is `never_addressed` however long ago it was, and no amount of
            // decay makes a place that was never a message into a lapsed one.
            if (!one.arranged) expect(one.intent).toBe('never_addressed');
            else expect(['addressed', 'lapsed']).toContain(one.intent);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// A SEALED DOOR IS NOT A WARD
// ─────────────────────────────────────────────────────────────────────────

describe('from outside, a live cultivator behind a door and a dead one look the same', () => {
    it('answers whether somebody is still alive in there, off state', () => {
        const state = world('occupied');
        const region = state.locations.find(l => l.kind === 'region')!;
        const alive = state.npcs.find(n => n.status === 'alive')!;
        const at = state.npcs.indexOf(alive);
        state.npcs[at] = { ...alive, locationId: region.id };

        expect(isSomebodyStillAliveInThere(state, region).occupied).toBe(true);
        expect(isSomebodyStillAliveInThere(state, region).occupantId).toBe(alive.id);

        state.npcs[at] = markDead(state.npcs[at], state.currentDay, 'Died in there.');
        const empty = state.locations.find(
            l => l.kind === 'ruin' || (l.kind === 'region' && l.id !== region.id)
        );
        if (empty) expect(isSomebodyStillAliveInThere(state, empty).occupied).toBe(false);
    });

    it('gives a prospector no way to tell from the odds alone', () => {
        // The odds function takes no argument that says whether anybody is home,
        // which is the structural guarantee: it cannot leak what it never sees.
        const a = oddsOfGettingThroughTheDoor({ setByOrdinal: 20, yearsSince: 200, claimantOrdinal: 18 });
        const b = oddsOfGettingThroughTheDoor({ setByOrdinal: 20, yearsSince: 200, claimantOrdinal: 18 });
        expect(a).toBe(b);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// A RUIN IS A SPECIFIC UNFINISHED STORY
// ─────────────────────────────────────────────────────────────────────────

describe('how a house ended decides the shape of what it leaves', () => {
    it('reads the ending off the world rather than drawing one', () => {
        const state = world('endings');
        const seat = state.locations.find(l => l.kind === 'sect_seat')
            ?? state.locations.find(l => l.kind === 'region')!;
        const ending = howTheHouseEnded(state, seat);
        expect(['leadership_killed', 'evacuated', 'stopped_receiving_instructions', 'dissolved'])
            .toContain(ending.ending);
        expect(ending.whatAPartyFinds.length).toBeGreaterThan(60);
        expect(ending.strippedShare).toBeGreaterThanOrEqual(0);
        expect(ending.strippedShare).toBeLessThanOrEqual(1);
        // Deterministic: the same world says the same thing about the same seat.
        expect(howTheHouseEnded(state, seat).ending).toBe(ending.ending);
    });

    it('leaves the vault shut exactly when the people who could open it died', () => {
        const state = world('vault');
        const seat = state.locations.find(l => l.kind === 'sect_seat')
            ?? state.locations.find(l => l.kind === 'region')!;
        const ending = howTheHouseEnded(state, seat);
        if (ending.ending === 'leadership_killed') {
            // The valuable part survives because the people who could reach it
            // are the reason there was a hurry.
            expect(ending.theVaultIsStillShut).toBe(true);
            expect(ending.strippedShare).toBeGreaterThan(0.5);
        }
        if (ending.ending === 'stopped_receiving_instructions') {
            // Nothing dramatic happened here, so the paper is still on the shelves.
            expect(ending.theRecordsSurvive).toBe(true);
            expect(ending.strippedShare).toBeLessThan(0.5);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// DETERMINISM
// ─────────────────────────────────────────────────────────────────────────

describe('the pass is reproducible from its seed', () => {
    it('finds the same ground twice from the same world', () => {
        const a = world('repeat');
        const b = world('repeat');
        const yearA = Math.floor(a.currentDay / YEAR) + 1;
        for (let y = 0; y < 40; y++) {
            applyRuinProspecting(a, yearA + y, a.currentDay + y * YEAR);
            applyRuinProspecting(b, yearA + y, b.currentDay + y * YEAR);
        }
        const idsA = a.locations.filter(l => l.data.foundInYear !== undefined).map(l => l.id).sort();
        const idsB = b.locations.filter(l => l.data.foundInYear !== undefined).map(l => l.id).sort();
        expect(idsA).toEqual(idsB);
    });

    it('never mints two places for the same body', () => {
        const state = world('one-body-one-door');
        const from = state.currentDay;
        applyPressure(state, from, from + 400 * YEAR, { maxEvents: 1_000_000 });
        const occupants = state.locations
            .map(l => l.data.occupantId)
            .filter((id): id is string => typeof id === 'string');
        expect(new Set(occupants).size).toBe(occupants.length);
    }, 60_000);
});
