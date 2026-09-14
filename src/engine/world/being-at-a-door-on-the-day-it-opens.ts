/**
 * Can this party get to the end of it before it shuts, and if not, what would.
 *
 * The arithmetic the convergence design rests on, done rather than asserted.
 * MEASURED over twelve pinned worlds, 72 scheduled sites, walking the real link
 * graph (`scripts/probe-can-anybody-be-standing-there-on-the-day.ts`):
 *
 *   windows              7d x32   14d x20   30d x9   60d x8   90d x3
 *   nearest house seat   1 to 5 walking days
 *   farthest             19 to 30
 *   of the world's houses, per site: 36.2% could walk in and back out inside
 *   the window, 1.8% could not walk it but sit inside a fold at the rung
 *   folding starts, and 62.1% could not make it at all. At the seven-day
 *   windows it is 0 to 8%.
 *
 * So a door is a LOCAL event. The province walks in and the rest of the world
 * does not, which is the design working and is why the owner named two roads
 * rather than one.
 *
 * ── TWO THINGS EAT THE WINDOW, AND THEY ARE NOT THE SAME THING ───────────
 *
 *   the road    only if they did not know the day. A party that can read the
 *               schedule sets out to ARRIVE and spends none of the window
 *               getting there; a party that hears it is open starts late and
 *               the whole crossing comes out of the window. At seven days that
 *               is the difference between a road and no road, and it is the
 *               whole of the information edge a house trades on. `readSchedule`
 *               is the gate, and this is its caller.
 *   the depth   in and back out, which is why the reachable depth is half of
 *               what is left and not all of it. The same arithmetic
 *               `expeditionBudget` does, applied here to a window this party
 *               has already spent part of.
 *
 * ── AND THE TWO ROADS ARE BOTH A FOLD, SPENT DIFFERENTLY ─────────────────
 *
 *   behind a senior   somebody at Void Tribulation or above. Their fold puts
 *                     the party at the door for nothing, AND they are still
 *                     standing there to cover the way back out. Both legs.
 *   on a slip         one act somebody already paid for, and ONE is one. Burn
 *                     it to arrive and there is nothing left to leave with;
 *                     keep it, and the party walks the road. The slip is priced
 *                     both ways here because choosing is the interesting part.
 *
 * Pure. Records and a day in, an answer out. Nothing stored, nothing mutated.
 */

import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { rankName } from '../cultivation/realms.js';
import type { CapabilityActor } from './capability.js';
import { convergenceOf, readSchedule } from './convergence.js';
import {
    FOLD_FLOOR_ORDINAL,
    FOLD_GRANT,
    priceFold
} from './how-far-somebody-can-fold-space-and-what-it-costs.js';
import { howFarTheWayOutCarries } from './a-talisman-is-one-act-somebody-already-paid-for.js';
import type { LocationRecord } from './locations.js';
import { daysByConveyance, type Conveyance } from './what-a-conveyance-does-to-a-journey.js';

/** One way of getting there and back, priced. */
export interface ARoadToTheDoor {
    /** What the road costs, in days. Zero where a fold covers it. */
    daysToTheDoor: number;
    /** Days of the window this road spends before anybody is inside. */
    windowSpentGettingThere: number;
    /** Window standing when they are at the door. Zero or less is too late. */
    windowLeft: number;
    /** Walking days of the way OUT something else covers. Zero for most. */
    wayOutCovered: number;
    /**
     * Days of depth this buys. Half of what is left, plus whatever covers the
     * return leg - the arithmetic `expeditionBudget` does, on a window this
     * party has already spent part of.
     */
    depthItBuys: number;
    /** Inside, to the end, and back out. */
    works: boolean;
    /** Why not, when it does not. Null when it does. */
    refusal: string | null;
}

