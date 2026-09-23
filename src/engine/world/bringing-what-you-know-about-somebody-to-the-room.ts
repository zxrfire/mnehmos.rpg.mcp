/**
 * Bringing what you know about somebody to the room, to get their place.
 *
 * The owner: *"in neutral or righteous sects you typically don't have to resort
 * to [killing]. You can just do a xianxia version of an expose and get him
 * removed from office (title kept) or expelled."* So somebody a house holds back
 * for a seat goes after the holder's record, and the house's punishment room
 * takes it from there. Every step is a module that already exists:
 *
 *   what they have     the holder's wrongs on the record the seeker carries: a
 *                      fact naming the holder as the one who did it, with the
 *                      deed's weight on it. With nothing, a less scrupulous
 *                      seeker makes a case up, which is itself a deed the world
 *                      holds and nobody has worked out.
 *   carrying it up     `whatTheWitnessDoesAboutIt`, to whoever
 *                      `whereAComplaintGoes` names.
 *   the sentence       `whatTheRoomDecides`, off the severity and the house's own
 *                      alignment.
 *   what it does to    {@link whatASentenceDoesToTheirPlace}: nothing, removal from
 *   their place        office with the title kept, or expulsion. The seat then
 *                      fills the ordinary way, and the seeker gains nothing by it
 *                      but the chance.
 *
 * A demonic house's seeker reaches for the knife more than for the room
 * (`why-one-cultivator-kills-another.ts`), and the room is the same for all.
 *
 * ── WHAT IT PRODUCES, ON `afford-a` AT 5,000 YEARS ───────────────────────
 *
 * Cases that moved somebody, a century: a demonic house putting one of its own
 * out 31, a neutral house taking an office back 32, a righteous house taking one
 * back 2.6, a neutral house putting somebody out 2. Killing for a seat, over the
 * same span, ran 0.4 a century - so the room is the route by two orders of
 * magnitude, which is the owner's ruling that an expose comes first.
 *
 * Cases MADE UP ran 63 a century at `MAKING_ONE_UP_A_YEAR` = 0.005, which was
 * half of everything brought to any room in the world; at 0.0005 it is 16 a
 * century against 20 real ones, measured at 300 years on the same seed. The
 * long-horizon figure for the cut rate is UNMEASURED.
 */

import { forStream } from '../cultivation/rng.js';
import { severityRank, type Severity } from '../social/grudges.js';
import { theRoomsThisHouseHas } from '../social-leverage/authority-for-an-order.js';
import { whereAComplaintGoes, whatTheWitnessDoesAboutIt } from '../social-leverage/reporting-what-you-saw.js';
import { whatTheRoomDecides, type Sentence } from '../social-leverage/what-a-room-decides-about-one-of-its-own.js';
import { whoIsInChargeOfWhat } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { aDeedEntersTheWorld } from './a-deed-enters-the-world-as-a-fact.js';
import { makeFact, type HistoricalFact } from './history.js';
import { relationshipWith, type NpcRecord } from './npc-state.js';
import { lifespanForOrdinal } from '../cultivation/realms.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { faceOf } from './what-a-face-is-worth.js';
import { meritWith } from './what-a-house-counts-in-somebodys-favour.js';
import { requiredContributionForRank } from '../cultivation/what-each-rung-of-a-house-ladder-requires.js';
import { theRoomTurnedThemOut } from './what-being-seen-to-do-well-is-worth.js';
import { A_FRIEND, HOSTILE_STANDING } from './why-one-cultivator-kills-another.js';
import { ROGUE_EXPELLED, offTheRoll, whereTheyRunTo } from './what-becomes-of-a-houses-people-when-it-is-gone.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { WHAT_A_HOUSE_WILL_STOMACH } from './why-one-cultivator-kills-another.js';
import { indexById, type FactionRecord, type WorldState } from './world-state.js';

