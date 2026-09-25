/**
 * A house's wound medicine: spent on its own people, handed to a member at its
 * seat, and refined back.
 *
 * Both shapes are the ones `where-the-pills-actually-are.ts` seeds. The counted
 * pills that close a wound (mortal and earth grade) are a number on the house,
 * `pill_stock:<id>`; the dearer ones are rows, spent with `swallow`.
 *
 * WHO FIRST. A house sees to its people in order of standing, rank and then rung
 * (`seenToBefore`), so its last dose goes to the elder before the outer disciple.
 * A member asking at the seat is handed one only while the shelf holds more than
 * there are wounded people above them it would close something on.
 *
 * WHAT A MEMBER PAYS. Nothing in the design names a rank at which the house's
 * medicine is free, so a member pays contribution like any other house service,
 * at the rate the house credits the same pill handed in (`whatItIsWorthToAHouse`:
 * catalog value times the board's contribution per stone).
 *
 * WHERE MORE COMES FROM. Every house makes medicine (`what-a-house-refines-in.ts`).
 * Each year a house whose best hand can work a pill's grade (`canRefineGrade`)
 * refines back up to the shelf a house of its reach is seeded with, buying the
 * recipe's ingredients at catalog value out of its purse, one pill a batch, each
 * batch setting at the recipe's base rate. The catalog gives no batches-a-year
 * figure, so the bounds are the shelf and the purse.
 */

import { getPill, PILLS } from '../../data/cultivation/pills.js';
import { getRecipesForPill } from '../../data/cultivation/recipes.js';
import type { Injury, Pill } from '../../schema/cultivation.js';
import { pillStorageModel } from '../cultivation/buying-and-bartering-pills.js';
import { treatWorstInjuries } from '../cultivation/injuries.js';
import { forStream } from '../cultivation/rng.js';
import { whatAnIngredientIs } from '../cultivation/what-a-cauldron-will-take.js';
import { medicineReaches } from '../cultivation/what-grade-of-medicine-a-wound-needs.js';
import { canRefineGrade } from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import { ORDINARY_DUTY_DAYS, contributionPerStoneOverDays } from '../encounters/duties.js';
import { isBelowTheLid } from './layers.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import type { ObjectRecord } from './possessions.js';
import { pillStockKey, swallow, theHeightAHouseWorksAt, theShelfAHouseKeeps } from './where-the-pills-actually-are.js';
import type { WorldState } from './world-state.js';

type Shelved = { resources: Record<string, number> };

/** How many of a counted pill are on a house's shelf. */
export function onTheShelf(house: Shelved, pillId: string): number {
    return Math.max(0, Number(house.resources[pillStockKey(pillId)] ?? 0));
}

/** One off the shelf. The key stays, at zero. */
export function takeOffTheShelf(house: Shelved, pillId: string): void {
    house.resources[pillStockKey(pillId)] = Math.max(0, onTheShelf(house, pillId) - 1);
}

let counted: readonly Pill[] | null = null;

/** The counted pills that close a wound, cheapest first. Once a process: `PILLS` is static. */
export function countedWoundMedicine(): readonly Pill[] {
    counted ??= PILLS
        .filter(p => p.effect === 'treat_injury' && pillStorageModel(p) === 'count')
        .sort((a, b) => a.value - b.value);
    return counted;
}

/**
 * What one dose closes on this body: up to its potency, worst first, where its
 * grade reaches. The triage `consume_pill` runs for the player.
 */
export function whatOneDoseCloses(
    pill: Pill,
    injuries: readonly Injury[],
    realmOrdinal: number
): { injuries: Injury[]; closed: Injury[] } {
    const done = treatWorstInjuries(
        injuries, Math.max(1, Math.round(pill.potency)),
        severity => medicineReaches(pill.grade, severity, realmOrdinal));
    return { injuries: done.injuries, closed: done.injuries.filter((w, i) => w.treated && !injuries[i]!.treated) };
}

export interface Standing { rankIndex: number; realmOrdinal: number }

/** Negative where `a` is seen to before `b`: higher rank, then higher rung. */
export function seenToBefore(a: Standing, b: Standing): number {
    return (b.rankIndex - a.rankIndex) || (b.realmOrdinal - a.realmOrdinal);
}

