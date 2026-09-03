/**
 * The people on your own house's roll, whom you have no excuse not to know.
 *
 * ── THE DEFECT THIS EXISTS FOR ───────────────────────────────────────────
 *
 * Found by playing, as a **Sword Elder of the Azure Cloud Pavilion** - enrolled,
 * at the fifth of six ranks, standing on the house's own ground:
 *
 *   who are the other elders here?
 *
 *   7 about in Azure Cloud Pavilion grounds.
 *   7 present: 0 this cultivator can put a name to, 7 they cannot.
 *   whoHoldsTheGround: held by Azure Cloud Pavilion. Recourse taken_up.
 *
 * and the narrator: *"none of them turn to acknowledge your question... They do
 * not look up, even as the silence stretches."*
 *
 * **A member of a house could not name one person in it.** The ground writer had
 * already fixed the HOUSE - travelling to their seat writes `named` on the
 * faction - and the people were still strangers, because joining a house wrote
 * nothing about the people in it.
 *
 * It is the same rule the design owner gave for ground, one subject over: what
 * the game shows you, you know. And being enrolled is a far stronger claim than
 * standing somewhere - these are not people walked past, they are the people
 * served with.
 *
 * ── THE RULE, AND IT IS TWO CONDITIONS ───────────────────────────────────
 *
 *   ON THE SAME ROLL, AND IN THE SAME ROOM.
 *
 * Both, and neither on its own. The roll alone would hand a new Outer Disciple
 * every name in the house including people they will never meet. The room alone
 * is the thing `presence.test.ts` guards and must keep guarding: **seeing
 * somebody is not knowing them, and a look is not a source a name may arrive
 * through.** What makes this different from a stranger in a square is not that
 * they are visible - it is that the player and this person are on one roll, and
 * that is a checkable relation rather than a proximity.
 *
 * So a non-member standing in the same crowd still learns nobody, and the
 * presence guard is untouched.
 *
 * ── AND THE RANK FILTER IS THE ROOM, NOT A TABLE ─────────────────────────
 *
 * "Who you learn" wants to be rank-shaped - an elder knows the elders, a servant
 * knows the people they work beside - and the room already produces exactly
 * that, for free and for a real reason: a Dew Servant stands in the yards among
 * servants and a Sword Elder stands where elders stand. A rank table would be a
 * second answer to a question the world already answers by where people are.
 *
 * ── WHAT IT DOES NOT GRANT ───────────────────────────────────────────────
 *
 * `named`, and never more. Being on one roll with somebody tells you who they
 * are. It does not tell you their art, their grievance, what they want, or what
 * they would do for you - all of which are on the catalog row and none of which
 * this licenses.
 *
 * And **the height gate still rules.** `noticesThatTheyAreThere` is applied
 * before anything else, so a member does not acquire the name of somebody nine
 * rungs above them merely by enrolling. In the played case the seven present
 * included one the narrator described as *"out of reach in a way that does not
 * invite comparison"* - that one staying unnamed is correct, and the other six
 * were the defect.
 *
 * PURE. Rows in, rows out. No I/O, no RNG, no mutation.
 */

import { noticesThatTheyAreThere } from './presence-recognition.js';

/** One person standing here, reduced to what this rule reads. */
export interface SomebodyStandingHere {
    id: string;
    name: string;
    realmOrdinal: number;
    /** The house they serve, off their own row. Null for most people alive. */
    factionId: string | null;
    /** True where the player already holds a row about them. */
    known: boolean;
}

export interface WhoYouServeWith {
    /** The player's own house, or null when they serve nobody. */
    factionId: string | null;
    realmOrdinal: number;
    /** The player's own id, so they are never introduced to themselves. */
    selfId: string;
    /**
     * Everybody standing here, from both populations, with their house on them.
     *
     * ── AND THIS IS THE ROOM, NOT THE CATALOG ROSTER ─────────────────────
     *
     * Measured, and it is why the first build of this rule could never have
     * fired: the authored roster carries ids like `member-yan-shuling` and the
     * people actually standing on a house's ground are world rows like
     * `npc-78`. **Overlap by id: zero.** A rule that joined the roll to the room
     * would have compared two disjoint id spaces and found nobody, for ever, and
     * looked exactly like a rule that had decided nobody qualified.
     *
     * `RosterEntry` carries `sectId` on the row, so the house is asked of the
     * person standing in front of you rather than looked up in a catalog they
     * may not be in. That is also the more honest question: what makes somebody
     * your own is that they serve where you serve, not that an author wrote them
     * down.
     */
    here: readonly SomebodyStandingHere[];
}

export interface ServingWithReading {
    /** The ones they may now name. Empty is the ordinary case. */
    theyMayName: SomebodyStandingHere[];
    /**
     * On your roll and in the room and still not named, because height alone
     * hides them.
     *
     * Counted for the engine channel and never for the player: telling somebody
     * "there are two more here you cannot perceive" is the leak wearing an
     * apology, which is the exact ruling `presence-recognition.ts` was built on.
     */
    hiddenByHeight: number;
}

/**
 * Who a member of this house may put a name to, standing where they are.
 *
 * Already-known people are excluded from `theyMayName` rather than re-granted,
 * so a caller can tell the difference between meeting your house for the first
 * time and walking through it for the hundredth.
 */
export function thePeopleYouServeWith(input: WhoYouServeWith): ServingWithReading {
    if (!input.factionId) return { theyMayName: [], hiddenByHeight: 0 };

    const theyMayName: SomebodyStandingHere[] = [];
    let hiddenByHeight = 0;

    for (const person of input.here) {
        if (person.id === input.selfId) continue;
        // SERVING WHERE YOU SERVE. Standing in the same square is not enough,
        // and it must not be: that is the case `presence.test.ts` guards.
        if (person.factionId !== input.factionId) continue;
        // Before anything else is read off the row, and it wins over the roll:
        // being on one list with somebody nine rungs up is not being able to
        // tell they are there.
        if (!noticesThatTheyAreThere({
            theirOrdinal: person.realmOrdinal,
            yourOrdinal: input.realmOrdinal,
            known: person.known
        })) {
            hiddenByHeight += 1;
            continue;
        }
        if (person.known) continue;
        theyMayName.push(person);
    }

    return { theyMayName, hiddenByHeight };
}

/** What the knowledge row says, in the words a member would use. */
export function howServingTogetherPutIt(
    houseName: string,
    person: SomebodyStandingHere
): string {
    return `${person.name} serves ${houseName} as you do, and you have stood among them.`;
}
