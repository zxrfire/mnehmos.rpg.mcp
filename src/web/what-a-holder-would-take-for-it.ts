/**
 * THE WORLD READING BEHIND "WHAT'S YOUR PRICE".
 *
 * `engine/social-leverage/what-somebody-would-take-for-a-thing-they-will-not-
 * sell.ts` is the arithmetic and is pure. This is the half that goes and looks:
 * what the thing is, who is holding one, what the holder's need does to it, and
 * what the player is actually carrying that could answer it.
 *
 * ── WHY THE HOLDER IS USUALLY A HOUSE AND THE ANSWER COMES FROM A PERSON ─
 *
 * `seedPillStock` puts barter pills on FACTIONS - one `ObjectRecord` each, on
 * any house working near the band the thing is pitched at - because that is
 * what a barter pill is: a thing a house is sitting on, with a provenance and a
 * reason it has not been sold. Nobody carries one in a pocket.
 *
 * So a player asking a person their price is asking somebody who speaks for a
 * shelf they do not personally own, and both facts matter. The OBJECT is the
 * house's, which is why the reading starts at `party.factionId`. The DECISION
 * is the person's, which is why the need read is theirs and why
 * `openHandednessOf` still moves the odds - a generous elder of a tight-fisted
 * house and a grasping one of a generous house answer differently, and they
 * should.
 *
 * ── HOW WHAT THE PLAYER PUTS DOWN IS PRICED, WITHOUT A LIST ──────────────
 *
 * One question, asked of whatever was named: **how high does it carry the
 * person receiving it?** Three readings answer it and the third is the one that
 * keeps the medium open:
 *
 *   AN ART THEY LACK       the rung its grade is pitched at. A road is worth
 *                          where it goes.
 *   A THING                the same, off the catalog or off the object row.
 *   ANYTHING ELSE          **what the person offering it is worth.** An oath, a
 *                          service, a name, a placement, information, a favour
 *                          owed - the engine cannot price any of those from a
 *                          catalog and does not need to, because what backs an
 *                          undertaking is the person making it. `items.md` says
 *                          this outright: *"an obligation from somebody at a
 *                          height your house cannot reach is worth more than
 *                          any price."*
 *
 * That third reading is the reason there is no table of media anywhere in
 * either module. A tenth medium needs no code: it is priced at the offerer's
 * own height, which is the truthful answer for anything the world has no row
 * for, and it has the shape the setting wants - a nobody's promise is worth
 * nothing and an immortal's is worth everything, with no rule about promises.
 *
 * ── AND MONEY IS PRICED AT NOTHING, WHICH IS NOT THE SAME AS REFUSED ─────
 *
 * A naked sum is the one thing marked as not singular, so it contributes zero
 * to the bar however large it is. `items.md`: above the line cash *"is simply
 * not the medium. Not 'expensive' - not for sale."* The player may still make
 * the offer and still gets an answer; what they do not get is a number that
 * counts. The resolver prices the purse separately through `purseWeight`, which
 * saturates and is damped by `PURSE_REACH`, so the two say the same thing about
 * the same line in two places without either being a special case.
 */

import { PILLS } from '../data/cultivation/pills.js';
import { TECHNIQUES } from '../data/cultivation/techniques.js';
import { pillBandOrdinal } from '../engine/cultivation/breakthrough.js';
import { pillTradeTier } from '../engine/cultivation/buying-and-bartering-pills.js';
import { significanceOfPill } from '../engine/world/where-the-pills-actually-are.js';
import type { ObjectRecord } from '../engine/world/possessions.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { OnTheTable } from '../engine/social-leverage/what-somebody-would-take-for-a-thing-they-will-not-sell.js';
import type { ATrackedThing } from '../engine/world/what-an-open-need-does-to-an-ask-and-to-a-price.js';
import type { Pill } from '../schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────
// WHAT WAS ASKED FOR
// ─────────────────────────────────────────────────────────────────────────

/** A thing somebody could be asked their price for, resolved off the catalog. */
export interface TheThingAskedFor {
    name: string;
    /** How high it carries whoever ends up with it. The asking price's unit. */
    carriesTo: number;
    /** The counted/tracked line, which decides whether a need can attach at all. */
    tracked: ATrackedThing;
    /**
     * Whether money buys one at all.
     *
     * False is what makes this verb the right one. Where it is TRUE the player
     * should be sent to a counter rather than into a negotiation, and the
     * caller says so - a barter verb aimed at a sixty-stone pill would be the
     * game making something harder than it is.
     */
    pastTheCashLine: boolean;
}

