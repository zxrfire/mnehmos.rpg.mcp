/**
 * The world's own people join a house the way a player does.
 *
 * The design owner: *"Yes, unless they were already seeded. NPCs join the same
 * way you do."* `applyRecruitment` enrolled anybody unaffiliated in a house's
 * province on a coin, with nobody of the house there and no day the house was
 * taking anybody. Now it takes somebody only where `theRoadOntoARoll` - the rule
 * a player's join reads - finds a road, and whoever that is took them on.
 *
 * Measured with `probe-do-npcs-join-the-way-a-player-does.ts`, four seeds, per
 * century, the rule against the coin it replaced:
 *
 *                               coin (100 / 200 / 300 years)   through a door
 *   recruited, four seeds       1394 / 1320 / 1288             1099 / 1131 / 1125
 *   roll median                 16-17                          16-18
 *   houses short of their roll  0-3 each                       0-3 each
 *   on sect ground              20.5-40.8%                     31.9-40.9%
 *
 * A year's roads on `demography` at 50 years: of 913 unaffiliated people and
 * houses in reach, 511 had none, 371 a selection, 30 an intake, 1 somebody out
 * recruiting. The selection is most of it because a province holds about ten
 * houses and each opens its grounds one year in three.
 *
 * Red-checked: with `theRoadOntoARoll` ignored in `applyRecruitment` the
 * no-road test goes red; with the in-person road dropped the recruiter test
 * goes red.
 */

import { describe, expect, it } from 'vitest';

import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import { applyPressure } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import { whoTheySayTookThemOn } from '../../../src/engine/world/a-house-expects-somebody-it-took-on.js';
import {
    theRoadOntoARoll,
    theSelectionIn,
    type OneOfTheHouse
} from '../../../src/engine/world/when-a-house-takes-people-on.js';
import { theRoadsOntoARollThisYear } from '../../../src/engine/world/the-world-joins-a-house-the-way-a-player-does.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { advanceWorldYears } from '../../support/advance-world-years.js';
import { FACTION_PARENTAGE } from '../../../src/data/cultivation/governance-and-water-rights.js';

const HOUSE = 'house-takes-people-on';
const SEED = 'the-world-joins-a-house';
const SEAT = 'seat-a';
const VILLAGE = 'loc-village';

/** The first year from 400 in which the house does, or does not, open its grounds. */
function aYear(opens: boolean): number {
    for (let y = 400; ; y++) if ((theSelectionIn(SEED, HOUSE, y) !== null) === opens) return y;
}

function build(year: number): WorldState {
    const day = year * DAYS_PER_YEAR;
    const state = createWorld({ seed: SEED, skipPriorAges: true, regionCount: 0 });
    state.currentDay = day;
    const region = makeLocation({ id: 'loc-region', name: 'The Province', kind: 'region' });
    const seat = makeLocation({ id: SEAT, name: 'The Hall', kind: 'sect_seat', parentId: region.id });
    // Not a place the catalog names, so no wall carries an intake for it.
    const village = makeLocation({ id: VILLAGE, name: 'Nowhere Ford', kind: 'settlement', parentId: region.id });
    state.locations.push(region, seat, village);
    state.factions.push(makeFaction({
        id: HOUSE, name: 'The Test Hall', seatLocationId: SEAT, foundedOnDay: 0, tags: ['recruits'],
        resources: { spirit_stones: 50_000, power_ordinal: 4, reliable_ordinal: 4, admission_ordinal: 0 }
    }));
    const person = (id: string, at: string, faction: string | null, rank: number): NpcRecord => ({
        ...setRealm(createNpc(state.seed, {
            id, name: id, bornOnDay: day - 30 * DAYS_PER_YEAR, onDay: day, locationId: at, occupation: 'farmer'
        }), 3, day),
        factionId: faction, factionRankIndex: faction === null ? -1 : rank, activity: null
    });
    state.npcs.push(person('elder', SEAT, HOUSE, 4));
    for (let i = 0; i < 72; i++) state.npcs.push(person(`villager-${i}`, VILLAGE, null, -1));
    return state;
}

const joiners = (state: WorldState) => state.npcs.filter(n => n.id.startsWith('villager-') && n.factionId === HOUSE);

