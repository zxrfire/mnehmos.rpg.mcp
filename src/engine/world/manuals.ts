/**
 * Books, and who has one.
 */

import type { NpcRecord } from './npc-state.js';
import type { FactionRecord, WorldState } from './world-state.js';
import { makeObject, type ObjectRecord, type ObjectSignificance } from './possessions.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { conflictsWithRoot, getSpiritRoot } from '../cultivation/spirit-roots.js';
import { REALM_TIERS, realmForOrdinal } from '../cultivation/realms.js';
import { getTechnique, TECHNIQUES } from '../../data/cultivation/techniques.js';
import {
    ifCaughtAtSomethingTheHousePunishes,
    type IfCaught
} from '../social-leverage/what-a-house-does-when-it-catches-you.js';
import type { SectAlignment } from '../../schema/cultivation.js';
import { SECTS } from '../../data/cultivation/sects.js';
import type { SpiritRootKey } from '../../schema/cultivation.js';

/**
 * The working library of each house, by faction id.
 */
const TAUGHT: ReadonlyMap<string, readonly string[]> = new Map(
    (SECTS as readonly { id: string; teaches?: readonly string[] }[])
        .map(s => [s.id, s.teaches ?? []])
);

/**
 * What somebody with no house can plausibly have got hold of.
 */
const COMMON_ARTS: readonly { id: string; requiredOrdinal: number; element: string | null }[] =
    (TECHNIQUES as readonly {
        id: string; class?: string; cap?: number | null; grade?: string;
        requiredOrdinal?: number; element?: string | null; provenance?: string;
    }[])
        .filter(t => !(t.class === 'cultivation' && t.cap != null))
        .filter(t => t.grade === 'mortal' || t.grade === 'earth')
        .filter(t => t.provenance !== 'ruin' && t.provenance !== 'grave')
        .filter(t => Number(t.requiredOrdinal ?? 0) <= 21)
        .map(t => ({
            id: t.id,
            requiredOrdinal: Number(t.requiredOrdinal ?? 0),
            element: t.element ?? null
        }));

/** A manual the world can actually hand somebody: a road, not a fighting art. */
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
        const t = getTechnique(id) as
            | { id: string; name: string; class?: string; cap?: number | null;
                requiredOrdinal?: number; element?: string | null }
            | undefined;
        // A fighting art carries nobody anywhere. Only a road has a `cap`.
        if (!t || t.class !== 'cultivation' || t.cap == null) continue;
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
        if (object.kind !== 'manual' || object.possessorId === null) continue;
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
            const t = getTechnique(techniqueId) as
                | { id: string; name: string; class?: string; cap?: number | null;
                    requiredOrdinal?: number; element?: string | null }
                | undefined;
            if (!t || t.class !== 'cultivation' || t.cap == null) continue;
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
    const t = getTechnique(techniqueId) as { class?: string; cap?: number | null } | undefined;
    if (!t || t.class !== 'cultivation' || t.cap == null) return true;
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
 * Books somebody has become entitled to since they were last looked at.
 */
export function newlyEntitled(state: WorldState, npc: NpcRecord): string[] {
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
        const teachable = new Set<string>();
        for (const other of state.npcs) {
            if (other.status !== 'alive' || other.factionId !== npc.factionId) continue;
            if (other.id === npc.id) continue;
            for (const id of other.cultivation.techniqueIds) {
                const m = shelf.find(x => x.id === id);
                if (m && other.cultivation.realmOrdinal >= m.requiredOrdinal) teachable.add(id);
            }
        }
        const open = shelf
            .slice(0, reach)
            .filter(m => (m.requiredOrdinal <= ordinal || teachable.has(m.id))
                && suitsRoot(npc.cultivation.spiritRoot, m.element)
                && !held.has(m.id));
        return open.length > 0 ? [open[open.length - 1].id] : [];
    }

    // Unbacked: only what a stall would have, and only if they have nothing
    // better already. Somebody already holding a road does not buy a primer.
    if (manualCeilingOf(npc) > 0) return [];
    // AND ONLY IF IT WOULD ACTUALLY CARRY THEM.
    const stock = commonManuals()
        .filter(m => m.cap > ordinal
            && m.requiredOrdinal <= ordinal
            && suitsRoot(npc.cultivation.spiritRoot, m.element)
            && !held.has(m.id));
    return stock.length > 0 ? [stock[0].id] : [];
}

