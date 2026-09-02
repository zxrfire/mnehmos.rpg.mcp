/**
 * Books, and who has one.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS CLOSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A seeded world contained no objects at all. `makeObject` was called zero
 * times by the seeder, `world_objects` migrated and stayed empty, and every one
 * of the five hundred-odd NPCs carried `techniqueIds: []`. Nobody in the world
 * held a book.
 *
 * That is not cosmetic, because advancement read it. `applyAdvancement` had no
 * manual to consult, so it fell back on `deriveOrdinal` - a SEEDING function,
 * which answers "given this talent and this age, where would somebody
 * plausibly be" - and used it as a progression rule. Measured, the consequences
 * were total:
 *
 *   - `deriveOrdinal` saturates. The best root in the catalog reaches ordinal
 *     16 at age 120 and never moves again, for the remaining nine centuries of
 *     a life. The region permits 44.
 *   - 192 of 565 living cultivators sat ABOVE that curve's maximum already, so
 *     `derived <= current` short-circuited and they could never advance at any
 *     age, ever.
 *   - Over two hundred simulated years, the number of cultivators anywhere in
 *     the world who gained a single rung was ZERO.
 *
 * The pyramid looked right - 310 people at the bottom, two at the top - and was
 * entirely furniture. Nobody was climbing it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   NOT EVERYBODY DERIVES. THE ONES IN SECTS HAVE BOOKS.
 *
 * Talent and age say how fast somebody climbs. A manual says how far they can
 * climb at all, and it is the harder limit of the two. This is already the
 * player's rule - `techniqueCap`, `NO_MANUAL_CEILING`, and the whole of
 * `escapes.ts` exist to say what a capped cultivator does next - and the world
 * simply was not playing by it.
 *
 * Applied to the world it produces the setting's own central claim for free:
 * A LOW HOUSE CANNOT PRODUCE A HIGH CULTIVATOR. Not because a rule says so, but
 * because its library stops.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE SOURCES, AND THEY ARE NOT EQUAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   THE WORKING LIBRARY   `teaches` on the catalog entry - documented there as
 *                         "the sect's entire working library... gated by rank
 *                         in the engine". This is the ordinary disciple's
 *                         ceiling and it is usually well below the house's own
 *                         apex: measured, 29 of 32 houses teach a best manual
 *                         capped BELOW their own `powerOrdinal`, and the Azure
 *                         Cloud Pavilion stands at 41 while teaching to 17.
 *                         That gap is not a bug. It is why the sect "reliably
 *                         produces Core Formation and has not produced above
 *                         Nascent Soul in three centuries", in its own entry,
 *                         and it is the reason `escapes.ts` has nine routes.
 *
 *   WHAT THE APEX HOLDS   The people at the top did not climb on the working
 *                         library, so they hold something else. The top ranks
 *                         reach the whole shelf, and so does the one person a
 *                         house has decided is worth it - see THE CHOSEN.
 *
 *   NOTHING AT ALL        The unbacked. No house, no shelf, no book, and the
 *                         derive curve is all they get - which is exactly the
 *                         low ceiling it turned out to be, and is now a
 *                         statement about their position rather than a bug
 *                         applied to everybody.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A MANUAL IS AN ITEM WITH A COUNT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Books are objects the way a sword is an object: they sit in `world_objects`,
 * they have a holder, they can be taken, and THERE ARE ONLY SO MANY. A house
 * with one copy of the thing its patriarch cultivates cannot hand it to forty
 * people, and that single fact is most of why an archive is guarded, why theft
 * is worth the risk, and why a house that loses a room loses a capability
 * rather than a decoration.
 *
 * Copies are not conjured. Somebody who has MASTERED an art can write it out
 * again - see `canReproduce` - so a library grows only where the house holds
 * somebody who went all the way to the end of that book. A house whose last
 * master of its apex manual died holds a copy nobody can duplicate, and when
 * that copy goes, so does the art.
 *
 * One row per (holder, manual) with a count, rather than a row per copy: a
 * house holding twenty intake primers is one fact about the house, not twenty
 * facts, and splitting a copy off for a specific person is what `TAKE ONE COPY`
 * below is for.
 */

import type { NpcRecord } from './npc-state.js';
import type { FactionRecord, WorldState } from './world-state.js';
import { makeObject, type ObjectRecord } from './possessions.js';
import { forStream, type CultivationRNG } from '../cultivation/rng.js';
import { conflictsWithRoot, getSpiritRoot } from '../cultivation/spirit-roots.js';
import { getTechnique, TECHNIQUES } from '../../data/cultivation/techniques.js';
import { SECTS } from '../../data/cultivation/sects.js';
import type { SpiritRootKey } from '../../schema/cultivation.js';

/**
 * The working library of each house, by faction id.
 *
 * Read from the data catalog directly rather than through `CultivationCatalog`,
 * which does not carry `teaches`. Adding it there would be tidier and would
 * mean editing a file two other agents are currently in; this module is the one
 * consumer, so it reads its own input.
 */
const TAUGHT: ReadonlyMap<string, readonly string[]> = new Map(
    (SECTS as readonly { id: string; teaches?: readonly string[] }[])
        .map(s => [s.id, s.teaches ?? []])
);

