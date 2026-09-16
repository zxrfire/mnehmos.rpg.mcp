/**
 * A recruit joins where they stand, and is given their plate at the house.
 *
 * The design owner: *"technically you do join, you just don't get your ID and ID
 * plate till you get there, so you don't really have proof. You don't get your
 * uniform either."* And *"for simplicity a house has an infinite stock of
 * uniforms."*
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `issueTo` had one caller, `seedTreasuries`, which runs once at world open. So
 * everybody on a roll the day the world began carried a token and had a plate on
 * a wall, and nobody who joined afterwards ever did - not on arrival, not on
 * promotion, not in a century. And `applyRecruitment` enrols people wherever
 * they stand, which is correct by the ruling above, with nothing that ever
 * brought them to the house to be entered on its roll.
 *
 * ── WHAT THIS DOES ───────────────────────────────────────────────────────
 *
 * One pass a year, per house, over its own roll:
 *
 *   in the compound, never entered   a uniform. Always: the stock is infinite.
 *   in the compound, owed a token    a token and a plate, cut by `issueTo`, on
 *                                    the same two gates the treasury applies -
 *                                    `thisHouseCanIssue` and `carriesATokenAt`.
 *                                    Promotion to the first disciple rung is
 *                                    covered by the same line.
 *   elsewhere, not robed or owed a   to the seat to be entered, as above, and
 *   token, and free to go
 *                                    back: a `travelling` term shaped like
 *                                    every party, with where they live as
 *                                    `returnTo`, ended by `bringHomeWhoeverIsDue`
 *                                    like any other. No mover of its own.
 *
 * Until then a doorway finds no token (`theHouseTheirTokenNames` is null), and a
 * recruit who is mid-scene or already away on something keeps having none until
 * a year finds them free.
 *
 * "Never entered" is wearing no robes of this house ({@link wearsTheRobesOf}).
 * Everybody on a roll at world open is given them by
 * {@link uniformsForEverybodyAlreadyOnARoll}, so the founding roll is not sent
 * to its own front door; somebody who leaves hands back what they were issued,
 * so somebody taken back on is entered again.
 *
 * ── THE KEEPER OF THE ROLL, WHO DOES NOT EXIST YET ───────────────────────
 *
 * The cut is attributed to whoever `whoAnswersAbout` names for
 * `THE_ROOM_THE_ROLL_IS_KEPT_IN`. The ancestral hall is `office: false` in
 * `architecture.ts`, because sealing it reshuffled the office deal, so that
 * lookup is null in every house today and the plate records `cutById: null`. A
 * house that can cut plates still cuts them, which is exactly what the world-open
 * treasury already does without a Keeper; requiring one here would have given
 * the founders plates and every later disciple none. When the hall becomes an
 * office the name arrives with no edit here.
 */

import { whoAnswersAbout } from '../social-leverage/what-an-elder-is-in-charge-of.js';
import { portfoliosIn } from '../social-leverage/authority-for-an-order.js';
import { purposeOf } from './architecture.js';
import {
    THE_ROOM_THE_ROLL_IS_KEPT_IN,
    WHERE_THE_PLATES_HANG,
    carriesATokenAt,
    issueTo,
    thisHouseCanIssue,
    tokenIdFor
} from './a-house-knows-its-own-by-a-plate-and-a-token.js';
import { walkingDaysFrom, type LocationRecord } from './locations.js';
import {
    isAwayOnSomething,
    isTheWorldsToMove,
    setLocation,
    whereTheyGoBackTo,
    type NpcRecord
} from './npc-state.js';
import { makeObject, type ObjectRecord } from './possessions.js';
import type { WorldState } from './world-state.js';

/**
 * One per issuing, because the stock is infinite: robes handed out again are a
 * new set, not the old set called back from whoever is wearing it now. An id
 * per member per house was tried and a re-issue overwrote a stolen robe in a
 * stranger's hands, which quietly closed the seam a disguise works.
 */
