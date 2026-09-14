/**
 * Design guards for the escape routes.
 *
 * These are not coverage. Each one pins a sentence from `docs/world/writing/escapes.md`
 * that would be quietly false if somebody changed the code around it, and
 * several of them are here specifically because the property they assert is
 * invisible in play until it is already broken.
 */

import { describe, it, expect } from 'vitest';

import {
    canExtend,
    writeNextStage,
    stagesWrittenOf,
    writtenTo,
    effectiveCapOf,
    manualDaoRequirement,
    manualGate,
    openingPenalty,
    ordinaryCapFor,
    realmsSpannedBy,
    spanStanding,
    ORDINARY_REALM_SPAN,
    DERIVATION_FLOOR_YEARS,
    DERIVATION_LIFE_SHARE,
    PRECEDENT_WELL_WALKED,
    derivationBaseYears,
    derivationShareOfALife,
    precedentAt,
    thinnessAt,
    derivationYears,
    type ExtendableManual,
    type GatedManual
} from '../../../src/engine/cultivation/escapes.js';
import {
    NO_MANUAL_CEILING,
    computeCultivationRate,
    techniqueExhausted
} from '../../../src/engine/cultivation/cultivation.js';
import { MAX_ORDINAL, realmForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { daoGate, daoOf } from '../../../src/engine/cultivation/dao.js';
import { shardPower } from '../../../src/engine/world/possessions.js';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques.js';
import { THE_DEEPEST_ROADS } from '../../../src/data/cultivation/roads-to-the-top-of-the-ladder.js';
import type { AmbientQi, Cultivator, Insight, InsightDegree } from '../../../src/schema/cultivation.js';

// ─────────────────────────────────────────────────────────────────────────

const AMBIENT: AmbientQi = 'normal';

function cultivator(overrides: Partial<Cultivator> = {}): Parameters<typeof computeCultivationRate>[0] {
    return {
        spiritRoot: 'single_fire',
        injuries: [],
        realmOrdinal: 0,
        ...overrides
    } as Parameters<typeof computeCultivationRate>[0];
}

function insight(subject: string, domain: Insight['domain'], degree: InsightDegree): Insight {
    return {
        id: `i-${domain}-${subject}-${degree}`,
        domain,
        subject,
        degree,
        // PROVENANCE IS AN ACCOUNT, NOT A WORD. This fixture held the string
        // 'earned', which is the shape the field had before an insight was
        // required to name the event that produced it - so it was building a
        // row the engine could never mint or persist.
        provenance: {
            achievementId: `achievement-${domain}-${subject}`,
            achievementKind: 'profound_principle',
            onDay: 1,
            deepenedBy: [],
            account: `Comprehended ${subject}.`
        }
    };
}

/** A road walked to `dao` standing in one subject. */
function daoIn(subject: string, domain: Insight['domain'] = 'element') {
    return daoOf([
        insight(subject, domain, 4),
        insight(`${subject}-corroborating`, domain, 2)
    ]);
}

/** A road walked only to `leaning`. */
function leaningIn(subject: string, domain: Insight['domain'] = 'element') {
    return daoOf([insight(subject, domain, 3)]);
}

const SCATTERED: GatedManual & ExtendableManual = {
    id: 'scattered-canon',
    name: 'A Scattered Canon',
    requiredOrdinal: 37,
    cap: 41,
    volumes: ['vol-one', 'vol-two', 'vol-three'],
    grade: 'chaos',
    element: 'fire',
    subjects: ['fire'],
    category: 'cultivation',
    notExtendableReason: null
};

// ─────────────────────────────────────────────────────────────────────────
describe('realm geometry - the measure the gates are keyed on', () => {
    it('an ordinary manual spans one realm, and the exceptions are deliberate and few', () => {
        // The claim the whole design rests on: `capOf` is realm geometry, so a
        // manual carries a reader through its realm and one rung over. A book
        // spanning two or more realms is what "exceptional" means, and it is
        // the thing that makes the corridor leapfroggable.
        //
        // This test is a RATIO guard, in the idiom the routes suite already
        // uses. Wide books are the treasure; a catalog where several of them
        // exist is a catalog where the corridor has been quietly abolished.
        const manuals = TECHNIQUES.slice();
        expect(manuals.length).toBeGreaterThan(0);
        const wide = manuals.filter(
            m => realmsSpannedBy({ requiredOrdinal: m.requiredOrdinal, cap: m.cap })
                > ORDINARY_REALM_SPAN
        );
        expect(wide.length / manuals.length).toBeLessThan(0.15);
        for (const manual of manuals) {
            if (wide.includes(manual)) continue;
            // Zero is legal and there is exactly one of it: the Canon of the
            // Unwritten Span sits AT the top of the ladder with no cap, so
            // there is no rung above it for a manual to carry anybody to. It
            // spans nothing because there is nothing to span, which is the
            // same fact its own entry states in prose.
            expect(
                realmsSpannedBy({ requiredOrdinal: manual.requiredOrdinal, cap: manual.cap }),
                `${manual.id} spans more than one realm`
            ).toBeLessThanOrEqual(ORDINARY_REALM_SPAN);
        }
    });

    it('every wide manual pays for its reach - it is never a strict upgrade', () => {
        // The property the user asked for in as many words: "it'll just be
        // harder to start, or require more comprehension ability". A book that
        // skips a stretch of the corridor and asks NOTHING for it would make
        // finding one the whole game. Every wide book must carry at least one
        // of the two prices.
        for (const manual of TECHNIQUES.slice()) {
            const realms = realmsSpannedBy({
                requiredOrdinal: manual.requiredOrdinal, cap: manual.cap
            });
            if (realms <= ORDINARY_REALM_SPAN) continue;

            const gated = {
                id: manual.id, name: manual.name,
                requiredOrdinal: manual.requiredOrdinal, cap: manual.cap,
                grade: manual.grade, element: manual.element,
                subject: null, category: manual.category,
                domain: manual.domain, domainDegree: manual.domainDegree
            };
            const asksComprehension =
                Boolean(manual.domain) ||
                manualDaoRequirement(gated).standing !== 'none';
            const hardOpening = openingPenalty(
                { requiredOrdinal: manual.requiredOrdinal, cap: manual.cap, opening: manual.opening },
                manual.requiredOrdinal
            ).multiplier < 1;

            expect(
                asksComprehension || hardOpening,
                `${manual.id} spans ${realms} realms and asks nothing for it`
            ).toBe(true);
        }
    });

    it('rungs are the wrong measure and realms are the right one', () => {
        // The Lesser Qi-Gathering Manual spans thirteen RUNGS and one REALM,
        // because Qi Condensation is one realm thirteen rungs deep. Keyed on
        // rungs, the starter manual every novice in the world reads would be
        // the most exceptional book in the catalog.
        const starter = TECHNIQUES.find(t => t.id === 'lesser-qi-gathering-manual');
        expect(starter).toBeDefined();
        expect(starter!.cap! - starter!.requiredOrdinal).toBe(13);
        expect(realmsSpannedBy({ requiredOrdinal: starter!.requiredOrdinal, cap: starter!.cap }))
            .toBe(1);
    });

    it('ordinaryCapFor reproduces capOf for every rung on the ladder', () => {
        // The data layer's `capOf` and this are the same rule. If they ever
        // disagree, one of them has been edited and the corridor has moved.
        for (let n = 0; n <= MAX_ORDINAL; n++) {
            const expected = realmForOrdinal(n).ordinalEnd + 1;
            expect(ordinaryCapFor(n)).toBe(expected > MAX_ORDINAL ? null : expected);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('E1 - effectiveCapOf, the scattered set', () => {
    it('a complete set is the manual', () => {
        const held = ['vol-one', 'vol-two', 'vol-three'];
        expect(effectiveCapOf(SCATTERED, held).cap).toBe(41);
        expect(effectiveCapOf(SCATTERED, held).rungsLost).toBe(0);
    });

    it('a single-volume work is unaffected by what is in hand', () => {
        const whole = { id: 'w', name: 'Whole', cap: 21, volumes: null };
        expect(effectiveCapOf(whole, []).cap).toBe(21);
        expect(effectiveCapOf(whole, ['anything']).cap).toBe(21);
    });

    it('each missing volume costs exactly one rung, and collecting one raises it', () => {
        expect(effectiveCapOf(SCATTERED, ['vol-one', 'vol-two']).cap).toBe(40);
        expect(effectiveCapOf(SCATTERED, ['vol-one']).cap).toBe(39);
    });

    it('but holding none of it is not a ceiling of 38, it is no ceiling', () => {
        // REWRITTEN, and the old line pinned a defect. It asserted 38 for a
        // holder with nothing in hand, while `line` on the same object read
        // "none of them are in hand. There is nothing here to practise." The
        // number and the sentence disagreed and the sentence was right.
        //
        // Ruled: three categories, and `ruined` means unreadable. See
        // `a-manual-is-in-one-of-three-states.test.ts`, which is where the rule
        // lives now.
        expect(effectiveCapOf(SCATTERED, []).cap).toBe(NO_MANUAL_CEILING);
        expect(effectiveCapOf(SCATTERED, []).condition).toBe('ruined');
    });

    it('is shardPower and not a second piece of the same arithmetic', () => {
        // The handover's standing instruction: there must be ONE function in
        // the repo that says a piece is worth less than the whole. If this
        // stops agreeing with `shardPower`, a second one has been written.
        //
        // Measured over the readable range only: a book with no first page is
        // not a smaller book, so `shardPower` has nothing to say about it.
        let expected: number | null = SCATTERED.cap;
        for (const missing of [1, 2]) {
            expected = shardPower(expected);
            const held = SCATTERED.volumes!.slice(0, 3 - missing);
            expect(effectiveCapOf(SCATTERED, held).cap).toBe(expected);
        }
    });

    it('a later volume is worth nothing without the one before it', () => {
        // CONTIGUITY, and the reason stages are numbered at all. Holding the
        // first and third volumes is holding the first volume plus a book you
        // cannot read yet - a different and more interesting position than
        // "one volume short", and the one the old arithmetic reported.
        const gapped = effectiveCapOf(SCATTERED, ['vol-one', 'vol-three']);
        const firstOnly = effectiveCapOf(SCATTERED, ['vol-one']);
        expect(gapped.cap).toBe(firstOnly.cap);
        expect(gapped.volumesHeld).toBe(2);
        expect(gapped.line).toContain('cannot be read past the gap');
    });

    it('an unbroken run is worth every volume in it', () => {
        expect(effectiveCapOf(SCATTERED, ['vol-one', 'vol-two']).cap).toBe(40);
        // And holding the tail without the head is worth nothing at all.
        expect(effectiveCapOf(SCATTERED, ['vol-two', 'vol-three']).cap)
            .toBe(effectiveCapOf(SCATTERED, []).cap);
    });

    it('a written stage moves the ceiling, and the catalog alone no longer knows it', () => {
        // THE SEAM. `stagesWrittenOf` is `cap - requiredOrdinal`, exact for a
        // catalog row precisely BECAUSE nothing has been written yet. The
        // moment a stage exists the two disagree, and the catalog is what the
        // rate layer reaches - so anything resolving `techniqueCap` must
        // compose, never read `manual.cap`.
        const whole = { id: 'w', name: 'Whole', cap: 21, volumes: null };
        expect(writtenTo(whole, 0)).toBe(21);
        expect(writtenTo(whole, 1)).toBe(22);
        expect(writtenTo(whole, 3)).toBe(24);
        expect(effectiveCapOf(whole, [], 2).cap).toBe(23);
        expect(effectiveCapOf(whole, [], 2).writtenTo).toBe(23);
        expect(effectiveCapOf(whole, [], 2).line).toContain('written since');
    });

    it('a stage past the end of the book is worth nothing to somebody not at the end', () => {
        // Contiguity again, and the same answer it gives volumes. Nobody
        // practises stage 14 while stuck at stage 2 for want of volume two.
        const partial = effectiveCapOf(SCATTERED, ['vol-one'], 5);
        expect(partial.cap).toBe(39);
        expect(partial.stagesHeld).toBe(0);
        // But the world fact is still reported, so a caller can say the book
        // goes further than this holder can follow it.
        expect(partial.writtenTo).toBe(46);
    });

    it('a complete holder stands on every stage written since', () => {
        const complete = effectiveCapOf(SCATTERED, ['vol-one', 'vol-two', 'vol-three'], 2);
        expect(complete.cap).toBe(43);
        expect(complete.stagesHeld).toBe(2);
    });

    it('extending twice writes the SECOND stage, not the first again', () => {
        // Without `stagesWrittenSince` the ceiling would never move past the
        // first derivation: every attempt would rewrite the stage that exists.
        const base = {
            runSeed: 'seed-alpha', cultivatorId: 'c1',
            source: SCATTERED, dao: daoIn('fire'),
            precedent: { artsAtOrAbove: PRECEDENT_WELL_WALKED }
        };
        const first = writeNextStage({ ...base, stagesWrittenSince: 0 });
        const second = writeNextStage({ ...base, stagesWrittenSince: 1 });
        expect(first.written && second.written).toBe(true);
        if (!first.written || !second.written) return;
        expect(second.stage.number).toBe(first.stage.number + 1);
        expect(second.newCap).toBe(first.newCap + 1);
    });

    it('refuses once the manual has been written to the top of the ladder', () => {
        const result = writeNextStage({
            runSeed: 'seed-alpha', cultivatorId: 'c1',
            source: SCATTERED, dao: daoIn('fire'),
            precedent: { artsAtOrAbove: PRECEDENT_WELL_WALKED },
            stagesWrittenSince: MAX_ORDINAL
        });
        expect(result.written).toBe(false);
        expect(result.check.reason).toBe('nothing_above');
    });

    it('stages are derived from the cap, so nothing has to be kept in sync', () => {
        // A manual IS its written stages; the cap is how far it has been
        // written. No new field, nothing for an author to forget.
        expect(stagesWrittenOf(SCATTERED)).toBe(4);
        expect(stagesWrittenOf({ requiredOrdinal: 13, cap: 17 })).toBe(4);
        expect(stagesWrittenOf({ requiredOrdinal: 13, cap: 13 })).toBe(0);
    });

    it('volumes and stages are the same idea and NOT the same number', () => {
        // Stated because the tidy version is false and would be easy to
        // "fix" into a bug: the one scattered work in the catalog is 3 volumes
        // across 4 rungs. A volume is a container, a stage is a unit of method.
        expect(SCATTERED.volumes!.length).toBe(3);
        expect(stagesWrittenOf(SCATTERED)).toBe(4);
    });

    it('a partial set of an UNCAPPED work is capped, which is the point of route 1b', () => {
        // Three quarters of the top prize in the setting is a very good book
        // with a ceiling. It must not stay uncapped just because the whole is.
        const topPrize = {
            id: 'top',
            name: 'The Top Prize',
            cap: null,
            volumes: ['a', 'b', 'c']
        };
        expect(effectiveCapOf(topPrize, ['a', 'b', 'c']).cap).toBeNull();
        expect(effectiveCapOf(topPrize, ['a', 'b']).cap).toBe(MAX_ORDINAL);
        expect(effectiveCapOf(topPrize, ['a']).cap).toBe(MAX_ORDINAL - 1);
    });

    it('says out loud what is missing and what it costs', () => {
        const partial = effectiveCapOf(SCATTERED, ['vol-one']);
        expect(partial.missing).toEqual(['vol-two', 'vol-three']);
        expect(partial.line).toContain('2 rungs');
        expect(partial.line).toContain('Finding another volume raises it');
    });

    it('feeds techniqueExhausted, which is the field it exists to supply', () => {
        const partial = effectiveCapOf(SCATTERED, ['vol-one']);
        expect(techniqueExhausted(39, partial.cap)).toBe(true);
        expect(techniqueExhausted(38, partial.cap)).toBe(false);
        // And the complete work would still have carried them.
        expect(techniqueExhausted(39, effectiveCapOf(SCATTERED, SCATTERED.volumes!).cap)).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('E2b - the standing an exceptional manual asks for', () => {
    it('one realm asks nothing, and every ordinary book in the catalog is ungated by span', () => {
        expect(spanStanding(1)).toBe('none');
        for (const manual of TECHNIQUES.slice()) {
            const requirement = manualDaoRequirement({
                id: manual.id,
                name: manual.name,
                requiredOrdinal: manual.requiredOrdinal,
                cap: manual.cap,
                grade: manual.grade,
                element: manual.element,
                subjects: null,
                category: manual.category,
                domain: manual.domain,
                domainDegree: manual.domainDegree
            });
            // Either it is an ordinary one-realm book, or the catalog has
            // stated its own comprehension gate and the span curve stood down.
            expect(
                requirement.spanStanding === 'none',
                `${manual.id}: span asked for ${requirement.spanStanding}`
            ).toBe(true);
        }
    });

    it('the catalog\'s own comprehension gate wins, and the span curve stands down', () => {
        // The five-realm treasure in the catalog states `domain: void` at
        // degree 3. Stacking a full-Dao span requirement on top of that would
        // be two gates measuring the same thing, which is how a system starts
        // reading as arbitrary. `assessFit` enforces it, once.
        const wide: GatedManual = {
            id: 'wide', name: 'A Wide Book',
            requiredOrdinal: 13, cap: 33,
            grade: 'earth', element: null, subjects: null, category: 'cultivation'
        };
        expect(manualDaoRequirement(wide).standing).toBe('dao');
        expect(manualDaoRequirement(wide).spanDeferredToCatalog).toBe(false);

        const gatedByCatalog = { ...wide, domain: 'void', domainDegree: 3 };
        expect(manualDaoRequirement(gatedByCatalog).spanDeferredToCatalog).toBe(true);
        expect(manualDaoRequirement(gatedByCatalog).standing).toBe('none');
        expect(manualGate(daoOf([]), gatedByCatalog).permitted).toBe(true);
    });

    it('IS INERT against the live catalog, and must stay that way for now', () => {
        // Measured across 1,058 lives: only 7.5% ever comprehend anything at
        // all, median 0 roads, and 0% of lives reaching rung 12 hold the single
        // road a dao curve would ask for. Switching a dao requirement on today
        // would end every run where it first bit.
        //
        // So this gate ships INERT, exactly the way `DAO_GATE_FROM_ORDINAL`
        // does, and this test is the thing that notices the day it stops being.
        // It goes live when comprehension is actually obtainable in play -
        // which is the same blocker as `DiscoveryContext.tradition` never being
        // populated, not a decision about this curve.
        // Stated precisely, because the loose version of this claim is false.
        // `GRADE_REQUIREMENT` is ALREADY live on learning - `technique-manage.ts`
        // calls `daoGate` and refuses immortal-grade manuals to anybody without
        // a leaning today. That refusal is pre-existing and is not mine.
        //
        // What must be inert is the SPAN half, which is the addition. So the
        // guard is the strong one: `manualGate` must never refuse anything
        // `daoGate` would not already have refused on grade alone.
        for (const road of [daoOf([]), leaningIn('fire'), daoIn('fire')]) {
            for (const manual of TECHNIQUES.slice()) {
                const gated = {
                    id: manual.id, name: manual.name,
                    requiredOrdinal: manual.requiredOrdinal, cap: manual.cap,
                    grade: manual.grade, element: manual.element,
                    subjects: null, category: manual.category,
                    domain: manual.domain, domainDegree: manual.domainDegree
                };
                const mine = manualGate(road, gated);
                const preExisting = daoGate(road, {
                    grade: manual.grade,
                    element: manual.element,
                    subjects: null,
                    category: manual.category
                });
                expect(
                    mine.permitted,
                    `${manual.id}: span gate refuses where daoGate does not`
                ).toBe(preExisting.permitted);
            }
        }
    });

    it('two realms asks a leaning and three asks a full Dao', () => {
        expect(spanStanding(2)).toBe('leaning');
        expect(spanStanding(3)).toBe('dao');
        expect(spanStanding(5)).toBe('dao');
    });

    it('the deeper of grade and span sets the bar, and says which asked', () => {
        // A mortal-grade book that reaches two realms is gated by its reach.
        const wide: GatedManual = {
            id: 'wide', name: 'A Wide Book',
            requiredOrdinal: 13, cap: 21,
            grade: 'mortal', element: 'fire', subjects: ['fire'], category: 'cultivation'
        };
        const req = manualDaoRequirement(wide);
        expect(req.realmsSpanned).toBe(2);
        expect(req.gradeStanding).toBe('none');
        expect(req.standing).toBe('leaning');
        expect(req.from).toBe('span');
    });

    it('refuses a novice handed a treasure, in daoGate vocabulary', () => {
        const wide: GatedManual = {
            id: 'wide', name: 'A Wide Book',
            requiredOrdinal: 13, cap: 21,
            grade: 'mortal', element: 'fire', subjects: ['fire'], category: 'cultivation'
        };
        const refusal = manualGate(daoOf([]), wide);
        expect(refusal.permitted).toBe(false);
        expect(refusal.reason).toBe('no_matching_dao');
        // The reason must say it is not fixable by sitting - that is the whole
        // point of gating on comprehension rather than on rank.
        expect(refusal.detail).toContain('comprehension');
    });

    it('a deep road on the wrong subject is refused differently from a shallow one', () => {
        const wide: GatedManual = {
            id: 'wide', name: 'A Wide Book',
            requiredOrdinal: 13, cap: 21,
            grade: 'mortal', element: 'fire', subjects: ['fire'], category: 'cultivation'
        };
        expect(manualGate(daoIn('water'), wide).reason).toBe('wrong_dao');
        expect(manualGate(daoIn('fire'), wide).permitted).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the opening is uphill - the price of a wide book', () => {
    const wide = { requiredOrdinal: 13, cap: 21 };

    it('is 1 for every ORDINARY manual in the catalog - the common case is untouched', () => {
        for (const manual of TECHNIQUES.slice()) {
            const band = {
                requiredOrdinal: manual.requiredOrdinal,
                cap: manual.cap,
                opening: manual.opening
            };
            if (realmsSpannedBy(band) > ORDINARY_REALM_SPAN || manual.opening) continue;
            for (const n of [manual.requiredOrdinal, manual.requiredOrdinal + 1]) {
                expect(openingPenalty(band, n).multiplier, `${manual.id} at ${n}`).toBe(1);
            }
        }
    });

    it('the live wide manual crawls at its opening and opens up after', () => {
        // The catalog\'s own five-realm treasure, read through the engine.
        // Somebody handed it at Foundation crawls; the same book is ordinary
        // by the time the hard stretch is paid off. That is the whole bargain.
        const treasure = TECHNIQUES.find(t => t.opening !== null);
        if (!treasure) return;
        const band = {
            requiredOrdinal: treasure.requiredOrdinal,
            cap: treasure.cap,
            opening: treasure.opening
        };
        const atStart = openingPenalty(band, treasure.requiredOrdinal);
        expect(atStart.source).toBe('authored');
        expect(atStart.multiplier).toBeLessThan(0.5);
        const after = openingPenalty(band, treasure.requiredOrdinal + treasure.opening!.rungs);
        expect(after.multiplier).toBe(1);
    });

    it('is worst at the start and gone by where an ordinary book would have ended', () => {
        const atStart = openingPenalty(wide, 13);
        expect(atStart.multiplier).toBeLessThan(1);
        expect(atStart.multiplier).toBeGreaterThan(0.5);
        expect(openingPenalty(wide, 17).multiplier).toBe(1);
        expect(openingPenalty(wide, 15).multiplier).toBeGreaterThan(atStart.multiplier);
    });

    it('makes the ordinary book genuinely better for the next stretch', () => {
        // The property that stops "find the best book" being the whole game.
        // A one-realm manual and a two-realm manual, same rung, same everything
        // else: the ordinary one is FASTER until the opening is paid off.
        const ordinaryRate = computeCultivationRate(
            cultivator({ realmOrdinal: 13 }), AMBIENT,
            { techniqueSpan: { requiredOrdinal: 13, cap: 17 } }
        );
        const treasureRate = computeCultivationRate(
            cultivator({ realmOrdinal: 13 }), AMBIENT,
            { techniqueSpan: wide }
        );
        expect(treasureRate.perDay).toBeLessThan(ordinaryRate.perDay);
        // And it is a real cost, not a flavour note: near enough a doubling of
        // the years to the first boundary.
        expect(ordinaryRate.perDay / treasureRate.perDay).toBeGreaterThan(1.5);
    });

    it('the catalog may override the derived default, and does not have to', () => {
        // An authored `opening` on the row wins; a wide manual with none still
        // gets a penalty, so a forgotten field is not a free treasure.
        const authored = openingPenalty(
            { requiredOrdinal: 13, cap: 21, opening: { rungs: 4, rateMultiplier: 0.2 } },
            13
        );
        expect(authored.source).toBe('authored');
        expect(authored.multiplier).toBeCloseTo(0.2, 5);
        expect(openingPenalty(wide, 13).source).toBe('derived');
        expect(openingPenalty({ requiredOrdinal: 13, cap: 17 }, 13).source).toBe('none');
    });

    it('declaring no span at all leaves the rate exactly as it was', () => {
        // The old behaviour, preserved. Every existing caller passes nothing.
        const withNothing = computeCultivationRate(cultivator({ realmOrdinal: 13 }), AMBIENT, {});
        const factor = withNothing.factors.find(f => f.source === 'technique_opening');
        expect(factor?.multiplier).toBe(1);
        expect(factor?.label).toBe('Manual opens ordinarily');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('E2 - canDerive', () => {
    it('refuses a manual the catalog says cannot be reconstructed, with its reason', () => {
        const notDerivable: ExtendableManual = {
            ...SCATTERED,
            notExtendableReason: 'It is a transcript of one side of a conversation.'
        };
        const check = canExtend(daoIn('fire'), notDerivable);
        expect(check.permitted).toBe(false);
        expect(check.reason).toBe('not_extendable');
        expect(check.detail).toContain('one side of a conversation');
    });

    it('a leaning READS an immortal art and does not EXTEND one', () => {
        // `escapes.md`: "It should also fail loudly for `leaning`." This is the
        // distinction the whole route turns on.
        const check = canExtend(leaningIn('fire'), SCATTERED);
        expect(check.permitted).toBe(false);
        expect(check.reason).toBe('leaning_only');
        expect(check.requiredStanding).toBe('dao');
        expect(check.heldStanding).toBe('leaning');
    });

    it('refuses the wrong road in daoGate vocabulary, and does not imply depth would fix it', () => {
        const check = canExtend(daoIn('water'), SCATTERED);
        expect(check.reason).toBe('wrong_dao');
        expect(check.detail).toContain('no depth on this one ever will');
    });

    it('permits a full Dao on the manual\'s own road', () => {
        expect(canExtend(daoIn('fire'), SCATTERED).permitted).toBe(true);
    });

    it('refuses a manual that does not stop - there is no continuation to write', () => {
        const check = canExtend(daoIn('fire'), { ...SCATTERED, cap: null });
        expect(check.reason).toBe('nothing_above');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('E3 - writeNextStage: a manual gains a stage, it does not spawn a book', () => {
    // A well-walked height: plenty stands above the target, so the new-ground
    // curve sits at its floor and these tests measure everything else.
    const WELL_WALKED = { artsAtOrAbove: PRECEDENT_WELL_WALKED };

    const request = {
        runSeed: 'seed-alpha',
        cultivatorId: 'cultivator-1',
        source: SCATTERED,
        dao: daoIn('fire'),
        precedent: WELL_WALKED
    };

    it('carries exactly ONE RUNG further, not a realm and not to the top', () => {
        // A derived book is a step off a ceiling, not a leapfrog over the
        // corridor. Writing a realm's worth of method from your own road would
        // make derivation the best route in the game rather than the most
        // desperate one.
        const result = writeNextStage(request);
        expect(result.written).toBe(true);
        if (!result.written) return;
        // What comes out is a STAGE OF the source manual, not a second book.
        expect(result.stage.manualId).toBe(SCATTERED.id);
        expect(result.stage.number).toBe(stagesWrittenOf(SCATTERED) + 1);
        // And the manual it belongs to now reaches exactly one rung further.
        expect(result.newCap).toBe(42);
    });

    it('the step it buys never reaches the top of the ladder', () => {
        for (let sourceCap = 1; sourceCap < MAX_ORDINAL; sourceCap++) {
            const result = writeNextStage({
                ...request,
                source: { ...SCATTERED, requiredOrdinal: sourceCap - 1, cap: sourceCap }
            });
            if (!result.written) continue;
            expect(result.newCap, `from ${sourceCap}`).toBe(sourceCap + 1);
            expect(result.newCap).toBeLessThanOrEqual(MAX_ORDINAL);
        }
    });

    it('is deterministic in (seed, cultivator, source, road) and in nothing else', () => {
        // The founding rule. Same seed and input, identical result - including
        // the id, which is why `uuid()` draws from the stream rather than from
        // crypto. A cultivator who tries again gets the same book.
        expect(writeNextStage(request)).toEqual(writeNextStage(request));
        expect(writeNextStage({ ...request, runSeed: 'seed-beta' }))
            .not.toEqual(writeNextStage(request));
        expect(writeNextStage({ ...request, cultivatorId: 'other' }))
            .not.toEqual(writeNextStage(request));
    });

    it('is suited BY CONSTRUCTION, enforced at the gate rather than in the output', () => {
        // Under the stage model a stage has no element of its own - it belongs
        // to a manual that already has one. So "suited by construction" is now
        // a property of WHICH manuals can be extended: `daoMatches` refuses
        // every road but the manual's own, so the only stage anybody can write
        // is a stage of a book already on their road.
        //
        // That is a STRONGER guarantee than the old one. The old model let a
        // fire road produce a brand-new fire book out of a water source; this
        // one will not let them touch the water source at all.
        expect(writeNextStage(request).written).toBe(true);
        expect(writeNextStage({ ...request, dao: daoIn('water') }).written).toBe(false);
        expect(canExtend(daoIn('water'), SCATTERED, WELL_WALKED).reason).toBe('wrong_dao');
    });

    it('a road that is not an element extends the manual on that road', () => {
        const bodyRoad = daoIn('the meridians', 'body');
        const source: ExtendableManual = { ...SCATTERED, element: null, subjects: ['the meridians'] };
        const result = writeNextStage({ ...request, source, dao: bodyRoad });
        expect(result.written).toBe(true);
        if (!result.written) return;
        expect(result.stage.manualId).toBe(source.id);
    });

    it('prices the work in years, readable before it is committed', () => {
        const result = writeNextStage(request);
        // SCATTERED stops at 41, so the stage is written for 42 - Tribulation
        // Transcendence, whose realm grants 100,000 years. The price is the
        // rung's, not a flat figure: `derivationBaseYears` on well-walked ground.
        expect(result.written && result.years).toBe(Math.round(derivationBaseYears(42)));
        expect(result.written && result.years).toBeGreaterThan(DERIVATION_FLOOR_YEARS);
        // And it is not drawn from the stream: a price a player can only
        // discover by paying it is the same failure as a hidden ceiling.
        expect(writeNextStage({ ...request, runSeed: 'other-seed' }).years)
            .toBe(result.written ? result.years : 0);
    });

    it('comes out harder for anybody else to read than the book it continues', () => {
        // One person's working notes are not a house's polished canon. This is
        // the one thing the seeded stream decides, and it is a real consequence
        // rather than decoration.
        const result = writeNextStage(request);
        expect(result.written && result.stage.opacity).toBeGreaterThanOrEqual(0.35);
        expect(result.written && result.stage.opacity).toBeLessThanOrEqual(0.7);
    });

    it('records who wrote it, which is what makes a library a history', () => {
        // The field that lets a house hold stage 14 of something written four
        // hundred years ago by somebody whose name is on it - a fact this
        // column produces rather than one anybody authored.
        const result = writeNextStage(request);
        expect(result.written && result.stage.authorId).toBe('cultivator-1');
        expect(result.written && result.stage.manualId).toBe(SCATTERED.id);
    });

    it('a written stage is transmissible - it is not a private escape', () => {
        // "It can be passed on from master to student personally (or even
        // written down)." A stage somebody wrote is a stage like any other, so
        // nothing special-cases it: the manual's cap moved, and `canTransmit`
        // carries the manual as it always did. This asserts the ABSENCE of a
        // barrier, which is the whole of what the ruling asked for.
        const result = writeNextStage(request);
        expect(result.written).toBe(true);
        if (!result.written) return;
        expect(Object.keys(result.stage)).not.toContain('bound');
        expect(Object.keys(result.stage)).not.toContain('private');
        // The stage names its manual, so what gets taught is that manual now
        // reaching one rung further - not a separate secret book.
        expect(result.stage.manualId).toBe(SCATTERED.id);
        expect(result.line).toContain('it can be taught, or copied out');
    });

    it('returns the refusal rather than throwing, so one verb covers both', () => {
        const refused = writeNextStage({ ...request, dao: leaningIn('fire') });
        expect(refused.written).toBe(false);
        expect(refused.stage).toBeNull();
        expect(refused.years).toBe(0);
        expect(refused.line).toBe(refused.check.detail);
    });

    it('gets harder as you go up, because the ground is thinner', () => {
        // "Obviously it gets harder as you go up cuz you're on new ground."
        // Derived rather than tuned: the cost keys off how much stands at or
        // above the target, so it moves on its own as the catalog does.
        const walked = writeNextStage({ ...request, precedent: { artsAtOrAbove: 12 } });
        const thinning = writeNextStage({ ...request, precedent: { artsAtOrAbove: 4 } });
        const lonely = writeNextStage({ ...request, precedent: { artsAtOrAbove: 1 } });

        expect(walked.years).toBeLessThan(thinning.years);
        expect(thinning.years).toBeLessThan(lonely.years);
        // Well-walked ground pays the rung's base and nothing over it; at its
        // thinnest the ground doubles the work and never more than that.
        expect(walked.years).toBe(Math.round(derivationBaseYears(42)));
        expect(lonely.years).toBeLessThanOrEqual(walked.years * 2);
    });

    it('the years grow with the rung and the share of a life falls', () => {
        // THE RULING THIS CURVE ENCODES: *"constant has to move cuz techniques
        // get harder but you also have more time."* Both halves, asserted as
        // the two directions they are. A flat twelve years was 12% of a
        // mortal's whole life at the bottom and 0.12% of a Body Integration
        // cultivator's at the top, which is that ruling exactly inverted.
        //
        // Measured on well-walked ground, rung by realm:
        //
        //     ord  1  Qi Condensation             12 y    12%
        //     ord 13  Foundation Establishment    17 y   8.5%
        //     ord 17  Core Formation              27 y   5.4%
        //     ord 21  Nascent Soul                38 y   3.8%
        //     ord 25  Deity Transformation        54 y   2.7%
        //     ord 29  Void Tribulation            85 y   1.7%
        //     ord 33  Body Integration           120 y   1.2%
        //     ord 37  Grand Ascension            208 y  0.69%
        //     ord 41  Tribulation Transcendence  379 y  0.38%
        //     ord 45  Immortal                   657 y  0.22%
        //
        // The falling share is deliberate and is the second half of the ruling:
        // above the mortal realms a life stops being what is scarce. Where the
        // ground itself runs out the answer is `no_precedent`, which is a
        // refusal and not a price.
        const flat = { artsAtOrAbove: PRECEDENT_WELL_WALKED };
        const rungs = [1, 13, 17, 21, 25, 29, 33, 37, 41, 45];
        for (let i = 1; i < rungs.length; i++) {
            const below = rungs[i - 1];
            const here = rungs[i];
            expect(derivationYears(flat, here), `${below} -> ${here}`)
                .toBeGreaterThan(derivationYears(flat, below));
            expect(derivationShareOfALife(flat, here), `${below} -> ${here}`)
                .toBeLessThan(derivationShareOfALife(flat, below));
        }
        // And the bottom of the ladder did not move: twelve years of a
        // mortal's hundred, which is what the flat figure always was.
        expect(derivationYears(flat, 1)).toBe(DERIVATION_FLOOR_YEARS);
        expect(derivationShareOfALife(flat, 1))
            .toBeCloseTo(DERIVATION_LIFE_SHARE, 5);
    });

    it('refuses outright where nobody has ever been', () => {
        // The far end, and a refusal rather than a very large price - which is
        // what stops derivation being a general escape from the corridor.
        const check = canExtend(daoIn('fire'), SCATTERED, { artsAtOrAbove: 0 });
        expect(check.permitted).toBe(false);
        expect(check.reason).toBe('no_precedent');
        expect(check.detail).toContain('Nobody has been here');
        // And it must not read as a library being closed to them - that is a
        // different refusal with a different answer.
        expect(check.detail).toContain('not a library that is closed');
    });

    it('the curve introduces no new roll - trying again gets the same book', () => {
        // What changes between attempts is the cultivator, never the dice.
        for (const artsAtOrAbove of [0, 1, 4, 12]) {
            const precedent = { artsAtOrAbove };
            expect(writeNextStage({ ...request, precedent }))
                .toEqual(writeNextStage({ ...request, precedent }));
        }
    });

    it('the price is years and possibility, never resources', () => {
        // The moment difficulty becomes a resource cost this stops being the
        // one door money cannot open. Nothing in the result names a currency.
        const lonely = writeNextStage({ ...request, precedent: { artsAtOrAbove: 1 } });
        expect(lonely.written).toBe(true);
        expect(JSON.stringify(lonely).toLowerCase()).not.toContain('stone');
        expect(JSON.stringify(lonely).toLowerCase()).not.toContain('contribution');
    });

    /**
     * The manuals a derivation can actually compose against.
     *
     * Not simply every cultivation manual, and the exclusion is one row wide:
     * the four roads to the top of the ladder are held rather than circulated.
     * Each sits inside one of the four bodies at the top of the world, in one
     * or two copies, lent to somebody that body has already decided about and
     * returned afterwards. Nobody deriving in the wild has read one, so they
     * are not precedent for anybody's new ground - and counting them said the
     * opposite: adding them took the count at ordinal 37 from four to eight,
     * which is exactly `PRECEDENT_WELL_WALKED`, and the thinness at the top of
     * the corridor fell to zero. That would have made deriving at the choke
     * points cost the floor price, which is the hole this whole curve exists
     * to keep shut.
     *
     * `precedentAt` is passed a list of ordinals and does not know where any
     * of them lives, which is correct for an engine function - what counts as
     * precedent is a question about the world and belongs on this side of the
     * boundary. `precedentForTheRoadOf` in `src/web/writing-what-comes-next.ts`
     * is the verb layer's answer to the same question.
     */
    const READABLE_MANUAL_ORDINALS = TECHNIQUES
        .filter(t => !THE_DEEPEST_ROADS.some(r => r.techniqueId === t.id))
        .map(t => t.requiredOrdinal);

    it('reads the live catalog: the ground still thins near the top', () => {
        // Not a claim about a fixture - a measurement of the world as authored.
        const ordinals = READABLE_MANUAL_ORDINALS;
        const low = precedentAt(ordinals, 13);
        const high = precedentAt(ordinals, 37);
        expect(low.artsAtOrAbove).toBeGreaterThan(high.artsAtOrAbove);
        expect(thinnessAt(low)).toBe(0);
        // And it keeps thinning all the way up rather than flattening out.
        expect(precedentAt(ordinals, 45).artsAtOrAbove)
            .toBeLessThan(precedentAt(ordinals, 37).artsAtOrAbove);
    });

    it('the curve bites at every rung, which it did not', () => {
        // WHAT THIS TEST USED TO SAY, AND WHY IT CHANGED. It was called "A
        // FINDING FOR THE DESIGN OWNER: the difficulty curve is inert below the
        // top rung", and it asserted the defect rather than the rule - that at
        // least one of ordinals 13, 21, 29, 33, 37, 41 and 45 priced at zero
        // thinness. All seven did. It closed by saying the fix was a design
        // decision and deliberately did not clamp it. This is the decision.
        //
        // The finding it recorded stands, and the measurement is why: counting
        // arts at or above a rung over the whole catalog gives 157 at ordinal
        // 13, 44 at 33 and 23 at 45 against a `PRECEDENT_WELL_WALKED` of 8, so
        // thinness was zero everywhere below the summit and every derivation in
        // the game cost the same flat twelve years.
        //
        // Two things moved, and neither is `PRECEDENT_WELL_WALKED`:
        //
        //   THE BASE IS THE RUNG'S. `derivationYears` now takes the rung the
        //   stage is written FOR and prices the work as a share of the life
        //   that rung grants. See the rung-by-rung table on the sibling test
        //   above. That is the half of the ruling the old flat figure inverted.
        //
        //   PRECEDENT IS COUNTED OVER THE MANUAL'S OWN ROAD. "Cultivation
        //   manuals, not every art" stopped picking anything out when the
        //   catalog became one kind of art; the road is the cut that survived,
        //   and it is what the word means - a sword form is not precedent for
        //   somebody extending an alchemy canon. Over the median road: 15 arts
        //   at ordinal 13, 5 at 33, 2 at 45, 1 at 46. Live at every height.
        //
        // Asserted here on the whole-catalog count, which is the arm that went
        // inert: even with the widest possible denominator the price now rises
        // every realm, because the base does.
        const ordinals = READABLE_MANUAL_ORDINALS;
        const flat = [13, 21, 29, 33, 37, 41, 45];
        for (let i = 1; i < flat.length; i++) {
            expect(
                derivationYears(precedentAt(ordinals, flat[i]), flat[i]),
                `ordinal ${flat[i - 1]} -> ${flat[i]}`
            ).toBeGreaterThan(
                derivationYears(precedentAt(ordinals, flat[i - 1]), flat[i - 1])
            );
        }
        // And the top of the ladder is not the only rung that charges over the
        // floor, which is what "inert" meant.
        expect(derivationYears(precedentAt(ordinals, MAX_ORDINAL), MAX_ORDINAL))
            .toBeGreaterThan(DERIVATION_FLOOR_YEARS);
        expect(derivationYears(precedentAt(ordinals, 21), 21))
            .toBeGreaterThan(DERIVATION_FLOOR_YEARS);
    });

    it('X3 - derivation is not a hole-closer', () => {
        // The same discipline `NO_SURVIVING_COPY_TECHNIQUE_IDS` is held to. If
        // the derivable set ever grows to cover the choke points, the corridor
        // has been abolished rather than opened.
        const manuals = TECHNIQUES.slice();
        const derivable = manuals.filter(t => t.derivable);
        expect(derivable.length / manuals.length).toBeLessThan(0.25);
        // And specifically: a choke point above the middle of the ladder is
        // derivable only at a price that is most of a life. The corridor must
        // still be walked, and this used to be enforced as a flat ban on any
        // derivable at or above ordinal twenty-nine.
        //
        // THAT BAN PREDATED THE DIFFICULTY CURVE, and the curve is a better
        // instrument than the ban was. When derivation cost a flat twelve years
        // at every height, a high derivable genuinely was a hole-closer and the
        // only safe answer was to forbid it. Now the price is keyed to how much
        // precedent stands above the target - and above the middle of the
        // ladder there is almost none, so the same act costs a third to a half
        // of a mortal lifespan. That is not a hole in the corridor. It is the
        // second of two things a cultivator will regret: spend forty years
        // writing it yourself, or spend them looking for the one somebody else
        // already wrote.
        //
        // What the ban was protecting is protected better by asserting the
        // price, because a ban can be satisfied by a catalog with nothing at
        // those rungs at all - which is exactly the state that made the curve
        // inert. Note also `no_precedent`, which still closes the door
        // completely where nobody has ever stood: the expensive case and the
        // impossible case are different, and only one of them is a price.
        const priceOf = (manual: { requiredOrdinal: number }): number => {
            const above = READABLE_MANUAL_ORDINALS
                .filter(o => o >= manual.requiredOrdinal).length;
            return derivationYears({ artsAtOrAbove: above }, manual.requiredOrdinal);
        };
        const high = derivable.filter(m => m.requiredOrdinal >= 29);
        // THE PRICE HALF OF THIS GUARD IS BACK, and it is the one the section
        // header is about. It was removed when one-kind-of-art flattened the
        // curve: the two rows at or above 29 both priced at the flat floor, and
        // the note left here said so and called it the design owner's. With the
        // base keyed to the rung they price at multiples of it again, and the
        // guard asserts the multiple rather than a ban - a ban can be satisfied
        // by a catalog with nothing at those rungs at all, which is exactly the
        // state that made the curve inert.
        //
        // `no_precedent` is still the other half, and it is not a price: where
        // nobody has ever stood the door is shut rather than expensive.
        expect(high.length).toBeLessThanOrEqual(derivable.length);
        for (const m of high) {
            expect(priceOf(m), `${m.id} prices below the floor`)
                .toBeGreaterThan(DERIVATION_FLOOR_YEARS * 2);
        }
    });
});
