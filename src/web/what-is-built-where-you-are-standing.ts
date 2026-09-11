/**
 * What is built on this ground, said the way somebody standing on it would.
 *
 * The player half of `whatIsBuiltOnThisGround`. That module decides what can be
 * perceived; this one puts it into sentences and gates the arithmetic on the
 * same `whatTheyCanTell` ladder the crowding read uses, so a figure nobody
 * could have surveyed waits for the rung that buys a survey.
 *
 * Every line is a thing an eye reaches, and no adjective is spent: a hall cut
 * for four hundred with six people in it is the whole of the finding, and the
 * conclusion the reader draws from the two numbers is worth more than a
 * sentence drawing it for them.
 *
 * PURE. Records in, lines out.
 */

import { howMany } from '../utils/a-count-agrees-with-what-it-counts.js';
import type { ViewerStanding } from '../engine/world/architecture.js';
import { describeRoom, houseStyleFromTags } from '../engine/world/architecture.js';
import type { AccessQuery, LocationRecord } from '../engine/world/locations.js';
import {
    type WhatIsBuiltOnThisGround,
    whatIsBuiltOnThisGround
} from '../engine/world/what-is-built-on-this-ground.js';
import { whatTheyCanTell } from './what-you-can-tell-about-the-ground.js';
import { howThisCultivatorStandsInTheHouseHolding } from './how-this-cultivator-stands-on-this-ground.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';

export interface BuiltHereInput {
    locations: readonly LocationRecord[];
    standingAt: string | null | undefined;
    viewer: ViewerStanding;
    access: AccessQuery;
    /** The reader's own rung, for the gate on figures. */
    readerOrdinal: number;
    /** How many people the reader can see on this ground. */
    headsHere: number;
}

export interface BuiltHereReading {
    reading: WhatIsBuiltOnThisGround;
    /** Narratable. Empty where nothing is built here, which is most of the map. */
    lines: string[];
    structure: string;
}

/**
 * How much of a qi difference is worth a sentence.
 *
 * Below this the deeper rooms are the same ground with walls on it, and saying
 * so every time somebody walks past a wall makes the one compound where it is
 * true unremarkable. The figure is in the same units as `qiDensity`, 1..100.
 */
const A_DIFFERENCE_A_BODY_WOULD_NOTICE = 5;

/**
 * How many things get listed before the rest become a number.
 *
 * A house elder can name twenty rooms and reading twenty out is an inventory,
 * not a look.
 */
const NAMES_IN_ONE_BREATH = 6;

export function whatIsBuiltWhereYouAreStanding(input: BuiltHereInput): BuiltHereReading {
    const here = input.locations.find(row => row.id === input.standingAt) ?? null;
    const reading = whatIsBuiltOnThisGround({
        locations: input.locations,
        standingAt: input.standingAt,
        viewer: input.viewer,
        access: input.access
    });

    const lines: string[] = [];
    if (here !== null && reading.seen.length > 0) {
        lines.push(...theStonework(here));
        lines.push(...theScale(reading, input.headsHere, input.readerOrdinal));
        lines.push(...whatCanBeNamed(reading));
        lines.push(...whatCannotBeRead(reading));
        lines.push(...theEdge(reading));
        lines.push(...theQiInward(reading, input.readerOrdinal));
        lines.push(...whatStandsOverIt(here));
    }

    return {
        reading,
        lines,
        structure: `whatIsBuiltOnThisGround(${reading.locationId}): ${reading.builtTotal} built, `
            + `${reading.seen.length} perceptible, ${reading.named} nameable, `
            + `${reading.seatsSeen} seat(s) cut in what is visible, largest roof `
            + `${reading.largestRoof}. Qi ${reading.qiHere} outside against `
            + `${reading.qiInnermost} at the thickest visible. Read only, nothing spent.`
    };
}

/**
 * The plan and the stone, off the tags the builder stamped on the ground.
 *
 * `describeRoom` writes these and had no caller. Only its `onEntry` half is
 * used: `onInspect` is what a room gives up to somebody who stops and studies
 * it, and standing in the yard is not that.
 */
