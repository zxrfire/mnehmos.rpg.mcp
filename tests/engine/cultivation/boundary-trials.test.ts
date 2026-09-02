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
    applyCrossingConsequence,
    blocksAdvancement,
    brokenStatusFor,
    brokenStatusOf,
    brokenStatusRepairedBy,
    classifyCrossingResult,
    clearBrokenStatus,
    CROSSING_RESULTS,
    getCrossingResult,
    drawCrossingOutcome,
    isHalted,
    isRepairableInTheCrucible,
    outcomesForTrial,
    resolveCrossingFailure,
    rollArrivesBroken,
    structuralBlockOn,
    trialForOrdinal
} from '../../../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';
import {
    getWoundType,
    isPermanentWound,
    RETIRED_WOUND_KEYS,
    woundNature,
    WOUND_TYPES
} from '../../../src/data/cultivation/wounds.js';
import {
    bleedingInjuryCount,
    createInjury,
    treatWorstInjuries,
    untreatedInjuryCount
} from '../../../src/engine/cultivation/injuries.js';
import {
    assessPower,
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
                .filter(r => ['maimed', 'mad', 'half_mad', 'span_burnt', 'cultivation_left_incomplete'].includes(r.outcome.key))
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
            'soulStateFloor', 'identityContinuityFactor', 'halted'
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
        expect(out.soulStateFloor).toBe('fragmented');
        expect(out.identityContinuityFactor!).toBeLessThan(0.5);
        expect(out.identityContinuityFactor!).toBeGreaterThan(0);
    });

    it('leaves half madness functional and wrong rather than gone', () => {
        const half = CROSSING_OUTCOMES.find(o => o.key === 'half_mad')!;
        const out = half.apply({ realmOrdinal: 28, injuries: [] }, rng(), { turn: 1 });
        expect(out.identityContinuityFactor!).toBeGreaterThan(0.5);
        expect(out.soulStateFloor).toBe('damaged');
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
            { severity: 'crippling', source: 'qi_deviation', turn: 1, woundType: 'ascendant-heart-demon' },
            rng()
        );
        expect(injury.description).toBe(getWoundType('ascendant-heart-demon')!.description);
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

    it('says CORE, and never the borrowed word', () => {
        // The design owner's ruling. It is pinned here rather than left to
        // review because the word crept into ten files once already, and a
        // vocabulary rule nothing checks is a vocabulary rule that comes back.
        for (const wound of WOUND_TYPES) {
            const text = `${wound.key} ${wound.name} ${wound.description} ${wound.treatment} ${wound.presentation}`;
            expect(text.toLowerCase()).not.toContain('dantian');
        }
    });

    it('keeps exactly one core wound, and it is the broken status', () => {
        // 'A ruined dantian' sat beside 'A cracked core' as a second wound to
        // the same organ, and the borrowed word was the only thing telling them
        // apart. One organ, one wound. See RETIRED_WOUND_KEYS.
        const core = WOUND_TYPES.filter(w => w.key.includes('core'));
        expect(core.map(w => w.key)).toEqual(['cracked-core']);
        expect(BROKEN_STATUSES).toContain('cracked-core');
    });

    it('still reads a saved row carrying a retired key', () => {
        // `woundType` is a nullable string on a persisted row and worlds are in
        // flight, so a key that shipped does not stop existing when the catalog
        // drops it. Without this, those rows come back nameless and are priced
        // as an ordinary wound of their severity - which is a silent downgrade
        // of a permanent one.
        const row = getWoundType('ruined-dantian');
        expect(row).not.toBeNull();
        expect(row!.key).toBe('incomplete-cultivation');
        expect(isPermanentWound('ruined-dantian')).toBe(true);
        expect(woundNature('ruined-dantian')).toBe('physical');
    });

    it('resolves a retired key to a wound that behaves identically', () => {
        // A RENAME AND NEVER A RECLASSIFICATION. If a retirement ever changed
        // permanence, nature or whether the wound halts, loading a saved world
        // would change what its people are carrying. In particular it must not
        // resolve to 'cracked-core', however plainly the ruling reads as one
        // wound: that would halt a saved population the ladder never refused.
        for (const [retired, current] of Object.entries(RETIRED_WOUND_KEYS)) {
            const now = getWoundType(current)!;
            expect(now).toBeDefined();
            expect(isPermanentWound(retired)).toBe(isPermanentWound(current));
            expect(woundNature(retired)).toBe(woundNature(current));
            expect(BROKEN_STATUSES).not.toContain(current);
            const injury = createInjury(
                { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: retired },
                rng()
            );
            expect(blocksAdvancement(injury)).toBe(false);
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
        expect(brokenStatusFor(40)).toBe('unformed-tribulation-body');
    });

    it('is a status on top of a rung and never a rung of its own', () => {
        // The ladder keeps its rungs. Somebody who cracks going into
        // Tribulation Transcendence is at 41 carrying a broken step.
        const wound = createInjury(
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'unformed-tribulation-body' },
            rng()
        );
        expect(brokenStatusOf([wound])).toBe('unformed-tribulation-body');
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
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'unformed-tribulation-body' },
            rng()
        );
        expect(isRepairableInTheCrucible('unformed-tribulation-body')).toBe(false);
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
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'unstable-joining' },
            rng()
        );
        const after = clearBrokenStatus([wound, createInjury({ severity: 'minor', source: 'combat', turn: 1 }, rng())], 'unstable-joining');
        expect(after).toHaveLength(1);
        expect(after[0].woundType).toBeNull();
    });
});

