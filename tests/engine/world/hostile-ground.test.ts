/**
 * The four thresholds, made to do something.
 *
 * They were calibrated across every place in the world and nothing read them
 * while a cultivator was standing somewhere. Measured before this existed: an
 * ordinal 0 cultivator inside a compound whose bars read entry 15 / survival 19
 * / operational 23 / mastery 25 walked in, cultivated for seven months, gained
 * a full rank, and was never touched.
 *
 * These are the design guards for the three ways that must now fail, and for
 * the ground scale that prices them.
 */

import { describe, it, expect } from 'vitest';
import {
    HOSTILE_GROUND_HP_CAP,
    HOSTILE_GROUND_HP_PER_RUNG,
    QI_DENSITY_DEFAULT,
    QI_DENSITY_MAX,
    QI_DENSITY_MIN,
    clampQiDensity,
    hostilityReasonFor,
    makeAffinity,
    makeLocation,
    makeThresholds,
    ordinaryBandFor,
    qiFraction,
    standingConsequence
} from '../../../src/engine/world/locations.js';
import { sectGroundDensity, seedWorld } from '../../../src/engine/world/seeding.js';
import { fixtureCatalog } from './fixtures.js';
import { simulateTimeSkip } from '../../../src/engine/cultivation/time-skip.js';
import { makeCultivator } from '../cultivation/fixtures.js';

/** The compound the live run was measured in, rebuilt from its stored bars. */
function blackbank() {
    return makeLocation({
        id: 'loc-ruin-blackbank',
        name: 'the sealed compound at Blackbank',
        kind: 'ruin',
        qiDensity: QI_DENSITY_MAX,
        thresholds: makeThresholds(15, 19, 23, 25),
        hazards: ['formation', 'sealed_qi', 'guardian']
    });
}

function cultivatorAt(ordinal: number) {
    return makeCultivator({ realmOrdinal: ordinal, hp: 100, maxHp: 100, age: 20 });
}

describe('the qi scale', () => {
    it('is an integer 1..100 with nothing above the top', () => {
        expect(clampQiDensity(0)).toBe(QI_DENSITY_MIN);
        expect(clampQiDensity(-40)).toBe(QI_DENSITY_MIN);
        expect(clampQiDensity(1000)).toBe(QI_DENSITY_MAX);
        expect(clampQiDensity(34.6)).toBe(35);
        expect(QI_DENSITY_MIN).toBe(1);
        expect(QI_DENSITY_MAX).toBe(100);
    });

    it('has exactly one conversion to the 0..1 fraction the ambient engine speaks', () => {
        expect(qiFraction(QI_DENSITY_MAX)).toBe(1);
        expect(qiFraction(QI_DENSITY_DEFAULT)).toBeCloseTo(0.35, 6);
        expect(qiFraction(QI_DENSITY_MIN)).toBeCloseTo(0.01, 6);
    });

    it('keeps the four bands, and keeps them miserly', () => {
        // Half the world is thin, so finding dense ground is an event rather
        // than scenery. The default open air is not dense.
        expect(ordinaryBandFor(QI_DENSITY_DEFAULT)).toBe('normal');
        expect(ordinaryBandFor(10)).toBe('thin');
        expect(ordinaryBandFor(60)).toBe('dense');
        expect(ordinaryBandFor(QI_DENSITY_MAX)).toBe('spirit_tide');
        // Monotonic: better ground never reads as a worse band.
        const order = ['thin', 'normal', 'dense', 'spirit_tide'];
        let last = -1;
        for (let d = 1; d <= 100; d++) {
            const at = order.indexOf(ordinaryBandFor(d));
            expect(at).toBeGreaterThanOrEqual(last);
            last = at;
        }
    });

    it('puts the strongest faction in the catalog at the top of the scale', () => {
        // Derived, not named. Whoever is actually strongest holds the 100, so
        // renaming or unseating a house moves it with the arithmetic.
        const apex = 44;
        expect(sectGroundDensity(apex, apex, 35)).toBe(QI_DENSITY_MAX);
        // And standing buys ground monotonically.
        let previous = 0;
        for (let power = 0; power <= apex; power++) {
            const here = sectGroundDensity(power, apex, 1);
            expect(here).toBeGreaterThanOrEqual(previous);
            previous = here;
        }
        // A weak sect in a province offers nothing the province did not.
        expect(sectGroundDensity(5, apex, 60)).toBe(60);
    });
});

