/**
 * A week of window, a road longer than a week, and two ways through.
 *
 * The design owner, on why a short window is the mechanic rather than a
 * nuisance: *"these close too fast for those juniors to get to the end. either
 * a 29+ goes in to help, or a junior uses a talisman."* Both roads already
 * existed and neither had ever been pointed at a door with a clock on it.
 *
 * MEASURED over twelve pinned worlds, 72 scheduled sites, over the real link
 * graph (`scripts/probe-can-anybody-be-standing-there-on-the-day.ts`): windows
 * 7d x32, 14d x20, 30d x9, 60d x8, 90d x3; nearest house seat 1 to 5 walking
 * days, farthest 19 to 30. Per site, 36.2% of the world's houses could walk in
 * and back out inside the window, 1.8% needed a fold, and 62.1% could not make
 * it at all - and at the seven-day windows the walkable share is 0 to 8%. So
 * the roads are for the majority of the world, not for an edge case.
 *
 * WHAT THESE PIN is that the three roads differ in the right direction and for
 * the right reason. Not a day count, not a rung - those are the tuning that
 * `how-long-a-door-stays-shut.ts` and the fold curve own.
 *
 * The most important one is the last: KNOWING WHEN is itself a road. A party
 * that can read the schedule spends none of the window on the journey, and at
 * seven days that is the whole difference. `readSchedule` had no caller in the
 * tree when this was written.
 */

import { describe, it, expect } from 'vitest';
import {
    makeLocation,
    makeThresholds,
    type LocationRecord
} from '../../../src/engine/world/locations.js';
import { beingAtADoorOnTheDayItOpens } from '../../../src/engine/world/being-at-a-door-on-the-day-it-opens.js';
import { FOLD_FLOOR_ORDINAL } from '../../../src/engine/world/how-far-somebody-can-fold-space-and-what-it-costs.js';
import { SCHEDULE_READ_ORDINAL } from '../../../src/engine/world/convergence.js';
import type { CapabilityActor } from '../../../src/engine/world/capability.js';

const YEAR = 365;
/** Open a week, once a lifetime. The tight extreme the owner named. */
const A_WEEK_EVERY_SIXTY_YEARS = { periodDays: 60 * YEAR, openDays: 7, phaseDay: 0 };
/** Days of road, longer than the window and out of a fold's reach at the floor. */
const A_LONG_ROAD = 9;
/** Days of road a fold at the floor does cover. */
const A_SHORT_ROAD = 4;
/** Days in. What "the end of it" costs, and more than half a seven-day window. */
const THE_END_OF_IT = 5;
/** A shallow wing, reachable inside the window on foot. */
const JUST_INSIDE_THE_DOOR = 2;

function theDoor(cycle = A_WEEK_EVERY_SIXTY_YEARS): LocationRecord {
    return makeLocation({
        id: 'loc-ruin-clock',
        name: 'Cold Spring',
        kind: 'ruin',
        qiDensity: 95,
        thresholds: makeThresholds(4, 8, 14, 20),
        sealed: true,
        cycle,
        data: { scheduleReadOrdinal: SCHEDULE_READ_ORDINAL, scheduleKey: 'cycles:clock' }
    });
}

/** A disciple. Cannot fold, cannot read a schedule going back centuries. */
function aJunior(): CapabilityActor {
    return { id: 'npc-junior', realmOrdinal: 6 };
}

/** The same disciple, holding the records their house keeps. */
function aJuniorWhoWasTold(): CapabilityActor {
    return {
        id: 'npc-junior',
        realmOrdinal: SCHEDULE_READ_ORDINAL + 2,
        knowledgeIds: ['cycles:clock']
    };
}

/** Halfway through the window, having heard it was open. */
const HALFWAY_IN = 3;