/**
 * Removed from an office by the house's room, the title kept. Followed by the
 * house id and the day it was done: `removed-from-office:<houseId>:<day>`.
 */
export const REMOVED_FROM_OFFICE = 'removed-from-office:';

/** A room taken off somebody: which house did it, and on what day. */
export interface TheRemovalTheyCarry {
    houseId: string;
    day: number;
}

/**
 * The removal this person carries, whoever they are standing with now.
 *
 * A DISGRACE FOLLOWS THE PERSON, NOT THE HOUSE. This read the tag keyed on the
 * npc's CURRENT `factionId`, which was harmless while nobody could move: a
 * person a house had taken an office off stayed where they were or stayed off
 * every roll. Once the doors opened - a strong outsider taken in as a guest
 * elder, a record read as an opinion rather than a wall - somebody could lose an
 * office at one house and turn up on another's roll, and then the tag named a
 * house the lookup was not asking about, the weight silently evaluated to zero,
 * and the disgrace cost them nothing at all.
 *
 * Measured across the change that caused it: with the doors shut, 7 people
 * carried a removal and the median time since was 334 years; with them open, 11
 * carried one, ALL of them read as freely eligible, and the median fell to 3.
 * One change dissolving another, and nothing failed.
 */
export function theRemovalTheyCarry(npc: Pick<NpcRecord, 'tags'>): TheRemovalTheyCarry | null {
    for (const tag of npc.tags) {
        if (!tag.startsWith(REMOVED_FROM_OFFICE)) continue;
        const rest = tag.slice(REMOVED_FROM_OFFICE.length);
        const at = rest.lastIndexOf(':');
        if (at <= 0) continue;
        const when = Number(rest.slice(at + 1));
        if (!Number.isFinite(when)) continue;
        return { houseId: rest.slice(0, at), day: when };
    }
    return null;
}

/** The day a house took an office off them, or null. */
export function theDayTheyLostTheOffice(npc: Pick<NpcRecord, 'tags'>): number | null {
    return theRemovalTheyCarry(npc)?.day ?? null;
}

// AND WHETHER THE ROOM EVER COMES BACK TO THEM

/**
 * What a removal weighs against somebody, in the units `what-a-face-is-worth.ts`
 * prices a public win over an equal in.
 *
 * THE OWNER'S RULING, asked whether a removal is permanent: *"depends on your
 * influence so not permanent"*. What stood was the sentence ladder - demoted,
 * removed from office with the title kept, expelled. What fell was this being a
 * gate: a predicate on the tag filtered somebody out of the dealing for ever,
 * and a door closing is not a door bricked up.
 *
 * So it is a weight and not a gate, and what is weighed against it is what they
 * are worth to the house NOW - not time served and not a counter. Four public
 * wins is heavy: somebody a room took an office off has to be visibly worth
 * more to the house than the disgrace costs it to keep them. An exposé that
 * cost a room for a decade and nothing else would make that route worthless,
 * and it is how a seat changes hands in a righteous or neutral house - measured
 * at 31 and 32 cases a century against killing for a seat at 0.4.
 *
 * UNMEASURED. What has to be read afterwards: how many people who lost an
 * office ever hold one again, and how long it took. Nobody ever, and this is a
 * gate in different clothes; most of them inside a century, and it costs
 * nothing.
 */
export const WHAT_A_REMOVAL_WEIGHS = 4;

/**
 * The share of somebody's own life over which a room's memory of a disgrace
 * halves.
 *
 * Slow, and on a cultivator's clock rather than a mortal's: a fiftieth of a
 * span is two years to a villager, a couple of hundred to an elder of a great
 * house and two thousand at the top of the ladder. The fade is the lesser half
 * of this rule - influence is the half that decides - and it exists so that a
 * disgrace nobody alive remembers is not still being enforced.
 */
export const WHAT_A_ROOM_REMEMBERS_OF_A_LIFE = 0.02;

