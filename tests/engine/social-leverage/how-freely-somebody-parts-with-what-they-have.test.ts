/**
 * Disposition, and the one property it exists to have.
 *
 * The design owner: *"some people are greedy some generous, this should be part
 * of their character - kind elders exist just as greedy demonic cultivators
 * exist."*
 *
 * The second clause is the whole test. If a house's alignment predicted how
 * freely its people part with things, the model would have flattened the
 * righteous/demonic axis - which in this world is about METHOD AND PERMISSION -
 * into a colour code for niceness, and it would have done it invisibly, because
 * every individual result would still read plausibly.
 *
 * So the load-bearing case here measures the REAL member catalog, partitioned
 * by the real alignments of the real houses those people stand in, and requires
 * the arms to be indistinguishable and both tails to be populated in each.
 */

import { describe, it, expect } from 'vitest';
import {
    openHandednessOf,
    howTheyHoldWhatTheyHave,
    whatTheirRefusalIsLike,
    DISPOSITION_BANDS,
    oddsOf,
    dispositionWeight,
    LEVERAGE_ATTEMPT_CONSTANTS,
    type AttemptInput,
    type AskWeight,
    type Party
} from '../../../src/engine/social-leverage/index.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { MEMBERS } from '../../../src/data/cultivation/members.js';
import { getSect } from '../../../src/data/cultivation/sects.js';

function party(over: Partial<Party> = {}): Party {
    return {
        id: 'a',
        name: 'Somebody',
        ordinal: 6,
        charm: 2,
        factionId: null,
        alignment: null,
        ...over
    };
}

function attempt(over: Partial<AttemptInput> = {}): AttemptInput {
    return {
        actor: party({ id: 'actor', name: 'The Asker' }),
        subject: party({ id: 'subject', name: 'The Asked' }),
        onDay: 1000,
        ask: 'a_real_favour',
        rng: forStream('seed', 'test', 1),
        ...over
    };
}

const mean = (xs: readonly number[]): number =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

// ─────────────────────────────────────────────────────────────────────────
// THE RULING
// ─────────────────────────────────────────────────────────────────────────

