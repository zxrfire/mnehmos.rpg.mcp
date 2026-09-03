/**
 * A war between two houses, which is a group fight and nothing else.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THERE IS NO WAR SUBSYSTEM. RULED BY THE DESIGN OWNER
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Told that nothing in the world recorded which way a war was going - no
 * attacker, no defender, no casualties, no loser, while `war_settled`'s own
 * prose said *whichever side lost is still smaller*:
 *
 *   > obviously this can be easily simulated as a group fight, right? not
 *   > bespoke.
 *
 * So this file designs nothing about wars. It draws the party each house put in
 * the field this year, hands both to `resolveMelee`, and writes back what came
 * out. Every question a war has - who is losing, how badly, who is left, whose
 * things broke - is a field on `MeleeResult`, by name, and none of them is
 * computed here.
 *
 * Grep this file for a margin, a weight function or a "how many houses it
 * takes" helper. There is none, and there must not be one: a second answer
 * standing beside the melee's is precisely the defect the ruling avoids.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT IT EXPOSES, AND WHY IT IS NOT A WINNER FLAG
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Three features are queued behind a war having a shape and all three want the
 * same thing: HOW BADLY A HOUSE IS LOSING, as a quantity that moves while the
 * war runs. A boolean winner at the end serves none of them, because all three
 * act in the middle.
 *
 *   THE GUEST-DISCIPLE ECONOMY   a house at war takes on outside cultivators,
 *                                and the losing side opens the door widest and
 *                                pays most. Reads {@link HowAHouseIsFaring.losing}
 *                                - over zero is losing, and the size of it is
 *                                how wide the door goes. `stillToClear` in
 *                                `birth/birth.ts` already carries the door and
 *                                `server/consolidated/sect-guest.ts` is live.
 *   A HOUSE GRABBING ITS VAULT   built and tested in `war-spoils.ts` with no
 *                                producer. It needs one input: whether a house
 *                                with living members still breaks up. Reads
 *                                {@link HowAHouseIsFaring.ledStill} - a house
 *                                whose war took everybody it was led by has
 *                                nobody left to hold it together.
 *   TWELVE SEALED COMPOUNDS      *the seat of a power that no longer exists*.
 *                                They are what the fate above leaves behind.
 *
 * ── THE QUANTITY IS MEASURED AGAINST WHAT THE HOUSE BROUGHT ──────────────
 *
 * Not against the other side's size, which would say a small house is losing
 * before anybody fought, and not against a bar. A house is losing when it can
 * put out less than it could on the day the war opened, and it is losing badly
 * when the other side is not. That baseline is written onto the war's own
 * schedule row when the war opens - see `war_opened` in
 * `the-world-changing-on-its-own.ts` - and it is the legitimate kind of stored
 * value: a fact about a day, which cannot go stale because the day does not
 * move. Everything computed from it is derived on demand.
 *
 * A war opened before this existed carries no baseline. It reads as untouched
 * rather than as a gap, which is the honest answer for a war nobody measured.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT REPLACED `war-breakage.ts`, AND WHY IT HAD TO GO
 * ═════════════════════════════════════════════════════════════════════════
 *
 * That file drew a raid party off a roster once a year and broke one of the
 * other side's things with it. It was the honest floor under an absence -
 * nothing in the world fought a war, so nothing could break anything in one -
 * and its own header said to delete it the day a war became a melee.
 *
 * The reason is that a melee ALREADY breaks what the people in it are carrying.
 * `MeleeResult.exchanges` carries `result.weapon` on every strike, through the
 * same object layer that pass called on its yearly line. A war running both
 * would break a house's things twice a year by two routes, and the second would
 * be a raid party standing in for a fight nobody was simulating.
 *
 * So breakages here come off `exchanges` and nowhere else. `war-spoils.ts` is
 * about the SETTLEMENT rather than the fighting and is untouched.
 *
 * ── HOW FEW HANDS THERE ARE, BECAUSE IT READS LIKE A WORKING FEATURE ─────
 *
 * A war in which nothing breaks looks exactly like a war in which breaking is
 * rare, so the population of armed people is worth stating rather than
 * assuming. Measured at seeding, identical across seeds: of eighteen rated
 * objects in the world, FOUR are in a person's hands, nine sit in a house's
 * hold, two are held by nobody, and three are held above the Lid by people this
 * world cannot reach.
 *
 * The four are the Hollow Court's Seats, and the Court does not go to war. So a
 * war party drawn off an ordinary house's roster still carries nothing, and
 * that is a fact about the CATALOG rather than a defect here: every ordinary
 * weapon in `artifacts.ts` is `significance: 'mundane'` - a kind standing in
 * for several hundred of the thing - and `artifact-placement.ts` deliberately
 * seats none of them, because a tracked row per notched sabre is the ledger
 * rubble that file exists to refuse. `docs/world/things/items.md` says what the
 * counted tier is; nothing represents it to the combat layer, and until
 * something does, an ordinary fight is two people with their hands.
 *
 * The path that DOES reach the slot today is the player's, through
 * `carriedArtifact` and `combatantFromCultivator`. Same field, same resolver.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * COMPOSE EVERY SUMMARY FROM WHAT THE MELEE RETURNED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A melee has three endings the caller does not choose: `stalemate` inside the
 * round budget, `no_contest` where the gap made it not a fight, and a winner. A
 * summary written from the INPUTS will confidently narrate a defeat that did
 * not happen, and it has already happened once here - twenty-two facts went
 * onto the permanent record saying a house had broken up while the code had
 * handed its hold to the winner intact. Nothing in a test caught it, because
 * the fact was well-formed and read like a sentence; only a pooled count over
 * eight seeds found it.
 *
 * Every line this file writes is read off `MeleeResult` or off the rows
 * `settleTheSpoils` actually moved.
 */