/**
 * The thing a price is being asked for, off the catalogs that already answer.
 *
 * Deliberately fuzzy-free: the caller has already resolved the name through
 * `resolvePill`, which is the one place a pill name is matched, and hands the
 * id in. Two matchers for one catalog is how two readers come to disagree about
 * which pill somebody meant.
 */
export function theThingAskedFor(pillId: string): TheThingAskedFor | null {
    const pill = PILLS.find(p => p.id === pillId);
    if (!pill) return null;
    return describePill(pill);
}

function describePill(pill: Pill): TheThingAskedFor {
    const band = pillBandOrdinal(pill.grade);
    return {
        name: pill.name,
        carriesTo: band,
        tracked: { significance: significanceOfPill(pill), forOrdinal: band },
        pastTheCashLine: pillTradeTier(pill) !== 'commodity'
    };
}

// ─────────────────────────────────────────────────────────────────────────
// WHO IS HOLDING ONE
// ─────────────────────────────────────────────────────────────────────────

/**
 * The row for one of these on this person's house shelf, or null.
 *
 * Reads `state.objects`, which is the one possessions table - the artifacts,
 * the manuals, the repair doses and the barter pills are all in it, and a
 * second store for any of them is the mistake `items.md` names. `spent` rows
 * are skipped: a swallowed pill leaves its record behind precisely so somebody
 * can ask about it later, and that record is not stock.
 */
export function heldByTheirHouse(
    world: WorldState | null,
    factionId: string | null,
    pillId: string
): ObjectRecord | null {
    if (!world || !factionId) return null;
    return world.objects.find(o =>
        o.kind === 'pill'
        && o.data?.pillId === pillId
        && o.data?.spent !== true
        && (o.possessorId === factionId || o.ownerId === factionId)) ?? null;
}

/**
 * How high the house behind this person can reach.
 *
 * The same field `seedPillStock` and `whyNotSold` both read, so what "above
 * their own head" means is one fact rather than three conventions.
 */
export function howHighTheirHouseReaches(
    world: WorldState | null,
    factionId: string | null
): number {
    if (!world || !factionId) return 0;
    const house = world.factions.find(f => f.id === factionId);
    if (!house) return 0;
    return Number(house.resources.reliable_ordinal ?? house.resources.power_ordinal ?? 0);
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PLAYER HAS PUT DOWN
// ─────────────────────────────────────────────────────────────────────────

/** A naked sum, in either of the two ways somebody writes one. */
const A_SUM_OF_STONES = /^\s*(?:about\s+|around\s+)?\d[\d,]*\s*(?:spirit\s+)?stones?\s*$/i;

/**
 * What one named offer is worth to the person it is being made to.
 *
 * THE WHOLE OF THE PRICING, AND THERE IS NO TABLE IN IT. See the header: an
 * art or a thing is worth where it carries somebody, and everything else is
 * worth what the person offering it is worth.
 *
 * `theirs` is what they already hold, so an art they have is worth nothing to
 * them - which is a fact about the trade and not a rule about arts, and it is
 * the same reading `whatTheyWantThatYouCouldReach` does when it asks whether
 * the asker holds a road they have not.
 */
export function whatIsBeingPutDown(
    named: string,
    offererOrdinal: number,
    theirs: readonly string[]
): OnTheTable {
    const what = named.trim().slice(0, 100);

    // Money, named as money. Priced at nothing here and priced properly by
    // `purseWeight` in the resolver. See the header.
    if (A_SUM_OF_STONES.test(what)) {
        return { what, carriesThemTo: 0, singular: false };
    }

    const held = new Set(theirs);
    const art = TECHNIQUES.find(t =>
        t.name.toLowerCase() === what.toLowerCase()
        || t.name.toLowerCase().includes(what.toLowerCase()));
    if (art) {
        // The same grade-to-rung map the pill side uses, so a road and a
        // medicine of the same grade are worth the same height to the same
        // person. Nothing to them if they already walk it.
        return {
            what: art.name,
            carriesThemTo: held.has(art.id) ? 0 : pillBandOrdinal(art.grade),
            singular: true
        };
    }

    const pill = PILLS.find(p =>
        p.name.toLowerCase() === what.toLowerCase()
        || p.name.toLowerCase().includes(what.toLowerCase()));
    if (pill) {
        return { what: pill.name, carriesThemTo: pillBandOrdinal(pill.grade), singular: true };
    }

    // ── EVERYTHING ELSE, WHICH IS WHERE THE MEDIUM STAYS OPEN ────────────
    //
    // An oath, a service, a placement, a name, information, a favour owed. The
    // engine has no row for any of them and does not need one: what backs an
    // undertaking is the person making it, so it is worth exactly what they
    // are worth. A tenth medium needs no code here.
    return { what, carriesThemTo: Math.max(0, offererOrdinal), singular: true };
}