describe('disposition cuts across alignment', () => {
    /**
     * The catalog, partitioned by the alignment of the house each person is
     * actually standing in. Dao houses and anything `getSect` does not know are
     * dropped rather than guessed at.
     */
    const byAlignment = new Map<string, number[]>();
    for (const member of MEMBERS) {
        const alignment = getSect(member.factionId)?.alignment;
        if (!alignment) continue;
        const arm = byAlignment.get(alignment) ?? [];
        arm.push(openHandednessOf(`npc-${member.id}`));
        byAlignment.set(alignment, arm);
    }

    it('has enough of the real catalog in each arm to be worth measuring', () => {
        expect(byAlignment.size).toBeGreaterThanOrEqual(3);
        for (const [alignment, arm] of byAlignment) {
            expect(arm.length, alignment).toBeGreaterThanOrEqual(20);
        }
    });

    /**
     * The bar is derived rather than chosen. The draw is triangular on -1..+1,
     * whose standard deviation is 1/sqrt(6) - about 0.408 - so an arm of n has
     * a standard error of 0.408/sqrt(n). A quarter is comfortably over three
     * standard errors at the smallest arm size this catalog produces, and it is
     * nowhere near large enough to hide the effect it is guarding against: an
     * alignment-driven disposition would separate the arms by most of the axis,
     * not by a fifth of it.
     */
    it('gives every alignment the same middle', () => {
        const means = [...byAlignment].map(([alignment, arm]) =>
            [alignment, mean(arm), arm.length] as const
        );
        for (const [alignment, m, n] of means) {
            expect(Math.abs(m), `${alignment} (n=${n}) mean ${m.toFixed(3)}`)
                .toBeLessThan(0.25);
        }
    });

    /**
     * The owner's sentence made into an assertion, in both directions at once.
     * A model that got the means right and the tails wrong - every righteous
     * person mildly generous, every demonic one mildly grasping - would pass the
     * test above and fail the ruling.
     */
    it('puts open hands and closed ones inside every alignment', () => {
        for (const [alignment, arm] of byAlignment) {
            const open = arm.filter(x => x >= DISPOSITION_BANDS.WORTH_SAYING);
            const closed = arm.filter(x => x <= -DISPOSITION_BANDS.WORTH_SAYING);
            expect(open.length, `${alignment} has nobody open-handed`).toBeGreaterThan(0);
            expect(closed.length, `${alignment} has nobody tight-fisted`).toBeGreaterThan(0);
        }
    });

    /**
     * The marked ends, asserted where the sample can carry the claim and not
     * where it cannot.
     *
     * MEASURED, AND THE BAR WAS NOT WIDENED. The first version of this asked
     * for somebody past `MARKED` in each alignment arm and went red on the
     * righteous one. That is not the model failing - it is the arithmetic:
     * `MARKED` is 0.75 and the draw is triangular, so each tail holds about
     * 3.1% of people, and the righteous arm of the catalog is around seventy
     * names. Two expected, and an empty tail perfectly ordinary. AGENTS.md:
     * *"where either band is individuals, the ordering holds only in
     * aggregate"*, and the fix is to pool rather than to move the band.
     *
     * So the claim is made twice at the two scales it is true at. Across the
     * whole written catalog, both ends are occupied - the people already in
     * this world include somebody known for giving things away and somebody
     * known for letting go of nothing. And across a population the size of a
     * seeded world, both ends are occupied reliably. What connects the two to
     * the ruling is the structural test below: the draw has no way to see an
     * alignment at all, so nothing about the ends can be housed in one.
     */
    it('puts both marked ends into the catalog that already exists', () => {
        const everybody = [...byAlignment.values()].flat();
        expect(everybody.some(x => x >= DISPOSITION_BANDS.MARKED)).toBe(true);
        expect(everybody.some(x => x <= -DISPOSITION_BANDS.MARKED)).toBe(true);
    });

    it('puts both marked ends into a population the size of a world', () => {
        const world = Array.from({ length: 600 }, (_, i) => openHandednessOf(`npc-${i}`));
        expect(world.filter(x => x >= DISPOSITION_BANDS.MARKED).length).toBeGreaterThan(5);
        expect(world.filter(x => x <= -DISPOSITION_BANDS.MARKED).length).toBeGreaterThan(5);
    });

    /**
     * The seeder mints ordinary people as `npc-1`, `npc-2`, ... walking the
     * catalog in order, so a whole faction - and therefore a whole alignment -
     * occupies a contiguous block of ids. A draw that carried any of that
     * sequence through would put a systematic leaning on whole houses at once,
     * which is the same defect as reading the alignment directly and is far
     * harder to see.
     */
    it('carries no structure from a block of sequential ids', () => {
        const blocks: number[] = [];
        for (let block = 0; block < 20; block++) {
            const arm: number[] = [];
            for (let i = 0; i < 100; i++) arm.push(openHandednessOf(`npc-${block * 100 + i}`));
            blocks.push(mean(arm));
        }
        for (const [i, m] of blocks.entries()) {
            expect(Math.abs(m), `block ${i} mean ${m.toFixed(3)}`).toBeLessThan(0.15);
        }
    });

    /**
     * The structural guarantee behind all of the above, stated as a test rather
     * than as a comment: there is no parameter through which an alignment could
     * reach this function even if somebody wanted it to.
     */
    it('answers from the id alone', () => {
        expect(openHandednessOf.length).toBe(1);
        expect(openHandednessOf('member-x')).toBe(openHandednessOf('member-x'));
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE DRAW
// ─────────────────────────────────────────────────────────────────────────

describe('the draw', () => {
    const world = Array.from({ length: 4000 }, (_, i) => openHandednessOf(`npc-${i}`));

    it('stays on the axis', () => {
        for (const x of world) {
            expect(x).toBeGreaterThanOrEqual(-1);
            expect(x).toBeLessThanOrEqual(1);
        }
    });

    it('centres on ordinary and thins toward the ends', () => {
        expect(Math.abs(mean(world))).toBeLessThan(0.03);

        const ordinary = world.filter(x => Math.abs(x) < DISPOSITION_BANDS.WORTH_SAYING).length;
        const noticeable = world.filter(x => Math.abs(x) >= DISPOSITION_BANDS.WORTH_SAYING).length;
        const marked = world.filter(x => Math.abs(x) >= DISPOSITION_BANDS.MARKED).length;

        // Most of the world is unremarkable about this, a substantial minority
        // is not, and the far ends are rare without being absent. Bars are wide
        // because what is being asserted is the SHAPE, not a calibration.
        expect(ordinary).toBeGreaterThan(noticeable);
        expect(noticeable / world.length).toBeGreaterThan(0.3);
        expect(marked / world.length).toBeGreaterThan(0.03);
        expect(marked / world.length).toBeLessThan(0.15);
    });

    it('is total - an unknown id and an empty one both answer', () => {
        expect(Number.isFinite(openHandednessOf('nobody-has-ever-had-this-id'))).toBe(true);
        expect(openHandednessOf('')).toBe(0);
        expect(openHandednessOf('   ')).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE TERM
// ─────────────────────────────────────────────────────────────────────────

describe('the term in an attempt', () => {
    it('moves a real favour and barely moves a betrayal', () => {
        const spread = (ask: AskWeight): number =>
            dispositionWeight(attempt({ ask, subject: party({ id: 's', openHandedness: 1 }) }))
            - dispositionWeight(attempt({ ask, subject: party({ id: 's', openHandedness: -1 }) }));

        expect(spread('a_real_favour')).toBeGreaterThan(spread('against_their_interest'));
        expect(spread('against_their_interest')).toBeGreaterThan(spread('a_betrayal'));
        expect(spread('a_real_favour')).toBeGreaterThan(spread('a_courtesy'));
        // Never zero at the far end. "Typically does not" is not "never".
        expect(spread('a_betrayal')).toBeGreaterThan(0);
    });

    /**
     * The two people the ruling is about, and the whole of what separates them
     * is which person they are. Same rung, same house, same alignment, same
     * charm, same ask, same everything else.
     */
    it('makes two people of the same standing answer differently', () => {
        const same = {
            ordinal: 6,
            charm: 2,
            factionId: 'sect-azure-cloud-pavilion',
            alignment: 'righteous' as const,
            ranked: true
        };
        // A tie is supplied so that neither answer is sitting on the floor or
        // the ceiling. Two clamped odds are equal whatever moved them, and a
        // test that cannot tell those apart is measuring the clamp.
        const tie = { active: true, strength: 0.6 };
        const openHanded = oddsOf(attempt({
            theirTie: tie,
            subject: party({ ...same, id: 'elder-a', openHandedness: 0.8 })
        }));
        const tightFisted = oddsOf(attempt({
            theirTie: tie,
            subject: party({ ...same, id: 'elder-b', openHandedness: -0.8 })
        }));
        expect(openHanded.odds).toBeGreaterThan(tightFisted.odds);
        expect(openHanded.terms.disposition).toBeGreaterThan(0);
        expect(tightFisted.terms.disposition).toBeLessThan(0);
    });

    /**
     * The term is real and it is never the whole story. AGENTS.md's standing
     * rule for this resolver is that who you are outweighs how you ask, and a
     * disposition that could beat a realm of standing or a tie at full strength
     * would make the world turn on a coin the player cannot see.
     */
    it('is smaller than standing and smaller than a tie', () => {
        const { DISPOSITION_MAX, PURSE_MAX } = LEVERAGE_ATTEMPT_CONSTANTS;
        // A realm of standing is RUNG_CLAMP * PER_RUNG = 0.3, and a tie at full
        // strength is TIE_WEIGHT = 0.3. Neither is exported; both are 0.3, and
        // the assertion is that a disposition sits under them.
        expect(DISPOSITION_MAX).toBeLessThan(0.3);
        // And over half a purse, because who somebody is should outweigh what a
        // stranger happens to be carrying.
        expect(DISPOSITION_MAX).toBeGreaterThan(PURSE_MAX * 0.5);
    });

    /**
     * The default is where the answer comes from, not a fallback. Two callers
     * reach `resolveAttempt` - the played game and the world simulation - and a
     * field either could forget is a field one of them will forget.
     */
    it('is drawn from the subject when the caller supplies nothing', () => {
        const drawn = oddsOf(attempt({ subject: party({ id: 'npc-7' }) })).terms.disposition;
        const stated = oddsOf(attempt({
            subject: party({ id: 'npc-7', openHandedness: openHandednessOf('npc-7') })
        })).terms.disposition;
        expect(drawn).toBe(stated);
    });

    it('leaves the alignment guard intact', () => {
        const odds = (['righteous', 'neutral', 'demonic', null] as const).map(alignment =>
            oddsOf(attempt({
                subject: party({ id: 'subject', factionId: 'f', alignment })
            })).odds
        );
        expect(new Set(odds).size).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// SAYING IT
// ─────────────────────────────────────────────────────────────────────────

describe('it is legible, not only arithmetic', () => {
    it('says nothing about an ordinary person and something about the ends', () => {
        expect(howTheyHoldWhatTheyHave(0)).toBeNull();
        expect(howTheyHoldWhatTheyHave(0.1)).toBeNull();
        expect(howTheyHoldWhatTheyHave(0.9)).not.toBeNull();
        expect(howTheyHoldWhatTheyHave(-0.9)).not.toBeNull();
        expect(whatTheirRefusalIsLike(0)).toBeNull();
        expect(whatTheirRefusalIsLike(0.9)).not.toBeNull();
        expect(whatTheirRefusalIsLike(-0.9)).not.toBeNull();
    });

    it('reads differently at the two ends', () => {
        expect(howTheyHoldWhatTheyHave(0.9)).not.toBe(howTheyHoldWhatTheyHave(-0.9));
        expect(whatTheirRefusalIsLike(0.9)).not.toBe(whatTheirRefusalIsLike(-0.9));
    });

    it('says most of the world is ordinary about it', () => {
        const said = Array.from({ length: 2000 }, (_, i) =>
            howTheyHoldWhatTheyHave(openHandednessOf(`npc-${i}`))
        );
        const silent = said.filter(s => s === null).length;
        expect(silent / said.length).toBeGreaterThan(0.4);
        expect(silent / said.length).toBeLessThan(0.8);
    });
});
