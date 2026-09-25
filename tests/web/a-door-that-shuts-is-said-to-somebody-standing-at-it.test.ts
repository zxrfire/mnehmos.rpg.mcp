/**
 * Standing on a ruin that shuts, and being told so.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────
 *
 * The whole convergence design landed unreachable. `beingAtADoorOnTheDayItOpens`
 * priced both roads through a door and had **no caller anywhere in `src/web/`**,
 * so a player could walk onto ground whose window is a week and be told nothing:
 * not that it shuts, not what a window is, not what would get them in and back
 * out. It is this repository's signature defect - a system that binds the
 * simulation and never reaches the played game.
 *
 * MEASURED over twelve pinned worlds, 72 scheduled sites, walking the real link
 * graph (`scripts/probe-can-anybody-be-standing-there-on-the-day.ts`): windows
 * 7d x32, 14d x20, 30d x9, 60d x8, 90d x3, and per site 36.2% of the world's
 * houses could walk in and back out inside the window, 1.8% needed a fold and
 * 62.1% could not make it at all. That figure is a property of the MAP and this
 * routing does not move it; what the routing changes is whether the 62% are told
 * why.
 *
 * ── WHAT IS PINNED, AND WHAT IS NOT ──────────────────────────────────────
 *
 *   the routing    arriving on a cycled ruin says what the door is doing and
 *                  prices at least one road through it. Never which ruin, never
 *                  a day count - the roll is the catalog's and the schedule is
 *                  the site's own history.
 *   the gate       the wait and the window are SCHEDULE knowledge. A starting
 *                  cultivator cannot read one, so the scene says it is open
 *                  sometimes and never says when. Handing the ungated read to a
 *                  narrator is the defect `a-door-that-closes-is-not-a-door-
 *                  nobody-opened.ts` warns about in its own header.
 *   the two roads  somebody at the folding floor, or a teleportation talisman. Where
 *                  neither is here they are named anyway, which is the standing
 *                  rule: not having the standing to go in is not the same as
 *                  seeing nothing.
 *
 * RED-CHECKED, three ways, each run for real. Dropping the door lines from
 * `whatArrivingIntroduces` fails the played arm on the arrival never naming the
 * ground it ended on. Passing `escortOrdinal: null` fails the escort arm on
 * there being no escort road to price. Reporting the wait unconditionally
 * instead of behind `settingOutInAdvance` fails the played arm on the scene
 * saying when rather than that it is open sometimes.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import {
    makeLocation,
    makeThresholds,
    type LocationRecord
} from '../../src/engine/world/locations';
import { withWings } from '../../src/engine/world/provenance';
import { SCHEDULE_READ_ORDINAL } from '../../src/engine/world/convergence';
import { FOLD_FLOOR_ORDINAL } from '../../src/engine/world/how-far-somebody-can-fold-space-and-what-it-costs';
import { cutATalisman } from '../../src/engine/world/a-talisman-is-one-act-somebody-already-paid-for';
import { whatTheDoorOfThisRuinSays } from '../../src/web/walking-up-to-a-door-that-closes';
import type { CapabilityActor } from '../../src/engine/world/capability';

const WORLD = 'a-door-that-shuts';
const YEAR = 365;

/** The tight extreme the design rests on: open a week, once in sixty years. */
const A_WEEK_EVERY_SIXTY_YEARS = { periodDays: 60 * YEAR, openDays: 7, phaseDay: 0 };

/** Days in. Deeper than half a seven-day window, so the road alone does not do it. */
const THE_END_OF_IT = 5;

/** A disciple: cannot fold, cannot read records going back centuries. */
function aJunior(): CapabilityActor {
    return { id: 'npc-junior', realmOrdinal: 6 };
}

/**
 * A door with a clock on it, and one wing at a stated depth.
 *
 * The depth is stated rather than derived because the derived one is a function
 * of the thresholds and the wing count moves with a seeded draw - and what these
 * arms are about is which road covers the way back out, not how deep a ruin is.
 */
function theDoor(): LocationRecord {
    return withWings(makeLocation({
        id: 'loc-ruin-clock',
        name: 'Lone Spring',
        kind: 'ruin',
        qiDensity: 95,
        thresholds: makeThresholds(4, 8, 14, 20),
        sealed: true,
        cycle: A_WEEK_EVERY_SIXTY_YEARS,
        data: { scheduleReadOrdinal: SCHEDULE_READ_ORDINAL, scheduleKey: 'cycles:clock' }
    }), [{
        id: 'loc-ruin-clock-w1',
        name: 'the inner hall',
        sealed: true,
        state: 'untouched',
        workings: 0,
        lastWorkedOnDay: null,
        depthDays: THE_END_OF_IT
    }]);
}

