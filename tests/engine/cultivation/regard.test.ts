/**
 * Regard: the design guard for the one banded answer the world gives.
 *
 * These are pinned decisions, not coverage. The failure mode this whole module
 * exists to prevent is a world that answers everybody identically, so the
 * assertions here are mostly of the shape "at ordinal 5 and ordinal 45 this is
 * NOT the same number" - and they are written against the real catalogs rather
 * than against fixtures, because a catalog that drifts out of the bands is the
 * thing that would put the defect back.
 */

import { describe, it, expect } from 'vitest';
import {
    APPROACH_PRESSURE_LIMIT,
    REGARD_BANDS,
    type Approach
} from '../../../src/schema/cultivation.js';
import {
    apparentOrdinal,
    approachPressure,
    bandForGap,
    concealmentHolds,
    gateOrdinalOf,
    narrowToOffered,
    offeredTo,
    regardFor,
    regardOf
} from '../../../src/engine/cultivation/regard.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import {
    FORAGE_BASE_DAYS,
    HERBS,
    findHerbsForOrdinal,
    findOfferedHerbs,
    forage,
    rollHerb
} from '../../../src/data/cultivation/herbs.js';
import {
    MORTAL_WORK_CEILING_ORDINAL,
    OCCUPATIONS,
    OCCUPATION_REGARD_SPAN,
    findWorkForOrdinal,
    measuredMortalWorkCeiling,
    workExistingFor,
    workWithheldFrom
} from '../../../src/data/cultivation/mortal-world.js';
import {
    encounterDamage,
    encounterThreatRegard,
    requireEncounter
} from '../../../src/data/cultivation/encounters.js';

// ─────────────────────────────────────────────────────────────────────────
// THE TABLE
// ─────────────────────────────────────────────────────────────────────────

