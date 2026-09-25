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
 *   you belong      the gate asks for a token and reads it as the house's. The
 *                   roll is behind the wall and the token is what the guard
 *                   can see, so somebody on the roll with none is stopped and
 *                   asked - an obstacle, with the other roads still said - and
 *                   somebody off it carrying a genuine one passes.
 *                   Below the token rung a house knows its people by FACE: one
 *                   of its own in its robes, whose face somebody at the gate
 *                   knows (`theyKnowTheFace`, the trust model's reference axis),
 *                   passes with no token. Anybody in the robes whose face
 *                   nobody places - a new arrival at a big house, or a stranger
 *                   in stolen robes - is stopped and asked, not turned away.
 *                   Somebody on the roll and never entered - no robes, no token,
 *                   no face - is let in when the house EXPECTS them and they can
 *                   say who took them on: the recruiter's report to the
 *                   Internal Affairs office (`a-house-expects-somebody-it-took-
 *                   on.ts`). With no report they are questioned by that office,
 *                   and let in or turned away on whether what they say matches
 *                   what the house knows. Unable to name who took them on, they
 *                   are stopped and asked.
 *   you are a guest somebody of standing brought you. Who may host is a rank
 *                   reading and not a field: anybody the house lets give an
 *                   order can host, which is `authorityTier` above `ordered`.
 *                   An inner or outer disciple has to ask one of them first.
 *   you go around   over the wall, past the people on it, declared by the
 *                   sentence ("sneak in", "over the wall"). `reachThrough` with
 *                   `enteredAt` is where it lands, `concealmentHolds` in
 *                   `regard.ts` is whether a witness at or above your rung sees
 *                   you, and `what-a-house-does-when-it-catches-you.ts` is the
 *                   cost of being seen, on the wall or later inside. Wired in
 *                   `src/web/inside-without-leave.ts`.
 *
 * NOT HAVING THE STANDING TO GO IN IS NOT THE SAME AS SEEING NOTHING. A
 * refusal here always carries what is actually there, whose it is, and what
 * would change it - which is the standing rule in AGENTS.md and the reason this
 * returns a list of roads rather than a boolean.
 *
 * PURE. Records in, a reading out.
 */

import { ELDER_RUNG_FLOOR, isElderRank, isHeadOfHouse } from '../cultivation/leadership.js';
import { carriesATokenAt, whatTheTwoSay } from './a-house-knows-its-own-by-a-lamp-and-a-token.js';
import { purposeOf } from './architecture.js';
import type { LocationRecord } from './locations.js';

/**
 * How somebody is standing at a gate they have walked up to.
 *
 * `on the roll` is the gate reading them as one of the house's own, and what it
 * reads is the TOKEN: a guard cannot see a roll. So somebody on the roll with
 * nothing to show is `stopped and asked`, and somebody off it carrying a genuine
 * token of the house passes - the seam `a-house-knows-its-own-by-a-lamp-and-a-
 * token.ts` keeps open on purpose.
 */
export type HowYouStandAtAGate = 'on the roll' | 'stopped and asked' | 'brought in' | 'turned away';

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
    /**
     * The house the token they are carrying names, or null for none.
     * `theHouseTheirTokenNames`. REQUIRED, because a gate that forgot to ask
     * would wave everybody on the roll through, which is what it did.
     */
    theTokenNames: string | null;
    /** Whether they are wearing this house's robes. `wearsTheRobesOf`. */
    inTheRobes: boolean;
    /**
     * Somebody of the house at the gate who knows their face, where anybody
     * does, and why. `theyKnowTheFace` over each of `theirPeopleHere`, which is
     * the trust model's reference axis read from the house's end. Null for
     * nobody. The gate decides what that is worth; this only says who and why.
     */
    aFaceTheyKnow: { name: string; because: string } | null;
    /**
     * What the house makes of somebody never entered, where it has anything to
     * go on: `whatTheHouseMakesOfSomebodyNew` - expected on a report, or what
     * questioning them came to - with who they say took them on, where, whether
     * they can say it at all, and the questioning's own reason. A null
     * `recruiterName` on `expected` is a house that sent for them itself. Null
     * for no account. REQUIRED for the same reason the token is: a gate that
     * forgot to ask would stop every new recruit. It is not a token - it is read
     * only for somebody on the roll and never entered.
     */
    expected: {
        reading: 'expected' | 'admitted on questioning' | 'rejected on questioning';
        recruiterName: string | null;
        whereName: string | null;
        theyCanSayWhoTookThemOn: boolean;
        because: string | null;
    } | null;
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

    const onTheRoll = input.standing !== null && input.standing >= 0;
    // THE GATE ASKS, which is the one thing a look does not do. The object the
    // token is held against is the house whose gate this is.
    const theTokenSays = whatTheTwoSay({
        theAskerKnowsWhatItIs: true,
        theObjectNames: input.factionId,
        theTokenNames: input.theTokenNames
    });
    // KNOWN BY FACE, WHICH IS HOW A HOUSE KNOWS ITS PEOPLE BELOW THE TOKEN RUNG.
    // One of its own, in its robes, whose face somebody at the gate knows. The
    // roll is asked only because a face that is not the house's is not one of
    // its faces: somebody who knows a stranger knows they are not of the house.
    const knownByFace = !(theTokenSays === 'they agree')
        && onTheRoll && input.inTheRobes && input.aFaceTheyKnow !== null;
    // EXPECTED, WHICH IS HOW A HOUSE KNOWS SOMEBODY IT HAS NEVER SEEN. On the
    // roll, never entered, and able to say who took them on, which the house
    // was told. Not a token: somebody in the robes is past this question, and
    // somebody off the roll was never on anybody's list.
    const newAtTheGate = !(theTokenSays === 'they agree') && !knownByFace
        && onTheRoll && !input.inTheRobes && input.expected !== null;
    const e = input.expected;
    const sentFor = newAtTheGate && e!.reading === 'expected' && e!.recruiterName === null;
    const canSay = newAtTheGate && e!.recruiterName !== null && e!.theyCanSayWhoTookThemOn;
    const letInAsExpected = sentFor || (canSay && e!.reading !== 'rejected on questioning');
    const rejectedOnQuestioning = canSay && e!.reading === 'rejected on questioning';
    const way: HowYouStandAtAGate = theTokenSays === 'they agree' || knownByFace || letInAsExpected
        ? 'on the roll'
        : input.hostedBy ? 'brought in'
        // QUESTIONED AND IT DID NOT MATCH: a refusal, and said as the reason.
        : rejectedOnQuestioning ? 'turned away'
        // IN THE ROBES IS STOPPED RATHER THAN TURNED AWAY, whether or not the
        // roll agrees: a guard who cannot place the face asks for a token, and
        // a stranger in stolen robes is asked the same question as a disciple
        // nobody here has met. That is the disguise road working.
        : onTheRoll || input.inTheRobes ? 'stopped and asked'
        : 'turned away';

    const facts: string[] = [];
    const stoppedWithNothingToShow = 'The gate of the ' + input.factionName + ' stops you and asks for a '
        + 'token. You have none, and nobody at the gate knows your face.';
    const youSay = e === null || e.recruiterName === null ? ''
        : ' You say ' + e.recruiterName + ' took you on' + (e.whereName ? ' at ' + e.whereName : '') + '.';
    const questioned = ' The house has no word of it, and you are taken to its Internal Affairs Elder and '
        + 'questioned. ' + (e?.because ?? '');
    if (way === 'on the roll' && sentFor) {
        facts.push(stoppedWithNothingToShow + ' The house sent for you, the gate has your name, and it lets '
            + 'you in to be entered on its roll.');
    } else if (way === 'on the roll' && letInAsExpected && e!.reading === 'expected') {
        facts.push(stoppedWithNothingToShow + youSay + ' The house was told to expect you by name, and the '
            + 'gate lets you in to be entered on its roll.');
    } else if (way === 'on the roll' && letInAsExpected) {
        facts.push(stoppedWithNothingToShow + youSay + questioned + ' You are let in to be entered on its roll.');
    } else if (way === 'on the roll' && knownByFace) {
        const rung = input.ranks[Math.min(input.standing!, rankCount - 1)] ?? 'a member';
        facts.push(`${input.aFaceTheyKnow!.name} at the gate of the ${input.factionName} knows your `
            + `face and you are in the house's robes, so nobody asks you for a token: `
            + `${input.aFaceTheyKnow!.because} By the roll you are ${rung}.`);
    } else if (way === 'on the roll') {
        const rung = onTheRoll ? input.ranks[Math.min(input.standing!, rankCount - 1)] : null;
        facts.push(`The gate asks for a token, reads it as the ${input.factionName}'s, and does not `
            + `stop you${rung ? `. By the roll you are ${rung}` : ''}.`);
    } else if (way === 'brought in') {
        facts.push(`${input.hostedBy!.name} walks you past the gate. You are here as their guest`
            + (onTheRoll ? ', whatever the roll says.' : ' and on no roll.'));
    } else {
        if (way === 'stopped and asked') {
            // AN OBSTACLE AND NOT A REFUSAL. The gate cannot read a roll and
            // nobody at it places the face, so they are stopped and asked - and
            // every road below is still open to them.
            const noToken = theTokenSays === 'they do not agree'
                ? 'The one you carry is another house\'s.'
                : 'There is no token to read.';
            // WHY THE FACE DID NOT ANSWER, said as what is true at the gate.
            const theFace = !input.inTheRobes
                ? 'You are not in the house\'s robes.'
                : input.aFaceTheyKnow === null
                    ? 'You are in its robes, and nobody at the gate knows your face.'
                    : '';
            if (onTheRoll) {
                const rung = input.ranks[Math.min(input.standing!, rankCount - 1)] ?? 'a member';
                // NEVER ENTERED, AND WHY THE HOUSE'S WORD DID NOT LET THEM IN.
                const theWord = input.inTheRobes
                    ? ''
                    : e === null || e.recruiterName === null
                        ? 'Nobody at the gate was told to expect you.'
                        : e.reading === 'expected'
                            ? 'The house expects somebody of your name, and you cannot say who took you on.'
                            : 'You cannot say who took you on.';
                facts.push([
                    `The gate of the ${input.factionName} stops you and asks for a token.`,
                    noToken,
                    theFace,
                    theWord,
                    `You are ${rung} on its roll, and nothing about you here shows it.`
                ].filter(part => part.length > 0).join(' '));
                facts.push(carriesATokenAt(input.standing!)
                    ? `A token is cut inside the ${input.factionName} for anybody on its roll at your `
                      + 'rung, by whoever keeps the roll. Being entered there is what gives you one.'
                    : 'Your rung carries no token. A house knows its people that far down by face: '
                      + 'somebody at the gate who has dealt with you, or a house small enough that '
                      + 'every face in it is known.');
            } else {
                // In the robes and off the roll. What is said is what a guard
                // says to anybody in those robes they cannot place, and nothing
                // about a roll the guard cannot see.
                facts.push([
                    `The gate of the ${input.factionName} stops you and asks for a token.`,
                    noToken,
                    theFace
                ].filter(part => part.length > 0).join(' '));
            }
        } else if (rejectedOnQuestioning) {
            facts.push(stoppedWithNothingToShow + youSay + questioned + ' You are not let in.');
        } else {
            facts.push(`The gate of the ${input.factionName} is held. Nobody on it is senior and `
                + 'none of them has to be.');
            if (theTokenSays === 'they do not agree') {
                facts.push('The token you carry is another house\'s, and it opens nothing here.');
            }
            // WHAT WOULD CHANGE IT, and all three roads are said, not one.
            facts.push(input.recruits
                ? `A place on the roll would open it. The ${input.factionName} looks at people from `
                  + `rung ${input.admissionOrdinal} up.`
                : `The ${input.factionName} takes no applicants, so there is no road onto its roll `
                  + 'from outside.');
        }
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
        // THE THIRD ROAD IS SAID BECAUSE IT IS REAL: "sneak in" or "over the
        // wall" takes it. See `src/web/inside-without-leave.ts`.
        facts.push('The wall is a wall. It is not watched along its whole length.');
    }

    return {
        way,
        factionId: input.factionId,
        couldHost,
        couldAskForYou,
        facts,
        structure: `standingAtTheGateOf(${input.factionId}): ${way}; standing=`
            + `${input.standing ?? 'none'}; token: ${theTokenSays}; ${couldHost.length} could host, `
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
