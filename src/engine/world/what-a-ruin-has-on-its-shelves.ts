/**
 * What is on the shelves of a piece of found ground, and who carries it out.
 *
 * ── RUINS YIELD MANUALS, AND NOTHING PUT ONE IN A RUIN ───────────────────
 *
 * `docs/world/history/the-late-age.md` says ruins hold *"manuals in grades that
 * are no longer taught because there is no living teacher"*, and
 * `SOURCE_NOTES.ruin` in `techniques.ts` says of thirty-seven capped arts that
 * copies of them survive only in sealed sites. Those thirty-seven and the four
 * `grave` rows beside them are EXACTLY the forty-one capped arts no house in
 * the world teaches - so the hole in the teaching ladder at rungs 35 to 40 is
 * not a gap in the catalog. It is the shelf the catalog describes, standing
 * empty because nothing ever stocked it.
 *
 * Measured over 5,000 years on two seeds before this existed: one ended at
 * ordinal 37 with nobody at Tribulation Transcendence, and the other reached 44
 * only because `mightFindARoad` - an abstract luck roll with no ground in it -
 * happened to hand somebody a canon early. The README carries the table.
 *
 * ── AND WHAT AN OPENER GOT WAS A PLACEHOLDER ─────────────────────────────
 *
 * `ruin_opened` handed its opener `recovered-${ruin.id}` for every kind of
 * ground except the never-shut minority - an id in no catalog, which
 * `getTechnique` returns undefined for, which therefore sets no ceiling and
 * which nobody can be taught from.
 *
 * ── WHAT THIS ADDS, WHICH IS THE OBJECT ──────────────────────────────────
 *
 * An art on the opener's sheet is a single copy in a single pair of hands,
 * which is the defect rather than the repair: when they die it goes with them.
 * A BOOK IS A THING - `shelfOf` reads it, `newlyEntitled` hands it to whoever
 * can open it, and `applyManualCopying` makes more of it once anybody has
 * climbed past its cap.
 *
 * ── WHAT A RUIN HOLDS FOLLOWS FROM WHAT THE RUIN IS ──────────────────────
 *
 *   the character   An archive kept what a house wrote down. A battlefield is
 *                   ground two parties ended each other on; nobody built it and
 *                   nobody shelved anything in it. {@link WHAT_A_SHELF_HOLDS}
 *                   is that distinction and it is the only thing here that is
 *                   new.
 *   the rung        `theArtsWrittenDownIn` reads `thresholds.mastery`, which is
 *                   the rung the ground was calibrated for and therefore the
 *                   rung its builder stood at. Deep ground holds the high books
 *                   because depth is what a big builder buys, which is already
 *                   `SCALE_BY_BAND`'s reasoning.
 *   who was in it   Ground a dead cultivator left holds what that cultivator
 *                   was carrying. Not a draw at all: the row already names the
 *                   occupant and says the contents are their inventory.
 *
 * No rate anywhere. How often a book comes out is how often ground is described
 * and how often somebody gets through a door, both of which the world already
 * decides for its own reasons.
 */

