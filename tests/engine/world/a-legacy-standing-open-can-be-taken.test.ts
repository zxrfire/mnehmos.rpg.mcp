/**
 * Ground that never shut: which of the two kinds it is, and whether the world
 * can ever take one.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * Asked what these places hold, the design owner split the category: some of
 * them have legacies, others are treasuries, and a legacy gives *"exactly the
 * same thing"* the arts already in the ground give. So there is no new prize
 * here. A legacy hands over a technique with `provenance: 'ruin'` - the set
 * `techniques.ts` defines as the arts no living institution can transmit, which
 * is where an authored trial's `prize.techniqueIds` already comes from - and a
 * treasury hands over whatever objects are standing in it, through
 * `transferPossession`.
 *
 * ── WHAT WAS MEASURED, AND WHY THE PASS CHANGED ──────────────────────────
 *
 * `ruin_opened` in the world advance is the only thing that empties ground, and
 * it tested `cycle !== null`, then `sealed`, then the `ruined` tag. Ground that
 * never shut is none of those - no cycle, not sealed, tagged
 * `left_to_be_found` - so it fell through every arm. Measured over nine pinned
 * worlds advanced 1,800 years: 1 of 13 never-shut grounds emptied, and that one
 * was a site the prospecting pass minted afterwards. The category the
 * simulation opened holding was untouchable by construction.
 *
 * With the tag in the pool and the claimant gated on `thresholds.mastery`, over
 * four pinned worlds (alpha, bravo, charlie, echo; 7 never-shut grounds):
 *
 *     50 years     0 of 7
 *     100 years    4 of 7
 *     200 years    7 of 7
 *
 * Nothing goes before the world produces somebody up to the ground, and then it
 * goes quickly. The cause is not the gate: the `openable` pool at day 0 is ONE
 * OR TWO LOCATIONS and all of it is never-shut ground, because a never-shut
 * site is `discovered` by construction and an ordinary sealed ruin is not until
 * prospecting finds it. So every firing of a weight-8 event lands on this
 * category. That is a pre-existing shape this change exposed rather than
 * created, and it is written down here because the share per century is a
 * design judgement and the number should not be found again from scratch.
 *
 * ── WHAT THESE ASSERTIONS ARE ────────────────────────────────────────────
 *
 * The counts above are provenance. What is pinned is: which kind a row is, that
 * a legacy's art is a real catalog row the ground could have held, that the
 * category is intact on the day a run opens, and that nothing is taken by
 * anybody the ground would have killed.
 */

import { describe, it, expect } from 'vitest';

import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { applyPressure } from '../../../src/engine/world/pressure.js';
import {
    LEFT_TO_BE_FOUND,
    makeEnvironment,
    makeLocation,
    makeThresholds,
    type LocationRecord
} from '../../../src/engine/world/locations.js';
import {
    theArtLeftInThisGround,
    theRungThisWasSetFor,
    whatThisGroundWasLeftHolding
} from '../../../src/engine/world/a-legacy-has-a-name-on-it-and-a-treasury-has-stock.js';
import { getTechnique } from '../../../src/data/cultivation/techniques.js';
import type { WorldState } from '../../../src/engine/world/world-state.js';

const YEAR = 365;

/** A piece of never-shut ground, carrying only what `locationFromRuin` writes. */
function ground(input: {
    id: string;
    standing: string;
    rung: number;
}): LocationRecord {
    const site = makeLocation({
        id: input.id,
        name: 'the open compound',
        kind: 'ruin',
        description: 'Left standing open.',
        ambient: 'dense',
        qiDensity: 80,
        thresholds: makeThresholds(
            Math.max(0, input.rung - 10),
            Math.max(0, input.rung - 6),
            Math.max(0, input.rung - 2),
            input.rung
        ),
        hazards: ['formation', 'guardian'],
        environment: makeEnvironment({ spiritualDensity: 0.5 }),
        discovered: true,
        tags: ['ruin', 'late_age', LEFT_TO_BE_FOUND],
        data: {
            provenanceStanding: input.standing,
            techniqueCount: 3,
            treasureCount: 2
        }
    });
    return site;
}

function neverShutIn(state: WorldState): LocationRecord[] {
    return state.locations.filter(l => l.tags.includes(LEFT_TO_BE_FOUND));
}

