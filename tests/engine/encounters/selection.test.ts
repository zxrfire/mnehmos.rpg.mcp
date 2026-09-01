/**
 * Design guards on WHAT can happen, as opposed to what did.
 *
 * Every assertion here is about the shape of the pool rather than the result of
 * a roll, which is the difference between testing a system and testing a seed.
 * If one of these fails, a decision was made about the world - not a number was
 * unlucky.
 */

import { describe, expect, it } from 'vitest';
import {
    ENCOUNTER_ACTIVITIES,
    encounterPool,
    interruptsThrough,
    outgrown,
    placeRateMultiplier,
    poolDirections,
    valenceOf,
    type EncounterActivity,
    type EncounterPlace
} from '../../../src/engine/encounters/index.js';
import { ENCOUNTERS, requireEncounter } from '../../../src/data/cultivation/encounters.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';

const road: EncounterPlace = { id: 'p', name: 'the low road', kind: 'wilds', danger: 0.45 };
const village: EncounterPlace = { id: 'v', name: 'Sweptground', kind: 'settlement', danger: 0.2 };
const cave: EncounterPlace = { id: 'c', name: 'a cave', kind: 'cave', danger: 0.3 };
const ruin: EncounterPlace = { id: 'r', name: 'a collapsed compound', kind: 'ruin', danger: 0.6 };

/**
 * The bands the catalog itself says are different in kind. Above the Lid the
 * entries stop being windfalls and wounds - they are offices, errands with a
 * fuse, and lines on registers - so the both-directions guard does not apply
 * and saying so here is more honest than bending the classifier to fit.
 */
const BELOW_THE_LID = 44;

describe('the pool', () => {
    it('is never empty anywhere on the ladder', () => {
        for (let ordinal = 0; ordinal <= MAX_ORDINAL; ordinal++) {
            const pool = encounterPool({ ordinal, activity: 'travel', place: road });
            expect(pool.length, `nothing can happen to a cultivator at ordinal ${ordinal}`)
                .toBeGreaterThan(0);
        }
    });

    it('offers both directions at every rung below the Lid', () => {
        for (let ordinal = 0; ordinal <= BELOW_THE_LID; ordinal++) {
            // The union of what an ordinary life is spent doing. A single
            // activity may legitimately be one-sided - a market is mostly good
            // news - but a whole life must not be.
            const merged = { good: 0, neutral: 0, bad: 0 };
            for (const activity of ['travel', 'abroad', 'gathering'] as EncounterActivity[]) {
                const place = activity === 'abroad' ? village : road;
                const d = poolDirections(encounterPool({ ordinal, activity, place }));
                merged.good += d.good;
                merged.neutral += d.neutral;
                merged.bad += d.bad;
            }
            const total = merged.good + merged.neutral + merged.bad;
            expect(merged.good / total, `no good news at ordinal ${ordinal}`).toBeGreaterThan(0.15);
            expect(merged.bad / total, `nothing goes wrong at ordinal ${ordinal}`).toBeGreaterThan(0.15);
        }
    });

    it('drops what a cultivator has outgrown', () => {
        // Roadside bandits are pitched at the bottom of the ladder and stop
        // being put in front of anybody a long way past it. Nothing in the
        // engine names them; `regard.ts` does it by arithmetic.
        expect(outgrown(requireEncounter('enc-roadside-bandits'), 0)).toBe(false);
        expect(outgrown(requireEncounter('enc-roadside-bandits'), 30)).toBe(true);

        const low = encounterPool({ ordinal: 1, activity: 'travel', place: road });
        const high = encounterPool({ ordinal: 30, activity: 'travel', place: road });
        expect(low.some(r => r.entry.id === 'enc-roadside-bandits')).toBe(true);
        expect(high.some(r => r.entry.id === 'enc-roadside-bandits')).toBe(false);
    });

    it('honours the window each entry states for itself', () => {
        for (const ordinal of [0, 5, 12, 22, 33, 45, 46]) {
            for (const row of encounterPool({ ordinal, activity: 'travel', place: road })) {
                expect(row.entry.minOrdinal).toBeLessThanOrEqual(ordinal);
                expect(row.entry.maxOrdinal).toBeGreaterThanOrEqual(ordinal);
            }
        }
    });

    it('changes composition with the place, not just the rate', () => {
        const inVillage = weightByKind(encounterPool({ ordinal: 8, activity: 'abroad', place: village }));
        const inRuin = weightByKind(encounterPool({ ordinal: 8, activity: 'gathering', place: ruin }));

        expect(share(inVillage, 'commerce')).toBeGreaterThan(share(inRuin, 'commerce'));
        expect(share(inRuin, 'ruin')).toBeGreaterThan(share(inVillage, 'ruin'));
        expect(share(inVillage, 'dao_house')).toBeGreaterThan(share(inRuin, 'dao_house'));
    });

    it('keeps danger a shallow multiplier on the rate', () => {
        // Danger should change WHAT happens far more than HOW OFTEN. A steep
        // curve here buries the composition difference under a frequency one.
        const quiet = placeRateMultiplier({ id: 'a', name: 'a', kind: 'settlement', danger: 0 });
        const lethal = placeRateMultiplier({ id: 'b', name: 'b', kind: 'wilds', danger: 1 });
        expect(lethal / quiet).toBeLessThan(2.5);
        expect(lethal).toBeGreaterThan(quiet);
    });
});

