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
 * person receiving it?** Every reading below is the same question put to a
 * different catalog, and the last one is what keeps the medium open:
 *
 *   AN ART THEY LACK       the rung its grade is pitched at. A road is worth
 *                          where it goes.
 *   A MEDICINE             the same, off its grade.
 *   A THING THAT CAME DOWN the ceiling its grade permits, off the engine that
 *                          spends one. Read the grade and ask the ladder - the
 *                          same rule as everything above it, and the reason
 *                          there is no branch anywhere on what the object is
 *                          called.
 *   A RATED OBJECT         `power`, the one hierarchy of force in this world.
 *   ANYTHING ELSE          **what the person offering it is worth.** An oath, a
 *                          service, a name, a placement, information, a favour
 *                          owed - the engine cannot price any of those from a
 *                          catalog and does not need to, because what backs an
 *                          undertaking is the person making it. `items.md` says
 *                          this outright: *"an obligation from somebody at a
 *                          height your house cannot reach is worth more than
 *                          any price."*
 *
 * That last reading is the reason there is no table of media anywhere in
 * either module. A tenth medium needs no code: it is priced at the offerer's
 * own height, which is the truthful answer for anything the world has no row
 * for, and it has the shape the setting wants - a nobody's promise is worth
 * nothing and an immortal's is worth everything, with no rule about promises.
 *
 * **And it is only truthful where there is no row.** Everything above it was
 * once falling through to it, so a rated-45 blade and an Heaven-Ascending Golden Pill both
 * priced at the offerer's own rung - measured at 4, which is what *my
 * protection* also came to. A fallback that catches things the catalog does
 * answer for is the quiet kind of wrong: nothing fails, the offer is simply
 * worth what the person putting it down happens to be worth.
 *
 * ── AND THE ANSWER DEPENDS ON WHO IS RECEIVING IT ────────────────────────
 *
 * The field says *the person receiving it* and only the arts branch was
 * honouring that. A road somebody already walks carries them nowhere; a
 * medicine whose grade tops out beneath them carries them nowhere either, and
 * a better one carries them across their own wall. Same reading, one catalog
 * over - which is how *who they are decides what enough means* comes out of
 * rows rather than out of a branch on somebody's house.
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

import { ARTIFACTS } from '../data/cultivation/artifacts.js';
import { HERBS } from '../data/cultivation/herbs.js';
import {
    IMMORTAL_ITEMS,
    ImmortalGradeSchema,
    type ImmortalGrade
} from '../data/cultivation/immortal-items.js';
import { PILLS } from '../data/cultivation/pills.js';
import { TECHNIQUES } from '../data/cultivation/techniques.js';
import { pillBandOrdinal } from '../engine/cultivation/breakthrough.js';
import { REALM_TIERS, type RealmKey } from '../engine/cultivation/realms.js';
import { STEP_CEILING_BY_GRADE } from '../engine/cultivation/taking-the-heaven-ascending-golden-pill.js';
import { pillTradeTier } from '../engine/cultivation/buying-and-bartering-pills.js';
import { isCommonlyHeld, manualIdOf, significanceOfManual } from '../engine/world/manuals.js';
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
    /** The catalog row's own id, which is what the possessions table stores. */
    id: string;
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
 * ── ONE CATALOG WAS ASKED, AND THE OTHER DIRECTION ASKED FOUR ────────────
 *
 * This read used to open with `PILLS.find(...)` and return null for everything
 * else, so "ask Ru Yanzhi what she would take for The Hidden Edge" - an
 * ordinary power-rated row in `artifacts.ts` - came back "Nothing in the world
 * is called that a person would barter over", which is a false sentence about
 * the catalog. Every artifact, every volume and every manual answered the same
 * way. Meanwhile `whatIsBeingPutDown` below already prices all of them, so a
 * player could OFFER a rated blade and could not ASK for one.
 *
 * The question is the same in both directions and so is the arithmetic: how
 * high does the thing carry whoever ends up with it. `power` for an object,
 * the grade band for a medicine or an art, the grade's own ceiling for
 * something from above.
 *
 * The pill half stays id-first: the caller has already resolved the name
 * through `resolvePill`, which is the one place a pill name is matched, and
 * two matchers for one catalog is how two readers come to disagree about which
 * pill somebody meant. The other catalogs are matched here by name, exactly as
 * `whatIsBeingPutDown` matches them.
 */
