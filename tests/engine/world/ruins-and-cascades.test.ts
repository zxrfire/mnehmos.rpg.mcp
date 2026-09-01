/**
 * What can now happen to the world that could not.
 *
 * Four things under test, and the assertions are about PROPERTIES rather than
 * about particular numbers, because the numbers here are supposed to move when
 * the world moves. What must not move is the shape:
 *
 *   - a chain of forced choices leaves the map permanently different
 *   - something sealed opens on its own schedule with nobody's intent
 *   - the two ruin axes stay independent of each other
 *   - a map records rooms and never the edges
 */

import { describe, it, expect } from 'vitest';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { MAX_ORDINAL } from '../../../src/engine/cultivation/realms.js';
import {
    makeLocation,
    makeThresholds,
    applyLocationChange,
    type LocationRecord
} from '../../../src/engine/world/locations.js';
import { makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm, upsertRelationship } from '../../../src/engine/world/npc-state.js';
import { createLedger } from '../../../src/engine/world/history.js';
import { runCascade } from '../../../src/engine/world/cascade.js';
import {
    ageOf,
    accessTermsFor,
    firstChamberTells,
    identifyBuilder,
    knownAxes,
    readProvenance,
    ruinFromFallenSeat,
    siteStanding,
    standingOffer,
    wingHolds,
    wingsOf,
    withProvenance,
    withWings,
    workWing,
    PROVENANCE_READ_ORDINAL
} from '../../../src/engine/world/provenance.js';
import {
    convergenceOf,
    expeditionBudget,
    pierceReach,
    resolveOverstay,
    rescuersFor,
    attemptRescue,
    PIERCE_GRANT
} from '../../../src/engine/world/convergence.js';
import {
    completeMap,
    lightBudget,
    navigate,
    noMap,
    offerPossession,
    recognises,
    routineAt,
    trueTopology
} from '../../../src/engine/world/ruin-mechanics.js';

// ─────────────────────────────────────────────────────────────────────────
// FIXTURES - three houses, a seat each, and one thing asleep
// ─────────────────────────────────────────────────────────────────────────

function ruinAt(id: string, opts: Partial<LocationRecord> = {}): LocationRecord {
    return makeLocation({
        id,
        name: `the compound at ${id}`,
        kind: 'ruin',
        qiDensity: 80,
        thresholds: makeThresholds(4, 8, 14, 20),
        hazards: ['formation', 'guardian'],
        sealed: false,
        discovered: false,
        data: { techniqueCount: 3, treasureCount: 3, sealedYear: 100 },
        ...opts
    });
}

function world(): WorldState {
    const seats = [
        makeLocation({ id: 'loc-seat-a', name: 'Riverhead', kind: 'sect_seat' }),
        makeLocation({ id: 'loc-seat-b', name: 'Stonegate', kind: 'sect_seat' })
    ];
    const victim = makeFaction({
        id: 'f-victim', name: 'Fallen Hall', seatLocationId: 'loc-seat-a',
        foundedOnDay: 0,
        resources: {
            spirit_stones: 0, power_ordinal: 18,
            // The only thing it has left, and there is exactly one.
            sealed_ceiling_ordinal: 40
        },
        tags: ['recruits']
    });
    const aggressor = makeFaction({
        id: 'f-aggressor', name: 'Stone Court', seatLocationId: 'loc-seat-b',
        foundedOnDay: 0,
        resources: { spirit_stones: 50_000, power_ordinal: 24 },
        tags: ['recruits']
    });

    const npcs = [
        setRealm(createNpc('s', {
            id: 'npc-1', bornOnDay: 0, onDay: 3650, locationId: 'loc-seat-b',
            factionId: 'f-aggressor'
        }), 20, 3650),
        setRealm(createNpc('s', {
            id: 'npc-2', bornOnDay: 0, onDay: 3650, locationId: 'loc-seat-b',
            factionId: 'f-aggressor'
        }), 24, 3650)
    ];

    return {
        id: 'w', seed: 'cascade-test', currentDay: 3650,
        locations: seats,
        factions: [victim, aggressor],
        npcs,
        actors: [], schedule: [], processes: [], lineages: [],
        opportunities: [], objects: [],
        history: createLedger(),
        memories: [],
        populationTarget: 0,
        nextNpcSeq: 10, nextEffectSeq: 1, nextMemorySeq: 1
    } as unknown as WorldState;
}