describe('a sect is a place', () => {
    const { state } = seedWorld({ seed: 'ground-test', catalog: fixtureCatalog() });

    it('gives every seated faction ground of its own', () => {
        const grounds = state.locations.filter(l => l.kind === 'sect_seat');
        expect(grounds.length).toBeGreaterThan(0);
        for (const ground of grounds) {
            expect(ground.controllingFactionId).not.toBeNull();
            // Being on the roll and being on the ground were two different
            // things, and only one of them existed. This is the other one.
            const faction = state.factions.find(f => f.id === ground.controllingFactionId);
            expect(faction, ground.id).toBeDefined();
            expect(faction!.seatLocationId).toBe(ground.id);
        }
    });

    it('makes the gate mean something without barring the forecourt', () => {
        for (const ground of state.locations.filter(l => l.kind === 'sect_seat')) {
            // Anyone may walk up to a gate and survive standing at it.
            expect(ground.thresholds.entry).toBe(0);
            expect(ground.thresholds.survival).toBe(0);
            // What the gate gates is working there.
            expect(ground.thresholds.operational).toBeGreaterThanOrEqual(0);
            expect(ground.thresholds.mastery).toBeGreaterThanOrEqual(ground.thresholds.operational);
        }
    });

    it('makes it a name you have to be given, and a road you can walk', () => {
        for (const ground of state.locations.filter(l => l.kind === 'sect_seat')) {
            expect(ground.discovered).toBe(false);
            expect(ground.parentId).not.toBeNull();
            // Linked both ways, by an ordinary road, so ordinary travel reaches it.
            const region = state.locations.find(l => l.id === ground.parentId)!;
            expect(ground.links.some(l => l.toLocationId === region.id)).toBe(true);
            expect(region.links.some(l => l.toLocationId === ground.id)).toBe(true);
        }
    });

    it('is better ground than the province, or exactly the province, never worse', () => {
        for (const ground of state.locations.filter(l => l.kind === 'sect_seat')) {
            const region = state.locations.find(l => l.id === ground.parentId)!;
            expect(ground.qiDensity, ground.name).toBeGreaterThanOrEqual(region.qiDensity);
        }
    });
});

