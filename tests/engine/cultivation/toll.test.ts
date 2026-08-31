/**
 * The Toll.
 *
 * The two properties that must never quietly regress:
 *
 *   1. It is ROLLED, not guaranteed. A crossing that always took something
 *      would be a tax, and the world bible is explicit that some cultivators
 *      climb four realms and lose nothing. "Can come up clean" is tested
 *      directly, because it is the half of the design that is easiest to lose.
 *   2. It is charged only at realm boundaries. Sub-rank steps are free, and
 *      asking for one is a caller bug rather than a game outcome.
 */

import {
    type TollCandidate,
    type TollResult
} from '../../../src/schema/cultivation.js';
import {
    MAX_TOLL_RISK,
    MIN_TOLL_RISK,
    NAME_ELIGIBLE_FROM_ORDINAL,
    TOLL_BASE_RISK,
    TOLL_BOUNDARY_ORDINALS,
    TOLL_RISK_PER_BOUNDARY,
    boundariesCrossed,
    computeTollRisk,
    evaluateToll,
    isTolled,
    tollBoundaryIndex,
    type TollConditions
} from '../../../src/engine/cultivation/toll.js';
import {
    FOUNDATION_ORDINAL,
    MAX_ORDINAL,
    TOTAL_RANKS,
    isRealmBoundary
} from '../../../src/engine/cultivation/realms.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { makeCultivator } from './fixtures.js';

const ALL_ORDINALS = Array.from({ length: TOTAL_RANKS }, (_, i) => i);

/** A run that has actually accumulated things worth taking. */
function candidates(): TollCandidate[] {
    return [
        { kind: 'bond', id: 'npc-shu', label: 'Shu Wen, who taught them to read', weight: 3 },
        { kind: 'bond', id: 'npc-brother', label: 'their brother', weight: 5 },
        { kind: 'memory', id: 'mem-river', label: 'the summer at the low fall', weight: 2 },
        { kind: 'technique', id: 'tech-borrowed-breath', label: 'Borrowed Breath', weight: 4 }
    ];
}

function charge(
    ordinal: number,
    seed: string,
    conditions: TollConditions = {},
    overrides = {}
): TollResult {
    const cultivator = makeCultivator({ realmOrdinal: ordinal, ...overrides });
    return evaluateToll(cultivator, {
        rng: forStream(seed, 'toll', ordinal),
        ambient: 'normal',
        candidates: candidates(),
        ...conditions
    });
}

/** Fraction of `n` seeded crossings that cost something. */
function takenRate(ordinal: number, conditions: TollConditions = {}, n = 2000, overrides = {}): number {
    let taken = 0;
    for (let i = 0; i < n; i++) {
        if (charge(ordinal, `toll-trial-${i}`, conditions, overrides).outcome === 'taken') taken++;
    }
    return taken / n;
}

describe('when the toll is charged at all', () => {
    it('is charged at every realm boundary and nowhere else', () => {
        for (const ordinal of ALL_ORDINALS) {
            expect(isTolled(ordinal)).toBe(isRealmBoundary(ordinal) && ordinal < MAX_ORDINAL);
        }
        expect(TOLL_BOUNDARY_ORDINALS).toEqual([12, 16, 20, 24, 28, 32, 36, 40]);
    });

    it('throws rather than inventing an instalment for a sub-rank step', () => {
        for (const ordinal of [0, 5, 13, 30, 41]) {
            expect(() => charge(ordinal, 'seed')).toThrow(/realm boundaries, not sub-rank steps/);
        }
    });

    it('indexes boundaries from the Foundation crossing', () => {
        expect(tollBoundaryIndex(FOUNDATION_ORDINAL - 1)).toBe(0);
        expect(tollBoundaryIndex(40)).toBe(7);
        expect(tollBoundaryIndex(13)).toBe(-1);
    });

    it('counts the instalments a standing cultivator has already paid', () => {
        // The world bible's own arithmetic: Void Refinement starts at 29 and
        // "has crossed five boundaries and rolled five times".
        expect(boundariesCrossed(29)).toBe(5);
        expect(boundariesCrossed(0)).toBe(0);
        expect(boundariesCrossed(13)).toBe(1);
    });
});