// ═════════════════════════════════════════════════════════════════════════
// 1. A CHAIN OF FORCED CHOICES THAT RESHAPES THE MAP
// ═════════════════════════════════════════════════════════════════════════

describe('cascade - parties under pressure choosing until the world is different', () => {
    it('always chooses something, and every step writes a fact', () => {
        const state = world();
        const result = runCascade(state, {
            strickenId: 'f-victim', aggressorId: 'f-aggressor',
            day: 3650, causeFactId: null, severity: 1
        }, forStream('t', 'a'));

        expect(result.steps.length).toBeGreaterThan(0);
        for (const step of result.steps) {
            expect(step.factId).not.toBeNull();
            expect(step.considered.length).toBeGreaterThan(0);
            // Every option is priced by something factual, never asserted.
            for (const o of step.considered) expect(o.because.length).toBeGreaterThan(0);
        }
        expect(state.history.facts.length).toBe(result.steps.length);
    });

    it('is deterministic: the same seed produces the same chain', () => {
        const chains = [0, 1].map(() => {
            const state = world();
            return runCascade(state, {
                strickenId: 'f-victim', aggressorId: 'f-aggressor',
                day: 3650, causeFactId: null, severity: 1
            }, forStream('t', 'same')).steps.map(s => s.chosen);
        });
        expect(chains[0]).toEqual(chains[1]);
    });

    it('a spent protector permanently reshapes the ground it was spent on', () => {
        // Sweep seeds until the chain reaches `expend`. That it is rare is the
        // design; that it is reachable is what this asserts.
        let found = false;
        for (let seed = 0; seed < 200 && !found; seed++) {
            const state = world();
            const result = runCascade(state, {
                strickenId: 'f-victim', aggressorId: 'f-aggressor',
                day: 3650, causeFactId: null, severity: 1
            }, forStream('sweep', seed));
            if (!result.steps.some(s => s.chosen === 'expend')) continue;
            found = true;

            expect(result.reshapedTheLandscape).toBe(true);

            const target = state.locations.find(l => l.id === 'loc-seat-b')!;
            // The map never grows; it scars. Kind changed, qi gone, and the
            // change history carries both, dated, forever.
            expect(target.kind).toBe('forbidden_zone');
            expect(target.qiDensity).toBeLessThan(10);
            expect(target.environment.spiritualDensity).toBe(0);
            expect(target.tags).toContain('permanent');
            expect(target.changes.some(c => c.kind === 'forbidden')).toBe(true);

            // The asset is spent. There is no second one anywhere.
            const victim = state.factions.find(f => f.id === 'f-victim')!;
            expect(victim.resources.sealed_ceiling_ordinal).toBe(0);
            expect(victim.tags).toContain('seal_spent');
            const woken = state.npcs.find(n => n.tags.includes('woken'));
            // `physically_dead` rather than a bare 'dead': existence is multi-valued
            // here, and the distinction is the soul layer's, not this module's.
            expect(woken?.status).toBe('physically_dead');
        }
        expect(found).toBe(true);
    });

    it('everybody below the disaster bar dies and everybody above walks out', () => {
        let checked = false;
        for (let seed = 0; seed < 200 && !checked; seed++) {
            const state = world();
            const result = runCascade(state, {
                strickenId: 'f-victim', aggressorId: 'f-aggressor',
                day: 3650, causeFactId: null, severity: 1
            }, forStream('sweep', seed));
            if (!result.steps.some(s => s.chosen === 'expend')) continue;
            checked = true;

            // Both bystanders are far under Grand Ascension, so both are gone -
            // and the exposure that produces is derived from the roster, never
            // read off a tier table.
            for (const id of ['npc-1', 'npc-2']) {
                expect(state.npcs.find(n => n.id === id)!.status).toBe('physically_dead');
            }
            const aggressor = state.factions.find(f => f.id === 'f-aggressor')!;
            expect(aggressor.dissolvedOnDay).not.toBeNull();
        }
        expect(checked).toBe(true);
    });

    it('offers no unsealing to a house that holds nothing', () => {
        const state = world();
        state.factions[0].resources.sealed_ceiling_ordinal = 0;
        const result = runCascade(state, {
            strickenId: 'f-victim', aggressorId: 'f-aggressor',
            day: 3650, causeFactId: null, severity: 1
        }, forStream('t', 'empty'));
        for (const step of result.steps) {
            expect(step.considered.map(o => o.option)).not.toContain('unseal');
        }
    });

    it('offers no spending when nobody did it to them', () => {
        // A disaster with no author. `expend` needs a target and correctly has
        // none, which is a gap in the option table rather than in the model.
        let sawWoken = false;
        for (let seed = 0; seed < 200; seed++) {
            const state = world();
            const result = runCascade(state, {
                strickenId: 'f-victim', aggressorId: null,
                day: 3650, causeFactId: null, severity: 1
            }, forStream('noauthor', seed));
            for (const step of result.steps) {
                if (step.partyKind === 'woken') sawWoken = true;
                expect(step.chosen).not.toBe('expend');
            }
        }
        expect(sawWoken).toBe(true);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. SOMETHING OPENS ON ITS OWN SCHEDULE
// ═════════════════════════════════════════════════════════════════════════

describe('convergence - the world doing something rather than doing it to you', () => {
    const pavilion = ruinAt('loc-pav', {
        cycle: { periodDays: 400 * 365, openDays: 40, phaseDay: 0 }
    });

    it('reports a window with a short opening and a very long wait', () => {
        const open = convergenceOf(pavilion, 10);
        expect(open.cyclical).toBe(true);
        expect(open.open).toBe(true);
        expect(open.daysLeft).toBe(30);
        expect(open.yearsUntilNext).toBe(400);

        const shut = convergenceOf(pavilion, 5_000);
        expect(shut.open).toBe(false);
        expect(shut.remaining).toBe(0);
    });

    it('the way out narrows exactly as the window closes', () => {
        const folder = { realmOrdinal: 30, heldGrants: [PIERCE_GRANT] };
        const early = pierceReach(convergenceOf(pavilion, 1), folder);
        const late = pierceReach(convergenceOf(pavilion, 39), folder);
        expect(early).toBeGreaterThan(late);
        expect(late).toBeLessThan(1);
    });

    it('is never available to the person who would need it', () => {
        // The self-cancelling property, stated as an assertion. Anybody at a
        // rung that would explore a ruin cannot fold at all, whatever they hold.
        for (const ordinal of [0, 8, 16, 20, 28]) {
            expect(pierceReach(convergenceOf(pavilion, 1), {
                realmOrdinal: ordinal, heldGrants: [PIERCE_GRANT]
            })).toBe(0);
        }
    });

    it('halves the window into a depth budget, because the walk back costs the same', () => {
        const budget = expeditionBudget(pavilion, 10, { realmOrdinal: 12 });
        expect(budget.safeDepth).toBe(15);
        // A site deeper than half its own window is never cleared by anybody.
        expect(budget.wings.some(w => !w.reachable)).toBe(true);
    });

    it('overstaying kills by arithmetic rather than by a hazard', () => {
        const shutIn = resolveOverstay(pavilion, 40, { realmOrdinal: 8, bornOnDay: 0 });
        expect(shutIn.outcome).toBe('dies_inside');
        expect(shutIn.yearsShutIn).toBeGreaterThan(shutIn.yearsRemaining);

        // And somebody for whom four centuries is a nap comes out into a world
        // that did not wait. A good outcome, and a rare one.
        const survives = resolveOverstay(pavilion, 40, { realmOrdinal: 40, bornOnDay: 0 });
        expect(survives.outcome).toBe('shut_in');
    });

    it('a place with no cycle is not on a clock at all', () => {
        const walkable = ruinAt('loc-walk', { cycle: null });
        const budget = expeditionBudget(walkable, 10, { realmOrdinal: 4 });
        expect(budget.wings.every(w => w.reachable)).toBe(true);
        expect(budget.unreachableWings).toHaveLength(0);
    });
});

describe('rescue - a relationship as a survival asset', () => {
    function withRescuer(standing: number, ordinal: number): WorldState {
        const state = world();
        const subject = setRealm(createNpc('s', {
            id: 'npc-inside', bornOnDay: 0, onDay: 3650, locationId: 'loc-pav'
        }), 8, 3650);
        let master = setRealm(createNpc('s', {
            id: 'npc-master', bornOnDay: 0, onDay: 3650, locationId: 'loc-seat-a'
        }), ordinal, 3650);
        master = upsertRelationship(master, {
            targetId: 'npc-inside', targetName: subject.name,
            kind: 'master', standing, note: 'Took them in.'
        }, 0);
        state.npcs.push(subject, master);
        return state;
    }

    const pavilion = ruinAt('loc-pav', {
        cycle: { periodDays: 400 * 365, openDays: 40, phaseDay: 0 }
    });

    it('is legible in advance, so going deeper is a decision', () => {
        const state = withRescuer(0.8, 30);
        const pledges = rescuersFor(state, {
            subject: state.npcs.find(n => n.id === 'npc-inside')!,
            location: pavilion, depthDays: 3, day: 1
        });
        expect(pledges).toHaveLength(1);
        expect(pledges[0].precondition).toBe('master');
        expect(pledges[0].reachesYou).toBe(true);
        expect(pledges[0].chance).toBeGreaterThan(0);
        expect(pledges[0].chance).toBeLessThan(1);
    });

    it('nobody comes for somebody with nobody', () => {
        const state = withRescuer(0.8, 30);
        // Same world, different person: no tie points at them.
        const stranger = setRealm(createNpc('s', {
            id: 'npc-stranger', bornOnDay: 0, onDay: 3650, locationId: 'loc-pav'
        }), 8, 3650);
        state.npcs.push(stranger);
        const result = attemptRescue(state, {
            subject: stranger, location: pavilion, depthDays: 3, day: 1
        }, forStream('r', 'x'));
        expect(result.came).toBe(false);
        expect(result.refusal).toContain('any reason');
    });

    it('fails on geometry when the call goes out late', () => {
        const state = withRescuer(0.9, 30);
        const subject = state.npcs.find(n => n.id === 'npc-inside')!;
        // Day 39 of a 40-day window: the reach has very nearly gone.
        const late = attemptRescue(state, {
            subject, location: pavilion, depthDays: 5, day: 39
        }, forStream('r', 'late'));
        expect(late.came).toBe(false);
        expect(late.refusal).toContain('further out');
    });

    it('opens an obligation rather than settling one', () => {
        let sawRescue = false;
        for (let seed = 0; seed < 60 && !sawRescue; seed++) {
            const state = withRescuer(0.9, 30);
            const subject = state.npcs.find(n => n.id === 'npc-inside')!;
            const result = attemptRescue(state, {
                subject, location: pavilion, depthDays: 2, day: 2
            }, forStream('r', seed));
            if (!result.came) continue;
            sawRescue = true;
            const after = state.npcs.find(n => n.id === 'npc-inside')!;
            const owed = after.relationships.find(r => r.targetId === 'npc-master');
            expect(owed?.kind).toBe('creditor');
        }
        expect(sawRescue).toBe(true);
    });

    it('is never certain', () => {
        const state = withRescuer(1, 40);
        const pledges = rescuersFor(state, {
            subject: state.npcs.find(n => n.id === 'npc-inside')!,
            location: pavilion, depthDays: 1, day: 1
        });
        expect(pledges[0].chance).toBeLessThanOrEqual(0.85);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. THE RUIN AXES, AND THAT THEY DO NOT TALK TO EACH OTHER
// ═════════════════════════════════════════════════════════════════════════

describe('ruins - two axes that stay independent', () => {
    const documented = withProvenance(ruinAt('loc-doc'), {
        standing: 'documented', builderId: 'f-old', builderName: 'the Nine Terraces',
        builtInYear: 100, key: 'ruins:nine-terraces',
        readOrdinal: PROVENANCE_READ_ORDINAL.documented
    });

    it('a picked-over ruin can still be fully documented', () => {
        let site = documented;
        for (const wing of wingsOf(site).slice(0, 2)) {
            const worked = workWing(site, { wingId: wing.id, onDay: 500, byName: 'Xun Bo' });
            if (worked) site = worked.location;
        }
        expect(siteStanding(site).totalWorkings).toBe(2);
        // And the record is exactly as readable as it was.
        expect(readProvenance(site).builderName).toBe('the Nine Terraces');
        const read = identifyBuilder(site, { id: 'a', realmOrdinal: 1, present: true, alive: true });
        expect(read.placed).toBe(true);
    });

    it('an untouched ruin can be completely anonymous', () => {
        const site = ruinAt('loc-anon');
        expect(siteStanding(site).depletion).toBe('untouched');
        const read = identifyBuilder(site, {
            id: 'a', realmOrdinal: MAX_ORDINAL, present: true, alive: true
        });
        expect(read.placed).toBe(false);
        // The top of the ladder does not buy past a record that does not exist.
        expect(read.missing).toContain('Nothing survives');
        // And a failed read is still informative.
        expect(read.plain.length).toBeGreaterThan(0);
    });

    it('a scholar with the notes places what a much stronger cultivator cannot', () => {
        const attributed = withProvenance(ruinAt('loc-att'), {
            standing: 'attributed', builderId: 'f-old', builderName: 'the Nine Terraces',
            builtInYear: 100, key: 'ruins:nine-terraces',
            readOrdinal: PROVENANCE_READ_ORDINAL.attributed
        });
        const scholar = identifyBuilder(attributed, {
            id: 'scholar', realmOrdinal: 1, present: true, alive: true,
            knowledgeIds: ['ruins:nine-terraces']
        });
        const soldier = identifyBuilder(attributed, {
            id: 'soldier', realmOrdinal: 4, present: true, alive: true
        });
        expect(scholar.placed).toBe(true);
        expect(soldier.placed).toBe(false);
        expect(soldier.missing).toContain('archive');
    });

    it('placing the builder hands over habits and never contents', () => {
        const read = identifyBuilder(documented, {
            id: 'a', realmOrdinal: 1, present: true, alive: true
        });
        expect(read.expectations.length).toBeGreaterThan(0);
        for (const e of read.expectations) {
            expect(e.because.length).toBeGreaterThan(0);
            expect(e.implies.length).toBeGreaterThan(0);
        }
        // Nothing in the reading says what is still there.
        const text = read.expectations.map(e => e.implies).join(' ');
        expect(text).not.toContain('remaining');
    });

    it('the least worked wing decides the site, so one sealed door keeps it worth going to', () => {
        let site = ruinAt('loc-one-door');
        const wings = wingsOf(site);
        for (const wing of wings.slice(0, -1)) {
            for (let i = 0; i < 3; i++) {
                const worked = workWing(site, { wingId: wing.id, onDay: 500 + i });
                if (worked) site = worked.location;
            }
        }
        const standing = siteStanding(site);
        expect(standing.stillSealed.length).toBeGreaterThan(0);
        expect(standing.depletion).toBe('untouched');
    });

    it('refuses to work a sealed wing without unsealing it', () => {
        const site = ruinAt('loc-sealed');
        const sealed = wingsOf(site).find(w => w.sealed)!;
        expect(workWing(site, { wingId: sealed.id, onDay: 10 })).toBeNull();
        expect(workWing(site, { wingId: sealed.id, onDay: 10, unsealed: true })).not.toBeNull();
    });
});

describe('ruins - the third axis, and the world making more of them', () => {
    it('a house that falls this year leaves a documented ruin with no clock', () => {
        const seat = makeLocation({ id: 'loc-fell', name: 'Riverhead', kind: 'sect_seat' });
        const { location } = ruinFromFallenSeat(seat, {
            onDay: 100_000, houseName: 'the Fallen Hall', houseId: 'f-victim'
        });
        expect(location.kind).toBe('ruin');
        expect(ageOf(location, 100_000)).toBe('new');
        // People watched it happen, so no scholar is needed.
        const read = identifyBuilder(location, { id: 'a', realmOrdinal: 0, present: true, alive: true });
        expect(read.placed).toBe(true);
        expect(read.builderName).toBe('the Fallen Hall');
        // And it is a place you can walk to. That is the sharpest difference.
        expect(location.cycle).toBeNull();
        expect(convergenceOf(location, 100_001).cyclical).toBe(false);
    });

    it('a new ruin holds nothing ancient at any depth', () => {
        const seat = makeLocation({ id: 'loc-new', name: 'Riverhead', kind: 'sect_seat' });
        const { location } = ruinFromFallenSeat(seat, {
            onDay: 100_000, houseName: 'the Fallen Hall', houseId: 'f'
        });
        const wings = wingsOf(location);
        const deepest = wingHolds(wings[wings.length - 1], wings, 'new');
        expect(deepest.kinds.join(' ')).not.toContain('nobody transmits');
        expect(deepest.note).toContain('this age');
    });

    it('refuses to offer a past that people are still alive to remember', () => {
        const seat = makeLocation({ id: 'loc-recent', name: 'Riverhead', kind: 'sect_seat' });
        const { location } = ruinFromFallenSeat(seat, {
            onDay: 100_000, houseName: 'the Fallen Hall', houseId: 'f'
        });
        const offer = offerPossession(location, { corpseId: 'c1', onDay: 100_000 });
        expect(offer.available).toBe(false);
        expect(offer.refusal).toContain('can simply be asked');
    });
});

describe('ruins - the first chamber is evidence, and the gradient is a record', () => {
    it('a stripped entrance says people have been here, with no scholarship needed', () => {
        let site = ruinAt('loc-worked');
        const shallow = wingsOf(site)[0];
        const worked = workWing(site, { wingId: shallow.id, onDay: 10 });
        site = worked!.location;
        expect(firstChamberTells(site).sign).toBe('been_worked');
    });

    it('an untouched entrance in a known ruin is the alarming case, and stays unresolved', () => {
        const site = ruinAt('loc-known', { discovered: true });
        const read = firstChamberTells(site);
        expect(read.sign).toBe('nobody_came_back');
        // The engine does not pick between the readings, and must not.
        expect(read.readings.length).toBeGreaterThan(1);
    });

    it('an unfound site shows no gradient at all, because nothing produced one', () => {
        const site = ruinAt('loc-unfound', { discovered: false });
        expect(firstChamberTells(site).sign).toBe('never_found');
    });
});

describe('ruins - stripped, safe, and still worth going to', () => {
    it('comprehension survives being visited a hundred times', () => {
        let site = ruinAt('loc-exhausted', { discovered: true });
        const before = standingOffer(site, 500_000).comprehensible;
        for (const wing of wingsOf(site)) {
            for (let i = 0; i < 4; i++) {
                const worked = workWing(site, { wingId: wing.id, onDay: 1_000 + i, unsealed: true });
                if (worked) site = worked.location;
            }
        }
        const after = standingOffer(site, 500_000);
        expect(after.carryable).toHaveLength(0);
        expect(after.comprehensible).toEqual(before);
        expect(after.comprehensible.length).toBeGreaterThan(0);
        expect(after.deemedSafe).toBe(true);
    });

    it('what is comprehended is about the place, so two ruins do not teach the same thing', () => {
        const withRefining = ruinAt('loc-big', { data: { techniqueCount: 6, treasureCount: 6 } });
        const small = ruinAt('loc-small', {
            data: { techniqueCount: 0, treasureCount: 0 }, hazards: []
        });
        const a = standingOffer(withRefining, 500_000).comprehensible;
        const b = standingOffer(small, 500_000).comprehensible;
        expect(a).not.toEqual(b);
    });

    it('deemed safe is a judgement and is allowed to be wrong', () => {
        let site = ruinAt('loc-reputation', { thresholds: makeThresholds(0, 0, 0, 38) });
        for (const wing of wingsOf(site)) {
            const worked = workWing(site, { wingId: wing.id, onDay: 10, unsealed: true });
            if (worked) site = worked.location;
        }
        const offer = standingOffer(site, 500_000);
        // The reputation and the record are separate, and here they disagree.
        expect(offer.deemedSafe).toBe(true);
        expect(offer.thresholds.mastery).toBe(38);
    });
});

describe('ruins - knowledge follows engagement rather than altitude', () => {
    it('a house that has been knows what a stronger house that has not does not', () => {
        let site = withProvenance(ruinAt('loc-asym'), {
            standing: 'documented', builderId: 'f-old', builderName: 'the Nine Terraces',
            builtInYear: 100, key: null, readOrdinal: 0
        });
        for (let i = 0; i < 4; i++) {
            const worked = workWing(site, {
                wingId: wingsOf(site)[0].id, onDay: 100 + i, byName: 'the Reed House'
            });
            if (worked) site = worked.location;
        }
        const digger = knownAxes(site, { id: 'f-reed', name: 'the Reed House' });
        const apex = knownAxes(site, { id: 'f-apex', name: 'the Hollow Court' });

        expect(digger.knowsGradient).toBe(true);
        expect(apex.engagements).toBe(0);
        expect(apex.knowsGradient).toBe(false);
        expect(apex.wouldSay).toContain('Nothing');
    });

    it('one visit produces a confident and partial picture', () => {
        let site = withProvenance(ruinAt('loc-partial'), {
            standing: 'documented', builderId: 'f', builderName: 'the Nine Terraces',
            builtInYear: 100, key: null, readOrdinal: 0
        });
        const worked = workWing(site, {
            wingId: wingsOf(site)[0].id, onDay: 100, byName: 'the Reed House'
        });
        site = worked!.location;
        const view = knownAxes(site, { id: 'f-reed', name: 'the Reed House' });
        expect(view.confidentlyPartial).toBe(true);
        expect(view.knowsGradient).toBe(false);
        expect(view.wouldSay).toContain('as though it were the place');
    });
});

describe('ruins - who controls the door', () => {
    const site = ruinAt('loc-held', {
        discovered: true, controllingFactionId: 'f-holder',
        thresholds: makeThresholds(0, 0, 0, 20)
    });

    it('an unclaimed site charges nothing, and that is information', () => {
        const terms = accessTermsFor(site, null);
        expect(terms.control).toBe('unclaimed');
        expect(terms.price).toBe('open');
        expect(terms.ifIgnored).toContain('worth knowing');
    });

    it('a house that takes applicants sells access; one that does not reserves it', () => {
        expect(accessTermsFor(site, { id: 'f-holder', recruits: true, reach: 8 }).price).toBe('fee');
        expect(accessTermsFor(site, { id: 'f-holder', recruits: false, reach: 8 }).price)
            .toBe('disciples_only');
    });

    it('a paper claim bills what it cannot stop, and asks for an errand instead', () => {
        const terms = accessTermsFor(site, { id: 'f-holder', recruits: true, reach: 1 });
        expect(terms.control).toBe('held_on_paper');
        expect(terms.price).toBe('task');
        expect(terms.enforceable).toBe(false);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. MECHANICS THAT CHANGE THE TERMS RATHER THAN THE DAMAGE
// ═════════════════════════════════════════════════════════════════════════

describe('ruin mechanics - a map records rooms and never the edges', () => {
    const site = ruinAt('loc-maze', { data: { techniqueCount: 6, treasureCount: 6 } });

    it('the topology is fixed and deterministic - the ruin does not shuffle', () => {
        const a = trueTopology(site);
        const b = trueTopology(site);
        expect(a).toEqual(b);
        // Connected, so nothing is unreachable and no route is impossible.
        expect(a.every(c => c.exits.length > 0)).toBe(true);
    });

    it('a complete map is real value and is still not a map of the way', () => {
        const chambers = trueTopology(site);
        const from = chambers[0].id;
        const to = chambers[chambers.length - 1].id;

        let blindDays = 0;
        let mappedDays = 0;
        for (let seed = 0; seed < 60; seed++) {
            blindDays += navigate(site, {
                fromChamberId: from, toChamberId: to, map: noMap()
            }, forStream('nav', seed)).days;
            mappedDays += navigate(site, {
                fromChamberId: from, toChamberId: to, map: completeMap(site, 'bought')
            }, forStream('nav', seed)).days;
        }
        // A map helps. It does not solve the place: the wandering is the edges,
        // and nobody can record those.
        expect(mappedDays).toBeLessThanOrEqual(blindDays);
        expect(mappedDays).toBeGreaterThan(0);
    });

    it('navigating badly costs days, which is what the clock consumes', () => {
        const chambers = trueTopology(site);
        const result = navigate(site, {
            fromChamberId: chambers[0].id,
            toChamberId: chambers[chambers.length - 1].id,
            map: noMap()
        }, forStream('nav', 'wander'));
        expect(result.days).toBeGreaterThan(0);
        expect(result.wasted).toBeGreaterThanOrEqual(0);
    });
});

describe('ruin mechanics - the other three', () => {
    const ancient = ruinAt('loc-ancient');

    it('wearing an identity carries comprehension out and nothing else', () => {
        const offer = offerPossession(ancient, { corpseId: 'c1', onDay: 500_000 });
        expect(offer.available).toBe(true);
        expect(offer.carriesBack.objects).toHaveLength(0);
        expect(offer.carriesBack.comprehension.length).toBeGreaterThan(0);
        expect(offer.continuityCost).toBeGreaterThan(0);
        // Derived from the site, so a different ruin is a different life.
        const other = offerPossession(ruinAt('loc-other', {
            thresholds: makeThresholds(0, 0, 0, 34)
        }), { corpseId: 'c1', onDay: 500_000 });
        expect(other.identity!.realmOrdinal).not.toBe(offer.identity!.realmOrdinal);
    });

    it('the only light is the thing you came to gather', () => {
        const shallow = lightBudget({ qi: 50, maxQi: 100, depthDays: 3 });
        const deep = lightBudget({ qi: 50, maxQi: 100, depthDays: 8 });
        expect(shallow.strandedInTheDark).toBe(false);
        expect(deep.strandedInTheDark).toBe(true);
    });

    it('the routine is a function of the day, so it can be learned rather than fought', () => {
        const a = routineAt(ancient, 1_000);
        const b = routineAt(ancient, 1_000);
        expect(a).toEqual(b);
        expect(a.filter(r => r.occupied)).toHaveLength(1);
        // And it moves, so a party that waits gets a clear room.
        const later = routineAt(ancient, 1_000 + 200);
        expect(later.find(r => r.occupied)!.chamberId)
            .not.toBe(a.find(r => r.occupied)!.chamberId);
    });

    it('the place gets the count right, and only counts what happened', () => {
        let site = ancient;
        expect(recognises(site, 'Xun Bo').known).toBe(false);
        for (let i = 0; i < 2; i++) {
            const worked = workWing(site, {
                wingId: wingsOf(site)[0].id, onDay: 10 + i, byName: 'Xun Bo'
            });
            if (worked) site = worked.location;
        }
        const seen = recognises(site, 'Xun Bo');
        expect(seen.known).toBe(true);
        expect(seen.priorVisits).toBe(2);
        expect(recognises(site, 'Somebody Else').known).toBe(false);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// AND THE AXES REALLY ARE INDEPENDENT
// ═════════════════════════════════════════════════════════════════════════

describe('the independence property, stated as a test', () => {
    it('working a site never changes what is knowable about its builder', () => {
        let site = withProvenance(ruinAt('loc-indep'), {
            standing: 'rumoured', builderId: 'f', builderName: 'the Nine Terraces',
            builtInYear: 100, key: 'ruins:x', readOrdinal: PROVENANCE_READ_ORDINAL.rumoured
        });
        const before = readProvenance(site);
        for (const wing of wingsOf(site)) {
            const worked = workWing(site, { wingId: wing.id, onDay: 10, unsealed: true });
            if (worked) site = worked.location;
        }
        expect(readProvenance(site)).toEqual(before);
    });

    it('naming the builder never changes what is left in the halls', () => {
        const site = ruinAt('loc-indep2');
        const before = siteStanding(site);
        const named = withProvenance(site, {
            standing: 'documented', builderId: 'f', builderName: 'the Nine Terraces',
            builtInYear: 100, key: null, readOrdinal: 0
        });
        expect(siteStanding(named).wings).toEqual(before.wings);
        expect(siteStanding(named).depletion).toBe(before.depletion);
    });
});

// A round-trip guard: the wing list lives as JSON on a flat scalar map, and a
// site written by one build has to be readable by the next.
describe('storage', () => {
    it('wings survive a write and a read', () => {
        const site = ruinAt('loc-roundtrip');
        const wings = wingsOf(site);
        const written = withWings(site, wings);
        expect(wingsOf(written)).toEqual(wings);
    });

    it('a location with nothing written reads as anonymous and untouched', () => {
        const bare = makeLocation({ id: 'loc-bare', name: 'somewhere', kind: 'ruin' });
        expect(readProvenance(bare).standing).toBe('anonymous');
        expect(siteStanding(bare).depletion).toBe('untouched');
    });

    it('a change made by this layer is an ordinary dated location change', () => {
        const site = ruinAt('loc-change');
        const worked = workWing(site, { wingId: wingsOf(site)[0].id, onDay: 77, byName: 'Xun Bo' })!;
        expect(worked.change.onDay).toBe(77);
        expect(worked.change.kind).toBe('depleted');
        expect(worked.location.changes).toContainEqual(worked.change);
        // And it composes with the existing history machinery untouched.
        const later = applyLocationChange(worked.location, {
            onDay: 100, kind: 'other', summary: 'something else'
        });
        expect(later.location.changes).toHaveLength(worked.location.changes.length + 1);
    });
});
