/**
 * One resolver, and it does not know what it is holding.
 *
 * The design ruling under test, in the owner's own words: *no bespoke logic,
 * the same way that a sword breaks.* So the load-bearing test here is not that
 * a boat breaks - it is that a boat, a sabre, a carriage, a formation plate and
 * a manual with identical rows get IDENTICAL answers, which is the property a
 * `breakSpiritBoat` would destroy. The owner's ruling of 2026-09-25 is pinned
 * here too: damage lands as holes first, and a broken thing is kept, working
 * at half.
 */
import { describe, it, expect } from 'vitest';
import {
    SCARS_BEFORE_IT_BREAKS,
    describeTheLoss,
    isBroken,
    isHoled,
    mend,
    ratedWhole,
    scarsOn,
    theConditionItIsIn,
    theRungItWorksAt,
    whatBecomesOfIt,
    writeBack,
    type ForceApplied,
    type ThingUnderForce
} from '../../../src/engine/world/object-damage.js';
import { makeObject, isRuined, type ObjectRecord } from '../../../src/engine/world/possessions.js';
import { combatPowerForOrdinal } from '../../../src/engine/cultivation/combat.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';

// ─────────────────────────────────────────────────────────────────────────

function thing(init: Partial<ObjectRecord> & Pick<ObjectRecord, 'id' | 'name' | 'kind'>): ObjectRecord {
    return makeObject({ significance: 'significant', ...init });
}

/** A house's strongest hand, priced the way every live caller prices one. */
function hand(ordinal: number, init: Partial<ForceApplied> = {}): ForceApplied {
    const standing = combatPowerForOrdinal(ordinal);
    return {
        standing,
        bare: standing,
        ordinal,
        byId: 'npc-breaker',
        byName: 'Yun Shu',
        cause: 'the fighting between the two houses',
        standingOf: combatPowerForOrdinal,
        ...init
    };
}

/** A draw that lands inside any odds, and one that lands outside all of them. */
const always = { next: () => 0 };
const never = { next: () => 0.999999 };

// ═════════════════════════════════════════════════════════════════════════

describe('the same call answers for every kind of thing', () => {
    it('a hull, a sabre, a carriage, a plate and a manual with the same row get the same answer', () => {
        const rows: ThingUnderForce[] = [
            { id: 'a', name: 'a spirit boat', power: 29, significance: 'significant', tags: ['conveyance'], data: {} },
            { id: 'b', name: 'a sabre', power: 29, significance: 'significant', tags: [], data: {} },
            { id: 'c', name: 'a carriage', power: 29, significance: 'significant', tags: ['conveyance'], data: {} },
            { id: 'd', name: 'a formation plate', power: 29, significance: 'significant', tags: [], data: {} },
            { id: 'e', name: 'a manual', power: 29, significance: 'significant', tags: [], data: {} }
        ];
        const force = hand(40);
        const answers = rows.map(r => whatBecomesOfIt(r, force, always));
        for (const a of answers) {
            expect(a.state).toBe(answers[0].state);
            expect(a.exposure.chance).toBeCloseTo(answers[0].exposure.chance, 12);
            expect(a.ratedAfter).toBe(answers[0].ratedAfter);
        }
    });

    it('nothing about what the thing is reaches the resolver', () => {
        const boat = whatBecomesOfIt(
            { id: 'x', name: 'a spirit boat', power: 20, significance: 'significant', tags: [], data: {} },
            hand(34), always
        );
        const sword = whatBecomesOfIt(
            { id: 'x', name: 'a sword', power: 20, significance: 'significant', tags: [], data: {} },
            hand(34), always
        );
        expect(boat.state).toBe(sword.state);
        expect(boat.ratedAfter).toBe(sword.ratedAfter);
    });
});

describe('the gap is the whole story, and it runs both ways', () => {
    it('a mortal swinging at a heaven-grade hull cannot touch it at all', () => {
        const hull = { id: 'h', name: 'a heaven-grade hull', power: 34, significance: 'significant' as const, tags: [], data: {} };
        const out = whatBecomesOfIt(hull, hand(2), always);
        expect(out.exposure.reach.reaches).toBe(false);
        expect(out.state).toBe('held');
        expect(out.roll).toBeNull();
        expect(out.account).toMatch(/does not reach/);
    });

    it('the same call with the arguments swapped breaks it, and the break keeps it', () => {
        const hull = { id: 'h', name: 'a mortal-grade hull', power: 2, significance: 'significant' as const, tags: [], data: {} };
        const out = whatBecomesOfIt(hull, hand(34), always);
        expect(out.exposure.reach.reaches).toBe(true);
        expect(out.exposure.chance).toBe(1);
        expect(out.roll).toBeNull();          // certainty is not rolled for
        expect(out.state).toBe('broken');
        expect(out.ratedAfter).toBe(2);       // it keeps the rung it was made at
    });

    it('a thing at its own grade holds, at any odds', () => {
        const out = whatBecomesOfIt(
            { id: 'h', name: 'a fit blade', power: 30, significance: 'significant', tags: [], data: {} },
            hand(30), always
        );
        expect(out.state).toBe('held');
        expect(out.exposure.chance).toBe(0);
    });
});