import {
    resolveMelee,
    sideStrength,
    assessPower,
    type MeleeResult,
    type SideInput,
    type SideStrength
} from '../cultivation/combat.js';
import type { CultivationRNG } from '../cultivation/rng.js';
import { combatantOf } from './gatherings.js';
import { makeFact, type HistoricalFact } from './history.js';
import type { NpcRecord } from './npc-state.js';
import { isRuined, ruin } from './possessions.js';
import { whatTheConfrontationDidToThem } from './what-a-confrontation-does-to-somebody-the-world-holds.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import {
    holdsTogetherAsFarAsAnybodyKnows,
    settleTheSpoils,
    type ThingChangedHands
} from './war-spoils.js';
import type { FactionRecord, WorldState } from './world-state.js';
import type { DeathHandoff } from './time.js';

// ═════════════════════════════════════════════════════════════════════════
// WHAT A HOUSE PUTS IN THE FIELD
// ═════════════════════════════════════════════════════════════════════════

/**
 * How many of a house's people are on the field in one year of a war.
 *
 * ── This number is a judgement and the argument for it is inherited ───────
 *
 * Four, which is the shape a house sends anywhere else in this engine, and the
 * argument is the one `war-breakage.ts` made for its raid before it was
 * deleted: a house's CEILING is not the person who was standing on somebody's
 * dock. Priced at the patriarch, every exchange in every war met a rung several
 * realms above it, the whole outcome vocabulary collapsed to one answer, and a
 * resolver with five endings became a boolean with prose on it.
 *
 * It is also what keeps a war from being a mutual annihilation. Two houses
 * openly fighting are not two rosters standing in a field for twenty-five
 * years; they are a border, and what meets on it is a party. The population
 * pyramid is a law here and a war that fielded four hundred people a year would
 * flatten it in a century.
 *
 * WHO is drawn rather than chosen, for the same reason. A house with four
 * hundred members mostly sends four of them who are nobody in particular, and
 * occasionally the draw lands on somebody the other side is going to remember.
 * Choosing the strongest would kill the top of the ladder off in wars, which is
 * the pyramid broken from the other end.
 */
export const HANDS_IN_THE_FIELD = 4;