/**
 * And the least a room remembers, whoever it was about.
 *
 * A fiftieth of a life is two years to somebody with a mortal's span, and a
 * disgrace that has evaporated within a decade is not a disgrace - the expose
 * route would cost an outer hall's elder nothing at all. Found by the test
 * rather than by reading: a low-rung row came out at effectively nought after a
 * century. The room is a house, and a house of cultivators remembers longer
 * than the shortest-lived person in it.
 */
export const THE_LEAST_A_ROOM_REMEMBERS = 50;

/** How heavy their removal still is, at this day. */
export function howHeavyTheirRemovalStillIs(npc: NpcRecord, day: number): number {
    const when = theDayTheyLostTheOffice(npc);
    if (when === null) return 0;
    const span = Math.max(1, lifespanForOrdinal(npc.cultivation.realmOrdinal));
    const halfLife = Math.max(THE_LEAST_A_ROOM_REMEMBERS, WHAT_A_ROOM_REMEMBERS_OF_A_LIFE * span);
    const years = Math.max(0, (day - when) / DAYS_PER_YEAR);
    return WHAT_A_REMOVAL_WEIGHS * Math.pow(0.5, years / halfLife);
}

/**
 * What one public win is worth in contribution: as much as the last rung of
 * this house's own ladder asks for.
 *
 * READ OFF THE LADDER, NOT COPIED. A win in front of everybody is worth what a
 * career of service buys at the hardest step, so the two move together and
 * nobody has to remember they are related.
 *
 * It was a flat hundred, and that was the whole defect. Measured on `afford-a`
 * at a thousand years, over the twelve people carrying a removal: face 0,
 * people who would speak for them 1.29, and **service 505.79** against a weight
 * of four. The bar was not a bar - a carrier cleared it by a hundred and
 * twenty-six times on the day the room ruled against them, which is why taking
 * the rung out of this read moved neither the count nor the median. Real house
 * merit runs to tens of thousands; a hundred was two orders of magnitude out.
 *
 * NOTE WHAT IS NOT READ HERE: the rung they stand on. That is the thing the
 * disgrace deliberately left them, and only the LENGTH of the ladder is taken,
 * never their place on it.
 */
export function whatServiceIsWorthBesideAWin(house: Pick<FactionRecord, 'ranks'>): number {
    return Math.max(1, requiredContributionForRank(Math.max(1, house.ranks.length - 1)));
}

/** The most the people who would speak for somebody can be worth. */
export const THE_MOST_BEING_SPOKEN_FOR_IS_WORTH = 2;

/**
 * What somebody is worth to their own house today, in the same units.
 *
 * WHAT THE DISGRACE LEFT THEM CANNOT BE WHAT BUYS BACK WHAT IT TOOK. The rung
 * was in this read and was worth half the bar on its own, so somebody kept their
 * title through a removal - the owner's ruling is that a house takes *"the room,
 * not the rank"*, title kept - and then spent that same title to undo it. Close
 * to the disgrace paying for its own removal, and backwards in the genre's
 * terms: it made a SENIOR's disgrace the cheapest to outgrow, when a senior's is
 * the one everybody saw and the one that cost the house most.
 *
 * So influence here is what they have REBUILT SINCE: face won in front of
 * people, contribution their own house counted, and who on the roll would speak
 * for them. Not the rung they were already standing on.
 *
 * Measured before the rung came out, on `afford-a` at a thousand years: twelve
 * people carried a removal and all twelve could hold a room again, at a median
 * of fifty-two years - and only one of the twelve had changed house, so the
 * lookup this file also fixed was never the reason.
 */