export function theThingAskedFor(named: string, pillId: string | null): TheThingAskedFor | null {
    const pill = pillId === null ? null : PILLS.find(p => p.id === pillId);
    if (pill) return describePill(pill);

    const what = named.trim().slice(0, 100).toLowerCase();
    if (what.length < 3) return null;
    const alike = (name: string): boolean => {
        const bare = name.replace(/^the\s+/i, '').toLowerCase();
        return bare === what || bare.includes(what) || what.includes(bare);
    };

    // Something from above, priced off what its own grade permits. The grade is
    // said in front of the name - "a higher Heaven-Ascending Golden Pill" - so
    // the words decide which ceiling, the same reading `whatIsBeingPutDown`
    // takes.
    const fromAbove = IMMORTAL_ITEMS.find(item => alike(item.name));
    if (fromAbove) {
        const ceiling = firstRungOf(STEP_CEILING_BY_GRADE[gradeNamedIn(named)]);
        return {
            id: fromAbove.id,
            name: fromAbove.name,
            carriesTo: Math.max(0, ceiling),
            tracked: { significance: 'legendary', forOrdinal: Math.max(0, ceiling) },
            pastTheCashLine: true
        };
    }

    // A rated object. `power` is the one hierarchy of force in this world, and
    // a weapon lets its holder strike at its own rung.
    const object = ARTIFACTS.find(row => alike(row.name));
    if (object) {
        const power = Math.max(0, object.power ?? 0);
        return {
            id: object.id,
            name: object.name,
            carriesTo: power,
            tracked: { significance: object.significance, forOrdinal: power },
            // A mundane row is a KIND rather than an object - `seedArtifacts`
            // does not even put one in the world - so it is bought and not
            // bargained for, which is what the caller's cash-line branch says.
            pastTheCashLine: object.significance !== 'mundane'
        };
    }

    // A road, which carries whoever walks it exactly as far as its grade says.
    const art = TECHNIQUES.find(row => alike(row.name));
    if (art) {
        const band = pillBandOrdinal(art.grade);
        return {
            id: art.id,
            name: art.name,
            carriesTo: band,
            tracked: {
                significance: significanceOfManual(art.id, art.cap ?? band),
                forOrdinal: band
            },
            // A book four houses teach is stall stock. `isCommonlyHeld` is the
            // one place that is decided.
            pastTheCashLine: !isCommonlyHeld(art.id)
        };
    }

    return null;
}

