/**
 * No comment restates the field beneath it.
 *
 * AGENTS.md: *if a comment restates the code beneath it, delete the comment. If
 * it explains what a good name would have explained, fix the name instead.*
 * The design owner, on four of them in a row:
 *
 *   > this is in violation of agents.md, and pascal's quote
 *
 * `comments-earn-their-keep.ts` measures the ratio per file, which tells you a
 * file is bad and not which lines to cut. This is the one shape that can be
 * cut mechanically: a single-line doc whose every content word is already in
 * the name under it.
 *
 * ── WHAT THE SWEEP ACTUALLY FOUND, WHICH IS NOT WHAT WAS FEARED ──────────
 *
 * 3,877 single-line docs sit on fields across `src/`. Twenty of them restated
 * the name; the rest carry a sign convention, a range, a null condition, an
 * encoding or a ruling - *"Negative when the subject is the stronger"*,
 * *"False for everybody who does not hold the grant, which is nearly
 * everybody"*, *"Zero when survivable"*. Those are what a type cannot say and
 * they stay. The number is here because the next person to read a run of bad
 * ones will want to know whether the whole file is like that, and mostly it is
 * not.
 */

import { describe, expect, it } from 'vitest';

import {
    commentsRestatingTheirField
} from '../../scripts/a-comment-that-restates-its-field';

describe('a comment earns its keep', () => {
    it('never restates the field beneath it', () => {
        const found = commentsRestatingTheirField('src');
        expect(
            found.map(row => `${row.path}:${row.line}  ${row.comment}  ->  ${row.field}`),
            'Delete the comment, or fix the name so it does not need one. Where the '
            + 'comment says something a NAME cannot - a sign, a range, a null condition, '
            + 'an encoding - add it to REVIEWED_AND_KEPT with the reason.'
        ).toEqual([]);
    }, 120_000);
});
