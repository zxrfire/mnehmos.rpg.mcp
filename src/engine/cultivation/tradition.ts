/**
 * The two traditions, as the engine sees them. The world holds two genuinely
 * different ways of cultivating and exactly one ladder: both climb the same
 * rungs, and a fourth-realm practitioner of either is Core Formation. There is no
 * second scale in this file and there must never be one.
 */

import { z } from 'zod';
import { MAX_ORDINAL, realmForOrdinal } from './realms.js';
import { currentWoundKey } from '../../data/cultivation/wounds.js';
import type { Injury } from '../../schema/cultivation.js';

export const TraditionIdSchema = z.enum(['tradition-drawn', 'tradition-cut']);
export type TraditionId = z.infer<typeof TraditionIdSchema>;

/**
 * The tradition a cultivator is assumed to walk when nothing says otherwise.
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
 */
function nascentSoulCannotLeave(injuries: readonly Injury[] | undefined): boolean {
    return (injuries ?? []).some(injury =>
        !injury.treated && currentWoundKey(injury.woundType) === 'crippled-nascent-soul');
}

/**
 * What ending this cultivator actually requires, given their tradition, rank, and
 * what they are carrying.
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