/** The stable id of a house's holding of one manual, so re-seeding is idempotent. */
export function libraryObjectId(factionId: string, techniqueId: string): string {
    return `lib-${factionId}-${techniqueId}`;
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
        if (manuals.length === 0) continue;   // two powers teach nothing, deliberately

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
 */
export function librariesCarriedOutBy(
    state: WorldState,
    faction: FactionRecord,
    carriers: readonly NpcRecord[]
): ObjectRecord[] {
    const copies = new Map<string, number>();
    for (const npc of carriers) {
        for (const id of new Set(npc.cultivation.techniqueIds)) {
            const t = getTechnique(id) as { class?: string; cap?: number | null } | undefined;
            if (!t || t.class !== 'cultivation' || t.cap == null) continue;
            copies.set(id, (copies.get(id) ?? 0) + 1);
        }
    }
    if (copies.size === 0) return [];

    const held = new Set(
        state.objects
            .filter(o => o.kind === 'manual' && o.possessorId === faction.id)
            .map(manualIdOf)
    );

    const made: ObjectRecord[] = [];
    for (const [techniqueId, count] of [...copies].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (held.has(techniqueId)) continue;
        const t = getTechnique(techniqueId) as { id: string; name: string; cap?: number | null };
        const cap = Number(t.cap);
        made.push(makeObject({
            id: libraryObjectId(faction.id, techniqueId),
            name: t.name,
            kind: 'manual',
            significance: significanceOfManual(techniqueId, cap),
            description:
                `The ${faction.name}'s copies of a cultivation manual carrying to ordinal ${cap}, `
                + 'brought out of the house it split from.',
            possessorId: faction.id,
            ownerId: faction.id,
            ownerName: faction.name,
            locationId: faction.seatLocationId,
            tags: ['manual', 'library', 'carried-out', `faction:${faction.id}`],
            data: { techniqueId, cap, copies: count }
        }));
    }
    return made;
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
 * A book nobody here can copy is a treasure, not a resource.
 */
export function isTreasureTo(members: readonly NpcRecord[], techniqueId: string): boolean {
    const t = getTechnique(techniqueId) as { class?: string; cap?: number | null } | undefined;
    if (!t || t.class !== 'cultivation' || t.cap == null) return false;
    return !members.some(m => m.status === 'alive' && m.cultivation.realmOrdinal >= Number(t.cap));
}

/** The fighting arts on a house's shelf: everything `teaches` that is not a road. */
function artsOf(factionId: string): { id: string; requiredOrdinal: number; element: string | null }[] {
    const out: { id: string; requiredOrdinal: number; element: string | null }[] = [];
    for (const id of TAUGHT.get(factionId) ?? []) {
        const t = getTechnique(id) as
            | { id: string; class?: string; cap?: number | null; requiredOrdinal?: number; element?: string | null }
            | undefined;
        if (!t || (t.class === 'cultivation' && t.cap != null)) continue;
        out.push({ id: t.id, requiredOrdinal: Number(t.requiredOrdinal ?? 0), element: t.element ?? null });
    }
    return out.sort((a, b) => a.requiredOrdinal - b.requiredOrdinal || a.id.localeCompare(b.id));
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
    const open = (TECHNIQUES as readonly {
        id: string; name: string; class?: string; cap?: number | null;
        requiredOrdinal?: number; element?: string | null;
    }[])
        .filter(t => t.class === 'cultivation' && t.cap != null)
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
        const arts = artsOf(factionId);
        if (shelf.length === 0 && arts.length === 0) continue;
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

            // Arts as well as a road, because a hundred years in a house that
            // teaches does not leave somebody knowing nothing. Only what their
            // height has already opened, only what will not fight their root,
            // and taken from the top down so a senior is not carrying the
            // beginner's list.
            const open = arts
                .filter(a => a.requiredOrdinal <= npc.cultivation.realmOrdinal && suitsRoot(root, a.element));
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
    // from the common pool rather than from anybody's library, and they get no road
    // at all. That last part is the point: no house, no ceiling raised, and
    // `escapes.ts` is the whole of their remaining career.
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
        const t = getTechnique(id) as { class?: string; cap?: number | null } | undefined;
        if (!t || t.class !== 'cultivation' || t.cap == null) continue;
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
            const at = required.get(id);
            if (at !== undefined && other.cultivation.realmOrdinal >= at) teachable.add(id);
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
    const open = (TECHNIQUES as readonly {
        id: string; class?: string; cap?: number | null;
        requiredOrdinal?: number; element?: string | null;
    }[])
        .filter(t => t.class === 'cultivation' && t.cap != null)
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
 * The rung at which somebody counts as having mastered a fighting art, for a record
 * that carries no mastery figure.
 */
export function masteryBarFor(techniqueId: string): number | null {
    const t = getTechnique(techniqueId) as
        { class?: string; cap?: number | null; requiredOrdinal?: number } | undefined;
    if (!t) return null;
    if (t.class === 'cultivation' && t.cap != null) return Number(t.cap);
    const opens = Number(t.requiredOrdinal ?? 0);
    const at = REALM_TIERS.findIndex(tier => tier.key === realmForOrdinal(opens).key);
    if (at < 0) return null;
    return REALM_TIERS[Math.min(at + 1, REALM_TIERS.length - 1)].ordinalStart;
}

export function couldWriteOutACopy(holder: HolderOfAnArt, techniqueId: string): boolean {
    const t = getTechnique(techniqueId) as { class?: string; cap?: number | null } | undefined;
    if (!t) return false;
    const isARoad = t.class === 'cultivation' && t.cap != null;
    if (isARoad && isCommonlyHeld(techniqueId)) return true;
    const bar = masteryBarFor(techniqueId);
    if (bar === null) return false;
    if (!isARoad && holder.masteryOfIt != null) return holder.masteryOfIt >= FULLY_MASTERED;
    return holder.realmOrdinal >= bar;
}

/**
 * Can this person in the world write out another copy of a ROAD?
 */
export function canReproduce(npc: NpcRecord, techniqueId: string): boolean {
    if (!npc.cultivation.techniqueIds.includes(techniqueId)) return false;
    const t = getTechnique(techniqueId) as { class?: string; cap?: number | null } | undefined;
    if (!t || t.class !== 'cultivation' || t.cap == null) return false;
    return couldWriteOutACopy({ realmOrdinal: npc.cultivation.realmOrdinal }, techniqueId);
}

// A MASTER WRITES IT OUT FOR THEIR STUDENTS

/**
 * Years of work, on average, before a master has written out an art the house does
 * not otherwise hold.
 */
export const YEARS_TO_WRITE_THE_FIRST_COPY = 60;

/**
 * And for a spare, once the house already holds one.
 */
export const YEARS_TO_WRITE_A_SPARE = 250;

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
    for (let i = 0; i < state.objects.length; i++) {
        const o = state.objects[i];
        if (o.kind !== 'manual' || o.possessorId === null) continue;
        const techniqueId = manualIdOf(o);
        if (techniqueId === null) continue;
        holdingAt.set(`${o.possessorId}|${techniqueId}`, i);
    }

    // ── Who is in each house, so "how many people are waiting for this" is a
    // lookup rather than a scan. ──
    const members = new Map<string, NpcRecord[]>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || !npc.factionId) continue;
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
            for (const techniqueId of master.cultivation.techniqueIds) {
                if (!canReproduce(master, techniqueId)) continue;
                const key = `${faction.id}|${techniqueId}`;
                const at = holdingAt.get(key);
                const holding = at === undefined ? null : state.objects[at];
                const have = holding === null ? 0 : copyCount(holding);

                // A shortage is a fact about the house, not a target: how many
                // people could be taught this and are not holding it. No
                // shortage and a copy already on the shelf, no copy written - a
                // master does not spend a decade on a book nobody is waiting
                // for.
                const waiting = shortageOf(techniqueId);
                if (have > 0 && (waiting === 0 || have >= Math.min(waiting, MOST_COPIES_WORTH_KEEPING))) {
                    continue;
                }

                const rng = forStream(state.seed, 'write-out-a-copy', master.id, techniqueId, year);
                const years = have === 0
                    ? YEARS_TO_WRITE_THE_FIRST_COPY
                    : YEARS_TO_WRITE_A_SPARE;
                if (!rng.chance(1 / years)) continue;

                if (holding === null || at === undefined) {
                    const t = getTechnique(techniqueId) as { name: string; cap?: number | null };
                    const cap = Number(t.cap);
                    state.objects.push(makeObject({
                        id: libraryObjectId(faction.id, techniqueId),
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
