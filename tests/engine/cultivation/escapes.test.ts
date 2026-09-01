/**
 * Design guards for the escape routes.
 *
 * These are not coverage. Each one pins a sentence from `docs/world/escapes.md`
 * that would be quietly false if somebody changed the code around it, and
 * several of them are here specifically because the property they assert is
 * invisible in play until it is already broken.
 */

import { describe, it, expect } from 'vitest';

import {
    canDerive,
    deriveContinuation,
    effectiveCapOf,
    manualDaoRequirement,
    manualGate,
    openingPenalty,
    ordinaryCapFor,
    realmsSpannedBy,
    spanStanding,
    ORDINARY_REALM_SPAN,
    DERIVATION_YEARS_PER_RUNG,
    PRECEDENT_WELL_WALKED,
    DERIVATION_THINNESS_COST,
    precedentAt,
    thinnessAt,
    derivationYears,
    type DerivableManual,
    type GatedManual
} from '../../../src/engine/cultivation/escapes.js';
import {
    computeCultivationRate,
    techniqueExhausted
} from '../../../src/engine/cultivation/cultivation.js';
import { MAX_ORDINAL, realmForOrdinal } from '../../../src/engine/cultivation/realms.js';
import { daoGate, daoOf } from '../../../src/engine/cultivation/dao.js';
import { shardPower } from '../../../src/engine/world/possessions.js';
import { TECHNIQUES, classOf } from '../../../src/data/cultivation/techniques.js';
import type { AmbientQi, Cultivator, Insight } from '../../../src/schema/cultivation.js';

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

