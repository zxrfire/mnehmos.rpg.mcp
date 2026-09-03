/**
 * What a war between two houses does to the things they own.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE ABSENCE THIS CLOSES
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Measured on this tree before this file existed: `war_opened` tagged both
 * houses `at_war`, moved their standing by -0.3, and scheduled a settlement two
 * to twenty-five years out. `settleWarsThatAreOver` took the tag off again.
 * BETWEEN THOSE TWO EVENTS THE WAR TOUCHED NOTHING PHYSICAL AT ALL. A house
 * came out of a twenty-five year war holding every object it went in with, and
 * the whole of what a war cost anybody was a number on a standing map.
 *
 * The engine already knew how to break a thing - `whether-a-weapon-survives-
 * being-used.ts` has priced it since it was written - and the only reason a
 * spirit boat could not be broken was that nothing in the world had ever
 * ASKED. `object-damage.ts` is the ask, and this file is the caller that makes
 * it a thing that happens rather than a function that exists.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE KNOWS WHAT A SPIRIT BOAT IS
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The design owner's ruling, asked how boats come apart in a war between
 * sects: *no bespoke logic, the same way that a sword breaks.* So the things
 * this pass puts at risk are drawn by ONE predicate - the house owns it and it
 * is rated on the ladder - and every one of them goes through the same call.
 * A hull, a sect's ancestral blade, a formation plate over a gate and a
 * carriage in the yard are candidates on identical terms, and which of them
 * happens to be reached is a draw rather than a rule.
 *
 * Grep this file for `conveyance`, `boat` or `kind`. It is not here, and
 * `ThingUnderForce` is why it cannot be.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHEN A WAR BECOMES A GROUP FIGHT, THIS PASS MUST GO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * READ THIS BEFORE BUILDING THE WAR FIGHT. Ruled by the design owner, a war
 * *can be easily simulated as a group fight*, and `resolveMelee` in
 * `engine/cultivation/combat.ts` already resolves one between any number of
 * sides. The day something enters it with a roster on each side, THIS PASS IS A
 * SECOND WAY THINGS BREAK IN A WAR AND HAS TO BE DELETED RATHER THAN LEFT
 * RUNNING BESIDE IT.
 *
 * It will not announce itself, which is why it is written here rather than
 * hoped about. `MeleeResult.exchanges` already carries `result.weapon` on every
 * strike - its own header says a caller reads breakages off that list rather
 * than off a second field - so a melee ALREADY breaks the things the people in
 * it are carrying, through the same `object-damage.ts` call this file makes. A
 * war that ran both would break a house's things twice a year by two routes,
 * and the second route is this one: a party drawn off a roster, standing in for
 * a fight nobody was simulating.
 *
 * THAT IS THE WHOLE REASON THIS FILE EXISTS AND IT IS AN INTERIM. Nothing in
 * the world fought a war, so nothing in the world could break anything in one,
 * and a raid drawn once a year was the honest floor under that absence. It is
 * not a model of a war. Delete it when there is one, keep `war-spoils.ts`,
 * which is about the SETTLEMENT and is not a fight at all.
 *
 * One thing to carry across when you do: `MeleeResult` says *no caller in `src/`
 * builds a melee with a weapon in it yet*, so the war fight would be the first,
 * and the re-pricing that happens when somebody's object goes mid-fight has
 * never run in play. Check it against `ratedThingsOwnedBy` below - what a person
 * carries out of the gate is exactly what should be in their hands in the melee.
 *
 * And one trap, because it is the shape a fight invites. WRITE THE SUMMARY FROM
 * WHAT THE RESOLVER RETURNED, NEVER FROM WHAT YOU EXPECTED IT TO. A melee has
 * three endings the caller does not choose - `stalemate` when nobody broke
 * inside the budget, `no_contest` when the gap made it not a fight, and a
 * winner - and a house's summary composed from the inputs will confidently
 * narrate a defeat that did not happen. That exact defect went onto the
 * permanent record from this file: see `settleOneWar`, where twenty-two facts
 * said a house had broken up while the code had handed its hold to the winner
 * intact, and only a pooled count over eight seeds found it. Nothing in a test
 * catches it, because the fact is well-formed and reads like a sentence.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE FORCE IS, AND WHY IT IS THE BODY ALONE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The best hand on the party the other side actually put out - a draw off
 * their living roster, judged at its strongest member the way `partyOrdinal`
 * judges every other party in this engine. NOT the house's ceiling: see
 * {@link HANDS_ON_A_RAID} for what using the patriarch did to the answers.
 *
 * Priced at their rung and nothing else, not `assessPower`. The composite is
 * right for one exchange between two people standing in front of each other,
 * and a yearly sweep over every house in the world cannot afford it and should
 * not pretend to know exactly who was in the room.
 *
 * So it is the passive reading, and that is honest rather than cheap. A house
 * loses a hull in a war because the other house sent somebody whose rung the
 * hull was never built to be near. Nobody did anything clever to it, which is
 * `WeaponExposure.bodyAlone` and is the design owner's own first example:
 * *their body is literally too hard.* If a later ruling wants a named
 * champion's whole composite here, the argument type already takes it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A BROKEN THING IS A WRONG, AND THE WORLD IS TOLD
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Every loss goes through `aDeedEntersTheWorld`, so it is a dated fact on both
 * houses' record with the breaker named, which is what the rumour layer, the
 * digest and the hearsay layer all read and what makes it discoverable two
 * centuries later. It is priced by `whatADeedLeaves` from what it cost the
 * owner against what they still had, so an apex losing one of forty and a
 * failing house losing its only hull are the same deed at different weights.
 *
 * WHERE THE ACCOUNT LANDS IS A KNOWN GAP AND IT IS NOT THIS FILE'S. The world
 * simulation has no obligation table - it carries consequence as an enemy tie
 * on a person, which is what `openPersonalAccount` writes and what this writes
 * too. The priced records come back on {@link ThingLost.leaves} so that
 * anything holding a ledger - a run, in `src/web/` - can open them, and so
 * that the gap is visible rather than silently absorbed.
 */

