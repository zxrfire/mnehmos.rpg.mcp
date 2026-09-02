/**
 * Which tier each kind of thing is kept in, asserted rather than described.
 *
 * `docs/world/things/items.md` states the line - a count with no id, or a row
 * with a provenance - and `docs/world/things/economy.md` states what refills
 * each tier. Both were true of some catalogs and quietly false of others, and
 * the failures were the two the ruling predicts in either direction:
 *
 *   A TRACKED ROW NOTHING ASKS ABOUT. Three cultivation manuals taught by
 *   thirteen to twenty-four houses apiece were minting a provenance-carrying
 *   row on every one of those shelves, for a book nobody can call theirs and
 *   anybody may copy. Two artifact rows whose own descriptions say several
 *   hundred exist were being seated in the world as single objects with no
 *   owner, no holder and no location, which every query misses.
 *
 *   A COUNTED THING WITH NO ROW. Not fixed here and recorded in the audit: the
 *   seventeen objects that came down from above the Lid are stored as counts on
 *   a faction, which is the one category in the setting where WHICH one it is
 *   is the whole question.
 *
 * These are guards on the boundaries themselves rather than on any one row, so
 * a catalog edit that moves a thing across a line fails here instead of going
 * quietly stale in the prose.
 */

import { describe, it, expect } from 'vitest';
import {
    keptAs,
    isTracked,
    shardPower,
    makeObject,
    shatter,
    type ObjectSignificance
} from '../../../src/engine/world/possessions.js';
import { ARTIFACTS } from '../../../src/data/cultivation/artifacts.js';
import { PILLS } from '../../../src/data/cultivation/pills.js';
import { HERBS } from '../../../src/data/cultivation/herbs.js';
import { STRUCTURAL_REPAIR_MEDICINES } from '../../../src/data/cultivation/structural-repair-medicine.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';
import { PRICES } from '../../../src/data/cultivation/mortal-world.js';
import {
    pillCashPrice,
    pillStorageModel
} from '../../../src/engine/cultivation/buying-and-bartering-pills.js';
import {
    repairStorageModel,
    significanceOfDose
} from '../../../src/engine/world/who-holds-the-structural-repair-medicine.js';
import { repairCashPrice } from '../../../src/engine/cultivation/what-structural-repair-medicine-can-reach.js';
import { significanceOfPill } from '../../../src/engine/world/where-the-pills-actually-are.js';
import {
    significanceOfManual,
    isCommonlyHeld,
    housesTeaching,
    INNER_SHELF_CAP
} from '../../../src/engine/world/manuals.js';

// ─────────────────────────────────────────────────────────────────────────
// THE AXIS
// ─────────────────────────────────────────────────────────────────────────