describe('a junior at a door with the clock against them', () => {
    it('shuts on a junior who set out when they heard, and walked', () => {
        const read = beingAtADoorOnTheDayItOpens({
            location: theDoor(),
            day: HALFWAY_IN,
            party: aJunior(),
            crossingDays: A_LONG_ROAD,
            depthWanted: JUST_INSIDE_THE_DOOR
        });

        expect(read.settingOutInAdvance).toBe(false);
        expect(read.onFoot.works).toBe(false);
        // A refusal that names what is actually here, why it is not theirs, and
        // what would change it. Never a blank no.
        expect(read.onFoot.refusal).not.toBeNull();
        expect(read.reason).toContain('window');
    });

    it('opens when somebody who can fold takes them out', () => {
        const withoutHelp = beingAtADoorOnTheDayItOpens({
            location: theDoor(),
            day: HALFWAY_IN,
            party: aJunior(),
            crossingDays: A_SHORT_ROAD,
            depthWanted: THE_END_OF_IT
        });
        const withHelp = beingAtADoorOnTheDayItOpens({
            location: theDoor(),
            day: HALFWAY_IN,
            party: aJunior(),
            crossingDays: A_SHORT_ROAD,
            depthWanted: THE_END_OF_IT,
            escortOrdinal: FOLD_FLOOR_ORDINAL
        });

        expect(withoutHelp.behindASenior).toBeNull();
        expect(withHelp.behindASenior).not.toBeNull();
        expect(withHelp.behindASenior!.works).toBe(true);
        // The escort buys both legs: the road costs nothing, and they are still
        // standing there to cover the way back out.
        expect(withHelp.behindASenior!.daysToTheDoor)
            .toBeLessThan(withHelp.onFoot.daysToTheDoor);
        expect(withHelp.behindASenior!.depthItBuys)
            .toBeGreaterThan(withHelp.onFoot.depthItBuys);
    });

    it('refuses an escort who is not high enough to fold, and says so', () => {
        const read = beingAtADoorOnTheDayItOpens({
            location: theDoor(),
            day: HALFWAY_IN,
            party: aJunior(),
            crossingDays: A_SHORT_ROAD,
            depthWanted: THE_END_OF_IT,
            escortOrdinal: FOLD_FLOOR_ORDINAL - 1
        });

        expect(read.behindASenior!.works).toBe(false);
        expect(read.behindASenior!.refusal).toContain('fold');
    });

    it('lets a junior borrow one fold they could never perform', () => {
        // Standing at the door on the day, and the end of it is further in than
        // half a seven-day window. This is the owner's sentence exactly: the
        // clock is not the road, it is the depth.
        const empty = beingAtADoorOnTheDayItOpens({
            location: theDoor(),
            day: HALFWAY_IN,
            party: aJuniorWhoWasTold(),
            crossingDays: A_SHORT_ROAD,
            depthWanted: THE_END_OF_IT
        });
        const carrying = beingAtADoorOnTheDayItOpens({
            location: theDoor(),
            day: HALFWAY_IN,
            party: aJuniorWhoWasTold(),
            crossingDays: A_SHORT_ROAD,
            depthWanted: THE_END_OF_IT,
            slipCutAtOrdinal: FOLD_FLOOR_ORDINAL
        });

        expect(empty.onASlip).toBeNull();
        expect(carrying.onASlip).not.toBeNull();
        expect(carrying.onASlip!.works).toBe(true);
        expect(carrying.onFoot.works).toBe(false);
    });

    it('will not let one slip buy both legs', () => {
        const read = beingAtADoorOnTheDayItOpens({
            location: theDoor(),
            day: HALFWAY_IN,
            party: aJunior(),
            crossingDays: A_SHORT_ROAD,
            depthWanted: THE_END_OF_IT,
            slipCutAtOrdinal: FOLD_FLOOR_ORDINAL
        });
        const escorted = beingAtADoorOnTheDayItOpens({
            location: theDoor(),
            day: HALFWAY_IN,
            party: aJunior(),
            crossingDays: A_SHORT_ROAD,
            depthWanted: THE_END_OF_IT,
            escortOrdinal: FOLD_FLOOR_ORDINAL
        });

        // One act, once. A slip covers the way in OR the way back, and the
        // person standing there covers both - which is what makes a senior
        // worth asking when a slip is cheaper to carry.
        const slip = read.onASlip!;
        expect(slip.daysToTheDoor === 0 && slip.wayOutCovered > 0).toBe(false);
        expect(escorted.behindASenior!.depthItBuys).toBeGreaterThan(slip.depthItBuys);
    });

    it('makes knowing the day its own road', () => {
        const heardItWasOpen = beingAtADoorOnTheDayItOpens({
            location: theDoor(),
            day: HALFWAY_IN,
            party: aJunior(),
            crossingDays: A_LONG_ROAD,
            depthWanted: JUST_INSIDE_THE_DOOR
        });
        const knewItWasDue = beingAtADoorOnTheDayItOpens({
            location: theDoor(),
            day: HALFWAY_IN,
            party: aJuniorWhoWasTold(),
            crossingDays: A_LONG_ROAD,
            depthWanted: JUST_INSIDE_THE_DOOR
        });

        expect(heardItWasOpen.settingOutInAdvance).toBe(false);
        expect(knewItWasDue.settingOutInAdvance).toBe(true);
        // Same road, same legs, same rung. The records are the difference.
        expect(heardItWasOpen.onFoot.works).toBe(false);
        expect(knewItWasDue.onFoot.works).toBe(true);
        // And a party that cannot read it is told what it is they cannot read,
        // rather than being shown nothing.
        expect(heardItWasOpen.whatTheyCannotRead).not.toBeNull();
        expect(knewItWasDue.whatTheyCannotRead).toBeNull();
    });

    it('puts no clock on ground that has none', () => {
        const openGround = makeLocation({
            id: 'loc-open', name: 'Wind Turn', kind: 'wilds', qiDensity: 40
        });
        const read = beingAtADoorOnTheDayItOpens({
            location: openGround,
            day: HALFWAY_IN,
            party: aJunior(),
            crossingDays: A_LONG_ROAD,
            depthWanted: THE_END_OF_IT
        });

        expect(read.windowDays).toBe(0);
        expect(read.reason).toContain('Nothing about this place closes');
    });
});