export function whatTheyAreWorthToTheirHouseNow(
    state: WorldState,
    npc: NpcRecord,
    house: Pick<FactionRecord, 'id' | 'ranks'>
): number {
    const service = meritWith(npc, house.id) / whatServiceIsWorthBesideAWin(house);
    let speakingForThem = 0;
    for (const other of state.npcs) {
        if (other.id === npc.id || other.factionId !== house.id || other.status !== 'alive') continue;
        const tie = relationshipWith(other, npc.id);
        if (tie !== null && tie.standing >= A_FRIEND) speakingForThem += 0.5;
    }
    return Math.max(0, faceOf(npc)) + service
        + Math.min(THE_MOST_BEING_SPOKEN_FOR_IS_WORTH, speakingForThem);
}

/**
 * What THIS house makes of a disgrace earned somewhere else, 0..1.
 *
 * A disgrace earned at another house does not weigh what one earned here does,
 * and the lens is the one the record at the door already uses rather than a
 * second opinion: `WHAT_A_HOUSE_WILL_STOMACH` by alignment. A demonic house
 * makes nothing of it at all - being thrown out of a righteous hall is closer to
 * a recommendation - a neutral house discounts it, and a righteous house holds
 * most of it against them. And a condemnation from a house this one is hostile
 * to is worth half again less: a rival's judgement is not evidence here.
 */
export function whatThisHouseMakesOfADisgraceElsewhere(
    removedAt: string,
    house: Pick<FactionRecord, 'id' | 'alignment' | 'standing'>
): number {
    if (removedAt === house.id) return 1;
    const stomach = WHAT_A_HOUSE_WILL_STOMACH[String(house.alignment ?? 'none')]
        ?? WHAT_A_HOUSE_WILL_STOMACH.none!;
    // How much this house cares about somebody else's ruling: the inverse of
    // how far its own people will go for an ordinary deed.
    const cares = Math.max(0, 1 - stomach.ordinary);
    const theirs = house.standing[removedAt] ?? 0;
    return theirs <= HOSTILE_STANDING ? cares / 2 : cares;
}

/**
 * Whether the house's room would deal to this person again.
 *
 * True for everybody it never took anything off, which is nearly everybody.
 */
export function theRoomWouldDealToThemAgain(
    state: WorldState,
    npc: NpcRecord,
    house: Pick<FactionRecord, 'id' | 'ranks' | 'alignment' | 'standing'>,
    day: number
): boolean {
    const carried = theRemovalTheyCarry(npc);
    if (carried === null) return true;
    const weighs = howHeavyTheirRemovalStillIs(npc, day)
        * whatThisHouseMakesOfADisgraceElsewhere(carried.houseId, house);
    if (weighs <= 0) return true;
    return whatTheyAreWorthToTheirHouseNow(state, npc, house) >= weighs;
}

/** How often, in a year, somebody held back with something on the holder brings it. */
export const BRINGING_IT_A_YEAR = 0.02;

/**
 * How often, in a year, somebody held back with nothing on the holder makes
 * something up, before conscience.
 *
 * A quarter of what it was. Measured at two and a half thousand years on
 * `afford-a`, cases made up ran at 76 a century against 79 real ones - half of
 * everything brought to a room in the world was a fabrication, which is not a
 * world with a punishment room in it, it is a world with a rumour mill. At a
 * quarter of that it was 28 a century against 33 real, and this is the cut that
 * puts it where a fabrication is the exception it should be.
 */
export const MAKING_ONE_UP_A_YEAR = 0.0005;

export type WhatItDoesToTheirPlace = 'nothing' | 'removed from office' | 'expelled';

/**
 * What a sentence does to somebody's place in the house. The ladder is the room's
 * and is not re-ordered: what the house gave taken back, and a term held, take
 * the office; the capability taken, or worse, and they are out.
 */
export function whatASentenceDoesToTheirPlace(sentence: Sentence): WhatItDoesToTheirPlace {
    switch (sentence) {
        case 'what the house gave is taken back':
        case 'years sealed and held':
            return 'removed from office';
        case 'the capability taken':
        case 'death':
            return 'expelled';
        default:
            return 'nothing';
    }
}