describe('a legacy and a treasury are told apart by the name on the thing', () => {
    it('reads documented ground as a bequest and attributed ground as stock', () => {
        expect(whatThisGroundWasLeftHolding(ground({
            id: 'loc-ruin-doc', standing: 'documented', rung: 26
        }))).toBe('a_legacy');
        expect(whatThisGroundWasLeftHolding(ground({
            id: 'loc-ruin-attr', standing: 'attributed', rung: 26
        }))).toBe('a_treasury');
    });

    it('hands a legacy an art the catalog already holds for exactly this', () => {
        const legacy = ground({ id: 'loc-ruin-doc', standing: 'documented', rung: 26 });
        const id = theArtLeftInThisGround(legacy);
        expect(id).not.toBeNull();

        // A REAL ROW, not a marker. The whole of the ruling is that these
        // grounds give what the arts in the ground already give.
        const art = getTechnique(id!);
        expect(art).toBeDefined();
        expect(art!.provenance).toBe('ruin');
        expect(art!.survivingCopy).toBe(true);
        // And an art whoever set the trial could have been carrying.
        expect(art!.requiredOrdinal).toBeLessThanOrEqual(theRungThisWasSetFor(legacy));
    });

    it('gives a treasury no art, because what is in it is things', () => {
        expect(theArtLeftInThisGround(ground({
            id: 'loc-ruin-attr', standing: 'attributed', rung: 26
        }))).toBeNull();
    });

    it('answers the same ground the same way, because it is derived', () => {
        const a = ground({ id: 'loc-ruin-same', standing: 'documented', rung: 31 });
        const b = ground({ id: 'loc-ruin-same', standing: 'documented', rung: 31 });
        expect(theArtLeftInThisGround(a)).toBe(theArtLeftInThisGround(b));
        // And two grounds of one height are not forced to be the same book.
        expect(theArtLeftInThisGround(ground({
            id: 'loc-ruin-other', standing: 'documented', rung: 31
        }))).not.toBeNull();
    });

    it('holds no art at a depth nothing in the catalog was written for', () => {
        // The shallowest ruin-only art demands more of a reader than this
        // ground demands of a claimant, so there is nothing here to read and
        // the place is stock.
        expect(theArtLeftInThisGround(ground({
            id: 'loc-ruin-shallow', standing: 'documented', rung: 8
        }))).toBeNull();
    });
});

describe('the world can take one, and only somebody up to it can', () => {
    it('leaves the category whole on the day a run opens', () => {
        const state = seedWorld({
            seed: 'legacy-day-nought', catalog: fixtureCatalog(),
            presentYear: 1000, population: 250
        }).state;
        const found = neverShutIn(state);
        expect(found.length).toBeGreaterThan(0);
        for (const site of found) expect(site.tags).not.toContain('emptied');
    });

    it('empties one, and never by somebody the ground would have killed', () => {
        const state = seedWorld({
            seed: 'alpha', catalog: fixtureCatalog(), presentYear: 1000, population: 250
        }).state;
        const from = state.currentDay;
        const out = applyPressure(state, from, from + 200 * YEAR, { maxEvents: 1_000_000 });

        const taken = neverShutIn(state).filter(l => l.tags.includes('emptied'));
        expect(taken.length).toBeGreaterThan(0);

        // WHOEVER IS NAMED ON THE EVENT IS SOMEBODY THE GROUND ADMITS. The
        // thresholds are the test, and the top of them is what taking the place
        // means - below it the same row reads `surviving`, which is coming back
        // out rather than coming out with anything.
        const byId = new Map(state.locations.map(l => [l.id, l]));
        const openings = out.events.filter(e =>
            e.kind === 'ruin_opened' && e.fact.locationId != null
            && byId.get(e.fact.locationId)?.tags.includes(LEFT_TO_BE_FOUND));
        expect(openings.length).toBeGreaterThan(0);
        for (const opening of openings) {
            const site = byId.get(opening.fact.locationId!)!;
            const opener = opening.fact.actors.find(a => a.role === 'opener');
            expect(opener).toBeDefined();
            const npc = state.npcs.find(n => n.id === opener!.id);
            expect(npc).toBeDefined();
            expect(npc!.cultivation.realmOrdinal).toBeGreaterThanOrEqual(site.thresholds.mastery);
        }
    });

    it('takes the art off a legacy and the goods off a treasury', () => {
        const state = seedWorld({
            seed: 'alpha', catalog: fixtureCatalog(), presentYear: 1000, population: 250
        }).state;
        const from = state.currentDay;
        applyPressure(state, from, from + 200 * YEAR, { maxEvents: 1_000_000 });

        const taken = neverShutIn(state).filter(l => l.tags.includes('emptied'));
        expect(taken.length).toBeGreaterThan(0);
        const emptiedIds = new Set(taken.map(l => l.id));

        // NOTHING IS STILL LYING IN GROUND THE WORLD HAS DECLARED EMPTY. A
        // place tagged `emptied` with its stock still in it is the world saying
        // two things at once.
        for (const object of state.objects) {
            if (object.locationId === null || !emptiedIds.has(object.locationId)) continue;
            expect(object.possessorId).not.toBeNull();
        }

        // And where a legacy went, the art that came off it is a catalog row
        // somebody is now carrying.
        for (const site of taken) {
            const art = theArtLeftInThisGround(site);
            if (art === null) continue;
            expect(state.npcs.some(n => n.cultivation.techniqueIds.includes(art))).toBe(true);
        }
    });
});