function describePill(pill: Pill): TheThingAskedFor {
    const band = pillBandOrdinal(pill.grade);
    return {
        id: pill.id,
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
    thingId: string
): ObjectRecord | null {
    if (!world || !factionId) return null;
    return world.objects.find(o =>
        thisRowIs(o, thingId)
        && o.data?.spent !== true
        && (o.possessorId === factionId || o.ownerId === factionId)) ?? null;
}

/**
 * Whether this row is the thing with that id.
 *
 * Three conventions, because the one possessions table stores three kinds of
 * thing and each names its catalog row differently: an artifact keeps the
 * catalog id as its OWN id, a pill carries `data.pillId`, and a manual carries
 * `data.techniqueId` behind `manualIdOf`. This used to be `kind === 'pill'`
 * and nothing else, which is why asking after anything but a pill found no
 * holder even where the register listed one.
 */
export function thisRowIs(row: ObjectRecord, thingId: string): boolean {
    return row.id === thingId
        || row.data?.pillId === thingId
        || manualIdOf(row) === thingId;
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
 * Which grade of an immortal medicine was named, out of the words used.
 *
 * The catalog holds ONE row and three grades on it, and the pouch convention
 * `theUnearnedStepIn` reads is `immortal-heaven-ascending-golden-pill:lower`. A sentence has
 * neither, so the grade is read off the words the way `resolvePill` reads a
 * pill's name, and the default is the same default that convention takes: the
 * lower grade, which is nine of the thirteen in the world.
 */
function gradeNamedIn(what: string): ImmortalGrade {
    const said = what.toLowerCase();
    const parsed = ImmortalGradeSchema.safeParse(
        /\bhigher\b/.test(said) ? 'higher' : /\bmiddle\b/.test(said) ? 'middle' : 'lower'
    );
    return parsed.success ? parsed.data : 'lower';
}

/** The first rung of a realm, which is where anything that gives a crossing lands somebody. */
function firstRungOf(key: RealmKey): number {
    return REALM_TIERS.find(t => t.key === key)?.ordinalStart ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────
// WHICH CATALOG THE WORDS NAME
// ─────────────────────────────────────────────────────────────────────────

/**
 * What an offer names, once, so that both ends of the trade read the same row.
 *
 * The pricing below and the gate below THAT ask two different questions of the
 * same words - *what is this worth to them* and *is the player actually
 * carrying it* - and asking them of two separate matchers is how two readers
 * come to disagree about which thing somebody meant. `theThingAskedFor` says
 * the same thing about the pill half in its own words.
 *
 * The order is the order the pricing has always taken and must not be
 * rearranged: money, an art, a medicine, something from above, a rated object,
 * a herb, and then the open medium. A name that answers to two catalogs
 * belongs to the first of them, which is a rule about resolution rather than
 * about worth.
 */
export type TheOfferNamed =
    | { medium: 'stones'; what: string; stones: number }
    | { medium: 'an_art'; what: string; id: string; name: string }
    | { medium: 'a_medicine'; what: string; id: string; name: string }
    | { medium: 'from_above'; what: string; id: string; name: string; promotes: boolean }
    | { medium: 'a_thing'; what: string; id: string; name: string }
    | { medium: 'a_herb'; what: string; id: string; name: string }
    | { medium: 'an_undertaking'; what: string };

/** The same loose read every catalog branch here has always taken. */
function answersTo(name: string, what: string): boolean {
    const lowered = name.toLowerCase();
    const said = what.toLowerCase();
    return lowered === said || lowered.includes(said);
}

/** How many stones a sum names, for the purse it has to come out of. */
function howManyStones(what: string): number {
    const digits = what.replace(/[^0-9]/g, '');
    return digits.length === 0 ? 0 : Math.min(Number(digits), Number.MAX_SAFE_INTEGER);
}

export function whatTheOfferNames(named: string): TheOfferNamed {
    const what = named.trim().slice(0, 100);

    if (A_SUM_OF_STONES.test(what)) {
        return { medium: 'stones', what, stones: howManyStones(what) };
    }

    const art = TECHNIQUES.find(t => answersTo(t.name, what));
    if (art) return { medium: 'an_art', what, id: art.id, name: art.name };

    const pill = PILLS.find(p => answersTo(p.name, what));
    if (pill) return { medium: 'a_medicine', what, id: pill.id, name: pill.name };

    // Matched on the name without its article, because the grade is said in
    // front of it - "a higher Heaven-Ascending Golden Pill" is how anybody
    // names one, and the catalog row is called "The Heaven-Ascending Golden
    // Pill". Both directions of containment, which is how this has always read.
    const fromAbove = IMMORTAL_ITEMS.find(i => {
        const bare = i.name.replace(/^the\s+/i, '').toLowerCase();
        return what.toLowerCase().includes(bare) || bare.includes(what.toLowerCase());
    });
    if (fromAbove) {
        return {
            medium: 'from_above',
            what,
            id: fromAbove.id,
            name: fromAbove.name,
            // The talisman changes an aperture rather than a rung, so the
            // pricing has no unit for it and reads it as an undertaking. The
            // GATE still holds: a thing nobody can price is still a thing, and
            // still has to be in your hands before you can put it down.
            promotes: fromAbove.effect === 'promote_realm'
        };
    }

    const object = ARTIFACTS.find(o => answersTo(o.name, what));
    if (object) return { medium: 'a_thing', what, id: object.id, name: object.name };

    const herb = HERBS.find(h => answersTo(h.name, what));
    if (herb) return { medium: 'a_herb', what, id: herb.id, name: herb.name };

    return { medium: 'an_undertaking', what };
}

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
 *
 * ── AND THE FIELD SAYS "THE PERSON RECEIVING IT", SO ASK ABOUT THEM ──────
 *
 * `receiverOrdinal` completes a contract `OnTheTable.carriesThemTo` has stated
 * since it was written - *how high does it carry THE PERSON RECEIVING IT* - and
 * which only the arts branch was honouring. Without it every offer is priced in
 * the abstract, so the same object is worth the same to a village headman and
 * to somebody standing at the top of a realm, and the one question that decides
 * a barter-tier trade cannot tell them apart.
 *
 * It is optional because a caller that does not know who is receiving is still
 * entitled to the object's own height, which is the truthful answer to a
 * narrower question.
 */
export function whatIsBeingPutDown(
    named: string,
    offererOrdinal: number,
    theirs: readonly string[],
    receiverOrdinal?: number
): OnTheTable {
    const what = named.trim().slice(0, 100);
    const offer = whatTheOfferNames(what);

    // Money, named as money. Priced at nothing here and priced properly by
    // `purseWeight` in the resolver. See the header.
    if (offer.medium === 'stones') {
        return { what, carriesThemTo: 0, singular: false };
    }

    const held = new Set(theirs);
    if (offer.medium === 'an_art') {
        const art = TECHNIQUES.find(t => t.id === offer.id)!;
        // The same grade-to-rung map the pill side uses, so a road and a
        // medicine of the same grade are worth the same height to the same
        // person. Nothing to them if they already walk it.
        return {
            what: art.name,
            carriesThemTo: held.has(art.id) ? 0 : pillBandOrdinal(art.grade),
            singular: true
        };
    }

    if (offer.medium === 'a_medicine') {
        const pill = PILLS.find(p => p.id === offer.id)!;
        return { what: pill.name, carriesThemTo: pillBandOrdinal(pill.grade), singular: true };
    }

    // ── A THING THAT CAME DOWN, PRICED THE WAY EVERY OTHER THING IS ──────
    //
    // Read the grade and ask the ladder, which is the same rule the pill and
    // the art take and the same rule that decides what a shattered blade is
    // worth. There is no branch on the object's name and no figure written
    // beside it: what an immortal medicine carries somebody to is the ceiling
    // its own grade permits, and the ceiling is `STEP_CEILING_BY_GRADE` in the
    // engine that spends one - read, never restated.
    //
    // Before this, `The Heaven-Ascending Golden Pill` fell through to the clause below and
    // priced at the offerer's own rung. Measured at a rung-4 offerer: 4, which
    // is what `my protection` also came to. The most valuable object in the
    // world and a vague promise were the same offer, so no offer of one could
    // ever move a refusal - which is the whole of what an immortal medicine is
    // for in a negotiation.
    // Matched on the name without its article, because the grade is said in
    // front of it - "a higher Heaven-Ascending Golden Pill" is how anybody names one, and the
    // catalog row is called "The Heaven-Ascending Golden Pill".
    if (offer.medium === 'from_above' && offer.promotes) {
        const fromAbove = IMMORTAL_ITEMS.find(i => i.id === offer.id)!;
        const ceiling = firstRungOf(STEP_CEILING_BY_GRADE[gradeNamedIn(what)]);
        // What it does is one crossing, so the most it can put anybody on is
        // the first rung of the realm above theirs - and never past what the
        // grade allows. Somebody already standing at or above that ceiling is
        // being offered something that cannot move them, which is a fact about
        // this trade rather than about the object, and is the same reading as
        // an art they already walk.
        const reachable = receiverOrdinal === undefined
            ? ceiling
            : Math.min(ceiling, firstRungOf(realmAbove(receiverOrdinal)));
        return {
            what: fromAbove.name,
            carriesThemTo: receiverOrdinal !== undefined && reachable <= receiverOrdinal
                ? 0
                : Math.max(0, reachable),
            singular: true
        };
    }

    // ── A RATED OBJECT, OFF THE FIELD EVERY RATED OBJECT ALREADY CARRIES ──
    //
    // `power` is the one hierarchy of force in this world, and a blade rated 45
    // put on a table was reading as the offerer's own rung for the same reason
    // the Step was: nothing looked in the object catalog. A weapon lets its
    // holder strike at its own rung, so that rung is exactly how high it
    // carries whoever ends up with it.
    if (offer.medium === 'a_thing') {
        const object = ARTIFACTS.find(o => o.id === offer.id)!;
        return {
            what: object.name,
            carriesThemTo: Math.max(0, object.power ?? 0),
            singular: true
        };
    }

    // ── EVERYTHING ELSE, WHICH IS WHERE THE MEDIUM STAYS OPEN ────────────
    //
    // An oath, a service, a placement, a name, information, a favour owed - and
    // a Root-Recasting Talisman, which changes an aperture rather than a rung and which
    // this world therefore has no unit for. What backs an undertaking is the
    // person making it, so it is worth exactly what they are worth. A tenth
    // medium needs no code here.
    //
    // A HERB LANDS HERE TOO, and that is the reading it has always had: the
    // catalog is read for the gate rather than for a price, because what a
    // player is carrying by the handful is not what a barter-tier trade turns
    // on. Priced at the offerer's own height, exactly as before this branch
    // existed.
    return { what, carriesThemTo: Math.max(0, offererOrdinal), singular: true };
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHETHER THE PLAYER IS ACTUALLY CARRYING IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * THE SAME READ AS `heldByTheirHouse`, WITH THE SIDES SWAPPED.
 *
 * The holder's end of a barter has been bound to the world since it was
 * written: `heldByTheirHouse` goes and looks for an unspent row on their shelf
 * and refuses when there is not one, naming who else in the province is
 * holding one. The PLAYER's end was a string. Whatever was typed was priced
 * against four catalogs, nothing asked whether they had it, and the branch
 * that closed the trade took nothing off them.
 *
 * So the sentence *"I offer him the Heaven-Ascending Golden Pill"* - typed by
 * somebody who has never seen one - priced at the ceiling of the grade named,
 * cleared almost any bar in the world, moved a tracked object onto the player,
 * and wrote a provenance line saying what it was given for. Nothing was spent.
 * That is not a hard trade or an easy one; it is not a trade.
 *
 * ── WHERE A PLAYER'S THINGS ACTUALLY LIVE, WHICH IS FOUR PLACES ──────────
 *
 * `items.md` keeps three tiers and the purse is beside them, so the read has
 * to ask all four and there is no fifth:
 *
 *   THE PURSE     `spiritStones`, a number.
 *   COUNTED STOCK the pouch: pills, herbs, rated objects bought by the lot.
 *   A TRACKED ROW `state.objects` with the player as possessor - a blade taken
 *                 off a corpse, a thing lifted, a thing bartered for. This is
 *                 the tier the genre's best trades run on and the one a player
 *                 could not previously put on a table at all.
 *   AN ART        walked or held as a copy. It does not leave you when you give
 *                 it: what changes hands is the teaching, and the teacher still
 *                 knows the art afterwards. The gate is that you cannot pass on
 *                 a road you have never walked.
 *
 * What is NOT gated is the open medium - an oath, a service, a name, a
 * placement, information. Nobody carries an undertaking, so there is nothing to
 * look for, and the pricing already answers it honestly: it is worth what the
 * person making it is worth. A refusal there would close the one branch that
 * keeps the medium open.
 */
export type TheOfferHeld =
    | { holds: true; medium: 'stones' }
    | { holds: true; medium: 'an_undertaking' }
    | { holds: true; medium: 'an_art'; id: string; name: string }
    | {
        holds: true;
        medium: 'a_thing';
        id: string;
        name: string;
        /** The pouch lot to decrement when the trade lands, or null. */
        counted: HeldStack | null;
        /** The world row to move when the trade lands, or null. */
        tracked: ObjectRecord | null;
    }
    | { holds: false; name: string; why: WhyItIsNotYours };

/** Which of the four places was asked, and came back empty. */
export type WhyItIsNotYours = 'not_in_your_hands' | 'you_do_not_walk_it';

/** One lot of counted stock, as the pouch keeps it. */
export interface HeldStack {
    itemId: string;
    kind: string;
    quantity: number;
}

/** The four places, gathered by the caller because three of them want a handle. */
export interface WhatYouAreCarrying {
    stones: number;
    pouch: readonly HeldStack[];
    /** Ids of the arts walked or held as a copy. */
    artIds: readonly string[];
    /** Unspent rows in `state.objects` this player is the possessor of. */
    rows: readonly ObjectRecord[];
}

/**
 * What a held row is called, going the other way down the same catalogs.
 *
 * `nameOfStack` covers the two kinds an inheritance moves and reads as a pill
 * for anything else, which would put a blade's name in a list of medicines. A
 * refusal that lists what somebody IS carrying has to be right about all three
 * kinds, so it asks here. The grade suffix is stripped first: the pouch stores
 * an immortal medicine as `<id>:<grade>` and nobody says the grade twice.
 */
export function nameOfHeld(itemId: string): string {
    const bare = itemId.split(':')[0] ?? itemId;
    return PILLS.find(p => p.id === bare)?.name
        ?? HERBS.find(h => h.id === bare)?.name
        ?? ARTIFACTS.find(a => a.id === bare)?.name
        ?? IMMORTAL_ITEMS.find(i => i.id === bare)?.name
        ?? itemId;
}

export function heldByYou(named: string, carrying: WhatYouAreCarrying): TheOfferHeld {
    const offer = whatTheOfferNames(named);

    if (offer.medium === 'an_undertaking') return { holds: true, medium: 'an_undertaking' };

    // ── AND MONEY IS NOT GATED, FOR THE REASON IT IS NOT PRICED ──────────
    //
    // A sum on a barter table contributes nothing to the bar however large it
    // is, because above the cash line money is not the medium - the header
    // says it at length and `items.md` says it outright. So there is no free
    // lunch here to close: an offer of stones nobody has buys exactly what an
    // offer of stones somebody has buys, which is nothing.
    //
    // Refusing it on the purse would replace a good answer with a worse one.
    // The good answer is the one this verb already gives: the sum is worth
    // nothing, and *name what you have, not what you can pay*. A player told
    // instead that they cannot afford it has been told something false about
    // why - affording it would not have helped.
    if (offer.medium === 'stones') return { holds: true, medium: 'stones' };

    if (offer.medium === 'an_art') {
        return carrying.artIds.includes(offer.id)
            ? { holds: true, medium: 'an_art', id: offer.id, name: offer.name }
            : { holds: false, name: offer.name, why: 'you_do_not_walk_it' };
    }

    // A thing, in either tier or both. A pill bartered for has a pouch entry
    // AND a row - the pouch entry is what `consume_pill` spends and the row is
    // the world's record of which one this is - so both move, and finding
    // either is enough to say it is in your hands.
    // The pouch stores an immortal medicine as `<id>:<grade>` - the convention
    // `theUnearnedStepIn` reads - because the catalog holds one row and three
    // grades on it. Any grade of one is one of them.
    const counted = carrying.pouch.find(
        lot => lot.quantity > 0
            && (lot.itemId === offer.id || lot.itemId.startsWith(`${offer.id}:`))
    ) ?? null;
    const tracked = carrying.rows.find(
        row => thisRowIs(row, offer.id) && row.data?.spent !== true
    ) ?? null;
    if (counted === null && tracked === null) {
        return { holds: false, name: offer.name, why: 'not_in_your_hands' };
    }
    return { holds: true, medium: 'a_thing', id: offer.id, name: offer.name, counted, tracked };
}

/** The realm on the far side of the wall above somebody. Theirs, at the top. */
function realmAbove(ordinal: number): RealmKey {
    const here = REALM_TIERS.findIndex(t => ordinal >= t.ordinalStart && ordinal <= t.ordinalEnd);
    if (here < 0) return REALM_TIERS[0].key;
    return (REALM_TIERS[here + 1] ?? REALM_TIERS[here]).key;
}
