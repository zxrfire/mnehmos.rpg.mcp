/**
 * The reason a house puts a party on the road is DATA.
 *
 * Every assertion here pins a decision that otherwise lives only as a value in
 * a catalog row, which is the class of decision AGENTS.md says gets silently
 * reverted by the next person who finds it surprising.
 *
 * The three that matter most:
 *
 *   1. The beast errands stop at `BEAST_CHANGE_ORDINAL` and nothing else has a
 *      ceiling at all. That is the whole reason juniors go on one kind of
 *      errand and anybody may go on the others, and it is one nullable integer
 *      in ten rows.
 *   2. The ceiling is the IMPORTED constant, not a copy of its current value.
 *      A test asserting `29` would pass forever after the constant moved.
 *   3. No reason is reachable through a branch. Adding an eleventh must cost a
 *      row and nothing else, and the structural test at the bottom is what
 *      makes that checkable rather than aspirational.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    SENDING_REASONS,
    SENDING_REASONS_BY_NEED,
    CAPPED_SENDINGS,
    TIER_NAMES,
    ReasonNeedSchema,
    SendingReasonSchema,
    getSendingReason
} from '../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.js';
import { BEAST_CHANGE_ORDINAL } from '../../src/data/cultivation/beasts.js';
import { REGARD_BANDS } from '../../src/schema/cultivation.js';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms.js';

describe('the catalog is well formed', () => {
    it('every row satisfies the schema', () => {
        for (const reason of SENDING_REASONS) {
            expect(() => SendingReasonSchema.parse(reason)).not.toThrow();
        }
    });

    it('ids are unique and every one is findable', () => {
        const ids = SENDING_REASONS.map(r => r.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of ids) expect(getSendingReason(id)?.id).toBe(id);
    });

    it('carries every reason the ruling named', () => {
        // Ten were named. The list is not closed, so this asserts a FLOOR
        // rather than a count: a future reason must not need this test edited.
        expect(SENDING_REASONS.length).toBeGreaterThanOrEqual(10);
    });
});

describe('the beast ceiling, and the absence of one everywhere else', () => {
    it('exactly the two beast errands are capped', () => {
        expect(CAPPED_SENDINGS.map(r => r.id).sort()).toEqual([
            'sending-for-materials',
            'sending-to-stand-to'
        ]);
    });

    it('their ceiling is the imported constant and not a copy of its value', () => {
        for (const reason of CAPPED_SENDINGS) {
            expect(reason.ceilingOrdinal).toBe(BEAST_CHANGE_ORDINAL);
        }
    });

    it('a marriage party or a war party can be anybody', () => {
        // The stated ruling: other errands have no ceiling. Asserted as the
        // general rule rather than on two rows, so a new uncapped reason is
        // covered the day it is added.
        for (const reason of SENDING_REASONS) {
            if (CAPPED_SENDINGS.includes(reason)) continue;
            expect(reason.ceilingOrdinal).toBeNull();
        }
        expect(getSendingReason('sending-to-a-marriage')!.ceilingOrdinal).toBeNull();
        expect(getSendingReason('sending-to-a-war')!.ceilingOrdinal).toBeNull();
    });

    it('the ceiling leaves room above it on the ladder', () => {
        // If this ever fails the ceiling has stopped meaning anything, because
        // nobody in the world stands above it.
        expect(BEAST_CHANGE_ORDINAL).toBeLessThan(MAX_ORDINAL);
    });
});

describe('the reason binds to state the world already keeps', () => {
    it('every need key is used by at least one reason', () => {
        for (const need of ReasonNeedSchema.options) {
            expect(SENDING_REASONS_BY_NEED.get(need)).toBeDefined();
        }
        const used = new Set(SENDING_REASONS.map(r => r.needs));
        // Not every key has to be used, but an unused one is a key nothing
        // asked for, which is the small version of a field nothing writes.
        expect(used.size).toBe(ReasonNeedSchema.options.length);
    });

    it('a house with nothing at all still has reasons to send somebody', () => {
        const unconditional = SENDING_REASONS_BY_NEED.get('nothing')!;
        expect(unconditional.length).toBeGreaterThanOrEqual(2);
    });

    it('the grouping is built from the rows and holds all of them', () => {
        const total = [...SENDING_REASONS_BY_NEED.values()]
            .reduce((sum, list) => sum + list.length, 0);
        expect(total).toBe(SENDING_REASONS.length);
    });
});

describe('the tier is the regard band, and there is no second scale', () => {
    it('every band the world already has is named, and no others', () => {
        const bands = REGARD_BANDS.map(b => b.band).sort();
        expect(Object.keys(TIER_NAMES).sort()).toEqual(bands);
    });

    it('the names are distinct, so a board can print them', () => {
        const names = Object.values(TIER_NAMES);
        expect(new Set(names).size).toBe(names.length);
    });
});

describe('nothing branches on which reason it is', () => {
    const CATALOG = fileURLToPath(new URL(
        '../../src/data/cultivation/why-a-house-puts-a-party-on-the-road.ts', import.meta.url));
    const ENGINE = fileURLToPath(new URL(
        '../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.ts', import.meta.url));

    it('the ruling is stated in the file it governs', () => {
        // The ruling is a rule for AUTHORS, so it lives in the header rather
        // than as an exported constant nothing in the game could ever read.
        // This is what stops it being deleted as decoration.
        const source = readFileSync(CATALOG, 'utf8');
        expect(source).toMatch(/The list is not closed/);
        expect(source).toMatch(/a COLUMN and fill it in for every row/);
        expect(source).toMatch(/WHAT IS GENUINELY DIFFERENT: exactly three things/);
    });

    it('the engine never mentions a reason id', () => {
        // The one mechanical test of the whole design. If a reason id appears
        // in the resolver, somebody has special-cased a reason and the next
        // one will need code.
        const source = readFileSync(ENGINE, 'utf8');
        for (const reason of SENDING_REASONS) {
            expect(source, `${reason.id} is named in the resolver`).not.toContain(reason.id);
        }
    });

    it('the catalog holds no arithmetic over the rows', () => {
        // Data files state terms. They do not decide who wins, and a weight
        // function or a margin constant here would be a second resolver.
        const source = readFileSync(CATALOG, 'utf8');
        expect(source).not.toMatch(/Math\.(pow|max|min|round|floor)\(/);
    });
});
