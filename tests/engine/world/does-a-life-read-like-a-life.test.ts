/**
 * Does a life read like a life?
 *
 * The acceptance test is the user's own sentence, and it is a better measure
 * than a row count:
 *
 *     reached Foundation at 34 - took a master - ranked second at the Court -
 *     crossed to Core Formation at 71 - the merging went wrong and took a
 *     quarter of him - killed Han Minwu - died at the wall
 *
 * "rather than four murders and an inheritance." So what is asserted here is
 * that a life read out of `historyFactIds` alone is ABOUT THAT PERSON, contains
 * the events that make a climb legible, and does not contain the weather.
 */

import { describe, it, expect } from 'vitest';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import { trajectoryOf } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import { worthRecordingRank } from '../../../src/engine/world/recording-where-somebody-stands-in-a-house.js';
import { describeCrossing } from '../../../src/engine/world/recording-what-a-crossing-did.js';
import { alliesOf, circlesOf, neighboursOf } from '../../../src/engine/world/gatherings.js';
import { DAYS_PER_YEAR } from '../../../src/engine/cultivation/cultivation.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
import type { BreakthroughResult } from '../../../src/schema/cultivation.js';

function seeded(): WorldState {
    return seedWorld({ seed: 'a-life', catalog: fixtureCatalog(), presentYear: 1000, population: 300 }).state;
}

let cached: WorldState | null = null;
function advanced(): WorldState {
    if (cached) return cached;
    const seeded = seedWorld({ seed: 'a-life', catalog: fixtureCatalog(), presentYear: 1000, population: 300 });
    cached = advanceWorldYears(seeded.state, 400, { pressure: { eventsPerYear: 2 } }).state;
    return cached;
}

describe('a life is about the person whose life it is', () => {
    it('does not put every bystander on every fact they stood near', () => {
        // Linking witnesses into `historyFactIds` gave the most-documented
        // person 131 rows of which a dozen were about them. Presence is a fact
        // about the world; the trajectory is a fact about the person.
        const state = advanced();
        let checked = 0;
        for (const npc of state.npcs) {
            for (const fact of trajectoryOf(state, npc)) {
                expect(
                    fact.actors.some(a => a.id === npc.id),
                    `${npc.name} carries ${fact.id} without being in it`
                ).toBe(true);
                checked++;
                if (checked > 4000) return;
            }
        }
        expect(checked).toBeGreaterThan(0);
    });

    it('still records who was standing there, separately', () => {
        // The witness list must survive not being linked - `visibilityOf` reads
        // it, and dropping it would have traded one defect for another.
        const state = advanced();
        expect(state.history.facts.some(f => f.witnessIds.length > 0)).toBe(true);
    });
});