function theStonework(here: LocationRecord): string[] {
    const style = houseStyleFromTags(here);
    if (style === null) return [];
    // The ward taken off the copy, and only for this call. `describeRoom`'s
    // upkeep line answers the formation hazard first, which is right for a room
    // whose own array is lit and wrong for the ground under a whole compound -
    // every seated house carries a standing ward, so every compound read "the
    // array over it is lit" and the upkeep facet never printed at all. Measured
    // on The Hollow Court: 41 of 200 nodes burning, stamped `upkeep:dark`, read
    // as lit. The ward is said once below, as its own fact.
    const masonry = { ...here, hazards: here.hazards.filter(tag => tag !== 'formation') };
    return describeRoom(masonry, style, { seed: here.id }).onEntry;
}

/**
 * What it was cut for, against who is on it.
 *
 * The comparison is never drawn. A hall cut for four hundred and six people
 * standing in it is two facts a reader puts together on their own, and the
 * conclusion they reach is worth more than the sentence saying it for them.
 */
function theScale(
    reading: WhatIsBuiltOnThisGround,
    headsHere: number,
    readerOrdinal: number
): string[] {
    if (reading.largestRoof <= 0) return [];
    // A roof is masonry and anybody can stand under it and see how many benches
    // there are. The compound-wide total is arithmetic across buildings whose
    // insides they have not seen, so it waits for the rung that buys a survey -
    // the same gate `how-crowded-this-ground-is.ts` puts on a vein's capacity,
    // for the same reason.
    const out = [`The largest roof you can see holds ${reading.largestRoof}.`];
    if (reading.cutByPeopleWhoAreGone) {
        out.push('Nobody now in the house cut any of it.');
    }
    if (whatTheyCanTell(readerOrdinal) === 'the_figures' && reading.seatsSeen > reading.largestRoof) {
        out.push(`Counting the rest of what you can see, there are ${reading.seatsSeen} places `
            + 'under roofs on this ground.');
    }
    out.push(headsHere === 0
        ? 'You cannot see anybody on any of it.'
        : `You can count ${howMany(headsHere, 'person')} on it.`);
    return out;
}

/**
 * The buildings this reader could point at by name.
 *
 * The visible half of the knowledge gate: a stranger names the forecourt and
 * the gate, somebody with standing walks the same ground and names a dozen
 * things. Without this the difference showed only as a smaller count of what
 * they could NOT name, which is the payoff described as a subtraction.
 */
function whatCanBeNamed(reading: WhatIsBuiltOnThisGround): string[] {
    const named = reading.seen
        .filter(row => row.name !== null)
        .map(row => theRoomsOwnName(row.name!));
    if (named.length === 0) return [];
    const shown = named.slice(0, NAMES_IN_ONE_BREATH);
    const rest = named.length - shown.length;
    return [`You can put a name to ${shown.join(', ')}${rest > 0 ? `, and ${rest} more` : ''}.`];
}

/**
 * A room's own name, without the house's name in front of it.
 *
 * The generator writes `<House>: the forecourt` so a room is unambiguous across
 * a world of 939 of them. Somebody standing in the forecourt calls it the
 * forecourt.
 */
function theRoomsOwnName(full: string): string {
    const at = full.indexOf(': ');
    return at < 0 ? full : full.slice(at + 2);
}

/** The roofs, and the ones that are only roofs. */
function whatCannotBeRead(reading: WhatIsBuiltOnThisGround): string[] {
    const unread = reading.seen.length - reading.named;
    if (unread <= 0) return [];
    return [`${howMany(unread, 'building')} you could not say the use of. They are roofs and `
        + 'walls and somebody going in and out.'];
}

/**
 * The edge of where they may go, which is a fact and not a refusal.
 *
 * Said as a count of walls rather than as a name, because for anybody but a
 * member the name of the court they are stopped at is the house's own rank
 * ladder and they have not been told it. What they perceive is that they have
 * the run of two courts out of seven, which is the whole of the finding and is
 * a different sentence in a great house and a small one.
 */