describe('damage lands as holes before anything breaks', () => {
    it('inside the uncertain band a draw that lands holes it, and one that misses leaves it', () => {
        const hull = { id: 'h', name: 'a hull', power: 25, significance: 'significant' as const, tags: [], data: {} };
        const hit = whatBecomesOfIt(hull, hand(30), always);
        expect(hit.exposure.chance).toBeGreaterThan(0);
        expect(hit.exposure.chance).toBeLessThan(1);
        expect(hit.state).toBe('holed');
        expect(hit.ratedAfter).toBe(24);        // one rung, the only distance anything moves
        expect(hit.mendable).toBe(true);

        const missed = whatBecomesOfIt(hull, hand(30), never);
        expect(missed.state).toBe('held');
        expect(missed.scars).toBe(0);
    });

    it('between two and three realms it is holed for certain, and nothing is rolled', () => {
        // 40 against 29 is two and a half realms, which was a certain break
        // before the owner's ruling of 2026-09-25.
        const out = whatBecomesOfIt(
            { id: 'h', name: 'a hull', power: 29, significance: 'significant', tags: [], data: {} },
            hand(40), never
        );
        expect(out.exposure.chance).toBe(1);
        expect(out.exposure.breaksOutright).toBe(false);
        expect(out.roll).toBeNull();
        expect(out.state).toBe('holed');
    });

    it('past three realms it breaks outright', () => {
        const out = whatBecomesOfIt(
            { id: 'h', name: 'a notched sabre', power: 6, significance: 'notable', tags: [], data: {} },
            hand(30), always
        );
        expect(out.exposure.breaksOutright).toBe(true);
        expect(out.state).toBe('broken');
    });

    it('the last hole it can take breaks it, and the broken thing stays at the rung it was made at', () => {
        let row = thing({ id: 'h', name: 'a spirit tool', kind: 'artifact', power: 25 });
        for (let i = 0; i < SCARS_BEFORE_IT_BREAKS; i++) {
            const out = whatBecomesOfIt(row, hand(30), always);
            row = writeBack(row, out, { onDay: 100 + i, source: 'a raid' }).row;
            expect(out.state).toBe(i < SCARS_BEFORE_IT_BREAKS - 1 ? 'holed' : 'broken');
        }
        expect(isBroken(row)).toBe(true);
        expect(isHoled(row)).toBe(false);
        expect(row.power).toBe(25);
        expect(isRuined(row)).toBe(false);
        expect(row.provenance).toHaveLength(SCARS_BEFORE_IT_BREAKS);
        expect(theConditionItIsIn(row)).toBe('broken, works at half');
    });
});

describe('a broken thing is kept, keeps its grade, and works at half', () => {
    it('keeps its row, its holder, its owner and its whole chain', () => {
        const row = thing({
            id: 't', name: 'the Nine Vane', kind: 'artifact', power: 20,
            possessorId: 'npc-holder', ownerId: 'sect-a', ownerName: 'Crimson Abyss Fortress'
        });
        const out = whatBecomesOfIt(row, hand(34), always);
        expect(out.state).toBe('broken');
        const broken = writeBack(row, out, { onDay: 900, source: 'the war with the Tripod Clan' }).row;
        expect(isRuined(broken)).toBe(false);
        expect(isBroken(broken)).toBe(true);
        expect(broken.power).toBe(20);
        expect(broken.possessorId).toBe('npc-holder');
        expect(broken.ownerId).toBe('sect-a');
        expect(broken.provenance.at(-1)?.onDay).toBe(900);
    });

    it('a counted thing is never holed, and a break keeps it too', () => {
        const counted = { id: 'c', name: 'a drawn carriage', power: 25, significance: 'mundane' as const, tags: [], data: {} };
        const marked = whatBecomesOfIt(counted, hand(30), always);
        expect(marked.keptAs).toBe('counted');
        expect(marked.state).toBe('held');
        expect(marked.scars).toBe(0);

        const ended = whatBecomesOfIt({ ...counted, power: 4 }, hand(30), always);
        expect(ended.state).toBe('broken');
        expect(ended.ratedAfter).toBe(4);
    });

    it('answers in rungs at the rung worth half of what it was made at, and never lower for holes', () => {
        // A realm is four times the one below and the peak of a realm is twice
        // its floor, so half of a realm's floor is the rung below it.
        expect(theRungItWorksAt(29, 29, true)).toBe(28);
        expect(theRungItWorksAt(29, 29, false)).toBe(29);
        // Two holes at a realm's floor would put it under that half; it stops there.
        expect(theRungItWorksAt(27, 29, false)).toBe(28);
        expect(theRungItWorksAt(34, 35, false)).toBe(34);
    });
});