/** Standing at it on the day it opens, with nothing and nobody. */
function standingThereAlone() {
    return {
        site: theDoor(),
        day: 0,
        party: aJunior(),
        crossingDays: 0,
        escort: null,
        slip: null
    };
}

describe('a door that shuts is said to somebody standing at it', () => {
    it('says what the door is doing when somebody walks onto a cycled ruin', async () => {
        const { game, repos } = await makeGameInWorld({ seed: 'door-arrival', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Walker');
        const loaded = await game.loadWorld();
        expect(loaded, 'the run opened without a world').toBeTruthy();

        // ASKED OF THE WORLD, never named. Which ruins carry a schedule is the
        // catalog's business and moves.
        const site = loaded!.locations.find(
            (row: any) => row.kind === 'ruin' && row.cycle
        );
        expect(site, 'this world seeded no ruin on a schedule').toBeTruthy();

        const turn = await game.act(`I travel to ${site!.name}`);
        expect(
            repos.cultivators.getById(cultivator.id)!.location,
            'the journey to a ruin did not happen'
        ).toBe(site!.name);

        const prose = turn.narration ?? '';
        expect(prose).toContain(site!.name);
        expect(
            /is shut|standing open/i.test(prose),
            'arriving on ground that shuts said nothing about the door'
        ).toBe(true);
        // At least one road is priced. Which one works is the site's own
        // arithmetic and is not pinned here.
        expect(
            /on foot/i.test(prose),
            'the scene never said what the road buys'
        ).toBe(true);

        // AND THE SCHEDULE STAYS BEHIND ITS GATE. A starting cultivator cannot
        // read one, so the scene says it is open sometimes and never says when.
        expect(
            /open sometimes and shut the rest of the time/i.test(prose),
            'the scene did not say the ground is open sometimes'
        ).toBe(true);
        expect(
            /years apart|The next one is/i.test(prose),
            'the wait was read out to somebody who cannot read a schedule'
        ).toBe(false);
    }, 180_000);

    it('names both roads to somebody carrying neither', () => {
        const said = whatTheDoorOfThisRuinSays(standingThereAlone());

        expect(said.reading, 'a scheduled door was priced by nothing').not.toBeNull();
        expect(said.reading!.onFoot.works).toBe(false);
        const prose = said.lines.join(' ');
        // NOT HAVING THE STANDING TO GO IN IS NOT THE SAME AS SEEING NOTHING.
        expect(/folds them in and stands at the door/i.test(prose)).toBe(true);
        expect(/teleportation talisman/i.test(prose)).toBe(true);
    });

    it('reads the escort off whoever is actually here', () => {
        const said = whatTheDoorOfThisRuinSays({
            ...standingThereAlone(),
            escort: { id: 'npc-senior', name: 'Shen Qiao', ordinal: FOLD_FLOOR_ORDINAL }
        });

        expect(said.reading!.behindASenior!.works).toBe(true);
        const prose = said.lines.join(' ');
        expect(prose).toContain('Shen Qiao');
        // A road that works stops the scene listing the roads that would.
        expect(/folds them in and stands at the door/i.test(prose)).toBe(false);
    });

    it('reads the second road off the slip somebody is carrying', () => {
        const slip = cutATalisman({
            id: 'obj-slip',
            name: 'Teleportation Talisman',
            grade: 'earth',
            what: 'a_teleportation',
            crafterId: 'npc-maker',
            crafterOrdinal: FOLD_FLOOR_ORDINAL,
            onDay: 0
        });
        const said = whatTheDoorOfThisRuinSays({ ...standingThereAlone(), slip });

        expect(said.reading!.onASlip!.works).toBe(true);
        const prose = said.lines.join(' ');
        expect(prose).toContain(slip.name);
        expect(/folds them in and stands at the door/i.test(prose)).toBe(false);
    });

    it('says nothing about a window on ground that has no schedule', () => {
        const site = { ...theDoor(), cycle: null };
        const said = whatTheDoorOfThisRuinSays({ ...standingThereAlone(), site });

        expect(said.reading).toBeNull();
        // Still not silence: a door nobody has opened is a fact about the ground.
        expect(said.lines.join(' ')).toMatch(/nothing opens it but somebody opening it/i);
    });
});