describe('what the broken statuses are called', () => {
    // ── The rule ──────────────────────────────────────────────────────────
    //
    // A break is named for what THAT realm's crossing was trying to build, and
    // a term belonging to one realm may never appear in another's name. The
    // defect this pins is reuse across realms: "a shattered foundation" was
    // being minted at six walls that build no foundation, so a Body Integration
    // cultivator could come out of the joining carrying a Foundation
    // Establishment word. The foundation is not what that realm was
    // constructing.
    //
    // It is the same principle as the earlier rejection of "a spoiled temper"
    // for "damaged spirit sense": name the failure of the specific formation,
    // never a mood or a metaphor.

    /** The term each realm owns. It may appear in that realm's break and nowhere else. */
    const OWNED_TERM: Record<string, string[]> = {
        foundation_establishment: ['foundation'],
        core_formation: ['core'],
        nascent_soul: ['nascent', 'soul'],
        deity_transformation: ['transformation'],
        void_refinement: ['spirit', 'sense'],
        body_integration: ['joining'],
        grand_ascension: ['ascension'],
        tribulation_transcendence: ['tribulation']
    };

    const slug = (name: string) =>
        name.replace(/^(a|an|the)\s+/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    it('names every break for its own realm and borrows nothing from another', () => {
        for (const ordinal of [13, 17, 21, 25, 29, 33, 37, 41]) {
            const realmKey = realmForOrdinal(ordinal).key;
            const status = brokenStatusFor(ordinal - 1)!;
            const row = getWoundType(status)!;
            const words = row.name.toLowerCase();

            // It says what this realm was building.
            expect(OWNED_TERM[realmKey].some(term => words.includes(term))).toBe(true);

            // And nothing another realm owns.
            for (const [otherRealm, terms] of Object.entries(OWNED_TERM)) {
                if (otherRealm === realmKey) continue;
                for (const term of terms) {
                    if (OWNED_TERM[realmKey].includes(term)) continue;
                    expect(words).not.toContain(term);
                }
            }
        }
    });

    it('keeps no realm term anywhere else in the catalog', () => {
        // The leak was not in a break at all - it was in an ORDINARY wound that
        // several realms mint. A wound that is not a break must borrow nobody's
        // term, because it can be handed out anywhere on the ladder.
        const breakKeys = new Set(BROKEN_STATUSES);
        const owned = Object.values(OWNED_TERM).flat();
        for (const row of WOUND_TYPES) {
            if (breakKeys.has(row.key)) continue;
            for (const term of owned) {
                expect(row.name.toLowerCase()).not.toContain(term);
            }
        }
    });

    it('derives every id from what the row prints, so the two cannot drift', () => {
        for (const row of WOUND_TYPES) {
            expect(row.key).toBe(slug(row.name));
        }
    });
});

describe('the five ways a crossing ends', () => {
    it('names all five and every kind has an authored row', () => {
        expect(CROSSING_RESULTS).toHaveLength(5);
        for (const row of CROSSING_RESULTS) {
            expect(getCrossingResult(row.kind)).toBe(row);
        }
    });

    it('separates a broken success from a bad failure, which is the distinction that matters', () => {
        const hurt = [createInjury({ severity: 'serious', source: 'failed_breakthrough', turn: 1 }, rng())];
        expect(classifyCrossingResult({ succeeded: true, survived: true })).toBe('clean_success');
        expect(classifyCrossingResult({ succeeded: true, survived: true, injuriesSustained: hurt }))
            .toBe('clean_success');
        expect(classifyCrossingResult({ succeeded: true, survived: true, brokenStatus: 'cracked-core' }))
            .toBe('broken_success');
        expect(classifyCrossingResult({ succeeded: false, survived: true })).toBe('clean_failure');
        expect(classifyCrossingResult({ succeeded: false, survived: true, injuriesSustained: hurt }))
            .toBe('failure_with_sequelae');
        expect(classifyCrossingResult({ succeeded: false, survived: false })).toBe('death');
    });

    it('closes a road ONLY through a realm keyword, and never through a failure', () => {
        // The rule, in the user's words: anything not of those keywords does
        // not block further cultivation. So halted and broken are the SAME set,
        // and a failure never halts anybody however grave the wound.
        const wound = (key: string) =>
            createInjury(
                { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: key },
                rng()
            );

        // The one route in: a realm's own break, from a broken SUCCESS.
        expect(isHalted({ injuries: [wound('cracked-core')] })).toBe(true);

        // The worst wound the FAILURE table can produce. It leaves the
        // cultivation base permanently unfinished and it still does not close
        // the road - this row set `halted: true` until the rule was stated.
        const reservoir = CROSSING_OUTCOMES.find(o => o.key === 'cultivation_left_incomplete')!;
        const consequence = reservoir.apply({ realmOrdinal: 16, injuries: [] }, rng(), { turn: 1 });
        expect(consequence.halted).toBeUndefined();
        expect(isHalted({ injuries: consequence.injuries })).toBe(false);
        expect(brokenStatusOf(consequence.injuries)).toBeNull();

        // And no row in the whole failure table halts, by the same rule.
        for (const outcome of CROSSING_OUTCOMES) {
            for (let i = 0; i < 20; i++) {
                const c = outcome.apply(
                    { realmOrdinal: 20, injuries: [], age: 200 },
                    new CultivationRNG(`no-halt-${outcome.key}-${i}`),
                    { turn: 1 }
                );
                expect(c.halted).toBeFalsy();
                expect(isHalted({ injuries: c.injuries })).toBe(false);
            }
        }
    });

    it('lets the gravest wound of every kind keep climbing', () => {
        // The user's worked examples: a heart demon would not block you, nor
        // does losing an arm. A heart demon afflicts the PERSON; a cracked core
        // is a fault in the apparatus the next crossing builds on. Builders
        // work hurt.
        //
        // Asserted against `blocksAdvancement`, which is what
        // `canAttemptBreakthrough` actually consults - not against a predicate
        // that could disagree with the bar.
        const gravest = [
            'ascendant-heart-demon',  // mental, permanent, the worst there is
            'rooted-heart-demon',
            'severed-meridian',       // physical and permanent - the lost arm
            'incomplete-cultivation', // the base itself, never finished
            'burnt-span',             // lifespan
            'scattered-cultivation'   // the whole base came apart
        ];
        for (const key of gravest) {
            const injury = createInjury(
                { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: key },
                rng()
            );
            expect(blocksAdvancement(injury)).toBe(false);
            expect(isHalted({ injuries: [injury] })).toBe(false);
            expect(structuralBlockOn([injury])).toBeNull();
        }
    });

    it('lets somebody cross carrying a heart demon, in code and not only in prose', () => {
        // The path has to be OPEN, not merely undocumented as closed.
        const demon = createInjury(
            { severity: 'serious', source: 'qi_deviation', turn: 1, woundType: 'heart-demon' },
            rng()
        );
        const cracked = createInjury(
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'cracked-core' },
            rng()
        );
        expect(structuralBlockOn([demon])).toBeNull();
        // And the break beside it is what stops them, so the demon is not
        // merely being masked by an empty list.
        expect(structuralBlockOn([demon, cracked])).toBe('cracked-core');
    });

    it('produces a structural break ONLY from a broken success', () => {
        // The load-bearing claim of the taxonomy. Somebody who fails badly is
        // hurt and structurally intact at the rung they set out from - they are
        // NOT a broken version of the rung below, because the structure that
        // would have broken was never built. So no row in the FAILURE registry
        // may mint a wound from BROKEN_STATUSES, at any trial, ever.
        for (const outcome of CROSSING_OUTCOMES) {
            for (const trial of Object.keys(outcome.weights) as (keyof typeof outcome.weights)[]) {
                // Drawn many times, because several rows roll their own severity
                // and one of them could in principle branch on it.
                for (let i = 0; i < 40; i++) {
                    const consequence = outcome.apply(
                        { realmOrdinal: 20, injuries: [], age: 200 },
                        new CultivationRNG(`no-break-from-failure-${outcome.key}-${trial}-${i}`),
                        { turn: 1 }
                    );
                    for (const injury of consequence.injuries) {
                        expect(BROKEN_STATUSES).not.toContain(injury.woundType);
                    }
                }
            }
        }
    });
});