function uniformIdFor(memberId: string, houseId: string, onDay: number): string {
    return `uniform-${houseId}-${memberId}-${Math.floor(onDay)}`;
}

/** Whether this person is wearing this house's robes. Asked of the possessions, never of an id. */
export function wearsTheRobesOf(
    objects: readonly Pick<ObjectRecord, 'possessorId' | 'ownerId' | 'tags'>[],
    personId: string,
    houseId: string
): boolean {
    return objects.some(object =>
        object.possessorId === personId && object.ownerId === houseId && object.tags.includes('uniform'));
}

/**
 * The robe a house puts on somebody once they are on its roll in person.
 *
 * MUNDANE, and so COUNTED rather than tracked: a house hands these out without
 * writing anything down. What makes it worth a row at all is the MARK - the
 * `house:<id>` tag, which is how a stranger can see whose somebody is without
 * being told (`AGENTS.md`, make it visible). Proof of nothing: a robe can be
 * taken off a line. The token is the proof.
 */
export function aUniformFor(input: {
    memberId: string;
    houseId: string;
    houseName: string;
    onDay: number;
}): ObjectRecord {
    return makeObject({
        id: uniformIdFor(input.memberId, input.houseId, input.onDay),
        name: `${input.houseName} robes`,
        kind: 'other',
        significance: 'mundane',
        description: `The robes ${input.houseName} puts on its own, with the house's mark on them.`,
        possessorId: input.memberId,
        ownerId: input.houseId,
        ownerName: input.houseName,
        tags: ['uniform', 'issued', `house:${input.houseId}`, `member:${input.memberId}`],
        data: { memberId: input.memberId, issuedOnDay: input.onDay }
    });
}

/**
 * Robes for everybody on a roll the day the world opens.
 *
 * They were entered before anybody was watching, the way `seedTreasuries` cuts
 * their plates. Without this the yearly pass would read the whole founding roll
 * as never entered and walk every village-dwelling disciple to the gate.
 */
export function uniformsForEverybodyAlreadyOnARoll(state: WorldState): ObjectRecord[] {
    const houses = new Map(state.factions
        .filter(f => f.dissolvedOnDay === null)
        .map(f => [f.id, f.name]));
    const out: ObjectRecord[] = [];
    for (const npc of state.npcs) {
        if (npc.status !== 'alive' || npc.factionId === null) continue;
        const name = houses.get(npc.factionId);
        if (name === undefined) continue;
        out.push(aUniformFor({
            memberId: npc.id, houseId: npc.factionId, houseName: name, onDay: state.currentDay
        }));
    }
    return out;
}

/** Room, precinct, seat: the three links a compound is. */
const HOW_FAR_UP_A_ROOM_SITS = 3;

/** Whether a place is the seat or a room inside it. */
function isInsideTheCompound(
    byId: ReadonlyMap<string, LocationRecord>,
    locationId: string | null,
    seatId: string
): boolean {
    let at = locationId;
    for (let hops = 0; hops <= HOW_FAR_UP_A_ROOM_SITS && at !== null; hops++) {
        if (at === seatId) return true;
        at = byId.get(at)?.parentId ?? null;
    }
    return false;
}

export interface WhatTheHouseDidAboutItsRoll {
    /** Put on the road to the seat this year. */
    sent: number;
    /** Given robes on arrival. */
    entered: number;
    /** Given a token and a plate. */
    cut: number;
}

/**
 * The yearly pass. See the file header.
 *
 * Mutates `state.npcs` and `state.objects` in place, like every pass beside it.
 */
