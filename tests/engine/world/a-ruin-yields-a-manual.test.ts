/**
 * Ruins yield manuals, and a book that comes out of one reaches a pair of hands.
 *
 * ── THE DEFECT, MEASURED ─────────────────────────────────────────────────
 *
 * The simulation could not carry anybody across the hole in the teaching ladder
 * by any route that involved ground. Rungs 35 to 40 have eleven capped books
 * opening in them and no house in the world teaches one, and the four canons
 * that reach the Lid open at 41 - above the hole - so the only way up was to be
 * handed a book before you needed it. Over 5,000 simulated years on two seeds
 * the shut-reason columns had `book` and `province` doing essentially all the
 * work; one seed ended at ordinal 37 with nobody at Tribulation Transcendence,
 * and the other reached 44 only because `mightFindARoad` - an abstract luck
 * roll with no ground in it - happened to hand somebody a canon early.
 *
 * Two things were wrong and the catalog had said so the whole time.
 *
 * `SOURCE_NOTES.ruin` says of thirty-seven capped arts that copies of them
 * survive only in sealed sites, and those thirty-seven plus the four `grave`
 * rows are EXACTLY the forty-one capped arts nobody teaches. NOT ONE was ever
 * in a sealed site: no pass anywhere put a manual into a ruin.
 *
 * And `ruin_opened` handed its opener `recovered-${ruin.id}` for every kind of
 * ground except the never-shut minority - an id in no catalog, which
 * `getTechnique` returns undefined for, which sets no ceiling and which nobody
 * can be taught from. The world opened ruins and the people who went in came
 * out holding a string.
 *
 * ── WHAT THESE ASSERTIONS ENCODE ─────────────────────────────────────────
 *
 * What a ruin holds follows from what the ruin IS - its character, the rung it
 * was calibrated for, and who was in it - and never from a rate. There is ONE
 * reading of which ruin-provenance art is written down in a piece of ground,
 * and `theArtLeftInThisGround` and the shelf both take it, so they cannot come
 * to different conclusions about the same hole. And what comes out is an OBJECT
 * on a house's shelf as well as a road on somebody's sheet, because a single
 * copy in a single pair of hands is the defect rather than the repair.
 *
 * Every assertion below was red-checked against the behaviour it covers.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { makeLocation, makeThresholds } from '../../../src/engine/world/locations.js';
import type { NpcRecord } from '../../../src/engine/world/npc-state.js';
import { isRuined } from '../../../src/engine/world/possessions.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import { housesTeaching, manualIdOf } from '../../../src/engine/world/manuals.js';
import { TECHNIQUES, getTechnique } from '../../../src/data/cultivation/techniques.js';
import { RuinCharacterSchema } from '../../../src/data/cultivation/inheritance-trials.js';
import {
    A_NAME_IS_ON_THE_THING,
    theArtLeftInThisGround,
    theArtsWrittenDownIn
} from '../../../src/engine/world/a-legacy-has-a-name-on-it-and-a-treasury-has-stock.js';
import {
    LEFT_IN_THE_GROUND,
    WHAT_A_SHELF_HOLDS,
    applyWhatThePartyCarriedOut,
    bookInTheGroundId,
    booksLyingIn,
    characterOf,
    shelveWhatItWasHolding,
    theBooksBehindTheirDoor,
    theBooksLeftIn,
    theRoadsThatWouldLeaveTheWorldWith,
    whatWasOnTheShelvesOf,
    whoOfThemCouldOpenIt
} from '../../../src/engine/world/what-a-ruin-has-on-its-shelves.js';

/** A road that opens inside the hole and that nothing in the world teaches. */
const IN_THE_HOLE = 'heaven-conversing-primordial-canon';
/** And one every reader of a shelf can already be handed. */
const TAUGHT_SOMEWHERE = 'clear-terrace-ascension-canon';

function world(seed = 'shelves'): WorldState {
    return seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population: 60 }).state;
}

function ground(
    id: string,
    standsAt: number,
    data: Record<string, string | number | boolean | null> = {}
) {
    return makeLocation({
        id,
        name: 'The Shelves Under the Fall',
        kind: 'ruin',
        parentId: null,
        description: 'A room with the order still on the shelves.',
        // `theRungThisWasSetFor` is `thresholds.mastery`, so that is what
        // `standsAt` names here.
        thresholds: makeThresholds(
            Math.max(0, standsAt - 4), Math.max(0, standsAt - 3),
            Math.max(0, standsAt - 1), standsAt),
        sealed: true,
        data
    });
}

