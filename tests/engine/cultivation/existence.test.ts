/**
 * Existence states.
 *
 * The two rules that stop this becoming automatic immortality, which would
 * wreck the game:
 *
 *   1. Nascent Soul is a GATE, not a grant. Below it, death is death.
 *   2. Survival is CONDITIONAL, never automatic. A powerful cultivator can
 *      still die permanently, and most do.
 *
 * Plus the one that stops it becoming incoherent: a remnant is not the person.
 */

import {
    CultivatorSchema,
    type ExistenceState
} from '../../../src/schema/cultivation.js';
import {
    MORTAL_EXISTENCE_STATES,
    NASCENT_SOUL_ORDINAL,
    PROFOUND_EXISTENCE_STATES,
    aliveFlagFor,
    canAct,
    canEnterExistenceState,
    hasBody,
    isGoingConcern,
    isTerminal,
    isTheSamePerson,
    makeRemnantContinuity,
    requiresNascentSoul,
    resolveBodilyDestruction
} from '../../../src/engine/cultivation/existence.js';
import { evaluateDeathConditions } from '../../../src/engine/cultivation/survival.js';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { makeCultivator, makeInjuries } from './fixtures.js';

const ALL_STATES: ExistenceState[] = [
    'alive', 'physically_dead', 'soul_preserved', 'remnant', 'sealed',
    'possessing', 'reincarnated', 'reconstructed', 'missing', 'unknown'
];

/** Everything arranged in advance: the best case, and still not a guarantee. */
const FULLY_PREPARED = {
    soulAnchor: true,
    technique: true,
    assistance: true,
    prepared: true
};

describe('the field set', () => {
    it('defaults an old row to an ordinary living person', () => {
        const legacy = CultivatorSchema.parse({
            id: 'legacy',
            name: 'Someone From Before',
            spiritRoot: 'single_water',
            attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
            hp: 30, maxHp: 30, qi: 10, maxQi: 10
        });
        expect(legacy.existenceState).toBe('alive');
        expect(legacy.soulState).toBe('intact');
        expect(legacy.identityContinuity).toBe(1);
        expect(legacy.bodyId).toBeNull();
        expect(legacy.alive).toBe(true);
    });

    it('classifies every state as mortal-available or Nascent-Soul-gated', () => {
        const covered = [...MORTAL_EXISTENCE_STATES, ...PROFOUND_EXISTENCE_STATES];
        expect(new Set(covered).size).toBe(ALL_STATES.length);
        for (const state of ALL_STATES) {
            expect(covered).toContain(state);
        }
    });

    it('has exactly one terminal state', () => {
        expect(ALL_STATES.filter(isTerminal)).toEqual(['physically_dead']);
    });

    it('treats missing and unknown as unresolved rather than dead', () => {
        // Correct answers, not placeholders. Someone who vanished in year 50
        // may be found sealed in year 4000 with their grudges intact.
        for (const state of ['missing', 'unknown'] as const) {
            expect(isTerminal(state)).toBe(false);
            expect(isGoingConcern(state)).toBe(true);
            expect(canAct(state)).toBe(false);
        }
    });

    it('keeps the alive flag derivable from the authoritative state', () => {
        for (const state of ALL_STATES) {
            expect(aliveFlagFor(state)).toBe(isGoingConcern(state));
        }
        expect(aliveFlagFor('physically_dead')).toBe(false);
        expect(aliveFlagFor('soul_preserved')).toBe(true);
    });

    it('separates having a body from being a going concern', () => {
        expect(isGoingConcern('soul_preserved')).toBe(true);
        expect(hasBody('soul_preserved')).toBe(false);
        expect(hasBody('possessing')).toBe(true);
        expect(canAct('sealed')).toBe(false);
        expect(isGoingConcern('sealed')).toBe(true);
    });
});

