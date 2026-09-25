/**
 * Books, and who has one.
 */

import type { NpcRecord } from './npc-state.js';
import type { FactionRecord, WorldState } from './world-state.js';
import { isRuined, makeObject, transferPossession, type ObjectRecord, type ObjectSignificance } from './possessions.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { conflictsWithRoot, getSpiritRoot } from '../cultivation/spirit-roots.js';
import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { getTechnique, stopsSomewhere, TECHNIQUES } from '../../data/cultivation/techniques.js';
import {
    ifCaughtAtSomethingTheHousePunishes,
    type IfCaught
} from '../social-leverage/what-a-house-does-when-it-catches-you.js';
import type { SectAlignment } from '../../schema/cultivation.js';
import { SECTS } from '../../data/cultivation/sects.js';
import type { SpiritRootKey } from '../../schema/cultivation.js';
import {
    takeTheArtOffThePage,
    theManualInThisHandFor,
    USES_A_MANUAL_OF_THIS_GRADE_HOLDS,
    whatIsLeftIn
} from './what-a-manual-has-left-in-it.js';
import { isTeachingSomebody } from './an-npc-striking-at-the-next-wall.js';
import { isAwayOnSomething } from './npc-state.js';
import { isInsideTheCompound } from './a-recruit-is-given-their-lamp-at-the-house.js';
import { makeFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';

/**
 * The working library of each house, by faction id.
 */
const TAUGHT: ReadonlyMap<string, readonly string[]> = new Map(
    (SECTS as readonly { id: string; teaches?: readonly string[] }[])
        .map(s => [s.id, s.teaches ?? []])
);

/**
 * What somebody with no house can plausibly have got hold of.
 *
 * The three filters below are the whole of it, and they were always the whole of
 * it: cheap grade, not out of a ruin or a grave, opens low. A fourth once sat in
 * front of them excluding anything that raised a rank, and it stopped meaning
 * anything when every art started raising one. Dropping it is what lets a
 * wanderer hold a stall primer, which is exactly what the wandering league in
 * the catalog is described as selling.
 */
const COMMON_ARTS: readonly { id: string; requiredOrdinal: number; element: string | null }[] =
    TECHNIQUES
        .filter(t => t.grade === 'mortal' || t.grade === 'earth')
        .filter(t => t.provenance !== 'ruin' && t.provenance !== 'grave')
        .filter(t => Number(t.requiredOrdinal ?? 0) <= 21)
        .map(t => ({
            id: t.id,
            requiredOrdinal: Number(t.requiredOrdinal ?? 0),
            element: t.element ?? null
        }));

/** A book the world can actually hand somebody, with the rung it stops at. */
export interface Manual {
    id: string;
    name: string;
    cap: number;
    /** The height you must already be to open it. The shelf is a sequence. */
    requiredOrdinal: number;
    element: string | null;
}

/**
 * A house's shelf, ascending.
 */
export function manualsOf(factionId: string): Manual[] {
    const out: Manual[] = [];
    for (const id of TAUGHT.get(factionId) ?? []) {
        const t = getTechnique(id);
        // Eight arts in the catalog state no rung they stop at, and a shelf is
        // a list of numbers. Those are not shelf stock.
        if (t === undefined || t.cap == null) continue;
        out.push({
            id: t.id, name: t.name, cap: Number(t.cap),
            requiredOrdinal: Number(t.requiredOrdinal ?? 0), element: t.element ?? null
        });
    }
    // Ascending, because rank reaches UP the shelf and the top of it is the
    // thing a house does not hand out.
    return out.sort((a, b) => a.cap - b.cap || a.id.localeCompare(b.id));
}

/**
 * The shelf a house ACTUALLY HAS, which is not the shelf the catalog gave it.
 */
export function shelfOf(state: WorldState, factionId: string): Manual[] {
    return shelvesOf(state).get(factionId) ?? manualsOf(factionId);
}

/**
 * One walk of the object table per world-day, rather than one per question.
 */
interface ShelfIndex {
    day: number;
    objects: number;
    byFaction: Map<string, Manual[]>;
}
const SHELVES = new WeakMap<WorldState, ShelfIndex>();

function shelvesOf(state: WorldState): Map<string, Manual[]> {
    const cached = SHELVES.get(state);
    if (cached && cached.day === state.currentDay && cached.objects === state.objects.length) {
        return cached.byFaction;
    }

    const held = new Map<string, Set<string>>();
    for (const object of state.objects) {
        // A book read to its end is dust. Its row stays, the way a dead
        // person's does, and it is no longer on anybody's shelf.
        if (object.kind !== 'manual' || object.possessorId === null || isRuined(object)) continue;
        const techniqueId = manualIdOf(object);
        if (techniqueId === null) continue;
        let ids = held.get(object.possessorId);
        if (!ids) { ids = new Set(); held.set(object.possessorId, ids); }
        ids.add(techniqueId);
    }

    const byFaction = new Map<string, Manual[]>();
    for (const faction of state.factions) {
        const out = manualsOf(faction.id);
        const seen = new Set(out.map(m => m.id));
        for (const techniqueId of held.get(faction.id) ?? []) {
            if (seen.has(techniqueId)) continue;
            const t = getTechnique(techniqueId);
            if (t === undefined || t.cap == null) continue;
            seen.add(t.id);
            out.push({
                id: t.id, name: t.name, cap: Number(t.cap),
                requiredOrdinal: Number(t.requiredOrdinal ?? 0), element: t.element ?? null
            });
        }
        byFaction.set(faction.id, out.sort((a, b) => a.cap - b.cap || a.id.localeCompare(b.id)));
    }

    SHELVES.set(state, { day: state.currentDay, objects: state.objects.length, byFaction });
    return byFaction;
}

// THE FOUR BANDS A SHELF FALLS INTO

/** The primer a house reproduces on a schedule and hands to everyone. */
export const INTAKE_PRIMER_CAP = 13;
/** The ordinary working road. Several copies; a house can spare one. */
export const WORKING_ROAD_CAP = 21;
/** The inner shelf. Two or three copies, and the house knows where each is. */
export const INNER_SHELF_CAP = 29;
/** What the elders actually cultivate. One or two. */
export const ELDERS_SHELF_CAP = 37;

/**
 * How many copies of a manual a house keeps.
 */
export function copiesOf(cap: number, rng: CultivationRNG): number {
    if (cap <= INTAKE_PRIMER_CAP) return rng.int(8, 20);
    if (cap <= WORKING_ROAD_CAP) return rng.int(3, 7);
    if (cap <= INNER_SHELF_CAP) return rng.int(2, 3);
    if (cap <= ELDERS_SHELF_CAP) return rng.int(1, 2);
    return 1;                               // the apex. One, and everyone knows where it is.
}

/**
 * How far somebody with no book gets on their own.
 */
export const BOOKLESS_CEILING = 6;

/**
 * The books you can simply buy.
 */
export const COMMON_MANUAL_CAP = 13;

/** How many houses in the world teach this manual. */
export function housesTeaching(techniqueId: string): number {
    let n = 0;
    for (const [, taught] of TAUGHT) if (taught.includes(techniqueId)) n++;
    return n;
}

/**
 * Taught in enough places that no house can call it theirs.
 */
export const COMMON_HOUSE_COUNT = 4;

/**
 * Counted or tracked, for a book.
 */
export function significanceOfManual(techniqueId: string, cap: number): ObjectSignificance {
    if (isCommonlyHeld(techniqueId)) return 'mundane';
    return cap >= INNER_SHELF_CAP ? 'significant' : 'notable';
}

/**
 * Ordinary market stock: cheap enough and numerous enough that a stall has one.
 */
export function isCommonlyHeld(techniqueId: string): boolean {
    const t = getTechnique(techniqueId);
    if (t === undefined || t.cap == null) return true;
    if (Number(t.cap) <= COMMON_MANUAL_CAP) return true;
    return housesTeaching(techniqueId) >= COMMON_HOUSE_COUNT;
}

/**
 * Whether this art is anybody's property at all.
 */
export function noHouseCanCallItTheirs(techniqueId: string): boolean {
    const houses = housesTeaching(techniqueId);
    return houses === 0 || houses >= COMMON_HOUSE_COUNT;
}

/** Manuals cheap and numerous enough to be ordinary market stock. */
export function commonManuals(): Manual[] {
    const seen = new Set<string>();
    const out: Manual[] = [];
    for (const [factionId] of TAUGHT) {
        for (const m of manualsOf(factionId)) {
            if (m.cap > COMMON_MANUAL_CAP || seen.has(m.id)) continue;
            seen.add(m.id);
            out.push(m);
        }
    }
    return out.sort((a, b) => b.cap - a.cap || a.id.localeCompare(b.id));
}

/**
 * What admission actually buys, which is not the same in every house.
 */
export type AdmissionOffer = 'reduced_form' | 'opening_stages' | 'a_teacher';

export function admissionOffer(factionId: string, seed: string): AdmissionOffer {
    const shelf = manualsOf(factionId);
    // A house with one book cannot hold most of it back, so it teaches you in
    // person and keeps the object. A deep shelf can afford to give a whole
    // early volume away.
    if (shelf.length <= 1) return 'a_teacher';
    const rng = forStream(seed, 'admission-terms', factionId);
    const roll = rng.next();
    if (roll < 0.4) return 'opening_stages';
    if (roll < 0.75) return 'reduced_form';
    return 'a_teacher';
}

/**
 * A house that has lost its favourite picks another.
 */
export function refreshChosen(state: WorldState): NpcRecord[] {
    const members = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const list = members.get(npc.factionId);
        if (list) list.push(npc); else members.set(npc.factionId, [npc]);
    }

    const named: NpcRecord[] = [];
    for (const [factionId, people] of members) {
        // The shelf the house holds, so a founded hall can favour somebody too.
        const shelf = shelfOf(state, factionId);
        if (shelf.length === 0) continue;
        const faction = state.factions.find(f => f.id === factionId);
        if (!faction || faction.dissolvedOnDay !== null) continue;

        const standing = people.filter(p => p.tags.includes('chosen')).length;
        const topCopies = copiesOf(
            shelf[shelf.length - 1].cap,
            forStream(state.seed, 'library', factionId)
        );
        const want = chosenCount(topCopies, people.length);
        if (standing >= want) continue;

        const rankCount = Math.max(1, faction.ranks.length);
        for (const pick of chooseTheChosen(people, rankCount, want - standing)) {
            if (pick.tags.includes('chosen')) continue;
            named.push(pick);
        }
    }
    return named;
}

