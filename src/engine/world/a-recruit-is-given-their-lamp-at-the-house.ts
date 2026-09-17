/**
 * A recruit joins where they stand, and has their lamp lit at the house.
 *
 * The design owner: *"technically you do join, you just don't get your ID and ID
 * plate till you get there, so you don't really have proof. You don't get your
 * uniform either."* And *"for simplicity a house has an infinite stock of
 * uniforms."* The ID plate there is a token and a life lamp now.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────
 *
 * `issueTo` had one caller, `seedTreasuries`, which runs once at world open. So
 * everybody on a roll the day the world began carried a token and had a lamp
 * burning, and nobody who joined afterwards ever did - not on arrival, not on
 * promotion, not in a century. And `applyRecruitment` enrols people wherever
 * they stand, which is correct by the ruling above, with nothing that ever
 * brought them to the house to be entered on its roll.
 *
 * ── WHAT THIS DOES ───────────────────────────────────────────────────────
 *
 * One pass a year, per house, over its own roll:
 *
 *   in the compound, never entered   a uniform, when the house expects them on
 *                                    the word of whoever took them on
 *                                    (`a-house-expects-somebody-it-took-on.ts`),
 *                                    or on questioning, or when nobody took them
 *                                    on because they were born or woken inside.
 *                                    Questioned and not matching: off the roll.
 *                                    The stock is infinite.
 *   in the compound, owed a token    a token cut and a lamp lit by `issueTo`, on
 *                                    the same two gates the treasury applies -
 *                                    `thisHouseCanIssue` and `carriesATokenAt`.
 *                                    Promotion to the first disciple rung is
 *                                    covered by the same line.
 *   elsewhere, never entered, free   to the seat to LIVE there, on the owner's
 *                                    ruling *"move into the compound"*: a
 *                                    `travelling` term with the seat as
 *                                    `returnTo`, ended by `bringHomeWhoeverIsDue`
 *                                    like any other, and entered the year the
 *                                    pass finds them inside. No mover of its own.
 *   elsewhere, robed, owed a token   to the seat for it and back, keeping the
 *                                    home they already had.
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
 * ── THE INTERNAL AFFAIRS ELDER, WHO DOES NOT EXIST YET ───────────────────
 *
 * The token is attributed to whoever `whoAnswersAbout` names for
 * `THE_ROOM_THE_ROLL_IS_KEPT_IN`. The ancestral hall is `office: false` in
 * `architecture.ts`, because sealing it reshuffled the office deal, so that
 * lookup is null in every house today and the token records `cutById: null`. A
 * house that can light lamps still lights them, which is exactly what the world-open
 * treasury already does without an Internal Affairs Elder; requiring one here
 * would have given the founders lamps and every later disciple none. When the
 * hall becomes an office the name arrives with no edit here.
 */

import { purposeOf } from './architecture.js';
import {
    WHERE_THE_LAMPS_BURN,
    carriesATokenAt,
    issueTo,
    thisHouseCanIssue,
    tokenIdFor
} from './a-house-knows-its-own-by-a-lamp-and-a-token.js';
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
import {
    deliverWhatTheyOweTheHouse,
    theHouseStopsExpecting,
    theInternalAffairsElderIn,
    theyAreEntered,
    whatTheHouseMakesOfSomebodyNew,
    whoTheHouseExpects
} from './a-house-expects-somebody-it-took-on.js';

