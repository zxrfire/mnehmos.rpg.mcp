/**
 * THE FAR SIDE OF THE LID, AS SOMEWHERE A PLAYER CAN ACTUALLY BE.
 *
 * Ordinal 46 is the one point where progression is also geographic: reaching
 * True Immortal does not make somebody a louder version of themselves in their
 * starting province, it MOVES them, through the Lid, onto a second layer of the
 * same world. `engine/world/immortal-world.ts` has modelled that layer in full
 * for a long time - the seam, the landing, five houses older than the lower
 * world's records, residents, standing computed on tenure and holdings rather
 * than on a second power ladder, a peril clock, ascension as a transition,
 * `descend`, and `sendAcross`.
 *
 * NOTHING IN THE CODEBASE CALLED ANY OF IT. Played cold at ordinal 46, every
 * verb a player typed came back "Not from here" and there was nothing else -
 * a well-written refusal in front of an empty room, which read as the game
 * ending rather than as the game moving.
 *
 * ── WHAT AN IMMORTAL ACTUALLY HAS ────────────────────────────────────────
 *
 * Two things, and they are the two the setting has always described.
 *
 * AN ABODE. The landing is open ground nobody owns and everybody arrives on.
 * Somebody who comes through settles, and that is the first thing that happens
 * up there. `settleAbode` makes it an ordinary location on the immortal layer -
 * no new kind, no new table, no immortal-specific fields - so it is somewhere
 * to be, somewhere to keep what they make, and somewhere they can be found.
 *
 * A CHOICE ABOUT THE WORLD BELOW, in exactly two forms:
 *
 *   BY PROXY   send an object down, and a message saying what it is for. No
 *              tribulation, because nothing of them crosses - and no control,
 *              because what happens next is done by people who are not them
 *              and who will do what they think was meant. `OBJECT_CEILING_
 *              BELOW_THE_LID` is why this is interesting rather than a win
 *              button: a 46 cannot stay down there, so what arrives and
 *              REMAINS is a 45, which is precisely how the best objects in the
 *              world came to exist. See `HOW_A_FORTY_FIVE_EXISTS`.
 *
 *   IN PERSON  `evaluateLidTransit(down)`, at nine strikes - above the heaviest
 *              crossing in the game - for ten to fifteen breaths on the ground,
 *              after which the expulsion happens on its own, because a True
 *              Immortal in the lower world is a thing being pushed back out.
 *              Enough to end a faction. Not enough to take one.
 *
 * Nothing in this file is a new mechanic. It is the wiring between a closed
 * action set and three functions that were already written, plus the two
 * predicates that decide which of them a sentence reaches.
 */

import type { Cultivator } from '../schema/cultivation.js';
import {
    BREATHS_IN_THE_LOWER_REALM,
    OBJECT_CEILING_BELOW_THE_LID,
    TRUE_IMMORTAL_ORDINAL
} from '../engine/cultivation/realms.js';
import { canExistBeyondTheLid } from '../engine/cultivation/existence.js';
import {
    IMMORTAL_LANDING_LOCATION_ID,
    LID_CHANNEL_TAG,
    abodeLocationId,
    ensureImmortalLayer,
    immortalStanding,
    readTwoWays,
    settleAbode,
    type ImmortalStanding,
    type TwoReadings
} from '../engine/world/immortal-world.js';
import { IMMORTAL_LAYER } from '../engine/world/layers.js';
import { createNpc, type NpcRecord } from '../engine/world/npc-state.js';
import { getLocation, getNpc, upsertNpc, type WorldState } from '../engine/world/world-state.js';
import type { LocationRecord, ObjectRecord } from '../engine/world/index.js';

/** Days in a year, for turning an age into a birth day on the world clock. */
const DAYS_PER_YEAR = 365;

export interface Resident {
    npc: NpcRecord;
    abode: LocationRecord | null;
    /** True when this call is what put them somewhere rather than on the landing. */
    settledJustNow: boolean;
    standing: ImmortalStanding | null;
    readings: TwoReadings | null;
}

