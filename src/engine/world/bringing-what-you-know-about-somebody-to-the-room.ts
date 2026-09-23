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
import { ROGUE_EXPELLED, offTheRoll, whereTheyRunTo } from './what-becomes-of-a-houses-people-when-it-is-gone.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { WHAT_A_HOUSE_WILL_STOMACH } from './why-one-cultivator-kills-another.js';
import { indexById, type FactionRecord, type WorldState } from './world-state.js';
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
    if (place === 'expelled') {
        state.npcs[at] = offTheRoll(state.npcs[at]!, day, `${ROGUE_EXPELLED}${house.id}`, whereTheyRunTo(state, house));
    } else if (place === 'removed from office') {
        const row = state.npcs[at]!;
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