function personAt(state: WorldState, tag: string, ordinal: number, holding: string[] = []): NpcRecord {
    const row = state.npcs.find(n => n.status === 'alive')!;
    const made: NpcRecord = {
        ...row,
        id: `probe-${tag}`,
        name: `Reader ${tag}`,
        factionId: null,
        cultivation: { ...row.cultivation, realmOrdinal: ordinal, techniqueIds: [...holding] }
    };
    state.npcs.push(made);
    return made;
}

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOG ALREADY SAID WHERE THESE BOOKS WERE
// ─────────────────────────────────────────────────────────────────────────

describe('the stock is the catalog, not a rate', () => {
    it('is exactly the capped arts nobody teaches', () => {
        const fromTheGround = TECHNIQUES
            .filter(t => t.cap != null && (t.provenance === 'ruin' || t.provenance === 'grave'))
            .map(t => t.id)
            .sort();
        const untaught = TECHNIQUES
            .filter(t => t.cap != null && housesTeaching(t.id) === 0)
            .map(t => t.id)
            .sort();
        expect(fromTheGround.length).toBeGreaterThan(0);
        expect(untaught).toEqual(fromTheGround);
    });

    it('puts the road that opens inside the hole into ground of that height', () => {
        const shelf = whatWasOnTheShelvesOf(ground('in-the-hole', 37), 'archive');
        expect(shelf.map(m => m.id)).toContain(IN_THE_HOLE);
        for (const m of shelf) expect(housesTeaching(m.id)).toBe(0);
    });

    it('holds a book at every height, including the deepest ground in the world', () => {
        for (const at of [14, 25, 33, 37, 42, 46]) {
            expect(whatWasOnTheShelvesOf(ground(`at-${at}`, at), 'archive').length)
                .toBeGreaterThan(0);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ONE READING, NOT TWO
// ─────────────────────────────────────────────────────────────────────────

describe('what is written down in a piece of ground', () => {
    it('is the same answer a legacy gives, because it is the same reading', () => {
        const bequest = ground('bequest', 33, { provenanceStanding: A_NAME_IS_ON_THE_THING });
        expect(theArtLeftInThisGround(bequest))
            .toBe(theArtsWrittenDownIn(bequest, { provenance: 'ruin', howMany: 1 })[0]);
        expect(theArtLeftInThisGround(bequest)).not.toBeNull();
    });

    it('never names an art the record attests and no copy of survives', () => {
        const everything = theArtsWrittenDownIn(
            ground('everything', 46), { provenance: 'ruin', howMany: 12 });
        expect(everything.length).toBeGreaterThan(0);
        for (const id of everything) {
            expect(getTechnique(id)!.survivingCopy).toBe(true);
        }
    });

    it('does not reach above the rung the ground was calibrated for', () => {
        for (const id of theArtsWrittenDownIn(
            ground('shallow', 10), { provenance: 'ruin', howMany: 5 })) {
            expect(Number(getTechnique(id)!.requiredOrdinal ?? 0)).toBeLessThanOrEqual(10);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT A RUIN HOLDS FOLLOWS FROM WHAT IT IS
// ─────────────────────────────────────────────────────────────────────────

describe('what is on the shelves', () => {
    it('says of every character of ground whether anybody shelved anything in it', () => {
        for (const character of RuinCharacterSchema.options) {
            expect(WHAT_A_SHELF_HOLDS[character]).toBeTypeOf('number');
        }
    });

    it('puts books in an archive and none on a battlefield', () => {
        const here = ground('band-five', 37);
        expect(whatWasOnTheShelvesOf(here, 'archive').length).toBeGreaterThan(0);
        expect(whatWasOnTheShelvesOf(here, 'battlefield')).toEqual([]);
    });

    it('reaches higher out of deep ground than out of shallow ground', () => {
        const shallow = whatWasOnTheShelvesOf(ground('shallow-shelf', 14), 'archive');
        const deep = whatWasOnTheShelvesOf(ground('deep-shelf', 42), 'archive');
        expect(Math.max(...deep.map(m => m.cap)))
            .toBeGreaterThan(Math.max(0, ...shallow.map(m => m.cap)));
    });

    it('reads the character off the row the describing pass wrote', () => {
        expect(characterOf(ground('tagged', 20, { ruinCharacter: 'archive' }))).toBe('archive');
        expect(characterOf(ground('bare', 20))).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND GROUND SOMEBODY LEFT HOLDS WHAT THEY HAD
// ─────────────────────────────────────────────────────────────────────────

describe('what is behind a dead cultivators door', () => {
    it('is the road that would otherwise leave the world with them', () => {
        const state = world();
        const dead = personAt(state, 'dead', 40, [IN_THE_HOLE, TAUGHT_SOMEWHERE]);
        const roads = theRoadsThatWouldLeaveTheWorldWith(dead).map(m => m.id);
        expect(roads).toContain(IN_THE_HOLE);
        // Houses teach it, so it does not leave the world when he does and
        // there is nothing for a hole to preserve.
        expect(roads).not.toContain(TAUGHT_SOMEWHERE);
    });

    it('is an object nobody holds, lying at the door', () => {
        const state = world();
        const dead = personAt(state, 'occupant', 40, [IN_THE_HOLE]);
        const door = ground('loc-closed-probe', 40);
        const left = theBooksBehindTheirDoor({ location: door, occupant: dead, onDay: 100 });
        expect(left).toHaveLength(1);
        expect(left[0].id).toBe(bookInTheGroundId(door.id, IN_THE_HOLE));
        expect(manualIdOf(left[0])).toBe(IN_THE_HOLE);
        expect(left[0].possessorId).toBeNull();
        expect(left[0].locationId).toBe(door.id);
        expect(left[0].tags).toContain(LEFT_IN_THE_GROUND);
    });

    it('does not double the shelf when the pass looks twice', () => {
        const state = world();
        const dead = personAt(state, 'twice', 40, [IN_THE_HOLE]);
        const door = ground('loc-closed-twice', 40);
        const books = theBooksBehindTheirDoor({ location: door, occupant: dead, onDay: 100 });
        expect(shelveWhatItWasHolding(state, books)).toBe(1);
        expect(shelveWhatItWasHolding(state, books)).toBe(0);
        expect(booksLyingIn(state, door.id)).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AND WHOEVER GETS IN CARRIES IT OUT
// ─────────────────────────────────────────────────────────────────────────

describe('what comes out of the hole', () => {
    function holeWithBooksInIt(state: WorldState, id = 'loc-hole') {
        // Calibrated inside the hole, so what comes out is what the hole is
        // about and a reader standing at 40 can open all of it.
        const door = ground(id, 37, { ruinCharacter: 'archive' });
        const books = theBooksLeftIn({ location: door, character: 'archive', onDay: 0 });
        shelveWhatItWasHolding(state, books);
        return { door, books };
    }

    const HOUSE = { id: 'house-probe', name: 'The Probe Hall', seatLocationId: null };

    it('lands the copy on the house shelf unread, for the house to decide who reads it', () => {
        // Carrying is not reading. The finder used to take the art on the spot,
        // which for a one-reader book meant whoever picked it up spent the
        // house's only read. The house decides through `newlyEntitled`.
        const state = world();
        const { door, books } = holeWithBooksInIt(state);
        expect(books.length).toBeGreaterThan(0);
        const highest = Math.max(...books.map(b => Number(b.data.cap)));
        const reader = personAt(state, 'strong', 40);

        const out = applyWhatThePartyCarriedOut(state, {
            locationId: door.id, house: HOUSE, readers: [reader], onDay: 500
        });

        expect(out).toHaveLength(books.length);
        expect(booksLyingIn(state, door.id)).toEqual([]);
        for (const row of out) {
            const object = state.objects.find(o => o.id === row.objectId)!;
            expect(object.possessorId).toBe(HOUSE.id);
            expect(object.tags).not.toContain(LEFT_IN_THE_GROUND);
            expect(object.tags).toContain('library');
        }
        expect(state.npcs.find(n => n.id === reader.id)!.cultivation.techniqueIds).toEqual([]);
        expect(out.every(row => row.readById === null)).toBe(true);
        expect(out.some(row => row.cap === highest)).toBe(true);
    });

    it('still brings out a book nobody who went can open', () => {
        const state = world();
        const { door } = holeWithBooksInIt(state, 'loc-hole-low');
        const tooLow = personAt(state, 'low', 4);

        const out = applyWhatThePartyCarriedOut(state, {
            locationId: door.id, house: HOUSE, readers: [tooLow], onDay: 500
        });

        expect(out.length).toBeGreaterThan(0);
        expect(out.every(row => row.readById === null)).toBe(true);
        // On the house's shelf, waiting for somebody who can - which is what
        // makes it a thing the house teaches rather than a thing one person had.
        for (const row of out) {
            expect(state.objects.find(o => o.id === row.objectId)!.possessorId).toBe(HOUSE.id);
        }
        expect(state.npcs.find(n => n.id === tooLow.id)!.cultivation.techniqueIds).toEqual([]);
    });

    it('hands one book to one reader rather than the whole shelf to the elder', () => {
        const state = world();
        const { door, books } = holeWithBooksInIt(state, 'loc-hole-elder');
        expect(books.length).toBeGreaterThan(1);
        const elder = personAt(state, 'elder', 40);

        // Out for themselves, so the reading is theirs to decide.
        applyWhatThePartyCarriedOut(state, {
            locationId: door.id, house: null, readers: [elder], onDay: 500
        });

        expect(state.npcs.find(n => n.id === elder.id)!.cultivation.techniqueIds).toHaveLength(1);
    });

    it('gives a book to the strongest of them who can open it', () => {
        const state = world();
        const low = personAt(state, 'lesser', 37);
        const high = personAt(state, 'greater', 40);
        const book = whatWasOnTheShelvesOf(ground('picking', 37), 'archive')
            .find(m => m.element === null && m.requiredOrdinal <= 37)!;
        expect(whoOfThemCouldOpenIt([low, high], book)!.id).toBe(high.id);
        expect(whoOfThemCouldOpenIt([low, high], { ...book, requiredOrdinal: 44 })).toBeNull();
    });

    it('teaches nobody off a heaven book whose uses are already spent', () => {
        // The world's own reader took the art off the page for nothing: the use
        // counter was spent only on the player's path, so the one-reader rule
        // for immortal and chaos books and the three-reader rule for heaven held
        // for the player and for nobody else. The book still comes home.
        const state = world();
        const { door } = holeWithBooksInIt(state, 'loc-hole-read-out');
        for (let i = 0; i < state.objects.length; i++) {
            const o = state.objects[i];
            if (o.locationId !== door.id) continue;
            state.objects[i] = { ...o, data: { ...o.data, usesSpent: 99 } };
        }
        const reader = personAt(state, 'late', 40);

        // Out for themselves, so it is theirs to read if anything is left in it.
        const out = applyWhatThePartyCarriedOut(state, {
            locationId: door.id, house: null, readers: [reader], onDay: 500
        });

        const runsOut = out.filter(row =>
            ['heaven', 'immortal', 'chaos'].includes(getTechnique(row.techniqueId)?.grade ?? ''));
        expect(runsOut.length).toBeGreaterThan(0);
        for (const row of runsOut) {
            expect(row.readById).toBeNull();
            expect(state.objects.find(o => o.id === row.objectId)!.possessorId).toBe(reader.id);
        }
        const learned = state.npcs.find(n => n.id === reader.id)!.cultivation.techniqueIds;
        for (const row of runsOut) expect(learned).not.toContain(row.techniqueId);
    });

    it('leaves a rogue carrying their own copy rather than seeding a library', () => {
        const state = world();
        const { door } = holeWithBooksInIt(state, 'loc-hole-rogue');
        const rogue = personAt(state, 'rogue', 40);

        const out = applyWhatThePartyCarriedOut(state, {
            locationId: door.id, house: null, readers: [rogue], onDay: 500
        });

        expect(out.length).toBeGreaterThan(0);
        for (const row of out) {
            const object = state.objects.find(o => o.id === row.objectId)!;
            expect(object.tags).not.toContain('library');
            // In their pouch - unless they read it to its end, and then it is
            // dust with its row kept, the way a dead person's is.
            if (isRuined(object)) expect(row.readById).toBe(rogue.id);
            else expect(object.possessorId).toBe(rogue.id);
        }
    });
});
