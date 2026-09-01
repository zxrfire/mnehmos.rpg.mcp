/**
 * What goes wrong at a realm boundary, and who it leaves standing.
 *
 * The design this pins: failure at a wall is not binary. The outcomes are
 * survivable and ruinous, they differ by which wall you are at, and they
 * produce a POPULATION - the maimed, the halted, the half mad, the ones who
 * burnt their span - rather than corpses.
 *
 * The assertions here are structural (which trial, which state, which
 * invariant). The population SHARES those rates produce are balance and live
 * in `crossing.test.ts`, which is deliberately a different file for the same
 * reason `ceiling.test.ts` is separate from it.
 */

import { describe, expect, it } from 'vitest';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import {
    ARRIVES_BROKEN_CHANCE,
    BROKEN_STATUSES,
    BROKEN_STATUS_FOR_TRIAL,
    CROSSING_OUTCOMES,
    HALTING_WOUND,
    brokenStatusFor,
    brokenStatusOf,
    brokenStatusRepairedBy,
    clearBrokenStatus,
    drawCrossingOutcome,
    isHalted,
    isRepairableInTheCrucible,
    outcomesForTrial,
    resolveCrossingFailure,
    rollArrivesBroken,
    trialForOrdinal
} from '../../../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import { getWoundType, isPermanentWound, woundNature, WOUND_TYPES } from '../../../src/data/cultivation/wounds.js';
import {
    bleedingInjuryCount,
    createInjury,
    treatWorstInjuries,
    untreatedInjuryCount
} from '../../../src/engine/cultivation/injuries.js';
import {
    brokenCombatPowerForOrdinal,
    combatPowerForOrdinal
} from '../../../src/engine/cultivation/combat.js';
import { isRealmBoundary, realmForOrdinal, MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';

const rng = () => new CultivationRNG('boundary-trials');

describe('which trial you face is decided by where you stand', () => {
    it('gives every realm boundary below the last realm its own trial', () => {
        const trials = new Set<string>();
        for (let ordinal = 0; ordinal < MAX_ORDINAL; ordinal++) {
            if (!isRealmBoundary(ordinal)) continue;
            const trial = trialForOrdinal(ordinal);
            expect(trial).not.toBe('none');
            if (trial !== 'heavenly_lightning') trials.add(trial);
        }
        // Seven walls below Tribulation Transcendence, seven distinct trials.
        // No two boundaries share one - that is the whole point of the table.
        expect(trials.size).toBe(7);
    });

    it('leaves the last realm to the lightning that is already authored', () => {
        // 40 -> 41 is the crossing in, 41-43 are the steps within, 44 is the
        // last crossing. All five are lightning and none consults this table.
        for (const ordinal of [40, 41, 42, 43, 44]) {
            expect(trialForOrdinal(ordinal)).toBe('heavenly_lightning');
        }
    });

    it('reads a sub-rank step as no trial at all', () => {
        for (const ordinal of [3, 14, 18, 22]) {
            expect(trialForOrdinal(ordinal)).toBe('none');
        }
    });

    it('takes an ordinal and nothing else', () => {
        // The contract `triggersHeavenlyTribulation` has, for the reason
        // `docs/world/manuals.md` gives: a manual cannot teach you the
        // crossing. If this ever grows a parameter, that rule has been broken.
        expect(trialForOrdinal.length).toBe(1);
    });
});

describe('the outcome registry carries new outcomes without touching boundaries', () => {
    it('keeps the weights on the outcome rather than on the trial', () => {
        // The shape that matters: a tenth outcome is one object appended here
        // with weights wherever it applies, and no boundary is edited at all.
        for (const outcome of CROSSING_OUTCOMES) {
            expect(typeof outcome.weights).toBe('object');
            expect(typeof outcome.apply).toBe('function');
        }
    });

    it('gives every authored trial a non-empty table', () => {
        for (const trial of Object.keys(BROKEN_STATUS_FOR_TRIAL)) {
            if (trial === 'heavenly_lightning') continue;
            expect(outcomesForTrial(trial as never).length).toBeGreaterThan(0);
        }
    });

    it('never draws an outcome for lightning or a sub-rank step', () => {
        expect(drawCrossingOutcome('heavenly_lightning', rng())).toBeNull();
        expect(drawCrossingOutcome('none', rng())).toBeNull();
    });

    it('escalates upward rather than making the low ladder brutal', () => {
        // The ruinous rows carry weight at the high walls and little or none at
        // the first one. Measured as the share of the table that is permanent.
        const ruinousShare = (trial: Parameters<typeof outcomesForTrial>[0]) => {
            const rows = outcomesForTrial(trial);
            const total = rows.reduce((s, r) => s + r.weight, 0);
            const ruinous = rows
                .filter(r => ['maimed', 'mad', 'half_mad', 'span_burnt', 'reservoir_ruined'].includes(r.outcome.key))
                .reduce((s, r) => s + r.weight, 0);
            return ruinous / total;
        };
        expect(ruinousShare('the_setting_of_the_foundation'))
            .toBeLessThan(ruinousShare('the_emptiness'));
        expect(ruinousShare('the_emptiness')).toBeLessThan(ruinousShare('the_ascent'));
    });

    it('returns deltas and never mutates the subject it is handed', () => {
        const injuries = [createInjury({ severity: 'minor', source: 'combat', turn: 1 }, rng())];
        const subject = { realmOrdinal: 28, injuries, foundationQuality: 'stable' as const, age: 900 };
        const before = JSON.stringify(subject);
        resolveCrossingFailure(subject, rng(), { turn: 5 });
        expect(JSON.stringify(subject)).toBe(before);
    });
});

describe('every outcome lands in state the rest of the engine already reads', () => {
    it('writes only fields that existed before this module did', () => {
        const allowed = new Set([
            'injuries', 'foundationQuality', 'yearsBurned',
            'soulState', 'identityContinuity', 'halted'
        ]);
        const subject = { realmOrdinal: 32, injuries: [], foundationQuality: 'stable' as const, age: 3000 };
        for (const outcome of CROSSING_OUTCOMES) {
            const consequence = outcome.apply(subject, rng(), { turn: 1 });
            for (const key of Object.keys(consequence)) {
                expect(allowed.has(key)).toBe(true);
            }
        }
    });

    it('burns years as a share of the span the rung grants, never a flat figure', () => {
        // Proportional for the same reason deviation's progress loss is: the
        // spans on this ladder run from 100 years to 100,000.
        const burn = CROSSING_OUTCOMES.find(o => o.key === 'span_burnt')!;
        const low = burn.apply({ realmOrdinal: 24, injuries: [] }, rng(), { turn: 1 });
        const high = burn.apply({ realmOrdinal: 36, injuries: [] }, rng(), { turn: 1 });
        expect(low.yearsBurned!).toBeGreaterThan(0);
        expect(high.yearsBurned!).toBeGreaterThan(low.yearsBurned!);
        // And it is a share of THIS rung's span, so it scales with the realm.
        expect(high.yearsBurned!).toBeLessThan(realmForOrdinal(36).lifespanYears);
    });

    it('mints madness as a mental wound in the same list as the physical ones', () => {
        const mad = CROSSING_OUTCOMES.find(o => o.key === 'mad')!;
        const out = mad.apply({ realmOrdinal: 36, injuries: [] }, rng(), { turn: 1 });
        // One list, two natures. A second list beside this one would be a list
        // nothing downstream reads.
        expect(woundNature(out.injuries[0].woundType)).toBe('mental');
        // Power intact, person gone: the soul and the continuity move, and the
        // ordinal does not.
        expect(out.soulState).toBe('fragmented');
        expect(out.identityContinuity!).toBeLessThan(0.5);
        expect(out.identityContinuity!).toBeGreaterThan(0);
    });

    it('leaves half madness functional and wrong rather than gone', () => {
        const half = CROSSING_OUTCOMES.find(o => o.key === 'half_mad')!;
        const out = half.apply({ realmOrdinal: 28, injuries: [] }, rng(), { turn: 1 });
        expect(out.identityContinuity!).toBeGreaterThan(0.5);
        expect(out.soulState).toBe('damaged');
    });
});

describe('the wound table', () => {
    it('authors every wound the outcome registry can mint', () => {
        const subject = { realmOrdinal: 32, injuries: [], foundationQuality: 'stable' as const };
        for (const outcome of CROSSING_OUTCOMES) {
            for (const injury of outcome.apply(subject, rng(), { turn: 1 }).injuries) {
                // A wound is a ROW, never a phrase. If this fails, something is
                // minting a wound the narrator would have to invent.
                expect(getWoundType(injury.woundType)).not.toBeNull();
            }
        }
    });

    it('takes its description from the table rather than composing one', () => {
        const injury = createInjury(
            { severity: 'crippling', source: 'qi_deviation', turn: 1, woundType: 'heart-demon-ascendant' },
            rng()
        );
        expect(injury.description).toBe(getWoundType('heart-demon-ascendant')!.description);
    });

    it('treats an unknown or absent key as an ordinary wound of its severity', () => {
        // Every row written before this table existed carries no key, and that
        // is a legitimate state rather than an error.
        expect(getWoundType(null)).toBeNull();
        expect(getWoundType('no-such-wound')).toBeNull();
        expect(woundNature(null)).toBe('physical');
        expect(isPermanentWound(null)).toBe(false);
    });

    it('says what would treat every wound, including where nothing does', () => {
        for (const wound of WOUND_TYPES) {
            expect(wound.treatment.length).toBeGreaterThan(39);
            expect(wound.presentation.length).toBeGreaterThan(79);
        }
    });
});

describe('permanent wounds cost forever and are not a bleed', () => {
    const permanent = () =>
        createInjury({ severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'severed-meridian' }, rng());

    it('keeps counting against cultivation and breakthrough', () => {
        expect(untreatedInjuryCount([permanent()])).toBe(1);
    });

    it('does not count toward the bleed-out clock', () => {
        // Three permanent wounds is a ruined person, not somebody with ninety
        // days to live. Counted the old way it was a death sentence.
        const wounds = [permanent(), permanent(), permanent()];
        expect(untreatedInjuryCount(wounds)).toBe(3);
        expect(bleedingInjuryCount(wounds)).toBe(0);
    });

    it('cannot be treated, however much is spent on it', () => {
        // The table says nothing closes these. Refusing it here rather than in
        // the callers is what makes that text true.
        const wounds = [permanent()];
        const healed = treatWorstInjuries(wounds, 10);
        expect(healed.treatedCount).toBe(0);
        expect(healed.injuries[0].treated).toBe(false);
    });
});

describe('a cultivator who crossed and can never cross again', () => {
    it('names a broken status for every wall, each after its own casualty', () => {
        for (let ordinal = 0; ordinal < 40; ordinal++) {
            if (!isRealmBoundary(ordinal)) continue;
            const status = brokenStatusFor(ordinal);
            expect(status).not.toBeNull();
            expect(getWoundType(status)).not.toBeNull();
        }
        // And the crossing INTO the last realm, which is lightning but still
        // leaves its own casualty.
        expect(brokenStatusFor(40)).toBe('broken-step');
    });

    it('is a status on top of a rung and never a rung of its own', () => {
        // The ladder keeps its rungs. Somebody who cracks going into
        // Tribulation Transcendence is at 41 carrying a broken step.
        const wound = createInjury(
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'broken-step' },
            rng()
        );
        expect(brokenStatusOf([wound])).toBe('broken-step');
        expect(isHalted({ injuries: [wound] })).toBe(true);
    });

    it('is never rolled at the first wall, where every run starts', () => {
        expect(ARRIVES_BROKEN_CHANCE.the_setting_of_the_foundation).toBe(0);
        for (let i = 0; i < 200; i++) {
            expect(rollArrivesBroken(12, new CultivationRNG(`first-wall-${i}`), 'damaged')).toBeNull();
        }
    });

    it('is made likelier by a bad foundation and rarer by a good one', () => {
        // Preparation buys the landing. The same statement the whole layer
        // already makes, applied to the moment it is cashed in.
        const count = (foundation: 'exceptional' | 'damaged') => {
            let broken = 0;
            for (let i = 0; i < 4000; i++) {
                if (rollArrivesBroken(36, new CultivationRNG(`land-${i}`), foundation)) broken++;
            }
            return broken;
        };
        expect(count('exceptional')).toBeLessThan(count('damaged'));
    });
});

