/**
 * The gate of a compound, and the three ways past it.
 *
 * A house's ground was reachable only by its world row's name - `<house>
 * grounds` - and once reached it was ground like any other: nothing stood on
 * it, nothing asked anything, and standing inside a compound cost exactly what
 * standing in a field costs. Measured across three pinned worlds, 38 seated
 * houses each: `I travel to <house>` reached none of them, and `I travel to
 * <house> grounds` walked straight in.
 *
 * THE THREE ROADS, and they are the whole of it.
 *
 * WHERE THIS HAPPENS is the seat itself, which `seedSectGround` describes as
 * *gate, forecourt, halls* and opens at an entry threshold of zero. Standing
 * there is standing at the door with the market around you, not inside the
 * walls: the precincts behind it carry their own thresholds and always did.
 * `the-town-at-the-foot-of-a-house.ts` says why the market is a reading of that
 * row rather than a second one, and what it costs.
 *
 *   you belong      you are on the roll, and the gate is a door you use.
 *   you are a guest somebody of standing brought you. Who may host is a rank
 *                   reading and not a field: anybody the house lets give an
 *                   order can host, which is `authorityTier` above `ordered`.
 *                   An inner or outer disciple has to ask one of them first.
 *   you go around   over the wall, past the people on it. Not wired, and it needs
 *                   no new subsystem: `reachThrough` takes `enteredAt` for
 *                   exactly this, `concealmentHolds` in `regard.ts` already
 *                   answers whether a declared approach survives a witness at
 *                   or above your rung, and
 *                   `what-a-house-does-when-it-catches-you.ts` is the cost of
 *                   failing. What is missing is a verb that declares one.
 *
 * NOT HAVING THE STANDING TO GO IN IS NOT THE SAME AS SEEING NOTHING. A
 * refusal here always carries what is actually there, whose it is, and what
 * would change it - which is the standing rule in AGENTS.md and the reason this
 * returns a list of roads rather than a boolean.
 *
 * PURE. Records in, a reading out.
 */

import { ELDER_RUNG_FLOOR, isElderRank, isHeadOfHouse } from '../cultivation/leadership.js';
import { purposeOf } from './architecture.js';
import type { LocationRecord } from './locations.js';

/** How somebody is standing at a gate they have walked up to. */
export type HowYouStandAtAGate = 'on the roll' | 'brought in' | 'turned away';

/**
 * Whether a rung may bring an outsider through its own gate.
 *
 * A rank reading and not a new column. `ELDER_RUNG_FLOOR` already carries the
 * exact fact the ruling turns on - *no house makes an elder of its outer or
 * inner disciples, whatever it calls them* - so the first rung above it is the
 * first rung that is not a disciple in that sense, which is the conclave rung
 * under whichever name a house uses. An elder or the head hosts by being one,
 * which matters for a short ladder where the floor sits above the top rung.
 */
export function couldHostAGuest(rankIndex: number, rankCount: number): boolean {
    if (rankIndex < 0 || rankCount <= 0) return false;
    return isHeadOfHouse(rankIndex, rankCount)
        || isElderRank(rankIndex, rankCount)
        || rankIndex >= ELDER_RUNG_FLOOR;
}

/** Somebody of a house, as the gate reads them. */
export interface SomebodyOfTheHouse {
    id: string;
    name: string;
    rankIndex: number;
}

export interface AtTheGateInput {
    factionId: string;
    factionName: string;
    /** The house's own ladder, lowest first. */
    ranks: readonly string[];
    /** Whether the house takes applicants at all. */
    recruits: boolean;
    /** The rung it will look at, for the sentence about what the roll costs. */
    admissionOrdinal: number;
    /** The caller's rung in THIS house, or null for anybody not on its roll. */
    standing: number | null;
    /** People of the house at hand, from whom a host or an asker is drawn. */
    theirPeopleHere: readonly SomebodyOfTheHouse[];
    /** Who has already agreed to bring them in, where anybody has. */
    hostedBy?: SomebodyOfTheHouse | null;
}

