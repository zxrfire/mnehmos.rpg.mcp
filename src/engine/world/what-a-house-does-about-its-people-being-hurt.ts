/**
 * Wounds close, and who closes them says what a house is for.
 *
 * NOTHING IN THIS WORLD HEALED ANYBODY. `treated: true` is written in one file,
 * `injuries.ts`, and reached from exactly two places: the player's own alchemy,
 * and `origin-odds.ts`, which is a closed-form life model rather than a living
 * world. The one repair a yearly pass could do was `clearBrokenStatus` on a
 * crossing that succeeded. So `untreatedInjuries` was a ratchet: a wound taken
 * in year twelve was still open in year five thousand, and the Hollow Court
 * looked in on the same man at Burnt Earth a dozen times across a century,
 * finding the same single untreated wound every time.
 *
 * That was tolerable while a wound was only a number in a report. It stopped
 * being tolerable when `elder_died` was cut back to two causes and a wound
 * became one of them: a state nobody could leave had become a death sentence
 * nobody could escape, and "an old wound" described a growing share of the
 * world rather than naming anything. Measured on `afford-a` at five thousand
 * years before this file existed: **15.5 deaths a century in the middle band
 * from a wound that never closed**, the third largest killer there.
 *
 * ── WHAT CLOSES A WOUND, AND WHAT DOES NOT ───────────────────────────────
 *
 *   the house's medicine      counted wound pills off its own shelf first, then
 *                             a row it holds, which is spent only where the
 *                             shelf and the purse closed nothing
 *                             (`house-wound-medicine.ts`).
 *   a house sees to its own   the purse pays at `injuryTreatmentPrice`, the
 *                             figure the closed-form model already charges, and
 *                             the medicine it can source is what its own height
 *                             implies (`realmFloor` off `power_ordinal`). Worst
 *                             first, while the stones last.
 *   time and ordinary care    a minor wound mostly closes on its own inside a
 *                             year; a serious one rarely does. Nobody has to pay
 *                             for this and nobody has to be anywhere.
 *   nothing at all            the permanent family. `isPermanentWound` already
 *                             refuses them triage, and this file never picks
 *                             them up: a severed meridian is the genre's own
 *                             fixture and the one wound that should still be
 *                             carried at five thousand years.
 *
 * ── AND WHO STAYS MAIMED ─────────────────────────────────────────────────
 *
 * Whoever has nobody behind them. Somebody on a roll is seen to while their
 * house can pay; somebody on no roll gets time and their own constitution, and
 * a serious wound they cannot treat is a serious wound they keep. That is the
 * same world the rest of this work describes - what a house is FOR is the thing
 * a rogue does without - and it falls out of who is standing behind whom rather
 * than being written as a rule about rogues.
 *
 * UNMEASURED. The figure to take afterwards is the one above: deaths a century
 * in the middle band from a wound that never closed. **It was 15.5 and the next
 * number is not comparable to it** - 15.5 was a ratchet counting every wound the
 * world had ever handed out, and what replaces it is a rate.
 */

import { treatWorstInjuries, untreatedInjuryCount } from '../cultivation/injuries.js';
import {
    housesRefineTheirWoundMedicine,
    seenToBefore,
    seeToThemFromTheShelf,
    standingOf,
    swallowWhatTheyNeed,
    woundMedicineByHolder
} from './house-wound-medicine.js';
import { isPermanentWound } from '../../data/cultivation/wounds.js';
import { injuryTreatmentPrice } from '../cultivation/origin.js';
import { medicineReaches, realmFloor } from '../cultivation/what-grade-of-medicine-a-wound-needs.js';
import { forStream } from '../cultivation/rng.js';
import { isBelowTheLid } from './layers.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

/**
 * How often a minor wound closes in a year with nothing but time and whatever
 * care is to hand.
 *
 * Most of them. A cultivator's body is the thing the whole ladder is about, and
 * a graze that never closed would be a stranger claim than one that did.
 */
export const A_MINOR_WOUND_CLOSES_AT = 0.35;

/**
 * And how often a serious one does, with nobody treating it.
 *
 * Rarely, which is what makes a house worth being in. This is the rate that
 * decides how much of the world limps.
 */
export const A_SERIOUS_WOUND_CLOSES_ALONE_AT = 0.04;

/** What a house spends to see to one wound on somebody standing at this rung. */
export function whatSeeingToThemCosts(ordinal: number): number {
    return injuryTreatmentPrice(ordinal);
}

/** What this year's care came to. */
export interface WhatCareCameTo {
    /** Wounds a house paid to close. */
    seenTo: number;
    /** Wounds that closed on their own. */
    closedOnTheirOwn: number;
    /** Stones the houses spent doing it. */
    spent: number;
    /** Wounds closed by doses off a house's shelf, and the doses. */
    fromTheShelf: number;
    dosesFromTheShelf: number;
    /** Wound-medicine rows swallowed. */
    swallowed: number;
    /** Doses refined back onto shelves, and the stones the ingredients cost. */
    refined: number;
    spentRefining: number;
}

/** The row with these injuries on it, and the count kept honest. */
function carrying(npc: NpcRecord, injuries: readonly { treated: boolean }[]): NpcRecord {
    return {
        ...npc,
        cultivation: {
            ...npc.cultivation,
            injuries: injuries as NpcRecord['cultivation']['injuries'],
            untreatedInjuries: untreatedInjuryCount(injuries as NpcRecord['cultivation']['injuries'])
        }
    };
}

