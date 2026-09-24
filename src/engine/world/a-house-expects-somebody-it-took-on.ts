/**
 * A house expects somebody it took on, by name, because the person who took them
 * on told the Internal Affairs office.
 *
 * The design owner's ruling on somebody new at a gate: the recruiter reports back,
 * the house expects the person by name, and somebody not yet entered is let in
 * when they are on that list and can say who recruited them. The word travels by
 * a communication talisman burnt to the Internal Affairs Elder, or, with no slip,
 * with the recruiter the next time they are at the house. The rulings are
 * written down in `a-house-and-who-is-in-it.md`, under "A recruit is expected,
 * and arrives".
 *
 * ── THE REPORT IS THE FACT, NOT HOW IT TRAVELLED ─────────────────────────
 *
 * {@link theHouseExpects} is the ONE way an expectation is written. It takes who
 * reported, the day, and that the report was addressed to the Internal Affairs
 * office, and it does not know whether a slip carried it or the recruiter walked
 * in with it. Whatever carries a report calls it:
 *
 *   a slip burnt        the talisman work, when a recruiter carries one
 *   walked in with it   {@link deliverWhatTheyOweTheHouse}, the year a recruiter
 *                       is standing in the compound, which the entry pass asks
 *
 * A recruiter who has not yet reported carries the report as something owed, on
 * their own row ({@link aRecruiterOwesTheHouseAReport}), so a slip and a walk can
 * never both deliver it: {@link theReportIsDelivered} clears it.
 *
 * ── ADDRESSED TO AN OFFICE NOBODY HOLDS YET ──────────────────────────────
 *
 * The report goes to the Internal Affairs office. Nobody holds it today
 * (`ancestral_hall` is not an office), so the record names the office and carries
 * null for the elder, and the house holds the expectation all the same. Nothing
 * here waits for the office to exist.
 *
 * ── WHERE IT LIVES ───────────────────────────────────────────────────────
 *
 * On the house, as a tag, because it is the house's knowledge rather than the
 * recruit's, and tags already persist with the house's row. It is dropped once
 * they are entered, or once they are no longer on that roll.
 */

import { getLocation, type FactionRecord, type WorldState } from './world-state.js';
import type { NpcRecord } from './npc-state.js';
import type { LocationRecord } from './locations.js';
import {
    THE_INTERNAL_AFFAIRS_ELDER,
    THE_ROOM_THE_ROLL_IS_KEPT_IN
} from './a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { whoAnswersAbout } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { rankName } from '../cultivation/realms.js';
import { whoAHouseWillTake } from '../../data/cultivation/the-three-floors-a-house-admits-at.js';
import { isOutLookingForDisciples } from './when-a-house-takes-people-on.js';

/**
 * Whoever holds the Internal Affairs office: the room the roll is kept in.
 *
 * THIS SAID IT WAS NULL IN EVERY HOUSE, on the grounds that `ancestral_hall` is
 * not an office, and the room moved to the life lamp hall without the sentence
 * following it. Measured over two seeds
 * (`scripts/probe-who-runs-internal-affairs.ts`): every seated house that has
 * the hall has a holder - 38 of 38 at world open, 32 of 32 at 500 years - so
 * anything written on the strength of the old sentence was written against a
 * world that does not exist.
 *
 * Null still means something, and it is narrower: a house whose compound has no
 * life lamp hall cut for it at all.
 */
export function theInternalAffairsElderIn(
    locations: readonly LocationRecord[],
    house: { id: string; ranks: readonly string[] },
    roll: readonly { id: string; rankIndex: number }[]
): string | null {
    return whoAnswersAbout(portfoliosIn({
        locations,
        sectId: house.id,
        roll,
        rankCount: house.ranks.length
    }), THE_ROOM_THE_ROLL_IS_KEPT_IN);
}

const EXPECTS = 'expects|';
const OWES_A_REPORT = 'owes-a-report|';
const TAKEN_ON = 'taken-on|';

/** Who a report of a recruit is for. One office, named by its title. */
export type AddressedTo = typeof THE_INTERNAL_AFFAIRS_ELDER;

export interface SomebodyTheHouseExpects {
    personId: string;
    personName: string;
    /** Who took them on. */
    recruiterId: string | null;
    recruiterName: string | null;
    whereId: string | null;
    whereName: string | null;
    takenOnDay: number;
    /** Who brought the word to the house, and the day it arrived. */
    reportedById: string | null;
    reportedOnDay: number;
    addressedTo: AddressedTo;
    /** Whoever held the Internal Affairs office when it arrived. Null for nobody. */
    receivedById: string | null;
}

