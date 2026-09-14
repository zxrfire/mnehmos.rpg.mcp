/**
 * A third kind of ancient ground: the kind with no door on it at all.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * Asked about doors on a season, the design owner added that some ground never
 * shuts, and named what belongs in it: tombs and inheritance grounds. A place
 * that opens once in six centuries is sealing itself against the world. A tomb
 * is not doing that, and neither is a legacy a master left for whoever proved
 * able to take it - both were built to be reached.
 *
 * The record answered two ways before: `CONVERGENT_SHARE` gave four in ten a
 * cycle and the rest were *"simply shut and stay that way until somebody opens
 * them."* Neither is this.
 *
 * ── NEVER SHUTTING IS NOT THE SAME AS EASY ───────────────────────────────
 *
 * A door is one kind of gate and it is the only kind the cycled ruins have.
 * Ground that stands open has its gate INSIDE, and nothing new was written for
 * it: `LocationThresholds` is already a statement about who survives being
 * somewhere, `evaluateAccess` already reads it, the formation is still running
 * at the setting it was left at, and whatever was left walking around is still
 * walking around. What comes OFF such a row is the seal, the hazard that names
 * one, and the gap between what the vein holds and what anybody can reach.
 *
 * ── THE SHARE, MEASURED ──────────────────────────────────────────────────
 *
 * Derived rather than drawn: a hoard behind it and a name still on it is a
 * legacy, and ground whose builder the world never recorded is nobody's
 * bequest. Over twelve pinned worlds, 144 seeded ruins:
 *
 *   a season                      60   41.7%
 *   shut until somebody opens it  62   43.1%
 *   never shut                    22   15.3%
 *
 *   one to three per world, and one world of the twelve has none. The first
 *   cut took `documented` provenance alone and gave 6 of 144 - half the worlds
 *   had none at all, which is a category that may as well not exist.
 *
 * The counts are provenance. What is asserted is that all three exist, that the
 * third is the rarest, and what gates one.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import {
    LEFT_TO_BE_FOUND,
    evaluateAccess,
    isOpenOn,
    type LocationRecord
} from '../../../src/engine/world/locations.js';
import {
    howThisGroundIsShut,
    whatShutsThisDoor
} from '../../../src/engine/world/a-door-that-closes-is-not-a-door-nobody-opened.js';
import {
    A_HOARD_WORTH_WAITING_FOR,
    howThisGroundIsKept
} from '../../../src/engine/world/how-long-a-door-stays-shut.js';
import { whatTheDoorOfThisRuinSays } from '../../../src/web/walking-up-to-a-door-that-closes.js';

const YEAR = 365;

function world(seed: string): LocationRecord[] {
    return seedWorld({
        seed, catalog: fixtureCatalog(), presentYear: 1000, population: 250
    }).state.locations;
}

function ruinsOf(seed: string): LocationRecord[] {
    return world(seed).filter(l => l.kind === 'ruin');
}

describe('ground that never shut', () => {
    it('is a third answer, and not either of the two that existed', () => {
        const leftOpen = howThisGroundIsKept({
            id: 'ruin-legacy', hoardCount: A_HOARD_WORTH_WAITING_FOR, leftByName: true
        });
        expect(leftOpen).toBe('never_shut');

        // The same hoard with nobody's name on it is not a bequest, and a name
        // with nothing behind it is not one either. Both fall back to the two
        // answers that were already there.
        expect(howThisGroundIsKept({
            id: 'ruin-legacy', hoardCount: A_HOARD_WORTH_WAITING_FOR, leftByName: false
        })).not.toBe('never_shut');
        expect(howThisGroundIsKept({
            id: 'ruin-legacy', hoardCount: 0, leftByName: true
        })).not.toBe('never_shut');
    });

    it('leaves the world holding all three, with this one the rarest', () => {
        let season = 0;
        let shut = 0;
        let never = 0;
        for (const seed of ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']) {
            for (const ruin of ruinsOf(seed)) {
                if (ruin.tags.includes(LEFT_TO_BE_FOUND)) never++;
                else if (ruin.cycle !== null) season++;
                else shut++;
            }
        }
        expect(never).toBeGreaterThan(0);
        expect(never).toBeLessThan(season);
        expect(never).toBeLessThan(shut);
    });

    it('stands open on every day there is, and carries no schedule to wait for', () => {
        const seeds = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
        const found = seeds.flatMap(ruinsOf).filter(l => l.tags.includes(LEFT_TO_BE_FOUND));
        expect(found.length).toBeGreaterThan(0);

        for (const site of found) {
            expect(site.cycle).toBeNull();
            expect(site.sealed).toBe(false);
            // No door, so nothing shuts it and nothing is due.
            expect(whatShutsThisDoor(site)).toBeNull();
            for (const day of [0, 500 * YEAR, 1000 * YEAR, 4000 * YEAR]) {
                expect(isOpenOn(site, day)).toBe(true);
                const read = howThisGroundIsShut(site, day);
                expect(read.howItIsShut).toBe('open');
                expect(read.openDays).toBe(0);
            }
            // The pocket is being drawn on, because nothing is holding it in.
            // 0.05 is what a sealed ruin offers - the whole gap between what a
            // vein holds and what anybody can reach - and this side of it is
            // the side that says the ground is open. Not pinned to
            // `qiFraction` exactly: a crossing that enriched the vein later
            // moved `qiDensity` and left the usable figure where it was, which
            // is a second copy that predates this and is not this test's.
            expect(site.environment.spiritualDensity).toBeGreaterThan(0.05);
            expect(site.hazards).not.toContain('sealed_qi');
        }
    });

    it('is gated by what is inside it rather than by a door', () => {
        const seeds = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
        const found = seeds.flatMap(ruinsOf).filter(l => l.tags.includes(LEFT_TO_BE_FOUND));
        expect(found.length).toBeGreaterThan(0);

        for (const site of found) {
            // The formation is still running and there is still something in
            // there. That is the gate, and it is the one every ruin already had.
            expect(site.hazards).toContain('formation');
            expect(site.hazards).toContain('guardian');
            expect(site.thresholds.survival).toBeGreaterThan(0);

            const tooSmall = evaluateAccess(site, {
                realmOrdinal: Math.max(0, site.thresholds.survival - 1), onDay: 0
            });
            const upToIt = evaluateAccess(site, {
                realmOrdinal: site.thresholds.mastery, onDay: 0
            });
            // NOT CLOSED, either way. What refuses the first one is power, which
            // is the whole point of the category: the way in is open and going
            // in is still the end of them.
            expect(tooSmall.closed).toBe(false);
            expect(tooSmall.level).toBe('lethal');
            expect(upToIt.closed).toBe(false);
            expect(upToIt.level).toBe('mastered');
        }
    });

    it('tells a player it is open and that the door is not what is in the way', () => {
        const seeds = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
        const site = seeds.flatMap(ruinsOf).find(l => l.tags.includes(LEFT_TO_BE_FOUND));
        expect(site).toBeDefined();

        const said = whatTheDoorOfThisRuinSays({
            site: site!,
            day: 1000 * YEAR,
            party: { id: 'player', realmOrdinal: 20 },
            crossingDays: 3,
            escort: null,
            slip: null
        });
        const lines = said.lines.join(' ');
        expect(lines).toContain('stands open');
        expect(lines).toContain('inside it');
        // NO WINDOW AND NO WAIT. A place with no cycle priced as one comes back
        // with a window of nought that shuts on the way, which is the reading
        // saying something false about a place that has no door.
        expect(said.reading).toBeNull();
        expect(lines).not.toContain('days at a time');
        expect(lines).not.toContain('years apart');
    });
});