describe('the roll', () => {
    it('can come up clean - the path is bloody but the blood is uneven', () => {
        const rate = takenRate(12);
        expect(rate).toBeGreaterThan(0.1);
        expect(rate).toBeLessThan(0.9);
    });

    it('leaves room for a cultivator to cross four realms and lose nothing', () => {
        // Not a guarantee of luck - a measurement that luck remains possible.
        let unscathed = 0;
        const runs = 400;
        for (let run = 0; run < runs; run++) {
            const clean = [12, 16, 20, 24].every(
                ordinal => charge(ordinal, `run-${run}-${ordinal}`).outcome !== 'taken'
            );
            if (clean) unscathed++;
        }
        expect(unscathed).toBeGreaterThan(0);
        // ...and the overwhelming majority still pay something.
        expect(unscathed / runs).toBeLessThan(0.5);
    });

    it('takes something from most cultivators over five boundaries', () => {
        // "A Void Refinement cultivator has crossed five boundaries and rolled
        // five times. Some of them still have a family. Most do not."
        let lostSomething = 0;
        const runs = 400;
        for (let run = 0; run < runs; run++) {
            const anyTaken = [12, 16, 20, 24, 28].some(
                ordinal => charge(ordinal, `void-${run}-${ordinal}`).outcome === 'taken'
            );
            if (anyTaken) lostSomething++;
        }
        expect(lostSomething / runs).toBeGreaterThan(0.6);
    });

    it('grows more dangerous the higher the boundary', () => {
        const attributes = { might: 2, insight: 2, fortune: 0, charm: 2 };
        const low = computeTollRisk(makeCultivator({ realmOrdinal: 12, attributes }), {
            ambient: 'normal'
        });
        const high = computeTollRisk(makeCultivator({ realmOrdinal: 40, attributes }), {
            ambient: 'normal'
        });
        expect(low.risk).toBeCloseTo(TOLL_BASE_RISK, 10);
        expect(high.risk).toBeCloseTo(TOLL_BASE_RISK + 7 * TOLL_RISK_PER_BOUNDARY, 10);
        expect(high.risk).toBeGreaterThan(low.risk);
    });

    it('consumes exactly three samples whatever the outcome', () => {
        // Fixed sample count is what lets a caller share the breakthrough
        // stream without the toll's result shifting anything drawn after it.
        const lucky = forStream('alignment', 'toll', 1);
        const unlucky = forStream('alignment', 'toll', 1);
        evaluateToll(makeCultivator({ realmOrdinal: 12 }), {
            rng: lucky,
            ambient: 'spirit_tide',
            candidates: candidates(),
            sectProtection: 1,
            preparation: 1
        });
        evaluateToll(makeCultivator({ realmOrdinal: 40, attributes: { might: 1, insight: 1, fortune: 0, charm: 1 } }), {
            rng: unlucky,
            ambient: 'thin',
            candidates: [],
            hurried: true
        });
        expect(lucky.next()).toBe(unlucky.next());
    });

    it('is reproducible from the same stream', () => {
        const a = charge(12, 'reproducible');
        const b = charge(12, 'reproducible');
        expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    });
});

