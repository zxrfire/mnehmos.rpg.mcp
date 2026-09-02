/**
 * A house builds a hull out of what its parties brought home.
 *
 * `building-a-conveyance-out-of-what-a-hunt-brings-back.ts` had no consumer
 * anywhere in `src/`. `layDownKeel`, `deliver`, `workOn`, `readyToLaunch`,
 * `lotSatisfies`, `whatIsStillShort`, `conveyanceKeptAs` and `mintCraft` were
 * all zero-reference, so the second destination that module exists to give a
 * beast material did not exist and `TRACKED_CRAFT` was a catalog of hulls
 * nobody had ever built.
 *
 * These pin the loop, not the arithmetic - the arithmetic has its own tests.
 * What could not have passed before is that a world produces any of it.
 */
import { describe, expect, it } from 'vitest';

import { loadCultivationCatalog } from '../../../src/engine/world/catalog.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { advanceWorldYears } from '../../../src/engine/world/driver.js';
import {
    countedHolding,
    describeCountedHoldings
} from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { conveyanceKeptAs } from '../../../src/engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';

describe('a house builds something out of what came back', () => {
    /**
     * Three seeds, advanced once and shared.
     *
     * POOLED, because a tracked craft is rare BY DESIGN - a heaven-grade bill
     * is forty-six pieces including two cores and seven hundred days of work
     * by a hand at Void Refinement, and the module's own line is that almost
     * nothing at heaven grade is ever built. One seed produced three and the
     * next produced none, which is what that sentence looks like from close
     * up rather than a defect. AGENTS.md: pool the sample, never widen the bar.
     */
    const worlds = (async () => {
        const catalog = await loadCultivationCatalog();
        return ['yard-a', 'yard-b', 'yard-c'].map(seed => {
            const { state } = seedWorld({ seed, catalog });
            return advanceWorldYears(state, 500).state;
        });
    })();

    it('lays keels, launches some and loses some, over five centuries', async () => {
        const yard = (await worlds).flatMap(
            state => state.history.facts.filter(f => f.data.conveyanceRecipe !== undefined)
        );
        expect(yard.length).toBeGreaterThan(10);
        expect(yard.some(f => f.data.launched === 1)).toBe(true);
        // A failure consumes the materials and leaves the yard with nothing.
        // That is the honest price and it is why a launch is an event a house
        // remembers - a world in which every build succeeds has no such event.
        expect(yard.some(f => f.data.launched === 0)).toBe(true);
    }, 900_000);

    it('puts counted craft in the yard', async () => {
        for (const state of await worlds) {
            const live = state.factions.filter(f => f.dissolvedOnDay === null);
            expect(live.some(
                f => !/Nothing in the yard/.test(describeCountedHoldings(f.resources))
            )).toBe(true);
        }
    }, 900_000);

    it('puts a tracked craft on the record, with a chain that starts at link one', async () => {
        // THE GRADE DECIDES THE SIDE OF THE LINE. A counted craft is a number
        // with nothing to recognise; a tracked one is a row with a maker, a
        // day and a witness - which is the opposite of everything else tracked
        // in this world, where the interesting objects are the ones nobody can
        // find a giver for.
        const craft = (await worlds).flatMap(
            state => state.objects.filter(o => o.tags.includes('conveyance'))
        );
        expect(craft.length).toBeGreaterThan(0);
        for (const row of craft) {
            expect(conveyanceKeptAs('heaven')).toBe('tracked');
            expect(row.ownerId).not.toBeNull();
            // Moored, never carried. A craft with a possessor is one
            // `bestObjectHeldBy` would arm somebody with.
            expect(row.possessorId).toBeNull();
            expect(row.provenance.length).toBeGreaterThan(0);
            expect(row.provenance[0].how).toBe('crafted');
        }
    }, 900_000);

    it('stops at what the house is short of, and reaches for the bill above it', async () => {
        // Without a ceiling a house builds the same carriage forever -
        // measured at eight of them in one yard - and never reaches the bill
        // that produces the only tracked craft anybody makes.
        for (const state of await worlds) {
            for (const faction of state.factions) {
                expect(countedHolding(faction.resources, 'conv-carriage-mortal'))
                    .toBeLessThanOrEqual(3);
                expect(countedHolding(faction.resources, 'conv-carriage-earth'))
                    .toBeLessThanOrEqual(3);
            }
        }
    }, 900_000);
});
