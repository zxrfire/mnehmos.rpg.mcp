/**
 * Using a furnace technique on somebody, and what the world does with it.
 *
 * This is the impure edge around `useAFurnaceTechnique` in
 * `engine/social-leverage/an-art-that-needs-two-people.ts`.
 * That function is pure - two people and a day in, a decision out - and this
 * file is what actually writes the decision into the world, in the same
 * order `takeFromYourOwnHouse` (`house-property-theft.ts`) does it in:
 *
 *     the act resolves first     because whether it worked does not depend
 *                                 on who saw it
 *     the ledger opens second    only where there is something to open
 *     the world fact is last     read by the witness/rumour pipeline exactly
 *                                 like any other deed
 *
 * `conceived` is handed back to the caller rather than turned into a person
 * here. Making somebody exist is `birth.ts`'s job, on its own timeline, and a
 * conception this file created directly would be a second place a child comes
 * from - the exact defect `what-sex-somebody-is-and-what-it-is-for.ts` warns
 * about for the routes that already exist.
 */

import {
    type FurnaceConsent,
    type FurnaceUseResult,
    useAFurnaceTechnique
} from '../engine/social-leverage/an-art-that-needs-two-people.js';
import type { Sex } from '../engine/birth/what-sex-somebody-is-and-what-it-is-for.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../engine/world/history.js';
import type { ObligationInput } from '../engine/social/grudges.js';
import type { WorldState } from '../engine/world/world-state.js';
import type { SectAlignment } from '../schema/cultivation.js';
import { whoHoldsTheGround } from '../engine/world/ground-holder.js';
import {
    type IfCaught,
    ifCaughtAtSomethingTheHousePunishes
} from '../engine/social-leverage/what-a-house-does-when-it-catches-you.js';
import {
    type HouseVerdict,
    whenItIsDoneToOneOfOurs
} from '../engine/social-leverage/what-a-house-will-do-about-it.js';

export interface FurnaceUseRequest {
    world: WorldState;
    actorId: string;
    actorName: string;
    actorSex: Sex;
    subjectId: string;
    subjectName: string;
    subjectSex: Sex;
    onDay: number;
    locationId: string | null;
    consent: FurnaceConsent;
    /** `[0,1)`. Caller-owned stream - see `useAFurnaceTechnique`. */
    conceptionSample: number;
    /** `[0,1)`. Caller-owned stream - see `useAFurnaceTechnique`. */
    deathSample: number;
    /**
     * Somebody with standing present, if anybody is - the same field
     * `TakingInput.seenBy` is in `house-property-theft.ts`. Null is the
     * ordinary case: the act still happened and the world fact still carries
     * whoever `appendWorldFact` finds standing there on its own, but nobody
     * with a house behind them can act on it YET. What later notice does with
     * it is `when-somebody-works-out-what-you-did.ts`'s job, not this file's.
     */
    seenBy: { id: string; name: string } | null;
    /**
     * The subject's own house, when they belong to one the caller cares
     * about. Read by `whenItIsDoneToOneOfOurs` exactly as it is for any other
     * wrong done to a ranked member - see that file's header for why a
     * righteous house takes this up and a demonic one prices its own member
     * instead.
     */
    subjectHouse?: { alignment: SectAlignment | null; ranked: boolean } | null;
}

export interface FurnaceUseOutcome extends FurnaceUseResult {
    /**
     * The grudge to write to the subject's ledger, converted from the plain
     * `ObligationInput` the engine returned. `createObligation` is the
     * caller's to run - this file does not touch the ledger's own store.
     */
    grudge: ObligationInput | null;
    /**
     * What whoever holds the ground it happened on does about it, read off
     * `ifCaughtAtSomethingTheHousePunishes` exactly as `house-property-theft.ts`
     * reads it for a taking. `'nothing'` whenever it was not seen or nobody
     * holds the ground - the same two failure modes theft already has.
     */
    groundResponse: IfCaught;
    /** What the subject's own house does about it, or null where none was given. */
    factionVerdict: HouseVerdict | null;
}

/**
 * Use a furnace technique and enter it into the world's own record.
 *
 * Mutates nothing: it appends one fact to `world.history` through the ordinary
 * witness pipeline and returns everything else for the caller to write -
 * `createGrudge(outcome.grudge)` onto the ledger, and, where `conceived` is
 * true, a `LineageEdge` for both parents once `birth.ts` decides the child is
 * real. The world fact is written regardless of `conceived`: a coerced use
 * that did not take is still a wrong that was done, and a witness who saw it
 * does not need to wait nine months to have something to say.
 */
export function useFurnaceTechnique(input: FurnaceUseRequest): FurnaceUseOutcome {
    const outcome = useAFurnaceTechnique({
        actorId: input.actorId,
        actorName: input.actorName,
        actorSex: input.actorSex,
        subjectId: input.subjectId,
        subjectName: input.subjectName,
        subjectSex: input.subjectSex,
        onDay: input.onDay,
        consent: input.consent,
        conceptionSample: input.conceptionSample,
        deathSample: input.deathSample
    });

    if (!outcome.happened) {
        return { ...outcome, groundResponse: 'nothing', factionVerdict: null };
    }

    appendWorldFact(input.world, makeFact({
        day: input.onDay,
        kind: 'grudge_opened',
        locationId: input.locationId,
        summary: outcome.line,
        actors: [
            { id: input.actorId, name: input.actorName, role: 'actor' },
            { id: input.subjectId, name: input.subjectName, role: 'subject' }
        ],
        visibility: input.consent === 'coerced' ? 'secret' : 'regional',
        causeKnown: true,
        data: {
            furnace: true,
            consent: input.consent,
            conceived: outcome.conceived,
            subjectDied: outcome.subjectDied
        }
    }));

    if (input.consent === 'offered') {
        return { ...outcome, groundResponse: 'nothing', factionVerdict: null };
    }

    // ── COERCED, AND SEEN: WHOEVER HAS A CLAIM ANSWERS IT ────────────────
    //
    // Two claims, and they are independent because the design already
    // establishes that they are: `whoHoldsTheGround` is a claim on the GROUND
    // this happened on, and `subjectHouse` is a claim through the PERSON it
    // was done to. A righteous sect that holds this ground answers for it
    // whether or not the subject is one of theirs; a righteous sect the
    // subject belongs to answers for it wherever it happened. Neither is
    // bespoke - both functions already exist and already answer this exact
    // question for a taking and for a manoeuvre run on somebody, respectively.
    const ground = whoHoldsTheGround(input.world.locations, input.locationId);
    const groundResponse = input.seenBy === null
        ? 'nothing'
        : ifCaughtAtSomethingTheHousePunishes({
            theirsToPunish: ground.holding === 'held',
            alignment: ground.alignment
        });

    const factionVerdict = input.subjectHouse
        ? whenItIsDoneToOneOfOurs({
            alignment: input.subjectHouse.alignment,
            ranked: input.subjectHouse.ranked,
            wasAnAttachment: true,
            ask: 'a_betrayal'
        })
        : null;

    return { ...outcome, groundResponse, factionVerdict };
}