export interface StandingAtTheDoor {
    locationId: string;
    name: string;
    /** Absolute day the door next stands open. Null where nothing is due. */
    opensOnDay: number | null;
    windowDays: number;
    /** Years to the one after this. What being late actually costs. */
    waitYears: number;
    /**
     * Whether this party can set out to ARRIVE rather than hearing it is open
     * and starting late. `readSchedule` decides it.
     */
    settingOutInAdvance: boolean;
    /** What the schedule reading could not say, when it could not. */
    whatTheyCannotRead: string | null;
    /** Days of road between them and it, on foot. */
    crossingDays: number;
    /** How deep the party needs to get. What "the end of it" costs. */
    depthWanted: number;
    onFoot: ARoadToTheDoor;
    /** Null where nobody who could fold them in was offered. */
    behindASenior: ARoadToTheDoor | null;
    /** Null where nobody is carrying a way out. */
    onASlip: ARoadToTheDoor | null;
    /** The honest sentence, including when every road is shut. */
    reason: string;
}

export interface GettingToADoor {
    location: LocationRecord;
    day: number;
    /** Whoever is deciding. Their reading of the schedule is what is asked. */
    party: CapabilityActor;
    /** What the road costs on foot. `travelDays` over the links between. */
    crossingDays: number;
    /** Days of depth they mean to reach. `wingsOf` carries them per wing. */
    depthWanted: number;
    /** What they are travelling on, or null for walking. */
    conveyance?: Conveyance | null;
    /** The craft's rung, for a tracked one. */
    conveyancePower?: number | null;
    /** Somebody who would take them out, or null. The escort road. */
    escortOrdinal?: number | null;
    /** The rung folded into a way-out slip they carry, or null. */
    slipCutAtOrdinal?: number | null;
}

function road(input: {
    daysToTheDoor: number;
    windowSpentGettingThere: number;
    windowDays: number;
    wayOutCovered: number;
    depthWanted: number;
    refusal: string | null;
}): ARoadToTheDoor {
    const windowLeft = input.windowDays - input.windowSpentGettingThere;
    const depthItBuys = windowLeft > 0
        ? (windowLeft + input.wayOutCovered) / 2
        : 0;
    return {
        daysToTheDoor: input.daysToTheDoor,
        windowSpentGettingThere: input.windowSpentGettingThere,
        windowLeft,
        wayOutCovered: input.wayOutCovered,
        depthItBuys: Number(depthItBuys.toFixed(2)),
        works: input.refusal === null && windowLeft > 0 && depthItBuys >= input.depthWanted,
        refusal: input.refusal
            ?? (windowLeft <= 0
                ? `${input.windowSpentGettingThere} days of road against `
                    + `${input.windowDays} of window. It shuts on the way.`
                : depthItBuys < input.depthWanted
                    ? `${windowLeft} days of window left buys ${depthItBuys.toFixed(1)} days `
                        + `of depth, and the end of it is ${input.depthWanted} in.`
                    : null)
    };
}

/**
 * Price every road to one door, for one party, on one day.
 */