import { combatPowerForOrdinal } from '../cultivation/combat.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import type { Deed, Party, WhatADeedLeaves } from '../social-leverage/what-a-deed-leaves.js';
import { aDeedEntersTheWorld } from './a-deed-enters-the-world-as-a-fact.js';
import { makeFact, type HistoricalFact } from './history.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { upsertRelationship, type NpcRecord } from './npc-state.js';
import {
    describeTheLoss,
    doesNotComeBack,
    isInert,
    stillExists,
    whatBecomesOfIt,
    whatItCostThem,
    writeBack,
    type ThingHarmed
} from './object-damage.js';
import { isRuined, type ObjectRecord } from './possessions.js';
import {
    holdsTogetherAsFarAsAnybodyKnows,
    settleTheSpoils,
    whoLost,
    type ThingChangedHands
} from './war-spoils.js';
import type { FactionRecord, WorldState } from './world-state.js';

// ═════════════════════════════════════════════════════════════════════════
// TUNING
// ═════════════════════════════════════════════════════════════════════════

/**
 * How many of a house's things the other side gets at in one year of war.
 *
 * One. A war in this setting is a road nobody uses and a border nobody crosses
 * for a decade, not a campaign that empties an armoury - `war_opened`'s own
 * consequences say so, and the physical line it writes is *the trade road is
 * unusable*. A house that loses a rated possession in a war has had a bad year
 * and should be able to name the day.
 *
 * It is also what keeps the arithmetic honest. The gate refuses most of these
 * outright and the fit line refuses most of the rest, so the number that
 * actually reaches a loss is far under one a year - which is the property
 * wanted, and it is produced by the ladder rather than by this constant.
 */
export const THINGS_REACHED_PER_WAR_YEAR = 1;

/**
 * How many of a house's people are on the party that got at it.
 *
 * ── This number is a judgement and here is the argument for it ────────────
 *
 * The first draft used the house's STRONGEST LIVING MEMBER, and it is worth
 * saying why that is wrong rather than merely tuning it away: a patriarch is a
 * house's ceiling, not the person who was standing on somebody's dock. Priced
 * that way, every object in every war met a rung several realms above it, the
 * exposure reached certainty every time, and the whole state vocabulary
 * collapsed to `ruined` - measured over three seeds and nine hundred years,
 * thirteen losses and NOT ONE of them holed. A resolver whose five answers
 * produce one answer is a boolean with extra prose on it.
 *
 * So a raid is a party. Four hands, which is the shape a house sends anywhere
 * else in this engine, and the rung it is judged at is `partyOrdinal`'s - the
 * strongest person ON THE PARTY, not an average, because averaging would let a
 * crowd of juniors drag a raid into a band their best could never reach. That
 * function's own argument, reused rather than restated.
 */