describe('the rule itself', () => {
    const of = (id: string, rank: number, note: string | null): OneOfTheHouse => ({
        id, status: 'alive', factionId: HOUSE, factionRankIndex: rank,
        activity: note === null ? null : { kind: 'out_with_a_party', note }
    });

    it('takes somebody on in person where one of the house is out looking for disciples', () => {
        expect(theRoadOntoARoll({
            houseId: HOUSE,
            ofTheHouseHere: [of('senior', 5, null), of('looking', 1, 'Out for the Test Hall on looking for disciples.')],
            atItsGroundsForASelection: true, atItsIntake: false, whoRunsIt: () => 'elsewhere'
        })).toEqual({ how: 'in person', recruiterId: 'looking' });
    });

    it('at a selection or an intake, by the most senior of the house there, else whoever the house sent', () => {
        expect(theRoadOntoARoll({
            houseId: HOUSE, ofTheHouseHere: [of('junior', 1, null), of('senior', 5, null)],
            atItsGroundsForASelection: true, atItsIntake: false, whoRunsIt: () => 'elsewhere'
        })).toEqual({ how: 'at its selection', recruiterId: 'senior' });
        expect(theRoadOntoARoll({
            houseId: HOUSE, ofTheHouseHere: [],
            atItsGroundsForASelection: false, atItsIntake: true, whoRunsIt: () => 'sent'
        })).toEqual({ how: 'at its intake', recruiterId: 'sent' });
    });

    it('and not at all otherwise, however many of the house are standing there', () => {
        expect(theRoadOntoARoll({
            houseId: HOUSE, ofTheHouseHere: [of('senior', 5, null)],
            atItsGroundsForASelection: false, atItsIntake: false, whoRunsIt: () => 'sent'
        })).toBeNull();
    });
});

describe('the world\'s own intake', () => {
    it('takes nobody in a year the house has no road to them', () => {
        const year = aYear(false);
        const state = build(year);
        expect(theRoadsOntoARollThisYear(state, year).roadFor(state.factions[0]!, state.npcs[1]!)).toBeNull();
        applyPressure(state, year * DAYS_PER_YEAR, year * DAYS_PER_YEAR + 364, { intensity: 0 });
        expect(joiners(state)).toEqual([]);
    });

    it('takes people on the year it opens its grounds, run by whoever of it is at them', () => {
        const year = aYear(true);
        const state = build(year);
        applyPressure(state, year * DAYS_PER_YEAR, year * DAYS_PER_YEAR + 364, { intensity: 0 });
        const taken = joiners(state);
        expect(taken.length, 'nobody was taken on at the selection').toBeGreaterThan(0);
        for (const n of taken) {
            // Either still telling who took them on, or already entered on it.
            const said = whoTheySayTookThemOn(n, HOUSE);
            if (said !== null) expect(said.recruiterId).toBe('elder');
        }
    });

    it('and in person, by the one of it out looking for disciples in their village', () => {
        const year = aYear(false);
        const state = build(year);
        const at = state.npcs.findIndex(n => n.id === 'elder');
        state.npcs[at] = {
            ...state.npcs[at]!, locationId: VILLAGE,
            activity: {
                kind: 'out_with_a_party', note: 'Out for the Test Hall on looking for disciples.', withIds: [],
                sinceDay: year * DAYS_PER_YEAR, untilDay: year * DAYS_PER_YEAR + 300, returnTo: SEAT
            }
        };
        applyPressure(state, year * DAYS_PER_YEAR, year * DAYS_PER_YEAR + 200, { intensity: 0 });
        const taken = joiners(state);
        expect(taken.length, 'nobody was taken on by the recruiter in the village').toBeGreaterThan(0);
        for (const n of taken) expect(whoTheySayTookThemOn(n, HOUSE)?.recruiterId).toBe('elder');
    });
});

/**
 * A FAMILY'S OWN CHILD IS NOT A STRANGER AT ITS DOOR. `governance-and-water-
 * rights.ts`: "the seven family houses, whose intake is kinship and whose name is
 * the family's, are `bloodline`", against "a sect with an admission day". Measured
 * on `demography` and `afford-a` over a century: 46 of 46 children born to a
 * member of a bloodline house came onto its roll, against 12 and 8 of 174 and
 * 185 born to a member of a sect, who went through its door like anybody else.
 * Red-checked by dropping the kinship branch in `applyDemography`: this goes red.
 */
describe('a child of a family house', () => {
    it('is of the family by kinship, unless fostered out', async () => {
        const { state } = seedWorld({ seed: 'demography', catalog: await loadCultivationCatalog() });
        const bloodline = new Set(state.factions
            .filter(f => FACTION_PARENTAGE[f.id]?.governance === 'bloodline').map(f => f.id));
        expect(bloodline.size).toBeGreaterThan(0);
        let seen = 0;
        for (let y = 0; y < 25; y++) {
            const known = new Set(state.npcs.map(n => n.id));
            const houseOf = new Map(state.npcs.map(n => [n.id, n.factionId]));
            advanceWorldYears(state, 1, { stopOnInterrupt: false });
            const parentOf = new Map<string, string>();
            for (const l of state.lineages) for (const e of l.edges) parentOf.set(e.childId, e.parentId);
            for (const child of state.npcs) {
                if (known.has(child.id) || child.tags.includes('fostered')) continue;
                const parent = parentOf.get(child.id);
                const family = parent === undefined ? null : houseOf.get(parent) ?? null;
                if (family === null || !bloodline.has(family)) continue;
                if (!state.factions.some(f => f.id === family && f.dissolvedOnDay === null)) continue;
                seen++;
                expect(child.factionId, `${child.name}, born to the ${family}`).toBe(family);
            }
        }
        expect(seen, 'no child was born to a family house in 25 years').toBeGreaterThan(0);
    }, 300_000);
});