describe('the band table', () => {
    it('covers the whole integer line with disjoint, ascending windows', () => {
        expect(REGARD_BANDS[0].minGap).toBe(-Infinity);
        expect(REGARD_BANDS[REGARD_BANDS.length - 1].maxGap).toBe(Infinity);
        for (let i = 1; i < REGARD_BANDS.length; i++) {
            expect(REGARD_BANDS[i].minGap).toBe(REGARD_BANDS[i - 1].maxGap + 1);
        }
        // Every gap from far below to far above resolves to exactly one row.
        for (let gap = -60; gap <= 60; gap++) {
            const hits = REGARD_BANDS.filter(r => gap >= r.minGap && gap <= r.maxGap);
            expect(hits, `gap ${gap}`).toHaveLength(1);
        }
    });

    it('moves every multiplier monotonically as the asker rises', () => {
        for (let i = 1; i < REGARD_BANDS.length; i++) {
            const below = REGARD_BANDS[i - 1];
            const here = REGARD_BANDS[i];
            // Time, price and damage fall strictly. Yield only has to be
            // non-decreasing, because reaching past your own rung is priced in
            // time and risk rather than in a smaller take: `stretch` and
            // `matched` both come back with one of the thing.
            expect(here.yieldMultiplier, here.band).toBeGreaterThanOrEqual(below.yieldMultiplier);
            expect(here.durationMultiplier, here.band).toBeLessThan(below.durationMultiplier);
            expect(here.priceMultiplier, here.band).toBeLessThan(below.priceMultiplier);
            expect(here.damageMultiplier, here.band).toBeLessThan(below.damageMultiplier);
        }
        // From the asker's own rung upward the take does rise strictly, which
        // is the half the old world had none of.
        const fromMatched = REGARD_BANDS.slice(REGARD_BANDS.findIndex(r => r.band === 'matched'));
        for (let i = 1; i < fromMatched.length; i++) {
            expect(fromMatched[i].yieldMultiplier, fromMatched[i].band)
                .toBeGreaterThan(fromMatched[i - 1].yieldMultiplier);
        }
    });

    it('refuses at BOTH ends, and gives a reason at both', () => {
        // The half that existed - the ask is over their head.
        expect(bandForGap(-30)).toBe('unreachable');
        // The half that did not - the ask is beneath them, and silence is not
        // an acceptable way to say so.
        expect(bandForGap(30)).toBe('dismissed');

        for (const row of REGARD_BANDS) {
            expect(row.reaction.length, row.band).toBeGreaterThan(40);
            if (row.refused) expect(row.offered, row.band).toBe(false);
        }
        const refusing = REGARD_BANDS.filter(r => r.refused).map(r => r.band);
        expect(refusing).toEqual(['unreachable', 'dismissed']);
    });

    it('fills the reaction with the measured gap rather than leaving a token', () => {
        const dismissed = regardFor(0, 40);
        expect(dismissed.band).toBe('dismissed');
        expect(dismissed.reaction).not.toContain('{gap}');
        expect(dismissed.reaction).toContain('40');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE GATE
// ─────────────────────────────────────────────────────────────────────────

describe('the gate accessor', () => {
    it('reads whichever column a catalog happens to name its rung', () => {
        expect(gateOrdinalOf({ harvestOrdinal: 8 })).toBe(8);
        expect(gateOrdinalOf({ minOrdinal: 5 })).toBe(5);
        expect(gateOrdinalOf({ requiredOrdinal: 21 })).toBe(21);
        expect(gateOrdinalOf({ ordinal: 30 })).toBe(30);
        expect(gateOrdinalOf({ powerOrdinal: 37 })).toBe(37);
    });

    it('lets the generic column override the domain one', () => {
        expect(gateOrdinalOf({ minOrdinal: 0, regard: { gate: 33 } })).toBe(33);
    });

    it('answers null for a record that is not pitched at a rung, and that is matched', () => {
        expect(gateOrdinalOf({ name: 'a rock' })).toBeNull();
        const neutral = regardFor(null, 45);
        expect(neutral.band).toBe('matched');
        expect(neutral.yieldMultiplier).toBe(1);
        expect(neutral.durationMultiplier).toBe(1);
        expect(neutral.priceMultiplier).toBe(1);
        expect(neutral.damageMultiplier).toBe(1);
    });

    it('honours span, so a record can outlive its band without a rule', () => {
        const withoutSpan = regardFor(0, 40);
        const withSpan = regardFor(0, 40, { span: 4 });
        expect(withoutSpan.band).toBe('dismissed');
        expect(withSpan.band).toBe('beneath');
        expect(withSpan.offered).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE APPROACH
// ─────────────────────────────────────────────────────────────────────────

describe('what the narrator may hand over', () => {
    it('defaults to exactly the old behaviour when nothing is supplied', () => {
        const bare = regardFor(10, 20);
        const empty = regardFor(10, { ordinal: 20, approach: {} });
        expect(empty.band).toBe(bare.band);
        expect(empty.gap).toBe(bare.gap);
        expect(empty.pressure).toBe(0);
        expect(empty.concealed).toBe(false);
    });

    it('never lets tone and leverage move more than two rungs', () => {
        const most: Approach = { tone: 'threatening', leverage: 'force' };
        const least: Approach = { tone: 'deferential', leverage: 'none' };
        expect(approachPressure(most)).toBe(APPROACH_PRESSURE_LIMIT);
        expect(approachPressure(least)).toBe(-1);
        expect(Math.abs(approachPressure(most))).toBeLessThanOrEqual(APPROACH_PRESSURE_LIMIT);
    });

    it('lets a concealed rung hold when nobody present can read it', () => {
        const alone: Approach = { concealed: true, presentedAs: 2, audience: 'alone' };
        expect(concealmentHolds(45, alone)).toBe(true);
        expect(apparentOrdinal(45, alone)).toBe(2);
    });

    it('does not let it hold in front of people who can', () => {
        for (const audience of ['peers', 'superiors', 'enemies'] as const) {
            const seen: Approach = { concealed: true, presentedAs: 2, audience };
            expect(concealmentHolds(45, seen), audience).toBe(false);
            expect(apparentOrdinal(45, seen), audience).toBe(45);
        }
        const witnessed: Approach = { concealed: true, presentedAs: 2, audience: 'crowd', witnessOrdinal: 45 };
        expect(concealmentHolds(45, witnessed)).toBe(false);
    });

    it('meets the room as the apparent rung and the ground as the real one', () => {
        // The whole design in one assertion. A False Immortal walking a market
        // as a nobody is offered a nobody's work, and does it like a False
        // Immortal, because the sacks do not care what the room believes.
        const disguised = regardFor(0, {
            ordinal: 45,
            approach: { concealed: true, presentedAs: 3, audience: 'crowd' }
        });
        expect(disguised.band).toBe('matched');        // how the room meets them
        expect(disguised.physicalBand).toBe('dismissed'); // what the work is to them
        expect(disguised.offered).toBe(true);
        expect(disguised.priceMultiplier).toBe(1);      // charged like anybody
        expect(disguised.yieldMultiplier).toBeGreaterThan(10);
        expect(disguised.damageMultiplier).toBe(0);
    });

    it('cannot move the physical band at all, however hard it is pushed', () => {
        const shoved = regardFor(20, {
            ordinal: 5,
            approach: { tone: 'threatening', leverage: 'force', patience: 'unhurried' }
        });
        // Two rungs of pressure change how they are met and nothing about the
        // gap the ground reads.
        expect(shoved.gap).toBe(-15);
        expect(shoved.physicalBand).toBe('unreachable');
        expect(shoved.socialGap).toBe(-13);
    });

    it('echoes intent and note back untouched, and never acts on them', () => {
        const carried = regardFor(0, {
            ordinal: 10,
            approach: { intent: 'I want the good root, not the roadside stuff', note: 'raining' }
        });
        expect(carried.intent).toBe('I want the good root, not the roadside stuff');
        expect(carried.note).toBe('raining');
        // Same band as the same ask with no words attached.
        expect(carried.band).toBe(regardFor(0, 10).band);
    });

    it('prices patience into both the time and the take, together', () => {
        const hurried = regardFor(0, { ordinal: 0, approach: { patience: 'hurried' } });
        const unhurried = regardFor(0, { ordinal: 0, approach: { patience: 'unhurried' } });
        expect(hurried.durationMultiplier).toBeLessThan(unhurried.durationMultiplier);
        expect(hurried.yieldMultiplier).toBeLessThan(unhurried.yieldMultiplier);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE CATALOGS - the measurements the whole exercise was about
// ─────────────────────────────────────────────────────────────────────────

describe('the ground answers by height', () => {
    const SAMPLE = 0.05;

    it('gives a beginner one stalk over a full week', () => {
        const low = forage(0, SAMPLE);
        expect(low.herb).not.toBeNull();
        expect(low.quantity).toBe(1);
        expect(low.days).toBe(FORAGE_BASE_DAYS);
        expect(low.regard!.physicalBand).toBe('matched');
    });

    it('gives the same sentence a different answer at 5, 25 and 45', () => {
        const at5 = forage(5, SAMPLE);
        const at25 = forage(25, SAMPLE);
        const at45 = forage(45, SAMPLE);

        // The defect, stated as an assertion: these must not be the same row.
        expect(new Set([at5.herb!.id, at25.herb!.id, at45.herb!.id]).size).toBe(3);
        // And the quantity and the duration must move too, which is the half
        // that never moved before.
        expect(at5.quantity).toBeGreaterThan(1);
        expect(at25.quantity).toBeGreaterThan(at5.quantity);
        expect(at5.days).toBeLessThan(FORAGE_BASE_DAYS);
        expect(at25.days).toBeLessThan(at5.days);
        expect(at45.herb!.grade).toBe('immortal');
        expect(at5.herb!.grade).toBe('mortal');
    });

    it('stops offering ground the asker has outgrown, and says how much', () => {
        const reachable = findHerbsForOrdinal(45);
        const offered = findOfferedHerbs(45);
        expect(offered.length).toBeGreaterThan(0);
        expect(offered.length).toBeLessThan(reachable.length);
        // No qi grass in a False Immortal's afternoon.
        expect(offered.some(h => h.id === 'herb-qi-grass')).toBe(false);
        expect(reachable.some(h => h.id === 'herb-qi-grass')).toBe(true);
    });

    it('never draws something the asker cannot survive standing near', () => {
        for (const ordinal of [0, 5, 13, 21, 33, 45]) {
            for (const sample of [0.01, 0.2, 0.5, 0.8, 0.99]) {
                const herb = rollHerb(ordinal, sample);
                if (!herb) continue;
                expect(herb.harvestOrdinal, `${ordinal}/${sample}`).toBeLessThanOrEqual(ordinal);
            }
        }
    });

    it('still answers when everything reachable is beneath them', () => {
        // A biome whose whole stock is far below a high cultivator must not
        // come back empty. Refusing to answer would be a worse lie than a weed.
        const roadside = HERBS.filter(h => h.biome === 'roadside');
        expect(roadside.length).toBeGreaterThan(0);
        expect(offeredTo(roadside, MAX_ORDINAL)).toHaveLength(0);
        expect(narrowToOffered(roadside, MAX_ORDINAL)).toHaveLength(roadside.length);
        expect(rollHerb(MAX_ORDINAL, 0.5, 'roadside')).toBeDefined();
    });
});

describe('the boards answer by height', () => {
    it('offers a beginner mortal work and nothing above their head', () => {
        const offered = findWorkForOrdinal(0);
        expect(offered.length).toBeGreaterThan(0);
        for (const job of offered) expect(job.minOrdinal).toBeLessThanOrEqual(0);
    });

    it('stops putting a porter\'s job to somebody far past it, with a reason', () => {
        const withheld = workWithheldFrom(30);
        const porter = withheld.find(w => w.occupation.id === 'job-porter');
        expect(porter, 'a porter\'s job is withheld at ordinal 30').toBeDefined();
        expect(porter!.band).toBe('dismissed');
        expect(porter!.reason.length).toBeGreaterThan(40);
    });

    it('is NOT worse at height, which is the bug this replaces', () => {
        // The measured defect: ordinals 0 and 13 got offers and everything from
        // 21 upward got "nobody here is hiring anyone, for anything".
        for (const ordinal of [0, 5, 13, 21, 25, 33, 45]) {
            expect(findWorkForOrdinal(ordinal).length, `ordinal ${ordinal}`).toBeGreaterThan(0);
        }
    });

    it('offers a Tribulation Transcendence cultivator something entirely different', () => {
        const low = findWorkForOrdinal(5).map(o => o.id);
        const high = findWorkForOrdinal(45).map(o => o.id);
        expect(low.length).toBeGreaterThan(0);
        expect(high.length).toBeGreaterThan(0);
        // Disjoint: not one thing on the beginner's board is on theirs.
        expect(high.filter(id => low.includes(id))).toHaveLength(0);
    });

    it('keeps the commissions in the same table as the farmhand', () => {
        // No parallel catalog. One array, one schema, one resolver.
        const ids = new Set(OCCUPATIONS.map(o => o.id));
        expect(ids.has('job-farmhand')).toBe(true);
        expect(ids.has('job-lid-assay')).toBe(true);
        expect(OCCUPATIONS.every(o => o.regard !== undefined)).toBe(true);
    });

    it('derives the mortal ceiling instead of asserting it', () => {
        expect(measuredMortalWorkCeiling()).toBe(MORTAL_WORK_CEILING_ORDINAL);
        expect(OCCUPATION_REGARD_SPAN).toBeGreaterThan(1);
    });

    it('never offers work whose floor is above the asker', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            for (const job of findWorkForOrdinal(ordinal)) {
                expect(job.minOrdinal, `${job.id} at ${ordinal}`).toBeLessThanOrEqual(ordinal);
            }
        }
    });

    it('accounts for every job that exists here: offered plus withheld', () => {
        for (const ordinal of [0, 13, 21, 33, 45]) {
            const exists = workExistingFor(ordinal).length;
            expect(findWorkForOrdinal(ordinal).length + workWithheldFrom(ordinal).length)
                .toBe(exists);
        }
    });
});

describe('what a fight costs answers by height', () => {
    it('prices roadside bandits differently at every rung', () => {
        const bandits = requireEncounter('enc-roadside-bandits');
        const base = 40;
        const low = encounterDamage(bandits, base, 0);
        const mid = encounterDamage(bandits, base, 10);
        const high = encounterDamage(bandits, base, 45);
        expect(low).toBeGreaterThan(mid);
        expect(mid).toBeGreaterThan(high);
        expect(high).toBe(0);
    });

    it('makes a four-rank gap a death rather than a hard fight', () => {
        const bandits = requireEncounter('enc-roadside-bandits');
        const outmatched = encounterThreatRegard(bandits, 0)!;
        expect(outmatched.gap).toBe(-2);
        // Somebody eight rungs under the threat takes triple.
        const wayUnder = regardFor(12, 4);
        expect(wayUnder.band).toBe('overmatched');
        expect(wayUnder.damageMultiplier).toBeGreaterThan(2);
    });

    it('answers null rather than a multiplier when nothing is hostile', () => {
        const deviation = requireEncounter('enc-qi-deviation-onset');
        expect(deviation.threatOrdinal).toBeNull();
        expect(encounterThreatRegard(deviation, 20)).toBeNull();
        expect(encounterDamage(deviation, 30, 20)).toBe(30);
    });

    it('keeps the never-outgrown entries live at the top of the ladder', () => {
        for (const id of ['enc-qi-deviation-onset', 'enc-thin-qi-stagnation']) {
            const entry = requireEncounter(id);
            expect(entry.regard?.span, id).toBeGreaterThan(1);
            expect(regardOf(entry, MAX_ORDINAL).offered, id).toBe(true);
        }
    });
});