/**
 * One art passed on, and what it cost somebody other than the student.
 */
export interface ALesson {
    techniqueId: string;
    /** The master whose time it took, or null when nobody's did. */
    teacherId: string | null;
    /** The house's copy a use came off, for a grade that runs out. Null otherwise. */
    book: ObjectRecord | null;
}

/**
 * Books somebody has become entitled to since they were last looked at, and
 * who it costs.
 *
 * AN ART IS CARRIED OVER A GAP ONLY BY SOMEBODY GIVING YOU ATTENTION. Carrying
 * somebody over a gap in a shelf used to cost nothing: anybody in the house
 * tall enough to OPEN the book counted as its teacher, from any distance, for
 * any number of people in a year. The teacher is now somebody standing where
 * the student stands, whose activity is `teaching` with the student in the set
 * (`who-is-given-attention-this-year.ts` decides who that is), and who has
 * taken the art to its end - `canReproduce`, the gate that lets them write a
 * copy out. It comes across at the copy pass's own odds, one in
 * `yearsToWriteOutACopy` a year, so a deep road takes years of attention and
 * a primer takes a season. The teacher's cost is the attention itself, charged
 * on their rate while it is given.
 *
 * `canTransmit` in `../encounters/acquisition.ts` is the encounter rule and is
 * looser: a teacher who went part of the way may transmit up to where they
 * stopped. The world's own pass holds the stricter line.
 *
 * A HEAVEN BOOK READ WITH NOBODY TEACHING IT SPENDS A USE. Opening a book you
 * are tall enough for still needs no teacher. At a grade that runs out
 * (`what-a-manual-has-left-in-it.ts`) that reading takes the art off a copy
 * the house holds, and a house with no copy left cannot do it. A lesson takes
 * nothing out of the book, so where both are open the master is preferred.
 */