describe('Nascent Soul is the gate', () => {
    it('makes every profound state unreachable below it', () => {
        for (const state of PROFOUND_EXISTENCE_STATES) {
            expect(requiresNascentSoul(state)).toBe(true);
            for (let ordinal = 0; ordinal < NASCENT_SOUL_ORDINAL; ordinal++) {
                const check = canEnterExistenceState(
                    makeCultivator({ realmOrdinal: ordinal }),
                    state,
                    FULLY_PREPARED
                );
                expect(check.legal).toBe(false);
                expect(check.reason).toBe('below_nascent_soul');
            }
        }
    });

    it('leaves the mortal states available at every realm', () => {
        for (const state of MORTAL_EXISTENCE_STATES) {
            expect(requiresNascentSoul(state)).toBe(false);
            expect(canEnterExistenceState(makeCultivator({ realmOrdinal: 0 }), state).legal).toBe(true);
        }
    });

    it('makes the profound states possible above it, and nothing more', () => {
        const adept = makeCultivator({ realmOrdinal: NASCENT_SOUL_ORDINAL });
        // Possible with the conditions...
        expect(canEnterExistenceState(adept, 'soul_preserved', FULLY_PREPARED).legal).toBe(true);
        // ...and refused without them. Reaching the realm is not the same as
        // having arranged anything.
        const bare = canEnterExistenceState(adept, 'soul_preserved', {});
        expect(bare.legal).toBe(false);
        expect(bare.reason).toBe('no_soul_anchor');
    });

    it('requires a vessel for possession, however strong the soul', () => {
        const adept = makeCultivator({ realmOrdinal: 30 });
        expect(canEnterExistenceState(adept, 'possessing', FULLY_PREPARED).reason).toBe('no_vessel');
        expect(
            canEnterExistenceState(adept, 'possessing', { vesselId: 'body-1' }).legal
        ).toBe(true);
    });

    it('requires means and hands to rebuild a body', () => {
        const adept = makeCultivator({ realmOrdinal: 30 });
        expect(canEnterExistenceState(adept, 'reconstructed', { resources: true }).legal).toBe(false);
        expect(
            canEnterExistenceState(adept, 'reconstructed', { resources: true, assistance: true }).legal
        ).toBe(true);
    });

    it('refuses a fading soul any crossing but leaving a remnant behind', () => {
        const fading = makeCultivator({ realmOrdinal: 30, soulState: 'fading' });
        expect(canEnterExistenceState(fading, 'soul_preserved', FULLY_PREPARED).reason).toBe(
            'soul_too_weak'
        );
        expect(canEnterExistenceState(fading, 'remnant', FULLY_PREPARED).legal).toBe(true);
    });

    it('refuses anything at all once the identity has ended', () => {
        const gone = makeCultivator({ realmOrdinal: 30, existenceState: 'physically_dead' });
        expect(canEnterExistenceState(gone, 'soul_preserved', FULLY_PREPARED).reason).toBe(
            'already_terminal'
        );
    });
});

describe('surviving your own death', () => {
    function destroy(ordinal: number, requirements: Parameters<typeof resolveBodilyDestruction>[1], seed: string) {
        return resolveBodilyDestruction(
            makeCultivator({ realmOrdinal: ordinal }),
            requirements,
            forStream(seed, 'destruction', ordinal)
        );
    }

    it('is simply death below Nascent Soul, whatever was arranged', () => {
        for (let ordinal = 0; ordinal < NASCENT_SOUL_ORDINAL; ordinal++) {
            for (let i = 0; i < 20; i++) {
                const outcome = destroy(ordinal, { ...FULLY_PREPARED, vesselId: 'body-1' }, `low-${i}`);
                expect(outcome.state).toBe('physically_dead');
                expect(outcome.identityContinuity).toBe(0);
            }
        }
    });

    it('is death above it too when nothing was arranged', () => {
        for (let i = 0; i < 100; i++) {
            expect(destroy(30, {}, `bare-${i}`).state).toBe('physically_dead');
        }
    });

    it('is never automatic, even fully prepared', () => {
        let died = 0;
        let survived = 0;
        for (let i = 0; i < 400; i++) {
            const outcome = destroy(30, FULLY_PREPARED, `prepared-${i}`);
            if (outcome.state === 'physically_dead') died++;
            else survived++;
        }
        // Both branches real: a powerful cultivator can still die permanently.
        expect(died).toBeGreaterThan(0);
        expect(survived).toBeGreaterThan(0);
    });

    it('kills most of the unprepared-but-capable', () => {
        // "Most do." Only the base chance, no preparation, no help.
        let died = 0;
        const runs = 400;
        for (let i = 0; i < runs; i++) {
            if (destroy(30, { soulAnchor: true }, `thin-${i}`).state === 'physically_dead') died++;
        }
        expect(died / runs).toBeGreaterThan(0.5);
    });

    it('rewards preparation without ever guaranteeing anything', () => {
        const rate = (req: Parameters<typeof resolveBodilyDestruction>[1]) => {
            let survived = 0;
            for (let i = 0; i < 400; i++) {
                if (destroy(30, req, `cmp-${i}`).state !== 'physically_dead') survived++;
            }
            return survived / 400;
        };
        const bare = rate({ soulAnchor: true });
        const full = rate(FULLY_PREPARED);
        expect(full).toBeGreaterThan(bare);
        expect(full).toBeLessThan(1);
    });

    it('never returns the person whole', () => {
        let checked = 0;
        for (let i = 0; i < 400; i++) {
            const outcome = destroy(30, FULLY_PREPARED, `cost-${i}`);
            if (outcome.state === 'physically_dead') continue;
            checked++;
            expect(outcome.soulState).not.toBe('intact');
            expect(outcome.identityContinuity).toBeLessThan(1);
            expect(outcome.cultivationLost).toBeGreaterThan(0);
        }
        expect(checked).toBeGreaterThan(0);
    });

    it('routes into a prepared vessel when there is one, and records the body', () => {
        let possessed = null;
        for (let i = 0; i < 400 && possessed === null; i++) {
            const outcome = destroy(30, { ...FULLY_PREPARED, vesselId: 'body-7', vesselCompatibility: 1 }, `vessel-${i}`);
            if (outcome.state === 'possessing') possessed = outcome;
        }
        expect(possessed).not.toBeNull();
        expect(possessed!.bodyId).toBe('body-7');
    });

    it('makes an incompatible vessel worse than a compatible one', () => {
        const rate = (compat: number) => {
            let survived = 0;
            for (let i = 0; i < 400; i++) {
                const outcome = destroy(
                    30,
                    { ...FULLY_PREPARED, vesselId: 'body-1', vesselCompatibility: compat },
                    `compat-${i}`
                );
                if (outcome.state !== 'physically_dead') survived++;
            }
            return survived / 400;
        };
        expect(rate(1)).toBeGreaterThan(rate(0));
    });

    it('is worsened by a damaged soul and by untreated injuries', () => {
        const wounded = resolveBodilyDestruction(
            makeCultivator({ realmOrdinal: 30, soulState: 'fragmented', injuries: makeInjuries(4, 'crippling') }),
            FULLY_PREPARED,
            forStream('wounded', 'destruction', 30)
        );
        const clean = resolveBodilyDestruction(
            makeCultivator({ realmOrdinal: 30 }),
            FULLY_PREPARED,
            forStream('wounded', 'destruction', 30)
        );
        const chanceOf = (o: typeof clean) =>
            Number(/([\d.]+)%/.exec(o.factors.find(f => f.source === 'survival_chance')?.detail ?? '0%')![1]);
        expect(chanceOf(wounded)).toBeLessThan(chanceOf(clean));
    });

    it('consumes exactly two samples on every path', () => {
        const a = forStream('align', 'destruction', 1);
        const b = forStream('align', 'destruction', 1);
        destroy(0, {}, 'ignored');
        resolveBodilyDestruction(makeCultivator({ realmOrdinal: 0 }), {}, a);
        resolveBodilyDestruction(makeCultivator({ realmOrdinal: 30 }), FULLY_PREPARED, b);
        expect(a.next()).toBe(b.next());
    });

    it('shows its work', () => {
        const outcome = destroy(30, FULLY_PREPARED, 'itemised');
        expect(outcome.factors.length).toBeGreaterThan(0);
        expect(outcome.narrationHint.length).toBeGreaterThan(20);
    });
});

