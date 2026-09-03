/**
 * Who turns you away from a ruin, and how much of that you are told.
 *
 * ── THE DEFECT THIS EXISTS FOR ───────────────────────────────────────────
 *
 * `locationFromRuin` mints a ruin out of a house that died and stamps an entry
 * bar on it derived from how dangerous the place is: `entry = danger - 10`. That
 * arithmetic invents a REFUSAL out of a fact about DEPTH, and it hands the
 * refusal to nobody. Measured on a seeded world:
 *
 *   262 locations carry an entry bar. 235 name a holder on their own row - 157
 *   precincts, 70 vaults, 8 caves - and 12 do not: every ruin in the world,
 *   every one of them the seat of a power that no longer exists, every one of
 *   them answering an ordinary cultivator with *"Qi Condensation Layer 1 cannot
 *   enter Coldwell; entry requires Foundation Establishment Late."*
 *
 * There is nobody in Coldwell. Everybody who could have stopped you is dead;
 * that is what made it a ruin.
 *
 * ── THESE ARE TWO QUESTIONS AND THEY HAVE DIFFERENT SUBJECTS ─────────────
 *
 *   WHO CONTROLS IT      a fact about the world. Authority runs apex -> court
 *                        -> local, so a house's claim is not self-standing: it
 *                        holds this ground UNDER somebody, and the chain is the
 *                        answer. `chainToApex` in
 *                        `data/cultivation/governance-and-water-rights.ts`
 *                        already walks it. An unowned ruin has no gatekeeper
 *                        precisely because no chain terminates at it.
 *   WHAT YOU ARE TOLD    a fact about the reader. Low rung, you know nothing.
 *                        High, you are given the name; higher, the authority
 *                        behind the name.
 *
 * Collapsing them is what produced the twelve identical refusals, because
 * **"nobody holds this" and "somebody holds this and you are too low to be told
 * who" printed the same sentence** - and they are opposite facts. The first is
 * an invitation. The second is a warning. So {@link GroundClaim} has three
 * values and not two, and the middle one is the one that keeps somebody alive:
 * being unable to read a claim is itself a reading, and *this is somebody's* is
 * more use than either the name or a shrug.
 *
 * ── THE RULE ABOUT THE BAR ───────────────────────────────────────────────
 *
 *   AN ENTRY BAR IS A PERSON. Where a house holds the ground, the bar is that
 *   house's disciples on the road. Where nobody holds it, there is nobody to do
 *   the turning, and the bar is not a bar.
 *
 * It does not make the place safe, and that distinction is the whole of it. The
 * `survival` bar is geology - what is down there is down there - and it goes on
 * applying to somebody who walks in unopposed. So an unheld ruin stops reading
 * `barred` and starts reading `lethal`: admitted, and the ground taking them
 * apart by the day. That is the shape `inheritance-trials.ts` already states for
 * the ordinary case - *"nothing forbids entry... the question is whether they
 * walk out"* - and `docs/world/places/ruins.md` states it from the other end:
 * *"An unclaimed ruin is precious, and the reason nobody is charging you is
 * itself information."*
 *
 * ── SCOPE: RUINS, AND DELIBERATELY NOT EVERYTHING UNHELD ─────────────────
 *
 * 27 of the 262 entry bars have no holder and only 12 are ruins. The other 15
 * are wilds, secret realms and one cave, and their bars come from
 * `how-a-cultivator-comes-by-a-road.ts` rather than from a dead house - ground
 * that teaches something, whose bar means the ground and not a doorkeeper.
 * Whether those should also open is a separate question with a different answer,
 * and widening this to reach them would be fixing the gap nobody demonstrated.
 *
 * ── AND IT IS DERIVED, NEVER STORED ──────────────────────────────────────
 *
 * Ruins change hands: a house claims one, a war takes it back. A bar zeroed at
 * minting would leave a claimed ruin with no door for the rest of the world's
 * life. So the question is asked at the moment somebody stands there, off the
 * column the world already maintains.
 *
 * ── WHAT IS NOT HERE ─────────────────────────────────────────────────────
 *
 * **Only the rung axis.** `recognising-whose-art-you-just-watched.ts` reads a
 * claim on two axes and takes the lower - what your rung affords, and what your
 * REFERENCE for that house affords - and the second needs a knowledge gate this
 * module cannot see, because `evaluateAccess` is handed a location and an
 * ordinal and nothing else. A caller that holds an awareness record should lower
 * the reading further; nothing here may raise it.
 *
 * Pure. A record and a rung in, a reading out. No I/O, no RNG, no mutation.
 */

import {
    chainToApex,
    getApexInstitution,
    getCourt
} from '../../data/cultivation/governance-and-water-rights.js';
import { getSect } from '../../data/cultivation/sects.js';
import { FOUNDATION_ORDINAL } from '../cultivation/realms.js';
import { ELDER_FLOOR_ORDINAL } from '../../data/cultivation/inheritance-trials.js';
import type { LocationRecord } from './locations.js';

