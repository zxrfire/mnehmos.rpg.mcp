/**
 * A communication talisman carries word home: a counted stack marked with a
 * house, and what burning one off it writes.
 *
 * The catalog row is `src/data/cultivation/communication-talismans.ts`. This is
 * the stack and the burning. The yearly half - who is handed a stack, who is
 * looked in on, what somebody away reports - is
 * `what-a-house-hears-from-its-people-away.ts`.
 *
 * ── A STACK, NOT A ROW WITH A HISTORY ────────────────────────────────────
 *
 * The owner: *"don't bother making them tracked, they're just counted"*, *"you
 * just have a fungible stack"*, *"each communication talisman is marked with a
 * house"*. So a stack is ONE object per holder per mark: a quantity on
 * `data.quantity`, the mark on `data.markedBy`, and the holder in the ordinary
 * two fields - `possessorId` for a person carrying it, `ownerId` with nobody
 * carrying it for a house's own stock in its treasury. Burning one takes one off
 * the number and a person's stack that reaches nothing is gone. Nothing is kept
 * about any one slip, because there is nothing about one slip anybody could ask.
 *
 * NOT TAGGED `talisman`. That tag is how a house arming its own finds the strike
 * and teleportation slips (`armItsOwn`) and how `isUnburnt` reads one, and a
 * stack of forty communication talismans is neither a weapon nor a door.
 *
 * ── THE MARK IS WHO IT ANSWERS TO ────────────────────────────────────────
 *
 * A slip carries word to the house whose mark is on it, and to nobody else.
 * Somebody holding another house's slips can only send word to that house. The
 * simplest honest reading of a slip "to my master": it goes to the master's
 * house, addressed to them. A private slip keyed to one person is not built.
 * The mark is also something a doorway could read later - whose slips somebody
 * is carrying says whose they are - and nothing reads it for that yet.
 *
 * ── WHAT SENDING WORD WRITES ─────────────────────────────────────────────
 *
 * One fact, and the house holds it through the path it already holds a
 * returning party's account by: `whatAHousesOwnErrandsBringBack` reads a row
 * sited on some ground, naming the house, with an actor whose role says the
 * house was told. The role here is `SENT_WORD_HOME`, which that reading takes
 * and `whatStandingOnItGives` does not, because burning a slip about a door is
 * not standing at it.
 *
 * `said_in_public` is the ledger's word for an utterance, and `secret` because a
 * slip is heard by the house and by nobody in the square it was burnt in: the
 * air does not carry it (`isInTheAirFor`).
 */

import { THE_COMMUNICATION_TALISMAN } from '../../data/cultivation/communication-talismans.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact, type HistoricalActor, type HistoricalFact } from './history.js';
import type { LocationRecord } from './locations.js';
import { WHAT_A_SLIP_TAKES, WHAT_A_SLIP_WEIGHS } from './a-talisman-is-one-act-somebody-already-paid-for.js';
import { howMuchAGradeIsWorthTracking, makeObject, type ObjectRecord } from './possessions.js';
import { SENT_WORD_HOME } from './who-goes-out-for-a-house-and-what-comes-back.js';
import type { WorldState } from './world-state.js';

/** The one tag every stack carries, and the only thing a reader looks for. */
export const A_STACK_OF_COMMUNICATION_TALISMANS = 'communication-talismans';

/** The id of a stack, which is what makes it one per holder per mark. */
export function stackIdFor(houseId: string, holderId: string | null): string {
    return holderId === null
        ? `treasury-${houseId}-communication-talismans`
        : `communication-talismans-${houseId}-${holderId}`;
}

function isAStack(o: ObjectRecord): boolean {
    return o.tags.includes(A_STACK_OF_COMMUNICATION_TALISMANS);
}