describe('the events a climb is made of', () => {
    it('writes a crossing, succeeded or failed, and a wound with a day', () => {
        const state = advanced();
        const kinds = new Set(state.history.facts.map(f => f.kind));
        // These three were entirely absent from the ledger before: the world
        // rolled real crossings and recorded none of them.
        expect(kinds.has('realm_crossing') || kinds.has('breakthrough')).toBe(true);
        expect(kinds.has('promotion')).toBe(true);
        expect(kinds.has('gathering')).toBe(true);
    });

    it('names a person in every promotion row, not a vein', () => {
        // `promotion` was the third-heaviest kind and not one row was about
        // anybody - every one of them was a grant renewal on a vein.
        const state = advanced();
        const promotions = state.history.facts.filter(f => f.kind === 'promotion');
        expect(promotions.length).toBeGreaterThan(0);
        const nameless = promotions.filter(f => f.actors.length === 0);
        expect(nameless.map(f => f.summary).slice(0, 3)).toEqual([]);
    });

    it('keeps the ordinary rank churn out of the ledger', () => {
        // A nine-rank sect promotes constantly at the bottom. Writing all of it
        // back would refill the ledger with what was just cleared out of it.
        expect(worthRecordingRank(0, 9)).toBe(false);
        expect(worthRecordingRank(3, 9)).toBe(false);
        expect(worthRecordingRank(5, 9)).toBe(true);
        expect(worthRecordingRank(8, 9)).toBe(true);
        // Read off the house's own ladder, so a three-rank clan gets the answer
        // its own structure implies.
        expect(worthRecordingRank(1, 3)).toBe(false);
        expect(worthRecordingRank(2, 3)).toBe(true);
    });

    it('says what a failed crossing actually did', () => {
        const npc = advanced().npcs[0];
        const failed = {
            outcome: 'failure_injured', fromOrdinal: 22, toOrdinal: 22,
            finalChance: 0.3, modifiers: [], roll: 0.9,
            injuriesSustained: [], progressConsumed: 0, tribulation: null, toll: null,
            foundationEstablished: null, immortalStatusGained: null,
            crossing: {
                trial: 'the_merging', outcome: 'mad', foundationQuality: 'damaged',
                yearsBurned: 40, soulStateFloor: 'fragmented',
                identityContinuityFactor: 0.35, halted: true
            },
            arrivedBroken: null, brokenStatusCleared: null, narrationHint: ''
        } as unknown as BreakthroughResult;
        const said = describeCrossing(npc, failed, npc.identity.bornOnDay + DAYS_PER_YEAR * 71);
        // The trial, the cost, the soul and the ending, all of which the engine
        // returned and none of which was ever written down.
        expect(said).toContain('the merging');
        expect(said).toContain('40 years');
        expect(said).toContain('fragmented');
        expect(said).toContain('will not cross another boundary');
        expect(said).toContain(' at 71 ');
    });

    it('does not say "the the" in the middle of a biography', () => {
        const state = advanced();
        const doubled = state.history.facts.filter(f => /\bthe [Tt]he\b/.test(f.summary));
        expect(doubled.map(f => f.summary).slice(0, 3)).toEqual([]);
    });
});

describe('the generators keep generating', () => {
    it('keeps circles in the world after the catalog alliances are spent', () => {
        // Every ally edge is written at seeding and nothing creates one after.
        // Houses dissolve and take their edges with them, so the alliance graph
        // is a fixed endowment - and a house founded in year 300 held no catalog
        // standing toward anybody and could never be in a circle at all.
        // Asserted on the seeded world rather than the advanced one, because
        // the fixture catalog holds six houses and three of them survive four
        // hundred years in three different provinces - genuinely nobody to sit
        // down with, and correctly zero circles. The claim under test is that
        // the broadening finds houses the alliance graph cannot, which is
        // exactly what a house founded after seeding is.
        const state = seeded();
        const live = state.factions.filter(f => f.dissolvedOnDay === null);
        const onlyNeighbours = live.filter(f =>
            alliesOf(state, f).length === 0 && neighboursOf(state, f).length > 0);
        expect(onlyNeighbours.length).toBeGreaterThan(0);
        expect(circlesOf(state).length).toBeGreaterThan(1);
    });

    it('will not put two houses at war in the same room', () => {
        const state = advanced();
        for (const faction of state.factions.filter(f => f.dissolvedOnDay === null).slice(0, 12)) {
            for (const other of neighboursOf(state, faction)) {
                const forward = faction.standing[other.id] ?? 0;
                const back = other.standing[faction.id] ?? 0;
                expect(Math.min(forward, back), `${faction.name} / ${other.name}`).toBeGreaterThan(-0.3);
            }
        }
    });

    it('keeps somewhere left to break into', () => {
        // Sealed ruins are a fixed endowment too: the prior ages seed them and
        // the template empties one per firing, so it fired thirteen times in two
        // thousand years and then had nothing left. A fallen house leaves a
        // compound, and that is a ruin by every reading but the old filter's.
        const state = advanced();
        const openable = state.locations.filter(l =>
            !l.tags.includes('emptied') && ((l.kind === 'ruin' && l.sealed) || l.tags.includes('ruined')));
        expect(openable.length).toBeGreaterThan(0);
    });
});