/**
 * What a house can put into a fight, priced by the melee's own arithmetic.
 *
 * `sideStrength` and not a second opinion about it. Everybody alive under the
 * banner, run through `assessPower` exactly as a combatant is, so what this
 * says about a house is what the resolver would say about it.
 *
 * Read `summed` for how much of the house is still there and `weight` for what
 * it could bring to bear; they are different questions and `SideStrength`
 * already keeps them apart.
 */
export function whatAHouseCanPutOut(state: WorldState, factionId: string): SideStrength {
    const roster = livingRoster(state, factionId);
    return sideStrength(roster.map(npc => assessPower(combatantOf(npc, state), { ambient: 'normal' })));
}

/** The highest rank anybody alive under this banner holds, or -1 for nobody. */
export function highestRankAlive(state: WorldState, factionId: string): number {
    let best = -1;
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId !== factionId) continue;
        best = Math.max(best, npc.factionRankIndex);
    }
    return best;
}

// ═════════════════════════════════════════════════════════════════════════
// HOW BADLY A HOUSE IS LOSING
// ═════════════════════════════════════════════════════════════════════════

export interface HowAHouseIsFaring {
    houseId: string;
    houseName: string;
    againstId: string;
    againstName: string;
    openedOnDay: number;
    /**
     * Everybody alive under the banner, priced and added up, on the day the war
     * opened. Null for a war opened before anything measured one.
     */
    mustered: number | null;
    /** The same reading, today. */
    muster: number;
    /**
     * How much of what it brought is gone. 0 untouched, 1 nothing left.
     *
     * SIGNED BELOW ZERO ON PURPOSE, and this was measured rather than guessed.
     * A war runs two to twenty-five years and everybody in it advances and
     * recruits over that span, so a house's muster ordinarily RISES while the
     * war is costing it people. Floored at zero, both sides of most wars read
     * "untouched" and the quantity said nothing - measured over eight seeds and
     * five hundred years, it flattened a third of all settlements to a tie. A
     * house that has grown reads negative, which is the honest statement, and
     * the difference between the two sides is what {@link losing} reads.
     *
     * Zero where there is no baseline, which reads as untouched rather than as
     * a gap - see the header.
     */
    spent: number;
    /**
     * How badly it is losing: its own spend against the other side's.
     *
     * -1 to 1. Over zero and it is losing; under zero and it is winning; at
     * zero the war is costing them the same. THIS IS THE QUANTITY the three
     * queued features read, and it moves every year the war runs rather than
     * being stamped at the end.
     */
    losing: number;
    /** Alive under the banner right now. */
    standing: number;
    /**
     * Whether the people the house was led by when the war opened are still
     * alive in it.
     *
     * False is a house whose war took its seniors, and it is the one input
     * `war-spoils.ts`'s third fate has been waiting for: a body with living
     * members that still breaks up, because there is nobody left in it senior
     * enough to hold it together. True where there is no baseline.
     */
    ledStill: boolean;
}

/**
 * How the war this house is in is going for it, or null when it is in none.
 *
 * Derived on every call from live rosters and the war's own opening row.
 * Nothing is stored and nothing can go stale, which is what lets a caller ask
 * in the middle of a war rather than only at the end of one.
 */
export function howAHouseIsFaring(state: WorldState, factionId: string): HowAHouseIsFaring | null {
    const war = liveWars(state).find(w => w.a.id === factionId || w.b.id === factionId);
    if (!war) return null;
    const both = faringFor(state, war);
    return war.a.id === factionId ? both.a : both.b;
}

interface LiveWar {
    a: FactionRecord;
    b: FactionRecord;
    openedOnDay: number;
    dueOnDay: number;
    /** The opening baseline, or null where the war predates it. */
    brought: { a: number; b: number } | null;
    led: { a: number; b: number } | null;
}

