/**
 * Ground that teaches a road, as a player can meet it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Twenty-three dao grounds are seeded into every world -
 * `data/cultivation/places-that-teach-a-dao.ts` authors them and
 * `engine/world/how-a-cultivator-comes-by-a-road.ts` plants them as ordinary
 * locations - and NOTHING A PLAYER COULD TYPE REACHED ONE. The world's own
 * reach list, `daoGroundsInReachOf`, had no caller anywhere in `src/web` or
 * `src/server`; every NPC alive was walking roads off ground the player could
 * not name, could not be told about, and got nothing from while standing on it.
 *
 * It was found while closing a discovery leak in the travel list, which had
 * been handing fresh cultivators The Glass Field and The Nine-City Assize by
 * name because open grounds seed as ordinary `wilds`. Those bare names were the
 * ONLY place a player ever saw one. Closing the leak made the absence visible;
 * it did not create it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * A GROUND IS A LANDMARK, AND KNOWING IT IS NOT READING IT
 * ═════════════════════════════════════════════════════════════════════════
 *
 * The rule is `howSomebodyStandsToAGround`, in the engine, and it is the same
 * rule the world runs for its own people. This module holds none of it. What it
 * adds is the two things that only make sense for somebody being played:
 *
 *   A SOURCE     the player learns of a ground from somebody who could point at
 *                it - which is to say from a person whose own life puts it in
 *                front of them. Everybody in the Quiet Marches can tell you
 *                where the Grinding Ford is; the carts have been crossing it for
 *                six hundred years. Almost none of them has ever taken anything
 *                from it. That gap is the whole content of the channel, and it
 *                is why the source is `knowsWhereItIs` and never `inReach`.
 *   A REFUSAL    a ground that will not teach this cultivator says so, and says
 *                what would change it. The standard is the one the rest of this
 *                build already holds to: the physician names the pill at its
 *                price, the trial names exactly what the claimant is short by.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DISCOVERY GATE IS NOT TOUCHED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `docs/world/discovery.md`: never reference an entity the player has no
 * knowledge record for, and each step needs a source. So nothing here lists a
 * ground the player cannot already point at. What was missing was never a
 * listing - it was that NO SOURCE IN THE WORLD COULD EVER GRANT ONE, so the
 * gate was default-deny over an empty set. A channel that writes the record is
 * the fix; a listing that skips the gate is the leak that was just closed.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * NOTHING HERE IS ENUMERATED
 * ═════════════════════════════════════════════════════════════════════════
 *
 * Every sentence below is composed from fields the catalog row already carries
 * - its access kind, its floor, its holder, its subject. A twenty-fourth ground
 * needs no branch anywhere in this file, and neither did the four the world
 * digs out of ruins on its own, which carry the same `data` keys and arrive
 * through the same reader.
 */

import type { InsightDomain } from '../schema/cultivation.js';
import type { LocationRecord } from '../engine/world/locations.js';
import type { WorldState } from '../engine/world/world-state.js';
import { npcsAt } from '../engine/world/world-state.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import {
    ARTIFACT_LEGIBLE_WITHIN,
    DAO_GROUND_TAG,
    STANDING_TO_STUDY_A_HOUSE_OBJECT,
    daoGroundsAround,
    groundAtLocation,
    howSomebodyStandsToAGround,
    objectsThatCarryARoad,
    regionCatalogIdOf,
    standingOfNpc,
    type GroundAsTheRuleReadsIt,
    type HowSomebodyStandsToAGround,
    type ShortOfAGround,
    type SomebodyHolding,
    type SomebodyStanding
} from '../engine/world/how-a-cultivator-comes-by-a-road.js';
import { rankName } from '../engine/cultivation/realms.js';
import { getRegion } from '../data/cultivation/regions.js';
import { getSect } from '../data/cultivation/sects.js';

