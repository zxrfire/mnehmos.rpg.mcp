/**
 * A cultivator leaves a house on the clock of their own life, and the top of the
 * world is not read as a house with no room.
 *
 * Ruled by the design owner: *"people can leave but they don't leave easily.
 * Cultivators live a long time"*, and seventy to ninety-five houses, mostly
 * splinters, was *"quite a lot of splinters over a short amount of time."*
 *
 * ── WHAT WAS WRONG, MEASURED ON `shape-a` ────────────────────────────────
 *
 * The Hollow Court's Second, Third and Fourth Seats stand on the rung under its
 * one head's chair. The promotion pass named them blocked `no_seat` for that
 * chair from the first year, the held-back reason pressed on the calendar a
 * mortal lives by, and all three walked out within ninety years; one then
 * joined a splinter as an outer disciple. The world's one False Immortal, named
 * in two catalogs, had no row at all, and once he had one the recruitment pass
 * enrolled him at an outer rung in his first year. A splinter was founded by
 * whoever stood second on a roll the engine models, whatever they wanted, with
 * every third person below them.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 * Waiting on a head's chair is not being held back. Being held back presses,
 * and a grievance moves somebody, in shares of the life they have, and only by
 * more than going would cost them: belonging, what they would start over, their
 * road and the oath, weighed by the kind of house it is. A splinter is founded
 * by somebody senior the house is holding back, with people tied to them. A
 * senior leaving cools the ties of those left behind and is news; a junior
 * leaving is not. The house offers a silence oath at its door. Somebody on no
 * roll moves on. The wanderer the catalog names is somebody in the world, a
 * guest of the Court on no rung, who lectures its Seats when he goes back.
 *
 * Red-checked: counting the chair above as a promotion turns the succession test
 * red; dropping the lifespan from the held-back reading turns its life test red;
 * founding off the second strongest turns the founder test red; removing the
 * recruitment guard turns the wanderer test red.
 */

import { describe, expect, it } from 'vitest';

import {
    howHardBeingHeldBackPresses,
    noteWhoIsHeldBack,
    whereTheyAreHeldBack,
    type HeldBack
} from '../../../src/engine/world/being-held-back-in-a-house.js';
import {
    whetherTheyGoThisYear,
    type WhyTheyWentOut
} from '../../../src/engine/world/why-somebody-walks-out-of-a-compound.js';
import { whoSplitsAHouse } from '../../../src/engine/world/who-splits-a-house-and-who-goes-with-them.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { lifespanForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { createNpc, isTheWorldsToMove, setRealm, theWorldMayEnd, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { FALSE_IMMORTAL_LIFESPAN_YEARS } from '../../../src/engine/cultivation/realms.js';
import { HOLLOW_COURT_ROSTER } from '../../../src/data/cultivation/hollow-court-roster.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import type { Blocked } from '../../../src/engine/world/promotion-inside-a-house.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { whatLeavingTheirHouseCosts } from '../../../src/engine/world/why-somebody-walks-out-of-a-compound.js';
import { howLoudALeavingIs, whatTheirLeavingStirs } from '../../../src/engine/world/what-somebody-senior-leaving-stirs.js';
import { WORTH_REPEATING } from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import { theOathAHouseOffersAtItsDoor } from '../../../src/engine/social/the-oath-a-house-offers-at-its-door.js';
import { peopleWithNoHouseMoveOn } from '../../../src/engine/world/where-somebody-with-no-house-goes.js';
import { theWanderersGoAbout, whoseGuestTheyAre } from '../../../src/engine/world/the-wanderer-the-catalog-names-is-somebody.js';
import { regionOf as regionOfLocation } from '../../../src/engine/world/what-people-are-saying.js';

const YEAR = DAYS_PER_YEAR;
const DAY = 500 * YEAR;
const RANKS = ['Outer', 'Inner', 'Core', 'Elder', 'Grand Elder', 'Head'];

