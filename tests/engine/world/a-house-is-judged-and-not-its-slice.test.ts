/**
 * A house falls when it cannot pay or nobody is left to carry its name, never
 * because the handful of its people the world models is short.
 *
 * `faction_fell` read `members < 3`, and `lost_vein` with fewer than six, off
 * the roll. A roll is the ten or twenty people a player could come to know out
 * of a house of hundreds (`a-house-and-who-is-in-it.md`), so the test was of the
 * slice. Measured on `shape-a` over 1,000 years: of the 24 catalog houses that
 * fell, 21 fell on one of those two counts - most holding hundreds of thousands
 * of stones and a member with a thousand years or more left to live.
 *
 * And an EMPTY roll is not nobody either. A house whose compound stands and
 * sleeps people nobody models (`howManyAHouseReallyHas`) still has them, and
 * one of them comes forward (`a-house-takes-in-one-of-its-own.ts`). Two
 * defects were hiding under that, both measured on the same seed:
 *
 *   a splinter is seated where its founder stood - the grounds of the house it
 *   split from - and when the splinter fell, it left THOSE grounds "standing and
 *   empty" and tagged ruined, so the house still living there read as gone.
 *
 *   a house was destroyed by any rival with a wide enough gap, at peace or not:
 *   12 of the 38 catalog houses over 2,500 years. It now takes a war.
 *
 * Catalog houses of 38 standing at 2,500 years on `shape-a`, one arm per step
 * from a frozen copy of the tree before: 4 before; 15 with the counts gone, an
 * empty roll read against the compound and a war holding together while an
 * elder lives; 13 with destruction taking a war; 16 with houses taking in their
 * own; 25 with the squatting splinter fixed. On `shape-b`, 5 before and 27
 * after. The map still moves: houses founded since world open went from 137 and
 * 171 to 223 and 246.
 */