/** The heaviest wrong on the record the seeker carries that names the holder as the one who did it. */
export function whatTheyHaveOnThem(
    state: WorldState,
    seeker: NpcRecord,
    holder: NpcRecord,
    byId?: ReadonlyMap<string, HistoricalFact>
): { fact: HistoricalFact; severity: Severity } | null {
    const carried = new Set(seeker.historyFactIds);
    let best: { fact: HistoricalFact; severity: Severity } | null = null;
    for (const id of holder.historyFactIds) {
        if (!carried.has(id)) continue;
        const fact = byId?.get(id) ?? state.history.facts.find(f => f.id === id);
        const weight = fact?.data?.deedWeight;
        if (!fact || typeof weight !== 'string') continue;
        if (!fact.actors.some(a => a.id === holder.id && (a.role === 'killer' || a.role === 'attacker'))) continue;
        const severity = weight as Severity;
        if (best === null || severityRank(severity) > severityRank(best.severity)) best = { fact, severity };
    }
    return best;
}

export interface AnExpose {
    seekerId: string;
    holderId: string;
    houseId: string;
    madeUp: boolean;
    sentence: Sentence;
    place: WhatItDoesToTheirPlace;
}

/** One year of it, for every seeker the promotion read holds back. */
export function peopleBringWhatTheyKnowToTheRoom(
    state: WorldState,
    year: number,
    day: number,
    seatsTheyWant: ReadonlyMap<string, ReadonlySet<string>>
): AnExpose[] {
    const out: AnExpose[] = [];
    const houses = new Map(state.factions.filter(f => f.dissolvedOnDay === null).map(f => [f.id, f] as const));
    const touched = new Set<string>();
    // The ledger by id, once: a `find` per shared row is a walk of every fact in
    // the world for every seeker in it.
    const factsById = new Map(state.history.facts.map(f => [f.id, f] as const));
    for (const [seekerId, holderIds] of seatsTheyWant) {
        const seeker = state.npcs[indexById(state.npcs, seekerId)];
        if (!seeker || seeker.status !== 'alive' || seeker.factionId === null || touched.has(seekerId)) continue;
        const house = houses.get(seeker.factionId);
        if (!house) continue;
        for (const holderId of holderIds) {
            const holder = state.npcs[indexById(state.npcs, holderId)];
            if (!holder || holder.status !== 'alive' || holder.factionId !== house.id || touched.has(holderId)) continue;
            const rng = forStream(state.seed, 'an-expose', year, seekerId, holderId);
            const real = whatTheyHaveOnThem(state, seeker, holder, factsById);
            const stomach = WHAT_A_HOUSE_WILL_STOMACH[house.alignment] ?? WHAT_A_HOUSE_WILL_STOMACH.none!;
            const brings = real !== null
                ? rng.chance(BRINGING_IT_A_YEAR)
                : rng.chance(MAKING_ONE_UP_A_YEAR * stomach.evil);
            if (!brings) continue;
            const exposed = aRoomHearsIt(state, house, seeker, holder, real, day);
            if (exposed === null) continue;
            touched.add(seekerId);
            touched.add(holderId);
            out.push(exposed);
            break;
        }
    }
    return out;
}