function aHouse(): WorldState {
    const state = createWorld({ seed: 'own-clock', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.factions.push(makeFaction({ id: 'house-a', name: 'The Test Hall', ranks: RANKS }));
    return state;
}

function person(state: WorldState, id: string, rank: number, ordinal: number): NpcRecord {
    const npc: NpcRecord = {
        ...setRealm(createNpc(state.seed, { id, bornOnDay: DAY - 80 * YEAR, onDay: DAY, locationId: null, occupation: 'disciple' }), ordinal, DAY),
        factionId: 'house-a', factionRankIndex: rank, activity: null
    };
    state.npcs.push(npc);
    return npc;
}

const held = (over: Partial<HeldBack> = {}): HeldBack => ({
    houseId: 'house-a', atRank: 3, sinceDay: DAY, realmsPastTheBar: 0, reason: 'no_seat', ...over
});

/**
 * RE-PINNED 2026-09-23, NARROWED TO THE TOP RUNG. This asserted that the rung
 * UNDER the head is not held back either, which generalised the defect rather
 * than stating it.
 *
 * The defect: the Hollow Court's four Seats stand at `rankIndex 3` of a FOUR
 * rung ladder - the top rung - and `seatsAtRank` gives that rung one chair, so
 * three of the four were stamped held back `no_seat` from the first year and all
 * three walked out within ninety years. Somebody on the top rung has nothing
 * above them, which is what the exemption is for, and the narrowed rule covers
 * that case exactly.
 *
 * What the old rule ALSO exempted was the rung below the top, and that band is
 * `whoSplitsAHouse`'s whole population: senior, below the top, carrying the tag.
 * Exempting it left the splinter pass with nobody - a rule written today made
 * another rule written today unreachable, and the evidence quoted for the second
 * one working (2.4 foundings a century, ten live splinters at a thousand years,
 * measured 2026-09-22) predated the first.
 */
describe('somebody on the top rung is waiting on a succession, not held back', () => {
    it('exempts the top rung and holds back the rung under it, which is where splinters come from', () => {
        const state = aHouse();
        person(state, 'head', 5, 44);
        person(state, 'second', 4, 40);
        person(state, 'elder', 3, 36);
        const blocked: Blocked[] = [
            { npcId: 'head', factionId: 'house-a', atRank: 5, reason: 'no_seat', bar: 40 },
            { npcId: 'second', factionId: 'house-a', atRank: 4, reason: 'no_seat', bar: 36 },
            { npcId: 'elder', factionId: 'house-a', atRank: 3, reason: 'no_seat', bar: 33 }
        ];
        noteWhoIsHeldBack(state, blocked, DAY, isTheWorldsToMove);
        // Nothing above them: a succession, not a denial.
        expect(whereTheyAreHeldBack(state.npcs.find(n => n.id === 'head')!)).toBeNull();
        // And everybody below it is held back, including the rung that splits.
        expect(whereTheyAreHeldBack(state.npcs.find(n => n.id === 'second')!)).not.toBeNull();
        expect(whereTheyAreHeldBack(state.npcs.find(n => n.id === 'elder')!)).not.toBeNull();
    });
});

describe('a year is a share of a life', () => {
    it('presses on somebody with a thousand years a tenth as fast as on a mortal', () => {
        const mortal = howHardBeingHeldBackPresses(held(), DAY + 10 * YEAR, 100);
        const core = howHardBeingHeldBackPresses(held(), DAY + 10 * YEAR, 1_000);
        expect(core).toBeCloseTo(mortal / 10, 5);
        expect(howHardBeingHeldBackPresses(held(), DAY + 100 * YEAR, 1_000)).toBeCloseTo(mortal, 5);
    });

    it('moves somebody with a long life far less often a year for the same grievance', () => {
        const why: WhyTheyWentOut[] = ['a road a province away', 'the house did not pay them'];
        let mortal = 0, seat = 0;
        for (let i = 0; i < 20_000; i++) {
            if (whetherTheyGoThisYear(why, forStream('own-clock', 'mortal', i), 2, 100)) mortal++;
            if (whetherTheyGoThisYear(why, forStream('own-clock', 'seat', i), 2, lifespanForOrdinal(43))) seat++;
        }
        expect(mortal).toBeGreaterThan(200);
        expect(seat).toBeLessThan(mortal / 50);
    });
});

describe('a splinter is somebody\'s decision', () => {
    function aHouseWithAGrievance() {
        const state = aHouse();
        const day = DAY + 3_000 * YEAR;
        state.currentDay = day;
        person(state, 'head', 5, 44);
        person(state, 'strong-second', 4, 43);
        const founder = person(state, 'passed-over', 3, 30);
        const junior = person(state, 'their-disciple', 0, 12);
        const bystander = person(state, 'somebody-else', 1, 20);
        const at = (id: string) => state.npcs.findIndex(n => n.id === id);
        state.npcs[at(founder.id)] = { ...state.npcs[at(founder.id)]!, tags: [`held-back|house-a|3|${DAY}|2|no_seat`] };
        state.npcs[at(junior.id)] = {
            ...state.npcs[at(junior.id)]!,
            relationships: [{ targetId: founder.id, targetName: founder.name, kind: 'master', standing: 0.6 } as NpcRecord['relationships'][number]]
        };
        return { state, day, founder, junior, bystander };
    }

    it('is founded by the senior the house holds back, with the people tied to them', () => {
        const { state, day, founder, junior, bystander } = aHouseWithAGrievance();
        let split = null;
        for (let i = 0; i < 50 && split === null; i++) split = whoSplitsAHouse(state, day, forStream('own-clock', 'split', i));
        expect(split).not.toBeNull();
        expect(split!.founder.id).toBe(founder.id);
        expect(split!.leavers.map(n => n.id)).toContain(junior.id);
        expect(split!.leavers.map(n => n.id)).not.toContain(bystander.id);
        expect(split!.leavers.map(n => n.id)).not.toContain('head');
    });

    it('is founded by nobody where nobody is held back', () => {
        const { state, day } = aHouseWithAGrievance();
        for (const npc of state.npcs) npc.tags = [];
        for (let i = 0; i < 50; i++) expect(whoSplitsAHouse(state, day, forStream('own-clock', 'none', i))).toBeNull();
    });
});

describe('what going would cost somebody', () => {
    function member(rank: number, ties: NpcRecord['relationships'] = [], merit = 0): NpcRecord {
        return {
            ...setRealm(createNpc('own-clock', { id: 'weighing', bornOnDay: 0, onDay: DAY, locationId: null, occupation: 'disciple' }), 20, DAY),
            factionId: 'house-a', factionRankIndex: rank, relationships: ties,
            merit: merit > 0 ? { houseId: 'house-a', points: merit } : null
        };
    }
    const tie = (id: string, since: number): NpcRecord['relationships'][number] => ({
        targetId: id, targetName: id, kind: 'master', standing: 0.6, note: '', sinceDay: since,
        lastChangedDay: since, factIds: [], inheritedFromId: null
    });
    const cost = (npc: NpcRecord, alignment: 'righteous' | 'neutral' | 'demonic', tags: string[] = []) =>
        whatLeavingTheirHouseCosts({
            npc, house: { id: 'house-a', alignment, tags, ranks: RANKS }, lifespanYears: 500, day: DAY,
            onTheRoll: () => true
        });

    it('grows with the years among its people, the ties, the rung and the merit that would stay behind', () => {
        const newcomer = member(0, [tie('a', DAY - 1 * YEAR)]);
        const oldHand = member(4, [tie('a', DAY - 200 * YEAR), tie('b', DAY - 150 * YEAR), tie('c', DAY - 90 * YEAR)], 2_000);
        expect(cost(oldHand, 'righteous')).toBeGreaterThan(cost(newcomer, 'righteous') * 3);
        expect(cost(member(4, [], 2_000), 'neutral')).toBeGreaterThan(cost(member(4, [], 0), 'neutral'));
    });

    it('holds people in a family house hardest and in a demonic one far less, and neutral close to righteous', () => {
        const oldHand = member(4, [tie('a', DAY - 200 * YEAR), tie('b', DAY - 150 * YEAR)], 1_000);
        const righteous = cost(oldHand, 'righteous');
        expect(cost(oldHand, 'neutral', ['bloodline'])).toBeGreaterThan(righteous);
        expect(cost(oldHand, 'neutral')).toBeGreaterThan(righteous * 0.9);
        expect(cost(oldHand, 'demonic')).toBeLessThan(righteous / 2);
    });
});

describe('somebody senior leaving is news, and somebody junior barely noticed', () => {
    it('cools the ties of the people left behind in proportion to how high the leaver stood', () => {
        const state = aHouse();
        const elder = person(state, 'elder-going', 4, 36);
        const junior = person(state, 'junior-going', 0, 8);
        const disciple = person(state, 'left-behind', 1, 20);
        const at = state.npcs.findIndex(n => n.id === disciple.id);
        const warm = (id: string): NpcRecord['relationships'][number] => ({
            targetId: id, targetName: id, kind: 'master', standing: 0.6, note: '', sinceDay: DAY, lastChangedDay: DAY, factIds: [], inheritedFromId: null
        });
        state.npcs[at] = { ...state.npcs[at]!, relationships: [warm(elder.id), warm(junior.id)] };
        const house = state.factions[0]!;
        expect(whatTheirLeavingStirs(state, junior, house, DAY)).toBe(0);
        expect(whatTheirLeavingStirs(state, elder, house, DAY)).toBeGreaterThan(0);
        const after = state.npcs.find(n => n.id === disciple.id)!;
        expect(after.relationships.find(r => r.targetId === elder.id)!.standing).toBeLessThan(0.6);
        expect(after.relationships.find(r => r.targetId === junior.id)!.standing).toBe(0.6);
        expect(howLoudALeavingIs(0, RANKS.length)).toBeLessThan(WORTH_REPEATING);
        expect(howLoudALeavingIs(4, RANKS.length)).toBeGreaterThan(WORTH_REPEATING);
    });
});

describe('the oath a house offers at its door', () => {
    it('is a silence oath the leaver holds when sworn, and a grievance the house holds when refused', () => {
        const at = { leaverId: 'p', leaverName: 'P', houseId: 'house-a', houseName: 'The Test Hall', onDay: DAY };
        const sworn = theOathAHouseOffersAtItsDoor({ ...at, answer: 'swear' });
        expect(sworn.record.kind).toBe('oath');
        expect(sworn.record.cause).toBe('silence');
        expect(sworn.record.holderId).toBe('p');
        expect(sworn.record.subjectId).toBe('house-a');
        const refused = theOathAHouseOffersAtItsDoor({ ...at, answer: 'refuse' });
        expect(refused.record.kind).toBe('grudge');
        expect(refused.record.holderId).toBe('house-a');
        expect(refused.record.subjectId).toBe('p');
    });
});

describe('somebody on no roll moves on', () => {
    it('goes on from ground that is not a town, and keeps to the provinces they keep to', async () => {
        const { state } = seedWorld({ seed: 'shape-a', catalog: await loadCultivationCatalog() });
        const ruin = state.locations.find(l => l.kind === 'ruin' && regionOfLocation(state, l.id) === 'loc-region-low-fall')!;
        expect(ruin).toBeDefined();
        const row = state.npcs.find(n => n.status === 'alive' && n.factionId === null
            && n.cultivation.realmOrdinal >= 13 && isTheWorldsToMove(n) && !n.tags.some(t => t.startsWith('catalog:')))!;
        const at = state.npcs.findIndex(n => n.id === row.id);
        state.npcs[at] = { ...row, locationId: ruin.id, activity: null, tags: [...row.tags, 'keeps-to:loc-region-low-fall'] };
        let moved = false;
        for (let year = 1; year < 80 && !moved; year++) {
            peopleWithNoHouseMoveOn(state, year, year * 365);
            moved = state.npcs[at]!.locationId !== ruin.id;
        }
        expect(moved).toBe(true);
        expect(regionOfLocation(state, state.npcs[at]!.locationId)).toBe('loc-region-low-fall');
    }, 300_000);
});

describe('the wanderer the catalog names', () => {
    it('is somebody in the world at his catalog ordinal, a guest of the Court on no rung, and on no roll after the years pass', async () => {
        const { state } = seedWorld({ seed: 'shape-a', catalog: await loadCultivationCatalog() });
        const lu = () => state.npcs.find(n => n.name === 'Lu Sheng');
        expect(lu()).toBeDefined();
        expect(lu()!.cultivation.realmOrdinal).toBe(45);
        expect(lu()!.factionId).toBeNull();
        expect(whoseGuestTheyAre(lu()!)).toBe('sect-hollow-court');
        expect(lu()!.locationId).not.toBeNull();
        // The rung's figure less his age: the crossing charged him nothing in years.
        const age = HOLLOW_COURT_ROSTER.find(m => m.name === 'Lu Sheng')!.ageYears;
        expect(Math.round((lu()!.cultivation.lifespanEndsOnDay - state.currentDay) / 365)).toBe(FALSE_IMMORTAL_LIFESPAN_YEARS - age);
        expect(theWorldMayEnd(lu()!)).toBe(false);
        advanceWorldYears(state, 10, { stopOnInterrupt: false });
        expect(lu()!.factionId).toBeNull();
    }, 300_000);


    it('lectures the Seats standing at the Court when he goes back, as attention from his rung', async () => {
        const { state } = seedWorld({ seed: 'shape-a', catalog: await loadCultivationCatalog() });
        const court = state.factions.find(f => f.id === 'sect-hollow-court')!;
        for (let i = 0; i < state.npcs.length; i++) {
            if (/^npc-hollow-court-(first|second|third|fourth)-seat$/.test(state.npcs[i]!.id)) {
                state.npcs[i] = { ...state.npcs[i]!, locationId: court.seatLocationId, activity: null };
            }
        }
        let lectured: NpcRecord | null = null;
        for (let year = 1; year < 100 && lectured === null; year++) {
            if (theWanderersGoAbout(state, year, year * 365).lectures > 0) lectured = state.npcs.find(n => n.name === 'Lu Sheng')!;
        }
        expect(lectured).not.toBeNull();
        expect(lectured!.activity!.kind).toBe('teaching');
        expect(lectured!.locationId).toBe(court.seatLocationId);
        expect(lectured!.activity!.withIds.length).toBe(4);
    }, 300_000);
});
