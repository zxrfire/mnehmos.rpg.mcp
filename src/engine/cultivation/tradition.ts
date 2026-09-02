/**
 * The two traditions, as the engine sees them.
 *
 * The world holds two genuinely different ways of cultivating and exactly one
 * ladder. Both climb the same rungs; a fourth-realm practitioner of either is
 * Core Formation and `realmOrdinal` means what it means everywhere else. There
 * is no second scale in this file and there must never be one.
 *
 * WHY THIS IS ENGINE AND NOT CONTENT
 * ----------------------------------
 * Everything about the two traditions is flavour except one thing, and that one
 * thing decides fights: they have different answers to being killed, and the
 * answers are inverses of each other.
 *
 *   A Drawn cultivator at Nascent Soul or above survives the destruction of
 *   their body - the soul leaves intact and can be re-embodied, slowly and at
 *   ruinous cost. They cannot take anyone else's body; that door does not exist
 *   for them. What ends one is ending the soul.
 *
 *   A Cut cultivator has no detachable soul at any rank, so soul-directed arts
 *   do nothing to them whatsoever - not "less", nothing. Destroying the body
 *   usually finishes them, but the seam is worked into material, so a large
 *   enough seam-bearing piece regrows over years into somebody who is not
 *   reliably the same person. What ends one for good is quarrying the seam out
 *   and scattering it.
 *
 * That is a resolution rule, not a description, so it lives beside the code
 * that resolves. `killRequirement` is consulted by `combat.ts` at the moment a
 * lethal blow lands, and by nothing else - `survival.ts` remains the only place
 * a cultivator is actually declared dead.
 *
 * The catalog in `src/data/cultivation/traditions.ts` keeps everything else:
 * the prose, the method, the recognition cues, the war, the cross-tradition
 * errors people die of. It imports the id and this rule from here rather than
 * declaring its own, so the catalog and the engine cannot drift.
 */

import { z } from 'zod';
import { MAX_ORDINAL, realmForOrdinal } from './realms.js';
import { currentWoundKey } from '../../data/cultivation/wounds.js';
import type { Injury } from '../../schema/cultivation.js';

export const TraditionIdSchema = z.enum(['tradition-drawn', 'tradition-cut']);
export type TraditionId = z.infer<typeof TraditionIdSchema>;

/**
 * The tradition a cultivator is assumed to walk when nothing says otherwise.
 *
 * The Drawn road, because it is the one the ladder was described from and the
 * one every rank name in `realms.ts` is phrased for. A row written before
 * traditions existed is a Drawn cultivator, which is what it always was.
 */
export const DEFAULT_TRADITION: TraditionId = 'tradition-drawn';

/**
 * First ordinal at which a Drawn cultivator's soul persists without the body.
 * Nascent Soul, and not a coincidence - it is the realm named for it.
 */
export const SOUL_PERSISTS_FROM_ORDINAL = realmForOrdinal(21).ordinalStart;

/**
 * The mechanical half of each tradition's answer to being killed. Everything
 * here is read by resolution; the prose that explains it is in the catalog.
 */
export interface TraditionDeathRule {
    /**
     * Ordinal at or above which destroying the body stops being an ending, or
     * null when it never stops being one.
     */
    persistsFromOrdinal: number | null;
    /** Whether a soul-directed art finds anything to act on at all. */
    soulAttackWorks: boolean;
    /** What is left behind when the body goes and the person is not finished. */
    remnant: 'soul' | 'seam' | null;
}

export const TRADITION_DEATH_RULES: Readonly<Record<TraditionId, TraditionDeathRule>> = {
    'tradition-drawn': {
        persistsFromOrdinal: SOUL_PERSISTS_FROM_ORDINAL,
        soulAttackWorks: true,
        remnant: 'soul'
    },
    'tradition-cut': {
        // No rank ever detaches a carver from their body. The top of the ladder
        // has no more of an exit than an apprentice does.
        persistsFromOrdinal: null,
        soulAttackWorks: false,
        remnant: 'seam'
    }
};

export interface KillRequirement {
    /** True when destroying the body is, by itself, the end of this person. */
    bodyIsEnough: boolean;
    /** True when a soul-directed art has anything to act on. */
    soulAttackWorks: boolean;
    /** What survives a destroyed body, when anything does. */
    remnant: 'soul' | 'seam' | null;
    /** Plain statement of what actually finishes them, stated to be planned around. */
    note: string;
}