export function newlyEntitled(
    state: WorldState,
    npc: NpcRecord,
    day: number = state.currentDay
): ALesson[] {
    const held = new Set(npc.cultivation.techniqueIds);
    const ordinal = npc.cultivation.realmOrdinal;

    if (npc.factionId) {
        const shelf = shelfOf(state, npc.factionId);
        if (shelf.length === 0) return [];
        // A house that teaches in person hands its newest people no object at
        // all. They are not stuck - they are dependent, which is a different
        // and more interesting problem, and it is the relationship layer's.
        if (npc.factionRankIndex <= 0 && admissionOffer(npc.factionId, state.seed) === 'a_teacher') {
            return [];
        }
        const faction = state.factions.find(f => f.id === npc.factionId);
        const rankCount = Math.max(1, faction?.ranks.length ?? 1);
        const reach = npc.tags.includes('chosen')
            ? shelf.length
            : shelfReach(npc.factionRankIndex, rankCount, shelf.length);

        // A SHELF IS NOT A STAIRCASE, AND SOMEBODY HAS TO CARRY YOU OVER THE GAP.
        const freeMaster = new Map<string, string>();
        for (const other of state.npcs) {
            if (other.id === npc.id || !isTeachingSomebody(other, day)) continue;
            if (!other.activity!.withIds.includes(npc.id)) continue;
            if (other.locationId === null || other.locationId !== npc.locationId) continue;
            for (const id of other.cultivation.techniqueIds) {
                if (!freeMaster.has(id) && canReproduce(other, id)) freeMaster.set(id, other.id);
            }
        }

        let lesson: ALesson | null = null;
        for (const m of shelf.slice(0, reach)) {
            if (held.has(m.id) || !suitsRoot(npc.cultivation.spiritRoot, m.element)) continue;
            const teacherId = freeMaster.get(m.id) ?? null;
            const grade = getTechnique(m.id)?.grade;
            const runsOut = grade !== undefined && USES_A_MANUAL_OF_THIS_GRADE_HOLDS[grade] !== null;
            if (teacherId !== null && (runsOut || m.requiredOrdinal > ordinal)) {
                lesson = { techniqueId: m.id, teacherId, book: null };
                continue;
            }
            if (m.requiredOrdinal > ordinal) continue;
            if (!runsOut) {
                lesson = { techniqueId: m.id, teacherId: null, book: null };
                continue;
            }
            const book = theManualInThisHandFor(state.objects, npc.factionId, m.id);
            if (book !== null && !whatIsLeftIn(book, grade!).isSpent) {
                lesson = { techniqueId: m.id, teacherId: null, book };
            }
        }
        return lesson === null ? [] : [lesson];
    }

    // Unbacked: only what a stall would have, and only if they have nothing
    // better already. Somebody already holding a book does not buy a primer.
    //
    // This was `manualCeilingOf(npc) > 0`, which read as "they hold a road at
    // all" back when a fighting art set no ceiling. Every art sets one now, so
    // that test would refuse every wanderer in the world a book forever. What it
    // was for survives as a comparison: buy what reaches past what you hold.
    const ceiling = manualCeilingOf(npc);
    // AND WHOEVER IS TEACHING THEM, house or no house. `rogues.ts`: what is
    // scarce outside a house is the teacher, not the permission, and nothing
    // stops somebody on no roll teaching whoever they like. The same gate a
    // house's master passes - standing where the student stands, attending to
    // them, and having taken the art to its end - and the same lesson odds, so a
    // wanderer's inheritor comes by an art the way a disciple does and not
    // faster. Only an art that carries them past what they hold.
    for (const other of state.npcs) {
        if (other.id === npc.id || !isTeachingSomebody(other, day)) continue;
        if (!other.activity!.withIds.includes(npc.id)) continue;
        if (other.locationId === null || other.locationId !== npc.locationId) continue;
        for (const id of other.cultivation.techniqueIds) {
            if (held.has(id) || !canReproduce(other, id)) continue;
            const art = getTechnique(id);
            if (!art || !suitsRoot(npc.cultivation.spiritRoot, art.element)) continue;
            if (art.cap == null || Number(art.cap) <= Math.max(ordinal, ceiling)) continue;
            return [{ techniqueId: id, teacherId: other.id, book: null }];
        }
    }
    const stock = commonManuals()
        .filter(m => m.cap > Math.max(ordinal, ceiling)
            && m.requiredOrdinal <= ordinal
            && suitsRoot(npc.cultivation.spiritRoot, m.element)
            && !held.has(m.id));
    return stock.length > 0 ? [{ techniqueId: stock[0].id, teacherId: null, book: null }] : [];
}

/**
 * Hand somebody the art they are entitled to this year and charge whoever it
 * cost: the master's time, or a use off the house's copy. False when there was
 * nothing to hand them.
 */
export function handOnWhatTheyAreEntitledTo(state: WorldState, at: number, day: number): boolean {
    const npc = state.npcs[at];
    if (npc === undefined || npc.status !== 'alive') return false;
    const [lesson] = newlyEntitled(state, npc, day);
    if (lesson === undefined) return false;

    if (lesson.book !== null) {
        const grade = getTechnique(lesson.techniqueId)?.grade;
        const where = state.objects.findIndex(o => o.id === lesson.book!.id);
        if (grade === undefined || where < 0) return false;
        const taken = takeTheArtOffThePage(state.objects[where], { grade, byId: npc.id, onDay: day });
        if (!taken.took) return false;
        state.objects[where] = taken.object;
        // A HOUSE GIVING A READ OF A BOOK THAT RUNS OUT IS A FACT, and the last
        // read most of all: "this house had a heaven book, and gave its last
        // reading to X". Stated once, and the narrator writes it.
        const house = state.factions.find(f => f.id === npc.factionId);
        appendWorldFact(state, makeFact({
            day,
            kind: 'inheritance',
            scale: 'personal',
            actors: [{ id: npc.id, name: npc.name, role: 'reader' }],
            locationId: npc.locationId,
            factionIds: house ? [house.id] : [],
            summary: taken.ruined
                ? `${house?.name ?? 'The house'} gave the last reading of ${lesson.book.name} to ${npc.name}, and the book went to dust.`
                : `${house?.name ?? 'The house'} gave a reading of ${lesson.book.name} to ${npc.name}.`,
            visibility: 'faction',
            magnitude: taken.ruined ? 0.5 : 0.3,
            data: {
                objectId: lesson.book.id,
                techniqueId: lesson.techniqueId,
                readsLeft: taken.after.left,
                wentToDust: taken.ruined
            }
        }));
    }
    if (lesson.teacherId !== null) {
        const span = yearsToWriteOutACopy(lesson.techniqueId) ?? YEARS_TO_COPY_A_PRIMER;
        if (!forStream(state.seed, 'a-lesson', npc.id, day).chance(Math.min(1, 1 / span))) return false;
    }
    state.npcs[at] = {
        ...npc,
        cultivation: {
            ...npc.cultivation,
            techniqueIds: [...npc.cultivation.techniqueIds, lesson.techniqueId]
        },
        updatedOnDay: day
    };
    return true;
}

/** The stable id of a house's holding of one manual, so re-seeding is idempotent. */
export function libraryObjectId(factionId: string, techniqueId: string): string {
    return `lib-${factionId}-${techniqueId}`;
}

/**
 * An id for a copy this house is writing out NOW, which must not be the id of
 * the copy that walked away.
 *
 * MEASURED: 23 objects in one seeded world advanced 500 years shared an id with
 * another object, and every one was a library manual. The library index is keyed
 * on `possessorId|techniqueId` and the id is keyed on the FACTION - so a manual
 * taken as a war spoil leaves the house's index while keeping the house's id in
 * its name, the house correctly reads that it has no copy, and writes out a
 * fresh one that collides with the one now sitting in the winner's hold.
 *
 * Two rows, one id. In memory both existed and whichever a reader found first
 * won; on save, `INSERT OR REPLACE` collapsed them and one silently ceased to
 * exist. The world reloaded 23 objects lighter than it was saved.
 *
 * The day is the discriminator because it is the fact that distinguishes them:
 * these are two different copies, written at different times, and the second one
 * exists precisely because the first is somewhere else.
 */
export function replacementCopyId(
    factionId: string,
    techniqueId: string,
    onDay: number
): string {
    return `${libraryObjectId(factionId, techniqueId)}-rewritten-${Math.floor(onDay)}`;
}