/**
 * The player, as somebody the far side has a row for.
 *
 * The world layer keys everything on `NpcRecord`, and the player has never had
 * one - they are an `Observer` for the history feed and a `Cultivator` row for
 * everything else. That is fine below the Lid, where the player interacts with
 * the world through their own verbs; it is not fine above it, where the layer's
 * whole vocabulary (standing, holdings, residents, the peril clock, `descend`,
 * `sendAcross`) is written against a resident.
 *
 * So crossing materialises one, with the SAME ID as the cultivator, which is
 * what keeps lineage edges, grudges, history facts and object provenance
 * resolving across the boundary instead of quietly becoming two people.
 *
 * Idempotent. Called on every act above the Lid, and after the first it is two
 * lookups.
 */
export function residentAbove(
    state: WorldState,
    cultivator: Cultivator,
    onDay: number
): Resident | null {
    if (!canExistBeyondTheLid(cultivator)) return null;

    ensureImmortalLayer(state);

    let npc = getNpc(state, cultivator.id);
    if (!npc) {
        npc = createNpc(state.seed, {
            id: cultivator.id,
            name: cultivator.name,
            bornOnDay: Math.max(0, Math.floor(onDay - cultivator.age * DAYS_PER_YEAR)),
            onDay,
            layer: IMMORTAL_LAYER,
            locationId: IMMORTAL_LANDING_LOCATION_ID,
            // Everybody up here stands at 46. It is the entry ticket rather
            // than a differentiator, and a newcomer's is identical to a
            // founder's - which is the whole reason `immortalStanding` is
            // built out of tenure and holdings instead.
            cultivation: { realmOrdinal: TRUE_IMMORTAL_ORDINAL },
            // Nothing goes through the Lid with the cultivator. The purse is
            // one of the things it took.
            spiritStones: 0,
            occupation: 'came through'
        });
        Object.assign(state, upsertNpc(state, npc));
    } else if (npc.layer !== IMMORTAL_LAYER) {
        // THE ROW WAS ALREADY THERE, ON THE WRONG SIDE.
        //
        // Since `the-player-as-a-row-the-world-can-invite.ts`, the player has a
        // mortal-layer row from the first span - so by the time anybody crosses
        // the Lid, `getNpc` finds one and the branch above never runs. Left
        // unhandled, a True Immortal would stand on the immortal layer with a
        // record that still says `mortal`, and `isBelowTheLid` would keep
        // returning them to every pass in the lower world.
        //
        // Moving it is the correct operation rather than replacing it:
        // `npc-state.ts` says ascension "changes nothing else about the record:
        // the same id, the same lineage edges, the same grudges, the same
        // history". So the layer, the landing and the rung move, and the
        // person does not.
        npc = {
            ...npc,
            layer: IMMORTAL_LAYER,
            locationId: IMMORTAL_LANDING_LOCATION_ID,
            cultivation: { ...npc.cultivation, realmOrdinal: TRUE_IMMORTAL_ORDINAL },
            // The purse is one of the things the Lid took, the same as for
            // somebody arriving without a row.
            spiritStones: 0,
            updatedOnDay: onDay,
            lastConfirmedOnDay: onDay
        };
        Object.assign(state, upsertNpc(state, npc));
    }

    const hadAbode = getLocation(state, abodeLocationId(cultivator.id)) !== null;
    const settled = settleAbode(state, { residentId: cultivator.id, onDay });
    const current = getNpc(state, cultivator.id) ?? npc;

    return {
        npc: current,
        abode: settled.abode,
        settledJustNow: settled.created && !hadAbode,
        standing: immortalStanding(state, current.id, onDay),
        readings: readTwoWays(state, current.id, onDay)
    };
}