export function standingOf(npc: NpcRecord): Standing {
    return { rankIndex: npc.factionRankIndex, realmOrdinal: npc.cultivation.realmOrdinal };
}

/** Contribution a house charges one of its own for a dose. See the header. */
export function whatTheShelfChargesAMember(pill: Pill): number {
    return Math.max(1, Math.round(pill.value * contributionPerStoneOverDays(ORDINARY_DUTY_DAYS)));
}

// ─────────────────────────────────────────────────────────────────────────
// THE WORLD'S OWN
// ─────────────────────────────────────────────────────────────────────────

/** A year's doses off the shelf for one of the house's own. Takes them off the count. */
export function seeToThemFromTheShelf(
    house: Shelved,
    npc: NpcRecord
): { injuries: Injury[]; doses: number; closed: number } {
    let injuries = npc.cultivation.injuries;
    let doses = 0;
    let closed = 0;
    for (const pill of countedWoundMedicine()) {
        while (onTheShelf(house, pill.id) > 0) {
            const dose = whatOneDoseCloses(pill, injuries, npc.cultivation.realmOrdinal);
            if (dose.closed.length === 0) break;
            injuries = dose.injuries;
            takeOffTheShelf(house, pill.id);
            doses++;
            closed += dose.closed.length;
        }
    }
    return { injuries, doses, closed };
}

/** The wound medicine an unspent row is, or null. */
export function woundMedicineIn(row: ObjectRecord): Pill | null {
    if (row.kind !== 'pill' || row.possessorId === null || row.data?.spent === true) return null;
    const pill = getPill(String(row.data?.pillId ?? ''));
    return pill !== undefined && pill.effect === 'treat_injury' ? pill : null;
}

/** Indices into `objects` of unspent wound-medicine rows, by who holds them. Read once a year. */
export function woundMedicineByHolder(objects: readonly ObjectRecord[]): Map<string, number[]> {
    const out = new Map<string, number[]>();
    for (let i = 0; i < objects.length; i++) {
        const row = objects[i]!;
        if (woundMedicineIn(row) === null) continue;
        const at = out.get(row.possessorId!) ?? [];
        at.push(i);
        out.set(row.possessorId!, at);
    }
    return out;
}

/**
 * The rows somebody still carrying a wound swallows: their own first, then their
 * house's, cheapest first in each. Only a row that closes something is spent,
 * and the spent row replaces the held one in `state.objects`.
 */
export function swallowWhatTheyNeed(
    state: WorldState,
    held: ReadonlyMap<string, readonly number[]>,
    npc: NpcRecord,
    houseId: string | null,
    day: number
): { injuries: Injury[]; swallowed: number } {
    let injuries = npc.cultivation.injuries;
    let swallowed = 0;
    const byValue = (ids: readonly number[] | undefined): number[] => [...(ids ?? [])]
        .sort((a, b) => (woundMedicineIn(state.objects[a]!)?.value ?? 0) - (woundMedicineIn(state.objects[b]!)?.value ?? 0));
    for (const at of [...byValue(held.get(npc.id)), ...(houseId === null ? [] : byValue(held.get(houseId)))]) {
        const pill = woundMedicineIn(state.objects[at]!);
        if (pill === null) continue;
        const dose = whatOneDoseCloses(pill, injuries, npc.cultivation.realmOrdinal);
        if (dose.closed.length === 0) continue;
        injuries = dose.injuries;
        state.objects[at] = swallow(state.objects[at]!, npc.id, day);
        swallowed++;
    }
    return { injuries, swallowed };
}

// ─────────────────────────────────────────────────────────────────────────
// A MEMBER AT THE SEAT
// ─────────────────────────────────────────────────────────────────────────

export interface WhatTheShelfGives {
    doses: { pill: Pill; closed: Injury[] }[];
    /** Contribution the doses cost, in all. */
    contribution: number;
    /** Where nothing was given and the shelf held something that would have closed a wound. */
    withheld:
        | { why: 'contribution'; pill: Pill; price: number }
        | { why: 'kept'; pill: Pill; above: number }
        | null;
}

