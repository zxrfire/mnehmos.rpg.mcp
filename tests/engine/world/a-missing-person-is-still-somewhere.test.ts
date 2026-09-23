/**
 * A missing person is still somewhere.
 *
 * The design owner: *"they still die of old age unless they advance, and they
 * still die or reappear and can be found dead. Missing people are still somewhere
 * physical, just the sect doesn't know."*
 *
 * ── WHAT WAS THERE BEFORE ────────────────────────────────────────────────
 *
 * `markMissing` set `status: 'missing'`, and every pass that asks for the living
 * skipped them from then on. Measured on `afford-a` over five hundred years: 103
 * people frozen where they were lost, none of whom climbed, moved, came back or
 * died, 17,997 person-years of them past the end of their lifespan, and the count
 * only rising.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────
 *
 *   somebody the world loses is still alive; what changes is that their house
 *   holds that it does not know where they are
 *   they age and die like anybody, and their house learns it when the lamp goes
 *   out; they come back and their house learns that too
 *   the reading a player sees of a tie says unaccounted-for off the same mark
 *   a save holding the old status loads as a living person the world lost sight of
 *
 * Measured on `afford-a` over five hundred years with this: 65 people lost, 26 of
 * them dead by the lamp, 22 back at their house, 8 still lost at the end, and
 * between 3 and 8 at any fifty-year mark whose house does not know where they are.
 *
 * Red-checked: with `markMissing` setting the old status, with the lamp never
 * telling the house, and with the save migration off (three tests red).
 */

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { migrate } from '../../../src/storage/migrations.js';
import { WorldStateRepository } from '../../../src/storage/repos/world-state.repo.js';
import { createNpc, markMissing, theWorldLoses, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { advanceTime } from '../../../src/engine/world/time.js';
import { readTie } from '../../../src/engine/world/reading-a-tie-against-the-roster.js';
import { whatHousesLearnOfTheirOwn } from '../../../src/engine/world/when-somebody-does-not-come-back.js';
import {
    isLostTrackOf,
    theHouseLosesTrackOf,
    whenTheHouseLostTrackOf,
    whenTheWorldLostSightOf
} from '../../../src/engine/world/who-a-house-has-lost-track-of.js';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;
const DAY = 100 * YEAR;
const HOUSE = 'a-house';

function aWorld(): { state: WorldState; person: NpcRecord } {
    const state = createWorld({ seed: 'a-missing-person', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    const seat = makeLocation({ id: 'seat', name: 'The Hall', kind: 'sect_seat' });
    const hills = makeLocation({ id: 'hills', name: 'The Hills', kind: 'wilds' });
    state.locations.push(seat, hills);
    state.factions.push(makeFaction({ id: HOUSE, name: 'The House', seatLocationId: 'seat', foundedOnDay: 0, ranks: ['Outer', 'Inner'] }));
    const person: NpcRecord = {
        ...createNpc(state.seed, { id: 'lost-one', bornOnDay: DAY - 40 * YEAR, onDay: DAY, locationId: 'hills', occupation: 'disciple' }),
        name: 'Lost One', factionId: HOUSE, factionRankIndex: 1, activity: null
    };
    state.npcs.push(person);
    return { state, person };
}

describe('somebody the world loses is still a living person', () => {
    it('stays alive where they are, and their house holds that it does not know where', () => {
        const { state, person } = aWorld();
        const lost = theWorldLoses(person, DAY, 'Went into the hills.')!;
        expect(lost.status).toBe('alive');
        expect(whenTheWorldLostSightOf(lost)).toBe(DAY);
        state.npcs[0] = lost;

        const learned = whatHousesLearnOfTheirOwn(state, DAY);
        expect(learned.lostTrackOf).toBe(1);
        expect(whenTheHouseLostTrackOf(state.factions[0]!, 'lost-one')).toBe(DAY);
        const now = state.npcs[0]!;
        expect(now.status).toBe('alive');
        expect(whenTheWorldLostSightOf(now), 'the mark is the house\'s now, not theirs').toBeNull();
        expect(isLostTrackOf(state, now)).toBe(true);
        // Somewhere real: on the road home, or gone their own way from where they were lost.
        expect(now.activity?.kind === 'travelling' || now.factionId === null).toBe(true);
        expect(now.locationId).toBe('hills');
    });

    it('dies of old age like anybody, and their house learns it when the lamp goes out', () => {
        const { state, person } = aWorld();
        state.npcs[0] = { ...person, cultivation: { ...person.cultivation, lifespanEndsOnDay: DAY + 10 } };
        state.factions[0] = theHouseLosesTrackOf(state.factions[0]!, 'lost-one', DAY - YEAR);

        const out = advanceTime(state, 30, { inPlace: true });
        expect(out.deaths.map(d => d.npcId)).toContain('lost-one');

        const learned = whatHousesLearnOfTheirOwn(state, DAY + 30);
        expect(learned.theLampWentOut).toBe(1);
        expect(whenTheHouseLostTrackOf(state.factions[0]!, 'lost-one')).toBeNull();
        expect(state.history.facts.some(f => f.data.lostTrackOf === 'lost-one' && f.data.outcome === 'dead')).toBe(true);
    });

    it('and one who comes back to the house is known again', () => {
        const { state, person } = aWorld();
        state.factions[0] = theHouseLosesTrackOf(state.factions[0]!, 'lost-one', DAY - YEAR);
        state.npcs[0] = { ...person, locationId: 'seat' };
        const learned = whatHousesLearnOfTheirOwn(state, DAY);
        expect(learned.cameBack).toBe(1);
        expect(isLostTrackOf(state, state.npcs[0]!)).toBe(false);
    });

    it('reads as unaccounted-for to anybody holding a tie to them, off the same mark', () => {
        const { state, person } = aWorld();
        const tie = {
            targetId: person.id, targetName: person.name, kind: 'kin' as const, standing: 0.5, note: '',
            sinceDay: 0, lastChangedDay: 0, factIds: [], inheritedFromId: null
        };
        expect(readTie(state, tie).standing).toBe('living');
        state.factions[0] = theHouseLosesTrackOf(state.factions[0]!, 'lost-one', DAY - YEAR);
        expect(readTie(state, tie).standing).toBe('unaccounted');
    });
});

describe('a save from before', () => {
    it("loads somebody whose status was 'missing' as a living person the world lost sight of", () => {
        const db = new Database(':memory:');
        db.pragma('foreign_keys = ON');
        migrate(db);
        const repo = new WorldStateRepository(db);
        const { state, person } = aWorld();
        state.npcs[0] = { ...markMissing(person, DAY), status: 'missing', tags: [], updatedOnDay: DAY - 5 };
        repo.saveWorld(state);
        const loaded = repo.loadWorld(state.id)!;
        const row = loaded.npcs.find(n => n.id === 'lost-one')!;
        expect(row.status).toBe('alive');
        expect(whenTheWorldLostSightOf(row)).toBe(DAY - 5);
        whatHousesLearnOfTheirOwn(loaded, DAY);
        expect(whenTheHouseLostTrackOf(loaded.factions.find(f => f.id === HOUSE)!, 'lost-one')).toBe(DAY - 5);
        db.close();
    });
});