/** A report a recruiter has not yet made. */
export interface AReportOwed {
    houseId: string;
    personId: string;
    personName: string;
    whereId: string | null;
    whereName: string | null;
    takenOnDay: number;
}

const enc = (v: string | null) => (v === null ? '' : encodeURIComponent(v));
const dec = (v: string | undefined) => (v === undefined || v === '' ? null : decodeURIComponent(v));

function expectsTag(e: SomebodyTheHouseExpects): string {
    return EXPECTS + [
        e.personId, e.personName, e.recruiterId, e.recruiterName, e.whereId, e.whereName,
        String(e.takenOnDay), e.reportedById, String(e.reportedOnDay), e.addressedTo, e.receivedById
    ].map(enc).join('|');
}

function fromExpectsTag(tag: string): SomebodyTheHouseExpects | null {
    const f = tag.slice(EXPECTS.length).split('|');
    const personId = dec(f[0]);
    if (personId === null) return null;
    return {
        personId,
        personName: dec(f[1]) ?? '',
        recruiterId: dec(f[2]),
        recruiterName: dec(f[3]),
        whereId: dec(f[4]),
        whereName: dec(f[5]),
        takenOnDay: Number(dec(f[6]) ?? 0),
        reportedById: dec(f[7]),
        reportedOnDay: Number(dec(f[8]) ?? 0),
        addressedTo: THE_INTERNAL_AFFAIRS_ELDER,
        receivedById: dec(f[10])
    };
}

function owedTag(r: AReportOwed): string {
    return OWES_A_REPORT + [r.houseId, r.personId, r.personName, r.whereId, r.whereName, String(r.takenOnDay)]
        .map(enc).join('|');
}

function fromOwedTag(tag: string): AReportOwed | null {
    const f = tag.slice(OWES_A_REPORT.length).split('|');
    const houseId = dec(f[0]);
    const personId = dec(f[1]);
    if (houseId === null || personId === null) return null;
    return {
        houseId, personId,
        personName: dec(f[2]) ?? '',
        whereId: dec(f[3]),
        whereName: dec(f[4]),
        takenOnDay: Number(dec(f[5]) ?? 0)
    };
}

/** Everybody this house is expecting. */
export function whoTheHouseExpects(house: Pick<FactionRecord, 'tags'>): SomebodyTheHouseExpects[] {
    return house.tags.filter(t => t.startsWith(EXPECTS)).map(fromExpectsTag)
        .filter((e): e is SomebodyTheHouseExpects => e !== null);
}

/** Whether this house expects this person, and on whose word. */
export function doesTheHouseExpect(
    house: Pick<FactionRecord, 'tags'>,
    personId: string
): SomebodyTheHouseExpects | null {
    return whoTheHouseExpects(house).find(e => e.personId === personId) ?? null;
}

/** The reports this person still owes. */
export function theReportsTheyOwe(npc: Pick<NpcRecord, 'tags'>): AReportOwed[] {
    return npc.tags.filter(t => t.startsWith(OWES_A_REPORT)).map(fromOwedTag)
        .filter((r): r is AReportOwed => r !== null);
}

/**
 * THE ONE WAY AN EXPECTATION IS WRITTEN. A report of somebody taken on reaches
 * the Internal Affairs office - whatever carried it - and the house expects them.
 * Replaces an earlier expectation of the same person, and clears the report from
 * whoever owed it.
 */