/**
 * What somebody with no house can plausibly have got hold of.
 *
 * The cheap and portable end of the world's shelf - low grade, low entry, and
 * nothing whose provenance is a hole in the ground, because a rogue picking up
 * a ruin art is an event rather than a starting condition. This is the same kit
 * the catalog's wandering league is described as selling to people no sect will
 * take, which is who is drawing on it.
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
 *
 * Exported because `the-ties-an-ordinary-life-produces.ts` has to name the
 * PERSON behind the transmission this file has always modelled anonymously -
 * `reachableCeilingFor` builds a set of ids somebody in the house can teach and
 * then throws away who that somebody was. Asking the same question of the same
 * shelf is what keeps the tie and the ceiling from disagreeing.
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
 *
 * ── WHY THIS EXISTS: LITERACY WAS SEEDED ONCE AND NEVER MANUFACTURED AGAIN ──
 *
 * `manualsOf` reads `teaches` off the content catalog, keyed by the id of a
 * house that was written by hand. Every house the world FOUNDS for itself -
 * `faction_founded` in `the-world-changing-on-its-own.ts`, which is the ordinary
 * way institutions replace each other - has no catalog entry, so it read back an
 * empty shelf and could teach nobody anything, permanently, however senior the
 * people who walked out to start it.
 *
 * That made institutional churn a one-way ratchet on the world's knowledge.
 * Measured over three thousand years on one seed, and the columns move together:
 *
 *     years   houses standing   holding a shelf   books held by the living
 *         0                32                30                         68
 *       500                40                11                         46
 *      1500                31                 7                         29
 *      3000                47                 5                          6
 *
 * Houses churn healthily throughout - that half is correct and wanted, a house
 * is supposed to be able to fall. What is not wanted is that 42 of the 47
 * standing at the end could not carry anybody past `BOOKLESS_CEILING`. With the
 * ceiling gone the flow up the ladder stops, the standing distribution can only
 * erode toward the rung people enter at, and the world reads 96% Qi Condensation
 * with four consecutive empty bands above the middle - a Late Age produced by
 * unreplaced attrition rather than by anybody's decline.
 *
 * ── THE FIX IS THE FILE'S OWN RULE, APPLIED ──────────────────────────────
 *
 * This module's header already says a manual is an object with a holder and a
 * count, and `seedSectLibraries` already puts every catalog house's working
 * library into `state.objects` possessed by the house. Nothing read them back.
 * So the shelf is the catalog's statement UNION what the house is holding, and a
 * founded house becomes literate the honest way: its founders walked out with
 * copies of what they were practising, and those copies are ordinary objects
 * created at the founding.
 *
 * No branch anywhere on whether a house is a catalog house or a founded one.
 * At seeding the two sources are identical, so every seeded world reads exactly
 * as it did before.
 */
export function shelfOf(state: WorldState, factionId: string): Manual[] {
    return shelvesOf(state).get(factionId) ?? manualsOf(factionId);
}

/**
 * One walk of the object table per world-day, rather than one per question.
 *
 * `applyFoundRoads` asks `reachableCeilingFor` of every living person every
 * year, so a shelf that scanned `state.objects` on each call would be a walk of
 * the object table five hundred times a year for as long as the world runs. The
 * index is rebuilt when the day moves or when the table grows, which covers both
 * ways a library can change inside one pass: a founding adds rows in the same
 * year they are read, and everything else happens between years.
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

/**
 * How many copies of a manual a house keeps.
 *
 * Steeply falling in the manual's cap, because the two ends are different kinds
 * of object. An intake primer is a consumable a house reproduces on a schedule
 * and hands to everyone who walks in; the book at the top of the shelf is
 * usually a single object, and a house holding two of those is holding a spare
 * for a reason somebody could tell you.
 *
 * Never zero. A house that teaches a thing has at least one copy of it, by
 * definition of teaching it.
 */
export function copiesOf(cap: number, rng: CultivationRNG): number {
    if (cap <= 13) return rng.int(8, 20);   // the intake primer
    if (cap <= 21) return rng.int(3, 7);    // the ordinary working road
    if (cap <= 29) return rng.int(2, 3);    // the inner shelf
    if (cap <= 37) return rng.int(1, 2);    // what the elders actually cultivate
    return 1;                               // the apex. One, and everyone knows where it is.
}

/**
 * How far somebody with no book gets on their own.
 *
 * Not zero, and this matters for the shape of the world rather than for any one
 * person. A hard gate on holding a manual empties the ladder: nobody is born
 * with a book, so nobody climbs to the height a house would admit them at, so
 * nobody is ever given one. Measured with the gate in place, the population
 * collapsed onto the bottom two bands and not one cultivator anywhere gained a
 * rung in two centuries.
 *
 * So the bookless climb, and they climb badly. Circulating qi by feel gets a
 * determined person into the low rungs - which is exactly how somebody arrives
 * at a sect gate worth admitting in the first place - and then stops hard,
 * because everything above it needs a method somebody wrote down. That is the
 * design rule intact ("impossible without a proper cultivation technique") with
 * the entry path the world needs in order to have anybody in it.
 *
 * It is also what makes a house's shelf worth joining for, in a way a player
 * can feel: the difference between the ceiling you have and the ceiling they
 * are offering is the entire argument for wearing somebody's colours.
 */