describe('the odds move on things the player can act on', () => {
    it('Fortune measurably reduces the toll, and zero Fortune buys nothing', () => {
        const noFortune = takenRate(20, {}, 1500, {
            attributes: { might: 2, insight: 2, fortune: 0, charm: 2 }
        });
        const maxFortune = takenRate(20, {}, 1500, {
            attributes: { might: 2, insight: 2, fortune: 3, charm: 2 }
        });
        expect(maxFortune).toBeLessThan(noFortune - 0.1);

        const attrs = (fortune: number) => ({ might: 2, insight: 2, fortune, charm: 2 });
        const base = computeTollRisk(
            makeCultivator({ realmOrdinal: 20, attributes: attrs(0) }),
            { ambient: 'normal' }
        );
        expect(base.modifiers.find(m => m.source === 'fortune')!.delta).toBe(0);
    });

    it('sect protection measurably reduces the toll', () => {
        const alone = takenRate(24, {}, 1500);
        const shielded = takenRate(24, { sectProtection: 1 }, 1500);
        expect(shielded).toBeLessThan(alone - 0.15);
    });

    it('preparation and dense ash both help; a hurried crossing hurts', () => {
        const cultivator = makeCultivator({ realmOrdinal: 20 });
        const ditch = computeTollRisk(cultivator, { ambient: 'thin', hurried: true }).risk;
        const ordinary = computeTollRisk(cultivator, { ambient: 'normal' }).risk;
        const chosenCave = computeTollRisk(cultivator, {
            ambient: 'dense',
            preparation: 1
        }).risk;
        expect(ditch).toBeGreaterThan(ordinary);
        expect(chosenCave).toBeLessThan(ordinary);
    });

    it('a holed foundation is easier for the Vault to reach into', () => {
        const sound = computeTollRisk(
            makeCultivator({ realmOrdinal: 20, foundationQuality: 'exceptional' }),
            { ambient: 'normal' }
        ).risk;
        const holed = computeTollRisk(
            makeCultivator({ realmOrdinal: 20, foundationQuality: 'damaged' }),
            { ambient: 'normal' }
        ).risk;
        expect(holed).toBeGreaterThan(sound);
    });

    it('itemises every modifier and sums them exactly to the risk', () => {
        for (const ordinal of TOLL_BOUNDARY_ORDINALS) {
            for (const conditions of [
                {},
                { sectProtection: 0.5, preparation: 0.4 },
                { hurried: true },
                { sectProtection: 1, preparation: 1 }
            ] as TollConditions[]) {
                const result = charge(ordinal, 'itemised', conditions);
                const sum = result.modifiers.reduce((n, m) => n + m.delta, 0);
                expect(sum).toBeCloseTo(result.risk, 10);
            }
        }
    });

    it('clamps to a floor and a ceiling, and books the clamp as a line item', () => {
        const shielded = computeTollRisk(
            makeCultivator({
                realmOrdinal: 12,
                attributes: { might: 2, insight: 2, fortune: 3, charm: 2 },
                foundationQuality: 'exceptional'
            }),
            { ambient: 'spirit_tide', sectProtection: 1, preparation: 1 }
        );
        expect(shielded.risk).toBe(MIN_TOLL_RISK);
        expect(shielded.modifiers.some(m => m.source === 'clamp:floor')).toBe(true);
        expect(shielded.risk).toBeGreaterThan(0);
        expect(shielded.risk).toBeLessThan(MAX_TOLL_RISK);
    });
});

describe('the Severed path', () => {
    it('crosses clean, every time, at every boundary', () => {
        for (const ordinal of TOLL_BOUNDARY_ORDINALS) {
            for (let i = 0; i < 60; i++) {
                const result = charge(ordinal, `severed-${i}`, { severed: true });
                expect(result.outcome).toBe('prepaid');
                expect(result.taken).toBeNull();
                expect(result.risk).toBe(0);
            }
        }
    });

    it('shows the player exactly what their path bought them', () => {
        const result = charge(40, 'severed-ledger', { severed: true });
        expect(result.modifiers.some(m => m.source === 'severed_path:prepaid')).toBe(true);
        const sum = result.modifiers.reduce((n, m) => n + m.delta, 0);
        expect(sum).toBeCloseTo(0, 12);
        expect(result.narrationHint).toContain('advance');
    });

    it('crosses clean even in the worst conditions a run can produce', () => {
        const result = charge(40, 'severed-worst', {
            severed: true,
            hurried: true
        }, {
            attributes: { might: 1, insight: 1, fortune: 0, charm: 1 },
            foundationQuality: 'sacrificed'
        });
        expect(result.outcome).toBe('prepaid');
    });
});