import { getTechnique } from '../../data/cultivation/techniques.js';
import type { RuinCharacter } from '../../data/cultivation/inheritance-trials.js';
import { theArtsWrittenDownIn, theRungThisWasSetFor } from './a-legacy-has-a-name-on-it-and-a-treasury-has-stock.js';
import {
    housesTeaching,
    manualCeilingOf,
    manualIdOf,
    shelfOf,
    shelfReach,
    significanceOfManual,
    suitsRoot,
    type Manual
} from './manuals.js';
import type { LocationRecord } from './locations.js';
import type { NpcRecord } from './npc-state.js';
import { howMuchAGradeIsWorthTracking, isRuined, makeObject, type ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';
import { takeTheArtOffThePage } from './what-a-manual-has-left-in-it.js';
import { meritWith } from './what-a-house-counts-in-somebodys-favour.js';
import { requiredContributionForRank } from '../cultivation/what-each-rung-of-a-house-ladder-requires.js';
import { turnItInToTheHouse, whatTheHouseMakesOf } from './what-a-house-gives-merit-for.js';
import { highestGradeRefinableAt } from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import { getPillsByGrade } from '../../data/cultivation/pills.js';
import { everyIngredientThatIs } from '../cultivation/what-a-cauldron-will-take.js';
import { whatOfThisAHouseKeeps } from './what-a-house-keeps-in-its-treasury.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT SORT OF PLACE KEPT BOOKS
// ─────────────────────────────────────────────────────────────────────────

/**
 * How many books each character of ground was keeping when it stopped.
 *
 * A column rather than a predicate, on the precedent `HAZARDS_BY_CHARACTER`
 * sets: a character added to `RuinCharacterSchema` does not compile until it
 * has said whether anybody shelved anything in it.
 *
 * Zero is the commonest answer and it is the interesting one. A battlefield
 * holds nothing because nobody built it. A scar holds nothing because what made
 * it did not leave paper. A cut is a working face and a physic garden is beds.
 */
export const WHAT_A_SHELF_HOLDS: Readonly<Record<RuinCharacter, number>> = {
    // What a house wrote down, kept in the room it kept it in.
    archive: 3,
    teaching_hall: 2,
    // Sealed on purpose, and what a house seals is what it will not copy.
    vault: 2,
    // A seat: the working library, minus whatever went out of the door.
    compound: 1,
    // One person's rooms and one person's road.
    dwelling: 1,
    // A refining floor keeps its own method to hand.
    workshop: 1,
    // Taken off the bodies, which is what `grave` provenance already says.
    ossuary: 1,
    battlefield: 0,
    scar: 0,
    waystation: 0,
    physic_garden: 0,
    array_anchor: 0,
    cut: 0,
    open_ground: 0
};

/**
 * What a piece of ground's own row says it is.
 *
 * Every pass that describes ground writes `ruinCharacter` and a
 * `ruin-character:` tag beside it. Null where the world has never said, and a
 * caller must read that as "nobody has described this" rather than as a
 * battlefield.
 */
export function characterOf(location: LocationRecord): RuinCharacter | null {
    const stated = location.data.ruinCharacter;
    if (typeof stated === 'string' && stated in WHAT_A_SHELF_HOLDS) {
        return stated as RuinCharacter;
    }
    const tagged = location.tags.find(t => t.startsWith('ruin-character:'))?.slice(15);
    return tagged !== undefined && tagged in WHAT_A_SHELF_HOLDS
        ? tagged as RuinCharacter
        : null;
}

/** Marks a book lying where it was left, which nobody has carried out yet. */
export const LEFT_IN_THE_GROUND = 'unrecovered';

// ─────────────────────────────────────────────────────────────────────────
// THE STOCK
// ─────────────────────────────────────────────────────────────────────────

function manualOf(id: string): Manual | null {
    const t = getTechnique(id);
    if (t === undefined || t.cap == null) return null;
    return {
        id: t.id,
        name: t.name,
        cap: Number(t.cap),
        requiredOrdinal: Number(t.requiredOrdinal ?? 0),
        element: t.element ?? null
    };
}

/**
 * The books that were on the shelves of this ground.
 *
 * The character says how many, and which of the catalog's two words for where a
 * copy survives applies. How high they reach is `theArtsWrittenDownIn` rather
 * than a second derivation of it - that reading already bounds by the rung the
 * ground was calibrated for and already drops the arts the record attests with
 * no surviving copy, and a second one here would have forgotten the second half
 * the first time either moved.
 */
export function whatWasOnTheShelvesOf(
    location: LocationRecord,
    character: RuinCharacter
): Manual[] {
    const room = WHAT_A_SHELF_HOLDS[character] ?? 0;
    if (room <= 0) return [];
    // An ossuary is a body rather than a shelf, and the catalog has its own
    // word for what comes off one.
    const provenance = character === 'ossuary' ? 'grave' : 'ruin';
    return theArtsWrittenDownIn(location, {
        provenance, howMany: room, onlyWhatStopsSomewhere: true
    })
        .map(manualOf)
        .filter((m): m is Manual => m !== null);
}

/**
 * The roads this person was carrying that nothing in the world teaches.
 *
 * WHAT WOULD OTHERWISE LEAVE THE WORLD, and the reason the filter is on
 * teaching rather than on provenance: the question here is not where the copy
 * came from, it is whether anybody else can produce another. A book six houses
 * teach is not lost when its holder dies.
 */
export function theRoadsThatWouldLeaveTheWorldWith(npc: NpcRecord): Manual[] {
    const out: Manual[] = [];
    for (const id of npc.cultivation.techniqueIds) {
        if (housesTeaching(id) > 0) continue;
        const m = manualOf(id);
        if (m) out.push(m);
    }
    return out.sort((a, b) => b.cap - a.cap || a.id.localeCompare(b.id));
}

// ─────────────────────────────────────────────────────────────────────────
// PUTTING IT IN THE GROUND
// ─────────────────────────────────────────────────────────────────────────

/** The stable id of one book lying in one piece of ground. */
export function bookInTheGroundId(locationId: string, techniqueId: string): string {
    return `left-${locationId}-${techniqueId}`;
}

function bookInTheGround(input: {
    location: LocationRecord;
    manual: Manual;
    description: string;
    onDay: number;
}): ObjectRecord {
    return makeObject({
        id: bookInTheGroundId(input.location.id, input.manual.id),
        name: input.manual.name,
        kind: 'manual',
        significance: significanceOfManual(input.manual.id, input.manual.cap),
        description: input.description,
        // NOBODY'S, AND NOWHERE BUT HERE. `possessorId` null is the field's own
        // meaning - "in the ground or lost" - and the location is the hole, so
        // whoever gets in is standing next to it and nobody else is. It is also
        // the triple `whatIsStandingFreeAt` looks for, which is what lets a
        // player pick one up through the ordinary taking verb.
        possessorId: null,
        ownerId: null,
        ownerName: '',
        locationId: input.location.id,
        tags: ['manual', LEFT_IN_THE_GROUND, `ruin:${input.location.id}`],
        data: {
            techniqueId: input.manual.id,
            cap: input.manual.cap,
            copies: 1,
            leftInTheGroundOnDay: input.onDay
        }
    });
}

/**
 * What a piece of described ground turns out to have on its shelves.
 *
 * Called at the moment the world first says what a place IS, because that is
 * when the world first knows what is in it. Nothing is created later: a hole
 * described as a battlefield is a battlefield for the life of the world and
 * never acquires a library.
 */
export function theBooksLeftIn(input: {
    location: LocationRecord;
    character: RuinCharacter;
    onDay: number;
}): ObjectRecord[] {
    return whatWasOnTheShelvesOf(input.location, input.character).map(manual => bookInTheGround({
        location: input.location,
        manual,
        description:
            `A copy of a cultivation manual carrying to ordinal ${manual.cap}, on the shelf `
            + 'it was left on. Nobody alive was taught this one.',
        onDay: input.onDay
    }));
}

/**
 * What a dead cultivator's own closed ground has in it, which is what they had.
 *
 * THE LOOP THE WORLD WAS MISSING. Measured before this existed: a canon sat in
 * one pair of hands from year 1000 to year 3000, its holder died below the rung
 * that would have let them copy it, and the road left the world for good. The
 * door they shut is already minted as a place with their name on it; this is
 * what is behind it.
 */
export function theBooksBehindTheirDoor(input: {
    location: LocationRecord;
    occupant: NpcRecord;
    onDay: number;
}): ObjectRecord[] {
    return theRoadsThatWouldLeaveTheWorldWith(input.occupant).map(manual => bookInTheGround({
        location: input.location,
        manual,
        description:
            `${input.occupant.name}'s own copy of a cultivation manual carrying to ordinal `
            + `${manual.cap}, where they left it. Nobody alive was taught this one.`,
        onDay: input.onDay
    }));
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT ELSE WAS LEFT, WHICH IS NOT PAPER
// ─────────────────────────────────────────────────────────────────────────

/** What else a place can have been keeping when it stopped. */
export type WhatElseWasKept =
    /** Doses, on a shelf or in a pouch. */
    | 'medicine'
    /** What grows, cut and dried. */
    | 'what_grows'
    /** What comes off a beast: hide, bone, a core. */
    | 'what_comes_off_a_beast';

/**
 * The design owner: *"you could find other stuff in a ruin."* The same column
 * as {@link WHAT_A_SHELF_HOLDS}, keyed on the same character, so a character
 * added to the schema has to say both. Only what an existing catalog can supply:
 * the herb and beast-material tables and the pill table. Weapons, stones and
 * ore have no catalog to draw from yet, so a battlefield does not leave blades
 * and a cut does not leave ore.
 */
export const WHAT_ELSE_THE_GROUND_HOLDS: Readonly<Record<RuinCharacter, readonly WhatElseWasKept[]>> = {
    archive: [],
    teaching_hall: [],
    // A house's store, sealed with it: goods rather than paper.
    vault: ['medicine', 'what_grows', 'what_comes_off_a_beast'],
    // The seat's own stores, what was left of them.
    compound: ['medicine'],
    // What one person had to hand.
    dwelling: ['medicine'],
    // A refining floor: what it made and what it made it out of.
    workshop: ['medicine', 'what_comes_off_a_beast'],
    // What was on the bodies.
    ossuary: ['medicine'],
    // What fell there: the beasts in it and what the dead carried.
    battlefield: ['what_comes_off_a_beast', 'medicine'],
    scar: [],
    waystation: ['medicine'],
    // Beds, run to seed.
    physic_garden: ['what_grows'],
    array_anchor: [],
    cut: [],
    open_ground: []
};

/** Marks goods lying where the place left them, so the party that gets in carries them out. */
export const LEFT_WITH_THE_PLACE = 'left-with-the-place';

/**
 * The goods a piece of described ground was left holding.
 *
 * AT THE HEIGHT ITS BUILDER COULD WORK AND NO HIGHER. The grade is the best the
 * ground's own rung could refine (`highestGradeRefinableAt` off
 * `theRungThisWasSetFor`), and which kinds of it is `whatOfThisAHouseKeeps` -
 * the same reading a living house's stores take, so a ruin is a store that
 * stopped. Nothing below the Lid makes an immortal thing and the refining gate
 * says so: no ruin down here holds one. One of each, once, and never restocked.
 */
export function theGoodsLeftIn(input: {
    location: LocationRecord;
    character: RuinCharacter;
    onDay: number;
}): ObjectRecord[] {
    const kinds = WHAT_ELSE_THE_GROUND_HOLDS[input.character] ?? [];
    if (kinds.length === 0) return [];
    const rung = theRungThisWasSetFor(input.location);
    const grade = highestGradeRefinableAt(rung);
    if (grade === null) return [];
    const out: ObjectRecord[] = [];
    const place = input.location.id;

    const lying = (row: {
        id: string; name: string; kind: 'material' | 'pill'; data: Record<string, string | number | boolean | null>;
        extraTags: string[];
    }): ObjectRecord => makeObject({
        id: `left-${place}-goods-${row.id}`,
        name: row.name,
        kind: row.kind,
        significance: howMuchAGradeIsWorthTracking(grade),
        description: `${row.name}, where it was left when the place stopped. Nobody has carried it out.`,
        possessorId: null,
        ownerId: null,
        ownerName: '',
        power: null,
        locationId: place,
        tags: [row.kind, ...row.extraTags, `grade:${grade}`, LEFT_WITH_THE_PLACE, `ruin:${place}`],
        data: { ...row.data, grade, quantity: 1, leftInTheGroundOnDay: input.onDay }
    });

    for (const kind of kinds) {
        if (kind === 'medicine') {
            const doses = getPillsByGrade(grade)
                .map(p => ({ id: p.id, name: p.name, grade, value: Number(p.value), harvestOrdinal: 0, from: 'a_growing_thing' as const }))
                .sort((a, b) => a.value - b.value || (a.id < b.id ? -1 : 1));
            for (const pill of whatOfThisAHouseKeeps(doses, grade, rung)) {
                out.push(lying({ id: pill.id, name: pill.name, kind: 'pill', data: { pillId: pill.id }, extraTags: [] }));
            }
            continue;
        }
        const from = kind === 'what_grows' ? 'a_growing_thing' : 'a_beast';
        for (const material of whatOfThisAHouseKeeps(
            everyIngredientThatIs({ grade, from, withinReachOf: rung }), grade, rung)) {
            out.push(lying({
                id: material.id,
                name: material.name,
                kind: 'material',
                data: { materialId: material.id, value: material.value },
                extraTags: ['material', from === 'a_beast' ? 'beast_material' : 'herb']
            }));
        }
    }
    return out;
}

/** Everything a piece of described ground was left holding: its books and its goods. */
export function whatWasLeftIn(input: {
    location: LocationRecord;
    character: RuinCharacter;
    onDay: number;
}): ObjectRecord[] {
    return [...theBooksLeftIn(input), ...theGoodsLeftIn(input)];
}

/** Goods lying in this piece of ground that nobody has carried out. */
export function goodsLyingIn(state: WorldState, locationId: string): ObjectRecord[] {
    return state.objects.filter(
        o => o.possessorId === null
            && o.locationId === locationId
            && o.tags.includes(LEFT_WITH_THE_PLACE)
            && !isRuined(o)
    );
}

/**
 * Shelve what this ground was holding, once.
 *
 * Idempotent on the object id, because the passes that describe ground run
 * every year over a persisted world and a shelf that doubled every time
 * anybody looked at it would be a book printer rather than a ruin.
 */
export function shelveWhatItWasHolding(
    state: WorldState,
    books: readonly ObjectRecord[]
): number {
    let shelved = 0;
    for (const book of books) {
        if (state.objects.some(o => o.id === book.id)) continue;
        state.objects.push(book);
        shelved++;
    }
    return shelved;
}

// ─────────────────────────────────────────────────────────────────────────
// AND CARRYING IT OUT
// ─────────────────────────────────────────────────────────────────────────

/** Books lying in this piece of ground that nobody has carried out. */
export function booksLyingIn(state: WorldState, locationId: string): ObjectRecord[] {
    return state.objects.filter(
        o => o.kind === 'manual'
            && o.possessorId === null
            && o.locationId === locationId
            && o.tags.includes(LEFT_IN_THE_GROUND)
            && !isRuined(o)
    );
}

/**
 * Which of them could open this, and it is the one who does.
 *
 * The two gates every other reader of a shelf keeps - the rung the book opens
 * at, and whether it fights the reader's own root - asked of the people who
 * were standing in the room. The strongest of them, because whoever went in
 * hands a find to the person it was fetched for.
 *
 * Null is an ordinary answer and a sharp one: a party of Core Formation
 * disciples carries out a book none of them can open, and it goes on the
 * house's shelf and waits for somebody who can.
 */
export function whoOfThemCouldOpenIt(
    readers: readonly NpcRecord[],
    manual: Manual
): NpcRecord | null {
    let best: NpcRecord | null = null;
    for (const reader of readers) {
        if (reader.status !== 'alive') continue;
        if (reader.cultivation.realmOrdinal < manual.requiredOrdinal) continue;
        if (!suitsRoot(reader.cultivation.spiritRoot, manual.element)) continue;
        if (reader.cultivation.techniqueIds.includes(manual.id)) continue;
        if (best === null || reader.cultivation.realmOrdinal > best.cultivation.realmOrdinal) {
            best = reader;
        }
    }
    return best;
}

/** One book that came out of a hole. */
export interface CameOutOfTheGround {
    objectId: string;
    techniqueId: string;
    name: string;
    cap: number;
    requiredOrdinal: number;
    locationId: string;
    /** Who holds the copy now: the house where it went to one, else whoever carried it. */
    holderId: string;
    holderName: string;
    /** Who read it on the way home, or null where nobody who went did. */
    readById: string | null;
    readByName: string;
    /** Who turned it in to their house for merit, or null. */
    turnedInById: string | null;
    /** The merit that earned them. Zero where nobody turned it in. */
    meritForIt: number;
}

/**
 * Whether reading this book carries somebody further than turning it in would.
 *
 * One comparison. The book carries them to its cap. The merit carries them to
 * the highest rung below the head it pays for on their own house's ladder
 * (`requiredContributionForRank`), and what that rung opens is the furthest book
 * on the house's shelf it reaches (`shelfReach`) that suits their root. Reading
 * wins only where the book goes further. Somebody off the house's roll, or with
 * nothing the house would credit, has no merit to weigh.
 */
export function readingCarriesThemFurther(
    state: WorldState,
    reader: NpcRecord,
    manual: Manual,
    houseId: string,
    merit: number
): boolean {
    const house = state.factions.find(f => f.id === houseId);
    if (reader.factionId !== houseId || house === undefined || merit <= 0) return true;
    const rankCount = house.ranks.length;
    const total = meritWith(reader, houseId) + merit;
    let buys = Math.max(0, reader.factionRankIndex);
    for (let rank = buys + 1; rank <= rankCount - 2; rank++) {
        if (requiredContributionForRank(rank) <= total) buys = rank;
    }
    const shelf = shelfOf(state, houseId);
    let opens = manualCeilingOf(reader);
    for (const m of shelf.slice(0, shelfReach(buys, rankCount, shelf.length))) {
        if (suitsRoot(reader.cultivation.spiritRoot, m.element)) opens = Math.max(opens, m.cap);
    }
    return manual.cap > opens;
}

/**
 * Whoever got in carries out what was on the shelf, and decides what to do with it.
 *
 * Ruled by the design owner: *"if you found it, you can read it, or you can
 * turn it into the sect for merit."* Per book:
 *
 *   read        the strongest of them who can open it, whom it carries past what
 *               they hold, and for whom it goes further than the merit would
 *               (`readingCarriesThemFurther`). A use comes off this row, one
 *               book each. What is left goes to the house for nothing where the
 *               house wants it - the default, because the read was the finder's
 *               share of an errand the house outfitted - and otherwise the
 *               reader keeps it.
 *   turn it in  nobody read it and the house wants it: the strongest of them on
 *               its roll hands it over whole and is credited for it
 *               (`turnItInToTheHouse`, which says what a house wants and what it
 *               is worth).
 *   keep it     otherwise, with whoever carried it. A rogue can only read or keep.
 *
 * A book the house takes goes on `shelfOf`, which is what puts it in front of
 * `newlyEntitled` for everybody who did not go.
 */
export function applyWhatThePartyCarriedOut(
    state: WorldState,
    input: {
        locationId: string;
        /** The house they went out for, or null for whoever went on their own. */
        house: { id: string; name: string; seatLocationId: string | null } | null;
        /** Who went, as world rows. Whoever can open a book is the one who did. */
        readers: readonly NpcRecord[];
        onDay: number;
    }
): CameOutOfTheGround[] {
    const found = booksLyingIn(state, input.locationId);
    const goods = goodsLyingIn(state, input.locationId);
    if (found.length === 0 && goods.length === 0) return [];
    const alive = input.readers
        .map(r => state.npcs.find(n => n.id === r.id) ?? r)
        .filter(r => r.status === 'alive');
    const strongest = (rows: readonly NpcRecord[]): NpcRecord | null => rows.reduce<NpcRecord | null>(
        (best, r) => best === null || r.cultivation.realmOrdinal > best.cultivation.realmOrdinal ? r : best, null);
    const carrier = strongest(alive);
    if (input.house === null && carrier === null) return [];
    const house = input.house;

    const out: CameOutOfTheGround[] = [];
    const readThisTrip = new Set<string>();
    for (const object of found) {
        const techniqueId = manualIdOf(object);
        if (techniqueId === null) continue;
        const manual = manualOf(techniqueId);
        if (manual === null) continue;
        const at = state.objects.findIndex(o => o.id === object.id);
        if (at < 0) continue;

        // A party nobody came back from leaves the house with what it found,
        // and nobody to have read it.
        if (house !== null && carrier === null) {
            state.objects[at] = carriedTo(object, input, house.id, house.name, house.seatLocationId, true);
            out.push(cameOut(object, manual, input.locationId, house.id, house.name));
            continue;
        }

        // Into the carrier's hands, which is where the choice is made. The
        // house's valuation is read before anybody reads it.
        state.objects[at] = carriedTo(object, input, carrier!.id, carrier!.name, carrier!.locationId, false);
        const merit = house === null ? 0 : whatTheHouseMakesOf(state, house.id, state.objects[at]!).merit;

        const couldRead = alive.filter(r => !readThisTrip.has(r.id) && manual.cap > manualCeilingOf(r));
        let reader = whoOfThemCouldOpenIt(
            house === null
                ? couldRead
                : couldRead.filter(r => readingCarriesThemFurther(state, r, manual, house.id, merit)),
            manual);
        // AND READING TAKES THE ART OFF THE PAGE, off this row. At heaven and
        // above that is a use, the same one a player spends, and the row keeps
        // what is left wherever it goes next. A book already read out teaches
        // nobody.
        const grade = getTechnique(manual.id)?.grade;
        if (reader !== null && grade !== undefined) {
            const taken = takeTheArtOffThePage(
                state.objects[at]!, { grade, byId: reader.id, onDay: input.onDay });
            if (taken.took) state.objects[at] = taken.object;
            else reader = null;
        }
        if (reader !== null) {
            const readerId = reader.id;
            readThisTrip.add(readerId);
            const row = state.npcs.findIndex(n => n.id === readerId);
            if (row >= 0) {
                state.npcs[row] = {
                    ...state.npcs[row]!,
                    cultivation: {
                        ...state.npcs[row]!.cultivation,
                        techniqueIds: [...state.npcs[row]!.cultivation.techniqueIds, manual.id]
                    },
                    updatedOnDay: input.onDay
                };
            }
        }

        let turnedInById: string | null = null;
        let meritForIt = 0;
        if (house !== null && !isRuined(state.objects[at]!)) {
            // Whoever of them is on the house's roll hands it in: the reader
            // where somebody read it, and otherwise the strongest of them.
            const giver = reader !== null && reader.factionId === house.id
                ? reader
                : strongest(alive.filter(r => r.factionId === house.id));
            if (giver !== null) {
                const holding = state.objects[at]!;
                state.objects[at] = { ...holding, possessorId: giver.id, ownerId: giver.id, ownerName: giver.name };
                meritForIt = turnItInToTheHouse(state, {
                    npcId: giver.id, objectId: object.id, onDay: input.onDay, forMerit: reader === null
                });
                if (state.objects[at]!.ownerId !== house.id) state.objects[at] = holding;
                if (reader === null && meritForIt > 0) turnedInById = giver.id;
            }
        }

        const now = state.objects[at]!;
        out.push({
            ...cameOut(object, manual, input.locationId, now.ownerId ?? carrier!.id, now.ownerName || carrier!.name),
            readById: reader?.id ?? null,
            readByName: reader?.name ?? '',
            turnedInById,
            meritForIt
        });
    }
    // AND THE GOODS, which nobody reads. The house takes what it wants and the
    // strongest of them on its roll is credited for it; whoever carried the
    // rest out keeps it. Nothing here sells anything.
    for (const object of goods) {
        const at = state.objects.findIndex(o => o.id === object.id);
        if (at < 0) continue;
        if (house !== null && carrier === null) {
            state.objects[at] = carriedTo(object, input, house.id, house.name, house.seatLocationId, false);
            continue;
        }
        if (carrier === null) continue;
        const giver = house === null ? null : strongest(alive.filter(r => r.factionId === house.id));
        const holder = giver ?? carrier;
        state.objects[at] = carriedTo(object, input, holder.id, holder.name, holder.locationId, false);
        if (giver !== null) turnItInToTheHouse(state, { npcId: giver.id, objectId: object.id, onDay: input.onDay });
    }
    return out;
}

/** The row, out of the ground and in somebody's hands. */
function carriedTo(
    object: ObjectRecord,
    input: { locationId: string; onDay: number },
    holderId: string,
    holderName: string,
    locationId: string | null,
    library: boolean
): ObjectRecord {
    return {
        ...object,
        possessorId: holderId,
        ownerId: holderId,
        ownerName: holderName,
        locationId,
        tags: [
            ...object.tags.filter(t => t !== LEFT_IN_THE_GROUND && t !== LEFT_WITH_THE_PLACE),
            ...(library ? ['library', `faction:${holderId}`] : [])
        ],
        data: {
            ...object.data,
            carriedOutOf: input.locationId,
            carriedOutOnDay: input.onDay
        }
    };
}

function cameOut(
    object: ObjectRecord,
    manual: Manual,
    locationId: string,
    holderId: string,
    holderName: string
): CameOutOfTheGround {
    return {
        objectId: object.id,
        techniqueId: manual.id,
        name: manual.name,
        cap: manual.cap,
        requiredOrdinal: manual.requiredOrdinal,
        locationId,
        holderId,
        holderName,
        readById: null,
        readByName: '',
        turnedInById: null,
        meritForIt: 0
    };
}