export function enterWhoeverHasReachedTheHouse(state: WorldState, day: number): WhatTheHouseDidAboutItsRoll {
    const done: WhatTheHouseDidAboutItsRoll = { sent: 0, entered: 0, cut: 0 };

    const rolls = new Map<string, number[]>();
    for (let i = 0; i < state.npcs.length; i++) {
        const npc = state.npcs[i]!;
        if (npc.status !== 'alive' || npc.factionId === null) continue;
        const roll = rolls.get(npc.factionId);
        if (roll) roll.push(i); else rolls.set(npc.factionId, [i]);
    }
    if (rolls.size === 0) return done;

    const objectAt = new Map<string, number>();
    for (let i = 0; i < state.objects.length; i++) objectAt.set(state.objects[i]!.id, i);
    const put = (object: ObjectRecord): void => {
        const at = objectAt.get(object.id);
        if (at === undefined) {
            objectAt.set(object.id, state.objects.length);
            state.objects.push(object);
        } else {
            // A token and plate cut by a house somebody has since left, or
            // re-cut for somebody whose token is no longer in their hands. The
            // id is the member's, so the new cut takes the row: a house cutting
            // a new token for one of its own cancels the old one.
            state.objects[at] = object;
        }
    };
    const holds = (objectId: string, npc: NpcRecord, houseId: string): boolean => {
        const at = objectAt.get(objectId);
        if (at === undefined) return false;
        const object = state.objects[at]!;
        return object.possessorId === npc.id && object.ownerId === houseId;
    };

    // LEAVING MEANS HANDING IT BACK, which the token's own doc has always said
    // and nothing did. Somebody alive and off the roll that issued a robe or a
    // token is not carrying it any more. Without this a disciple who walked out
    // and was later taken back on, somewhere else, still wore the old robes and
    // read as already entered - measured on `town-b`: out in year 188, back on
    // the same roll at a dao ground in 192, and never sent to the house.
    const onRollOf = new Map<string, string | null>();
    for (const npc of state.npcs) if (npc.status === 'alive') onRollOf.set(npc.id, npc.factionId);
    for (let i = 0; i < state.objects.length; i++) {
        const object = state.objects[i]!;
        if (object.possessorId === null || !object.tags.includes('issued')) continue;
        // Only from the person it was issued to. A robe or a token in somebody
        // else's hands is the seam the plate file keeps open on purpose - a
        // genuine tag in the wrong hands still reads as the house's.
        if (object.data?.memberId !== object.possessorId) continue;
        if (!onRollOf.has(object.possessorId)) continue;
        if (onRollOf.get(object.possessorId) === object.ownerId) continue;
        state.objects[i] = { ...object, possessorId: null };
    }

    // Who is wearing whose robes, gathered once after the hand-back.
    const robed = new Set<string>();
    for (const object of state.objects) {
        if (object.possessorId !== null && object.tags.includes('uniform')) {
            robed.add(`${object.possessorId}|${object.ownerId}`);
        }
    }
    const wears = (npc: NpcRecord, houseId: string): boolean => robed.has(`${npc.id}|${houseId}`);

    const byId = new Map(state.locations.map(l => [l.id, l]));
    const plateRoomOf = new Map<string, string>();
    for (const location of state.locations) {
        if (purposeOf(location) !== WHERE_THE_PLATES_HANG) continue;
        const house = location.data?.factionId;
        if (typeof house === 'string' && !plateRoomOf.has(house)) plateRoomOf.set(house, location.id);
    }

    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null || house.seatLocationId === null) continue;
        const seat = house.seatLocationId;
        if (!byId.has(seat)) continue;
        const members = (rolls.get(house.id) ?? []).map(i => ({ at: i, npc: state.npcs[i]! }));
        if (members.length === 0) continue;

        const canCut = thisHouseCanIssue(members.map(m => m.npc.cultivation.realmOrdinal));
        let keeper: string | null | undefined;
        const keeperOfTheRoll = (): string | null => {
            if (keeper === undefined) {
                keeper = whoAnswersAbout(portfoliosIn({
                    locations: state.locations,
                    sectId: house.id,
                    roll: members.map(m => ({ id: m.npc.id, rankIndex: m.npc.factionRankIndex })),
                    rankCount: house.ranks.length
                }), THE_ROOM_THE_ROLL_IS_KEPT_IN);
            }
            return keeper;
        };
        let reach: Map<string, number> | undefined;

        const enter = (npc: NpcRecord): void => {
            if (!wears(npc, house.id)) {
                put(aUniformFor({ memberId: npc.id, houseId: house.id, houseName: house.name, onDay: day }));
                robed.add(`${npc.id}|${house.id}`);
                done.entered++;
            }
            if (!canCut || !carriesATokenAt(npc.factionRankIndex)) return;
            if (holds(tokenIdFor(npc.id), npc, house.id)) return;
            const issued = issueTo({
                memberId: npc.id,
                memberName: npc.name,
                houseId: house.id,
                houseName: house.name,
                plateRoomId: plateRoomOf.get(house.id) ?? seat,
                onDay: day,
                cutById: keeperOfTheRoll()
            });
            put(issued.token);
            put(issued.plate);
            done.cut++;
        };

        for (const { at, npc } of members) {
            // The player's mirror row is the player's. What they carry is on
            // their own sheet, and the world does not walk them anywhere.
            if (!isTheWorldsToMove(npc)) continue;

            if (isInsideTheCompound(byId, npc.locationId, seat)) {
                enter(npc);
                continue;
            }

            // ELSEWHERE AND NEVER ENTERED: go and be entered, and come home.
            // From anything that stops when somebody stops - not from a term
            // (an errand, a posting, a journey already under way), not from a
            // scene somebody else is named in, which is symmetric and would be
            // left naming nobody, and not from `mending`, whose own doc is that
            // nothing else is worth doing until the channels close. A later year
            // asks again.
            //
            // AND THE SAME TRIP FOR A TOKEN. Recruits come in at rung 0, which
            // carries none, so most are robed first and owed a token only once
            // they are promoted - usually while living at home. Measured with
            // the trip for robes alone, six seeds at a century: 2084 of 2151
            // later joiners robed and 381 of 1261 owed a token holding one.
            const owedAToken = canCut
                && carriesATokenAt(npc.factionRankIndex)
                && !holds(tokenIdFor(npc.id), npc, house.id);
            if (wears(npc, house.id) && !owedAToken) continue;
            if (npc.locationId === null || !freeToSetOut(npc)) continue;
            reach ??= walkingDaysFrom(state.locations, seat);
            const days = reach.get(npc.locationId);
            // Nowhere the map can walk to the seat from is a fact about the
            // map, and they stay where they are.
            if (days === undefined) continue;
            const there = onTheRoadToBeEntered(npc, house.name, seat, day, days);
            state.npcs[at] = there;
            enter(there);
            done.sent++;
        }
    }
    return done;
}

function freeToSetOut(npc: NpcRecord): boolean {
    const doing = npc.activity;
    if (doing === null) return true;
    if (isAwayOnSomething(doing.kind) || doing.kind === 'mending') return false;
    return (doing.untilDay ?? null) === null && doing.withIds.length === 0;
}

/**
 * There and back, the way every party the world sends is written: standing at
 * the destination for the term, with where they set out from as `returnTo`, so
 * `bringHomeWhoeverIsDue` ends it like any other. A ROUND TRIP AND NOT A MOVE:
 * joining where you stand is correct, and so is living where you live. Measured
 * with a one-way trip first, on the `demography` seed at 80 years: people in
 * settlements 557 to 338, on sect ground 21% to 46%, and a settlement emptied.
 */
function onTheRoadToBeEntered(
    npc: NpcRecord,
    houseName: string,
    seat: string,
    day: number,
    days: number
): NpcRecord {
    return {
        ...setLocation(npc, seat, day),
        activity: {
            kind: 'travelling',
            note: `Entered on the roll at ${houseName}, and on the way back.`,
            withIds: [],
            sinceDay: day,
            untilDay: day + Math.max(1, Math.ceil(2 * days)),
            returnTo: whereTheyGoBackTo(npc)
        }
    };
}