/** How many copies a holding carries. Absent or malformed counts as one. */
export function copyCount(object: ObjectRecord): number {
    const n = Number(object.data?.copies ?? 1);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/** The manual a holding is a copy of, or null when the row is not a manual. */
export function manualIdOf(object: ObjectRecord): string | null {
    if (object.kind !== 'manual') return null;
    const id = object.data?.techniqueId;
    return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Put every house's working library into the world as objects.
 */
export function seedSectLibraries(state: WorldState): ObjectRecord[] {
    const made: ObjectRecord[] = [];
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null) continue;
        const manuals = manualsOf(faction.id);
        // The Deeproot Court and the Empyrean Court still shelve nothing, and
        // both are `recruits: false` rather than empty libraries.
        if (manuals.length === 0) continue;

        const rng = forStream(state.seed, 'library', faction.id);
        for (const m of manuals) {
            made.push(makeObject({
                id: libraryObjectId(faction.id, m.id),
                name: m.name,
                kind: 'manual',
                // A book nobody owns is a count; a book somebody owns is a row.
                significance: significanceOfManual(m.id, m.cap),
                description: `The ${faction.name}'s copies of a cultivation manual carrying to ordinal ${m.cap}.`,
                possessorId: faction.id,
                ownerId: faction.id,
                ownerName: faction.name,
                locationId: faction.seatLocationId,
                tags: ['manual', 'library', `faction:${faction.id}`],
                data: { techniqueId: m.id, cap: m.cap, copies: copiesOf(m.cap, rng) }
            }));
        }
    }
    return made;
}

/**
 * The library a new house starts with: the copies its founders walked out with.
 *
 * ONLY BOOKS THAT EXIST. This minted a fresh row, at full uses, for every art
 * any founder held - mastered or not, and whether or not a copy of it was
 * anywhere in the world. At heaven and above that was a book the world did not
 * have. A book is a thing: what the founders carry out is the rows already in
 * their own hands, moved with whatever is left in them, and ownership does not
 * move with possession - a copy of the old house's walked out is still the old
 * house's. Everything else the new house has to write out, through
 * `applyManualCopying`, by somebody who has taken the art to its end.
 *
 * Returns how many books came with them.
 */
export function librariesCarriedOutBy(
    state: WorldState,
    faction: FactionRecord,
    carriers: readonly NpcRecord[],
    onDay: number
): number {
    const hands = new Set(carriers.map(c => c.id));
    let carried = 0;
    for (let i = 0; i < state.objects.length; i++) {
        const o = state.objects[i]!;
        if (o.kind !== 'manual' || o.possessorId === null || !hands.has(o.possessorId)) continue;
        if (isRuined(o) || manualIdOf(o) === null) continue;
        state.objects[i] = {
            ...transferPossession(o, {
                onDay,
                toHolderId: faction.id,
                toHolderName: faction.name,
                how: 'gifted',
                transfersOwnership: false,
                note: `Carried out to the ${faction.name} by the people who founded it.`
            }),
            locationId: faction.seatLocationId
        };
        carried++;
    }
    return carried;
}

/**
 * How far up its own shelf a member of this rank may reach.
 */
export function shelfReach(rankIndex: number, rankCount: number, shelf: number): number {
    if (shelf <= 0) return 0;
    if (rankIndex < 0) return 0;                       // unaffiliated: no shelf at all
    if (rankIndex >= rankCount - 1) return shelf;      // the top of the house reads the top of the shelf
    const share = (rankIndex + 1) / Math.max(1, rankCount);
    return Math.max(1, Math.min(shelf, Math.ceil(share * shelf)));
}

/**
 * Would this book fight the reader's own root?
 */
export function suitsRoot(rootKey: SpiritRootKey, element: string | null): boolean {
    if (!element) return true;
    try {
        return !conflictsWithRoot(getSpiritRoot(rootKey), element as never);
    } catch {
        return true;   // an element the root system does not model is not a conflict
    }
}

/**
 * One person per house whose books are not their rank's.
 */
export function chooseTheChosen(
    members: NpcRecord[],
    rankCount: number,
    howMany: number
): NpcRecord[] {
    if (howMany <= 0) return [];
    const eligible = members
        .filter(m => m.factionRankIndex >= 0 && m.factionRankIndex < rankCount - 2)
        .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
            || a.id.localeCompare(b.id));
    return eligible.slice(0, howMany);
}

/**
 * How many people a house has decided are worth its top shelf.
 */
export function chosenCount(topCopies: number, memberCount: number): number {
    // Being favoured is a DESIGNATION, not a book in your hands.
    const canGroom = topCopies + 1;
    return Math.max(1, Math.min(canGroom, Math.ceil(memberCount / 12)));
}

/**
 * How many arts somebody of this height has picked up.
 */
export function artsKnownAt(ordinal: number): number {
    if (ordinal <= 0) return 0;
    return Math.min(6, 1 + Math.floor(ordinal / 7));
}

/**
 * The road somebody standing this high must have been practising.
 */
export function roadThatCarriedThemHere(npc: NpcRecord): Manual | null {
    const ordinal = npc.cultivation.realmOrdinal;
    const held = new Set(npc.cultivation.techniqueIds);
    const open = TECHNIQUES
        .filter(t => stopsSomewhere(t))
        .filter(t => Number(t.cap) >= ordinal)
        .filter(t => Number(t.requiredOrdinal ?? 0) <= ordinal)
        .filter(t => suitsRoot(npc.cultivation.spiritRoot, t.element ?? null))
        .filter(t => !held.has(t.id))
        .filter(t => noHouseCanCallItTheirs(t.id))
        .sort((a, b) => Number(a.cap) - Number(b.cap) || a.id.localeCompare(b.id));
    if (open.length === 0) return null;
    const t = open[0];
    return {
        id: t.id,
        name: t.name,
        cap: Number(t.cap),
        requiredOrdinal: Number(t.requiredOrdinal ?? 0),
        element: t.element ?? null
    };
}

export interface BookGrant {
    npcId: string;
    /** The road: at most one, and the thing that sets their ceiling. */
    techniqueIds: string[];
    /** What they can actually do, which is not the same question. */
    artIds: string[];
    chosen: boolean;
}

/**
 * Hand out the books.
 */