export function theHouseExpects(
    state: WorldState,
    report: {
        houseId: string;
        person: { id: string; name: string };
        recruiter: { id: string; name: string } | null;
        where: { id: string; name: string } | null;
        takenOnDay: number;
        /** Who brought the word, and the day it reached the house. */
        reportedBy: { id: string } | null;
        onDay: number;
        addressedTo: AddressedTo;
    }
): SomebodyTheHouseExpects | null {
    const at = state.factions.findIndex(f => f.id === report.houseId && f.dissolvedOnDay === null);
    if (at < 0) return null;
    const house = state.factions[at]!;
    const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
    const expected: SomebodyTheHouseExpects = {
        personId: report.person.id,
        personName: report.person.name,
        recruiterId: report.recruiter?.id ?? null,
        recruiterName: report.recruiter?.name ?? null,
        whereId: report.where?.id ?? null,
        whereName: report.where?.name ?? null,
        takenOnDay: Math.floor(report.takenOnDay),
        reportedById: report.reportedBy?.id ?? null,
        reportedOnDay: Math.floor(report.onDay),
        addressedTo: report.addressedTo,
        receivedById: theInternalAffairsElderIn(
            state.locations, house, roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex })))
    };
    state.factions[at] = {
        ...house,
        tags: [
            ...house.tags.filter(t => !(t.startsWith(EXPECTS) && fromExpectsTag(t)?.personId === expected.personId)),
            expectsTag(expected)
        ]
    };
    if (report.reportedBy !== null) theReportIsDelivered(state, report.reportedBy.id, report.houseId, report.person.id);
    return expected;
}

/** The report is made: whoever owed it no longer does. */
export function theReportIsDelivered(state: WorldState, reporterId: string, houseId: string, personId: string): void {
    const at = state.npcs.findIndex(n => n.id === reporterId);
    if (at < 0) return;
    const npc = state.npcs[at]!;
    const kept = npc.tags.filter(t => {
        if (!t.startsWith(OWES_A_REPORT)) return true;
        const r = fromOwedTag(t);
        return !(r && r.houseId === houseId && r.personId === personId);
    });
    if (kept.length !== npc.tags.length) state.npcs[at] = { ...npc, tags: kept };
}

/** The house stops expecting somebody: they arrived and were entered, or they are not coming. */
export function theHouseStopsExpecting(state: WorldState, houseId: string, personId: string): void {
    const at = state.factions.findIndex(f => f.id === houseId);
    if (at < 0) return;
    const house = state.factions[at]!;
    const kept = house.tags.filter(t => !(t.startsWith(EXPECTS) && fromExpectsTag(t)?.personId === personId));
    if (kept.length !== house.tags.length) state.factions[at] = { ...house, tags: kept };
}

/**
 * Who of a house took somebody on. The world's intake enrols people anywhere in
 * the house's province without putting a recruiter beside them, so this names
 * the one of the house most plausibly the one: standing at the same place first;
 * then, anywhere in reach, somebody out looking for disciples, then somebody in
 * the house's own compound - where an applicant who walked up to the gate meets
 * the house - then somebody posted, then anybody; the most senior within each.
 * Null where the house has nobody in reach, and then nobody owes a report.
 */
export function whoTookThemOn(
    npcs: readonly NpcRecord[],
    input: {
        houseId: string;
        personId: string;
        placeId: string | null;
        /** Whether a place is in the house's reach of the recruit. Defaults to the same place only. */
        inReach?: (locationId: string | null) => boolean;
        /** Whether a place is inside the house's compound. Defaults to nowhere. */
        atTheHouse?: (locationId: string | null) => boolean;
    }
): { id: string; name: string } | null {
    const inReach = input.inReach ?? ((id: string | null) => id !== null && id === input.placeId);
    const atTheHouse = input.atTheHouse ?? (() => false);
    let best: NpcRecord | null = null;
    let bestScore = -1;
    for (const n of npcs) {
        if (n.status !== 'alive' || n.factionId !== input.houseId || n.id === input.personId) continue;
        const here = input.placeId !== null && n.locationId === input.placeId;
        const home = atTheHouse(n.locationId);
        if (!here && !home && !inReach(n.locationId)) continue;
        const what = isOutLookingForDisciples(n.activity) ? 3
            : home ? 2
                : n.activity?.kind === 'stationed' ? 1 : 0;
        const score = (here ? 1 : 0) * 100_000 + what * 1000 + Math.max(0, n.factionRankIndex);
        if (score > bestScore || (score === bestScore && best !== null && n.id < best.id)) {
            best = n;
            bestScore = score;
        }
    }
    return best ? { id: best.id, name: best.name } : null;
}

/**
 * Somebody was taken on, and whoever of the house took them on now owes the
 * house a report of it. Returns the recruiter, or null where the house had
 * nobody who could have - and then nobody reports anything.
 */
