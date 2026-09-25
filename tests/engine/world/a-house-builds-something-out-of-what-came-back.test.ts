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

import { soakedWorld } from '../../support/soaked-world.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';
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
     * by a hand at Void Tribulation, and the module's own line is that almost
     * nothing at heaven grade is ever built. One seed produced three and the
     * next produced none, which is what that sentence looks like from close
     * up rather than a defect. AGENTS.md: pool the sample, never widen the bar.
     *
     * LAZY, AND THAT IS LOAD-BEARING. This was `const worlds = (async () =>
     * ...)()` in this describe body, and the file then could not run at all:
     * `[vitest-worker]: Timeout calling "resolveSnapshotPath"`, one unhandled
     * error, four tests never run, and a suite that reports 915 files passing
     * and says nothing about the four claims it dropped.
     *
     * The `await` hands control back, so `describe` returns and collection
     * completes; the three builds - a minute of unbroken synchronous work -
     * then run in a microtask AFTER collection, which is exactly the window
     * where the worker is waiting on `resolveSnapshotPath`. That call's budget
     * is 60s (`DEFAULT_TIMEOUT = 6e4` in birpc) and vitest 1.6.1 threads no
     * option to it, so the plaster of raising it does not exist.
     *
     * Three runs of this one file alone, no contention:
     *
     *     eager, 22:37   53.88s   collect 3.40s   tests 5ms      4 passed
     *     lazy,  22:56   65.03s   collect 3.79s   tests 60.96s   3 passed, 1 failed
     *     eager, 22:59   75.67s   collect 4.55s   tests 0ms      0 ran, 1 error
     *
     * The first and third are the same code: the world pass got heavier during
     * the evening and carried the build past 60s, which is the whole difference
     * between a file that squeaks in and a file that vanishes. `tests 5ms` and
     * `tests 0ms` against a minute of wall clock are the signature - time
     * charged to nothing is time spent where vitest cannot see it.
     *
     * Deferring the build to whoever asks for it first puts that minute inside
     * a test, where the 900s timeouts below cover it and no RPC is in flight.
     * `a-lookup-is-a-memo-not-a-second-store.test.ts` and
     * `the-world-produces-its-own.test.ts` already do this, for this reason.
     */
    let built: Promise<WorldState[]> | null = null;
    function worlds(): Promise<WorldState[]> {
        // Kept and shared: see `tests/support/soaked-world.ts`.
        built ??= (async () => {
            const out: WorldState[] = [];
            for (const seed of ['yard-a', 'yard-b', 'yard-c']) out.push(await soakedWorld(seed, { years: 500 }));
            return out;
        })();
        return built;
    }

    it('lays keels, launches some and loses some, over five centuries', async () => {
        const yard = (await worlds()).flatMap(
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
        for (const state of await worlds()) {
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
        const craft = (await worlds()).flatMap(
            state => state.objects.filter(o => o.tags.includes('conveyance'))
        );
        expect(craft.length).toBeGreaterThan(0);

        // AND A HOUSE THAT FELL OWNS NOTHING, which is why this asks about
        // the owner rather than asserting there is one. The design owner:
        // *"once a faction ends, their item ownership is marked now as
        // whoever is holding it... so in ruins that owners are long gone, no
        // owner."* A boat moored in a yard nobody walked out of has nobody
        // to answer for it, and that is a find rather than a gap. What must
        // never happen is the third state this used to allow: a row still
        // naming an institution that stopped existing centuries ago.
        const standing = new Set((await worlds()).flatMap(
            state => state.factions.filter(f => f.dissolvedOnDay === null).map(f => f.id)
        ));
        for (const row of craft) {
            expect(conveyanceKeptAs('heaven')).toBe('tracked');
            if (row.ownerId !== null) expect(standing.has(row.ownerId)).toBe(true);
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
        for (const state of await worlds()) {
            for (const faction of state.factions) {
                expect(countedHolding(faction.resources, 'conv-carriage-mortal'))
                    .toBeLessThanOrEqual(3);
                expect(countedHolding(faction.resources, 'conv-carriage-earth'))
                    .toBeLessThanOrEqual(3);
            }
        }
    }, 900_000);
});
