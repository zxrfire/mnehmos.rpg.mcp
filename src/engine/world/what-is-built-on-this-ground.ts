/**
 * What is built on the ground somebody is standing on, and what of it they see.
 *
 * ── THE GAP THIS CLOSES, MEASURED ────────────────────────────────────────
 *
 * `architecture.ts` grows an interior for every seated house in the world: in a
 * pinned world, 939 locations across 36 compounds, each with a purpose, a
 * capacity, what it was cut for, how obvious it is, its own qi, and an entry
 * threshold. `describeRoom`, `roomsVisibleTo`, `roomStageFor`, `reachThrough`,
 * `pathTo`, `houseStyleOf` and `precinctsOf` had **no caller anywhere outside
 * that file**, so none of it reached anybody.
 *
 * Played, standing on the Azure Cloud Pavilion's own ground - a monumental
 * walled court in dressed stone with bronze trim, 24 interior rooms, 2,204
 * seats cut, a ward over the whole of it, two sealed vaults and an inner
 * precinct calibrated at ordinal 41 - `I examine this place` answered:
 *
 *     Azure Cloud Pavilion grounds, which is a name and a road and not much
 *     else that anyone here can tell you.
 *
 * True of what the reader could see; false about the world. And the Six Li
 * Patrol, which has no compound at all, read the same three paragraphs with a
 * different qi phrase.
 *
 * ── WHY IT IS NOT ABOUT HOUSES ───────────────────────────────────────────
 *
 * The question is *what is built inside this ground*, answered off `parentId`
 * and fields any `LocationRecord` carries. A compound is the only thing the
 * seeder currently nests, so a compound is what it currently finds; a ruin with
 * chambers cut into it would read through the same function on the day the
 * world grows one. Where nothing is built it returns nothing and says nothing.
 * A place is not owed an interior.
 *
 * ── SHOWING, NOT TELLING ─────────────────────────────────────────────────
 *
 * `roomStageFor` already rules what a viewer can make out. This obeys it and
 * adds nothing: a building below the floor comes back with `name: null` and is
 * still COUNTED, because a visitor can see a roof and cannot say what happens
 * under it. That is the hook the knowledge gate exists to be opened on, and
 * handing over the word "treasury" would close it in the same breath.
 *
 * PURE. Records in, a reading out. No I/O, no RNG, no mutation.
 */

import { isAtLeast, type KnowingStage } from '../social/discovery.js';
import {
    type RoomPurpose,
    type ViewerStanding,
    pathTo,
    purposeOf,
    reachThrough,
    roomStageFor
} from './architecture.js';
import type { AccessQuery, LocationRecord } from './locations.js';

/** Why a way in is not open. `shut` is a door; `barred` is a person or a wall. */
export type WayIn = 'open' | 'barred' | 'shut';

export interface ABuildingOnThisGround {
    id: string;
    /**
     * The house's own name for it, or null where the viewer can see the
     * building and could not tell you what it is.
     */
    name: string | null;
    purpose: RoomPurpose | null;
    /** How many the stonework was cut for. 0 where the row does not say. */
    builtFor: number;
    /** How many it holds now that the house has furnished around it. */
    capacity: number;
    /** Steps inward from the ground being stood on. */
    depth: number;
    /** Whether this is a walled division somebody passes through, not a room. */
    enclosure: boolean;
    stage: KnowingStage;
    wayIn: WayIn;
    /** Its own qi, against the qi of the ground outside it. */
    qiAgainstOutside: number;
}

export interface WhatIsBuiltOnThisGround {
    locationId: string;
    /** Everything nested inside this ground, seen or not. Engine-side only. */
    builtTotal: number;
    /** The ones this viewer can make out at all, outermost first. */
    seen: ABuildingOnThisGround[];
    /** Of those, how many they could put a name to. */
    named: number;
    /** Places under the roofs they can see. Walls are not counted twice. */
    seatsSeen: number;
    /** The largest single roof they can see, in places. */
    largestRoof: number;
    /**
     * Whether any of it was cut by people who are not in the house any more.
     *
     * `builtFor` is written only for a compound somebody INHERITED, which is
     * what makes it the interesting field rather than a duplicate of capacity:
     * a house standing in a shell it did not build is a different house from
     * one that built what it stands in, and the row says which.
     */
    cutByPeopleWhoAreGone: boolean;
    /** Walled divisions of this ground they can see the outside of. */
    enclosuresSeen: number;
    /** Of those, the ones they may walk into. */
    enclosuresOpen: number;
    /**
     * The outermost thing they can see and may not walk into, or null.
     *
     * Outermost rather than deepest on purpose, and for the reason
     * `reachThrough` gives: a wall you are standing at is where the walk ends,
     * and the sealed vault four courts further in is a door you were never
     * going to reach.
     */
    stoppedAt: ABuildingOnThisGround | null;
    /** The thickest qi anywhere they can see inside. */
    qiInnermost: number;
    qiHere: number;
}

/**
 * What is built here, filtered through what this person can perceive.
 *
 * `viewer` is their standing in whoever holds this ground - an outsider passes
 * `member: false` and the rest at zero. `access` is the same query
 * `evaluateAccess` takes, so what a door does to somebody here is decided by
 * the one function that decides it everywhere else.
 */