export const HANDS_ON_A_RAID = 4;

// ═════════════════════════════════════════════════════════════════════════
// WHAT COMES BACK
// ═════════════════════════════════════════════════════════════════════════

export interface ThingLost {
    objectId: string;
    objectName: string;
    /** The house that owned it. */
    ownerId: string;
    ownerName: string;
    /** The house whose war this was, and the person the record names. */
    breakerHouseId: string;
    breakerId: string;
    breakerName: string;
    harmed: ThingHarmed;
    /** What it cost the owner, against what they still hold. `Deed.cost`. */
    cost: number;
    /** The dated row on both houses' record. */
    fact: HistoricalFact;
    /**
     * The accounts this would open, priced.
     *
     * Returned rather than written: the world simulation has no obligation
     * table to write them to, and inventing one here would be a second ledger.
     * A caller that has one - a run - opens them and stamps `fact.id` on each.
     */
    leaves: WhatADeedLeaves | null;
    line: string;
}

// ═════════════════════════════════════════════════════════════════════════
// THE PASS
// ═════════════════════════════════════════════════════════════════════════

/**
 * One year of every live war, pointed at the things the sides own.
 *
 * Called once a year from `applyPressure`, on its own seeded stream, so no
 * existing draw anywhere moves. Mutates `state.objects`, `state.npcs` and the
 * history ledger, and returns what it did.
 */
export interface WhatAWarDid {
    /** Things the fighting reached, one at a time, over the years it ran. */
    broken: ThingLost[];
    /** Holds that changed hands when a war reached its settlement. */
    spoils: SpoilsTaken[];
}

/**
 * A war ended and a house's hold moved.
 *
 * One row per SETTLEMENT rather than per object: a hold of twenty things
 * changing hands is one event that a house remembers, and twenty facts saying
 * the same thing on the same day is the ledger the fold in
 * `a-fact-that-keeps-happening-is-one-row.ts` exists to prevent.
 */
export interface SpoilsTaken {
    loserId: string;
    loserName: string;
    winnerId: string;
    winnerName: string;
    /** Whether the losing body broke up rather than merely losing its things. */
    scattered: boolean;
    moved: ThingChangedHands[];
    fact: HistoricalFact;
    line: string;
}

export function whatAWarBreaks(
    state: WorldState,
    day: number,
    rng: CultivationRNG
): WhatAWarDid {
    const lost: ThingLost[] = [];
    const spoils: SpoilsTaken[] = [];
    const byId = new Map(state.factions.map(f => [f.id, f]));
    // A settled war leaves its schedule entry behind, and the same two houses
    // can go to war again - so a pair can match twice and would otherwise get
    // two years of war in one year. The tag check catches the settled ones; the
    // set catches the rest.
    const seen = new Set<string>();

    for (const effect of state.schedule) {
        if (effect.data.kind !== 'war_resolution') continue;
        const a = byId.get(String(effect.data.sideA ?? ''));
        const b = byId.get(String(effect.data.sideB ?? ''));
        if (!a || !b) continue;
        if (!a.tags.includes('at_war') || !b.tags.includes('at_war')) continue;
        const pair = [a.id, b.id].sort().join('|');
        if (seen.has(pair)) continue;
        seen.add(pair);

        // ── THE END OF IT, WHICH IS WHERE THE THINGS ACTUALLY MOVE ───────
        //
        // A war due to end today has had its years of fighting and now has its
        // settlement. Handled HERE rather than as another line in the world
        // tick, because this pass already walks exactly the wars that are live
        // and this is the same event seen one day later - `settleWarsThatAreOver`
        // takes the tags off at day+62 and this runs at day+61, so a war that
        // ends this year is settled before it is declared over.
        //
        // And it is the ordinary ending. The design owner: single-use materials
        // are *typically left as spoils of war*, so the fighting breaks the few
        // things somebody carried out and the SETTLEMENT moves everything that
        // stayed in the hold. See `war-spoils.ts`.
        if (effect.dueOnDay <= day) {
            const settled = settleOneWar(state, a, b, day, rng);
            if (settled) spoils.push(settled);
            continue;
        }

        // Both ways round. A war is not something one side has done to the
        // other, and a pass that only ever broke the loser's things would be
        // deciding the war before it was fought.
        lost.push(...oneSidePutsItsHandOnTheOthersThings(state, a, b, day, rng));
        lost.push(...oneSidePutsItsHandOnTheOthersThings(state, b, a, day, rng));
    }
    return { broken: lost, spoils };
}