/** Wounded people of the house standing above this member whom one dose of this pill would close something on. */
function woundedAbove(state: WorldState, houseId: string, member: Standing & { id: string }, pill: Pill): number {
    let n = 0;
    for (const npc of state.npcs) {
        if (npc.factionId !== houseId || npc.status !== 'alive' || npc.id === member.id || !isTheWorldsToMove(npc)) continue;
        if (npc.cultivation.untreatedInjuries <= 0 || seenToBefore(standingOf(npc), member) >= 0) continue;
        if (whatOneDoseCloses(pill, npc.cultivation.injuries, npc.cultivation.realmOrdinal).closed.length > 0) n++;
    }
    return n;
}

/** What the house's shelf gives a member who asks at its seat. Pure: the caller takes the doses off. */
export function whatTheShelfGivesAMember(
    state: WorldState,
    input: {
        houseId: string;
        member: Standing & { id: string; injuries: readonly Injury[] };
        contribution: number;
    }
): WhatTheShelfGives {
    const out: WhatTheShelfGives = { doses: [], contribution: 0, withheld: null };
    const house = state.factions.find(f => f.id === input.houseId && f.dissolvedOnDay === null);
    if (house === undefined) return out;
    let injuries: readonly Injury[] = input.member.injuries;
    for (const pill of countedWoundMedicine()) {
        let taken = 0;
        let above: number | null = null;
        for (;;) {
            const left = onTheShelf(house, pill.id) - taken;
            if (left <= 0) break;
            const dose = whatOneDoseCloses(pill, injuries, input.member.realmOrdinal);
            if (dose.closed.length === 0) break;
            above ??= woundedAbove(state, house.id, input.member, pill);
            if (left <= above) {
                out.withheld ??= { why: 'kept', pill, above };
                break;
            }
            const price = whatTheShelfChargesAMember(pill);
            if (input.contribution - out.contribution < price) {
                out.withheld ??= { why: 'contribution', pill, price };
                break;
            }
            out.doses.push({ pill, closed: dose.closed });
            out.contribution += price;
            injuries = dose.injuries;
            taken++;
        }
    }
    if (out.doses.length > 0) out.withheld = null;
    return out;
}

// ─────────────────────────────────────────────────────────────────────────
// REFINING IT BACK
// ─────────────────────────────────────────────────────────────────────────

/** What a recipe's ingredients cost at catalog value, or null where one is not in the catalog. */
function ingredientBill(ingredients: readonly { itemId: string; quantity: number }[]): number | null {
    let bill = 0;
    for (const ing of ingredients) {
        const what = whatAnIngredientIs(ing.itemId);
        if (what === null) return null;
        bill += what.value * ing.quantity;
    }
    return bill;
}

export interface WhatWasRefined {
    batches: number;
    /** Pills that set and went on a shelf. */
    set: number;
    /** Stones spent on ingredients. */
    stones: number;
}

/** A year of houses refining their wound medicine back up to the shelf. See the header. */
export function housesRefineTheirWoundMedicine(state: WorldState, year: number): WhatWasRefined {
    const out: WhatWasRefined = { batches: 0, set: 0, stones: 0 };
    const bestHand = new Map<string, number>();
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId === null) continue;
        bestHand.set(npc.factionId, Math.max(bestHand.get(npc.factionId) ?? -1, npc.cultivation.realmOrdinal));
    }

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house)) continue;
        const hand = bestHand.get(house.id);
        if (hand === undefined) continue;
        const reach = theHeightAHouseWorksAt(house);
        const had = Number(house.resources.spirit_stones ?? 0);
        let purse = had;
        let rng: ReturnType<typeof forStream> | null = null;

        for (const pill of countedWoundMedicine()) {
            if (!canRefineGrade(pill.grade, hand)) continue;
            const want = theShelfAHouseKeeps(reach, pill) - onTheShelf(house, pill.id);
            if (want <= 0) continue;
            const recipe = getRecipesForPill(pill.id)[0];
            const bill = recipe ? ingredientBill(recipe.ingredients) : null;
            if (!recipe || bill === null || bill <= 0) continue;
            rng ??= forStream(state.seed, 'a-house-refines-wound-medicine', house.id, year);
            let made = 0;
            while (made < want && purse >= bill) {
                purse -= bill;
                out.batches++;
                out.stones += bill;
                if (rng.chance(recipe.baseSuccessRate)) made++;
            }
            if (made > 0) house.resources[pillStockKey(pill.id)] = onTheShelf(house, pill.id) + made;
            out.set += made;
        }
        if (purse !== had) house.resources.spirit_stones = purse;
    }
    return out;
}