function theEdge(reading: WhatIsBuiltOnThisGround): string[] {
    const stop = reading.stoppedAt;
    if (stop === null) return [];

    // Somebody who may walk through every wall on the ground is not stopped by
    // a wall, and saying "the way into the next" at them while they have the
    // run of all of it is the read contradicting itself in consecutive
    // sentences. What is left for them is a locked door, which is a different
    // fact and gets the shorter line.
    if (reading.enclosuresSeen === 0 || reading.enclosuresOpen >= reading.enclosuresSeen) {
        return stop.wayIn === 'shut'
            ? ['One of them is shut, and it is a door rather than a wall.']
            : ['One of them you do not get into, and it is not a door you could open.'];
    }

    return [
        reading.enclosuresOpen === 0
            ? `None of the ${reading.enclosuresSeen} courts you can count is open to you.`
            : `You have the run of ${reading.enclosuresOpen} of the ${reading.enclosuresSeen} `
                + 'courts you can count.',
        stop.wayIn === 'shut'
            ? 'The way into the next is shut, and it is a door rather than a wall.'
            : 'The way into the next is not a door you could open. Nobody has to tell you so.'
    ];
}

/**
 * Whether the ground gets better as it goes in.
 *
 * A cultivator feels a vein under their feet at every rung; what arrives with
 * the ladder is the figure. Both halves are the same comparison, so the gate is
 * on the phrasing and never on whether it is said at all.
 */
function theQiInward(reading: WhatIsBuiltOnThisGround, readerOrdinal: number): string[] {
    const lift = reading.qiInnermost - reading.qiHere;
    if (lift < A_DIFFERENCE_A_BODY_WOULD_NOTICE) return [];
    return whatTheyCanTell(readerOrdinal) === 'the_figures'
        ? [`The vein runs at ${reading.qiHere} where you are standing and at `
            + `${reading.qiInnermost} at the best of what you can see inside.`]
        : ['The qi is heavier somewhere further in than it is where you are standing. You '
            + 'could walk toward it with your eyes shut.'];
}

/**
 * A standing array over the whole of it.
 *
 * The hazard tag and not the object: what a body at the gate perceives is that
 * something is running over this ground, and whose it is and what it is rated
 * at are two separate things to go and find out.
 */
function whatStandsOverIt(here: LocationRecord): string[] {
    return here.hazards.includes('formation')
        ? ['Something is running over the whole of this ground. You can feel where its edge is '
            + 'and you could not describe it.']
        : [];
}

/**
 * The read for whoever is standing here, assembled off the live game.
 *
 * One construction, used by the verb that answers the question and by the panel
 * that offers it. Two would be two answers to *is this person one of ours*.
 * Null where nothing is built, which is most of the map.
 */
export function theBuiltGroundUnder(
    game: GameService,
    cultivator: Cultivator
): BuiltHereReading | null {
    if (!game.atHand) return null;
    const ground = game.atHand.locations.find(row => row.id === game.worldPlaceOf(cultivator));
    if (!ground) return null;

    const membership = game.repos.sects.getMembership(cultivator.id);
    const house = membership ? game.repos.sects.getById(membership.sectId) : null;
    const { viewer, access } = howThisCultivatorStandsInTheHouseHolding({
        ground,
        cultivator,
        standing: membership && house
            ? {
                sectId: membership.sectId,
                rankIndex: membership.rankIndex,
                rankCount: house.ranks.length
            }
            : null,
        onDay: Math.floor(game.atHand.currentDay)
    });
    const built = whatIsBuiltWhereYouAreStanding({
        locations: game.atHand.locations,
        standingAt: ground.id,
        viewer,
        access,
        readerOrdinal: cultivator.realmOrdinal,
        headsHere: game.present(cultivator).length
    });
    return built.lines.length === 0 ? null : built;
}