describe('being broken and being mended are events in the thing\'s history', () => {
    it('a hole is a link in the chain with a date and a cause on it', () => {
        const row = thing({ id: 'h', name: 'a hull', kind: 'artifact', power: 25, ownerName: 'the Tripod Clan' });
        const out = whatBecomesOfIt(row, hand(30), always);
        const marked = writeBack(row, out, { onDay: 4242, source: 'the war with Crimson Abyss Fortress' }).row;
        expect(isHoled(marked)).toBe(true);
        expect(scarsOn(marked)).toBe(1);
        expect(ratedWhole(marked)).toBe(25);
        expect(marked.power).toBe(24);
        expect(marked.provenance.at(-1)?.onDay).toBe(4242);
        expect(marked.provenance.at(-1)?.source).toMatch(/war with Crimson/);
    });

    it('mending gives back a rung, and never more than it was made at', () => {
        const row = thing({ id: 'h', name: 'a hull', kind: 'artifact', power: 25 });
        const holed = writeBack(row, whatBecomesOfIt(row, hand(30), always),
            { onDay: 1, source: 'a raid' }).row;
        const fixed = mend(holed, { byOrdinal: 30, onDay: 40, byId: 'npc-w', byName: 'a wright' });
        expect(fixed.mended).toBe(true);
        expect(fixed.row.power).toBe(25);
        expect(fixed.scars).toBe(0);
        expect(isHoled(fixed.row)).toBe(false);

        const again = mend(fixed.row, { byOrdinal: 40, onDay: 41, byId: 'npc-w', byName: 'a wright' });
        expect(again.mended).toBe(false);
        expect(again.row.power).toBe(25);
    });

    it('mending is gated by the same rung that unmaking is', () => {
        const row = thing({ id: 'h', name: 'a hull', kind: 'artifact', power: 29 });
        const holed = writeBack(row, whatBecomesOfIt(row, hand(34), always),
            { onDay: 1, source: 'a raid' }).row;
        const tooLow = mend(holed, { byOrdinal: 12, onDay: 2, byId: 'x', byName: 'a village smith' });
        expect(tooLow.mended).toBe(false);
        expect(tooLow.account).toMatch(/does not reach/);
        expect(tooLow.row.power).toBe(28);

        const highEnough = mend(holed, { byOrdinal: 29, onDay: 2, byId: 'y', byName: 'a wright' });
        expect(highEnough.mended).toBe(true);
    });

    it('a broken thing is not mended, and the refusal says why', () => {
        const row = thing({ id: 'h', name: 'a spirit tool', kind: 'artifact', power: 6 });
        const broken = writeBack(row, whatBecomesOfIt(row, hand(30), always),
            { onDay: 1, source: 'a raid' }).row;
        const out = mend(broken, { byOrdinal: 46, onDay: 99, byId: 'z', byName: 'an ancestor' });
        expect(out.mended).toBe(false);
        expect(out.account).toMatch(/a break cannot/);
    });

    it('a thing already broken is not broken again', () => {
        const row = thing({ id: 'h', name: 'a hull', kind: 'artifact', power: 20 });
        const broken = writeBack(row, whatBecomesOfIt(row, hand(34), always),
            { onDay: 1, source: 'a raid' }).row;
        const again = whatBecomesOfIt(broken, hand(40), always);
        expect(again.state).toBe('held');
        expect(again.roll).toBeNull();
    });
});

describe('a broken thing is a wrong done to a person', () => {
    it('every result carries who did it, so somebody can be answered for it', () => {
        const out = whatBecomesOfIt(
            { id: 'h', name: 'the Nine Vane', power: 20, significance: 'significant', tags: [], data: {} },
            hand(34), always
        );
        expect(out.byId).toBe('npc-breaker');
        expect(out.byName).toBe('Yun Shu');
        expect(describeTheLoss(out, 'the Nine Vane', 'the war')).toMatch(/Yun Shu broke the Nine Vane/);
    });
});

describe('it reports before it decides', () => {
    it('with no stream nothing uncertain is resolved and the odds are still shown', () => {
        const preview = whatBecomesOfIt(
            { id: 'h', name: 'a hull', power: 25, significance: 'significant', tags: [], data: {} },
            hand(30), null
        );
        expect(preview.state).toBe('held');
        expect(preview.roll).toBeNull();
        expect(preview.exposure.chance).toBeGreaterThan(0);
        expect(preview.account).toMatch(/Nothing has been resolved/);
    });

    it('a fit thing and a gated one leave a seeded stream exactly where they found it', () => {
        const a = forStream('seed', 'probe');
        whatBecomesOfIt({ id: 'x', name: 'a fit blade', power: 30, significance: 'significant', tags: [], data: {} },
            hand(30), a);
        whatBecomesOfIt({ id: 'y', name: 'a hull', power: 40, significance: 'significant', tags: [], data: {} },
            hand(3), a);
        const b = forStream('seed', 'probe');
        expect(a.next()).toBe(b.next());
    });
});