describe('what gets taken', () => {
    it('always takes exactly one thing, and one the run actually accumulated', () => {
        const pool = candidates();
        const ids = new Set(pool.map(c => c.id));
        let sawTaken = 0;
        for (let i = 0; i < 400; i++) {
            const result = charge(12, `taken-${i}`);
            if (result.outcome !== 'taken') continue;
            sawTaken++;
            expect(result.taken).not.toBeNull();
            expect(ids.has(result.taken!.id!)).toBe(true);
            expect(result.taken!.label.length).toBeGreaterThan(0);
            expect(result.taken!.reason.length).toBeGreaterThan(0);
        }
        expect(sawTaken).toBeGreaterThan(0);
    });

    it('reaches every category the run has, over enough crossings', () => {
        const kinds = new Set<string>();
        for (let i = 0; i < 600; i++) {
            const result = charge(12, `kinds-${i}`);
            if (result.taken) kinds.add(result.taken.kind);
        }
        expect(kinds).toContain('bond');
        expect(kinds).toContain('memory');
        expect(kinds).toContain('technique');
    });

    it('prefers what mattered more', () => {
        // The Vault is not looking for the cheapest item. Over many crossings
        // the weight-5 brother must be taken more often than the weight-3
        // teacher, both being bonds.
        let brother = 0;
        let teacher = 0;
        for (let i = 0; i < 2000; i++) {
            const taken = charge(12, `weighted-${i}`).taken;
            if (taken?.id === 'npc-brother') brother++;
            if (taken?.id === 'npc-shu') teacher++;
        }
        expect(brother).toBeGreaterThan(teacher);
    });

    it('does not depend on the order the caller listed candidates in', () => {
        const forward = candidates();
        const reversed = [...forward].reverse();
        for (let i = 0; i < 100; i++) {
            const a = evaluateToll(makeCultivator({ realmOrdinal: 12 }), {
                rng: forStream(`order-${i}`, 'toll', 12),
                ambient: 'normal',
                candidates: forward
            });
            const b = evaluateToll(makeCultivator({ realmOrdinal: 12 }), {
                rng: forStream(`order-${i}`, 'toll', 12),
                ambient: 'normal',
                candidates: reversed
            });
            expect(b.taken).toEqual(a.taken);
        }
    });

    it('never takes a name below the high boundaries', () => {
        for (const ordinal of TOLL_BOUNDARY_ORDINALS.filter(o => o < NAME_ELIGIBLE_FROM_ORDINAL)) {
            for (let i = 0; i < 300; i++) {
                const result = charge(ordinal, `no-name-${i}`);
                expect(result.taken?.kind).not.toBe('name');
            }
        }
    });

    it('can take a name at a high boundary, rarely', () => {
        let names = 0;
        let takes = 0;
        for (let i = 0; i < 2000; i++) {
            const result = charge(40, `name-${i}`);
            if (result.taken) takes++;
            if (result.taken?.kind === 'name') names++;
        }
        expect(names).toBeGreaterThan(0);
        // Rare: a well-connected cultivator mostly loses people, not identity.
        expect(names / takes).toBeLessThan(0.5);
    });

    it('reports the name as the cultivator carried it, with no row to delete', () => {
        let found = null;
        for (let i = 0; i < 2000 && found === null; i++) {
            const result = charge(40, `name-row-${i}`, {}, { name: 'Ye Qingshan' });
            if (result.taken?.kind === 'name') found = result;
        }
        expect(found).not.toBeNull();
        expect(found!.taken!.label).toBe('Ye Qingshan');
        expect(found!.taken!.id).toBeNull();
    });

    it('cannot take a name twice', () => {
        for (let i = 0; i < 500; i++) {
            const result = charge(40, `twice-${i}`, { nameAlreadyTaken: true });
            expect(result.taken?.kind).not.toBe('name');
        }
    });

    it('finds nothing to take from a cultivator who has already been emptied', () => {
        // The Hollow Court condition arriving early. Not a reprieve.
        let nothingLeft = 0;
        for (let i = 0; i < 400; i++) {
            const result = evaluateToll(makeCultivator({ realmOrdinal: 12 }), {
                rng: forStream(`hollow-${i}`, 'toll', 12),
                ambient: 'normal',
                candidates: []
            });
            expect(['clean', 'nothing_left']).toContain(result.outcome);
            if (result.outcome === 'nothing_left') {
                nothingLeft++;
                expect(result.taken).toBeNull();
                expect(result.narrationHint).toContain('nothing worth taking');
            }
        }
        expect(nothingLeft).toBeGreaterThan(0);
    });

    it('never mutates the candidate list it was handed', () => {
        const pool = candidates();
        const before = JSON.parse(JSON.stringify(pool));
        for (let i = 0; i < 50; i++) {
            evaluateToll(makeCultivator({ realmOrdinal: 24 }), {
                rng: forStream(`pure-${i}`, 'toll', 24),
                ambient: 'normal',
                candidates: pool
            });
        }
        expect(pool).toEqual(before);
    });
});