export function whatIsBuiltOnThisGround(input: {
    locations: readonly LocationRecord[];
    standingAt: string | null | undefined;
    viewer: ViewerStanding;
    access: AccessQuery;
}): WhatIsBuiltOnThisGround {
    const here = input.locations.find(row => row.id === input.standingAt);
    const empty: WhatIsBuiltOnThisGround = {
        locationId: input.standingAt ?? '',
        builtTotal: 0,
        seen: [],
        named: 0,
        seatsSeen: 0,
        largestRoof: 0,
        cutByPeopleWhoAreGone: false,
        enclosuresSeen: 0,
        enclosuresOpen: 0,
        stoppedAt: null,
        qiInnermost: here?.qiDensity ?? 0,
        qiHere: here?.qiDensity ?? 0
    };
    if (!here) return empty;

    const byParent = new Map<string, LocationRecord[]>();
    for (const row of input.locations) {
        if (row.parentId === null) continue;
        const kin = byParent.get(row.parentId);
        if (kin) kin.push(row);
        else byParent.set(row.parentId, [row]);
    }

    // ── AND ONLY WHAT IS INSIDE THIS PLACE, NOT WHAT IS UNDER IT ─────────
    //
    // `parentId` carries two different relations. A precinct's parent is the
    // ground it is walled into; a settlement's parent is the PROVINCE it sits
    // somewhere in, and a compound's parent is that same province. Walking the
    // tree without asking which relation it was reads every house in the
    // province as though it were a wing of wherever you happen to be standing.
    //
    // FOUND BY PLAYING, standing in The Jade Gorge: "I look at the buildings"
    // reported 114 courts and 358 buildings and named the precincts of six
    // separate houses, several of them nine days' walk away. A forecourt is not
    // visible from a province.
    //
    // `interior` is the generator's own word for the first relation and is
    // written on every room and precinct it cuts. It is the contract: anything
    // nested that is a place in its own right - a settlement, a vein, a ruin -
    // does not carry it and is not descended into. Anything the world starts
    // nesting INSIDE a place has to carry it to be seen from there.
    const inside: Array<{ room: LocationRecord; depth: number }> = [];
    const walk = (id: string, depth: number) => {
        for (const child of byParent.get(id) ?? []) {
            if (!child.tags.includes('interior')) continue;
            inside.push({ room: child, depth });
            walk(child.id, depth + 1);
        }
    };
    walk(here.id, 1);
    if (inside.length === 0) return empty;

    const seen: ABuildingOnThisGround[] = [];
    for (const { room, depth } of inside) {
        const stage = roomStageFor(room, input.viewer);
        if (stage === 'unaware') continue;
        // Everything up to and including where they are standing is free: they
        // are there. Without this the read charges a visitor for the outer wall
        // they already walked through and reports the forecourt as barred.
        const reach = reachThrough(
            pathTo(input.locations, room.id), input.access, { enteredAt: here.id }
        );
        // `placed` and not `named`, which is the same floor `roomsVisibleTo`
        // uses and `REACHABLE_FROM` states. It matters most for an outsider:
        // `roomStageFor` gives a stranger `named` for any court obvious enough
        // to be seen from the road, and a compound's court names are the
        // HOUSE'S OWN LADDER - "the outer disciple precinct", "the warden
        // precinct". Handing those over for standing at the gate is the
        // knowledge gate being opened by the read that was meant to be the hook
        // for opening it. At `placed` a stranger keeps the gatehouse and the
        // forecourt, which they are standing in, and everything deeper is a
        // roof until somebody tells them otherwise.
        const canSay = isAtLeast(stage, 'placed');
        seen.push({
            id: room.id,
            name: canSay ? room.name : null,
            purpose: canSay ? purposeOf(room) : null,
            builtFor: numberOf(room.data.builtFor),
            capacity: numberOf(room.data.capacity),
            depth,
            enclosure: room.kind === 'precinct',
            stage,
            wayIn: reach.steps.some(step => step.closed)
                ? 'shut'
                : reach.level === 'barred' ? 'barred' : 'open',
            qiAgainstOutside: room.qiDensity - here.qiDensity
        });
    }
    seen.sort((a, b) => a.depth - b.depth || b.builtFor - a.builtFor);

    const shut = seen.filter(row => row.wayIn !== 'open');
    // A walled division you pass THROUGH, read off `kind` rather than off a
    // compound's own vocabulary so that anything the world nests behind a wall
    // counts the same way. Depth alone will not do it: a compound's array
    // stones hang off the seat beside its precincts, so counting depth-1
    // children told a visitor at the Azure Cloud Pavilion they could see eight
    // courts when four of the eight were stones set in the perimeter.
    const enclosures = seen.filter(row => row.enclosure);
    const roofs = seen.filter(row => !row.enclosure);
    return {
        locationId: here.id,
        builtTotal: inside.length,
        seen,
        named: seen.filter(row => row.name !== null).length,
        // Roofs only. A precinct's capacity is the sum of what stands inside
        // it, so counting walls and rooms together doubles the compound.
        seatsSeen: roofs.reduce((sum, row) => sum + row.capacity, 0),
        largestRoof: roofs.reduce((most, row) => Math.max(most, row.capacity), 0),
        cutByPeopleWhoAreGone: seen.some(row => row.builtFor > 0),
        enclosuresSeen: enclosures.length,
        enclosuresOpen: enclosures.filter(row => row.wayIn === 'open').length,
        stoppedAt: shut[0] ?? null,
        qiInnermost: seen.reduce(
            (most, row) => Math.max(most, row.qiAgainstOutside + here.qiDensity),
            here.qiDensity
        ),
        qiHere: here.qiDensity
    };
}

function numberOf(raw: unknown): number {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}
