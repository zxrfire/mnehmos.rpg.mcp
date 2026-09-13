/**
 * How far "there" reaches, which is not the same distance for every event.
 *
 * `witnessIds` is drawn from `locationId` and nothing else, so a crossing at the
 * top of the ladder and a crossing at the bottom were both seen by whoever
 * happened to be standing in one square. The design owner, asked who witnesses a
 * promotion: *"a tribulation transcendent, the whole region can see. for
 * foundation establishment maybe not even your town can see."*
 *
 * So a witness is somebody who was in the area, and the area is a function of
 * how far the thing physically reached - which the ledger already records as
 * `scale`. There is no second vocabulary here and no second table of distances:
 * `EventScale` says how far the consequence went, and how far it went is how far
 * it could be seen from.
 *
 * ── The stored list and the true answer are two different things ─────────
 *
 * `whoWasThere` names a bounded sample - see `BYSTANDERS_AT_MOST` and the
 * argument beside it - because a witness list four hundred names long is not a
 * statement about who saw anything, and because a fact carrying four hundred ids
 * is a fact the ledger pays for on every read of it. That bound does not change
 * here. What changes is the POOL it is drawn from, and that {@link
 * whoCouldHaveSeenIt} exists at all: the unbounded answer is derived per
 * observer and stored nowhere, which is what `history.ts` already asks for when
 * it says whether an event was witnessed is a question about an observer rather
 * than a label on the event.
 */

import type { EventScale } from './history.js';
import type { NpcRecord } from './npc-state.js';
import { regionOf } from './what-people-are-saying.js';
import type { WorldState } from './world-state.js';

/** The area a thing of a given scale could be seen from. */
export type WhereItCouldBeSeenFrom =
    /** The square it happened in, and nowhere else. */
    | 'where it happened'
    /** Everywhere in the province. The sky did it, and the province has one sky. */
    | 'the region it happened in'
    /** Everywhere the world models. Reserved for the one thing with no province. */
    | 'anywhere';

/**
 * How far a thing of this scale could be seen from.
 *
 * `personal` and `local` are the same AREA and differ in how much of it noticed:
 * one roof leaned in for a night, or the lamps guttered across the town. Both
 * happen in one place, and `whoWasThere` is where the difference in how many
 * people can be named lives.
 *
 * ── AND `continental` STOPS AT THE REGION, WHICH IS THE RULING ───────────
 *
 * The design owner drew the ceiling themselves - *"a tribulation transcendent,
 * the whole region can see"* - and Tribulation Transcendence is the continental
 * row in `ARRIVING_IN`. So the widest thing anybody named is a province, and the
 * province is where a seeing stops. `scale` says how far the CONSEQUENCE went,
 * which for a refusal in a hall is the whole continent and for the light over
 * that hall is one sky.
 *
 * Measured, before it did: a `grudge_opened` between two apexes drew its
 * bystanders from the entire living roster, so somebody nine realms below in
 * another province was stored as having been present at a conversation - and
 * every gossip read that starts *did you witness this* answered yes. Which is
 * the mailing list this file's own header warns about, arriving through the
 * pool rather than through the bound.
 *
 * `world` is the one thing above it and it keeps `anywhere`: the Immortal row is
 * the Lid opening, which is the one event in the world that has no province.
 */
export function howFarASeeingReaches(scale: EventScale): WhereItCouldBeSeenFrom {
    switch (scale) {
        case 'personal':
        case 'local':
            return 'where it happened';
        case 'regional':
        case 'continental':
            return 'the region it happened in';
        case 'world':
            return 'anywhere';
    }
}

export interface ASeeing {
    /** How far the consequence physically reached. */
    scale: EventScale;
    /** Where it happened. Null means nowhere the world models, so nobody. */
    locationId: string | null;
    /** Where the person in question was standing that day. */
    whoWasStandingAt: string | null;
}

/**
 * Whether somebody standing there could have seen it.
 *
 * Derived, never stored, and it answers for anybody in the world rather than for
 * the handful the ledger names. A person with no place is nowhere and sees
 * nothing; an event with no place happened nowhere the world can site and is
 * seen by nobody, which is the same ruling `howFarOff` makes when it calls such
 * a fact unplaceable.
 */
export function whoCouldHaveSeenIt(state: WorldState, seeing: ASeeing): boolean {
    if (seeing.locationId === null || seeing.whoWasStandingAt === null) return false;
    switch (howFarASeeingReaches(seeing.scale)) {
        case 'where it happened':
            return seeing.whoWasStandingAt === seeing.locationId;
        case 'the region it happened in': {
            const where = regionOf(state, seeing.locationId);
            return where !== null && regionOf(state, seeing.whoWasStandingAt) === where;
        }
        case 'anywhere':
            return true;
    }
}

/**
 * Everybody alive and in the area, as the pool a witness list is drawn from.
 *
 * Sorted by id so a draw over it does not inherit roster order, which is the
 * same reason `whoWasThere` sorts before drawing.
 */
export function everybodyInTheArea(
    state: WorldState,
    seeing: { scale: EventScale; locationId: string | null; day: number }
): NpcRecord[] {
    if (seeing.locationId === null) return [];
    const reach = howFarASeeingReaches(seeing.scale);
    const region = reach === 'the region it happened in'
        ? regionOf(state, seeing.locationId)
        : null;
    const here = state.npcs.filter(n => {
        if (n.status !== 'alive') return false;
        if (n.identity.bornOnDay > seeing.day) return false;
        if (reach === 'anywhere') return n.locationId !== null;
        if (reach === 'where it happened') return n.locationId === seeing.locationId;
        return region !== null && regionOf(state, n.locationId) === region;
    });
    here.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return here;
}