function insight(subject: string, domain: Insight['domain'], degree: number): Insight {
    return {
        id: `i-${domain}-${subject}-${degree}`,
        domain,
        subject,
        degree,
        provenance: 'earned'
    } as Insight;
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

const SCATTERED: GatedManual & DerivableManual = {
    id: 'scattered-canon',
    name: 'A Scattered Canon',
    requiredOrdinal: 37,
    cap: 41,
    volumes: ['vol-one', 'vol-two', 'vol-three'],
    grade: 'chaos',
    element: 'fire',
    subject: 'fire',
    category: 'cultivation',
    derivable: true
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
        const manuals = TECHNIQUES.filter(t => classOf(t) === 'cultivation');
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
        for (const manual of TECHNIQUES.filter(t => classOf(t) === 'cultivation')) {
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
        expect(effectiveCapOf(SCATTERED, []).cap).toBe(38);
    });

    it('is shardPower and not a second piece of the same arithmetic', () => {
        // The handover's standing instruction: there must be ONE function in
        // the repo that says a piece is worth less than the whole. If this
        // stops agreeing with `shardPower`, a second one has been written.
        let expected: number | null = SCATTERED.cap;
        for (const missing of [1, 2, 3]) {
            expected = shardPower(expected);
            const held = SCATTERED.volumes!.slice(0, 3 - missing);
            expect(effectiveCapOf(SCATTERED, held).cap).toBe(expected);
        }
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
        for (const manual of TECHNIQUES.filter(t => classOf(t) === 'cultivation')) {
            const requirement = manualDaoRequirement({
                id: manual.id,
                name: manual.name,
                requiredOrdinal: manual.requiredOrdinal,
                cap: manual.cap,
                grade: manual.grade,
                element: manual.element,
                subject: null,
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
            grade: 'earth', element: null, subject: null, category: 'cultivation'
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
            for (const manual of TECHNIQUES.filter(t => classOf(t) === 'cultivation')) {
                const gated = {
                    id: manual.id, name: manual.name,
                    requiredOrdinal: manual.requiredOrdinal, cap: manual.cap,
                    grade: manual.grade, element: manual.element,
                    subject: null, category: manual.category,
                    domain: manual.domain, domainDegree: manual.domainDegree
                };
                const mine = manualGate(road, gated);
                const preExisting = daoGate(road, {
                    grade: manual.grade,
                    element: manual.element,
                    subject: null,
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
            grade: 'mortal', element: 'fire', subject: 'fire', category: 'cultivation'
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
            grade: 'mortal', element: 'fire', subject: 'fire', category: 'cultivation'
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
            grade: 'mortal', element: 'fire', subject: 'fire', category: 'cultivation'
        };
        expect(manualGate(daoIn('water'), wide).reason).toBe('wrong_dao');
        expect(manualGate(daoIn('fire'), wide).permitted).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the opening is uphill - the price of a wide book', () => {
    const wide = { requiredOrdinal: 13, cap: 21 };

    it('is 1 for every ORDINARY manual in the catalog - the common case is untouched', () => {
        for (const manual of TECHNIQUES.filter(t => classOf(t) === 'cultivation')) {
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
        const treasure = TECHNIQUES.find(t => t.opening !== null && classOf(t) === 'cultivation');
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
        const notDerivable: DerivableManual = {
            ...SCATTERED,
            derivable: false,
            notDerivableReason: 'It is a transcript of one side of a conversation.'
        };
        const check = canDerive(daoIn('fire'), notDerivable);
        expect(check.permitted).toBe(false);
        expect(check.reason).toBe('not_derivable');
        expect(check.detail).toContain('one side of a conversation');
    });

    it('a leaning READS an immortal art and does not EXTEND one', () => {
        // `escapes.md`: "It should also fail loudly for `leaning`." This is the
        // distinction the whole route turns on.
        const check = canDerive(leaningIn('fire'), SCATTERED);
        expect(check.permitted).toBe(false);
        expect(check.reason).toBe('leaning_only');
        expect(check.requiredStanding).toBe('dao');
        expect(check.heldStanding).toBe('leaning');
    });

    it('refuses the wrong road in daoGate vocabulary, and does not imply depth would fix it', () => {
        const check = canDerive(daoIn('water'), SCATTERED);
        expect(check.reason).toBe('wrong_dao');
        expect(check.detail).toContain('no depth on this one ever will');
    });

    it('permits a full Dao on the manual\'s own road', () => {
        expect(canDerive(daoIn('fire'), SCATTERED).permitted).toBe(true);
    });

    it('refuses a manual that does not stop - there is no continuation to write', () => {
        const check = canDerive(daoIn('fire'), { ...SCATTERED, cap: null });
        expect(check.reason).toBe('nothing_above');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('E3 - deriveContinuation, the one thing that writes a manual at runtime', () => {
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
        const result = deriveContinuation(request);
        expect(result.derived).toBe(true);
        if (!result.derived) return;
        expect(result.manual.requiredOrdinal).toBe(41);
        expect(result.manual.cap).toBe(42);
        expect(realmsSpannedBy(result.manual)).toBe(ORDINARY_REALM_SPAN);
    });

    it('the step it buys never reaches the top of the ladder', () => {
        for (let sourceCap = 1; sourceCap < MAX_ORDINAL; sourceCap++) {
            const result = deriveContinuation({
                ...request,
                source: { ...SCATTERED, requiredOrdinal: sourceCap - 1, cap: sourceCap }
            });
            if (!result.derived) continue;
            expect(result.manual.cap, `from ${sourceCap}`).toBe(sourceCap + 1);
            expect(result.manual.cap).toBeLessThanOrEqual(MAX_ORDINAL);
        }
    });

    it('is deterministic in (seed, cultivator, source, road) and in nothing else', () => {
        // The founding rule. Same seed and input, identical result - including
        // the id, which is why `uuid()` draws from the stream rather than from
        // crypto. A cultivator who tries again gets the same book.
        expect(deriveContinuation(request)).toEqual(deriveContinuation(request));
        expect(deriveContinuation({ ...request, runSeed: 'seed-beta' }))
            .not.toEqual(deriveContinuation(request));
        expect(deriveContinuation({ ...request, cultivatorId: 'other' }))
            .not.toEqual(deriveContinuation(request));
    });

    it('is suited BY CONSTRUCTION - the element is the deriver\'s own road', () => {
        // This is what makes derivation legitimately bypass the 0.2 suitability
        // draw, and it is precisely what makes it the one door money cannot
        // open. A found book might be for somebody else; a written one cannot.
        const fire = deriveContinuation(request);
        expect(fire.derived && fire.manual.element).toBe('fire');

        const water = deriveContinuation({ ...request, dao: daoIn('water') });
        // The wrong road cannot derive this manual at all, which is the point.
        expect(water.derived).toBe(false);
    });

    it('a road that is not an element yields an elementless method any root may work', () => {
        const bodyRoad = daoIn('the meridians', 'body');
        const source: DerivableManual = { ...SCATTERED, element: null, subject: 'the meridians' };
        const result = deriveContinuation({ ...request, source, dao: bodyRoad });
        expect(result.derived).toBe(true);
        if (!result.derived) return;
        expect(result.manual.element).toBeNull();
    });

    it('prices the work in years, readable before it is committed', () => {
        const result = deriveContinuation(request);
        expect(result.derived && result.years).toBe(DERIVATION_YEARS_PER_RUNG);
        // And it is not drawn from the stream: a price a player can only
        // discover by paying it is the same failure as a hidden ceiling.
        expect(deriveContinuation({ ...request, runSeed: 'other-seed' }).years)
            .toBe(result.derived ? result.years : 0);
    });

    it('comes out harder for anybody else to read than the book it continues', () => {
        // One person's working notes are not a house's polished canon. This is
        // the one thing the seeded stream decides, and it is a real consequence
        // rather than decoration.
        const result = deriveContinuation(request);
        expect(result.derived && result.manual.opacity).toBeGreaterThanOrEqual(0.35);
        expect(result.derived && result.manual.opacity).toBeLessThanOrEqual(0.7);
    });

    it('carries a provenance of its own and does not pretend to be found', () => {
        const result = deriveContinuation(request);
        expect(result.derived && result.manual.provenance).toBe('derived');
        expect(result.derived && result.manual.sourceNote).toContain('nobody');
    });

    it('returns the refusal rather than throwing, so one verb covers both', () => {
        const refused = deriveContinuation({ ...request, dao: leaningIn('fire') });
        expect(refused.derived).toBe(false);
        expect(refused.manual).toBeNull();
        expect(refused.years).toBe(0);
        expect(refused.line).toBe(refused.check.detail);
    });

    it('gets harder as you go up, because the ground is thinner', () => {
        // "Obviously it gets harder as you go up cuz you're on new ground."
        // Derived rather than tuned: the cost keys off how much the world holds
        // at or above the target, so it moves on its own as the catalog does.
        const walked = deriveContinuation({ ...request, precedent: { artsAtOrAbove: 12 } });
        const thinning = deriveContinuation({ ...request, precedent: { artsAtOrAbove: 4 } });
        const lonely = deriveContinuation({ ...request, precedent: { artsAtOrAbove: 1 } });

        expect(walked.years).toBeLessThan(thinning.years);
        expect(thinning.years).toBeLessThan(lonely.years);
        // Low down it is a long project; near the top it is most of a life.
        expect(walked.years).toBe(DERIVATION_YEARS_PER_RUNG);
        expect(lonely.years).toBeGreaterThan(DERIVATION_YEARS_PER_RUNG * 4);
    });

    it('refuses outright where nobody has ever been', () => {
        // The far end, and a refusal rather than a very large price - which is
        // what stops derivation being a general escape from the corridor.
        const check = canDerive(daoIn('fire'), SCATTERED, { artsAtOrAbove: 0 });
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
            expect(deriveContinuation({ ...request, precedent }))
                .toEqual(deriveContinuation({ ...request, precedent }));
        }
    });

    it('the price is years and possibility, never resources', () => {
        // The moment difficulty becomes a resource cost this stops being the
        // one door money cannot open. Nothing in the result names a currency.
        const lonely = deriveContinuation({ ...request, precedent: { artsAtOrAbove: 1 } });
        expect(lonely.derived).toBe(true);
        expect(JSON.stringify(lonely).toLowerCase()).not.toContain('stone');
        expect(JSON.stringify(lonely).toLowerCase()).not.toContain('contribution');
    });

    it('reads the live catalog: the ground genuinely thins near the top', () => {
        // Not a claim about a fixture - a measurement of the world as authored.
        // If this inverts, the corridor has been widened at the top and
        // derivation there has quietly become cheap.
        // Cultivation manuals, not every art - see `precedentAt`. Counting dao
        // arts too leaves 13 standing at rung 44 and the curve inert
        // everywhere, which is how a diluted denominator hides a real scarcity.
        const ordinals = TECHNIQUES
            .filter(t => classOf(t) === 'cultivation')
            .map(t => t.requiredOrdinal);
        const low = precedentAt(ordinals, 13);
        const high = precedentAt(ordinals, 37);
        expect(low.artsAtOrAbove).toBeGreaterThan(high.artsAtOrAbove);
        expect(thinnessAt(low)).toBe(0);
        expect(thinnessAt(high)).toBeGreaterThan(0);
        expect(derivationYears(low)).toBeLessThan(derivationYears(high));
        // And it keeps thinning all the way up rather than flattening out.
        expect(precedentAt(ordinals, 45).artsAtOrAbove)
            .toBeLessThan(precedentAt(ordinals, 37).artsAtOrAbove);
    });

    it('X3 - derivation is not a hole-closer', () => {
        // The same discipline `NO_SURVIVING_COPY_TECHNIQUE_IDS` is held to. If
        // the derivable set ever grows to cover the choke points, the corridor
        // has been abolished rather than opened.
        const manuals = TECHNIQUES.filter(t => classOf(t) === 'cultivation');
        const derivable = manuals.filter(t => t.derivable);
        expect(derivable.length / manuals.length).toBeLessThan(0.25);
        // And specifically: no choke point above the middle of the ladder is
        // derivable. The corridor must still be walked.
        for (const manual of derivable) {
            expect(manual.requiredOrdinal, `${manual.id} is a high derivable`).toBeLessThan(29);
        }
    });
});