/**
 * A year of it: the houses see to their own, and time closes what it can for
 * everybody else.
 *
 * One pass rather than two, because the order matters - a house pays first, and
 * what it could not reach is what time is left to work on.
 */
export function woundsCloseThisYear(state: WorldState, year: number, day: number): WhatCareCameTo {
    const out: WhatCareCameTo = {
        seenTo: 0, closedOnTheirOwn: 0, spent: 0,
        fromTheShelf: 0, dosesFromTheShelf: 0, swallowed: 0, refined: 0, spentRefining: 0
    };

    // ── WHAT A HOUSE CAN BRING, ONCE, FOR ALL OF ITS OWN ─────────────────
    const reachOf = new Map<string, ReturnType<typeof realmFloor>>();
    const purse = new Map<string, number>();
    const shelfOf = new Map<string, { resources: Record<string, number> }>();
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || !isBelowTheLid(house)) continue;
        reachOf.set(house.id, realmFloor(Number(house.resources.power_ordinal ?? 0)));
        purse.set(house.id, Number(house.resources.spirit_stones ?? 0));
        shelfOf.set(house.id, house);
    }
    const rowsHeld = woundMedicineByHolder(state.objects);

    // IN ORDER OF STANDING, so a house's last dose and last stones go to its
    // elder before its outer disciple. See `seenToBefore`.
    const order: number[] = [];
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (npc.status !== 'alive' || !isTheWorldsToMove(npc)) continue;
        const injuries = npc.cultivation.injuries;
        if (injuries.length === 0 || npc.cultivation.untreatedInjuries <= 0) continue;
        // Nothing here ever touches the permanent family.
        if (!injuries.some(inj => !inj.treated && !isPermanentWound(inj.woundType))) continue;
        order.push(i);
    }
    order.sort((a, b) => seenToBefore(standingOf(state.npcs[a]!), standingOf(state.npcs[b]!)) || a - b);

    for (const i of order) {
        const npc = state.npcs[i]!;
        let row = npc;
        const houseId = npc.factionId;

        // ── THE HOUSE'S OWN MEDICINE FIRST ───────────────────────────────
        const shelf = houseId === null ? undefined : shelfOf.get(houseId);
        if (shelf !== undefined) {
            const dosed = seeToThemFromTheShelf(shelf, row);
            if (dosed.closed > 0) {
                row = carrying(row, dosed.injuries);
                out.fromTheShelf += dosed.closed;
                out.dosesFromTheShelf += dosed.doses;
            }
        }

        // ── THE HOUSE PAYS, WHILE IT CAN ─────────────────────────────────
        if (houseId !== null && purse.has(houseId)) {
            const grade = reachOf.get(houseId)!;
            const price = whatSeeingToThemCosts(npc.cultivation.realmOrdinal);
            const stones = purse.get(houseId)!;
            const affordable = price <= 0 ? 0 : Math.floor(stones / price);
            if (affordable > 0) {
                const done = treatWorstInjuries(
                    row.cultivation.injuries, affordable,
                    severity => medicineReaches(grade, severity, npc.cultivation.realmOrdinal));
                if (done.treatedCount > 0) {
                    row = carrying(row, done.injuries);
                    const cost = done.treatedCount * price;
                    purse.set(houseId, Math.max(0, stones - cost));
                    out.seenTo += done.treatedCount;
                    out.spent += cost;
                }
            }
        }

        // ── A ROW, ONLY FOR WHAT NOTHING ABOVE CLOSED ────────────────────
        if (row.cultivation.injuries.some(inj => !inj.treated && !isPermanentWound(inj.woundType))) {
            const swallowed = swallowWhatTheyNeed(
                state, rowsHeld, row, shelf !== undefined ? houseId : null, day);
            if (swallowed.swallowed > 0) {
                row = carrying(row, swallowed.injuries);
                out.swallowed += swallowed.swallowed;
            }
        }

        // ── AND TIME TAKES WHAT IT CAN OF THE REST ───────────────────────
        const rng = forStream(state.seed, 'a-wound-closes', npc.id, year);
        let closed = false;
        const after = row.cultivation.injuries.map(inj => {
            if (inj.treated || isPermanentWound(inj.woundType)) return inj;
            const chance = inj.severity === 'minor'
                ? A_MINOR_WOUND_CLOSES_AT
                : inj.severity === 'serious' ? A_SERIOUS_WOUND_CLOSES_ALONE_AT : 0;
            if (chance <= 0 || !rng.chance(chance)) return inj;
            closed = true;
            out.closedOnTheirOwn++;
            return { ...inj, treated: true };
        });
        if (closed) row = carrying(row, after);

        if (row !== npc) state.npcs[i] = { ...row, updatedOnDay: day };
    }

    // AND THE PURSE IS ACTUALLY LIGHTER. The stones were tracked in a map and
    // never written back in the first draft of this file, which would have made
    // the care free - the houses would have healed everybody for ever and the
    // one thing that decides who stays maimed would have decided nothing.
    for (const house of state.factions) {
        const left = purse.get(house.id);
        if (left === undefined) continue;
        if (left !== Number(house.resources.spirit_stones ?? 0)) {
            house.resources.spirit_stones = left;
        }
    }

    // And the houses refine back what they used, out of what the purse has left.
    const refined = housesRefineTheirWoundMedicine(state, year);
    out.refined = refined.set;
    out.spentRefining = refined.stones;

    return out;
}