describe('the thresholds are enforced', () => {
    it('turns away anyone below the entry bar, and names both bars', () => {
        const c = standingConsequence(blackbank(), { realmOrdinal: 0 });
        expect(c.level).toBe('barred');
        expect(c.admitted).toBe(false);
        // The sentence that teaches a player the ladder of places exists.
        expect(c.reason).toContain('Blackbank');
        expect(c.reason.length).toBeGreaterThan(40);
    });

    it('takes a body apart between the entry and survival bars', () => {
        const c = standingConsequence(blackbank(), { realmOrdinal: 16 });
        expect(c.level).toBe('lethal');
        expect(c.admitted).toBe(true);
        expect(c.shortOfSurvival).toBe(3);
        expect(c.dailyHpFraction).toBeCloseTo(3 * HOSTILE_GROUND_HP_PER_RUNG, 6);
        expect(c.canAct).toBe(false);
    });

    it('lets somebody stand between survival and operational and do nothing at all', () => {
        const c = standingConsequence(blackbank(), { realmOrdinal: 21 });
        expect(c.level).toBe('surviving');
        expect(c.admitted).toBe(true);
        expect(c.dailyHpFraction).toBe(0);
        // Alive, standing in the vault, unable to open anything.
        expect(c.canAct).toBe(false);
    });

    it('lets somebody above the operational bar work', () => {
        const c = standingConsequence(blackbank(), { realmOrdinal: 24 });
        expect(c.level).toBe('operational');
        expect(c.canAct).toBe(true);
        expect(c.dailyHpFraction).toBe(0);
    });

    it('never makes the worst ground instantaneous', () => {
        const abyss = makeLocation({
            id: 'l', name: 'the bottom', kind: 'ruin',
            thresholds: makeThresholds(0, 45, 45, 46)
        });
        const c = standingConsequence(abyss, { realmOrdinal: 0 });
        expect(c.dailyHpFraction).toBe(HOSTILE_GROUND_HP_CAP);
        expect(c.dailyHpFraction).toBeLessThan(1);
    });

    it('lets a matching specialist stand where a generalist cannot', () => {
        // The affinity system's `thresholdOffset`, which moves survival and
        // operational only. A reason to care about a spirit root beyond rate,
        // and until now completely unobservable.
        const cold = makeLocation({
            id: 'loc-glacier',
            name: 'the ice field',
            kind: 'wilds',
            hazards: ['cold'],
            thresholds: makeThresholds(0, 18, 22, 30),
            affinities: [makeAffinity('water', 1.2, 6, 'The cold answers to a water root.')]
        });
        const generalist = standingConsequence(cold, { realmOrdinal: 14 });
        const specialist = standingConsequence(cold, {
            realmOrdinal: 14,
            profile: { specialties: ['water'] }
        });
        expect(generalist.level).toBe('lethal');
        expect(specialist.level).not.toBe('lethal');
        expect(specialist.assessment.effective.survival)
            .toBeLessThan(generalist.assessment.effective.survival);
        // And the shift is itemised, so somebody can read why they lived.
        expect(specialist.assessment.applied.some(m => m.tier === 'survival')).toBe(true);
    });

    it('writes a different reason for somebody who went than for somebody deciding', () => {
        const location = blackbank();
        const c = standingConsequence(location, { realmOrdinal: 16 });
        expect(hostilityReasonFor(location, c)).toContain('3 rungs');
        expect(hostilityReasonFor(location, c)).not.toBe(c.reason);
    });
});

describe('the time skip pays the price', () => {
    const base = {
        seed: 'hostile',
        locationId: 'loc-ruin-blackbank',
        turn: 0,
        startDay: 0,
        randomEvents: false,
        autoBreakthrough: false,
        grainAbstinence: true
    };

    it('costs HP for every day spent on ground above the survival bar', () => {
        const c = cultivatorAt(16);
        const consequence = standingConsequence(blackbank(), { realmOrdinal: 16 });
        const skip = simulateTimeSkip(c, 365, {
            ...base,
            hostility: {
                dailyHpFraction: consequence.dailyHpFraction,
                inert: !consequence.canAct,
                reason: hostilityReasonFor(blackbank(), consequence)
            }
        });
        // Seven months of this was previously free. It is not any more.
        expect(skip.deltas.hp).toBeLessThan(0);
        expect(skip.events.some(e => e.data?.environmental === true)).toBe(true);
        // And control comes back rather than the run quietly ending in a hole.
        expect(skip.simulatedDays).toBeLessThan(365);
    });

    it('gives up no progress at all on ground they cannot work in', () => {
        const c = cultivatorAt(21);
        const inert = simulateTimeSkip(c, 365, {
            ...base,
            hostility: { dailyHpFraction: 0, inert: true, reason: 'x' }
        });
        const ordinary = simulateTimeSkip(c, 365, base);
        expect(inert.deltas.cultivationProgress).toBe(0);
        expect(ordinary.deltas.cultivationProgress).toBeGreaterThan(0);
    });

    it('changes nothing at all when no hostility is supplied', () => {
        const c = cultivatorAt(10);
        const a = simulateTimeSkip(c, 200, base);
        const b = simulateTimeSkip(c, 200, { ...base, hostility: undefined });
        expect(b).toEqual(a);
    });
});