export function aRecruiterOwesTheHouseAReport(
    state: WorldState,
    input: {
        houseId: string;
        person: { id: string; name: string };
        placeId: string | null;
        onDay: number;
        inReach?: (locationId: string | null) => boolean;
        atTheHouse?: (locationId: string | null) => boolean;
    }
): { id: string; name: string } | null {
    const seat = state.factions.find(f => f.id === input.houseId)?.seatLocationId ?? null;
    const recruiter = whoTookThemOn(state.npcs, {
        houseId: input.houseId,
        personId: input.person.id,
        placeId: input.placeId,
        inReach: input.inReach,
        atTheHouse: input.atTheHouse ?? (id => insideTheSeat(state, id, seat))
    });
    if (recruiter === null) return null;
    return theyOweTheHouseAReport(state, recruiter.id, input) ? recruiter : null;
}

/**
 * This recruiter took this person on at this place. They owe the house a report
 * of it, and the person taken on knows who took them on and where, which is what
 * they say at the gate. For a caller that already knows who the recruiter was -
 * the player's join, where they are standing in front of the player. False where
 * the recruiter has no row.
 */
export function theyOweTheHouseAReport(
    state: WorldState,
    recruiterId: string,
    input: { houseId: string; person: { id: string; name: string }; placeId: string | null; onDay: number }
): boolean {
    const at = state.npcs.findIndex(n => n.id === recruiterId);
    if (at < 0) return false;
    const recruiterRow = state.npcs[at]!;
    const where = input.placeId === null ? null : state.locations.find(l => l.id === input.placeId) ?? null;
    const owed: AReportOwed = {
        houseId: input.houseId,
        personId: input.person.id,
        personName: input.person.name,
        whereId: where?.id ?? null,
        whereName: where?.name ?? null,
        takenOnDay: Math.floor(input.onDay)
    };
    const others = recruiterRow.tags.filter(t =>
        !(t.startsWith(OWES_A_REPORT) && fromOwedTag(t)?.personId === input.person.id));
    state.npcs[at] = { ...recruiterRow, tags: [...others, owedTag(owed)] };

    const person = state.npcs.findIndex(n => n.id === input.person.id);
    if (person >= 0) {
        const row = state.npcs[person]!;
        const account: TheirOwnAccount = {
            houseId: input.houseId,
            recruiterId,
            recruiterName: recruiterRow.name,
            whereId: owed.whereId,
            whereName: owed.whereName,
            takenOnDay: owed.takenOnDay
        };
        state.npcs[person] = {
            ...row,
            tags: [...row.tags.filter(t => !(t.startsWith(TAKEN_ON) && fromTakenOnTag(t)?.houseId === input.houseId)),
                takenOnTag(account)]
        };
    }
    return true;
}

/** The seat or a room inside it: room, precinct, seat. */
function insideTheSeat(state: WorldState, locationId: string | null, seatId: string | null): boolean {
    if (seatId === null) return false;
    let at = locationId;
    for (let hops = 0; hops <= 3 && at !== null; hops++) {
        if (at === seatId) return true;
        at = getLocation(state, at)?.parentId ?? null;
    }
    return false;
}

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE ONE TAKEN ON SAYS AT THE GATE
// ─────────────────────────────────────────────────────────────────────────

/** Who took somebody on and where, as they themselves would say it. */
export interface TheirOwnAccount {
    houseId: string;
    recruiterId: string;
    recruiterName: string;
    whereId: string | null;
    whereName: string | null;
    takenOnDay: number;
}

function takenOnTag(a: TheirOwnAccount): string {
    return TAKEN_ON + [a.houseId, a.recruiterId, a.recruiterName, a.whereId, a.whereName, String(a.takenOnDay)]
        .map(enc).join('|');
}

function fromTakenOnTag(tag: string): TheirOwnAccount | null {
    const f = tag.slice(TAKEN_ON.length).split('|');
    const houseId = dec(f[0]);
    const recruiterId = dec(f[1]);
    if (houseId === null || recruiterId === null) return null;
    return {
        houseId, recruiterId,
        recruiterName: dec(f[2]) ?? '',
        whereId: dec(f[3]),
        whereName: dec(f[4]),
        takenOnDay: Number(dec(f[5]) ?? 0)
    };
}

/** Who this person says took them on for this house, or null for nobody. */
export function whoTheySayTookThemOn(npc: Pick<NpcRecord, 'tags'>, houseId: string): TheirOwnAccount | null {
    for (const t of npc.tags) {
        if (!t.startsWith(TAKEN_ON)) continue;
        const a = fromTakenOnTag(t);
        if (a && a.houseId === houseId) return a;
    }
    return null;
}