import { describe, it, expect } from 'vitest';
import { whetherAHouseHasFailed } from '../../../src/engine/world/the-world-changing-on-its-own.js';
import {
    stillHasPeopleNobodyModels,
    theHousesTakeInTheirOwn
} from '../../../src/engine/world/a-house-takes-in-one-of-its-own.js';
import { createNpc, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { SECTS } from '../../../src/data/cultivation/sects.js';

const CATALOG = SECTS.find(s => s.recruits && s.ranks.length >= 5)!;

/** Somebody at the head of each roll stands high, so a raised outer disciple fits under them. */
function onTheRoll(house: string, n: number): NpcRecord[] {
    return Array.from({ length: n }, (_, i) => {
        const npc = createNpc('slice', { id: `m${i}`, bornOnDay: 0, onDay: 0 });
        return {
            ...npc, factionId: house, factionRankIndex: 0,
            cultivation: { ...npc.cultivation, realmOrdinal: i === 0 ? 30 : npc.cultivation.realmOrdinal }
        };
    });
}

function compound(house: string, opts: { kind?: string; tags?: string[]; controller?: string | null; sleeps?: number } = {}) {
    return [
        { id: `seat-${house}`, name: 'the grounds', kind: opts.kind ?? 'sect_seat', tags: opts.tags ?? [],
            controllingFactionId: opts.controller === undefined ? house : opts.controller, data: {} },
        { id: `dorm-${house}`, name: 'the quarters', kind: 'room', tags: [], controllingFactionId: house,
            data: { factionId: house, purpose: 'dormitory', capacity: opts.sleeps ?? 300 } }
    ];
}

function world(opts: { members: number; stones: number; tags?: string[]; seat?: Parameters<typeof compound>[1] | null; id?: string }) {
    const id = opts.id ?? 'house-of-a-short-roll';
    const house = makeFaction({
        id, name: 'The Short Roll', resources: { spirit_stones: opts.stones },
        tags: opts.tags ?? ['recruits'], ranks: CATALOG.ranks.slice(),
        seatLocationId: opts.seat === null ? null : `seat-${id}`
    });
    const state = {
        seed: 'slice', currentDay: 1000 * 365, nextNpcSeq: 1,
        factions: [house], npcs: onTheRoll(id, opts.members),
        locations: opts.seat === null ? [] : compound(id, opts.seat ?? {})
    } as unknown as WorldState;
    return { state, house };
}

describe('what makes a house fall', () => {
    it('is not a short roll, with or without its vein', () => {
        for (const members of [1, 2]) {
            const { state, house } = world({ members, stones: 250_000, seat: null });
            expect(whetherAHouseHasFailed(state, house), `${members} on the roll`).toBe(false);
        }
        const { state, house } = world({ members: 4, stones: 250_000, tags: ['lost_vein'], seat: null });
        expect(whetherAHouseHasFailed(state, house)).toBe(false);
    });

    it('is not an empty roll while the compound stands and sleeps people nobody models', () => {
        const { state, house } = world({ members: 0, stones: 250_000 });
        expect(stillHasPeopleNobodyModels(state, house)).toBe(true);
        expect(whetherAHouseHasFailed(state, house)).toBe(false);
    });

    it('is not grounds a squatting splinter left tagged ruined, while they are still a seat', () => {
        const { state, house } = world({ members: 0, stones: 250_000, seat: { tags: ['ruined'], controller: null } });
        expect(whetherAHouseHasFailed(state, house)).toBe(false);
    });

    it('is nobody left: no compound, a compound a conquest made a ruin, or one another house holds', () => {
        expect(whetherAHouseHasFailed(world({ members: 0, stones: 250_000, seat: null }).state,
            world({ members: 0, stones: 250_000, seat: null }).house)).toBe(true);
        const ruined = world({ members: 0, stones: 250_000, seat: { kind: 'ruin' } });
        expect(whetherAHouseHasFailed(ruined.state, ruined.house)).toBe(true);
        const taken = world({ members: 0, stones: 250_000, seat: { controller: 'somebody-else' } });
        expect(whetherAHouseHasFailed(taken.state, taken.house)).toBe(true);
    });

    it('is an empty purse, however many are on the roll', () => {
        const { state, house } = world({ members: 20, stones: 100 });
        expect(whetherAHouseHasFailed(state, house)).toBe(true);
    });
});

describe('a house takes in one of its own', () => {
    it('brings one forward a year, at the bottom, while the roll is short and the compound stands', () => {
        const { state } = world({ id: CATALOG.id, members: 1, stones: 250_000 });
        const day = state.currentDay;
        expect(theHousesTakeInTheirOwn(state, 1000, day)).toBe(1);
        const raised = state.npcs.filter(n => n.factionId === CATALOG.id && n.id !== 'm0');
        expect(raised).toHaveLength(1);
        expect(raised[0]!.factionRankIndex).toBe(0);
        expect(raised[0]!.locationId).toBe(`seat-${CATALOG.id}`);
    });

    it('brings nobody into a house with no compound, a ruined one, or a full roll', () => {
        const none = world({ id: CATALOG.id, members: 1, stones: 250_000, seat: null });
        expect(theHousesTakeInTheirOwn(none.state, 1000, none.state.currentDay)).toBe(0);
        const ruin = world({ id: CATALOG.id, members: 1, stones: 250_000, seat: { kind: 'ruin' } });
        expect(theHousesTakeInTheirOwn(ruin.state, 1000, ruin.state.currentDay)).toBe(0);
        const full = world({ id: CATALOG.id, members: 60, stones: 250_000 });
        expect(theHousesTakeInTheirOwn(full.state, 1000, full.state.currentDay)).toBe(0);
    });

    it('brings nobody into a house the catalog did not write', () => {
        const { state } = world({ id: 'sect-splinter-somebody', members: 1, stones: 250_000 });
        expect(theHousesTakeInTheirOwn(state, 1000, state.currentDay)).toBe(0);
    });
});