describe('striking on a break is legal, suicidal, and curative if it lands', () => {
    it('is never refused by the engine', () => {
        // What stops people is the arithmetic, not a rule. A gate here would
        // make the decision the engine's rather than the player's.
        const wound = createInjury(
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'cracked-core' },
            rng()
        );
        expect(isHalted({ injuries: [wound] })).toBe(true);
        // isHalted is a reading, not a bar - the eligibility check has no
        // branch on it at all.
    });

    it('repairs a break below the last realm when the crossing lands', () => {
        const wound = createInjury(
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'cracked-core' },
            rng()
        );
        expect(brokenStatusRepairedBy([wound])).toBe('cracked-core');
        expect(clearBrokenStatus([wound], 'cracked-core')).toHaveLength(0);
    });

    it('never repairs a broken step, because medicine is barred at that rung', () => {
        // A rule rather than a shortage: getting to Tribulation Transcendence
        // is your own effort, so the one thing that would answer this is
        // forbidden exactly where it is needed.
        const wound = createInjury(
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'broken-step' },
            rng()
        );
        expect(isRepairableInTheCrucible('broken-step')).toBe(false);
        expect(brokenStatusRepairedBy([wound])).toBeNull();
    });

    it('declares an answer for every broken status', () => {
        for (const status of BROKEN_STATUSES) {
            expect(typeof isRepairableInTheCrucible(status)).toBe('boolean');
        }
    });

    it('drops a repaired wound rather than marking it treated', () => {
        // Marking it treated would leave it counting as scar tissue against
        // SCAR_PLATEAU - charging attrition for a wound no longer carried.
        const wound = createInjury(
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'open-seam' },
            rng()
        );
        const after = clearBrokenStatus([wound, createInjury({ severity: 'minor', source: 'combat', turn: 1 }, rng())], 'open-seam');
        expect(after).toHaveLength(1);
        expect(after[0].woundType).toBeNull();
    });
});

