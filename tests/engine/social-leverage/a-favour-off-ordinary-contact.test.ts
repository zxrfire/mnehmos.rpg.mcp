/**
 * An elder could put the player in their personal debt, and nothing called it in.
 *
 * `contact.ts` writes a role onto the tie every time two people deal with each
 * other, and two of those roles are favours:
 *
 *     kind 'instruction'  -> ['owes_a_favour']       the player owes them
 *     kind 'asked'        -> ['is_owed_a_favour']    they owe the player
 *
 * `spending-a-word-to-place-a-child.ts` writes one too. The column exists, the
 * migration has held it since the social schema landed, and the round trip
 * through storage is pinned by its own test.
 *
 * Nothing in `src/` read either of them. Searched by name: two writers, no
 * reader. So an elder gives an instruction, the world records that the player
 * owes them for it, and no code in the game can ever collect - which is the
 * mirror of the field-nothing-writes that AGENTS.md names, one turn around, and
 * the harder one to notice because everything looks busy.
 *
 * ── WHY THE LEVERAGE PRICER, AND NOT THE LEDGER READ ─────────────────────
 *
 * `whatYouBringToBear` already has a `favour` term and already prices it. It
 * counted only the OBLIGATION LEDGER: rows opened by something that happened,
 * settleable, with a severity. A tie role is the lighter record and comes from
 * ordinary contact, which opens no row at all.
 *
 * So the two are disjoint rather than duplicates, and counting both
 * double-counts nothing: an instruction writes the role and opens no account.
 * That is the whole reason the favour was invisible - it was never in the place
 * anybody was looking.
 *
 * ── AND IT IS ONE BIT, NOT A COUNT ───────────────────────────────────────
 *
 * `roles` is a set on the tie, so it says whether a favour stands and never how
 * many. Twenty errands run for one elder are one role, and that is the honest
 * reading of what the column holds rather than something inferred from it.
 */

import { describe, it, expect } from 'vitest';

import {
    whatYouBringToBear,
    type WhatIsActuallyBehindYou
} from '../../../src/engine/social-leverage/background-as-leverage';

const BASE: WhatIsActuallyBehindYou = {
    actorId: 'me',
    subjectId: 'them',
    realmsOverThem: 0,
    yourHouse: null,
    theirHouse: null,
    ledger: []
};

const behind = (over: Partial<WhatIsActuallyBehindYou> = {}) =>
    whatYouBringToBear({ ...BASE, ...over });

/**
 * Asserted on the RETURNED shape, which is `leverage` plus `because`. The
 * per-kind map inside the function is not exported and a test written against
 * it would be pinning an implementation detail rather than the answer the
 * resolver acts on.
 */
const saysAFavourStands = (brought: { because: readonly string[] }): boolean =>
    brought.because.some(line => /favour/i.test(line));

describe('a favour owed off ordinary contact', () => {
    it('is nothing when there is no tie and no ledger', () => {
        const brought = behind();
        expect(brought.leverage).toBe('none');
        expect(saysAFavourStands(brought)).toBe(false);
    });

    /**
     * THE DEFECT. The tie says they owe the player and the pricer could not
     * see it, because it read accounts and this is not an account.
     */
    it('counts when the tie says they owe the player', () => {
        const brought = behind({ theirTie: { roles: ['is_owed_a_favour'] } });
        expect(brought.leverage).toBe('favour');
        expect(saysAFavourStands(brought)).toBe(true);
        expect(brought.because.join(' ')).toContain('what has passed between you');
    });

    /**
     * AND ONLY THAT DIRECTION. `owes_a_favour` on the tie is the player owing
     * THEM, which is not something the player brings to bear on anybody - it is
     * a thing that can be brought to bear on the player.
     */
    it('does not count a favour the player owes as one they can spend', () => {
        const brought = behind({ theirTie: { roles: ['owes_a_favour'] } });
        expect(brought.leverage).toBe('none');
        expect(saysAFavourStands(brought)).toBe(false);
    });

    it('ignores the other roles a tie carries', () => {
        const brought = behind({ theirTie: { roles: ['shares_a_secret', 'married'] } });
        expect(saysAFavourStands(brought)).toBe(false);
    });

    it('is unbothered by a tie with no roles at all, or none', () => {
        expect(saysAFavourStands(behind({ theirTie: { roles: [] } }))).toBe(false);
        expect(saysAFavourStands(behind({ theirTie: null }))).toBe(false);
    });

    /**
     * IT IS ONE BIT. The set says a favour stands, never how many, so a tie
     * cannot be read as a stack of them.
     */
    it('counts a role once however often it appears', () => {
        const once = behind({ theirTie: { roles: ['is_owed_a_favour'] } });
        const twice = behind({
            theirTie: { roles: ['is_owed_a_favour', 'is_owed_a_favour'] }
        });
        expect(twice.because).toEqual(once.because);
    });
});