/**
 * A war reached the day it was scheduled to end, and the hold changes hands.
 *
 * Everything about which side lost, whether the body holds together and what
 * that does to each row is `war-spoils.ts`'s; this decides nothing and only
 * puts the two houses in front of it.
 */
function settleOneWar(
    state: WorldState,
    a: FactionRecord,
    b: FactionRecord,
    day: number,
    rng: CultivationRNG
): SpoilsTaken | null {
    const sides = whoLost(state, a, b);
    // A war neither side lost moves nothing, which is a real answer rather
    // than a gap: two houses that could put the same thing out have not
    // settled anything by stopping.
    if (!sides) return null;
    const war = `the war between the ${sides.loser.name} and the ${sides.winner.name}`;
    const moved = settleTheSpoils(state, {
        loser: {
            id: sides.loser.id,
            name: sides.loser.name,
            holdsTogether: holdsTogetherAsFarAsAnybodyKnows(state, sides.loser.id)
        },
        winner: sides.winner,
        war,
        onDay: day
    }, rng);
    if (moved.length === 0) return null;

    // READ OFF WHAT HAPPENED, NEVER OFF WHAT WAS EXPECTED TO. `settleTheSpoils`
    // falls back to capture when a scattering house has nobody left to carry
    // anything, and a summary written from the INPUT said a house had broken up
    // and its things had gone out in its members' arms while the code had just
    // handed the whole hold to the winner. Measured: eight seeds, five hundred
    // years, twenty-two facts saying that and zero objects in anybody's hands.
    // A fact that misdescribes its own event is worse than no fact.
    const scattered = moved.some(m => m.fate === 'carried off');

    const line = scattered
        ? `The ${sides.loser.name} broke up at the end of ${war}, and ${moved.length} `
          + `thing${moved.length === 1 ? '' : 's'} went out of its hold in its members' arms.`
        : `The ${sides.winner.name} took ${moved.length} thing`
          + `${moved.length === 1 ? '' : 's'} off the ${sides.loser.name} at the end of ${war}.`;

    const fact = appendWorldFact(state, makeFact({
        day,
        kind: 'war',
        scale: 'local',
        summary: line,
        actors: [],
        locationId: sides.loser.seatLocationId ?? null,
        factionIds: [sides.loser.id, sides.winner.id],
        visibility: 'public',
        magnitude: 0.6,
        data: {
            unattributed: 'Carts went out of one gate and in at another, and nobody at either '
                + 'is answering questions about what was on them.',
            movedCount: moved.length,
            scattered
        }
    }), { recur: false });

    return {
        loserId: sides.loser.id,
        loserName: sides.loser.name,
        winnerId: sides.winner.id,
        winnerName: sides.winner.name,
        scattered,
        moved,
        fact,
        line
    };
}

/**
 * `holder`'s things, met by the strongest hand `against` can put on them.
 */
function oneSidePutsItsHandOnTheOthersThings(
    state: WorldState,
    holder: FactionRecord,
    against: FactionRecord,
    day: number,
    rng: CultivationRNG
): ThingLost[] {
    const hand = bestOfTheRaid(state, against, rng);
    if (!hand) return [];

    const theirs = ratedThingsOwnedBy(state, holder.id);
    if (theirs.length === 0) return [];

    const out: ThingLost[] = [];
    for (let i = 0; i < THINGS_REACHED_PER_WAR_YEAR; i++) {
        const object = theirs[rng.int(0, theirs.length - 1)];
        if (!object) continue;
        const at = state.objects.findIndex(o => o.id === object.id);
        if (at < 0) continue;

        const standing = combatPowerForOrdinal(hand.cultivation.realmOrdinal);
        const harmed = whatBecomesOfIt(object, {
            standing,
            // The body alone. Nobody did anything clever to it; the war reached
            // it and it was not built to be near a rung like that.
            bare: standing,
            ordinal: hand.cultivation.realmOrdinal,
            byId: hand.id,
            byName: hand.name,
            cause: `the war between the ${holder.name} and the ${against.name}`,
            standingOf: combatPowerForOrdinal
        }, rng);

        if (harmed.state === 'held') continue;

        const written = writeBack(state.objects[at], harmed, {
            onDay: day,
            source: `the war between the ${holder.name} and the ${against.name}`,
            note: harmed.account
        });
        if (written.row === null) state.objects.splice(at, 1);
        else state.objects[at] = written.row;
        state.objects.push(...written.pieces);

        out.push(recordIt(state, {
            object, harmed, holder, against, hand, day,
            stillHeld: theirs.filter(o => o.id !== object.id).map(o => o.power)
        }));
    }
    return out;
}