export const BOOKLESS_CEILING = 6;

/**
 * The books you can simply buy.
 *
 * Some manuals are not treasures and never were. A gathering primer has been
 * copied by every house, every league and every hedge-teacher for a thousand
 * years, and enough copies exist that a market stall sells one next to the
 * cooking pots. That is why the world is not divided into sect members and
 * mortals: an unbacked nobody with a little money can own a road, and the
 * catalog's wandering league is described as living off exactly this trade,
 * priced at "what a nobody with a muddled root can pay".
 *
 * It is also what keeps `BOOKLESS_CEILING` from being a life sentence, and it
 * puts the first real decision in front of a poor cultivator early: the stones
 * exist, and they can go on a book or on food.
 *
 * Above this line copies are scarce, houses know where each one is, and you do
 * not buy your way past it.
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
 *
 * `COMMON_MANUAL_CAP` answered this alone, and it was right when written:
 * nothing above Qi Condensation sat on more than one shelf. Bridge manuals then
 * closed the gaps in twenty of thirty-two shelves, largely by putting a handful
 * of existing books onto many houses at once, and the constant began calling
 * the province's standard crossing somebody's private property -
 * `unauthorisedPractice` reported a cultivator practising it as answerable to
 * seventeen houses.
 *
 * Commonness was never a fact about height. It is a fact about HOW MANY PEOPLE
 * HOLD IT, and the two coincided by accident. Measured across the catalog:
 *
 *   cap  0-13   3 manuals, median 9 houses each, max 23
 *   cap 14-21   5 manuals, median 3 houses each, max 23
 *   cap 22-29   4 manuals, median 3 houses each, max 13
 *   cap 30-46   3 manuals, median 1 house each,  max 1
 *
 * The top band needs no threshold of mine: EVERY manual above cap 29 is taught
 * by exactly one house. Anybody who reached Void Refinement is already an
 * exception, so the pool of people who could copy such a book is tiny and one at
 * that height is worth an enormous amount of money. That falls out of the
 * catalog rather than being asserted here.
 *
 * Four is the line because the catalog puts nothing between three and nine.
 */
export const COMMON_HOUSE_COUNT = 4;