/**
 * Whether this body is holding a nascent soul that cannot leave it.
 *
 * A realm-boundary wound locks the thing its realm exists to grant, and what
 * Nascent Soul grants is surviving the loss of your own body. `wounds.ts` says
 * so in the row itself - "mortal in the way that matters: destroy the body and
 * they are gone" - and this is the one live door that sentence can arrive
 * through.
 *
 * Untreated only, and through `currentWoundKey`, so a cultivator saved under
 * the old name for this wound is still carrying it after the rename.
 */
function nascentSoulCannotLeave(injuries: readonly Injury[] | undefined): boolean {
    return (injuries ?? []).some(injury =>
        !injury.treated && currentWoundKey(injury.woundType) === 'crippled-nascent-soul');
}

/**
 * What ending this cultivator actually requires, given their tradition, rank,
 * and what they are carrying.
 *
 * Two people standing at the same ordinal can need entirely different things
 * done to them, which is why knowing which tradition you are facing is worth
 * more than knowing their rank, and why everyone competent knows this.
 *
 * ── AND WHY THE THIRD ARGUMENT ───────────────────────────────────────────
 *
 * Because a rung is a claim about what somebody can do, and a realm-boundary
 * wound is the claim failing. The Drawn rule above reads the LADDER: at or
 * above Nascent Soul the soul persists and destroying the body is an expense.
 * A crippled nascent soul is precisely the case where that is false about a
 * person the ladder says it is true of, and the difference is the whole of
 * what the wound is for.
 *
 * `injuries` is optional and its absence is not a claim of health - it means
 * the caller did not know, and an unknown carries the ordinary rule. The only
 * caller that does know is `assessPower` in `combat.ts`, which is the moment
 * the question is actually asked.
 *
 * Nothing changes for the Cut: their answer was never about a soul leaving a
 * body, and no wound to a nascent soul reaches a person who has not got one
 * to detach.
 */
export function killRequirement(
    traditionId: TraditionId,
    ordinal: number,
    injuries?: readonly Injury[]
): KillRequirement {
    const rule = TRADITION_DEATH_RULES[traditionId];
    if (!rule) throw new Error(`Unknown tradition: ${traditionId}`);

    if (traditionId === 'tradition-cut') {
        return {
            bodyIsEnough: false,
            soulAttackWorks: false,
            remnant: 'seam',
            note:
                'Destroying the body kills a carver in the ordinary case and leaves the seam. Finishing one means quarrying the seam out and scattering it, and a party who does not know this will believe the job is done.'
        };
    }

    const persists =
        rule.persistsFromOrdinal !== null &&
        clampToLadder(ordinal) >= rule.persistsFromOrdinal &&
        !nascentSoulCannotLeave(injuries);

    const crippled = !persists && nascentSoulCannotLeave(injuries);

    return {
        bodyIsEnough: !persists,
        soulAttackWorks: true,
        remnant: persists ? 'soul' : null,
        note: persists
            ? 'Above Nascent Soul the body is an expense rather than a life. Finishing one means ending the soul, and there are perhaps four arts in the catalog that do it.'
            : crippled
                // Said plainly, because the winner's belief is the thing that
                // matters here and it will usually be wrong in the other
                // direction: they will expect to have to end a soul.
                ? 'The nascent soul is there and it is crippled - it cannot survive outside the body it is holding together. They read as Nascent Soul to anybody who checks, and an ordinary killing finishes them anyway.'
                : 'Below Nascent Soul the body is the whole of the person, and an ordinary killing is an ordinary killing.'
    };
}

/**
 * Whether a soul-directed art does anything at all to this cultivator.
 *
 * Separate from `killRequirement` because it is asked at a different moment:
 * this decides whether the strike lands, that decides whether the killing
 * counts.
 */
export function soulAttacksAffect(traditionId: TraditionId): boolean {
    return TRADITION_DEATH_RULES[traditionId].soulAttackWorks;
}

/** Coerce anything to a legal ordinal without pretending an illegal one was fine. */
function clampToLadder(ordinal: number): number {
    if (!Number.isFinite(ordinal)) return 0;
    return Math.max(0, Math.min(MAX_ORDINAL, Math.floor(ordinal)));
}

/** Parse a stored tradition id, falling back to the default for legacy rows. */
export function traditionOrDefault(value: unknown): TraditionId {
    const parsed = TraditionIdSchema.safeParse(value);
    return parsed.success ? parsed.data : DEFAULT_TRADITION;
}
