/**
 * What a house gives merit for when somebody on its roll hands a thing in.
 *
 * Ruled by the design owner: *"you earn merit for turning into the sect things
 * that the sect wants."* One read and one act, for a book out of a ruin, a core
 * off a beast, a dose, a sack of something, and for the player when a verb
 * reaches it.
 *
 * ── WHAT A HOUSE WANTS ───────────────────────────────────────────────────
 *
 * *"A house can just buy stuff using its own treasury, why would it need you."*
 * So a house wants only what it cannot simply buy, and the engine already draws
 * that line: `howAGradeIsStored` stores a grade the world restocks as counted
 * (mortal, earth) and one it does not as tracked (heaven and above).
 *
 *   a book           wanted only where no copy is for sale to the house: no
 *                    stall carries one it can pay for, and nobody in its own
 *                    province would write one out for it (`aCopyIsForSaleTo`).
 *                    Its own lost arts, ruin books, and arts held by houses
 *                    that will not sell.
 *   tracked grade    nobody sells it the house. Wanted.
 *   counted grade    on a market, so wanted only where the house's purse is
 *                    short of one unit's worth.
 *   already held     the want is filled. A tracked thing is one row, and a house
 *                    that owns one of it (or has the book on its shelf) wants no
 *                    second. It comes back when the one it had is spent, lost
 *                    or taken.
 *
 * There is no penalty for a thing having been bought first. The house cannot
 * tell and does not care; what stops stones pouring in is that the want fills.
 *
 * ── WHAT IT IS WORTH, AND THE ANCHOR ─────────────────────────────────────
 *
 * What getting it any other way would cost the house, in the board's own units:
 *
 *   goods   the catalog's market value (`value` on the herb, beast material
 *           or pill), times the board's exchange rate - the contribution an
 *           errand pays per stone it pays (`contributionPerStoneOverDays` over
 *           `ORDINARY_DUTY_DAYS`). A heaven core near 2,900 stones is about
 *           2,000 merit; an immortal herb is tens of thousands.
 *   books   nobody sells the house one it lacks, so it is a master's years at
 *           it (`yearsToWriteOutACopy`), priced as the house pays for that much
 *           service at the book's cap (`whatServiceIsWorth`). A heaven book is
 *           thousands; a book that runs out is worth the share of reads left.
 *
 * ── MEASURED ─────────────────────────────────────────────────────────────
 *
 * `scripts/probe-what-buying-merit-costs.ts`. Buying goods to hand in costs 0.9
 * (cheapest region) to 2.2 (dearest) times the stones the board pays alongside
 * the same merit, at every grade, and only heaven and above is wanted, which no
 * counter sells. A book is not a loop: one a house could buy a copy of is not
 * wanted, and on `shape-a` at world open, of 5,511 house-and-art pairs no house
 * held, 361 had a stall copy and 97 a seller in the province, none of them heaven
 * or above, and no pair was both wanted and for sale. One of every good the
 * catalog holds is 3.6 to 4.6 million merit to a house, nearly all immortal and
 * chaos grade; its wants then fill. Over 500 years on three seeds, 29 turn-ins
 * a century, mostly books, and 16 of about 3,600 rank changes a century needed
 * the turn-in merit to clear their gate.
 */

import { getPill } from '../../data/cultivation/pills.js';
import { getTechnique } from '../../data/cultivation/techniques.js';
import type { TechniqueGrade } from '../../schema/cultivation.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { whatAnIngredientIs } from '../cultivation/what-a-cauldron-will-take.js';
import { ORDINARY_DUTY_DAYS, contributionPerStoneOverDays } from '../encounters/duties.js';
import { makeFact } from './history.js';
import {
    betrayalOfSelling,
    couldWriteOutACopy,
    manualCeilingOf,
    manualIdOf,
    shelfOf,
    suitsRoot,
    whoseArt,
    yearsToWriteOutACopy
} from './manuals.js';
import { theProvinceAround } from './ground-holder.js';
import { whatTheyDealIn, whatThisPersonWouldPartWith } from './what-somebody-standing-here-would-part-with.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import { howAGradeIsStored, isRuined, type ObjectRecord } from './possessions.js';
import { stallPriceStones, whatACopyIsSoldFor } from './what-a-copy-of-a-manual-costs-at-a-stall.js';
import { creditMerit, whatServiceIsWorth } from './what-a-house-counts-in-somebodys-favour.js';
import { whatIsLeftIn } from './what-a-manual-has-left-in-it.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { FactionRecord, WorldState } from './world-state.js';