export function isCommonlyHeld(techniqueId: string): boolean {
    const t = getTechnique(techniqueId) as { class?: string; cap?: number | null } | undefined;
    if (!t || t.class !== 'cultivation' || t.cap == null) return true;
    if (Number(t.cap) <= COMMON_MANUAL_CAP) return true;
    return housesTeaching(techniqueId) >= COMMON_HOUSE_COUNT;
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
 *
 * An outer disciple gets SOMETHING - they came to be taught and a house that
 * taught them nothing would not hold anybody - but no house hands its core
 * teachings to somebody who walked through the gate last month. What they hand
 * over instead takes one of three shapes, and which one a house uses says a
 * great deal about it:
 *
 *   REDUCED_FORM    a deliberately weakened version of the house's own art,
 *                   written to be given away. It works, it will carry somebody
 *                   a long way up the bottom of the ladder, and it stops early
 *                   by design. A house that does this has thought about being
 *                   copied and decided to control what leaks.
 *   OPENING_STAGES  the real book, but only its first stages - which under the
 *                   stage model is simply a low `through_stage`. Honest, and it
 *                   means the disciple already holds the thing they are trying
 *                   to earn more of, which is its own kind of pressure.
 *   A_TEACHER       no book at all. An inner disciple will teach you, IF you
 *                   can win their favour. The cheapest option for the house and
 *                   by far the most demanding for the disciple, because their
 *                   progress now runs through somebody's goodwill rather than
 *                   through an object they hold - and goodwill can be withdrawn.
 *
 * The third is the interesting one and it is not a book transaction: it belongs
 * to the relationship layer, and an outer disciple on those terms should be
 * unable to advance at all while nobody in the house likes them.
 *
 * Which house does which is a stable fact about the house, not a per-disciple
 * roll: a person can ask what the terms are before they join, and be told.
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
 *
 * `chosen` was set once, at seeding, and never again - so the world's favoured
 * disciples aged, died, and were not replaced. Measured across five centuries:
 * 32 chosen at the seeding, 10 at year 50, none at all by year 300, and with
 * them went every route to the top of a shelf. By the end not one living
 * cultivator anywhere held a book that reached even ordinal 20, and the high
 * band emptied from seventeen people to one.
 *
 * That is the difference between a pyramid and a monument. A pyramid is
 * maintained: somebody is always being brought up to replace the person who
 * died, and a house that stops doing it stops mattering within a century -
 * which is a real thing that should be able to happen to a house, but not to
 * every house at once, silently, because a designation was only ever written
 * at world creation.
 *
 * Returns whoever was newly favoured, so the caller can tag them.
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
 *
 * Joining a house IS one of the ways - an outer disciple is taught, that is
 * what they came for - but what they are taught is the bottom of the shelf.
 * Nobody hands the core teachings to somebody who walked through the gate last
 * month, and the gap between what admission buys and what the house actually
 * holds is the thing that keeps them sweeping. So:
 *
 *   ADMISSION   the entry manual, and only that. `shelfReach` at rank 0 reaches
 *               exactly one book however deep the shelf is.
 *   PROMOTION   rank reaches further up it, and the manual's own
 *               `requiredOrdinal` has to be met as well - so a house's better
 *               books arrive years after the rank that permits them, and being
 *               promoted is not the same day as being taught.
 *   PURCHASE    for the unbacked, and only for what a market actually stocks.
 *
 * Returns only ADDITIONS, so it is safe to run against everybody repeatedly.
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
        //
        // Measured: 20 of 32 houses hold a shelf a disciple cannot walk end to
        // end. The usual shape is a primer capping at 13 and the next book
        // wanting 21 - an eight-rung dead zone that no amount of favour or
        // patience crosses, because the requirement is on the book. Left alone
        // it means most houses structurally cannot produce anybody above 13,
        // and the world's high band drained from seventeen people to one inside
        // five centuries.
        //
        // The setting's own answer is a person, not a book: you need guidance
        // from somebody of an appropriate level, and a method can be passed
        // master to student directly. So a house that still HAS a living master
        // of the higher manual can bring somebody across the gap, and a house
        // that has lost its last master of it cannot - which turns the gap from
        // a silent arithmetic dead end into the thing it should be, a fact
        // about who is still alive in the building.
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
    //
    // A stall's primer is a road for somebody at the bottom of the ladder and
    // waste paper for anybody past its cap, so handing one to a cultivator
    // already above it does not give them a method - it gives the world a
    // false account of what they practise. Measured before this guard: an
    // unaffiliated cultivator standing at ordinal 44 was described as
    // practising a gathering canon that carries to 13, which is not a person
    // anybody can believe in.
    //
    // Somebody far above the market's stock is in the situation the escape
    // routes exist for, and the honest answer is that a market has nothing for
    // them. Handing them nothing says exactly that.
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
 *
 * Held by the faction and sitting at its seat. When the architecture layer
 * gives compounds interiors, the archive room becomes the `locationId` and
 * nothing else here has to change - which is the point of seating them at a
 * place rather than filing them under a faction alone.
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
                // A book that carries somebody past the middle of the ladder is
                // not ordinary property, and provenance is only kept above
                // `mundane`.
                significance: m.cap >= 29 ? 'significant' : m.cap >= 17 ? 'notable' : 'mundane',
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
 * A schism is people leaving a building, and what they take with them is what
 * they were already practising. Nothing here decides that a founded house
 * "deserves" a shelf - it reads `techniqueIds` off the people who left, which
 * the world was already storing, and writes the ordinary library rows any other
 * house has. A hall founded by six outer disciples holds six people's primers
 * and teaches to thirteen; one founded by an elder who took the inner book with
 * her holds that, and is a different institution from its first day, for a
 * reason anybody in the province could tell you.
 *
 * This is the inflow the world had no other source of. `faction_fell` removes a
 * library from circulation every time a house ends - correctly, a fallen house
 * is a fallen house - and until this existed nothing put one back, so the count
 * of houses able to carry anybody past `BOOKLESS_CEILING` could only fall. See
 * `shelfOf` for the measurement.
 *
 * Deliberately NOT a copy of the parent's whole shelf. What leaves is what the
 * leavers held; the deep end of a house's shelf stays where it was unless the
 * person holding it is one of the people walking out.
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
            significance: cap >= 29 ? 'significant' : cap >= 17 ? 'notable' : 'mundane',
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
 *
 * `teaches` is documented as "gated by rank in the engine" and nothing gated
 * it. The shelf is ascending, so this returns how many of its books a person at
 * `rankIndex` of `rankCount` is entitled to - the bottom rank gets the primer,
 * the top rank gets everything, and the interesting part is the middle, where
 * a house with a deep shelf and a shallow ladder promotes people into books
 * faster than a house with the reverse.
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
 *
 * An elementless art suits everybody, which is the whole reason the poorest
 * house in the province teaches nothing else and says so in its own entry. A
 * conflicting element is not merely inefficient - `conflictsWithRoot` is the
 * existing authority and it is the one used here rather than a second opinion.
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
 *
 * "Whatever the patriarchs are cultivating, the chosen might have it too." A
 * house that has decided somebody is worth it hands them the top of the shelf
 * years before their rank would reach it, and that is the single most legible
 * form favour takes in this setting - more legible than a stipend, because
 * everybody can see what it produces later.
 *
 * The highest-standing member who is NOT already senior enough to have it, so
 * it is always a promotion over somebody, and there is always exactly one, so
 * the word means something.
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
 *
 * Not one, and not a constant. A house holding several copies of what its
 * elders cultivate can afford several favourites; a house holding a single
 * volume can favour exactly one person and everybody knows which. So the count
 * is the number of copies of the top book the house actually has, capped
 * against the size of the house - which makes generosity a consequence of
 * WEALTH rather than temperament, and means a poor house's chosen is a far
 * lonelier and more conspicuous position than a rich one's.
 */
export function chosenCount(topCopies: number, memberCount: number): number {
    // Being favoured is a DESIGNATION, not a book in your hands.
    //
    // This used to be capped at the number of copies of the top manual, which
    // for any house worth joining is one - so every house in the world favoured
    // exactly one person, forever. Measured downstream, that made inter-house
    // gatherings seat two people 93 times out of 170 and made a ranked
    // competition structurally impossible, since a ranking needs three to have
    // a first, a last and a middle.
    //
    // The error was treating the top copy as the thing that MAKES somebody
    // chosen. It is what being chosen eventually buys. A house grooms several
    // candidates and hands the apex volume to whichever of them is ready for
    // it; the others are being taught by the people who hold it, which is the
    // ordinary way a method moves anyway. So the cap follows what the house can
    // put in front of them - the top of the shelf and the shelf below it -
    // rather than the single scarcest object in the building.
    const canGroom = topCopies + 1;
    return Math.max(1, Math.min(canGroom, Math.ceil(memberCount / 12)));
}

/**
 * A book nobody here can copy is a treasure, not a resource.
 *
 * Reproduction needs a master, and a house can hold a manual that runs past
 * anybody it has ever produced - an inheritance, a bequest from an ancestor who
 * crossed, something dug out of a hole. Nobody in the building can read it to
 * the end, so nobody can write it out again, so THERE WILL ONLY EVER BE THIS
 * ONE, and the house knows it.
 *
 * That changes what the object is. A working manual is stock: it is issued,
 * copied, worn out and replaced. A treasure is a thing the house has, guarded
 * because losing it is permanent, and usually not being cultivated by anybody -
 * a book waiting for somebody good enough to arrive, which may be nobody, for
 * centuries. It is also the most tempting thing in the compound, because the
 * thief knows the house cannot simply make another.
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
 *
 * Nobody who has climbed is blank. Somebody at Core Formation has spent a
 * century in a house that teaches, and the idea that they know one book and no
 * techniques is a seeding artefact rather than a fact about them. Only an
 * ordinal-0 mortal genuinely has nothing, and that is the state the game starts
 * the player in on purpose.
 */
export function artsKnownAt(ordinal: number): number {
    if (ordinal <= 0) return 0;
    return Math.min(6, 1 + Math.floor(ordinal / 7));
}

/**
 * The road somebody standing this high must have been practising.
 *
 * Not a gift and not a reward: it is the reconstruction of a fact the record
 * was missing. Somebody at ordinal 41 got there on a method that teaches to at
 * least 41, because the engine says no other kind of climb exists. This
 * answers WHICH one, from the ordinary catalog, by the ordinary filters - the
 * same four `roadTheyFound` uses - and takes the LOWEST-capping book that
 * reaches them, so the reconstruction never hands anybody more headroom than
 * their own standing already implies.
 *
 * Null when the catalog has nothing they could open, which is a legitimate
 * answer: the three canons above ordinal 41 want 41 and 42 to so much as read.
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
 *
 * Every member gets what their rank reaches, filtered to what will not fight
 * their root, and the chosen gets the top of the shelf regardless. Somebody
 * whose root conflicts with everything their rank reaches gets the best
 * elementless book the house has, and if the house has none they get nothing -
 * which is a real and correct outcome, and is the mechanical form of a house
 * taking somebody it cannot actually teach.
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
            //
            // The rule every other cultivator in the world obeys -
            // `manualCeilingOf` is a hard stop, and progress without a road is
            // impossible rather than slow - and the people the catalogs place
            // at the top were the only ones exempt from it, because a house's
            // shelf is not what its patriarch cultivates. Measured at seeding:
            // 29 of 32 houses teach below their own `powerOrdinal`, the Azure
            // Cloud Pavilion stands at 41 and teaches to 17, and the mean book
            // held by the world's Tribulation Transcendence figures capped at
            // ordinal 11.5. Two people at 44 practising a canon that runs out
            // at 11 is not somebody anybody can believe in, and it is why the
            // apex could never teach anything: nothing it held reached itself.
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

    // The unbacked climbed too, and they did not do it knowing nothing. What
    // they have is whatever a person with no house can get hold of - the cheap,
    // portable, widely-copied end of the world's shelf, which is exactly what
    // the wandering league in the catalog is described as selling - so they are
    // drawn from the common pool rather than from anybody's library, and they
    // get no road at all. That last part is the point: no house, no ceiling
    // raised, and `escapes.ts` is the whole of their remaining career.
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
 *
 * The same act - a master writes out a manual and sells the copy - is an
 * honest trade or the worst thing you have ever done to the people who fed
 * you, and the only difference is whose book it was. A house's whole position
 * rests on holding something others do not: its shelf IS its power, its
 * recruitment pitch, and the reason anybody sweeps its floors for forty years.
 * A disciple who sells the inner manual has not stolen an object, they have
 * given away the institution, and houses treat it accordingly.
 *
 * Returns how badly, from 0 (nobody's property, sell freely) upward:
 *
 *   0    a common book. Everybody has it, anybody may copy it, and selling
 *        copies is an ordinary way for a poor cultivator to eat.
 *   1    a working manual of a house you do not belong to. Awkward, not fatal;
 *        somebody will want to know where you got it.
 *   2    a working manual of your OWN house. This is the betrayal proper.
 *   3    something at the top of a house's shelf, or a book nobody left alive
 *        can reproduce. Unforgivable and permanent, because the house cannot
 *        undo it - once it is out, it is out, and no amount of killing you puts
 *        it back.
 *
 * The player can do this. That is the point of writing it down: the route
 * exists, it pays, and it is one of the few things in the setting that a house
 * will pursue you across a lifetime for.
 */
export function betrayalOfSelling(
    /**
     * Narrowed to the one field this reads, so the player can be priced on the
     * same scale as an NPC without a `Cultivator` being dressed up as an
     * `NpcRecord` to get here. A whole `NpcRecord` still satisfies it.
     *
     * TEACHING AN ART AND SELLING ITS BOOK ARE THE SAME EXPOSURE - what a house
     * loses is the art being OUT, and it is no less out for having left through
     * somebody's mouth - so `what-asking-this-person-for-this-would-cost-them.ts`
     * prices a request to be taught off this exact function rather than off a
     * second scale beside it.
     */
    npc: Pick<NpcRecord, 'factionId'>,
    techniqueId: string,
    ownerFactionId: string | null
): 0 | 1 | 2 | 3 {
    // Nobody's property, so selling copies is a trade rather than a betrayal.
    if (isCommonlyHeld(techniqueId)) return 0;
    if (!ownerFactionId) return 1;
    const shelf = manualsOf(ownerFactionId);
    const isTop = shelf.length > 0 && shelf[shelf.length - 1].id === techniqueId;
    if (isTop) return 3;
    return npc.factionId === ownerFactionId ? 2 : 1;
}

/**
 * Which house's art this is, if anybody's.
 *
 * A manual on a common shelf belongs to nobody. Anything narrower is somebody's,
 * and the world knows whose - houses teach in public, and an art is the most
 * legible signature a cultivator carries.
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
 *
 * An art is a fingerprint. You cannot cultivate a house's manual quietly,
 * because cultivating it is a visible thing that knowledgeable people recognise
 * on sight - which is already a rule elsewhere in this world, where a
 * knowledgeable NPC seeing what you are practising is a scene the narrator is
 * told to run.
 *
 * So a stolen or bought-on-the-black-market manual is not a safe purchase. It
 * works, it will carry you exactly as far as the real thing, and the day
 * somebody from the house that wrote it watches you use it, you are holding an
 * object you cannot explain. THE MANUAL IS EVIDENCE, and it is evidence that
 * follows you for as long as you keep climbing on it - which is the rest of
 * your life, because putting it down means starting again.
 *
 * This is what makes a black market a real decision rather than a discount. The
 * grey market is where a cultivator sells an ancient manual they cannot use for
 * a fortune - no resources, no chance, and a buyer somewhere who has both - and
 * that trade is honest. The black market is where the same object arrives
 * having been taken off somebody, and the price is lower for a reason.
 *
 * `null` when there is nothing to answer for. Otherwise the houses that would
 * want a word, in the order they would get to you.
 */
export function unauthorisedPractice(npc: NpcRecord, techniqueId: string): string[] | null {
    // Common books are nobody's - and "common" is how widely a manual is
    // held, not how high it carries.
    if (isCommonlyHeld(techniqueId)) return null;
    const owners = whoseArt(techniqueId).filter(id => id !== npc.factionId);
    if (owners.length === 0) return null;
    // Somebody carrying the tag of a house that teaches it has an answer ready.
    return owners;
}

/**
 * What happens when they catch you practising it.
 *
 * Being caught is one event; the response is not. It is decided by WHOSE ART IT
 * IS, and specifically by the alignment of the house that owns it - which turns
 * a single rule into three quite different situations without a branch on any
 * faction's name.
 *
 *   A DEMONIC HOUSE     may simply kill you. There is no process to fail and
 *                       nobody to explain yourself to; you are practising their
 *                       method without their permission and that is the whole
 *                       of the matter. A demonic manual can absolutely be found
 *                       - in a hole, on a body, at the wrong end of a market -
 *                       and finding one is not the dangerous part.
 *   A RIGHTEOUS HOUSE   asks where you got it. That is worse in a different
 *                       direction and better in the obvious one: there is a
 *                       conversation, it has a right answer, and the questions
 *                       are about your SOURCE rather than about you. Somebody
 *                       sold it, somebody copied it, somebody died holding it,
 *                       and the house wants that person far more than it wants
 *                       you. You may walk away having given up somebody else.
 *   A NEUTRAL HOUSE     prices it. An art off their shelf in somebody else's
 *                       hands is a loss to be recovered or a lever to be used,
 *                       and which of those it becomes depends on what you are
 *                       worth to them.
 *
 * And the reason this matters rather than being colour: THE RISK IS NOT THE
 * SAME RISK, so the same decision is correct for different people. Rogue
 * cultivators take demonic methods constantly and knowingly - a person with no
 * house, no standing and no prospects is being offered a real ladder against a
 * risk they were already carrying, and many of them simply do not care. That is
 * a rational choice from where they are standing, and it is why the demonic
 * arts stay in circulation no matter how many people are killed over them.
 */
export type IfCaught = 'killed' | 'questioned_about_the_source' | 'priced' | 'nothing';

export function ifCaughtPractising(
    techniqueId: string,
    ownerFactionId: string | null
): IfCaught {
    if (isCommonlyHeld(techniqueId)) return 'nothing';
    if (!ownerFactionId) return 'nothing';
    const owner = (SECTS as readonly { id: string; alignment?: string }[])
        .find(s => s.id === ownerFactionId);
    switch (owner?.alignment) {
        case 'demonic': return 'killed';
        case 'righteous': return 'questioned_about_the_source';
        default: return 'priced';
    }
}

/**
 * How far the books somebody holds will carry them.
 *
 * `NO_MANUAL_CEILING` for somebody holding nothing, which is the same zero the
 * player's own layer uses and means the same thing: without a road, progress is
 * not slow, it is impossible.
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
 *
 * `manualCeilingOf` answers "what do they HOLD", and for most people that is
 * the same question. It is not the same question for anybody in a house that
 * teaches in person.
 *
 * A house whose admission terms are `a_teacher` hands its newest people no
 * object at all - an inner disciple teaches them, which is the cheapest option
 * for the house and the most demanding for the disciple. I wrote that rule and
 * noted at the time that such a disciple is "not stuck, they are dependent,
 * which is a different and more interesting problem, and it is the relationship
 * layer's". The relationship layer never picked it up, so in practice it was a
 * hard stop with a deadlock inside it:
 *
 *     no book -> BOOKLESS_CEILING (6) -> cannot reach any rank's bar
 *             -> never promoted -> never entitled to a book -> no book
 *
 * Measured: 26 houses teach this way, 219 people belong to them, 121 of those
 * held no road at all, and 74 sat at rank 0 permanently unable to leave it.
 * That is most of the world's bookless, and every one of them was inside an
 * institution whose entire purpose is to teach.
 *
 * Being taught is not the same as being given. A disciple learning a method
 * from somebody who holds it can climb it; what they cannot do is take it with
 * them, sell it, or keep it if the house turns on them. So the CEILING follows
 * what their rank reaches on the shelf, and the OBJECT stays where it was.
 * Which is exactly what makes those terms demanding rather than generous.
 */
/**
 * Who in a house can actually teach each book on its shelf, once per day.
 *
 * This was computed inside `reachableCeilingFor`, which `applyFoundRoads` asks
 * of every living person every year - so a house of forty people walked its own
 * membership forty times a year, and did a linear `shelf.find` for every
 * technique every one of them held. The answer does not depend on who is
 * asking: it is a property of the house and its people on that day.
 *
 * A CPU profile of a thousand-year advance put `reachableCeilingFor` at the top
 * of the busy list. It is the same shape as `shelvesOf` immediately above, and
 * it is cached the same way and for the same reason - keyed on the day, and on
 * the roster length so a founding that adds people inside a year is not read
 * against a stale set.
 *
 * The shelf lookup is a Map rather than a scan, which is the other half of it:
 * the old inner loop was O(members x techniques x shelf).
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
 *
 * A world that never lets anybody past their house's library is terminal at the
 * top. Measured before this existed: no cultivator anywhere crossed above rung
 * 28 in five hundred years, every person at 29 or higher was a seeded survivor,
 * and running the clock to six thousand years left NOTHING above Qi
 * Condensation - the whole upper world was inherited and spending itself.
 *
 * The design has always had the answer and the world layer never used it: a
 * capped cultivator finds a later volume, is taught by somebody above them,
 * talks their way onto a shelf they have no right to, or writes the next stage
 * themselves. `acquisition.ts` prices all four for the player. This is the
 * world's coarse version of the same event - it does not model WHICH route,
 * because from outside a life the difference is not visible; what is visible is
 * that somebody who had stopped is moving again.
 *
 * It must stay rare, and rarer the higher it happens, or the ladder stops
 * meaning anything. The odds halve with every realm above Foundation, so
 * crossing out of Qi Condensation on a found book is a thing that happens to
 * people and reaching the top of the world that way is very nearly a legend.
 * The unbacked get worse odds than that: a route usually runs through somebody,
 * and they have fewer somebodies.
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
 *
 * Drawn from the whole catalog rather than from anybody's shelf, because the
 * point of the event is that it came from outside the institution they are
 * stuck inside. Still bounded by what they can open: a book whose entry
 * requirement is above them is a paperweight, which is the rule everywhere else.
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
 * Can this person write out another copy?
 *
 * Mastery, not acquaintance: somebody must have taken the book to its end
 * before they can reproduce it. So a library grows only where a house still
 * holds a master of that art, and the death of the last one turns a manual into
 * a finite number of physical objects - which is how an art becomes scarce, and
 * then rare, and then lost, without anybody deciding it should.
 */
export function canReproduce(npc: NpcRecord, techniqueId: string): boolean {
    if (!npc.cultivation.techniqueIds.includes(techniqueId)) return false;
    const t = getTechnique(techniqueId) as { class?: string; cap?: number | null } | undefined;
    if (!t || t.class !== 'cultivation' || t.cap == null) return false;
    // A common book is common because anybody holding it can write it out
    // again - no mastery, no permission, no ceremony. That is a loop rather
    // than a coincidence: copyable means plentiful, plentiful means cheap, and
    // cheap means the next person can afford one and copy it too. Selling
    // copies is an ordinary living for a cultivator who needs stones and has
    // nothing else to trade, and it is why a primer costs what it costs.
    // A widely-held book is copyable by anybody holding it, which is the
    // loop that keeps it widely held.
    if (isCommonlyHeld(techniqueId)) return true;
    // Above that line the loop breaks. Reproduction needs somebody who took
    // the book to its end, so a house whose last master of an art has died
    // holds a finite number of physical objects - and an art becomes scarce,
    // then rare, then lost, with nobody having decided it should.
    return npc.cultivation.realmOrdinal >= Number(t.cap);
}

// ─────────────────────────────────────────────────────────────────────────
// A MASTER WRITES IT OUT FOR THEIR STUDENTS
//
// The designer's mechanism, in their own words: "patriarches or TT's will write
// down more copies, so there is that. they do that for their students, right?"
//
// It is right, it was already half-built, and the half that was missing was the
// half that runs. `canReproduce` has always said WHO may write a book out -
// somebody who took it to its end - and nothing anywhere ever called it. So a
// library could only ever shrink: `faction_fell` took shelves out of
// circulation, `technique_lost` took the last living holder of an art out of
// the world, and no pass anywhere put a book back.
//
// Measured across two seeds before this existed, over five thousand years, and
// the three columns are the whole diagnosis:
//
//                distinct manuals    on live        in library
//                held by the LIVING  house shelves  objects
//     year 0            70 / 66          16             16
//     year 500          44 / 42          10 / 13        17
//     year 1500         22 / 22          11             17
//     year 5000          8 / 11           8 / 12        17
//
// The libraries were stable. What emptied was PEOPLE: the world's literacy was
// concentrated in the arts the seeded upper stratum practised, none of those
// arts was written down anywhere, and every one of them died with its holder.
//
// ── WHY THIS IS THE APEX MECHANISM AND NOT A FLAVOUR PASS ────────────────
//
// The catalog holds exactly one cultivation manual that carries to ordinal 41
// and three that carry to 45. Not one of them is on any house's `teaches` list.
// The deepest shelf in the world stops at 37. So before this, the ONLY route
// from Grand Ascension to Tribulation Transcendence anywhere in the simulation
// was `applyFoundRoads` - a one-in-nine-hundred yearly roll halved for every
// realm above Foundation, which is to say luck, alone, with nobody teaching
// anybody anything.
//
// That is precisely the case the designer says should be almost impossible:
// "obscenely hard to get to 41+ without someone showing you the way". The other
// side of that sentence had no implementation at all, because there was nothing
// for anybody to be shown. A patriarch writing out what they cultivate is that
// implementation: the art enters the house's ordinary library as an ordinary
// object, `shelfOf` reads it like any other row, and the house's most senior
// people become entitled to it by the ordinary rank rule. No branch on tier, no
// second catalog, no rule that applies to one faction.
//
// It is also self-limiting in the way the setting wants. The copy only exists
// while somebody who mastered the art is alive to write it; the book's own
// `requiredOrdinal` still gates who can open it - 37 for the ordinal-41 canon,
// 41 and 42 for the three above it - and `shelfReach` still means only the top
// of a house ever reaches the top of its shelf. A house whose last master dies
// before writing it out keeps a finite number of physical objects, and then
// loses the art, exactly as `canReproduce`'s own comment describes.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Years of work, on average, before a master has written out an art the house
 * does not otherwise hold.
 *
 * The urgent case. A master who is the only reason an art exists is not
 * casually postponing this, and on the timescale of the people who can do it -
 * thirty thousand years at Grand Ascension - sixty years is immediate. That is
 * the intent: the scarcity of the apex must come from the ladder, which is
 * priced in millennia, and not from the library being arbitrarily empty.
 */
export const YEARS_TO_WRITE_THE_FIRST_COPY = 60;

/**
 * And for a spare, once the house already holds one.
 *
 * Slower, because there is no longer an art at risk - only a queue. A house
 * with one copy of a book six people are entitled to is a house with a waiting
 * list, and this is how the list shortens.
 */
export const YEARS_TO_WRITE_A_SPARE = 250;

/**
 * Past this many copies a house is not short of a book, it is hoarding paper.
 *
 * A ceiling on the count rather than on the act: without one, a house with a
 * long-lived master accumulates a copy every two hundred and fifty years
 * forever, and after ten thousand years the archive is a warehouse. It also
 * keeps `copiesOf`'s statement true - an intake primer is a consumable a house
 * keeps a shelf of, and the book at the top is one object and everyone knows
 * where it is.
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
 *
 * Mutates `state.objects`: a new holding where the house had none, and a bumped
 * count where it had one. Both are additions, so running it twice in a year
 * only ever writes more copies rather than corrupting anything - but the caller
 * runs it once, on the yearly line, like every other pass.
 *
 * O(members x arts held) with one index of the library built up front, which is
 * the same order as `grantBooksToMembers` and about a thousand cheap iterations
 * a year on the reference world.
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
        // holding it, counted ONCE per art rather than once per master of it.
        // Two masters of the same book in one hall would otherwise each walk
        // the whole membership, which is quadratic in a house's size for as
        // long as the world runs.
        // The writer is never in the count: they hold the book, which is what
        // `canReproduce` required of them, so the same number is correct for
        // every master of it and one walk answers all of them.
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
                        significance: cap >= 29 ? 'significant' : cap >= 17 ? 'notable' : 'mundane',
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