/**
 * Put it on the record, price it, and leave somebody carrying it.
 *
 * The three things a consequence needs and the three this world already has
 * machinery for: a dated fact anybody can hear about, a weight derived from
 * what it cost the person it happened to, and a named person who now thinks
 * badly of a named person.
 */
function recordIt(
    state: WorldState,
    input: {
        object: ObjectRecord;
        harmed: ThingHarmed;
        holder: FactionRecord;
        against: FactionRecord;
        hand: NpcRecord;
        day: number;
        stillHeld: readonly (number | null)[];
    }
): ThingLost {
    const { object, harmed, holder, against, hand, day } = input;
    const cost = whatItCostThem(harmed, input.stillHeld, combatPowerForOrdinal);
    const cause = `the war between the ${holder.name} and the ${against.name}`;
    const summary = describeTheLoss(harmed, object.name, cause);

    // Whose it was, as a person. A house holds a position and a person holds an
    // account, which is `openPersonalAccount`'s own rule - so the record names
    // whoever of the owning house is most invested in the thing, which is
    // whoever was holding it, and failing that anybody the house can put up.
    const aggrieved = personFor(state, holder, object.possessorId);

    const deed: Deed = {
        cause: 'other',
        paidBy: 'subject',
        cost,
        irreversible: doesNotComeBack(harmed.state),
        onDay: day,
        description: `${summary} ${harmed.account}`,
        witnesses: 1,
        tags: ['war', 'thing-broken', `state:${harmed.state}`],
        participants: aggrieved ? [aggrieved.id] : []
    };

    const partyFor = (npc: NpcRecord | null, house: FactionRecord): Party => ({
        id: npc?.id ?? house.id,
        name: npc?.name ?? house.name,
        houseId: house.id,
        houseName: house.name,
        alignment: house.alignment ?? null,
        ranked: true
    });

    // The fact is written whether or not anybody is left to be aggrieved. A
    // house whose last member is dead still owned the thing, and *the record of
    // that house having held one* is precisely what `items.md` says must
    // survive the object. `principalCannotHoldIt` is the ledger's own flag for
    // the case, so the account goes to whoever is left rather than nowhere.
    const held = aDeedEntersTheWorld(state, {
        kind: 'war',
        day,
        locationId: object.locationId ?? hand.locationId ?? null,
        actors: [
            { id: hand.id, name: hand.name, role: 'broke it' },
            ...(aggrieved ? [{ id: aggrieved.id, name: aggrieved.name, role: 'held it' }] : [])
        ],
        factionIds: [holder.id, against.id],
        summary,
        unattributed: 'Something of theirs is not there any more, and nobody at the '
            + 'gate will say what happened to it.',
        price: {
            deed,
            actor: partyFor(hand, against),
            subject: partyFor(aggrieved, holder),
            reach: 'answerable',
            ...(aggrieved ? {} : { principalCannotHoldIt: true })
        }
    });

    if (aggrieved) {
        const at = state.npcs.findIndex(n => n.id === aggrieved.id);
        if (at >= 0) {
            state.npcs[at] = upsertRelationship(state.npcs[at], {
                targetId: hand.id,
                targetName: hand.name,
                kind: 'enemy',
                standing: -0.75,
                note: summary
            }, day);
        }
    }

    return {
        objectId: object.id,
        objectName: object.name,
        ownerId: holder.id,
        ownerName: holder.name,
        breakerHouseId: against.id,
        breakerId: hand.id,
        breakerName: hand.name,
        harmed,
        cost,
        fact: held.fact,
        leaves: held.leaves,
        line: summary
    };
}