export interface WhatTheGateSays {
    way: HowYouStandAtAGate;
    factionId: string;
    /** People at hand who could simply walk an outsider in. */
    couldHost: readonly SomebodyOfTheHouse[];
    /**
     * People at hand who are on the roll and cannot host on their own
     * authority. What they can do is ask somebody who can, which is what the
     * favour ladder is for.
     */
    couldAskForYou: readonly SomebodyOfTheHouse[];
    /** Factual. What is actually there, and what would change the answer. */
    facts: string[];
    /** Inspector only. */
    structure: string;
}

/**
 * What the gate says to whoever has walked up to it.
 */
export function standingAtTheGateOf(input: AtTheGateInput): WhatTheGateSays {
    const rankCount = input.ranks.length;
    const couldHost = input.theirPeopleHere.filter(p => couldHostAGuest(p.rankIndex, rankCount));
    const couldAskForYou = input.theirPeopleHere.filter(
        p => p.rankIndex >= 0 && !couldHostAGuest(p.rankIndex, rankCount)
    );

    const way: HowYouStandAtAGate = input.standing !== null && input.standing >= 0
        ? 'on the roll'
        : input.hostedBy ? 'brought in' : 'turned away';

    const facts: string[] = [];
    if (way === 'on the roll') {
        const rung = input.ranks[Math.min(input.standing!, rankCount - 1)] ?? 'a member';
        facts.push(`The gate reads you as ${rung} of the ${input.factionName} and does not stop `
            + 'you.');
    } else if (way === 'brought in') {
        facts.push(`${input.hostedBy!.name} walks you past the gate. You are here as their guest `
            + 'and on no roll.');
    } else {
        facts.push(`The gate of the ${input.factionName} is held. Nobody on it is senior and `
            + 'none of them has to be.');
        // WHAT WOULD CHANGE IT, and all three roads are said, not one.
        facts.push(input.recruits
            ? `A place on the roll would open it. The ${input.factionName} looks at people from `
              + `rung ${input.admissionOrdinal} up.`
            : `The ${input.factionName} takes no applicants, so there is no road onto its roll `
              + 'from outside.');
        if (couldHost.length > 0) {
            facts.push(`Somebody who can bring you through is here: `
                + `${couldHost.map(p => p.name).join(', ')}. A guest walks in behind a host and `
                + 'not otherwise.');
        } else if (couldAskForYou.length > 0) {
            facts.push(`${couldAskForYou.map(p => p.name).join(', ')} are of the house and cannot `
                + 'bring anybody in on their own word. What they can do is ask somebody who can.');
        } else {
            facts.push('Nobody of the house is out here to ask.');
        }
        // WHERE THEY ACTUALLY ARE, because being turned away and being nowhere
        // are different. A compound's outer court is open ground at a house
        // that takes applicants - `growCompound` sets its entry threshold to
        // zero for exactly that reason - so somebody refused is standing in the
        // forecourt among the people the market is made of. What is shut is
        // everything behind the next wall.
        facts.push('You are at the gate and in the forecourt, which is as far as the road goes. '
            + 'Every court behind this one is walled and calibrated.');
        // THE THIRD ROAD IS SAID BECAUSE IT IS REAL. Every piece of it is built
        // and reachable - `enteredAt`, `concealmentHolds`, and what a house does
        // when it catches you. What is missing is a verb.
        facts.push('The wall is a wall. It is not watched along its whole length.');
    }

    return {
        way,
        factionId: input.factionId,
        couldHost,
        couldAskForYou,
        facts,
        structure: `standingAtTheGateOf(${input.factionId}): ${way}; standing=`
            + `${input.standing ?? 'none'}; ${couldHost.length} could host, `
            + `${couldAskForYou.length} could ask. Nothing spent.`
    };
}

// WHERE A GATE IS

/**
 * Whose gate this place is, or null where it is nobody's.
 *
 * Two rows are the same fact - a house's seat and the gatehouse room inside it -
 * and nothing else in the world answers, which is what keeps an ordinary
 * province road from being a door.
 */
export function whoseGateThisIs(location: LocationRecord | null | undefined): string | null {
    if (!location) return null;
    if (location.kind !== 'sect_seat' && purposeOf(location) !== 'gatehouse') return null;
    const id = (location.data as { factionId?: unknown }).factionId;
    return typeof id === 'string' && id.length > 0 ? id : location.controllingFactionId;
}
