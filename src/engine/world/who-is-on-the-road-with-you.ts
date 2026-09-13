/**
 * Who is on the road with somebody, and what happens to them when that somebody
 * goes anywhere.
 *
 * NOTHING HERE IS A PARTY RECORD. `NpcActivity` already holds the fact:
 * `out_with_a_party` carries `withIds`, a term in `untilDay` and the place to
 * go back to in `returnTo`, and `the-world-changing-on-its-own.ts` has written
 * exactly that onto every person a house sends out since sendings started
 * moving anybody. So who is travelling with somebody is a READING over those
 * rows - everybody whose OWN activity names them - and a roster stored beside
 * it would be a second answer to a question the world already answers.
 *
 * Two things fall out of reusing the activity rather than inventing a party,
 * and both are the whole argument for it:
 *
 *   `bringHomeWhoeverIsDue`   already ends the term on `untilDay` and puts
 *                             everybody back at `returnTo`. A party the player
 *                             is leading goes home on its own, through the pass
 *                             that was already bringing the world's parties
 *                             home, with nothing added.
 *   `othersPresent`           already reads `locationId`. Moving a companion is
 *                             the whole of making them present at the far end,
 *                             so every verb that asks who is standing here finds
 *                             them without knowing this module exists.
 *
 * ── WHERE THE SYMMETRY STOPS, AND WHY ────────────────────────────────────
 *
 * `NpcActivity.withIds` is symmetric by construction everywhere else: everybody
 * in a scene names everybody else, so it reads the same whichever of them was
 * walked up to. It stops one short here, and deliberately. `standInTheWorld`
 * does give the player a world row, so there IS somewhere to write the other
 * half - and writing it would be a second copy of the party, able to disagree
 * with the activities it was derived from. So the party is read off the people
 * in it and keyed on the LEADER's id, and the leader is whoever they name.
 *
 * And the world's own sendings name no leader at all - `withIds` there is the
 * rest of the party - so nothing may read the first entry as one. What inverts
 * is `whoTheyAreOutWith`, which hands the list back and lets the caller ask
 * whether a particular person is in it. That read is what a player asking
 * somebody to come along needs before the request can be put, since a body is
 * in one party at a time.
 */

import type { NpcRecord } from './npc-state.js';
import { setLocation } from './npc-state.js';

/**
 * The activity kind a party on the road is at. The world sim's own, not a
 * second one for players.
 */
const ON_THE_ROAD = 'out_with_a_party';

/**
 * The term a party runs on when nobody said one.
 *
 * A term is not optional. `bringHomeWhoeverIsDue` ends a party by reading
 * `untilDay`, and an activity with none on it is somebody who never comes home -
 * the world's own sendings all carry one (`returnsOnDay` is the posting's days
 * added to the day it left), and a party the player raised has to carry one for
 * the same pass to reach it.
 *
 * A season, because that pass runs once a year: a term at or over a year would
 * be brought home by a different year's pass than the one that should have
 * ended it. The player naming a span in the sentence overrides this, which is
 * the only reason it is a default rather than a rule.
 */
export const A_SEASON_ON_THE_ROAD = 90;

/**
 * Everybody whose own activity says they are out with this person, today.
 *
 * The term is read the way `bringHomeWhoeverIsDue` reads it - `day >= untilDay`
 * is over - so the day this pass stops naming somebody is the day the world
 * sends them home. Two readings of when a term ends is exactly the drift this
 * module exists to avoid.
 */
export function whoIsOnTheRoadWith(
    npcs: readonly NpcRecord[],
    leaderId: string,
    today: number
): readonly NpcRecord[] {
    return npcs.filter(npc => {
        if (npc.status !== 'alive') return false;
        const doing = npc.activity;
        if (!doing || doing.kind !== ON_THE_ROAD) return false;
        if (!doing.withIds.includes(leaderId)) return false;
        const until = doing.untilDay;
        return until === null || until === undefined || today < until;
    });
}

/**
 * Whoever this one person is out with, and until when, or null.
 *
 * The same row {@link whoIsOnTheRoadWith} filters, asked of one body instead of
 * the world - which is the read that inverts it, and the one a request has to
 * make before it can be put: a body is in one party at a time, so the answer to
 * "will you come with me" is settled outright when they are already gone.
 *
 * IT HANDS BACK `withIds` RATHER THAN A LEADER, because there is not always
 * one: {@link takeThemWithYou} names whoever they are going with, and a house's
 * own sending names only the other people in the party. Asking whether a
 * particular person is in that list is the same test {@link whoIsOnTheRoadWith}
 * makes, read from the other end, and it is true of both shapes.
 */
export function whoTheyAreOutWith(
    npc: NpcRecord,
    today: number
): { withIds: readonly string[]; untilDay: number | null; note: string } | null {
    const doing = npc.activity;
    if (!doing || doing.kind !== ON_THE_ROAD) return null;
    const until = doing.untilDay ?? null;
    if (until !== null && today >= until) return null;
    return { withIds: doing.withIds, untilDay: until, note: doing.note };
}

/**
 * What a party is, said once: who, until when, and what they are out on.
 *
 * The inspectable half of the same reading the travel verbs already carry a
 * party by. It composes nothing the world does not hold - the names are the
 * rows, the term is `untilDay`, the errand is the note each of them is carrying
 * - so a status read and a journey cannot disagree about who is here.
 */
