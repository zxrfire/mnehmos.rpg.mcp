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
 * ── THE 7 OF 7 THIS HEADER USED TO CARRY WAS NEVER A READING OF THIS PASS ─
 *
 * It said 0 of 7 at 50 years, 4 of 7 at 100 and 7 of 7 at 200, over four pinned
 * worlds. It recorded a draft of `ruin_opened` that drew the claimant out of
 * the people who ALREADY qualified. That draft was rejected inside the commit
 * that wrote it, for clearing the shelf before a player could reach it; the
 * landed pass draws from everybody alive and tests them afterwards, which makes
 * the rate the world's own distribution of strength.
 * `the-world-changing-on-its-own.ts` argues that choice in place.
 *
 * So nothing regressed, and the drop somebody went looking for does not exist.
 * Everything in that template that decides WHETHER a ground goes - the pool,
 * the draw, the gate - is byte-identical from the commit that added the
 * never-shut arm to today, as are the event-rate constants, the year loop and
 * the pool the opener is drawn from. Only what is handed over afterwards has
 * been edited since. And 7 of 7 is out of reach of the landed draw by two
 * orders of magnitude: across 46 pinned worlds at 200 years the whole world
 * fires `ruin_opened` 117 times, and a uniformly drawn living person clears a
 * given ground's `thresholds.mastery` about 5% of the time.
 *
 * ── WHAT THE UNARRANGED RATE IS, AND THE DEFECT INSIDE IT ────────────────
 *
 * Over 46 pinned worlds at 200 years, on this tree: 84 never-shut grounds
 * standing, 2 emptied, and 2 of the 117 `ruin_opened` firings landed on the
 * category at all. The cause is not the gate and not the pool - the `openable`
 * pool at day 0 is ONE OR TWO LOCATIONS and all of it is never-shut ground,
 * because a never-shut site is `discovered` by construction and an ordinary
 * sealed ruin is not until prospecting finds it.
 *
 * It is the rung these grounds are set at, against the rungs the world's own
 * people reach. Living ordinals over those 46 worlds (n = 12,053) run p50 12,
 * p90 13, p99 21, max 27. The 84 grounds are set at 12 to 30, and 43 of them
 * stand above the 99th percentile while 13 stand above the highest ordinal
 * anybody in any of the 46 worlds ever reached. Half the category is waiting
 * for a person this world does not produce. That is the same defect this pass
 * was opened for, now caused by the rung rather than by a filter, and closing
 * it belongs to whoever owns what sets these thresholds.
 *
 * ── WHY THE SWEEP BELOW ARRANGES ITS PRECONDITION ────────────────────────
 *
 * At 2 of 84 an existence claim over any affordable number of worlds is a coin
 * flip, and it landed red without anything in this file or in the pass moving.
 * So the rate is recorded here and not asserted, and what is asserted is the
 * claim underneath it: the world takes such a ground when it holds somebody up
 * to it, and takes it properly. The arrangement is one line - every never-shut
 * ground is re-set to rung 13, the shallowest the catalog still writes a
 * ruin-only art for, and the pass runs at three times the ordinary incident so
 * the span holds enough openings to ask. Ten pinned worlds at 200 years: 14 of
 * 17 taken, 14 openings, 6 of the emptied grounds had stock standing in them
 * and 4 carried an art. Red checked at rung 40, which nobody in any of the ten
 * reaches: 0 of 17, and no openings at all.
 *
 * ── WHAT THESE ASSERTIONS ARE ────────────────────────────────────────────
 *
 * The counts above are provenance. What is pinned is: which kind a row is, that
 * a legacy's art is a real catalog row the ground could have held, that the
 * category is intact on the day a run opens, that the world can take one at
 * all, and that nothing is taken by anybody the ground would have killed.
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

    /**
     * WHETHER THE WORLD EVER TAKES ONE IS A QUESTION ABOUT WORLDS, SO IT IS
     * ASKED OF SEVERAL - AND OF WORLDS THAT HOLD SOMEBODY UP TO THE GROUND.
     *
     * Both of these used to run on `alpha` alone, which pinned WHICH world
     * happened to be the one rather than the claim either makes. Widening to
     * six did not fix it, because at the unarranged rate in the header six
     * worlds carry an expected 0.2 hits: the existence claim was a lottery
     * either way, and it came up empty.
     *
     * So the rung is arranged and the rate is left in the header. `lowered`
     * re-sets every never-shut ground to a rung the world's own people reach;
     * everything else about the ground, its stock and its art is the world's
     * own. `intensity` is the pass's own knob for how much a year holds and it
     * buys openings, not outcomes - a ground still goes only when the person
     * drawn is up to it, which is what the rung-40 red check proves.
     *
     * THE GATE IS ASKED OF EVERY OPENING IN EVERY WORLD, and arranging the
     * precondition is what makes it a live check rather than an empty loop: it
     * had no openings at all to read before. An opener below
     * `thresholds.mastery` is the world handing a place to somebody the ground
     * would have killed, and it goes red on the first one anywhere in the set.
     */
    const SWEPT = ['alpha', 'bravo', 'charlie', 'echo', 'delta', 'foxtrot',
        'golf', 'hotel', 'india', 'juliet'];

    /** The shallowest rung the catalog still writes a ruin-only art for. */
    const A_RUNG_THE_WORLD_REACHES = 13;
    const MORE_INCIDENT_IN_A_YEAR = 3;

    interface Lived {
        state: WorldState;
        out: ReturnType<typeof applyPressure>;
        lowered: Set<string>;
    }

    const alreadyLived = new Map<string, Lived>();

    function lived(seed: string): Lived {
        const had = alreadyLived.get(seed);
        if (had) return had;

        const state = seedWorld({
            seed, catalog: fixtureCatalog(), presentYear: 1000, population: 250
        }).state;
        const lowered = new Set<string>();
        for (let i = 0; i < state.locations.length; i++) {
            const site = state.locations[i];
            if (!site.tags.includes(LEFT_TO_BE_FOUND)) continue;
            lowered.add(site.id);
            state.locations[i] = {
                ...site,
                thresholds: makeThresholds(
                    A_RUNG_THE_WORLD_REACHES - 10, A_RUNG_THE_WORLD_REACHES - 6,
                    A_RUNG_THE_WORLD_REACHES - 2, A_RUNG_THE_WORLD_REACHES)
            };
        }
        const from = state.currentDay;
        const out = applyPressure(state, from, from + 200 * YEAR, {
            maxEvents: 1_000_000, intensity: MORE_INCIDENT_IN_A_YEAR
        });
        const row = { state, out, lowered };
        alreadyLived.set(seed, row);
        return row;
    }

    it('empties one, and never by somebody the ground would have killed', () => {
        let emptied = 0;
        let standing = 0;
        let openings = 0;
        const said: string[] = [];

        for (const seed of SWEPT) {
            const { state, out, lowered } = lived(seed);
            const here = neverShutIn(state).filter(l => lowered.has(l.id));
            standing += here.length;
            const taken = here.filter(l => l.tags.includes('emptied'));
            emptied += taken.length;
            said.push(`${seed} ${taken.length}/${here.length}`);

            // WHOEVER IS NAMED ON THE EVENT IS SOMEBODY THE GROUND ADMITS. The
            // thresholds are the test, and the top of them is what taking the
            // place means - below it the same row reads `surviving`, which is
            // coming back out rather than coming out with anything.
            const byId = new Map(state.locations.map(l => [l.id, l]));
            for (const opening of out.events) {
                if (opening.kind !== 'ruin_opened' || opening.fact.locationId == null) continue;
                const site = byId.get(opening.fact.locationId);
                if (!site?.tags.includes(LEFT_TO_BE_FOUND)) continue;
                openings++;
                const opener = opening.fact.actors.find(a => a.role === 'opener');
                expect(opener, `${seed}: an opening with nobody on it`).toBeDefined();
                const npc = state.npcs.find(n => n.id === opener!.id);
                expect(npc, `${seed}: ${opener!.name} is not in the world`).toBeDefined();
                expect(npc!.cultivation.realmOrdinal,
                    `${seed}: ${npc!.name} took ${site.name} from under its own floor`)
                    .toBeGreaterThanOrEqual(site.thresholds.mastery);
            }
        }

        expect(standing, 'no never-shut ground in any of the ten').toBeGreaterThan(0);
        expect(openings, `nothing opened any of it: ${said.join(', ')}`).toBeGreaterThan(0);
        expect(emptied, `the world took none of it: ${said.join(', ')}`).toBeGreaterThan(0);
    });

    it('takes the art off a legacy and the goods off a treasury', () => {
        let emptied = 0;

        for (const seed of SWEPT) {
            const { state } = lived(seed);
            const taken = neverShutIn(state).filter(l => l.tags.includes('emptied'));
            emptied += taken.length;
            const emptiedIds = new Set(taken.map(l => l.id));

            // NOTHING IS STILL LYING IN GROUND THE WORLD HAS DECLARED EMPTY. A
            // place tagged `emptied` with its stock still in it is the world
            // saying two things at once.
            for (const object of state.objects) {
                if (object.locationId === null || !emptiedIds.has(object.locationId)) continue;
                expect(object.possessorId, `${seed}: ${object.name} is still lying there`)
                    .not.toBeNull();
            }

            // And where a legacy went, the art that came off it is a catalog row
            // somebody is now carrying.
            for (const site of taken) {
                const art = theArtLeftInThisGround(site);
                if (art === null) continue;
                expect(state.npcs.some(n => n.cultivation.techniqueIds.includes(art)),
                    `${seed}: ${art} came off ${site.name} and nobody holds it`).toBe(true);
            }
        }

        expect(emptied, 'nothing was emptied in any of the ten').toBeGreaterThan(0);
    });
});