export function grantBooksToMembers(state: WorldState): BookGrant[] {
    const byFaction = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
        const list = byFaction.get(npc.factionId);
        if (list) list.push(npc); else byFaction.set(npc.factionId, [npc]);
    }

    const grants: BookGrant[] = [];
    for (const [factionId, members] of byFaction) {
        const shelf = manualsOf(factionId);
        if (shelf.length === 0) continue;
        const faction = state.factions.find(f => f.id === factionId);
        const rankCount = Math.max(1, faction?.ranks.length ?? 1);
        const topCopies = shelf.length > 0
            ? copiesOf(shelf[shelf.length - 1].cap, forStream(state.seed, 'library', factionId))
            : 0;
        const chosen = new Set(
            chooseTheChosen(members, rankCount, chosenCount(topCopies, members.length)).map(m => m.id)
        );

        for (const npc of members) {
            const isChosen = chosen.has(npc.id);
            const reach = isChosen ? shelf.length : shelfReach(npc.factionRankIndex, rankCount, shelf.length);
            const root = npc.cultivation.spiritRoot;
            // Two gates, not one. Rank says what the house will GIVE you; the
            // manual's own `requiredOrdinal` says what you can OPEN, and being
            // favoured does not lift it. A house's top book commonly wants a
            // height its chosen has not reached yet, so being chosen means
            // being handed the thing you will grow into - and holding a book
            // you cannot yet read is an ordinary and rather sharp situation.
            const within = shelf
                .slice(0, reach)
                .filter(m => m.requiredOrdinal <= npc.cultivation.realmOrdinal && suitsRoot(root, m.element));
            // Falling back down the whole shelf rather than only within reach:
            // an elementless primer is what a house gives somebody it cannot
            // otherwise teach, and it is below everybody's reach by definition.
            const fromShelf = within.length > 0
                ? [within[within.length - 1]]
                : shelf.filter(m => m.element === null
                    && m.requiredOrdinal <= npc.cultivation.realmOrdinal).slice(0, 1);
            // NOBODY STANDS ABOVE THEIR OWN BOOK.
            const books = fromShelf.length > 0
                && fromShelf[0].cap >= npc.cultivation.realmOrdinal
                ? fromShelf
                : [roadThatCarriedThemHere(npc) ?? fromShelf[0]].filter((m): m is Manual => m != null);

            // More than one book, because a hundred years in a house that
            // teaches does not leave somebody knowing nothing. Taken from the
            // top down so a senior is not carrying the beginner's list.
            //
            // ONE SHELF, NOT TWO. This drew from a second list - everything the
            // house taught that did not raise a rank - and that list stopped
            // existing when every art started raising one. Drawing the rest
            // from `within` instead keeps BOTH gates on every book a member
            // holds: the house still rations by rank, which a second unrationed
            // list was quietly not doing.
            const open = within.filter(m => !books.some(b => b.id === m.id));
            const artIds = open
                .slice(Math.max(0, open.length - artsKnownAt(npc.cultivation.realmOrdinal)))
                .map(a => a.id);

            if (books.length === 0 && artIds.length === 0) continue;
            grants.push({
                npcId: npc.id,
                techniqueIds: books.map(b => b.id),
                artIds,
                chosen: isChosen
            });
        }
    }

    // The unbacked climbed too, and they did not do it knowing nothing. What they
    // have is whatever a person with no house can get hold of - the cheap,
    // portable, widely-copied end of the world's shelf, which is exactly what the
    // wandering league in the catalog is described as selling - so they are drawn
    // from the common pool rather than from anybody's library.
    //
    // This used to read "they get no road at all", and the ceiling that went with
    // it was zero. That is no longer the shape of the thing: every art carries
    // somebody, so a wanderer's ceiling is whatever the cheapest end of the world
    // reaches. It is LOW rather than absent, and it is low by the pool's own three
    // filters rather than by a rule about who they are - which is the better
    // version of the same fact. `escapes.ts` is still most of their career.
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId) continue;
        const want = artsKnownAt(npc.cultivation.realmOrdinal);
        if (want === 0) continue;
        const pool = COMMON_ARTS
            .filter(a => a.requiredOrdinal <= npc.cultivation.realmOrdinal
                && suitsRoot(npc.cultivation.spiritRoot, a.element));
        if (pool.length === 0) continue;
        const rng = forStream(state.seed, 'unbacked-arts', npc.id);
        const picked = new Set<string>();
        for (let i = 0; i < want * 2 && picked.size < Math.min(want, pool.length); i++) {
            picked.add(pool[rng.int(0, pool.length - 1)].id);
        }
        grants.push({ npcId: npc.id, techniqueIds: [], artIds: [...picked], chosen: false });
    }

    return grants;
}

/**
 * Copying is a living. Copying somebody else's book is a betrayal.
 */
export function betrayalOfSelling(
    /**
     * Narrowed to the one field this reads, so the player can be priced on the same
     * scale as an NPC without a `Cultivator` being dressed up as an `NpcRecord` to
     * get here. A whole `NpcRecord` still satisfies it.
     */
    npc: Pick<NpcRecord, 'factionId'>,
    techniqueId: string,
    ownerFactionId: string | null
): 0 | 1 | 2 | 3 {
    // Nobody's property, so selling copies is a trade rather than a betrayal.
    // {@link noHouseCanCallItTheirs} and NOT `isCommonlyHeld`: whether a stall
    // stocks a thing and whether anybody owns it are different questions, and
    // asking the market one here priced every signature art in the world at
    // zero. See the note on `isCommonlyHeld`.
    if (noHouseCanCallItTheirs(techniqueId)) return 0;
    if (!ownerFactionId) return 1;
    const shelf = manualsOf(ownerFactionId);
    const isTop = shelf.length > 0 && shelf[shelf.length - 1].id === techniqueId;
    if (isTop) return 3;
    return npc.factionId === ownerFactionId ? 2 : 1;
}

/**
 * Which house's art this is, if anybody's.
 */
export function whoseArt(techniqueId: string): string[] {
    const owners: string[] = [];
    for (const [factionId, taught] of TAUGHT) {
        if (taught.includes(techniqueId)) owners.push(factionId);
    }
    return owners;
}

/**
 * Practising somebody's art while not being one of theirs.
 */
export function unauthorisedPractice(
    /**
     * Narrowed to the one field this reads, on `betrayalOfSelling`'s own
     * precedent and for its reason: the player is not an `NpcRecord` and the
     * question is about them too. A whole `NpcRecord` still satisfies it.
     */
    npc: Pick<NpcRecord, 'factionId'>,
    techniqueId: string
): string[] | null {
    // Nobody's art is nobody's business - and "nobody's" is how widely it is
    // held, not how high it carries and not whether a stall stocks it.
    if (noHouseCanCallItTheirs(techniqueId)) return null;
    const owners = whoseArt(techniqueId).filter(id => id !== npc.factionId);
    if (owners.length === 0) return null;
    // Somebody carrying the tag of a house that teaches it has an answer ready.
    return owners;
}

/**
 * What happens when they catch you practising it.
 */
/**
 * Retained here because this is where every caller imports it from, and moved
 * because the switch behind it turned out not to be about manuals at all.
 */
export type { IfCaught };

/**
 * What a house does about somebody practising an art off its shelf.
 */
export function ifCaughtPractising(
    techniqueId: string,
    ownerFactionId: string | null
): IfCaught {
    // The property question, not the market one. See `isCommonlyHeld`.
    const theirs = !noHouseCanCallItTheirs(techniqueId) && Boolean(ownerFactionId);
    const owner = ownerFactionId
        ? (SECTS as readonly { id: string; alignment?: string }[])
            .find(s => s.id === ownerFactionId)
        : undefined;
    return ifCaughtAtSomethingTheHousePunishes({
        theirsToPunish: theirs,
        // A house the catalog does not carry is not a house that punishes, and
        // an alignment it does not declare reads as the ordinary case, exactly
        // as the `default` arm did before this moved.
        alignment: theirs
            ? ((owner?.alignment as SectAlignment | undefined) ?? 'neutral')
            : null
    });
}

/**
 * How far the books somebody holds will carry them.
 */