const GRADES: readonly TechniqueGrade[] = ['mortal', 'earth', 'heaven', 'immortal', 'chaos'];

/** What a thing is, as a want reads it: the kind it is one of, and its grade. */
export interface WhatAThingIs {
    /** The catalog id it is a copy or a lot of. Two rows with one id are the same kind. */
    kindId: string;
    grade: TechniqueGrade;
    /** Stones one unit fetches on a market, or null where nobody sells it. */
    marketStones: number | null;
    /** How many are in the row. */
    quantity: number;
}

/** Read a row as a kind, a grade and a price. Null for what no want can read. */
export function whatThisThingIs(object: Pick<ObjectRecord, 'kind' | 'data' | 'tags'>): WhatAThingIs | null {
    const data = object.data ?? {};
    const quantity = Math.max(1, Math.floor(Number(data.quantity ?? 1)) || 1);
    const tagged = object.tags.find(t => t.startsWith('grade:'))?.slice(6);
    const gradeOf = (value: unknown): TechniqueGrade | null =>
        typeof value === 'string' && (GRADES as readonly string[]).includes(value) ? value as TechniqueGrade : null;

    if (object.kind === 'manual') {
        const id = manualIdOf(object as ObjectRecord);
        const art = id === null ? undefined : getTechnique(id);
        if (id === null || art === undefined) return null;
        return { kindId: id, grade: art.grade, marketStones: stallPriceStones(id), quantity: 1 };
    }
    const id = typeof data.materialId === 'string' ? data.materialId
        : typeof data.sourceId === 'string' ? data.sourceId
            : typeof data.pillId === 'string' ? data.pillId : null;
    if (id === null) return null;
    const ingredient = whatAnIngredientIs(id);
    if (ingredient !== null) {
        return { kindId: id, grade: ingredient.grade, marketStones: ingredient.value, quantity };
    }
    const pill = getPill(id);
    if (pill !== undefined) {
        const grade = gradeOf(data.grade) ?? gradeOf(tagged) ?? gradeOf((pill as { grade?: unknown }).grade);
        const value = Number((pill as { value?: unknown }).value);
        if (grade === null || !Number.isFinite(value)) return null;
        return { kindId: id, grade, marketStones: value, quantity };
    }
    return null;
}

export type WhyAHouseWantsIt = 'nobody_sells_it' | 'it_cannot_afford_one';
export type WhyAHouseDoesNot = 'it_buys_its_own' | 'it_already_has_one' | 'nothing_it_can_price' | 'no_such_house';

export interface WhatTheHouseMakesOfIt {
    wanted: boolean;
    why: WhyAHouseWantsIt | WhyAHouseDoesNot;
    /** Merit it credits for this row. Zero where it is not wanted. */
    merit: number;
}

function alreadyHolds(state: WorldState, houseId: string, thing: WhatAThingIs, isABook: boolean): boolean {
    if (isABook && shelfOf(state, houseId).some(m => m.id === thing.kindId)) return true;
    for (const row of state.objects) {
        if (row.ownerId !== houseId || isRuined(row)) continue;
        const held = whatThisThingIs(row);
        if (held !== null && held.kindId === thing.kindId) return true;
    }
    return false;
}

/** What getting this row any other way would cost the house, as merit. See the header. */
export function whatItIsWorthToAHouse(
    object: Pick<ObjectRecord, 'name' | 'kind' | 'data' | 'tags'>,
    thing: WhatAThingIs
): number {
    if (object.kind === 'manual') {
        const art = getTechnique(thing.kindId);
        const years = yearsToWriteOutACopy(thing.kindId);
        if (art === undefined || art.cap == null || years === null) return 0;
        const uses = whatIsLeftIn(object, thing.grade);
        if (uses.isSpent) return 0;
        const share = uses.allowed !== null && uses.left !== null ? uses.left / uses.allowed : 1;
        return Math.round(whatServiceIsWorth(Number(art.cap), years * DAYS_PER_YEAR) * share);
    }
    if (thing.marketStones === null) return 0;
    return Math.round(thing.marketStones * thing.quantity * contributionPerStoneOverDays(ORDINARY_DUTY_DAYS));
}