describe('significance is the tier axis and there is not a second one', () => {
    it('splits the four rungs into exactly the two stored tiers', () => {
        const rungs: ObjectSignificance[] = ['mundane', 'notable', 'significant', 'legendary'];
        expect(rungs.map(keptAs)).toEqual(['counted', 'tracked', 'tracked', 'tracked']);
    });

    it('reads the same answer off a whole record', () => {
        expect(isTracked(makeObject({ id: 'x', name: 'x', kind: 'other', significance: 'mundane' })))
            .toBe(false);
        expect(isTracked(makeObject({ id: 'x', name: 'x', kind: 'other', significance: 'notable' })))
            .toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// TIER 1 - A PRICE AND AN AVAILABILITY, NEVER A COUNT
// ─────────────────────────────────────────────────────────────────────────

describe('the tier that is not modelled carries no quantity', () => {
    /**
     * The board is prices and units. A `count` column on it would be somebody
     * starting to simulate the grain supply of a province, which is the thing
     * this tier exists to refuse - millet stops because of a famine, not
     * because travellers ate it.
     */
    it('prices ordinary goods without counting any of them', () => {
        expect(PRICES.length).toBeGreaterThan(20);
        for (const p of PRICES) {
            expect(Object.keys(p).sort()).toEqual(
                ['cash', 'category', 'id', 'name', 'note', 'unit'].sort()
            );
            expect(p.cash).toBeGreaterThan(0);
        }
    });

    it('has the floor of the whole economy on it, which is what a famine stops', () => {
        const millet = PRICES.find(p => p.id === 'price-millet');
        expect(millet).toBeDefined();
        expect(millet!.cash).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE CASH LINE AND THE STORAGE LINE ARE ONE LINE
// ─────────────────────────────────────────────────────────────────────────

describe('a thing is cash-priced exactly where it is counted', () => {
    /**
     * `items.md` claims the two boundaries are the same boundary and that if
     * they drift apart one of them is wrong. Two catalogs answer both questions
     * through engine functions that know nothing about each other, so the claim
     * is checkable rather than merely stated.
     */
    it('holds on every pill', () => {
        const drift = PILLS.filter(p =>
            (pillCashPrice(p) !== null) !== (pillStorageModel(p) === 'count'));
        expect(drift.map(p => p.id)).toEqual([]);
    });

    it('holds on every structural repair medicine', () => {
        const drift = STRUCTURAL_REPAIR_MEDICINES.filter(m =>
            (repairCashPrice(m) !== null) !== (repairStorageModel(m) === 'count'));
        expect(drift.map(m => m.id)).toEqual([]);
    });

    it('and the significance each catalog stores agrees with its own storage model', () => {
        for (const p of PILLS) {
            expect(keptAs(significanceOfPill(p)))
                .toBe(pillStorageModel(p) === 'count' ? 'counted' : 'tracked');
        }
        for (const m of STRUCTURAL_REPAIR_MEDICINES) {
            expect(keptAs(significanceOfDose(m)))
                .toBe(repairStorageModel(m) === 'count' ? 'counted' : 'tracked');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// BOOKS - THE LINE IS HOW WIDELY IT IS HELD, NOT HOW HIGH IT CARRIES
// ─────────────────────────────────────────────────────────────────────────

describe('a book is counted where nobody owns it', () => {
    const manuals = (TECHNIQUES as readonly { id: string; class?: string; cap?: number | null }[])
        .filter(t => t.class === 'cultivation' && t.cap != null);

    it('has manuals to talk about', () => {
        expect(manuals.length).toBeGreaterThan(10);
    });

    /**
     * The defect this replaces: the three sites that mint a library holding each
     * wrote out `cap >= 29 ? ... : cap >= 17 ? ...`, which is the definition of
     * "common" that `isCommonlyHeld` exists to retire. Commonness is a fact
     * about how many people hold a thing, and the two coincided by accident
     * until the shelves were filled in.
     */
    it('reads the tier off how widely it is held and never off its cap', () => {
        for (const t of manuals) {
            expect(keptAs(significanceOfManual(t.id, Number(t.cap))))
                .toBe(isCommonlyHeld(t.id) ? 'counted' : 'tracked');
        }
    });

    it('counts the province-wide crossing books rather than tracking one per shelf', () => {
        const widelyTaught = manuals.filter(t => housesTeaching(t.id) >= 10);
        expect(widelyTaught.length).toBeGreaterThan(0);
        for (const t of widelyTaught) {
            expect(significanceOfManual(t.id, Number(t.cap))).toBe('mundane');
        }
    });

    it('still keeps a story on a book only one house teaches', () => {
        const theirs = manuals.filter(t => !isCommonlyHeld(t.id));
        expect(theirs.length).toBeGreaterThan(0);
        for (const t of theirs) {
            const sig = significanceOfManual(t.id, Number(t.cap));
            expect(keptAs(sig)).toBe('tracked');
            expect(sig).toBe(Number(t.cap) >= INNER_SHELF_CAP ? 'significant' : 'notable');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ARTIFACTS - A ROW IS EITHER AN OBJECT OR A KIND
// ─────────────────────────────────────────────────────────────────────────

describe('the artifact catalog says which of its rows are kinds', () => {
    /**
     * One table, ordered by power, is the design rule and is not in question.
     * What the rows have to say is whether this is a thing or several hundred
     * things, and `mundane` is the switch that already exists for it.
     */
    it('marks a row standing in for several hundred of the thing as counted', () => {
        const kinds = ARTIFACTS.filter(a => keptAs(a.significance) === 'counted');
        expect(kinds.map(a => a.id).sort()).toEqual([
            'artifact-hollow-bell',
            'artifact-notched-sabre',
            'artifact-severed-name-knife'
        ]);
    });

    it('gives every tracked artifact somebody to ask about it', () => {
        for (const a of ARTIFACTS) {
            if (keptAs(a.significance) === 'counted') continue;
            const reachable = a.ownerId !== null || a.possessorId !== null || a.locationId !== null;
            expect(reachable, `${a.id} is tracked and nobody holds, owns or houses it`).toBe(true);
        }
    });

    it('keeps the whole hierarchy of force in the one table either way', () => {
        const powers = ARTIFACTS.map(a => a.power ?? -1).filter(p => p >= 0);
        expect([...powers].sort((x, y) => y - x)).toEqual(powers);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// HERBS - COUNTED, OUT OF THE GROUND
// ─────────────────────────────────────────────────────────────────────────

describe('an ingredient is a count and has no id', () => {
    it('carries a value and a draw weight rather than a holder', () => {
        expect(HERBS.length).toBeGreaterThan(20);
        for (const h of HERBS) {
            expect(h.value).toBeGreaterThan(0);
            expect(h.rarityWeight).toBeGreaterThan(0);
            expect(h).not.toHaveProperty('possessorId');
            expect(h).not.toHaveProperty('provenance');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE TWO RULES THAT CUT ACROSS EVERY TIER
// ─────────────────────────────────────────────────────────────────────────

describe('grade is fixed when a thing is made, and the only movement is downward', () => {
    it('never raises a rating, at any rating', () => {
        for (let p = 0; p <= 46; p++) {
            expect(shardPower(p)).toBeLessThan(Math.max(1, p + 1));
            expect(shardPower(p)).toBeLessThanOrEqual(p);
        }
        expect(shardPower(46)).toBe(45);
        expect(shardPower(6)).toBe(5);
        expect(shardPower(0)).toBe(0);
        expect(shardPower(null)).toBeNull();
    });

    /**
     * Breaking a thing produces new individuals rather than promoting anything.
     * The pieces are new ids, they are worth a rung less, and no piece is ever
     * more significant than what it came off.
     */
    it('mints new individuals when a thing comes apart, and promotes none of them', () => {
        const whole = makeObject({
            id: 'whole', name: 'A Blade', kind: 'artifact',
            significance: 'legendary', power: 46
        });
        const pieces = shatter(whole);
        expect(pieces.length).toBe(2);
        for (const piece of pieces) {
            expect(piece.id).not.toBe(whole.id);
            expect(piece.power).toBe(45);
            expect(piece.significance).toBe('significant');
        }
    });

    it('does not promote a counted thing into a tracked one by breaking it', () => {
        const kind = makeObject({
            id: 'sabre', name: 'A Notched Sabre', kind: 'artifact',
            significance: 'mundane', power: 4
        });
        for (const piece of shatter(kind)) {
            expect(keptAs(piece.significance)).toBe('counted');
        }
    });
});