/**
 * A line through the Lid this resident could actually use.
 *
 * The channel is an OBJECT, held by somebody on the far side from the sender,
 * and that is the whole of what makes one body able to reach across and another
 * unable to. `ascend` marks a parting gift with `LID_CHANNEL_TAG` on the way
 * out, so a house that was left something is a house that can be reached and a
 * house that was left nothing hears nothing - which is exactly the difference
 * between the four bodies in `IMMORTAL_CHANNELS` and everybody else.
 *
 * Returns every candidate rather than picking one, because which line to use is
 * a decision with consequences: the object names the recipient.
 */
export function linesDownward(state: WorldState, residentId: string): ObjectRecord[] {
    const resident = getNpc(state, residentId);
    if (!resident) return [];
    return state.objects.filter(object =>
        object.tags.includes(LID_CHANNEL_TAG)
        && object.possessorId !== null
        && object.possessorId !== residentId);
}

/**
 * What is on the far end of a line: the person who holds it.
 *
 * A channel reaches exactly one person, which is the property that makes it a
 * channel rather than an announcement.
 */
export function holderOf(state: WorldState, channel: ObjectRecord): NpcRecord | null {
    return channel.possessorId ? getNpc(state, channel.possessorId) : null;
}

/**
 * The two answers a mortal-world sentence has above the Lid.
 *
 * Rendered as facts rather than as a refusal, because a refusal is what the
 * player used to get and it was wrong in a specific way: the sentence they
 * typed HAS answers up here, two of them, and both are things the engine can
 * actually resolve. What is not available is doing it the way somebody standing
 * in the province would.
 *
 * Every figure here is read off a constant rather than written down twice.
 */
export function theTwoWaysDown(abodeName: string | null): string[] {
    return [
        abodeName
            ? `You are at ${abodeName}, and the province is on the other side of a hole you had `
              + 'to punch to leave through.'
            : 'You are on the far side of the Lid, and the province is on the other side of a '
              + 'hole you had to punch to leave through.',
        'That is a thing done among people, and the people are down there. There are two ways to '
        + 'reach them and no third.',
        'You can send something down. An object, and a word saying what it is for, through a line '
        + 'somebody down there is holding. Nothing of you crosses, so nothing is drawn on you - '
        + 'and nothing of you is there to see it done, either. What happens next is done by '
        + 'people who are not you, who will do what they think you meant.',
        `And whatever you send has to be able to stay. Nothing above ${OBJECT_CEILING_BELOW_THE_LID} `
        + 'can sit in the lower world; the lightning takes it back the same way it takes you. '
        + 'What arrives and remains is one rung under what you are, which is how every object of '
        + 'that grade in the world got there.',
        `Or you can go yourself. It opens the Lid a second time and the seam discharges: nine `
        + 'strikes, the heaviest tribulation there is, and it does not care that you have already '
        + `weathered a crossing. What it buys is ${BREATHS_IN_THE_LOWER_REALM.min} to `
        + `${BREATHS_IN_THE_LOWER_REALM.max} breaths on the ground, and then the pressure puts you `
        + 'back whether you are finished or not.',
        'Enough to end a house. Not enough to take one, hold ground, install anybody, or govern '
        + 'for an afternoon. That is the whole reason nobody up here rules anything down there.'
    ];
}

/** The mechanical account of the same, for the inspector. */
export function theTwoWaysStructure(action: string, abodeId: string | null): string[] {
    return [
        `existence.canExistBeyondTheLid = true; '${action}' is a mortal-world action and has no `
        + 'form on this layer.',
        `Re-offered as: offer/send (sendAcross, no tribulation, object ceiling `
        + `${OBJECT_CEILING_BELOW_THE_LID}) or descend (evaluateLidTransit(down), 9 strikes, `
        + `${BREATHS_IN_THE_LOWER_REALM.min}-${BREATHS_IN_THE_LOWER_REALM.max} breaths).`,
        abodeId === null
            ? 'No abode on record for this resident.'
            : `Standing at ${abodeId} on the immortal layer.`
    ];
}