/**
 * What a reader may be told about who controls this ground.
 *
 * Three values because two of them were being printed identically. See the
 * header: the middle one is the warning, and it is the one that was missing.
 */
export type GroundClaim =
    /** No chain terminates here. Nobody is turning anybody away. */
    | 'nobody'
    /** Somebody holds it and this reader stands too low to be told who. */
    | 'somebody_unnamed'
    /** They may be told the house, and above the elder floor its authority. */
    | 'named';

export interface RuinGatekeeper {
    /**
     * True when the entry bar on this ground has somebody behind it.
     *
     * False only for a ruin nobody holds. Everywhere else this is true and the
     * bar applies exactly as it always has, whether or not a name comes back.
     * **Independent of the reader**: what somebody is allowed to know never
     * changes what happens to them at the door.
     */
    barApplies: boolean;
    claim: GroundClaim;
    /**
     * The world's own answer, ungated. Present whenever somebody holds this.
     *
     * Not a leak: this is the mechanical channel, the same one `describeGround`
     * has always returned `controllingFactionId` on. The gate is on the two
     * fields below, which are what a player is told in words.
     */
    factionId: string | null;
    /** Null unless `claim` is `named`, or where the catalog cannot place them. */
    factionName: string | null;
    /**
     * Whose authority the claim runs on, outermost first: apex, then court,
     * then the house standing here.
     *
     * Empty below the elder floor even when the name is given, because the
     * house on the road is what a disciple knows and who stands behind it is
     * what an elder knows. Empty too where the register has no chain to walk,
     * which is a fact about the register and is reported as such rather than
     * invented.
     */
    authority: readonly string[];
}

const NOBODY_IS_HERE: RuinGatekeeper = Object.freeze({
    barApplies: false,
    claim: 'nobody' as const,
    factionId: null,
    factionName: null,
    authority: Object.freeze([]) as readonly string[]
});

/**
 * The rung at which a claim stops being weather and starts having a name on it.
 *
 * Not a new number. `FOUNDATION_ORDINAL` is where somebody stops being one of
 * the people a house does not explain itself to, and it is already the boundary
 * the ladder is cut at.
 */
export const TOLD_THE_NAME_AT = FOUNDATION_ORDINAL;

/**
 * And the rung at which they are told what stands behind it.
 *
 * `ELDER_FLOOR_ORDINAL` is the catalog's own line for the height at which a
 * person is sent into somebody else's business rather than their own, which is
 * the same population that gets told whose gift a holding is in.
 */
export const TOLD_THE_AUTHORITY_AT = ELDER_FLOOR_ORDINAL;

/** The display name for anything in the three registers, or null. */
function nameOfBody(id: string): string | null {
    return getApexInstitution(id)?.name
        ?? getCourt(id)?.name
        ?? getSect(id)?.name
        ?? null;
}

/**
 * Apex first, then whatever comes down from it, ending at the house here.
 *
 * `chainToApex` walks upward and returns ids local-first; this reverses it so
 * the sentence reads the way authority runs. Ids the catalogs cannot place are
 * dropped rather than printed, because an id is not a name.
 */
function authorityBehind(factionId: string): string[] {
    return chainToApex(factionId)
        .slice()
        .reverse()
        .map(nameOfBody)
        .filter((name): name is string => name !== null);
}

/**
 * Who turns somebody away from this ground, and how much of it they are told.
 *
 * Reads one record and nothing above it: every entry-barred location the world
 * holds carries `controllingFactionId` on its own row rather than inheriting it
 * up the containment chain, measured across all 262 of them, so there is no
 * chain to walk and no reason to take the whole location table to answer this.
 *
 * `readerOrdinal` defaults to the top of what anybody is told, so a caller with
 * no reader - the simulation asking about its own world - gets the whole answer.
 */
export function whoTurnsYouAwayFrom(
    location: LocationRecord,
    readerOrdinal: number = TOLD_THE_AUTHORITY_AT
): RuinGatekeeper {
    const holder = location.controllingFactionId;
    if (!holder) {
        // A ruin with nobody's name on it has nobody at the door. Anywhere else
        // an unattributed bar is somebody this module cannot name rather than
        // an absence of anybody, and it stands.
        return location.kind === 'ruin'
            ? NOBODY_IS_HERE
            : {
                barApplies: true,
                claim: 'somebody_unnamed',
                factionId: null,
                factionName: null,
                authority: []
            };
    }

    if (readerOrdinal < TOLD_THE_NAME_AT) {
        // The warning without the name. This is somebody's, and finding out
        // whose is a thing they would have to go and do.
        return {
            barApplies: true,
            claim: 'somebody_unnamed',
            factionId: holder,
            factionName: null,
            authority: []
        };
    }

    return {
        barApplies: true,
        claim: 'named',
        factionId: holder,
        factionName: nameOfBody(holder),
        authority: readerOrdinal >= TOLD_THE_AUTHORITY_AT ? authorityBehind(holder) : []
    };
}