export function manualCeilingOf(npc: NpcRecord): number {
    let cap = 0;
    for (const id of npc.cultivation.techniqueIds) {
        const t = getTechnique(id);
        if (t === undefined || t.cap == null) continue;
        cap = Math.max(cap, Number(t.cap));
    }
    return cap;
}

/**
 * How high somebody can actually be carried, book or no book.
 */
/**
 * Who in a house can actually teach each book on its shelf, once per day.
 */
interface TeachableIndex {
    day: number;
    npcs: number;
    byFaction: Map<string, Set<string>>;
}
const TEACHABLE = new WeakMap<WorldState, TeachableIndex>();

function teachableIn(state: WorldState, factionId: string, shelf: Manual[]): Set<string> {
    let index = TEACHABLE.get(state);
    if (!index || index.day !== state.currentDay || index.npcs !== state.npcs.length) {
        index = { day: state.currentDay, npcs: state.npcs.length, byFaction: new Map() };
        TEACHABLE.set(state, index);
    }
    const cached = index.byFaction.get(factionId);
    if (cached) return cached;

    const required = new Map(shelf.map(m => [m.id, m.requiredOrdinal]));
    const teachable = new Set<string>();
    for (const other of state.npcs) {
        if (other.status !== 'alive' || other.factionId !== factionId) continue;
        for (const id of other.cultivation.techniqueIds) {
            if (required.has(id) && canReproduce(other, id)) teachable.add(id);
        }
    }
    index.byFaction.set(factionId, teachable);
    return teachable;
}

export function reachableCeilingFor(state: WorldState, npc: NpcRecord): number {
    const held = manualCeilingOf(npc);
    if (held > 0) return held;
    if (!npc.factionId) return 0;
    if (admissionOffer(npc.factionId, state.seed) !== 'a_teacher') return 0;

    const shelf = shelfOf(state, npc.factionId);
    if (shelf.length === 0) return 0;
    const faction = state.factions.find(f => f.id === npc.factionId);
    const rankCount = Math.max(1, faction?.ranks.length ?? 1);
    const reach = npc.tags.includes('chosen')
        ? shelf.length
        : shelfReach(npc.factionRankIndex, rankCount, shelf.length);

    // Somebody has to be able to teach it. A house that lost its last master of
    // a book cannot pass it on however senior the student is - the same rule
    // `newlyEntitled` uses to carry people over a gap in a shelf.
    const teachable = teachableIn(state, npc.factionId, shelf);

    let best = 0;
    for (const m of shelf.slice(0, reach)) {
        if (!suitsRoot(npc.cultivation.spiritRoot, m.element)) continue;
        if (m.requiredOrdinal > npc.cultivation.realmOrdinal && !teachable.has(m.id)) continue;
        best = Math.max(best, m.cap);
    }
    return best;
}

/**
 * The rare thing that happens to somebody standing at the end of their shelf.
 */
const FOUND_A_ROAD_AT_FOUNDATION = 1 / 900;

export function mightFindARoad(
    npc: NpcRecord,
    ceiling: number,
    rng: CultivationRNG
): boolean {
    if (npc.cultivation.realmOrdinal < ceiling) return false;
    if (ceiling < 13) return false;
    const realmsUp = Math.max(0, Math.floor((ceiling - 13) / 4));
    const backing = npc.factionId ? 1 : 0.35;
    return rng.next() < FOUND_A_ROAD_AT_FOUNDATION * backing / Math.pow(2, realmsUp);
}

/**
 * What they found. The nearest road in the world that would actually help.
 */
export function roadTheyFound(npc: NpcRecord, ceiling: number, rng: CultivationRNG): string | null {
    const held = new Set(npc.cultivation.techniqueIds);
    const open = TECHNIQUES
        .filter(t => stopsSomewhere(t))
        .filter(t => Number(t.cap) > ceiling)
        .filter(t => Number(t.requiredOrdinal ?? 0) <= npc.cultivation.realmOrdinal)
        .filter(t => suitsRoot(npc.cultivation.spiritRoot, t.element ?? null))
        .filter(t => !held.has(t.id))
        .sort((a, b) => Number(a.cap) - Number(b.cap));
    if (open.length === 0) return null;
    return open[Math.min(open.length - 1, rng.int(0, 1))].id;
}


/**
 * Full mastery, on the engine's own 0..1 scale.
 */
export const FULLY_MASTERED = 1;

/**
 * Could this particular person write out a copy of this particular thing?
 */
export interface HolderOfAnArt {
    realmOrdinal: number;
    /**
     * Their own mastery of this one thing, 0..1, where the caller holds a row
     * that says. Null or absent for a record that carries no such column -
     * every `NpcRecord` in the world - and then the ordinal answers instead.
     */
    masteryOfIt?: number | null;
}

/**
 * The rung at which somebody counts as having mastered an art, for a record
 * that carries no mastery figure.
 *
 * The fallback is what the whole catalog outside the cultivation category used
 * to take, and it was never a second rule: `cap` is `realmEnd + 1` and the realm
 * tiers are contiguous, so "the start of the next tier up" and "the cap" name
 * the same rung. Collapsing the two kinds of art made that visible. What is
 * left below the first branch is the eight rows that stop nowhere, and there
 * the fallback clamps at the top tier - which is the right answer, because
 * nobody who cannot already stand there can open one.
 */
export function masteryBarFor(techniqueId: string): number | null {
    const t = getTechnique(techniqueId);
    if (!t) return null;
    if (t.cap != null) return Number(t.cap);
    const opens = Number(t.requiredOrdinal ?? 0);
    const at = REALM_TIERS.findIndex(tier => tier.key === realmForOrdinal(opens).key);
    if (at < 0) return null;
    return REALM_TIERS[Math.min(at + 1, REALM_TIERS.length - 1)].ordinalStart;
}

/**
 * A COPY IS NOT A TRANSCRIPTION, AND THE GATE IS COMPREHENSION.
 *
 * Ruled by the design owner: *"someone who doesn't understand it, even when
 * copying the words, there is no dao, so no manual."* Somebody who writes out
 * every character of a road they have not walked has produced paper. There is
 * no failed-copy object in this engine and there should not be one - what the
 * rule implies, and all it implies, is that such a person cannot produce a
 * copy at all.
 *
 * A clause in front of the bar returned true for anything a stall carries, on
 * the reasoning that what makes a copy hard to come by is scarcity rather than
 * penmanship. That is the transcription view, and it is the one the ruling
 * refuses. MEASURED on the shipped catalog: 35 of 149 capped manuals could be
 * written out by somebody standing at ordinal 0, the deepest of them capping at
 * 33 and opening at 30 - a rung its writer could not have opened the book at,
 * let alone finished it from.
 *
 * Market stock does not move with it, which was that clause's real concern.
 * What a stall carries is `isSoldAtAStall` and the price is
 * `stallPriceCash`; neither asks this. All that changes is WHO can produce the
 * copy, and a primer's bar is 13 - the town's copyists are people who finished
 * the primer, which is who they should have been.
 */