export { theInternalAffairsElderIn } from './a-house-expects-somebody-it-took-on.js';

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
 * They were entered before anybody was watching, the way `seedTreasuries` lights
 * their lamps. Without this the yearly pass would read the whole founding roll
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
export function isInsideTheCompound(
    byId: ReadonlyMap<string, Pick<LocationRecord, 'parentId'>>,
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

/** The hall a house burns its lamps in, or null where it has none built. */
export function whereThisHouseBurnsItsLamps(
    locations: readonly LocationRecord[],
    houseId: string
): string | null {
    return locations.find(l => purposeOf(l) === WHERE_THE_LAMPS_BURN && l.data?.factionId === houseId)?.id ?? null;
}

/**
 * LEAVING MEANS HANDING IT BACK, which the token's own doc has always said and
 * nothing did. Somebody alive and off the roll that issued a robe or a token is
 * not carrying it any more. Without this a disciple who walked out and was later
 * taken back on, somewhere else, still wore the old robes and read as already
 * entered - measured on `town-b`: out in year 188, back on the same roll at a
 * dao ground in 192, and never sent to the house.
 *
 * `rollOf` answers the house somebody is on today, null for none, and undefined
 * for somebody the caller is not asking about - who is skipped. Mutates in place
 * and returns how many were handed back.
 */
export function handBackWhatTheyNoLongerBelongTo(
    objects: ObjectRecord[],
    rollOf: (personId: string) => string | null | undefined
): number {
    let handed = 0;
    for (let i = 0; i < objects.length; i++) {
        const object = objects[i]!;
        if (object.possessorId === null || !object.tags.includes('issued')) continue;
        // Only from the person it was issued to. A robe or a token in somebody
        // else's hands is the seam the lamp file keeps open on purpose - a
        // genuine tag in the wrong hands still reads as the house's.
        if (object.data?.memberId !== object.possessorId) continue;
        const onRoll = rollOf(object.possessorId);
        if (onRoll === undefined || onRoll === object.ownerId) continue;
        objects[i] = { ...object, possessorId: null };
        handed++;
    }
    return handed;
}

/**
 * What a house gives one of its own who is standing in its compound.
 *
 * THE ONE ANSWER, asked by the yearly pass for the world's people and by the
 * played turn for the player, so the two cannot come to different conclusions
 * about who is owed what. Robes to anybody on the roll not wearing them - the
 * stock is infinite. A token cut and a lamp lit, by `issueTo`, to anybody at a
 * rung that carries one (`carriesATokenAt`) in a house somebody can make them in
 * (`thisHouseCanIssue`), who is not already carrying this house's token.
 *
 * Pure: rows out, to be put by id. Nothing here reads where they are standing,
 * which is the caller's question.
 */
export function whatTheHouseGivesThem(input: {
    house: { id: string; name: string };
    person: { id: string; name: string; rankIndex: number };
    wearsItsRobes: boolean;
    holdsItsToken: boolean;
    /** `thisHouseCanIssue` over the roll's ordinals. */
    canCut: boolean;
    /** The hall, or the seat where the house has none built. */
    lampRoomId: string | null;
    /** Asked only when a token is actually cut. */
    internalAffairsElder: () => string | null;
    onDay: number;
}): { robes: ObjectRecord | null; token: ObjectRecord | null; lamp: ObjectRecord | null } {
    const robes = input.wearsItsRobes ? null : aUniformFor({
        memberId: input.person.id,
        houseId: input.house.id,
        houseName: input.house.name,
        onDay: input.onDay
    });
    if (input.holdsItsToken || !input.canCut || !carriesATokenAt(input.person.rankIndex)) {
        return { robes, token: null, lamp: null };
    }
    const issued = issueTo({
        memberId: input.person.id,
        memberName: input.person.name,
        houseId: input.house.id,
        houseName: input.house.name,
        lampRoomId: input.lampRoomId,
        onDay: input.onDay,
        cutById: input.internalAffairsElder()
    });
    return { robes, token: issued.token, lamp: issued.lamp };
}

/** Whether this person is carrying a token this house cut for them. */
export function holdsTheTokenOf(
    objects: readonly Pick<ObjectRecord, 'id' | 'possessorId' | 'ownerId'>[],
    personId: string,
    houseId: string
): boolean {
    const id = tokenIdFor(personId);
    return objects.some(o => o.id === id && o.possessorId === personId && o.ownerId === houseId);
}

export interface WhatTheHouseDidAboutItsRoll {
    /** Put on the road to the seat this year. */
    sent: number;
    /** Given robes on arrival. */
    entered: number;
    /** Given a token, and a lamp lit. */
    cut: number;
    /** Reports of somebody taken on, made by a recruiter standing in the compound. */
    reported: number;
    /** Never entered and not expected, questioned, and let in on what they said. */
    admittedOnQuestioning: number;
    /** Questioned, it did not match what the house knows, and turned off its roll. */
    rejected: number;
}

/**
 * The yearly pass. See the file header.
 *
 * Mutates `state.npcs` and `state.objects` in place, like every pass beside it.
 */
export function enterWhoeverHasReachedTheHouse(state: WorldState, day: number): WhatTheHouseDidAboutItsRoll {
    const done: WhatTheHouseDidAboutItsRoll = {
        sent: 0, entered: 0, cut: 0, reported: 0, admittedOnQuestioning: 0, rejected: 0
    };

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
            // A token and lamp made by a house somebody has since left, or
            // made again for somebody whose token is no longer in their hands. The
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

    // Leaving means handing it back. See `handBackWhatTheyNoLongerBelongTo`.
    const onRollOf = new Map<string, string | null>();
    for (const npc of state.npcs) if (npc.status === 'alive') onRollOf.set(npc.id, npc.factionId);
    handBackWhatTheyNoLongerBelongTo(state.objects, id => onRollOf.get(id));

    // Who is wearing whose robes, gathered once after the hand-back.
    const robed = new Set<string>();
    for (const object of state.objects) {
        if (object.possessorId !== null && object.tags.includes('uniform')) {
            robed.add(`${object.possessorId}|${object.ownerId}`);
        }
    }
    const wears = (npc: NpcRecord, houseId: string): boolean => robed.has(`${npc.id}|${houseId}`);

    const byId = new Map(state.locations.map(l => [l.id, l]));
    // Gathered once rather than asked per house: the same answer as
    // `whereThisHouseBurnsItsLamps`, which walks every location per call.
    const lampRoomOf = new Map<string, string>();
    for (const location of state.locations) {
        if (purposeOf(location) !== WHERE_THE_LAMPS_BURN) continue;
        const house = location.data?.factionId;
        if (typeof house === 'string' && !lampRoomOf.has(house)) lampRoomOf.set(house, location.id);
    }

    for (let h = 0; h < state.factions.length; h++) {
        const house = state.factions[h]!;
        if (house.dissolvedOnDay !== null || house.seatLocationId === null) continue;
        const seat = house.seatLocationId;
        if (!byId.has(seat)) continue;
        const members = (rolls.get(house.id) ?? []).map(i => ({ at: i, npc: state.npcs[i]! }));
        if (members.length === 0) continue;

        const canCut = thisHouseCanIssue(members.map(m => m.npc.cultivation.realmOrdinal));
        let elder: string | null | undefined;
        const internalAffairsElder = (): string | null => {
            if (elder === undefined) {
                elder = theInternalAffairsElderIn(
                    state.locations,
                    house,
                    members.map(m => ({ id: m.npc.id, rankIndex: m.npc.factionRankIndex }))
                );
            }
            return elder;
        };
        let reach: Map<string, number> | undefined;

        const enter = (npc: NpcRecord): void => {
            const given = whatTheHouseGivesThem({
                house,
                person: { id: npc.id, name: npc.name, rankIndex: npc.factionRankIndex },
                wearsItsRobes: wears(npc, house.id),
                holdsItsToken: holds(tokenIdFor(npc.id), npc, house.id),
                canCut,
                lampRoomId: lampRoomOf.get(house.id) ?? seat,
                internalAffairsElder,
                onDay: day
            });
            if (given.robes) {
                put(given.robes);
                robed.add(`${npc.id}|${house.id}`);
                done.entered++;
            }
            if (given.token && given.lamp) {
                put(given.token);
                put(given.lamp);
                done.cut++;
            }
        };

        // A RECRUITER WITH NO SLIP REPORTS WHEN THEY ARE NEXT AT THE HOUSE.
        // Before anybody is entered, so a recruit and the one who took them on
        // arriving in the same year are let in that year.
        for (const { at } of members) {
            const npc = state.npcs[at]!;
            if (!isTheWorldsToMove(npc) || !isInsideTheCompound(byId, npc.locationId, seat)) continue;
            done.reported += deliverWhatTheyOweTheHouse(state, npc.id, house.id, day);
        }

        for (const { at } of members) {
            // Read again: a report made above rewrote the recruiter's row.
            const npc = state.npcs[at]!;
            // The player's mirror row is the player's. What they carry is on
            // their own sheet, and the world does not walk them anywhere.
            if (!isTheWorldsToMove(npc)) continue;

            if (isInsideTheCompound(byId, npc.locationId, seat)) {
                if (!wears(npc, house.id)) {
                    // NEVER ENTERED: let in on the house's word, which is the
                    // report of whoever took them on. Without it they are taken
                    // to the Internal Affairs Elder and questioned, and let in
                    // or turned off the roll on what the house knows. Somebody
                    // nobody took on - born or woken inside - is not new at its
                    // gate. See `whatTheHouseMakesOfSomebodyNew`.
                    const made = whatTheHouseMakesOfSomebodyNew(state, state.factions[h]!, npc);
                    if (made.reading === 'rejected on questioning') {
                        theyAreEntered(state, house.id, npc.id);
                        const row = state.npcs[at]!;
                        state.npcs[at] = { ...row, factionId: null, factionRankIndex: -1, updatedOnDay: day };
                        done.rejected++;
                        continue;
                    }
                    if (made.reading === 'admitted on questioning') done.admittedOnQuestioning++;
                    theyAreEntered(state, house.id, npc.id);
                }
                enter(state.npcs[at]!);
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
            if (!wears(npc, house.id)) {
                // NEVER ENTERED: they move in. On the road to the seat for the
                // walk, and entered the year they are standing in it.
                state.npcs[at] = onTheRoadToLiveAtTheHouse(npc, house.name, seat, day, days);
                done.sent++;
                continue;
            }
            // ALREADY ONE OF ITS OWN, owed a token: there and back.
            const there = onTheRoadToBeEntered(npc, house.name, seat, day, days);
            state.npcs[at] = there;
            enter(there);
            done.sent++;
        }

        // Nobody expected any more: dead, off this roll, or entered already.
        for (const expected of whoTheHouseExpects(state.factions[h]!)) {
            if (onRollOf.get(expected.personId) === house.id
                && !robed.has(`${expected.personId}|${house.id}`)) continue;
            theHouseStopsExpecting(state, house.id, expected.personId);
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
 * A recruit going to live at the house that took them.
 *
 * The design owner: *"move into the compound."* This was a round trip, on the
 * argument that joining where you stand is right and so is living where you
 * live, and it was measured against the one-way version: on the `demography`
 * seed at 80 years, people in settlements 557 to 338 and sect ground 21% to 46%.
 * The owner has ruled the other way, and the drain is the ruling's consequence
 * rather than a defect - settlements lose the people houses recruit. See
 * `demography.test.ts`.
 *
 * Walked, not placed: standing where they joined, `travelling` for the walk with
 * the seat as `returnTo`, so `bringHomeWhoeverIsDue` puts them in the compound
 * when the term is up and this pass enters them the year it finds them there.
 */
function onTheRoadToLiveAtTheHouse(
    npc: NpcRecord,
    houseName: string,
    seat: string,
    day: number,
    days: number
): NpcRecord {
    return {
        ...npc,
        activity: {
            kind: 'travelling',
            note: `On the way to ${houseName}, to be entered on its roll and live there.`,
            withIds: [],
            sinceDay: day,
            untilDay: day + Math.max(1, Math.ceil(days)),
            returnTo: seat
        },
        updatedOnDay: day
    };
}

/**
 * There and back, for one of the house's own who is owed a token and lives
 * elsewhere: standing at the seat for the term, with where they set out from as
 * `returnTo`, so `bringHomeWhoeverIsDue` ends it like any other. A recruit moves
 * in (`onTheRoadToLiveAtTheHouse`); somebody already entered keeps their home.
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