// ─────────────────────────────────────────────────────────────────────────
// ONE GROUND, AS A PLAYER MEETS IT
// ─────────────────────────────────────────────────────────────────────────

/** A dao ground the player has some business with, and how they stand to it. */
export interface GroundNearby {
    /** World location id. What a knowledge record is written against. */
    id: string;
    /** The name the world prints, and therefore the name it must accept back. */
    name: string;
    domain: InsightDomain;
    subject: string;
    ground: GroundAsTheRuleReadsIt;
    standing: HowSomebodyStandsToAGround;
    /** They are standing on it right now. */
    underfoot: boolean;
}

/** Every dao ground in the world, with how this cultivator stands to each. */
export function groundThatTeachesARoad(
    state: WorldState,
    who: SomebodyStanding,
    standingAtLocationId: string | null = null
): GroundNearby[] {
    return daoGroundsAround(state, who).map(row => ({
        id: row.sourceId,
        name: row.sourceName,
        domain: row.domain,
        subject: row.subject,
        ground: row.ground,
        standing: row.standing,
        underfoot: standingAtLocationId !== null && row.sourceId === standingAtLocationId
    }));
}

/**
 * The dao ground records the world holds, by name.
 *
 * Used to answer "am I standing on one", which the location table can say and
 * the region gazetteer cannot: a dao ground is a world location and is not a
 * catalog place, so every read that resolved a player's whereabouts through
 * `regionIdOfPlace` fell through to the home province the moment they actually
 * went to one.
 */
export function daoGroundRecords(state: WorldState): LocationRecord[] {
    return state.locations.filter(l => l.tags.includes(DAO_GROUND_TAG));
}