describe('a remnant is not the person', () => {
    it('caps remnant continuity well below a real identity', () => {
        expect(makeRemnantContinuity(1)).toBeLessThanOrEqual(0.35);
        expect(makeRemnantContinuity(0.1)).toBe(0.1);
    });

    it('reports a remnant as not the same person, however high its continuity', () => {
        // A remnant may say "I founded this sect" in perfect sincerity.
        const remnant = makeCultivator({
            existenceState: 'remnant',
            identityContinuity: 1
        });
        expect(isTheSamePerson(remnant)).toBe(false);
        expect(isGoingConcern('remnant')).toBe(false);
    });

    it('reports a soul that came through as still the person', () => {
        expect(isTheSamePerson(makeCultivator({ existenceState: 'soul_preserved', identityContinuity: 0.8 }))).toBe(true);
        expect(isTheSamePerson(makeCultivator({ existenceState: 'reincarnated', identityContinuity: 0.2 }))).toBe(false);
    });
});

describe('the death engine respects existence state', () => {
    it('does not starve or bleed a soul with no body', () => {
        const bodiless = makeCultivator({
            existenceState: 'soul_preserved',
            hp: 0,
            satiety: 0,
            starvationTurns: 99
        });
        expect(evaluateDeathConditions(bodiless)).toBeNull();
    });

    it("still applies the body's arithmetic to anyone who has one", () => {
        for (const state of ['alive', 'possessing', 'reconstructed', 'reincarnated'] as const) {
            expect(evaluateDeathConditions(makeCultivator({ existenceState: state, hp: 0 }))).toBe(
                'combat_defeat'
            );
        }
    });

    it('leaves an ended identity ended', () => {
        expect(
            evaluateDeathConditions(makeCultivator({ existenceState: 'physically_dead', hp: 0 }))
        ).toBeNull();
    });

    it('does not settle either kind of immortal', () => {
        // Neither is still climbing, so neither is standing still either.
        for (const status of ['false_immortal', 'true_immortal'] as const) {
            expect(
                evaluateDeathConditions(
                    makeCultivator({
                        realmOrdinal: 44,
                        immortalStatus: status,
                        yearsAtCurrentRealm: 5000,
                        age: 200
                    })
                )
            ).toBeNull();
        }
    });

    it('still ages a False Immortal to death, eventually', () => {
        // Vast, finite, and countable. That is the whole tragedy.
        const ancient = makeCultivator({
            realmOrdinal: 44,
            immortalStatus: 'false_immortal',
            age: 299999
        });
        expect(evaluateDeathConditions(ancient)).toBeNull();
        expect(
            evaluateDeathConditions(makeCultivator({
                realmOrdinal: 44,
                immortalStatus: 'false_immortal',
                age: 300000
            }))
        ).toBe('lifespan_exhausted');
    });

    it('never ages a True Immortal to death', () => {
        expect(
            evaluateDeathConditions(makeCultivator({
                realmOrdinal: 45,
                immortalStatus: 'true_immortal',
                age: 999999999
            }))
        ).toBeNull();
    });
});