/** Where a house could buy a copy of a book, and what it would pay. */
export interface ACopyForSale {
    /** `a_stall`, or the id of the person who would write one out for the house. */
    from: string;
    stones: number;
}

/**
 * A copy of this book the house could simply buy, or null where none is for sale
 * to it.
 *
 * A stall's copy, or one a person in the house's own province would part with -
 * `whatThisPersonWouldPartWith`, the read a player's square takes, over what they
 * hold - at a figure the house's purse covers. Somebody of the house itself is
 * not selling it anything.
 */
export function aCopyIsForSaleTo(
    state: WorldState,
    house: Pick<FactionRecord, 'id' | 'seatLocationId' | 'resources'>,
    techniqueId: string
): ACopyForSale | null {
    const purse = Number(house.resources.spirit_stones ?? 0);
    const stall = stallPriceStones(techniqueId);
    if (stall !== null && stall <= purse) return { from: 'a_stall', stones: stall };

    const province = theProvinceAround(state.locations, house.seatLocationId);
    if (province === null) return null;
    const art = getTechnique(techniqueId);
    const listStones = whatACopyIsSoldFor(techniqueId);
    if (art === undefined || listStones === null) return null;
    const owners = whoseArt(techniqueId);
    let best: ACopyForSale | null = null;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId === house.id) continue;
        if (!npc.cultivation.techniqueIds.includes(techniqueId)) continue;
        const who = {
            id: npc.id, name: npc.name, ordinal: npc.cultivation.realmOrdinal,
            spiritStones: npc.spiritStones ?? 0, factionId: npc.factionId
        };
        if (whatTheyDealIn(who) !== 'what_they_hold') continue;
        if (theProvinceAround(state.locations, npc.locationId) !== province) continue;
        const owner = npc.factionId !== null && owners.includes(npc.factionId) ? npc.factionId : owners[0] ?? null;
        const opens = Number(art.requiredOrdinal ?? 0);
        const [offer] = whatThisPersonWouldPartWith(who, [{
            id: techniqueId,
            name: art.name,
            usableFrom: opens,
            usefulUntil: art.cap == null ? opens : Number(art.cap),
            listStones,
            awkwardToHold: betrayalOfSelling(npc, techniqueId, owner),
            whoWouldWantAWord: owner,
            copyable: couldWriteOutACopy({ realmOrdinal: who.ordinal }, techniqueId),
            whatMovesIsACopy: true
        }]).offers;
        if (offer === undefined || offer.askStones > purse) continue;
        if (best === null || offer.askStones < best.stones) best = { from: npc.id, stones: offer.askStones };
    }
    return best;
}

/** Whether this house wants this row, why, and what it would credit for it. */
export function whatTheHouseMakesOf(
    state: WorldState,
    houseId: string,
    object: Pick<ObjectRecord, 'id' | 'name' | 'kind' | 'data' | 'tags'>
): WhatTheHouseMakesOfIt {
    const house = state.factions.find(f => f.id === houseId && f.dissolvedOnDay === null);
    if (house === undefined) return { wanted: false, why: 'no_such_house', merit: 0 };
    const thing = whatThisThingIs(object);
    if (thing === null) return { wanted: false, why: 'nothing_it_can_price', merit: 0 };
    const isABook = object.kind === 'manual';

    let why: WhyAHouseWantsIt;
    if (isABook) {
        if (aCopyIsForSaleTo(state, house, thing.kindId) !== null) {
            return { wanted: false, why: 'it_buys_its_own', merit: 0 };
        }
        why = 'nobody_sells_it';
    } else if (howAGradeIsStored(thing.grade) === 'tracked' || thing.marketStones === null) {
        why = 'nobody_sells_it';
    } else if (Number(house.resources.spirit_stones ?? 0) < thing.marketStones) {
        why = 'it_cannot_afford_one';
    } else {
        return { wanted: false, why: 'it_buys_its_own', merit: 0 };
    }
    if (alreadyHolds(state, houseId, thing, isABook)) return { wanted: false, why: 'it_already_has_one', merit: 0 };
    const merit = whatItIsWorthToAHouse(object, thing);
    return merit > 0 ? { wanted: true, why, merit } : { wanted: false, why: 'nothing_it_can_price', merit: 0 };
}