// ═════════════════════════════════════════════════════════════════════════
// WHO AND WHAT
// ═════════════════════════════════════════════════════════════════════════

/**
 * The things a house owns that a war could reach.
 *
 * ONE PREDICATE AND IT NAMES NO KIND. A hull, a blade, a plate and a carriage
 * satisfy it or fail it on identical terms, which is the ruling. Three
 * questions, all of them off the possession layer's own fields:
 *
 *   IS IT THIS HOUSE'S    `ownerId`. Whose it actually is, which is not the
 *                         same question as who has hold of it.
 *   IS IT WORTH ANYTHING  `power`. Not rated, not in the fighting.
 *   IS IT OUT             `possessorId`. See below - this is the interesting
 *                         one and it is the reason this list is short.
 *
 * ── WHAT "OUT" MEANS, AND WHY IT IS NOT A LIST OF KINDS ──────────────────
 *
 * `possessions.ts` keeps possession and ownership apart on purpose, and this
 * is the payoff. A thing a PERSON is holding is out in the world: somebody
 * walked out of the gate with it and it is where the fighting is. A thing with
 * NOBODY holding it is out in a different way - moored, mounted, set into a
 * wall - and a war reaches that too, which is the entire question this pass
 * was written to answer.
 *
 * A thing THE OWNING HOUSE ITSELF is holding is in its stores. `possessorId`
 * and `ownerId` are the same id, nobody has taken it anywhere, and a war does
 * not empty a treasury. That is the fiction, and it is also what keeps a
 * house's stock of medicine and its single-use materials out of a fight they
 * were never in.
 *
 * That comparison is the whole of it: possession against ownership, which is
 * the first distinction `possessions.ts` draws and the reason it refuses to
 * collapse the two into one `ownerId`. No kind is read to get any of it, and a
 * tenth kind of thing needs no line here - what decides is whether somebody
 * carried it out of the gate.
 */
export function ratedThingsOwnedBy(state: WorldState, factionId: string): ObjectRecord[] {
    return state.objects.filter(o =>
        o.ownerId === factionId
        && o.power !== null
        && !isRuined(o)
        && !isInert(o)
        && o.possessorId !== o.ownerId
    );
}

/**
 * The best hand on the party this house put out, or null where it has nobody.
 *
 * `HANDS_ON_A_RAID` people drawn off the living roster, and the one of them
 * standing highest - which is `partyOrdinal`'s rule, applied to a party drawn
 * rather than chosen. A house with four hundred members mostly sends four of
 * them who are nobody in particular, and occasionally the draw lands on
 * somebody the other side is going to remember.
 */
function bestOfTheRaid(
    state: WorldState,
    faction: FactionRecord,
    rng: CultivationRNG
): NpcRecord | null {
    const roster = state.npcs.filter(n => n.status === 'alive' && n.factionId === faction.id);
    if (roster.length === 0) return null;
    let best: NpcRecord | null = null;
    for (let i = 0; i < HANDS_ON_A_RAID; i++) {
        const drawn = roster[rng.int(0, roster.length - 1)];
        if (!drawn) continue;
        if (best === null || drawn.cultivation.realmOrdinal > best.cultivation.realmOrdinal) {
            best = drawn;
        }
    }
    return best;
}

/** The highest rung this house has anybody standing at. */
function strongestHandOf(state: WorldState, faction: FactionRecord): NpcRecord | null {
    let best: NpcRecord | null = null;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive') continue;
        if (npc.factionId !== faction.id) continue;
        if (best === null || npc.cultivation.realmOrdinal > best.cultivation.realmOrdinal) {
            best = npc;
        }
    }
    return best;
}

/** Whoever was holding it, or anybody the house can put up in their place. */
function personFor(
    state: WorldState,
    house: FactionRecord,
    possessorId: string | null
): NpcRecord | null {
    if (possessorId) {
        const held = state.npcs.find(n => n.id === possessorId && n.status === 'alive');
        if (held) return held;
    }
    return strongestHandOf(state, house);
}

/** Whether the thing came out the other side. Re-exported for a caller's report. */
export { stillExists };