/** The ground the player is standing on, matched the way place names match. */
export function groundUnderfoot(
    state: WorldState,
    locationName: string | null | undefined,
    key: (name: string) => string
): LocationRecord | null {
    const wanted = key(locationName ?? '');
    if (wanted.length === 0) return null;
    return daoGroundRecords(state).find(l => key(l.name) === wanted) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// SOMEBODY WHO COULD POINT YOU AT ONE
//
// The source. `docs/world/discovery.md` lists the scarce things a step of
// knowing needs - an elder who has heard things, a traveller, a rumour that
// turns out to be half true - and this is one of them, said by the only people
// who would ever say it: the ones for whom the place is ordinary.
// ─────────────────────────────────────────────────────────────────────────

export interface SomebodyWhoKnowsWhereItIs {
    speaker: NpcRecord;
    ground: GroundNearby;
}

/**
 * Somebody standing in this square who could tell the player where a ground is.
 *
 * Deterministic in its ORDER and nothing else: the caller picks with a seeded
 * stream. Ordered by id so the same crowd on the same day offers the same list,
 * which is the same reproducibility rule `oneCrowd` states at length in
 * `hearsay.ts`.
 *
 * `unknownTo` is the caller's, because the knowledge gate is the caller's. This
 * function does not read the player at all - it reads who is here and what
 * their own lives put in front of them, which is exactly the posture
 * `speakableFor` takes: the speaker is not adjusting for their audience,
 * because it has not occurred to them that they need to.
 */
export function whoCouldPointAtAGround(
    state: WorldState,
    locationId: string
): SomebodyWhoKnowsWhereItIs[] {
    const out: SomebodyWhoKnowsWhereItIs[] = [];
    for (const npc of [...npcsAt(state, locationId)].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        for (const row of daoGroundsAround(state, standingOfNpc(state, npc))) {
            if (!row.standing.knowsWhereItIs) continue;
            out.push({
                speaker: npc,
                ground: {
                    id: row.sourceId,
                    name: row.sourceName,
                    domain: row.domain,
                    subject: row.subject,
                    ground: row.ground,
                    standing: row.standing,
                    underfoot: false
                }
            });
        }
    }
    return out;
}

/**
 * What a person who goes there would say about it, in one sentence.
 *
 * Composed from the row, never authored per ground. Two facts and no more: it
 * is there, and what people do with it. Whether it is worth anything to the
 * listener is not the speaker's business and is deliberately not said - that is
 * the refusal's job, and it belongs to the moment the player asks rather than
 * to the moment somebody mentions a ford.
 */
export function whatSomebodyWouldSayAbout(ground: GroundNearby, speakerName: string): string {
    const where = ground.ground.access === 'held'
        ? `${houseName(ground.ground.heldByFactionId) ?? 'the house'} keeps it`
        : `it is out in ${provinceName(ground.ground.regionCatalogId) ?? 'the province'}`;
    return `${speakerName} mentions ${ground.name} the way you would mention a bridge - `
        + `${where}, and people who have business with it go and stand on it. `
        + 'Nothing about why, and no offer to explain.';
}

/** The statement that goes on the knowledge record. What the player now holds. */
export function whatTheyNowHold(ground: GroundNearby): string {
    const where = ground.ground.access === 'held'
        ? `${houseName(ground.ground.heldByFactionId) ?? 'a house'} holds it`
        : `${provinceName(ground.ground.regionCatalogId) ?? 'a province'} has it standing open`;
    return `${ground.name}. ${where}. You know where it is and nothing about what it is for.`;
}

// ─────────────────────────────────────────────────────────────────────────
// AND WHAT IT WANTS, WHEN IT WANTS SOMETHING
//
// A refusal that names what would work. Every branch below states the bar, the
// thing being measured against it, and the gap - the same three facts the sect
// admission line answers with, which is the one refusal in this game that has
// always read well.
// ─────────────────────────────────────────────────────────────────────────

export interface WhatTheGroundWants {
    shortBy: ShortOfAGround;
    /** Why it teaches them nothing, standing where they are standing. */
    because: string;
    /** What would change it. Never a promise, always a bar. */
    wouldWork: string;
}

export function whatThisGroundWants(
    ground: GroundNearby,
    who: SomebodyStanding
): WhatTheGroundWants | null {
    const short = ground.standing.shortBy;
    if (short === null) return null;

    switch (short) {
        case 'nobody_has_found_it':
            return {
                shortBy: short,
                because: `${ground.name} is under something and nobody has dug it out.`,
                wouldWork:
                    'Nothing you can do reaches it. Ground like this opens when somebody '
                    + 'prospecting the province happens to open it, on the world\'s clock '
                    + 'and not on anybody\'s merit.'
            };
        case 'somewhere_else': {
            const there = provinceName(ground.ground.regionCatalogId);
            const here = provinceName(who.regionCatalogId);
            return {
                shortBy: short,
                because: `${ground.name} is in ${there ?? 'another province'}`
                    + `${here ? `, and you are standing in ${here}` : ''}.`,
                wouldWork: `Go to ${there ?? 'the province it is in'} and stand in it. `
                    + 'Open ground asks nothing else of anybody.'
            };
        }
        case 'not_of_the_house': {
            const house = houseName(ground.ground.heldByFactionId);
            const rank = rankTitle(ground.ground.heldByFactionId, ground.ground.standingRequired);
            return {
                shortBy: short,
                because: `${ground.name} is ${house ?? 'a house'}'s, and you are not `
                    + `${house ? `one of theirs` : 'of that house'}.`,
                wouldWork: rank
                    ? `${house} would have to take you in, and then you would have to reach `
                        + `${rank}. This is what a house is selling and it is the one asset `
                        + 'it cannot sell you separately.'
                    : `${house ?? 'The house'} would have to take you in first.`
            };
        }
        case 'standing': {
            const house = houseName(ground.ground.heldByFactionId);
            const rank = rankTitle(ground.ground.heldByFactionId, ground.ground.standingRequired);
            return {
                shortBy: short,
                because: `${house ?? 'Your house'} does not put ${
                    rank ? `anybody under ${rank}` : 'somebody of your standing'} on ${ground.name}.`,
                wouldWork: rank
                    ? `Reach ${rank}. Standing in a house is what buys this and nothing else does.`
                    : 'Rise in the house. Standing is what buys this and nothing else does.'
            };
        }
        case 'below_the_floor': {
            const floor = rankName(ground.ground.fromOrdinal);
            const gap = ground.ground.fromOrdinal - who.ordinal;
            return {
                shortBy: short,
                because: `${ground.name} is legible from ${floor}. You stand at `
                    + `${rankName(who.ordinal)}, ${gap} ${gap === 1 ? 'rung' : 'rungs'} under. `
                    + 'You can stand on it as long as you like and take nothing off it.',
                wouldWork: `Reach ${floor}. A place teaches a principle rather than a method, `
                    + 'so there is a floor and no ceiling: it will still be there, and it will '
                    + 'still be saying the same thing, whenever you can read it.'
            };
        }
    }
}

/** What it teaches somebody who can read it, in the row's own words. */
export function whatThisGroundTeaches(ground: GroundNearby): string {
    return `${ground.name} is ground that teaches ${ground.subject}. `
        + 'Standing there is the whole of the method; there is no deed attached to it and '
        + 'nothing to complete. What it costs is years.';
}

// ─────────────────────────────────────────────────────────────────────────
// AND THE GROUND YOU CAN CARRY
//
// Ruled by the design owner: remains impart a dao at a high enough rung, and
// are objects of respect for exactly that reason. That is this file's subject
// with a different container - exposure rather than accumulation, a locus you
// sit with - and the engine already had the container:
// `roadsCarriedByObjectsInReachOf` reads `data.daoDomain` off an ordinary
// object, gates it on `power` and on the same legibility window a cliff uses,
// and rations a house's own by standing.
//
// It had the same defect as the ground half and one container over: NO PLAYER
// PATH. `discoveryContextFor` builds its exposure from manuals, teachers, sites
// and ground, and never from what the cultivator is holding - so an object fit
// for somebody's path taught every NPC in the world and nobody at the keyboard.
//
// Nothing new is modelled here. When remains land as objects with a `power` and
// a `daoDomain` they flow through this reader unchanged, which is the whole
// point of not building a second one.
// ─────────────────────────────────────────────────────────────────────────

/** Something a cultivator could sit with, that carries a road. */
export interface ThingThatTeaches {
    id: string;
    name: string;
    domain: InsightDomain;
    subject: string;
    /** Its own rung. What makes it high enough to impart anything at all. */
    power: number;
    standing: HowSomebodyStandsToAGround;
    /** True where they are carrying it rather than their house holding it. */
    inHand: boolean;
}

export function thingsCarriedThatTeachARoad(
    state: WorldState,
    who: SomebodyHolding
): ThingThatTeaches[] {
    return objectsThatCarryARoad(state, who)
        .filter(row => row.standing.knowsWhereItIs)
        .map(row => ({
            id: row.sourceId,
            name: row.sourceName,
            domain: row.domain,
            subject: row.subject,
            power: row.power,
            standing: row.standing,
            inHand: state.objects.find(o => o.id === row.sourceId)?.possessorId === who.id
        }));
}

/** What it teaches somebody who can receive it. */
export function whatThisThingTeaches(thing: ThingThatTeaches): string {
    return `${thing.name} carries ${thing.subject}, and is close enough to your own rung to `
        + `be legible. Sitting with it is the whole of the method. `
        + `${thing.inHand ? 'It is in your hands.' : 'Your house keeps it, and lets you near it.'}`;
}

/** Why it teaches them nothing yet, and what would change that. */
export function whatThisThingWants(
    thing: ThingThatTeaches,
    who: SomebodyHolding
): WhatTheGroundWants | null {
    const short = thing.standing.shortBy;
    if (short === null) return null;
    switch (short) {
        case 'standing':
            return {
                shortBy: short,
                because: `${thing.name} is your house's, and a house does not put somebody of `
                    + 'your standing in a room with it.',
                wouldWork: `Reach the standing a house lets people near what it keeps - `
                    + `${STANDING_TO_STUDY_A_HOUSE_OBJECT} rungs up its own ladder. This is `
                    + 'the same bar the shelf and the terrace use, and nothing else opens it.'
            };
        case 'below_the_floor': {
            const floor = Math.max(0, thing.power - ARTIFACT_LEGIBLE_WITHIN);
            return {
                shortBy: short,
                because: `${thing.name} stands at ${rankName(thing.power)} and you stand at `
                    + `${rankName(who.ordinal)}. At that distance it is a heavy thing and `
                    + 'nothing else. Nothing about it is addressed to you.',
                wouldWork: `Reach ${rankName(floor)}, which is as far under it as anybody can `
                    + 'be and still read anything in it. What is close enough to receive is a '
                    + 'question about the gap and never about the years.'
            };
        }
        default:
            // `not_of_the_house` for an object means it is not yours and no
            // house of yours holds it, which is the only other answer the rule
            // can give about a thing. The two ground-only reasons cannot occur.
            return {
                shortBy: short,
                because: `${thing.name} is not yours, and no house of yours keeps it.`,
                wouldWork: 'It would have to be given, traded for, inherited or held by a '
                    + 'house that had taken you in. Nobody comprehends from a thing across a room.'
            };
    }
}

// ─────────────────────────────────────────────────────────────────────────
// SMALL LOOKUPS
// ─────────────────────────────────────────────────────────────────────────

function provinceName(regionCatalogId: string | null): string | null {
    return regionCatalogId ? getRegion(regionCatalogId)?.name ?? null : null;
}

function houseName(factionId: string | null): string | null {
    return factionId ? getSect(factionId)?.name ?? null : null;
}

function rankTitle(factionId: string | null, index: number): string | null {
    const house = factionId ? getSect(factionId) : undefined;
    return house?.ranks?.[index] ?? null;
}

/**
 * How a cultivator standing somewhere reads to the engine's rule.
 *
 * The province is resolved through the WORLD rather than the region gazetteer,
 * because a dao ground is a world location and is not a catalog place. Every
 * read that went through `regionIdOfPlace` answered "the home province" for
 * anybody actually standing on one - so a cultivator who walked to the Glass
 * Field was treated as never having left the Low Fall.
 */
export function howAPlayerStands(
    state: WorldState,
    at: LocationRecord | null,
    cultivator: { realmOrdinal: number; sectId: string | null; sectRank: string | null }
): SomebodyStanding {
    const house = cultivator.sectId ? getSect(cultivator.sectId) : undefined;
    return {
        ordinal: cultivator.realmOrdinal,
        regionCatalogId: at ? regionCatalogIdOf(state, at.id) : null,
        factionId: cultivator.sectId,
        // A rank INDEX off the house's own ladder, because `standingRequired`
        // is an index and `sectRank` is a title. -1 for somebody in no house,
        // and for a title the house does not have, which is the honest answer
        // rather than 0: zero is a real rung and means every member.
        factionRankIndex: house && cultivator.sectRank
            ? house.ranks.indexOf(cultivator.sectRank)
            : -1
    };
}

/** The same read, for somebody who might be holding something. */
export function howAPlayerHolds(
    state: WorldState,
    at: LocationRecord | null,
    cultivator: {
        id: string; realmOrdinal: number; sectId: string | null; sectRank: string | null;
    }
): SomebodyHolding {
    return { ...howAPlayerStands(state, at, cultivator), id: cultivator.id };
}

export { howSomebodyStandsToAGround, groundAtLocation };
export type {
    SomebodyStanding, SomebodyHolding, HowSomebodyStandsToAGround, ShortOfAGround,
    GroundAsTheRuleReadsIt
};