/**
 * Hand this row to the member's house, credit the merit, and say it.
 *
 * Returns the merit credited, or zero when the house did not want it, the person
 * is not on its roll, or the row is not theirs to hand over. The caller decides
 * whether they would rather keep it; this only does the handing in.
 */
export function turnItInToTheHouse(state: WorldState, input: {
    npcId: string;
    objectId: string;
    onDay: number;
    /**
     * False hands over what is left of something the person already took their
     * share of - a book they read - for nothing. The want still decides.
     */
    forMerit?: boolean;
}): number {
    const at = state.npcs.findIndex(n => n.id === input.npcId);
    const where = state.objects.findIndex(o => o.id === input.objectId);
    const npc: NpcRecord | undefined = state.npcs[at];
    const object = state.objects[where];
    if (npc === undefined || object === undefined || npc.factionId === null || npc.status !== 'alive') return 0;
    if (object.possessorId !== npc.id && object.ownerId !== npc.id) return 0;
    const house = state.factions.find(f => f.id === npc.factionId);
    if (house === undefined) return 0;
    const made = whatTheHouseMakesOf(state, house.id, object);
    if (!made.wanted) return 0;

    const gradeLine = whatThisThingIs(object)?.grade;
    state.objects[where] = {
        ...object,
        possessorId: house.id,
        ownerId: house.id,
        ownerName: house.name,
        locationId: house.seatLocationId,
        tags: [...object.tags.filter(t => t !== 'library' && !t.startsWith('faction:')),
            ...(object.kind === 'manual' ? ['library'] : []), `faction:${house.id}`],
        data: { ...object.data, turnedInBy: npc.id, turnedInOnDay: input.onDay }
    };
    if (input.forMerit === false) return 0;
    state.npcs[at] = { ...creditMerit(npc, made.merit), updatedOnDay: input.onDay };
    appendWorldFact(state, makeFact({
        day: input.onDay,
        kind: 'inheritance',
        scale: 'personal',
        actors: [{ id: npc.id, name: npc.name, role: 'giver' }],
        locationId: house.seatLocationId,
        factionIds: [house.id],
        summary: `${npc.name} turned ${object.name} in to the ${house.name.replace(/^[Tt]he\s+/, '')}.`,
        visibility: 'faction',
        magnitude: gradeLine !== undefined && howAGradeIsStored(gradeLine) === 'tracked' ? 0.45 : 0.3,
        data: { objectId: object.id, merit: made.merit, turnedIn: true }
    }));
    return made.merit;
}

/**
 * Everybody on a roll hands in what they carry that their house wants.
 *
 * Not a thing they fight with (a row with `power`), and not a book they could
 * still open that would carry them past what they hold: reading it is theirs to
 * weigh, and the finder weighed it where it was found. Returns the merit credited.
 */
export function peopleTurnInWhatTheirHouseWants(state: WorldState, day: number): number {
    const byId = new Map(state.npcs.map(n => [n.id, n] as const));
    const handing: { npcId: string; objectId: string }[] = [];
    for (const object of state.objects) {
        if (object.possessorId === null || object.possessorId !== object.ownerId || object.power !== null) continue;
        if (object.kind !== 'manual' && object.kind !== 'material' && object.kind !== 'pill') continue;
        if (isRuined(object)) continue;
        const npc = byId.get(object.possessorId);
        if (npc === undefined || npc.status !== 'alive' || npc.factionId === null || !isTheWorldsToMove(npc)) continue;
        if (object.kind === 'manual') {
            const id = manualIdOf(object);
            const art = id === null ? undefined : getTechnique(id);
            if (art !== undefined && art.cap != null
                && Number(art.requiredOrdinal ?? 0) <= npc.cultivation.realmOrdinal
                && Number(art.cap) > manualCeilingOf(npc)
                && suitsRoot(npc.cultivation.spiritRoot, art.element ?? null)) continue;
        }
        handing.push({ npcId: npc.id, objectId: object.id });
    }
    let credited = 0;
    for (const hand of handing) credited += turnItInToTheHouse(state, { ...hand, onDay: day });
    return credited;
}