describe('how strong a broken cultivator is', () => {
    // ── What is being pinned, and what deliberately is not ────────────────
    //
    // The ordering that binds is ONE-SIDED. A broken holder must beat every
    // intact holder of the realm below, must lose to a typical holder of their
    // own rung, and MAY beat a weak one - the last is wanted rather than
    // tolerated, because a cracked core who has been fighting for a century
    // should be dangerous to somebody who formed their core last year.
    //
    // The strict two-sided version is unsatisfiable and the arithmetic is in
    // `BROKEN_STATUS_POWER`: the window between realms is x2.000 and a strict
    // fit needs x2.299. Do not reinstate it.
    //
    // Measured by `scripts/probe-how-strong-a-broken-cultivator-is.ts`.

    /** Every legal attribute pair. `rollAttributes` is uniform over these. */
    const ATTRIBUTES: Array<{ might: number; insight: number }> = [];
    for (let might = 1; might <= 3; might++) {
        for (let insight = 1; insight <= 4; insight++) ATTRIBUTES.push({ might, insight });
    }

    /** Identical in every respect except the ordinal, the attributes and the wound. */
    const price = (
        ordinal: number,
        might: number,
        insight: number,
        injuries: ReturnType<typeof createInjury>[] = []
    ): number =>
        assessPower(
            {
                id: 'x',
                name: 'x',
                realmOrdinal: ordinal,
                spiritRoot: 'single_fire',
                attributes: { might, insight, fortune: 1, charm: 2 },
                injuries,
                hp: 100,
                maxHp: 100,
                qi: 50,
                maxQi: 50,
                battlesSurvived: 10,
                technique: null
            },
            { ambient: 'normal' }
        ).total;

    const break_ = (status: string) =>
        createInjury(
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: status },
            rng()
        );

    const REALMS = [13, 17, 21, 25, 29, 33, 37, 41];

    it('beats every intact holder of the realm below, from any rung and at any attributes', () => {
        // The one hard requirement, and the reason the crossing stays worth
        // attempting when it goes wrong: if this inverted, "never attempt"
        // would become the correct play.
        //
        // Swept over the full cross product rather than at the median, because
        // a flat penalty passes at the median and fails here - which is exactly
        // how it went unnoticed. Worst margin measured at x1.088.
        for (const floor of REALMS) {
            const tier = realmForOrdinal(floor);
            const wound = break_(brokenStatusFor(floor - 1)!);
            const belowTier = realmForOrdinal(floor - 1);
            for (let o = tier.ordinalStart; o <= tier.ordinalEnd; o++) {
                for (const b of ATTRIBUTES) {
                    const broken = price(o, b.might, b.insight, [wound]);
                    for (let io = belowTier.ordinalStart; io <= belowTier.ordinalEnd; io++) {
                        for (const i of ATTRIBUTES) {
                            expect(broken).toBeGreaterThan(price(io, i.might, i.insight));
                        }
                    }
                }
            }
        }
    });

    it('loses to an ordinary holder of their own rung whatever attributes they were dealt', () => {
        // The break being real. The best attributes in the world do not lift a
        // broken holder past a median intact peer - measured at 0.840 against
        // 1.000 - so the break is never something a good roll cancels.
        for (const floor of REALMS) {
            const wound = break_(brokenStatusFor(floor - 1)!);
            const median = price(floor, 2, 2);
            for (const b of ATTRIBUTES) {
                expect(price(floor, b.might, b.insight, [wound])).toBeLessThan(median);
            }
        }
    });

    it('can be overturned by a weak peer, which is wanted', () => {
        // Not a defect and not an accident. A broken holder with the best
        // attributes prices above an intact peer with the worst, and this test
        // exists so that a future tightening has to argue with it rather than
        // silently remove it.
        for (const floor of REALMS) {
            const wound = break_(brokenStatusFor(floor - 1)!);
            expect(price(floor, 3, 4, [wound])).toBeGreaterThan(price(floor, 1, 1));
        }
    });

    it('is stronger for the sub-ranks it climbs, because nothing stops it climbing them', () => {
        // `blocksAdvancement` gates realm boundaries and not sub-rank steps, and
        // the wound rows describe somebody forty years into being extremely
        // good at the rung they are on. That has to be worth something.
        for (const floor of REALMS) {
            const tier = realmForOrdinal(floor);
            const wound = break_(brokenStatusFor(floor - 1)!);
            expect(price(tier.ordinalEnd, 2, 2, [wound]))
                .toBeGreaterThan(price(tier.ordinalStart, 2, 2, [wound]));
        }
    });

    it('charges the break once, not once here and again through the condition line', () => {
        // The break is held out of `aggregateInjuryPenalties` inside
        // `assessPower` because the `broken` line is what it costs in a fight.
        // Charged in both places it would compound to x0.563 against a declared
        // x0.750, which puts a broken holder BELOW the realm under them.
        for (const floor of REALMS) {
            const wound = break_(brokenStatusFor(floor - 1)!);
            const ratio = price(floor, 2, 2, [wound]) / price(floor, 2, 2);
            expect(ratio).toBeCloseTo(brokenCombatPowerForOrdinal(floor) / combatPowerForOrdinal(floor), 6);
        }
    });

    it('leaves the crossing worth making even when it goes wrong', () => {
        // A broken 41 outfights any 40 alive.
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

    it('is true for a realm break and for nothing else', () => {
        const broken = createInjury(
            { severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType: 'unstable-joining' },
            rng()
        );
        expect(isHalted({ injuries: [broken] })).toBe(true);
        // Treated is not carried: a break the crucible reseated stops halting.
        expect(isHalted({ injuries: [{ ...broken, treated: true }] })).toBe(false);
    });
});

describe('ruin compounds and never restores', () => {
    it('takes the worse soul state rather than assigning the new one', () => {
        // The bug this replaced: going mad and then going half mad UPGRADED the
        // soul from fragmented back to damaged, so the more times the world
        // broke somebody the more intact they got.
        const self = { soulState: 'fragmented' as const, identityContinuity: 0.35, age: 100 };
        const after = applyCrossingConsequence(self, { injuries: [], soulStateFloor: 'damaged' });
        expect(after.soulState).toBe('fragmented');
    });

    it('still worsens a soul that is currently better', () => {
        const self = { soulState: 'intact' as const, identityContinuity: 1, age: 100 };
        expect(applyCrossingConsequence(self, { injuries: [], soulStateFloor: 'damaged' }).soulState)
            .toBe('damaged');
    });

    it('multiplies identity continuity rather than assigning it', () => {
        // Two Severings at 0.75 leave 56%, not 75%.
        let self = { soulState: 'intact' as const, identityContinuity: 1, age: 100 };
        self = applyCrossingConsequence(self, { injuries: [], identityContinuityFactor: 0.75 }) as typeof self;
        expect(self.identityContinuity).toBeCloseTo(0.75, 5);
        self = applyCrossingConsequence(self, { injuries: [], identityContinuityFactor: 0.75 }) as typeof self;
        expect(self.identityContinuity).toBeCloseTo(0.5625, 5);
    });

    it('adds burnt years rather than setting an age', () => {
        let self = { soulState: 'intact' as const, identityContinuity: 1, age: 500 };
        self = applyCrossingConsequence(self, { injuries: [], yearsBurned: 200 }) as typeof self;
        self = applyCrossingConsequence(self, { injuries: [], yearsBurned: 200 }) as typeof self;
        expect(self.age).toBe(900);
    });

    it('leaves everything untouched when the outcome says nothing about it', () => {
        const self = { soulState: 'damaged' as const, identityContinuity: 0.6, age: 100 };
        expect(applyCrossingConsequence(self, { injuries: [] })).toEqual(self);
    });
});

describe('which wounds travel up the ladder and which stop you', () => {
    const wound = (woundType: string) =>
        createInjury({ severity: 'crippling', source: 'failed_breakthrough', turn: 1, woundType }, rng());

    it('lets mental and ordinary physical wounds cross with you', () => {
        // A heart demon is carried up the ladder and may even be shed on the
        // way. What it does is make everything harder, not stop the build.
        for (const key of ['heart-demon', 'rooted-heart-demon', 'severed-meridian', 'burnt-span', 'torn-meridians']) {
            expect(blocksAdvancement(wound(key))).toBe(false);
        }
    });

    it('stops you on a cracked structure, because the next thing will not build', () => {
        // Mechanical rather than punitive: a core does not form on a cracked
        // foundation, the same way it cannot form before one exists.
        for (const key of BROKEN_STATUSES) {
            expect(blocksAdvancement(wound(key))).toBe(true);
        }
    });

    it('reports which structural break is doing the stopping', () => {
        expect(structuralBlockOn([wound('heart-demon'), wound('cracked-core')])).toBe('cracked-core');
        expect(structuralBlockOn([wound('heart-demon')])).toBeNull();
    });
});
