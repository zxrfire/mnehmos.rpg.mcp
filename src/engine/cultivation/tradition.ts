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
 * What ending this cultivator actually requires, given their tradition and
 * rank.
 *
 * Two people standing at the same ordinal can need entirely different things
 * done to them, which is why knowing which tradition you are facing is worth
 * more than knowing their rank, and why everyone competent knows this.
 */
export function killRequirement(traditionId: TraditionId, ordinal: number): KillRequirement {
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
        clampToLadder(ordinal) >= rule.persistsFromOrdinal;

    return {
        bodyIsEnough: !persists,
        soulAttackWorks: true,
        remnant: persists ? 'soul' : null,
        note: persists
            ? 'Above Nascent Soul the body is an expense rather than a life. Finishing one means ending the soul, and there are perhaps four arts in the catalog that do it.'
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