export function whatThePartyIs(
    party: readonly NpcRecord[],
    today: number
): { line: string; structure: string } | null {
    if (party.length === 0) return null;

    const terms = party
        .map(npc => npc.activity?.untilDay ?? null)
        .filter((day): day is number => day !== null);
    const ends = terms.length === 0 ? null : Math.min(...terms);
    const notes = [...new Set(party.map(npc => npc.activity?.note ?? '').filter(n => n.length > 0))];

    const who = namesOf(party).join(', ');
    const left = ends === null ? null : Math.max(0, ends - today);
    return {
        line:
            `${who} ${party.length === 1 ? 'is' : 'are'} on the road with you`
            + `${left === null
                ? ', on no term anybody has stated'
                : `, for ${left} more day${left === 1 ? '' : 's'}`}`
            + `${notes.length === 0 ? '.' : `: ${notes.join(' ')}`}`
            + ` ${party.length === 1 ? 'They go' : 'They go'} where you go until the term runs out, `
            + `and then back to where each of them set out from.`,
        structure:
            `who-is-on-the-road-with-you: ${party.length} read off their own out_with_a_party `
            + `activity on day ${today}`
            + `${ends === null ? ', no term stated' : `, earliest term ends on day ${ends}`}. `
            + `No roster is stored anywhere; take the activities away and there is no party left `
            + `over.`
    };
}

export interface TakingThemWithYou {
    /** Everybody going, including each other. */
    party: readonly { id: string; name: string }[];
    /** Whoever they are going with, who is not one of them. */
    leaderId: string;
    /** What they are out on, in words. Stored verbatim as the activity's note. */
    note: string;
    onDay: number;
    /** The day the term ends. The world brings them home on it. */
    untilDay: number;
}

/**
 * Put a party on the road with somebody, as updated rows.
 *
 * `returnTo` is where each of them is standing NOW, and not the leader's place
 * and not a house's seat: a disciple who lives in a village comes back to the
 * village, which is the reason that field exists and the settlement-draining
 * defect it was added against.
 */
export function takeThemWithYou(
    npcs: readonly NpcRecord[],
    input: TakingThemWithYou
): NpcRecord[] {
    const going = new Set(input.party.map(member => member.id));
    const changed: NpcRecord[] = [];
    for (const npc of npcs) {
        if (!going.has(npc.id) || npc.status !== 'alive') continue;
        changed.push({
            ...npc,
            activity: {
                kind: ON_THE_ROAD,
                note: input.note,
                // Everybody in it names everybody else, and names the person
                // they are going with. The leader has no row to name them back.
                withIds: [
                    input.leaderId,
                    ...input.party.map(member => member.id).filter(id => id !== npc.id)
                ],
                sinceDay: input.onDay,
                untilDay: input.untilDay,
                returnTo: npc.locationId
            }
        });
    }
    return changed;
}

/**
 * The party, moved to where the person they are with has just arrived.
 *
 * `setLocation` and nothing else. Arriving is a change of place, and everything
 * that makes an arrival mean anything - being present, being spoken to, being
 * counted at a gate - is already read off `locationId` by somebody.
 */
export function theyComeWithYou(
    npcs: readonly NpcRecord[],
    input: { leaderId: string; arrivedAt: string; onDay: number }
): NpcRecord[] {
    return whoIsOnTheRoadWith(npcs, input.leaderId, input.onDay)
        .filter(npc => npc.locationId !== input.arrivedAt)
        .map(npc => setLocation(npc, input.arrivedAt, input.onDay));
}

/**
 * The rung the party waits for, which is the lowest one in it.
 *
 * `quotePassageAtACounter` takes `worstPassengerOrdinal` and says why in its own
 * docstring - *a party arrives together and waits for the person the crossing
 * was hardest on*. This is the same sentence read off a party rather than
 * asserted twice, and the leader is in it because they wait too.
 */
export function theSlowestOfThem(
    leaderOrdinal: number,
    party: readonly NpcRecord[]
): number {
    let worst = leaderOrdinal;
    for (const npc of party) worst = Math.min(worst, npc.cultivation.realmOrdinal);
    return worst;
}

/** Names, in the order the party was read. */
export function namesOf(party: readonly NpcRecord[]): string[] {
    return party.map(npc => npc.name);
}

/**
 * What a fold will not take.
 *
 * Not a rule written here. `CapabilityGrant.spatial_folding` states it as the
 * grant's own terms - it folds the space around ONE body and what that body is
 * carrying, against a volume budget of about a sword, and *no companion and no
 * passenger at any size*. So the refusal is the grant read out, and what would
 * change it is the other three ways of covering ground, all of which take a
 * party and two of which already price one.
 */
export function whyAFoldLeavesThemStanding(party: readonly NpcRecord[]): string {
    const them = namesOf(party).join(', ');
    return `A fold closes the space around one body and what that body has on it, and `
        + `nothing else goes through it - not a passenger, at any size. ${them} `
        + `${party.length === 1 ? 'is' : 'are'} on the road with you and would be left `
        + 'standing here watching you not be there. The road takes them, so does anything '
        + 'you can put them on, and so does a place bought at a span counter.';
}