/** Both sides of one war, read off the same numbers so they cannot disagree. */
function faringFor(state: WorldState, war: LiveWar): { a: HowAHouseIsFaring; b: HowAHouseIsFaring } {
    const musterA = whatAHouseCanPutOut(state, war.a.id).summed;
    const musterB = whatAHouseCanPutOut(state, war.b.id).summed;
    const spentA = spendOf(war.brought?.a ?? null, musterA);
    const spentB = spendOf(war.brought?.b ?? null, musterB);

    const one = (
        side: FactionRecord,
        other: FactionRecord,
        mustered: number | null,
        muster: number,
        spent: number,
        otherSpent: number,
        led: number | null
    ): HowAHouseIsFaring => ({
        houseId: side.id,
        houseName: side.name,
        againstId: other.id,
        againstName: other.name,
        openedOnDay: war.openedOnDay,
        mustered,
        muster,
        spent,
        losing: clamp11(spent - otherSpent),
        standing: livingRoster(state, side.id).length,
        ledStill: led === null || highestRankAlive(state, side.id) >= led
    });

    return {
        a: one(war.a, war.b, war.brought?.a ?? null, musterA, spentA, spentB, war.led?.a ?? null),
        b: one(war.b, war.a, war.brought?.b ?? null, musterB, spentB, spentA, war.led?.b ?? null)
    };
}

/**
 * What is gone, against what was brought. Zero with no baseline.
 *
 * Capped above at 1 - a house cannot lose more than everything - and left
 * uncapped below, so a house that has outgrown the war it is in says so. See
 * {@link HowAHouseIsFaring.spent} for the measurement behind that.
 */
function spendOf(brought: number | null, now: number): number {
    if (brought === null || brought <= 0) return 0;
    return Math.min(1, 1 - now / brought);
}

function clamp11(n: number): number {
    return Math.max(-1, Math.min(1, n));
}

// ═════════════════════════════════════════════════════════════════════════
// THE YEAR'S FIGHTING
// ═════════════════════════════════════════════════════════════════════════

/** One year of one war, as the resolver reported it. */
export interface WarEngagement {
    aId: string;
    aName: string;
    bId: string;
    bName: string;
    /** The resolver's own verdict. Never adjusted, never re-derived. */
    outcome: MeleeResult['outcome'];
    /** Null for a stalemate and for a no-contest, which are real answers. */
    winningSideId: string | null;
    /** Everybody who went down, by name, both sides. */
    fell: string[];
    /** Everybody who broke off, by name, both sides. */
    brokeOff: string[];
    /** Objects that did not survive being swung, off `exchanges`. */
    thingsBroken: { objectId: string; objectName: string; carrierId: string }[];
    deaths: DeathHandoff[];
    fact: HistoricalFact;
    line: string;
}

