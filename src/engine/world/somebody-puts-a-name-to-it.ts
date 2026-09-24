/**
 * Somebody walks in twenty years later and says who did it.
 *
 * A house whose disciple was killed by nobody it can name carries an account
 * with no name on it (`accounts-with-no-name.ts`), and that account has always
 * been able to receive a name - `aNameAttaches` was written for it and nothing
 * ever called it. This is the call.
 *
 * WHAT IT IS NOT. Not a pass, not a roll, not a chance the world takes on its
 * own. A name arrives because somebody carried it in and said it, which is why
 * this takes who told them: a player who found out what happened in a ruin, a
 * witness who has finally stopped being afraid, a rival with a reason to make
 * trouble for the man they are naming. The engine does not care which.
 *
 * AND THE HOUSE IS ANGRY ABOUT IT. An account that spent twenty years pointing
 * at nobody now points at a person, and the holder's standing toward that
 * person has to move or the naming changed nothing anybody could act on. What
 * it does not do is decide what they do about it.
 *
 * THE NAME IS A CLAIM AND THE ACCOUNT SAYS SO. `aNameAttaches` writes
 * `fromBelief: true`, tags the row `told-by:<id>` and puts the teller in
 * `participants` - so a house acting on this is acting on what somebody said,
 * and it knows whose word it was. That is the whole of what a lie needs: the
 * teller is owed for it while it holds, and is standing next to it when it
 * does not. Nothing here checks whether the name is true, because nobody in
 * the world could.
 */

import type { WorldState } from './world-state.js';
import { createObligation } from '../social/grudges.js';
import { aNameAttaches, hasANameOnIt, NO_NAME_TAG } from '../social/accounts-with-no-name.js';
import { indexById } from './world-state.js';
import { upsertRelationship } from './npc-state.js';

/**
 * How cold a house's holder stands toward the man they have just been told did
 * it.
 *
 * The bottom of the scale, because `killed_sectmate` at `grave` is what the
 * account already says and this is only that account read as a tie. A name
 * arriving does not soften anything.
 */
export const WHAT_BEING_NAMED_FOR_IT_COSTS = -1;

/**
 * What the holder thinks of the person who told them, while the name holds.
 *
 * A stranger who ends a twenty-year silence has done the house a service and
 * is owed for it - and this is also the stake. The tie is what breaks if the
 * name turns out to be wrong, and it is warm precisely so that breaking it
 * costs something. A teller nobody thought well of has nothing to lose by
 * lying.
 */
export const WHAT_TELLING_THEM_IS_WORTH = 0.4;

/**
 * How badly they have to think of somebody before they will not hear it.
 *
 * WHETHER A NAME LANDS DEPENDS ON WHO IS SAYING IT. A house does not take the
 * word of a man it holds a grudge against, and a name from that mouth is
 * likelier to be trouble than truth. Below this and nothing attaches.
 *
 * A STRANGER IS BELIEVED, which is the case this was built for: somebody with
 * no tie to the house at all carries no reason to be doubted. Being unknown is
 * not being distrusted, and reading it as distrust would make the twenty-years-
 * later arrival impossible - the one story the whole mechanism exists for.
 */
export const TOO_LITTLE_TO_BE_BELIEVED = -0.4;

export interface ANameWasPutToIt {
    /** Accounts that gained a name. */
    named: number;
    /** Whether the holder's tie toward the named person moved. */
    theyTookItPersonally: boolean;
    /** False where the holder would not take this person's word. */
    believed: boolean;
}

/**
 * Tell the holder of a nameless account who it was.
 *
 * Every account they carry with no name on it gains this one, because a house
 * carrying two nameless accounts for one death is the same death twice and
 * naming one of them would leave the other pointing nowhere. A caller that
 * means one account passes its id.
 */
export function somebodyPutsANameToIt(
    state: WorldState,
    input: {
        holderId: string;
        subjectId: string;
        subjectName: string;
        toldById: string | null;
        /** How the teller is known to them. Their id, where nothing better. */
        toldByName?: string;
        onDay: number;
        /** One account, where the caller means one. */
        obligationId?: string;
    }
): ANameWasPutToIt {
    const holderAt = indexById(state.npcs, input.holderId);
    if (input.toldById !== null && holderAt >= 0) {
        const held = state.npcs[holderAt]!.relationships
            .find(tie => tie.targetId === input.toldById);
        if (held !== undefined && held.standing <= TOO_LITTLE_TO_BE_BELIEVED) {
            return { named: 0, theyTookItPersonally: false, believed: false };
        }
    }

    let named = 0;
    for (let i = 0; i < state.obligations.length; i++) {
        const held = state.obligations[i]!;
        if (held.holderId !== input.holderId) continue;
        if (input.obligationId !== undefined && held.id !== input.obligationId) continue;
        if (hasANameOnIt(held) || !held.tags.includes(NO_NAME_TAG)) continue;

        const arrives = aNameAttaches(held, {
            subjectId: input.subjectId,
            onDay: input.onDay,
            fromHolderId: input.toldById
        });
        state.obligations[i] = createObligation(arrives.row);
        named++;
    }

    if (named === 0) return { named: 0, theyTookItPersonally: false, believed: true };

    const at = holderAt;
    if (at < 0) return { named, theyTookItPersonally: false, believed: true };
    state.npcs[at] = upsertRelationship(state.npcs[at]!, {
        targetId: input.subjectId,
        targetName: input.subjectName,
        kind: 'enemy',
        standing: WHAT_BEING_NAMED_FOR_IT_COSTS,
        note: 'Named to them as the one who did it.'
    }, input.onDay);

    // AND THEY THINK WELL OF WHOEVER TOLD THEM, which is the thing a liar is
    // spending. Not written where the teller named themselves the killer, and
    // not where nobody is named as having told them.
    if (input.toldById !== null && input.toldById !== input.subjectId) {
        state.npcs[at] = upsertRelationship(state.npcs[at]!, {
            targetId: input.toldById,
            targetName: input.toldByName ?? input.toldById,
            kind: 'ally',
            standing: WHAT_TELLING_THEM_IS_WORTH,
            note: 'Told them who it was.'
        }, input.onDay);
    }
    return { named, theyTookItPersonally: true, believed: true };
}