/**
 * What a house makes of one of its own, never entered, standing at its gate.
 *
 * The reasons are said to the one being questioned, in the second person, because
 * the one who reads them is a player at a gate.
 *
 *   expected                  the house has the report and they name the one
 *                             who made it, or the house sent for them itself
 *   admitted on questioning   no report, or not the one they name: taken to the
 *                             Internal Affairs Elder and questioned, and what they
 *                             say matches what the house knows
 *   rejected on questioning   questioned, and it does not
 *   nobody took them on       no account at all: born or woken inside the house,
 *                             which is not somebody new at its gate
 *
 * The design owner, on a recruiter who died before reporting: *"the house still
 * knows the recruiter went to the area and knows what their standards are,
 * right? Questioned and allowed if matched, else rejected."* The same questioning
 * answers for a recruiter who is alive and simply has not reported yet.
 */
export type WhatTheHouseMakesOfSomebodyNew =
    | { reading: 'expected'; word: SomebodyTheHouseExpects }
    | { reading: 'admitted on questioning'; account: TheirOwnAccount; because: string }
    | { reading: 'rejected on questioning'; account: TheirOwnAccount; because: string }
    | { reading: 'nobody took them on' };

/** How long either side of the day somebody was taken on a record of the recruiter still counts. */
const AROUND_THAT_TIME_DAYS = 365;

export function whatTheHouseMakesOfSomebodyNew(
    state: WorldState,
    house: Pick<FactionRecord, 'id' | 'name' | 'tags' | 'seatLocationId' | 'resources'>,
    person: Pick<NpcRecord, 'id' | 'tags' | 'cultivation' | 'identity'>
): WhatTheHouseMakesOfSomebodyNew {
    const word = doesTheHouseExpect(house, person.id);
    const account = whoTheySayTookThemOn(person, house.id);
    if (word !== null && (word.recruiterId === null || word.recruiterId === account?.recruiterId)) {
        return { reading: 'expected', word };
    }
    if (account === null) return { reading: 'nobody took them on' };
    const asked = questionedByTheInternalAffairsElder(state, house, person, account);
    return asked.matches
        ? { reading: 'admitted on questioning', account, because: asked.because }
        : { reading: 'rejected on questioning', account, because: asked.because };
}

/**
 * The questioning. Nothing new is kept for it: what the house knows of its own
 * people is their rows - whose they are, what they are out on and where - and
 * the record of the world, and its standard is its admission bar.
 *
 * In order: the one they name is of this house; where they say it happened is
 * somewhere; the house knows that person was in that province then - out on an
 * errand or a posting there, named there in the record within a year of it, or
 * of the house's own province with nothing putting them elsewhere; and the one
 * standing there meets what the house takes.
 */