/** The room hears what the seeker brought about the holder, and it lands. Null where the seeker does not carry it up. */
export function aRoomHearsIt(
    state: WorldState,
    house: FactionRecord,
    seeker: NpcRecord,
    holder: NpcRecord,
    real: { fact: HistoricalFact; severity: Severity } | null,
    day: number
): AnExpose | null {
    const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id)
        .map(n => ({ id: n.id, rankIndex: n.factionRankIndex }));
    const portfolios = whoIsInChargeOfWhat({ rooms: theRoomsThisHouseHas(state.locations, house.id), roll, rankCount: house.ranks.length });
    const head = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id)
        .sort((a, b) => b.factionRankIndex - a.factionRankIndex || (a.id < b.id ? -1 : 1))[0] ?? null;
    const toId = whereAComplaintGoes({ portfolios, aboutId: holder.id, headId: head?.id ?? null });
    const tie = relationshipWith(seeker, holder.id);
    const carried = whatTheWitnessDoesAboutIt({
        witness: { id: seeker.id, name: seeker.name, standing: tie?.standing ?? null, role: 'rival' },
        theyOweYou: 0,
        theyHoldAboutYou: 0,
        toId,
        rungsAbove: holder.factionRankIndex - seeker.factionRankIndex
    });
    if (carried.does !== 'reports') return null;

    const madeUp = real === null;
    const decided = whatTheRoomDecides({
        what: carried,
        theirsToPunish: true,
        alignment: house.alignment,
        severity: real?.severity ?? 'grave',
        houseId: house.id,
        theHouseGaveThemSomething: true
    });
    const place = whatASentenceDoesToTheirPlace(decided.sentence);

    const at = indexById(state.npcs, holder.id);
    // AND IT COSTS THEM IN FRONT OF THE ROOM. The expose route is how a seat
    // changes hands in a righteous or neutral house, and until this call the
    // holder turned out of an office lost nothing anybody could read. See
    // `what-being-seen-to-do-well-is-worth.ts`.
    if (place !== 'nothing' && at >= 0) {
        theRoomTurnedThemOut(state, holder.id, day, place === 'expelled');
    }
    if (place === 'expelled') {
        state.npcs[at] = offTheRoll(state.npcs[at]!, day, `${ROGUE_EXPELLED}${house.id}`, whereTheyRunTo(state, house));
    } else if (place === 'removed from office') {
        const row = state.npcs[at]!;
        state.npcs[at] = { ...row, tags: Array.from(new Set([...row.tags, `${REMOVED_FROM_OFFICE}${house.id}:${day}`])), updatedOnDay: day };
    }
    // AND ONLY WHAT MOVED SOMEBODY IS WRITTEN DOWN. A room that read it and
    // handed down a rebuke is the house's own business, and a fact for every one
    // of those is a chronicle of paperwork: measured at five hundred years,
    // 1,365 rows.
    if (place === 'nothing') {
        return { seekerId: seeker.id, holderId: holder.id, houseId: house.id, madeUp, sentence: decided.sentence, place };
    }
    const summary = `${seeker.name} brought ${madeUp ? 'a case' : 'what ' + holder.name + ' had done'} to the ${house.name}'s room. `
        + (place === 'expelled' ? `${holder.name} was put out of the house.`
            : place === 'removed from office' ? `${holder.name} keeps the title and lost the office.`
                : `It came to ${decided.sentence}.`);
    appendWorldFact(state, makeFact({
        day, kind: 'grudge_opened', scale: 'local', summary,
        actors: [
            { id: seeker.id, name: seeker.name, role: 'brought it' },
            { id: holder.id, name: holder.name, role: 'sentenced' }
        ],
        locationId: house.seatLocationId, factionIds: [house.id], visibility: 'faction', magnitude: 0.4,
        data: { expose: true, sentence: decided.sentence, place, unattributed: 'Somebody senior in a house up the valley has been disgraced.' }
    }));
    // A CASE MADE UP IS ITSELF A DEED, held by the world and worked out by
    // nobody yet.
    if (madeUp) {
        aDeedEntersTheWorld(state, {
            kind: 'grudge_opened', day, locationId: house.seatLocationId, factionIds: [house.id],
            actors: [
                { id: seeker.id, name: seeker.name, role: 'made it up' },
                { id: holder.id, name: holder.name, role: 'wronged' }
            ],
            summary: `${seeker.name} made up the case against ${holder.name}.`,
            unattributed: 'Somebody in a house up the valley brought a case against one of its seniors.',
            weight: 'grave',
            workedOut: false,
            data: { expose: true, madeUp: true }
        });
    }
    return { seekerId: seeker.id, holderId: holder.id, houseId: house.id, madeUp, sentence: decided.sentence, place };
}