export function couldWriteOutACopy(holder: HolderOfAnArt, techniqueId: string): boolean {
    // Null for an art no catalog carries, which answers the missing-row case too.
    const bar = masteryBarFor(techniqueId);
    if (bar === null) return false;
    // `HolderOfAnArt.masteryOfIt`: the figure where the caller holds a row that
    // says, and the ordinal INSTEAD where it does not.
    if (holder.masteryOfIt != null) return holder.masteryOfIt >= FULLY_MASTERED;
    return holder.realmOrdinal >= bar;
}

/**
 * Can this person in the world write out another copy of a ROAD?
 */
export function canReproduce(npc: NpcRecord, techniqueId: string): boolean {
    if (!npc.cultivation.techniqueIds.includes(techniqueId)) return false;
    if (!stopsSomewhere(getTechnique(techniqueId))) return false;
    return couldWriteOutACopy({ realmOrdinal: npc.cultivation.realmOrdinal }, techniqueId);
}

// A MASTER WRITES IT OUT FOR THEIR STUDENTS

/**
 * What a copy costs the one person who can make it, in years of their life.
 *
 * Authored rather than invented. `HIGH_REALM_PROVENANCE` has the Earth Vein
 * Tower's Assessor of the Deep costing a second copy of the house's only road -
 * `arterial-sounding-canon`, which caps at the deepest rung any book in the
 * catalog reaches - at *"somewhat over nine years of his own hours, during
 * which the road would be unavailable"*. He costed it twice and declined twice,
 * which is a house too thin to spare its teacher and NOT a claim about who may
 * copy what.
 *
 * NOT `monthsToCopy`, and the two must not be merged. That one prices a
 * copyist's LABOUR - what a stall charges for the paper, at a wage - and it is
 * flat because the paper is flat. This one is the work of putting down what you
 * understood, and it is the whole difference between a primer and a canon. They
 * agree at the bottom of the ladder on purpose: a book a stall carries is two
 * months either way.
 */
export const YEARS_TO_COPY_THE_DEEPEST_ROAD = 9;

/**
 * The floor: a book that asks nothing of its writer beyond having finished it.
 * Two months, which is what `monthsToCopy` charges for the same book.
 */
export const YEARS_TO_COPY_A_PRIMER = 1 / 6;

/** The deepest rung any book in the catalog reaches, so the anchor cannot drift. */
const DEEPEST_ROAD_CAP = TECHNIQUES.reduce(
    (top, t) => (t.cap == null ? top : Math.max(top, Number(t.cap))),
    COMMON_MANUAL_CAP
);

/**
 * How long this book takes the one person who can write it out.
 *
 * Linear in how far the road reaches past what a stall carries, anchored at the
 * two ends the world already states: two months for a primer, nine years for
 * the deepest road in the catalog. An inner-shelf road lands near four and a
 * half years and an elders' road near seven, which is the shape the shelf bands
 * already imply - `copiesOf` gives a house one apex copy and a dozen primers
 * for the same reason.
 *
 * ONE OF THE TWO LEVERS on how fast an upper art spreads: a lesson and a copy
 * both take this span. See `how-far-up-the-world-reaches.md` before tuning it.
 */
export function yearsToWriteOutACopy(techniqueId: string): number | null {
    const bar = masteryBarFor(techniqueId);
    if (bar === null) return null;
    const t = getTechnique(techniqueId);
    const cap = t?.cap == null ? bar : Number(t.cap);
    const reach = (cap - COMMON_MANUAL_CAP) / Math.max(1, DEEPEST_ROAD_CAP - COMMON_MANUAL_CAP);
    return Math.max(
        YEARS_TO_COPY_A_PRIMER,
        YEARS_TO_COPY_THE_DEEPEST_ROAD * Math.min(1, reach)
    );
}

/**
 * How much longer a house waits for a spare than for a book it has none of.
 *
 * The urgency is different and the work is not: it is the same book and the
 * same hand. Was two absolute figures - 60 years for the first copy and 250 for
 * a spare - which made a village primer and an apex canon cost the same decade
 * and told nobody why either number was that number.
 */
export const A_SPARE_IS_PUT_OFF_THIS_MUCH = 4;

/**
 * Past this many copies a house is not short of a book, it is hoarding paper.
 */
export const MOST_COPIES_WORTH_KEEPING = 20;

export interface WrittenCopy {
    masterId: string;
    masterName: string;
    factionId: string;
    techniqueId: string;
    /** True when the house held no copy of this at all until now. */
    firstInTheHouse: boolean;
    /** Copies the house holds after this one. */
    copies: number;
}

/** Writing out a copy for the house is the work of a master's rung. */
const WRITING_OUT_A_COPY = 'the_work_of_their_rank' as const;

const DAYS_IN_A_YEAR = 365;

/**
 * Every copy written out this year, and the library rows they land in.
 */