export function questionedByTheInternalAffairsElder(
    state: WorldState,
    house: Pick<FactionRecord, 'id' | 'name' | 'seatLocationId' | 'resources'>,
    person: Pick<NpcRecord, 'id' | 'cultivation' | 'identity'>,
    account: TheirOwnAccount
): { matches: boolean; because: string } {
    const no = (because: string) => ({ matches: false, because });
    const recruiter = state.npcs.find(n => n.id === account.recruiterId) ?? null;
    if (recruiter === null || recruiter.name !== account.recruiterName || recruiter.factionId !== house.id) {
        return no(`${house.name} has nobody of its own called ${account.recruiterName} who could have taken anybody on.`);
    }
    const where = account.whereId === null ? null : getLocation(state, account.whereId);
    if (where === null) {
        return no(`You cannot say where ${account.recruiterName} took you on.`);
    }
    const province = provinceOf(state, where.id);

    let there: string | null = null;
    const then = account.takenOnDay;
    const act = recruiter.activity;
    const actCovers = act !== null && act !== undefined
        && (act.kind === 'out_with_a_party' || act.kind === 'stationed' || act.kind === 'travelling')
        && act.sinceDay <= then && (act.untilDay === undefined || act.untilDay === null || then <= act.untilDay);
    if (actCovers) {
        const actProvince = provinceOf(state, recruiter.locationId);
        if (actProvince !== province) {
            const elsewhere = actProvince === null ? null : getLocation(state, actProvince);
            return no(`${recruiter.name} was away ${elsewhere ? `in ${elsewhere.name}` : 'elsewhere'} then, `
                + `not near ${where.name}.`);
        }
        there = act!.kind === 'stationed' ? `posted in that province` : `out in that province`;
    }
    if (there === null && provinceOf(state, house.seatLocationId) === province && province !== null) {
        there = `of the house's own province`;
    }
    if (there === null) {
        const named = state.history.facts.some(fact =>
            Math.abs(fact.day - then) <= AROUND_THAT_TIME_DAYS
            && fact.actors.some(actor => actor.id === recruiter.id)
            && provinceOf(state, fact.locationId) === province);
        if (named) there = `in that province around then, by the house's own record`;
    }
    if (there === null) {
        // ── NOT KNOWING IS NOT KNOWING OTHERWISE ─────────────────────────
        //
        // Every branch above this one is the house knowing something that
        // CONTRADICTS the account: no such person, somebody who was demonstrably
        // in another province, a rung that could not have taken anybody on.
        // This branch is the house knowing nothing either way, and it was
        // returning the same verdict as the contradictions.
        //
        // Played: a Sand Servant taken on at the Wind Turn intake was turned away from
        // the gate the next day on this line, while every look in the same run
        // said the house had them down as Sand Servant. Two records of one membership,
        // disagreeing in front of the player - and the one that won was the
        // one reconstructing where somebody had been, over the one that was
        // the house's own roll.
        //
        // A recruiter at a remote intake who has not sent word yet is the
        // ORDINARY case, which is what the slip system exists for. So a house
        // with no record admits them and says it has none. It is still not a
        // clean entry, and the sentence says which kind it is.
        return {
            matches: true,
            because: `${house.name} has no record of ${recruiter.name} being anywhere near `
                + `${where.name} then, and none of them being elsewhere either.`
        };
    }

    const bar = Number(house.resources.admission_ordinal ?? 0);
    if (person.cultivation.realmOrdinal < bar) {
        return no(`${house.name} takes from ${rankName(bar)}, and you stand at `
            + `${rankName(person.cultivation.realmOrdinal)}.`);
    }
    const takes = whoAHouseWillTake(house.id);
    if (takes !== null && takes !== person.identity.sex) {
        return no(`${house.name} takes only ${takes === 'female' ? 'women' : 'men'}.`);
    }
    return {
        matches: true,
        because: `${recruiter.name} of ${house.name} was ${there} when you say you were taken on at `
            + `${where.name}, and you meet what the house takes.`
    };
}

/** The province a place is in: its region, walking up. */
function provinceOf(state: WorldState, locationId: string | null): string | null {
    let at = locationId;
    for (let hops = 0; hops < 12 && at !== null; hops++) {
        const location = getLocation(state, at);
        if (!location) return null;
        if (location.kind === 'region' || location.parentId === null) return location.id;
        at = location.parentId;
    }
    return null;
}

/** Entered: the house stops expecting them and nobody asks who took them on again. */
export function theyAreEntered(state: WorldState, houseId: string, personId: string): void {
    theHouseStopsExpecting(state, houseId, personId);
    const at = state.npcs.findIndex(n => n.id === personId);
    if (at < 0) return;
    const row = state.npcs[at]!;
    const kept = row.tags.filter(t => !(t.startsWith(TAKEN_ON) && fromTakenOnTag(t)?.houseId === houseId));
    if (kept.length !== row.tags.length) state.npcs[at] = { ...row, tags: kept };
}

/**
 * A recruiter standing in the house's compound makes the reports they owe it,
 * to the Internal Affairs office, on this day. The slip-less road.
 */
export function deliverWhatTheyOweTheHouse(state: WorldState, recruiterId: string, houseId: string, day: number): number {
    const recruiter = state.npcs.find(n => n.id === recruiterId);
    if (!recruiter) return 0;
    let made = 0;
    for (const owed of theReportsTheyOwe(recruiter)) {
        if (owed.houseId !== houseId) continue;
        theHouseExpects(state, {
            houseId,
            person: { id: owed.personId, name: owed.personName },
            recruiter: { id: recruiter.id, name: recruiter.name },
            where: owed.whereId === null ? null : { id: owed.whereId, name: owed.whereName ?? '' },
            takenOnDay: owed.takenOnDay,
            reportedBy: { id: recruiter.id },
            onDay: day,
            addressedTo: THE_INTERNAL_AFFAIRS_ELDER
        });
        made++;
    }
    return made;
}