function quantityOf(o: ObjectRecord): number {
    const n = Number(o.data.quantity ?? 0);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/** The mark on a stack. */
export function markOn(o: ObjectRecord): string | null {
    return typeof o.data.markedBy === 'string' ? o.data.markedBy : null;
}

/** Whether this row is this holder's stack of this house's slips. Null holder is the house's own. */
function isTheStack(o: ObjectRecord, houseId: string, holderId: string | null): boolean {
    if (!isAStack(o) || markOn(o) !== houseId) return false;
    return holderId === null
        ? o.possessorId === null && o.ownerId === houseId
        : o.possessorId === holderId;
}

/** How many of this house's slips this person is carrying. */
export function howManyTheyCarry(
    objects: readonly ObjectRecord[],
    holderId: string,
    houseId: string
): number {
    let n = 0;
    for (const o of objects) if (isTheStack(o, houseId, holderId)) n += quantityOf(o);
    return n;
}

/** Every mark this person carries slips of, with how many. */
export function theMarksTheyCarry(
    objects: readonly ObjectRecord[],
    holderId: string
): { houseId: string; count: number }[] {
    const by = new Map<string, number>();
    for (const o of objects) {
        if (!isAStack(o) || o.possessorId !== holderId) continue;
        const mark = markOn(o);
        if (mark === null) continue;
        by.set(mark, (by.get(mark) ?? 0) + quantityOf(o));
    }
    return [...by.entries()].filter(([, count]) => count > 0).map(([houseId, count]) => ({ houseId, count }));
}

/**
 * THE STACKS, OPENED ONCE FOR A PASS THAT TOUCHES MANY OF THEM.
 *
 * The free functions below each walk every object in the world, which is right
 * for one burn and wrong for a year of them. Measured with `--cpu-prof` over a
 * hundred years on one seed: the walks inside hand-outs and burns were most of
 * the yearly pass. This reads the world's rows once into an index by holder and
 * mark, and writes through it.
 *
 * THE SAME ROWS AND THE SAME ANSWERS. A person's stack that reaches nothing is
 * left at nought until {@link TheStacksInHand.close}, which removes every one of
 * those in a single sweep instead of splicing each out as it empties; a stack
 * that empties and is handed more in the same pass is the same row filled again.
 * Nothing but this module reads a stack, so nothing sees the nought in between.
 */
export interface TheStacksInHand {
    /** How many this person carried when the book was opened. */
    carriedAtFirst(holderId: string, houseId: string): number;
    carried(holderId: string, houseId: string): number;
    theHouseHas(houseId: string): number;
    add(input: {
        houseId: string;
        houseName: string;
        holderId: string | null;
        holderName?: string;
        count: number;
        locationId?: string | null;
        onDay?: number;
    }): number;
    take(input: { houseId: string; holderId: string | null; count: number }): number;
    handOut(input: { houseId: string; houseName: string; toId: string; toName: string; upTo: number }): number;
    /** Sweep out the people's stacks that reached nothing. Call once, at the end. */
    close(): void;
}

export function theStacksInHand(objects: ObjectRecord[]): TheStacksInHand {
    const keyOf = (holderId: string | null, houseId: string) => `${holderId ?? '#house'}|${houseId}`;
    // Every row a holder has of a mark, in the world's order. Usually one; more
    // where somebody came by a second stack of the same house's slips, which is
    // what an heir does when they are handed the dead's things.
    const at = new Map<string, number[]>();
    const atFirst = new Map<string, number>();
    for (let i = 0; i < objects.length; i++) {
        const o = objects[i]!;
        if (!isAStack(o)) continue;
        const mark = markOn(o);
        if (mark === null) continue;
        const holder = o.possessorId !== null ? o.possessorId : o.ownerId === mark ? null : undefined;
        if (holder === undefined) continue;
        const key = keyOf(holder, mark);
        const rows = at.get(key);
        if (rows) rows.push(i); else at.set(key, [i]);
        atFirst.set(key, (atFirst.get(key) ?? 0) + quantityOf(o));
    }
    const has = (holderId: string | null, houseId: string): number => {
        let n = 0;
        for (const i of at.get(keyOf(holderId, houseId)) ?? []) n += quantityOf(objects[i]!);
        return n;
    };
    // Into the first row, as `addToTheStack` does.
    const add: TheStacksInHand['add'] = input => {
        const count = Math.max(0, Math.floor(input.count));
        const key = keyOf(input.holderId, input.houseId);
        const i = at.get(key)?.[0];
        if (i === undefined) {
            if (count === 0) return 0;
            at.set(key, [objects.length]);
            objects.push(aStack({ ...input, quantity: count }));
            return count;
        }
        const row = objects[i]!;
        const now = quantityOf(row) + count;
        objects[i] = { ...row, data: { ...row.data, quantity: now } };
        return now;
    };
    // Off the last row first, as `takeOffTheStack` does.
    const take: TheStacksInHand['take'] = input => {
        const rows = at.get(keyOf(input.holderId, input.houseId)) ?? [];
        let wanted = Math.max(0, Math.floor(input.count));
        let taken = 0;
        for (let r = rows.length - 1; r >= 0 && wanted > 0; r--) {
            const i = rows[r]!;
            const row = objects[i]!;
            const held = quantityOf(row);
            const off = Math.min(held, wanted);
            wanted -= off;
            taken += off;
            if (off > 0) objects[i] = { ...row, data: { ...row.data, quantity: held - off } };
        }
        return taken;
    };
    return {
        carriedAtFirst: (holderId, houseId) => atFirst.get(keyOf(holderId, houseId)) ?? 0,
        carried: (holderId, houseId) => has(holderId, houseId),
        theHouseHas: houseId => has(null, houseId),
        add,
        take,
        handOut: input => {
            const short = Math.max(0, Math.floor(input.upTo) - has(input.toId, input.houseId));
            if (short === 0) return 0;
            const given = take({ houseId: input.houseId, holderId: null, count: short });
            if (given > 0) {
                add({
                    houseId: input.houseId, houseName: input.houseName,
                    holderId: input.toId, holderName: input.toName, count: given
                });
            }
            return given;
        },
        close: () => {
            let write = 0;
            for (let read = 0; read < objects.length; read++) {
                const o = objects[read]!;
                if (isAStack(o) && o.possessorId !== null && quantityOf(o) === 0) continue;
                objects[write++] = o;
            }
            objects.length = write;
            at.clear();
        }
    };
}

/** How many the house has in its own stock, uncarried. */
export function howManyTheHouseHas(objects: readonly ObjectRecord[], houseId: string): number {
    let n = 0;
    for (const o of objects) if (isTheStack(o, houseId, null)) n += quantityOf(o);
    return n;
}

/**
 * A new stack row. Mortal grade, so `mundane`, so counted - read off the catalog
 * row's grade rather than written in.
 */
function aStack(input: {
    houseId: string;
    houseName: string;
    holderId: string | null;
    holderName?: string;
    quantity: number;
    locationId?: string | null;
    /**
     * The day it was put there. Where it is given, the row says so, which is how
     * a stack cut at a seat after the ground was emptied reads as put there since
     * rather than left behind (`a-legacy-standing-open-can-be-taken.test.ts`).
     */
    onDay?: number;
}): ObjectRecord {
    const row = makeObject({
        id: stackIdFor(input.houseId, input.holderId),
        name: `${input.houseName} ${THE_COMMUNICATION_TALISMAN.name}s`,
        kind: 'other',
        significance: howMuchAGradeIsWorthTracking(THE_COMMUNICATION_TALISMAN.grade),
        description: `Communication talismans marked with ${input.houseName}. `
            + THE_COMMUNICATION_TALISMAN.what,
        possessorId: input.holderId,
        ownerId: input.holderId ?? input.houseId,
        ownerName: input.holderId === null ? input.houseName : (input.holderName ?? ''),
        tags: [A_STACK_OF_COMMUNICATION_TALISMANS, `house:${input.houseId}`],
        data: {
            markedBy: input.houseId,
            quantity: Math.max(0, Math.floor(input.quantity)),
            talismanId: THE_COMMUNICATION_TALISMAN.id,
            grade: THE_COMMUNICATION_TALISMAN.grade
        }
    });
    if (input.onDay !== undefined) {
        row.provenance.push({
            onDay: Math.floor(input.onDay),
            holderId: input.holderId,
            holderName: input.holderId === null ? input.houseName : (input.holderName ?? ''),
            how: 'crafted',
            source: input.houseName,
            previousHolderId: null,
            previousHolderName: null,
            factId: null,
            note: ''
        });
    }
    return {
        ...row,
        locationId: input.locationId ?? null,
        volume: WHAT_A_SLIP_TAKES,
        weight: WHAT_A_SLIP_WEIGHS
    };
}

/** The house's own stock row, for the treasury seeder. */
export function aHousesStockOfCommunicationTalismans(input: {
    houseId: string;
    houseName: string;
    quantity: number;
    locationId: string | null;
    onDay?: number;
}): ObjectRecord {
    return aStack({ ...input, holderId: null });
}

/**
 * Add to a stack, making the row where there is none. Mutates `objects`.
 * Returns how many the holder now has.
 */
export function addToTheStack(
    objects: ObjectRecord[],
    input: {
        houseId: string;
        houseName: string;
        /** Null for the house's own stock. */
        holderId: string | null;
        holderName?: string;
        count: number;
        locationId?: string | null;
        onDay?: number;
    }
): number {
    const add = Math.max(0, Math.floor(input.count));
    const at = objects.findIndex(o => isTheStack(o, input.houseId, input.holderId));
    if (at < 0) {
        if (add === 0) return 0;
        objects.push(aStack({ ...input, quantity: add }));
        return add;
    }
    const row = objects[at]!;
    const now = quantityOf(row) + add;
    objects[at] = { ...row, data: { ...row.data, quantity: now } };
    return now;
}

/**
 * Take up to `count` off a stack. Mutates `objects`. A person's stack that
 * reaches nothing is removed, since nothing about it is left to keep; the
 * house's own row stays at nought, because an empty shelf is still a shelf.
 * Returns how many were taken.
 */
export function takeOffTheStack(
    objects: ObjectRecord[],
    input: { houseId: string; holderId: string | null; count: number }
): number {
    let wanted = Math.max(0, Math.floor(input.count));
    let taken = 0;
    for (let i = objects.length - 1; i >= 0 && wanted > 0; i--) {
        const row = objects[i]!;
        if (!isTheStack(row, input.houseId, input.holderId)) continue;
        const has = quantityOf(row);
        const off = Math.min(has, wanted);
        wanted -= off;
        taken += off;
        if (has - off === 0 && input.holderId !== null) objects.splice(i, 1);
        else objects[i] = { ...row, data: { ...row.data, quantity: has - off } };
    }
    return taken;
}

/**
 * The house hands somebody slips out of its own stock, up to `upTo` in their
 * hands. What the house does not have it cannot hand over. Returns how many
 * changed hands.
 */
export function theHouseHandsThemSlips(
    objects: ObjectRecord[],
    input: { houseId: string; houseName: string; toId: string; toName: string; upTo: number }
): number {
    const short = Math.max(0, Math.floor(input.upTo) - howManyTheyCarry(objects, input.toId, input.houseId));
    if (short === 0) return 0;
    const given = takeOffTheStack(objects, { houseId: input.houseId, holderId: null, count: short });
    if (given > 0) {
        addToTheStack(objects, {
            houseId: input.houseId,
            houseName: input.houseName,
            holderId: input.toId,
            holderName: input.toName,
            count: given
        });
    }
    return given;
}

// ─────────────────────────────────────────────────────────────────────────
// HOW FAR
// ─────────────────────────────────────────────────────────────────────────

/**
 * Walking days from a house's seat to a place, or null where no road reaches.
 *
 * `walkingDaysFrom` is the one answer to how far, and this is that answer read
 * over a smaller graph with the same result. That walk steps up to a parent and
 * down to a child for nothing, so everywhere under one top-level place is nought
 * days from everywhere else under it; the only steps that cost are links. So the
 * distance between two places is the distance between their top-level places
 * over the links that join those: every path in the full walk is a path here
 * with the same links in it, and every link here can be reached at nought.
 * `a-house-hears-from-its-people-away.test.ts` holds the two equal over every
 * place of a seeded world.
 *
 * Measured with `--cpu-prof` over a hundred years on one seed before this: a
 * full walk per seat per year was a third of the yearly word pass. What it does
 * not answer as the full walk would: a place no location record holds, which
 * the full walk can still price if some link names it. This says null.
 */
export function howFarFromTheSeat(
    locations: readonly LocationRecord[]
): (seatId: string, placeId: string | null) => number | null {
    const byId = new Map(locations.map(l => [l.id, l] as const));
    const roots = new Map<string, string>();
    const rootOf = (id: string): string | null => {
        const had = roots.get(id);
        if (had !== undefined) return had;
        let cursor = byId.get(id);
        if (!cursor) return null;
        const seen = new Set<string>();
        while (cursor.parentId !== null && !seen.has(cursor.id)) {
            seen.add(cursor.id);
            const up = byId.get(cursor.parentId);
            if (!up) break;
            cursor = up;
        }
        roots.set(id, cursor.id);
        return cursor.id;
    };
    // The links between top-level places, the cheapest of each pair, built the
    // first time anybody is further off than their own province.
    let edges: Map<string, Map<string, number>> | null = null;
    const edgesOf = (): Map<string, Map<string, number>> => {
        if (edges) return edges;
        const built = new Map<string, Map<string, number>>();
        for (const l of locations) {
            if (l.links.length === 0) continue;
            const from = rootOf(l.id)!;
            for (const link of l.links) {
                if (!link.open) continue;
                const to = rootOf(link.toLocationId);
                if (to === null || to === from) continue;
                const cost = Math.max(1, link.travelDays);
                const out = built.get(from) ?? new Map<string, number>();
                if (cost < (out.get(to) ?? Infinity)) out.set(to, cost);
                built.set(from, out);
            }
        }
        edges = built;
        return built;
    };
    const fromRoot = new Map<string, Map<string, number>>();
    const distancesFrom = (root: string): Map<string, number> => {
        const had = fromRoot.get(root);
        if (had) return had;
        const graph = edgesOf();
        const best = new Map<string, number>([[root, 0]]);
        const done = new Set<string>();
        for (;;) {
            let next: string | null = null;
            let nextDays = Infinity;
            for (const [id, days] of best) {
                if (!done.has(id) && days < nextDays) { next = id; nextDays = days; }
            }
            if (next === null) break;
            done.add(next);
            for (const [to, cost] of graph.get(next) ?? []) {
                if (nextDays + cost < (best.get(to) ?? Infinity)) best.set(to, nextDays + cost);
            }
        }
        fromRoot.set(root, best);
        return best;
    };
    return (seatId, placeId) => {
        if (placeId === null) return null;
        const a = rootOf(seatId);
        const b = rootOf(placeId);
        if (a === null || b === null) return null;
        if (a === b) return 0;
        return distancesFrom(a).get(b) ?? null;
    };
}

/** Whether a slip burnt this far from the house reaches it. */
export function doesWordReach(walkingDays: number | null): boolean {
    return walkingDays !== null && walkingDays <= THE_COMMUNICATION_TALISMAN.reachWalkingDays;
}

// ─────────────────────────────────────────────────────────────────────────
// SENDING WORD
// ─────────────────────────────────────────────────────────────────────────

/** Who the word is for, at the house the slip answers to. */
export type WhoTheWordIsFor =
    | { kind: 'the_hall' }
    /** An office named by its title, whoever holds it. */
    | { kind: 'an_office'; title: string; holderId: string | null }
    | { kind: 'a_person'; id: string; name: string };

export type WhyNoWordWent =
    /** They carry none of this house's slips. */
    | 'no_slip'
    /** They do, and the house is further than a slip carries. */
    | 'out_of_reach'
    /** The house is gone or has no hall for word to reach. */
    | 'no_house';

export type WordSent =
    | { sent: true; fact: HistoricalFact; left: number; walkingDays: number }
    | { sent: false; why: WhyNoWordWent; walkingDays: number | null; carrying: number };

export interface SendingWord {
    senderId: string;
    senderName: string;
    /** The mark on the slip, which is the house the word goes to. */
    houseId: string;
    /** Where the sender is standing when they burn it. */
    fromLocationId: string | null;
    onDay: number;
    to: WhoTheWordIsFor;
    /** What the word says, stated plainly. */
    says: string;
    /** The fact the word is about, when it is about one. */
    aboutFactId?: string | null;
    /**
     * Where the word is about, and where the row is sited. Defaults to the
     * house's own seat, which is where a word about nothing in particular is
     * heard.
     */
    aboutLocationId?: string | null;
    /** Distances, when a caller has already built them for many senders. */
    howFar?: (seatId: string, placeId: string | null) => number | null;
    /** The stacks, when a caller has opened them for many burns. */
    stacks?: TheStacksInHand;
}

/** How the addressee reads in a summary. */
function addressed(to: WhoTheWordIsFor, houseName: string): string {
    switch (to.kind) {
        case 'the_hall': return `the hall of ${houseName}`;
        case 'an_office': return `the ${to.title} of ${houseName}`;
        case 'a_person': return `${to.name}, of ${houseName}`;
    }
}

/**
 * Where the word would go and whether it gets there, writing nothing.
 *
 * The house the mark names, standing, with a hall; and the walking days from
 * where the sender stands to that hall against the slip's reach.
 */
export function whetherWordReachesTheHouse(
    state: Pick<WorldState, 'factions' | 'locations'>,
    input: {
        houseId: string;
        fromLocationId: string | null;
        howFar?: (seatId: string, placeId: string | null) => number | null;
    }
): { house: WorldState['factions'][number] | null; walkingDays: number | null; reaches: boolean } {
    const house = state.factions.find(f => f.id === input.houseId && f.dissolvedOnDay === null) ?? null;
    const seat = house?.seatLocationId ?? null;
    if (house === null || seat === null) return { house: null, walkingDays: null, reaches: false };
    const walkingDays = (input.howFar ?? howFarFromTheSeat(state.locations))(seat, input.fromLocationId);
    return { house, walkingDays, reaches: doesWordReach(walkingDays) };
}

/**
 * The word arrives: the one fact sending it writes. Takes no slip - whoever
 * burnt it has already taken it off whatever stack it was on, a world row for
 * one of the world's people or a pouch for the player.
 */
export function theWordArrives(
    state: WorldState,
    input: Omit<SendingWord, 'howFar' | 'stacks'> & { walkingDays: number | null }
): HistoricalFact | null {
    const house = state.factions.find(f => f.id === input.houseId && f.dissolvedOnDay === null);
    const seat = house?.seatLocationId ?? null;
    if (!house || seat === null) return null;

    const site = input.aboutLocationId ?? seat;
    const actors: HistoricalActor[] = [{ id: input.senderId, name: input.senderName, role: SENT_WORD_HOME }];
    // The person it was for heard it, where the row is sited at the hall they
    // were standing in. Sited on some other ground they did not stand on it,
    // and the house holding the row is how they come to have it.
    const to = input.to;
    if (to.kind === 'a_person' && site === seat) {
        const them = state.npcs.find(n => n.id === to.id);
        if (them && them.status === 'alive' && them.locationId === seat) {
            actors.push({ id: them.id, name: them.name, role: 'heard it' });
        }
    }
    return appendWorldFact(state, makeFact({
        day: Math.floor(input.onDay),
        kind: 'said_in_public',
        scale: 'personal',
        visibility: 'secret',
        magnitude: 0.2,
        summary: `${input.senderName} burnt a communication talisman and sent word to `
            + `${addressed(to, house.name)}: ${input.says}`,
        actors,
        locationId: site,
        factionIds: [house.id],
        causes: input.aboutFactId ? [input.aboutFactId] : [],
        data: {
            communicationTalisman: true,
            markedBy: house.id,
            wordOf: input.aboutFactId ?? null,
            addressedTo: to.kind === 'the_hall' ? 'the hall'
                : to.kind === 'an_office' ? to.title : to.id,
            receivedById: to.kind === 'an_office' ? to.holderId
                : to.kind === 'a_person' ? to.id : null,
            sentFrom: input.fromLocationId,
            walkingDays: input.walkingDays
        }
    }), { bystanders: false, recur: false });
}

/**
 * Burn one of this house's slips off somebody's stack to send word to it.
 *
 * Refuses nothing it cannot say a number for: no slip is a count, out of reach
 * is a distance against the slip's reach. Takes the slip and writes the fact,
 * or does neither. Mutates `state.objects` and the ledger.
 */
export function burnACommunicationTalisman(state: WorldState, input: SendingWord): WordSent {
    const carrying = input.stacks
        ? input.stacks.carried(input.senderId, input.houseId)
        : howManyTheyCarry(state.objects, input.senderId, input.houseId);
    const reach = whetherWordReachesTheHouse(state, input);
    if (reach.house === null) return { sent: false, why: 'no_house', walkingDays: null, carrying };
    if (carrying === 0) return { sent: false, why: 'no_slip', walkingDays: reach.walkingDays, carrying };
    if (!reach.reaches) return { sent: false, why: 'out_of_reach', walkingDays: reach.walkingDays, carrying };

    if (input.stacks) input.stacks.take({ houseId: reach.house.id, holderId: input.senderId, count: 1 });
    else takeOffTheStack(state.objects, { houseId: reach.house.id, holderId: input.senderId, count: 1 });
    const fact = theWordArrives(state, { ...input, walkingDays: reach.walkingDays });
    if (fact === null) return { sent: false, why: 'no_house', walkingDays: reach.walkingDays, carrying };
    return { sent: true, fact, left: carrying - 1, walkingDays: reach.walkingDays ?? 0 };
}

/** Whether a fact is word sent on a communication talisman. */
export function isWordSentHome(fact: Pick<HistoricalFact, 'data'>): boolean {
    return fact.data.communicationTalisman === true;
}