export function beingAtADoorOnTheDayItOpens(input: GettingToADoor): StandingAtTheDoor {
    const convergence = convergenceOf(input.location, input.day);
    const schedule = readSchedule(input.location, input.party, input.day);
    const crossingDays = Math.max(0, Math.ceil(input.crossingDays));
    const depthWanted = Math.max(0, input.depthWanted);

    // GROUND WITH NO DOOR IS NOT GROUND WITH A WINDOW OF ZERO. A tomb and a
    // legacy left standing open have no season and no seal, so every figure
    // this module prices is about something that is not there: run them anyway
    // and a road comes back refused for a window of nought that shuts on the
    // way. Nothing closes, so every road works and the depth is whatever
    // somebody is willing to walk - and what stops them is the trial inside,
    // which is `evaluateAccess`'s question and not this one's.
    if (!convergence.cyclical) {
        const openGround: ARoadToTheDoor = {
            daysToTheDoor: crossingDays,
            windowSpentGettingThere: 0,
            windowLeft: 0,
            wayOutCovered: 0,
            depthItBuys: depthWanted,
            works: true,
            refusal: null
        };
        return {
            locationId: input.location.id,
            name: input.location.name,
            opensOnDay: input.day,
            windowDays: 0,
            waitYears: 0,
            settingOutInAdvance: true,
            whatTheyCannotRead: null,
            crossingDays,
            depthWanted,
            onFoot: openGround,
            behindASenior: input.escortOrdinal == null ? null : { ...openGround },
            onASlip: input.slipCutAtOrdinal == null ? null : { ...openGround },
            reason: 'Nothing about this place closes. What is in the way is inside it.'
        };
    }

    const windowDays = convergence.windowDays;

    // A schedule nobody can read is a schedule nobody can be early for.
    const settingOutInAdvance = convergence.cyclical
        ? schedule.known && schedule.nextOpensOnDay !== null
        : true;

    const walked = input.conveyance
        ? daysByConveyance(crossingDays, input.conveyance, input.conveyancePower ?? null)
        : crossingDays;
    const spent = (days: number): number => (settingOutInAdvance ? 0 : days);

    const onFoot = road({
        daysToTheDoor: walked,
        windowSpentGettingThere: spent(walked),
        windowDays,
        wayOutCovered: 0,
        depthWanted,
        refusal: null
    });

    const escortOrdinal = input.escortOrdinal ?? null;
    let behindASenior: ARoadToTheDoor | null = null;
    if (escortOrdinal !== null) {
        // Their grant is read as held: somebody being ASKED to take a party out
        // is somebody who can, and the world does not store acquired grants for
        // the people who would be asked.
        const fold = priceFold({
            ordinal: escortOrdinal,
            heldGrants: [FOLD_GRANT],
            walkingDays: crossingDays,
            fix: 'stood'
        });
        const toTheDoor = fold.withinRange ? fold.daysSpent : walked;
        behindASenior = road({
            daysToTheDoor: toTheDoor,
            windowSpentGettingThere: spent(toTheDoor),
            windowDays,
            // They came in with the party and they are still standing there,
            // so the way out is theirs to cover as well as the way in.
            wayOutCovered: fold.rangeDays,
            depthWanted,
            refusal: fold.canFoldAtAll
                ? null
                : `A ${rankName(escortOrdinal)} cannot fold at all. Nothing folds below `
                    + `${rankName(FOLD_FLOOR_ORDINAL)}.`
        });
    }

    const slipCutAtOrdinal = input.slipCutAtOrdinal ?? null;
    let onASlip: ARoadToTheDoor | null = null;
    if (slipCutAtOrdinal !== null) {
        const carries = howFarTheWayOutCarries(slipCutAtOrdinal);
        // ONE ACT, ONCE. Burning it to arrive leaves nothing to leave with, so
        // the two spendings are priced apart and the better one is reported.
        const burntToArrive = carries >= crossingDays
            ? road({
                daysToTheDoor: 0,
                windowSpentGettingThere: 0,
                windowDays,
                wayOutCovered: 0,
                depthWanted,
                refusal: null
            })
            : null;
        const keptForTheWayOut = road({
            daysToTheDoor: walked,
            windowSpentGettingThere: spent(walked),
            windowDays,
            wayOutCovered: carries,
            depthWanted,
            refusal: carries > 0
                ? null
                : 'The slip was cut by a hand that could not fold. There is no fold in it.'
        });
        onASlip = burntToArrive !== null && burntToArrive.depthItBuys > keptForTheWayOut.depthItBuys
            ? burntToArrive
            : keptForTheWayOut;
    }

    const open = [onFoot, behindASenior, onASlip].filter(r => r !== null && r.works).length;
    const reason = !convergence.cyclical
        ? 'Nothing about this place closes. Take as long as you like.'
        : open > 0
            ? `${windowDays} days of window, ${crossingDays} days of road, `
                + `${depthWanted} days of depth, and ${open} way${open === 1 ? '' : 's'} `
                + 'in and back out.'
            : settingOutInAdvance
                ? `${windowDays} days of window against ${crossingDays} days of road and `
                    + `${depthWanted} of depth, and nothing anybody here is carrying covers `
                    + `it. The next one is in ${convergence.yearsUntilNext} years.`
                : 'Nobody here can say when it is next due, so the road comes out of the '
                    + 'window rather than out of the years before it.';

    return {
        locationId: input.location.id,
        name: input.location.name,
        opensOnDay: convergence.open ? input.day : convergence.opensOnDay,
        windowDays,
        waitYears: convergence.cyclical
            ? Math.round((input.location.cycle?.periodDays ?? 0) / DAYS_PER_YEAR)
            : 0,
        settingOutInAdvance,
        whatTheyCannotRead: schedule.missing,
        crossingDays,
        depthWanted,
        onFoot,
        behindASenior,
        onASlip,
        reason
    };
}
