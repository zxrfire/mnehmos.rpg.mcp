/**
 * A war between two houses, which is a group fight and nothing else.
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
import type { ObligationInput } from '../social/grudges.js';
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
 */
export const HANDS_IN_THE_FIELD = 4;

/**
 * What a house can put into a fight, priced by the melee's own arithmetic.
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
     */
    spent: number;
    /**
     * How badly it is losing: its own spend against the other side's.
     */
    losing: number;
    /** Alive under the banner right now. */
    standing: number;
    /**
     * Whether the people the house was led by when the war opened are still alive
     * in it.
     */
    ledStill: boolean;
}

/**
 * How the war this house is in is going for it, or null when it is in none.
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
    /**
     * The accounts the year's fighting opened, ready for the ledger.
     */
    opens: ObligationInput[];
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

    // THE BODIES
    const deaths: DeathHandoff[] = [];
    // What anybody is now owed. One list for the whole engagement, because a
    // battle is one event and each death in it is one deed - the same shape the
    // played killing already writes, through the same decider.
    const opens: ObligationInput[] = [];
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
            finished: c.finished,
            // A war is the absence of an arrangement, not a declaration of
            // hostility. Nobody promised anybody anything, so it is `open` and
            // priced by the same table a brawl in a square is.
            terms: 'open',
            // Everybody else who was in it. A battle is not a private thing and
            // the room is what a house has to have a position on.
            witnesses: Math.max(0, result.combatants.length - 2)
        });
        if (did.handoff) deaths.push(did.handoff);
        opens.push(...did.opens);
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
        opens,
        fact,
        line
    };
}

/**
 * Say what the resolver said, in the words it used.
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
