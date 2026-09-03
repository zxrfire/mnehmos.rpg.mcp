/**
 * One resolver, and it does not know what it is holding.
 *
 * The design ruling under test, in the owner's own words: *no bespoke logic,
 * the same way that a sword breaks.* So the load-bearing test here is not that
 * a boat breaks - it is that a boat, a sabre, a carriage, a formation plate and
 * a manual with identical rows get IDENTICAL answers, which is the property a
 * `breakSpiritBoat` would destroy.
 */
import { describe, it, expect } from 'vitest';
import {
    SCARS_BEFORE_THE_QI_GOES,
    describeTheLoss,
    doesNotComeBack,
    isHoled,
    isInert,
    mend,
    ratedWhole,
    scarsOn,
    whatBecomesOfIt,
    whatItCostThem,
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
        // The type has no `kind`, so this is a statement about the source. The
        // check is mechanical rather than rhetorical: the module must not name
        // a single kind of object in a way that could steer an outcome.
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

    it('the same call with the arguments swapped is not close to futile', () => {
        const hull = { id: 'h', name: 'a mortal-grade hull', power: 2, significance: 'significant' as const, tags: [], data: {} };
        const out = whatBecomesOfIt(hull, hand(34), always);
        expect(out.exposure.reach.reaches).toBe(true);
        expect(out.exposure.chance).toBe(1);
        expect(out.roll).toBeNull();          // certainty is not rolled for
        expect(doesNotComeBack(out.state)).toBe(true);
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

describe('breaking is not binary', () => {
    it('the near miss holes it rather than doing nothing', () => {
        // Inside the uncertain band and the draw missed. Before this state
        // existed, that was silently nothing at all.
        const out = whatBecomesOfIt(
            { id: 'h', name: 'a hull', power: 25, significance: 'significant', tags: [], data: {} },
            hand(30), never
        );
        expect(out.exposure.chance).toBeGreaterThan(0);
        expect(out.exposure.chance).toBeLessThan(1);
        expect(out.state).toBe('holed');
        expect(out.ratedAfter).toBe(24);        // one rung, the only distance anything moves
        expect(out.mendable).toBe(true);
        expect(doesNotComeBack(out.state)).toBe(false);
    });

    it('a hole costs exactly one rung, which is `shardPower` and not a new rule', () => {
        const out = whatBecomesOfIt(
            { id: 'h', name: 'a hull', power: 25, significance: 'significant', tags: [], data: {} },
            hand(30), never
        );
        expect((out.ratedBefore ?? 0) - (out.ratedAfter ?? 0)).toBe(1);
    });

    it('holed enough times and the qi goes out of it', () => {
        let row = thing({ id: 'h', name: 'a spirit tool', kind: 'artifact', power: 25 });
        let seen = 0;
        for (let i = 0; i < SCARS_BEFORE_THE_QI_GOES; i++) {
            const out = whatBecomesOfIt(row, hand(30), never);
            const back = writeBack(row, out, { onDay: 100 + i, source: 'a raid' });
            expect(back.row).not.toBeNull();
            row = back.row as ObjectRecord;
            seen = out.scars;
            if (i < SCARS_BEFORE_THE_QI_GOES - 1) expect(out.state).toBe('holed');
            else expect(out.state).toBe('inert');
        }
        expect(seen).toBe(SCARS_BEFORE_THE_QI_GOES);
        expect(isInert(row)).toBe(true);
        expect(row.power).toBeNull();
        // Still an object. Still on the shelf. Worth nothing.
        expect(isRuined(row)).toBe(false);
        expect(row.provenance).toHaveLength(SCARS_BEFORE_THE_QI_GOES);
    });

    it('a thing at or above the fragment rung leaves pieces; everything under it does not', () => {
        const high = whatBecomesOfIt(
            { id: 'h', name: 'an immortal weapon', power: 46, significance: 'legendary', tags: [], data: {} },
            hand(46, { standing: combatPowerForOrdinal(46) * 40, bare: combatPowerForOrdinal(46) * 40 }),
            always
        );
        expect(high.state).toBe('shattered');
        expect(high.piecePower).toBe(45);

        const low = whatBecomesOfIt(
            { id: 'l', name: 'a notched sabre', power: 6, significance: 'notable', tags: [], data: {} },
            hand(30), always
        );
        expect(low.state).toBe('ruined');
        expect(low.piecePower).toBeNull();
    });
});

describe('counted and tracked are different answers and both are correct', () => {
    it('a counted carriage cannot be damaged - it can only stop existing', () => {
        const counted = { id: 'c', name: 'a drawn carriage', power: 4, significance: 'mundane' as const, tags: [], data: {} };
        const ended = whatBecomesOfIt(counted, hand(30), always);
        expect(ended.keptAs).toBe('counted');
        expect(ended.state).toBe('gone');

        const survived = whatBecomesOfIt(
            { ...counted, power: 25 }, hand(30), never
        );
        expect(survived.state).toBe('held');   // never 'holed'
        expect(survived.scars).toBe(0);
    });

    it('a counted thing that stopped existing writes nothing anywhere', () => {
        const row = thing({ id: 'c', name: 'a drawn carriage', kind: 'other', significance: 'mundane', power: 4 });
        const out = whatBecomesOfIt(row, hand(30), always);
        const back = writeBack(row, out, { onDay: 10, source: 'the fighting' });
        expect(back.row).toBeNull();
        expect(back.pieces).toHaveLength(0);
    });

    it('a tracked thing that ended keeps its row, its owner and its whole chain', () => {
        const row = thing({
            id: 't', name: 'the Nine Vane', kind: 'artifact', power: 20,
            ownerId: 'sect-a', ownerName: 'Crimson Abyss Hall'
        });
        const out = whatBecomesOfIt(row, hand(34), always);
        const back = writeBack(row, out, { onDay: 900, source: 'the war with the Ash Clan' });
        expect(back.row).not.toBeNull();
        expect(isRuined(back.row as ObjectRecord)).toBe(true);
        expect((back.row as ObjectRecord).ownerId).toBe('sect-a');
        expect((back.row as ObjectRecord).provenance.at(-1)?.onDay).toBe(900);
    });
});

describe('being broken and being mended are events in the thing\'s history', () => {
    it('a hole is a link in the chain with a date and a cause on it', () => {
        const row = thing({ id: 'h', name: 'a hull', kind: 'artifact', power: 25, ownerName: 'the Ash Clan' });
        const out = whatBecomesOfIt(row, hand(30), never);
        const back = writeBack(row, out, { onDay: 4242, source: 'the war with Crimson Abyss Hall' });
        const marked = back.row as ObjectRecord;
        expect(isHoled(marked)).toBe(true);
        expect(scarsOn(marked)).toBe(1);
        expect(ratedWhole(marked)).toBe(25);
        expect(marked.power).toBe(24);
        expect(marked.provenance.at(-1)?.onDay).toBe(4242);
        expect(marked.provenance.at(-1)?.source).toMatch(/war with Crimson/);
    });

    it('mending gives back a rung, and never more than it was made at', () => {
        const row = thing({ id: 'h', name: 'a hull', kind: 'artifact', power: 25 });
        const holed = writeBack(row, whatBecomesOfIt(row, hand(30), never),
            { onDay: 1, source: 'a raid' }).row as ObjectRecord;
        const fixed = mend(holed, { byOrdinal: 30, onDay: 40, byId: 'npc-w', byName: 'a wright' });
        expect(fixed.mended).toBe(true);
        expect(fixed.row.power).toBe(25);
        expect(fixed.scars).toBe(0);
        expect(isHoled(fixed.row)).toBe(false);

        // And it cannot be mended past whole.
        const again = mend(fixed.row, { byOrdinal: 40, onDay: 41, byId: 'npc-w', byName: 'a wright' });
        expect(again.mended).toBe(false);
        expect(again.row.power).toBe(25);
    });

    it('mending is gated by the same rung that unmaking is', () => {
        const row = thing({ id: 'h', name: 'a hull', kind: 'artifact', power: 29 });
        const holed = writeBack(row, whatBecomesOfIt(row, hand(34), never),
            { onDay: 1, source: 'a raid' }).row as ObjectRecord;
        const tooLow = mend(holed, { byOrdinal: 12, onDay: 2, byId: 'x', byName: 'a village smith' });
        expect(tooLow.mended).toBe(false);
        expect(tooLow.account).toMatch(/does not reach/);
        expect(tooLow.row.power).toBe(28);

        const highEnough = mend(holed, { byOrdinal: 29, onDay: 2, byId: 'y', byName: 'a wright' });
        expect(highEnough.mended).toBe(true);
    });

    it('a thing whose qi has gone cannot be mended, and the refusal says why', () => {
        let row = thing({ id: 'h', name: 'a spirit tool', kind: 'artifact', power: 25 });
        for (let i = 0; i < SCARS_BEFORE_THE_QI_GOES; i++) {
            row = writeBack(row, whatBecomesOfIt(row, hand(30), never),
                { onDay: i, source: 'a raid' }).row as ObjectRecord;
        }
        const out = mend(row, { byOrdinal: 46, onDay: 99, byId: 'z', byName: 'an ancestor' });
        expect(out.mended).toBe(false);
        expect(out.account).toMatch(/qi has gone out of/);
    });

    it('a thing that already ended is not broken twice', () => {
        const row = thing({ id: 'h', name: 'a hull', kind: 'artifact', power: 20 });
        const ended = writeBack(row, whatBecomesOfIt(row, hand(34), always),
            { onDay: 1, source: 'a raid' }).row as ObjectRecord;
        const again = whatBecomesOfIt(ended, hand(40), always);
        expect(again.state).toBe('held');
        expect(again.roll).toBeNull();
    });
});

describe('a broken thing is a wrong done to a person', () => {
    it('the same loss is worth everything to one house and nothing to another', () => {
        const poor = whatItCostThem({ ratedBefore: 29, ratedAfter: null }, [], combatPowerForOrdinal);
        const rich = whatItCostThem(
            { ratedBefore: 29, ratedAfter: null },
            [40, 40, 41, 38, 39, 40], combatPowerForOrdinal
        );
        expect(poor).toBe(1);
        expect(rich).toBeLessThan(0.05);
        expect(rich).toBeGreaterThan(0);
    });

    it('a hole costs the share of the rung it took, not the whole thing', () => {
        const holed = whatItCostThem({ ratedBefore: 29, ratedAfter: 28 }, [], combatPowerForOrdinal);
        const ended = whatItCostThem({ ratedBefore: 29, ratedAfter: null }, [], combatPowerForOrdinal);
        expect(holed).toBeGreaterThan(0);
        expect(holed).toBeLessThan(ended);
    });

    it('every result carries who did it, so somebody can be answered for it', () => {
        const out = whatBecomesOfIt(
            { id: 'h', name: 'the Nine Vane', power: 20, significance: 'significant', tags: [], data: {} },
            hand(34), always
        );
        expect(out.byId).toBe('npc-breaker');
        expect(out.byName).toBe('Yun Shu');
        expect(describeTheLoss(out, 'the Nine Vane', 'the war')).toMatch(/Yun Shu ended the Nine Vane/);
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