export function applyManualCopying(
    state: WorldState,
    year: number,
    day: number
): WrittenCopy[] {
    // ── The library, indexed once. ──
    const holdingAt = new Map<string, number>();
    const placeById = new Map(state.locations.map(l => [l.id, l] as const));
    for (let i = 0; i < state.objects.length; i++) {
        const o = state.objects[i];
        // Never onto a row that is dust: that would put pages back into a book
        // that stopped existing. A fresh copy is a fresh row.
        if (o.kind !== 'manual' || o.possessorId === null || isRuined(o)) continue;
        const techniqueId = manualIdOf(o);
        if (techniqueId === null) continue;
        holdingAt.set(`${o.possessorId}|${techniqueId}`, i);
    }

    // ── Who is in each house, so "how many people are waiting for this" is a
    // lookup rather than a scan. ──
    const members = new Map<string, NpcRecord[]>();
    const npcAt = new Map<string, number>();
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (npc.status !== 'alive' || !npc.factionId) continue;
        npcAt.set(npc.id, i);
        const list = members.get(npc.factionId);
        if (list) list.push(npc); else members.set(npc.factionId, [npc]);
    }

    const written: WrittenCopy[] = [];
    for (const faction of state.factions) {
        if (faction.dissolvedOnDay !== null) continue;
        const people = members.get(faction.id);
        if (!people) continue;

        // How many people in this house could be taught each art and are not
        // holding it, counted ONCE per art rather than once per master of it. Two
        // masters of the same book in one hall would otherwise each walk the whole
        // membership, which is quadratic in a house's size for as long as the world
        // runs. The writer is never in the count: they hold the book, which is what
        // `canReproduce` required of them, so the same number is correct for every
        // master of it and one walk answers all of them.
        const waitingFor = new Map<string, number>();
        const shortageOf = (techniqueId: string): number => {
            const cached = waitingFor.get(techniqueId);
            if (cached !== undefined) return cached;
            const element = manualElementOf(techniqueId);
            let waiting = 0;
            for (const p of people) {
                if (p.cultivation.techniqueIds.includes(techniqueId)) continue;
                if (!suitsRoot(p.cultivation.spiritRoot, element)) continue;
                waiting++;
            }
            waitingFor.set(techniqueId, waiting);
            return waiting;
        };

        for (const master of people) {
            // ONE MASTER, ONE DESK. The span below is years of this person's
            // life, so a master holding six roads cannot be at six of them: the
            // arts they could write out are gathered, the one the house is
            // shortest of is the one they sit down to, and everything else
            // waits. This loop used to roll once per art, which handed a
            // six-art elder six independent chances a year and made the span a
            // decoration - the years were charged to nobody and nothing was
            // given up to spend them.
            let sitting: { techniqueId: string; at: number | undefined; have: number } | null = null;
            const mi = npcAt.get(master.id)!;
            const doing = master.activity;

            // ── A COPY ALREADY ON THE DESK ───────────────────────────────
            //
            // Work that is under way is on their activity, naming the art and
            // the day it will be done, so they can be seen and asked about as
            // busy with it. Until that day they are at it; on it, the copy lands
            // as the book it was, whatever the shelf now wants.
            if (doing !== null && doing.kind === WRITING_OUT_A_COPY
                && typeof doing.thingId === 'string' && doing.untilDay !== null && doing.untilDay !== undefined) {
                if (doing.untilDay > day) continue;
                state.npcs[mi] = { ...state.npcs[mi]!, activity: null };
                if (!canReproduce(master, doing.thingId)) continue;
                const at = holdingAt.get(`${faction.id}|${doing.thingId}`);
                sitting = { techniqueId: doing.thingId, at, have: at === undefined ? 0 : copyCount(state.objects[at]) };
            }

            // Somebody away is not at a desk this year. Nothing is started for
            // them. Anything else they are at stops for the desk, as it always
            // did: the yearly roll this replaced was taken whatever they were at.
            //
            // AND THE DESK IS AT HOME. A copy for the house's shelf is written in
            // the house: somebody standing anywhere else sits down to nothing.
            // Found on `town-a` once every world stood on the written ages: a
            // Frostmirror elder back from board work started a twenty-six-year
            // copy at the Orchid Court's ground and never went home.
            const atTheDesk = faction.seatLocationId === null
                || isInsideTheCompound(placeById, master.locationId, faction.seatLocationId);
            const free = (doing === null || !isAwayOnSomething(doing.kind)) && atTheDesk;
            let worst = -1;
            for (const techniqueId of sitting === null && free ? master.cultivation.techniqueIds : []) {
                if (!canReproduce(master, techniqueId)) continue;
                const at = holdingAt.get(`${faction.id}|${techniqueId}`);
                const have = at === undefined ? 0 : copyCount(state.objects[at]);

                // A shortage is a fact about the house, not a target: how many
                // people could be taught this and are not holding it. No
                // shortage and a copy already on the shelf, no copy written - a
                // master does not spend a decade on a book nobody is waiting
                // for.
                const waiting = shortageOf(techniqueId);
                if (have > 0 && (waiting === 0 || have >= Math.min(waiting, MOST_COPIES_WORTH_KEEPING))) {
                    continue;
                }
                // A book the house has none of comes first however few are
                // waiting: one copy is the difference between a road the house
                // holds and a road it does not.
                const need = (have === 0 ? MOST_COPIES_WORTH_KEEPING : 0) + waiting;
                if (sitting === null || need > worst
                    || (need === worst && techniqueId.localeCompare(sitting.techniqueId) < 0)) {
                    worst = need;
                    sitting = { techniqueId, at, have };
                }
            }
            if (sitting === null) continue;
            const finishing = doing !== null && doing.kind === WRITING_OUT_A_COPY
                && doing.thingId === sitting.techniqueId;

            // The one book they are at.
            {
                const { techniqueId, at, have } = sitting;
                const key = `${faction.id}|${techniqueId}`;
                const holding = at === undefined ? null : state.objects[at];

                if (!finishing) {
                    const span = yearsToWriteOutACopy(techniqueId);
                    if (span === null) continue;
                    // HOW MANY YEARS IT TAKES, DRAWN ONCE AT THE DESK. The same
                    // odds the yearly roll always had - one in `years` of being
                    // done in any year - so a copy takes as long as it did, and
                    // the difference is that the day it will be done is a fact
                    // about the person from the day they sit down.
                    const rng = forStream(state.seed, 'write-out-a-copy', master.id, techniqueId, year);
                    const years = have === 0 ? span : span * A_SPARE_IS_PUT_OFF_THIS_MUCH;
                    let yearsAtIt = 1;
                    while (!rng.chance(1 / years) && yearsAtIt < 10_000) yearsAtIt++;
                    if (yearsAtIt > 1) {
                        const name = (getTechnique(techniqueId) as { name?: string } | undefined)?.name ?? techniqueId;
                        state.npcs[mi] = {
                            ...state.npcs[mi]!,
                            activity: {
                                kind: WRITING_OUT_A_COPY,
                                note: `writing out a copy of ${name} for the ${faction.name}'s shelf`,
                                withIds: [],
                                sinceDay: day,
                                untilDay: day + (yearsAtIt - 1) * DAYS_IN_A_YEAR,
                                thingId: techniqueId
                            },
                            updatedOnDay: day
                        };
                        continue;
                    }
                }

                if (holding === null || at === undefined) {
                    const t = getTechnique(techniqueId) as { name: string; cap?: number | null };
                    const cap = Number(t.cap);
                    // A copy this house does not have. If its id is already
                    // taken, the earlier copy is somewhere else - looted, or
                    // given away - and this is a REPLACEMENT rather than the
                    // same book appearing twice. See `replacementCopyId`.
                    const baseId = libraryObjectId(faction.id, techniqueId);
                    const taken = state.objects.some(o => o.id === baseId);
                    state.objects.push(makeObject({
                        id: taken ? replacementCopyId(faction.id, techniqueId, day) : baseId,
                        name: t.name,
                        kind: 'manual',
                        significance: significanceOfManual(techniqueId, cap),
                        description:
                            `The ${faction.name}'s copy of a cultivation manual carrying to ordinal ${cap}, `
                            + `written out by ${master.name} for the people coming up behind them.`,
                        possessorId: faction.id,
                        ownerId: faction.id,
                        ownerName: faction.name,
                        locationId: faction.seatLocationId,
                        tags: ['manual', 'library', 'written-out', `faction:${faction.id}`],
                        data: { techniqueId, cap, copies: 1, writtenOutBy: master.id, writtenOnDay: day }
                    }));
                    holdingAt.set(key, state.objects.length - 1);
                    written.push({
                        masterId: master.id, masterName: master.name, factionId: faction.id,
                        techniqueId, firstInTheHouse: true, copies: 1
                    });
                } else {
                    state.objects[at] = {
                        ...holding,
                        data: { ...holding.data, copies: have + 1 }
                    };
                    written.push({
                        masterId: master.id, masterName: master.name, factionId: faction.id,
                        techniqueId, firstInTheHouse: false, copies: have + 1
                    });
                }
            }
        }
    }
    return written;
}

/** The element a manual is written in, for asking whether it suits a reader. */
function manualElementOf(techniqueId: string): string | null {
    const t = getTechnique(techniqueId) as { element?: string | null } | undefined;
    return t?.element ?? null;
}