describe('a broken cultivator is the weakest thing at their rung', () => {
    it('sits below their own realm floor and above the realm below, at equal attributes', () => {
        // The ordering the design asks for: weaker than every other holder of
        // their rung, stronger than every holder of the rung below - so the
        // crossing was still worth making and "never attempt" is never right.
        for (const ordinal of [17, 21, 25, 29, 33, 37, 41]) {
            const tier = realmForOrdinal(ordinal);
            const broken = brokenCombatPowerForOrdinal(ordinal);
            const ownFloor = combatPowerForOrdinal(tier.ordinalStart);
            expect(broken).toBeLessThan(ownFloor);
            // And above the strongest rung of the realm below.
            expect(broken).toBeGreaterThan(combatPowerForOrdinal(tier.ordinalStart - 1));
        }
    });

    it('leaves the crossing worth making even when it goes wrong', () => {
        // A broken 41 outfights any 40 alive. If this inverted, the correct
        // play would become "never attempt", which the ladder must not have.
        expect(brokenCombatPowerForOrdinal(41)).toBeGreaterThan(combatPowerForOrdinal(40));
        expect(brokenCombatPowerForOrdinal(41)).toBeLessThan(combatPowerForOrdinal(41));
    });
});

describe('halting reads off the wound list and nowhere else', () => {
    it('is false for the unwounded and for ordinary wounds', () => {
        expect(isHalted({ injuries: [] })).toBe(false);
        expect(isHalted({ injuries: [createInjury({ severity: 'crippling', source: 'combat', turn: 1 }, rng())] }))
            .toBe(false);
    });

    it('is true for a ruined reservoir as well as for a broken status', () => {
        const ruined = createInjury(
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: HALTING_WOUND },
            rng()
        );
        expect(isHalted({ injuries: [ruined] })).toBe(true);
    });
});