describe('reach', () => {
    /**
     * A shut door is not a ward.
     *
     * This asserted an empty pool at every rung, and that made closed-door
     * seclusion a dominant strategy rather than a trade: everything that can
     * end a run arrives through these tables, so a player who sealed was
     * simply safe and the correct play was never to open the door. Found by
     * playing - three runs died to wounds and to a fight, and the fourth
     * survived by sealing and doing nothing else.
     *
     * The door still does most of the work. What comes through is a fraction
     * of an open seclusion, and it is skewed: getting past a formation takes
     * somebody strong enough not to care or desperate enough to try, and the
     * ordinary passer-by is exactly who the door stops.
     */
    it('lets very little through a sealed door, and not nothing', () => {
        for (const ordinal of [0, 12, 30, 44]) {
            const sealed = encounterPool({ ordinal, activity: 'sealed', place: cave });
            const open = encounterPool({ ordinal, activity: 'seclusion', place: cave });
            expect(sealed.length, `${ordinal}: a door is not a ward`).toBeGreaterThan(0);
            expect(sealed.length, `${ordinal}: a door should stop most of it`)
                .toBeLessThanOrEqual(open.length);
        }
    });

    it('keeps the road out of a cave and the market out of the wilds', () => {
        const inCave = encounterPool({ ordinal: 10, activity: 'seclusion', place: cave });
        expect(inCave.length).toBeGreaterThan(0);
        for (const row of inCave) {
            expect(row.entry.tags).not.toContain('road');
            expect(row.entry.kind).not.toBe('commerce');
        }
    });

    it('covers every activity in the table', () => {
        expect(new Set(ENCOUNTER_ACTIVITIES).size).toBe(ENCOUNTER_ACTIVITIES.length);
        for (const activity of ENCOUNTER_ACTIVITIES) {
            const place = activity === 'seclusion' || activity === 'sealed' ? cave : road;
            const pool = encounterPool({ ordinal: 10, activity, place });
            // Every activity, sealed included: nothing in this world is a
            // place where nothing can ever happen.
            expect(pool.length, `${activity} can have nothing happen to it`).toBeGreaterThan(0);
        }
    });
});

describe('the door', () => {
    it('only lets through what came for you', () => {
        // A sealed hall two valleys over interrupts somebody who can walk to
        // it, and does not interrupt somebody sitting in a cave. Their own
        // circulation reversing does either way.
        const hall = requireEncounter('enc-sealed-hall-of-a-dead-age');
        expect(interruptsThrough(hall, 'travel')).toBe(true);
        expect(interruptsThrough(hall, 'seclusion')).toBe(false);

        const deviation = requireEncounter('enc-qi-deviation-onset');
        expect(interruptsThrough(deviation, 'seclusion')).toBe(true);

        const feud = requireEncounter('enc-old-feud-ambush');
        expect(interruptsThrough(feud, 'seclusion')).toBe(true);
    });

    it('never invents an interruption the catalog did not declare', () => {
        for (const entry of ENCOUNTERS) {
            if (entry.interrupts) continue;
            for (const activity of ENCOUNTER_ACTIVITIES) {
                expect(interruptsThrough(entry, activity)).toBe(false);
            }
        }
    });
});

describe('direction', () => {
    it('classifies every entry in the catalog', () => {
        for (const entry of ENCOUNTERS) {
            expect(['good', 'neutral', 'bad']).toContain(valenceOf(entry));
        }
    });

    it('calls a wound bad and a windfall good, whatever else is on it', () => {
        expect(valenceOf(requireEncounter('enc-qi-deviation-onset'))).toBe('bad');
        expect(valenceOf(requireEncounter('enc-robbed-in-seclusion'))).toBe('bad');
        expect(valenceOf(requireEncounter('enc-untouched-herb-patch'))).toBe('good');
        // An opportunity with a beast sitting on it is still why anybody went.
        expect(valenceOf(requireEncounter('enc-guarded-herb'))).toBe('good');
    });
});

function weightByKind(pool: ReturnType<typeof encounterPool>): Map<string, number> {
    const out = new Map<string, number>();
    for (const row of pool) out.set(row.entry.kind, (out.get(row.entry.kind) ?? 0) + row.weight);
    return out;
}

function share(weights: Map<string, number>, kind: string): number {
    let total = 0;
    for (const w of weights.values()) total += w;
    return total > 0 ? (weights.get(kind) ?? 0) / total : 0;
}