/** A war ended and the losing side's hold moved. */
export interface WarSettlement {
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

export interface WhatTheWarsDid {
    fought: WarEngagement[];
    settled: WarSettlement[];
}

/**
 * One year of every live war, fought and where due settled.
 *
 * Called once a year from `applyPressure` on its own seeded stream, so no
 * existing draw anywhere moves. Mutates `state.npcs`, `state.objects` and the
 * ledger, and returns what it did.
 */
export function fightTheWarsThisYear(
    state: WorldState,
    day: number,
    rng: CultivationRNG
): WhatTheWarsDid {
    const fought: WarEngagement[] = [];
    const settled: WarSettlement[] = [];

    for (const war of liveWars(state)) {
        if (war.dueOnDay <= day) {
            const done = settleOneWar(state, war, day, rng);
            if (done) settled.push(done);
            continue;
        }
        const engagement = fightOneYear(state, war, day, rng);
        if (engagement) fought.push(engagement);
    }

    return { fought, settled };
}

/**
 * The two parties met, and the resolver said what happened.
 *
 * Nothing about the fight is decided here. What this does is draw who was
 * there, price them the way the world prices anybody in a fight, and then write
 * back three things the melee reported: the wounds and the dead, the objects
 * that came apart, and a fact that says what the result actually said.
 */
function fightOneYear(
    state: WorldState,
    war: LiveWar,
    day: number,
    rng: CultivationRNG
): WarEngagement | null {
    const partyA = drawTheParty(state, war.a.id, rng);
    const partyB = drawTheParty(state, war.b.id, rng);
    // A side with nobody left is not a side. The settlement is where a house
    // with no one under its banner is dealt with; a year of fighting against
    // nobody is not an event.
    if (partyA.length === 0 || partyB.length === 0) return null;

    const sides: SideInput[] = [
        { id: war.a.id, name: war.a.name, members: partyA.map(n => combatantOf(n, state)) },
        { id: war.b.id, name: war.b.name, members: partyB.map(n => combatantOf(n, state)) }
    ];

    const result = resolveMelee(sides, {
        rng,
        ambient: 'normal',
        turn: 1,
        // Two houses openly fighting are trying to stop each other. `willWithdraw`
        // is left at its default, so most of the beaten break off rather than
        // die - which is why a war costs a house people without emptying it.
        intent: { goal: 'kill' }
    });

    const byId = new Map<string, NpcRecord>(
        [...partyA, ...partyB].map(n => [n.id, n])
    );

    // ── THE BODIES ───────────────────────────────────────────────────────
    //
    // One person at a time, through the world's one write path for what a fight
    // leaves on somebody. `lost` is per-person and reads off `felledBy`: the
    // account goes from whoever went down to whoever put them down, which is
    // finer and truer than a side-wide verdict. `finished` is the resolver's own
    // flag and there is no second death gate.
    const deaths: DeathHandoff[] = [];
    for (const c of result.combatants) {
        if (c.felledBy === null && c.injuries.length === 0) continue;
        const felledBy = c.felledBy === null ? null : byId.get(c.felledBy) ?? null;
        const did = whatTheConfrontationDidToThem(state, {
            npcId: c.id,
            byId: felledBy?.id ?? c.sideId,
            byName: felledBy?.name ?? theOtherSide(war, c.sideId).name,
            day,
            wounds: c.injuries,
            outcome: result.outcome,
            lost: c.felledBy !== null,
            finished: c.finished
        });
        if (did.handoff) deaths.push(did.handoff);
    }

    // ── THE THINGS ───────────────────────────────────────────────────────
    //
    // Off `exchanges` and nowhere else. This is the route `war-breakage.ts` was
    // deleted for duplicating: a melee already breaks what the people in it are
    // carrying, and reading it off the strike record is the melee's own header's
    // instruction.
    const thingsBroken = writeBackWhatBroke(state, result, day);

    // ── THE RECORD, COMPOSED FROM THE RESULT ─────────────────────────────
    const fell = result.combatants
        .filter(c => c.fate === 'finished' || c.fate === 'body_destroyed')
        .map(c => c.name);
    const brokeOff = result.combatants
        .filter(c => c.fate === 'withdrew' || c.fate === 'crippled')
        .map(c => c.name);
    const winner = result.winningSideId === null
        ? null
        : (result.winningSideId === war.a.id ? war.a : war.b);

    const line = composeTheYear(war, result, winner, fell, brokeOff);

    const fact = appendWorldFact(state, makeFact({
        day,
        kind: 'war',
        scale: 'local',
        summary: line,
        actors: result.combatants.map(c => ({
            id: c.id,
            name: c.name,
            role: c.fate
        })),
        locationId: (winner ?? war.a).seatLocationId ?? null,
        factionIds: [war.a.id, war.b.id],
        visibility: 'public',
        magnitude: fell.length > 0 ? 0.55 : 0.35,
        data: {
            unattributed: 'People went out to the border and fewer came back, and nobody at '
                + 'either gate is putting a number on it.',
            outcome: result.outcome,
            fell: fell.length,
            brokeOff: brokeOff.length
        }
    }), { recur: false });

    return {
        aId: war.a.id,
        aName: war.a.name,
        bId: war.b.id,
        bName: war.b.name,
        outcome: result.outcome,
        winningSideId: result.winningSideId,
        fell,
        brokeOff,
        thingsBroken,
        deaths,
        fact,
        line
    };
}

/**
 * Say what the resolver said, in the words it used.
 *
 * Three endings and each of them gets its own sentence. A stalemate is not a
 * loss and a no-contest is not a fight, and writing either of them as a defeat
 * is the exact failure this file's header records.
 */
function composeTheYear(
    war: LiveWar,
    result: MeleeResult,
    winner: FactionRecord | null,
    fell: readonly string[],
    brokeOff: readonly string[]
): string {
    const cost = fell.length > 0
        ? ` ${fell.join(', ')} did not come back.`
        : brokeOff.length > 0
            ? ` ${brokeOff.join(', ')} broke off and got away.`
            : '';

    if (winner === null) {
        return result.outcome === 'no_contest'
            ? `The ${war.a.name} and the ${war.b.name} put people on the border and neither `
              + `could reach the other. Nothing was settled because nothing was contested.${cost}`
            : `The ${war.a.name} and the ${war.b.name} met on the border and neither broke.${cost}`;
    }
    const loser = winner.id === war.a.id ? war.b : war.a;
    return `The ${winner.name} held the field against the ${loser.name}.${cost}`;
}

/**
 * Write what the fighting did to the objects in it.
 *
 * `docs/world/things/items.md`'s "spent is not gone", the same as a gathering's
 * bout: a ruined object keeps its row, its owner, its claims and every link of
 * its provenance, and gains one more saying where it ended.
 */
function writeBackWhatBroke(
    state: WorldState,
    result: MeleeResult,
    day: number
): WarEngagement['thingsBroken'] {
    const out: WarEngagement['thingsBroken'] = [];
    const done = new Set<string>();
    for (const exchange of result.exchanges) {
        const weapon = exchange.result.weapon;
        if (!weapon || !weapon.broke || done.has(weapon.objectId)) continue;
        done.add(weapon.objectId);
        const at = state.objects.findIndex(o => o.id === weapon.objectId);
        if (at < 0 || isRuined(state.objects[at])) continue;
        state.objects[at] = ruin(state.objects[at], {
            onDay: day,
            source: 'swung at somebody it was not fit for in a war, and did not survive it',
            note: weapon.exposure.cause
        });
        out.push({
            objectId: weapon.objectId,
            objectName: weapon.objectName,
            carrierId: exchange.attackerId
        });
    }
    return out;
}

// ═════════════════════════════════════════════════════════════════════════
// THE SETTLEMENT
// ═════════════════════════════════════════════════════════════════════════

/**
 * A war reached the day it was scheduled to end, and the hold changes hands.
 *
 * WHO LOST is the side the war has cost more, which is
 * {@link HowAHouseIsFaring.losing} - the accumulation of every year's fighting,
 * read off the rosters those melees left behind. It is not a second scoring
 * rule: what it prices is `sideStrength`, which is the arithmetic the melee
 * itself uses on a side, applied to who is still there.
 *
 * A war neither side has been costlier for moves nothing. That is a real answer
 * rather than a gap: two houses that ground each other down evenly have not
 * settled anything by stopping.
 */
function settleOneWar(
    state: WorldState,
    war: LiveWar,
    day: number,
    rng: CultivationRNG
): WarSettlement | null {
    const faring = faringFor(state, war);
    if (faring.a.losing === faring.b.losing) return null;
    const loser = faring.a.losing > faring.b.losing ? faring.a : faring.b;
    const winnerRow = loser.houseId === war.a.id ? war.b : war.a;

    const name = `the war between the ${loser.houseName} and the ${winnerRow.name}`;
    const moved = settleTheSpoils(state, {
        loser: {
            id: loser.houseId,
            name: loser.houseName,
            // The third fate's one input, and it now has a producer. A house
            // holds together while somebody it was led by is still alive in it;
            // a house whose war took all of them has living members and nobody
            // to hold them, and it is that house that grabs its vault and goes.
            holdsTogether: loser.ledStill
                && holdsTogetherAsFarAsAnybodyKnows(state, loser.houseId)
        },
        winner: winnerRow,
        war: name,
        onDay: day
    }, rng);
    if (moved.length === 0) return null;

    // READ OFF WHAT HAPPENED, NEVER OFF WHAT WAS EXPECTED TO. `settleTheSpoils`
    // falls back to capture when a scattering house has nobody left to carry
    // anything, and a summary written from the INPUT once put twenty-two facts
    // on the permanent record saying a house had broken up while the code had
    // handed its whole hold to the winner.
    const scattered = moved.some(m => m.fate === 'carried off');

    const line = scattered
        ? `The ${loser.houseName} broke up at the end of ${name}, and ${moved.length} `
          + `thing${moved.length === 1 ? '' : 's'} went out of its hold in its members' arms.`
        : `The ${winnerRow.name} took ${moved.length} thing`
          + `${moved.length === 1 ? '' : 's'} off the ${loser.houseName} at the end of ${name}.`;

    const fact = appendWorldFact(state, makeFact({
        day,
        kind: 'war',
        scale: 'local',
        summary: line,
        actors: [],
        locationId: (loser.houseId === war.a.id ? war.a : war.b).seatLocationId ?? null,
        factionIds: [loser.houseId, winnerRow.id],
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
        loserId: loser.houseId,
        loserName: loser.houseName,
        winnerId: winnerRow.id,
        winnerName: winnerRow.name,
        scattered,
        moved,
        fact,
        line
    };
}

// ═════════════════════════════════════════════════════════════════════════
// WHO AND WHERE
// ═════════════════════════════════════════════════════════════════════════

/**
 * Every war currently being fought, read off the schedule.
 *
 * The same walk `war-breakage.ts` made. A settled war leaves its schedule entry
 * behind and the same two houses can go to war again, so a pair can match twice
 * and would otherwise get two years of war in one year; the tag check catches
 * the settled ones and the set catches the rest.
 */
function liveWars(state: WorldState): LiveWar[] {
    const byId = new Map(state.factions.map(f => [f.id, f]));
    const seen = new Set<string>();
    const out: LiveWar[] = [];

    for (const effect of state.schedule) {
        if (effect.data.kind !== 'war_resolution') continue;
        const a = byId.get(String(effect.data.sideA ?? ''));
        const b = byId.get(String(effect.data.sideB ?? ''));
        if (!a || !b) continue;
        if (a.dissolvedOnDay !== null || b.dissolvedOnDay !== null) continue;
        if (!a.tags.includes('at_war') || !b.tags.includes('at_war')) continue;
        const pair = [a.id, b.id].sort().join('|');
        if (seen.has(pair)) continue;
        seen.add(pair);

        const broughtA = numberOrNull(effect.data.musteredA);
        const broughtB = numberOrNull(effect.data.musteredB);
        const ledA = numberOrNull(effect.data.ledA);
        const ledB = numberOrNull(effect.data.ledB);

        out.push({
            a,
            b,
            openedOnDay: Number(effect.data.openedOnDay ?? 0),
            dueOnDay: effect.dueOnDay,
            brought: broughtA === null || broughtB === null ? null : { a: broughtA, b: broughtB },
            led: ledA === null || ledB === null ? null : { a: ledA, b: ledB }
        });
    }
    return out;
}

function numberOrNull(raw: unknown): number | null {
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function theOtherSide(war: LiveWar, sideId: string): FactionRecord {
    return sideId === war.a.id ? war.b : war.a;
}

/**
 * The party this house put in the field, drawn off its living roster.
 *
 * Drawn rather than chosen - see {@link HANDS_IN_THE_FIELD} - and deduplicated,
 * because somebody drawn twice is one person and not two fighters. A house with
 * fewer than four people sends what it has.
 */
function drawTheParty(state: WorldState, factionId: string, rng: CultivationRNG): NpcRecord[] {
    const roster = livingRoster(state, factionId);
    if (roster.length === 0) return [];
    const picked = new Map<string, NpcRecord>();
    for (let i = 0; i < HANDS_IN_THE_FIELD; i++) {
        const drawn = roster[rng.int(0, roster.length - 1)];
        if (drawn) picked.set(drawn.id, drawn);
    }
    return [...picked.values()];
}

function livingRoster(state: WorldState, factionId: string): NpcRecord[] {
    return state.npcs.filter(n => n.status === 'alive' && n.factionId === factionId);
}
