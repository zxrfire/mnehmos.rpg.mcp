/**
 * Who a senior is being asked to take out of the sect, and who is asking.
 *
 * The design owner, on what an elder's sect business actually looks like:
 * *"what's more likely is a diff elder or the patriarch asks this elder to take
 * some disciples out (disciples who have accepted a mission to go out of the
 * sect for one reason or another)"*.
 *
 * NOTHING HERE GENERATES A DUTY. The occasion for an escort is a posting the
 * board already made, pitched at a rung the juniors stand on - which is exactly
 * the row an elder can now read on the wall, one rung of the same change. A
 * second duty generator for elders would be a parallel board, and the two would
 * disagree about what work the house has inside a month.
 *
 * So this answers two questions off rows that exist: WHO goes, and WHO ASKED.
 *
 * ── WHO GOES ────────────────────────────────────────────────────────────
 *
 * `whoTheHouseCanSend` already picks a party off a posting and a roll, and it
 * is the pass the world uses when it sends NPCs out. It is asked here too,
 * against the roll minus the person being asked, so the party a player is given
 * is drawn by the same rule as a party they never see.
 *
 * ── WHO ASKED ───────────────────────────────────────────────────────────
 *
 * `mouthFor` picks who WALKED OVER, which is a different fact and stays one: a
 * message can be carried by anybody. The authority is a peer or the head, and
 * the roll says who those are, so the ask names a person rather than "an
 * elder".
 */

import type { Candidate } from '../world/who-goes-out-for-a-house-and-what-comes-back.js';
import { whoTheHouseCanSend } from '../world/who-goes-out-for-a-house-and-what-comes-back.js';
import { rankName } from '../cultivation/realms.js';

/** Somebody on the house's roll, as this pass needs them. */
export interface OnTheRoll {
    id: string;
    name: string;
    rankIndex: number;
    realmOrdinal: number;
}

/** One of the juniors, as the duty carries them. */
export interface GoingWithYou {
    id: string;
    name: string;
    realmOrdinal: number;
}

/**
 * The juniors this posting would put on the road, minus whoever is being asked
 * to go with them.
 *
 * Empty where the house has nobody at that rung, and an empty party is the
 * honest answer: there is then no escort to ask for, only the errand.
 */
export function whoASeniorIsAskedToTakeOut(input: {
    /** The rung the posting is pitched at. Nobody above it is on this party. */
    pitchOrdinal: number;
    /** How many of the house go. `DutyTerms.cohort`, unchanged. */
    hands: number;
    roster: readonly OnTheRoll[];
    /** The person being asked. They are not one of the people they take. */
    seniorId: string;
    seniorOrdinal: number;
}): GoingWithYou[] {
    const juniors: Candidate[] = input.roster
        .filter(person =>
            person.id !== input.seniorId && person.realmOrdinal < input.seniorOrdinal)
        .map(person => ({ id: person.id, name: person.name, ordinal: person.realmOrdinal }));

    return whoTheHouseCanSend(
        { ceilingOrdinal: input.pitchOrdinal, hands: Math.max(0, Math.floor(input.hands)) },
        juniors
    ).map(member => ({ id: member.id, name: member.name, realmOrdinal: member.ordinal }));
}

/**
 * Whose word this is.
 *
 * The head where the roll holds one, and otherwise the highest-ranked person on
 * it who is not the person being asked - which is the peer at a council. Never
 * the person themselves: a house does not ask somebody to go with juniors on
 * their own authority, and if there is nobody else, nobody asked.
 */
export function whoAsksASeniorToGo(input: {
    roster: readonly OnTheRoll[];
    seniorId: string;
    /** Top index of the house's own rank array, so the head is identifiable. */
    headRankIndex: number;
}): OnTheRoll | null {
    let best: OnTheRoll | null = null;
    for (const person of input.roster) {
        if (person.id === input.seniorId) continue;
        if (best === null || person.rankIndex > best.rankIndex) best = person;
        // The head settles it: there is nobody above them to be preferred.
        if (person.rankIndex >= input.headRankIndex) return person;
    }
    return best;
}

/**
 * The ask, as facts.
 *
 * Names and rungs, and nothing about how anybody feels about it. Both are
 * visible to the person being asked - these are people from their own house,
 * standing in front of them - so nothing here is the record read aloud.
 */
export function whatTheSeniorIsBeingAskedFor(party: readonly GoingWithYou[]): string {
    if (party.length === 0) return '';
    const named = party
        .map(member => `${member.name} (${rankName(member.realmOrdinal)})`)
        .join(', ');
    return ` The errand is ${party.length} of the house's, and this is to go out with `
        + `them: ${named}.`;
}
