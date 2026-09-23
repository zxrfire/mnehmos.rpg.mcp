/**
 * A communication talisman carries word home: a slip cut in a pair, one half
 * keyed to the person who carries it and its twin kept where the word is read.
 *
 * The catalog row is `src/data/cultivation/communication-talismans.ts`. This is
 * the stacks and the burning. The yearly half - who is issued slips, who is
 * looked in on, what somebody away reports - is
 * `what-a-house-hears-from-its-people-away.ts`. Which instrument is for which
 * far end - a hall, or a person - is
 * `how-a-word-reaches-somebody-who-is-not-there.md`.
 *
 * ── THREE KINDS OF STACK ─────────────────────────────────────────────────
 *
 * The design owner: *"these are too common and single use, don't bother making
 * them tracked, they're just counted"*, *"each communication talisman is marked
 * with a house"*, *"slips are coded to your name"*, *"every slip has a
 * duplicate"*, *"you can imagine the Internal Affairs bureau having a stack of
 * slips, their end of the slips, SOMEWHERE"*, and *"a house has stock, in the
 * treasury"*. So a stack is one counted row, and it is one of three things:
 *
 *   blanks   the treasury's stock, marked with the house and keyed to nobody.
 *            Internal Affairs cuts them as the house's work, and draws on them
 *            to cut pairs for somebody being sent out
 *   keyed    the half somebody carries, keyed to them. Only they can burn it:
 *            it sends word as them
 *   twins    the other halves of one person's slips, kept in the hall where the
 *            house's lamps burn. A slip burnt anywhere arrives at its twin, and
 *            whoever of Internal Affairs is there reads it
 *
 * A pair is two slips, and both count.
 *
 * ── A PAIR IS AN IDENTITY ────────────────────────────────────────────────
 *
 * *"They break when your ID and life lamp break"*, since they send messages as
 * you. So both halves of somebody's pairs break with their token and their lamp:
 * when they die ({@link theirSlipsBreak}, where the death is settled, so a
 * looter finds nothing), and when they leave the house that keyed them, as the
 * token goes back ({@link handBackTheirSlips}). A missing person's lamp still
 * burns, and their slips still work. An issuer dying breaks nothing: the twins
 * are the hall's, not theirs.
 *
 * NOT TAGGED `talisman`. That tag is how a house arming its own finds the strike
 * and teleportation slips (`armItsOwn`) and how `isUnburnt` reads one, and a
 * stack of forty communication talismans is neither a weapon nor a door.
 *
 * ── WHAT SENDING WORD WRITES ─────────────────────────────────────────────
 *
 * One fact, received by a person: *"a 'house' can't receive messages."* The
 * reader of the hall is named on the row as the one who received it, and the
 * house holds the row through the path it already holds a returning party's
 * account by: `whatAHousesOwnErrandsBringBack` reads a row sited on some ground,
 * naming the house, with an actor whose role says the house was told
 * (`SENT_WORD_HOME`).
 *
 * `said_in_public` is the ledger's word for an utterance, and `secret` because a
 * slip is heard by the reader and by nobody in the square it was burnt in: the
 * air does not carry it (`isInTheAirFor`).
 */

import { THE_COMMUNICATION_TALISMAN } from '../../data/cultivation/communication-talismans.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { makeFact, type HistoricalActor, type HistoricalFact } from './history.js';
import type { LocationRecord } from './locations.js';
import { WHAT_A_SLIP_TAKES, WHAT_A_SLIP_WEIGHS } from './a-talisman-is-one-act-somebody-already-paid-for.js';
import { howMuchAGradeIsWorthTracking, makeObject, type ObjectRecord } from './possessions.js';
import { SENT_WORD_HOME } from './who-goes-out-for-a-house-and-what-comes-back.js';
import { theInternalAffairsElderIn } from './a-house-expects-somebody-it-took-on.js';
import type { WorldState } from './world-state.js';

/** The one tag every stack carries, and the only thing a reader looks for. */
export const A_STACK_OF_COMMUNICATION_TALISMANS = 'communication-talismans';

/** What a stack of slips is. See the header. */
export type WhatTheSlipsAre = 'blanks' | 'keyed' | 'twins';

/** The treasury's blanks. */
export function blanksIdFor(houseId: string): string {
    return `treasury-${houseId}-communication-talismans`;
}

/** The half somebody carries. */
export function keyedIdFor(houseId: string, holderId: string): string {
    return `communication-talismans-${houseId}-${holderId}`;
}

/** The twins of one person's slips, in the hall. */
export function twinsIdFor(houseId: string, senderId: string): string {
    return `communication-talisman-twins-${houseId}-${senderId}`;
}

/** The id of a stack: the treasury's blanks for no holder, or somebody's keyed half. */
export function stackIdFor(houseId: string, holderId: string | null): string {
    return holderId === null ? blanksIdFor(houseId) : keyedIdFor(houseId, holderId);
}

/** Whether a row is a stack of communication talismans of any kind. */
export function isAStackOfCommunicationTalismans(o: Pick<ObjectRecord, 'tags'>): boolean {
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

/** What a stack is, off its own row. */
export function whatTheSlipsAre(o: ObjectRecord): WhatTheSlipsAre {
    if (o.data.slips === 'blanks' || o.data.slips === 'keyed' || o.data.slips === 'twins') return o.data.slips;
    return o.possessorId === null ? 'blanks' : 'keyed';
}

/** Whose identity a keyed half or a set of twins is bound to. Null for blanks. */
export function whoseSlipsTheyAre(o: ObjectRecord): string | null {
    const kind = whatTheSlipsAre(o);
    if (kind === 'blanks') return null;
    if (kind === 'twins') return typeof o.data.twinOf === 'string' ? o.data.twinOf : null;
    return typeof o.data.keyedTo === 'string' ? o.data.keyedTo : o.possessorId;
}

function isBlanks(o: ObjectRecord, houseId: string): boolean {
    return isAStackOfCommunicationTalismans(o) && markOn(o) === houseId && whatTheSlipsAre(o) === 'blanks'
        && o.possessorId === null && o.ownerId === houseId;
}

function isKeyed(o: ObjectRecord, houseId: string, holderId: string): boolean {
    return isAStackOfCommunicationTalismans(o) && markOn(o) === houseId && whatTheSlipsAre(o) === 'keyed'
        && o.possessorId === holderId && whoseSlipsTheyAre(o) === holderId;
}

function isTwins(o: ObjectRecord, houseId: string, senderId: string): boolean {
    return isAStackOfCommunicationTalismans(o) && markOn(o) === houseId && whatTheSlipsAre(o) === 'twins'
        && whoseSlipsTheyAre(o) === senderId;
}

/** Whether this row is this holder's keyed half of this house's slips, or for a null holder the treasury's blanks. */
function isTheStack(o: ObjectRecord, houseId: string, holderId: string | null): boolean {
    return holderId === null ? isBlanks(o, houseId) : isKeyed(o, houseId, holderId);
}

/** How many of this house's slips this person carries, keyed to them. */
export function howManyTheyCarry(
    objects: readonly ObjectRecord[],
    holderId: string,
    houseId: string
): number {
    let n = 0;
    for (const o of objects) if (isKeyed(o, houseId, holderId)) n += quantityOf(o);
    return n;
}

/** How many twins of this person's slips the house's hall keeps. */
export function howManyTwinsTheHallKeeps(
    objects: readonly ObjectRecord[],
    houseId: string,
    senderId: string
): number {
    let n = 0;
    for (const o of objects) if (isTwins(o, houseId, senderId)) n += quantityOf(o);
    return n;
}

/** How many blanks the house has in its treasury. */
export function howManyTheHouseHas(objects: readonly ObjectRecord[], houseId: string): number {
    let n = 0;
    for (const o of objects) if (isBlanks(o, houseId)) n += quantityOf(o);
    return n;
}

/**
 * THE STACKS, OPENED ONCE FOR A PASS THAT TOUCHES MANY OF THEM.
 *
 * The free functions below each walk every object in the world, which is right
 * for one burn and wrong for a year of them. Measured with `--cpu-prof` over a
 * hundred years on one seed: the walks inside hand-outs and burns were most of
 * the yearly pass. This reads the world's rows once into an index by kind,
 * holder and mark, and writes through it.
 *
 * THE SAME ROWS AND THE SAME ANSWERS. A stack that reaches nothing is left at
 * nought until {@link TheStacksInHand.close}, which removes every keyed half and
 * set of twins at nought in a single sweep; the treasury's row stays, because an
 * empty shelf is still a shelf.
 */
export interface TheStacksInHand {
    /** How many this person carried, keyed to them, when the book was opened. */
    carriedAtFirst(holderId: string, houseId: string): number;
    carried(holderId: string, houseId: string): number;
    theHouseHas(houseId: string): number;
    twinsKept(houseId: string, senderId: string): number;
    /**
     * Cut pairs for somebody, up to `upTo` in their hands: a keyed half to them and
     * its twin to the hall. From the treasury's blanks, two a pair, where
     * `fromTheTreasury`; otherwise cut fresh by their own hand. Returns the pairs.
     */
    cutPairsFor(input: {
        houseId: string;
        houseName: string;
        toId: string;
        toName: string;
        upTo: number;
        hallLocationId: string | null;
        fromTheTreasury: boolean;
        onDay?: number;
    }): number;
    /** Burn one of somebody's slips: their half and its twin. False where either is missing. */
    burnOne(houseId: string, senderId: string): boolean;
    /** Sweep out the keyed halves and twins that reached nothing. Call once, at the end. */
    close(): void;
}

export function theStacksInHand(objects: ObjectRecord[]): TheStacksInHand {
    const keyed = (holderId: string, houseId: string) => `k|${holderId}|${houseId}`;
    const blanks = (houseId: string) => `b|${houseId}`;
    const twins = (houseId: string, senderId: string) => `t|${houseId}|${senderId}`;
    const at = new Map<string, number[]>();
    const atFirst = new Map<string, number>();
    const index = (key: string, i: number) => {
        const rows = at.get(key);
        if (rows) rows.push(i); else at.set(key, [i]);
    };
    for (let i = 0; i < objects.length; i++) {
        const o = objects[i]!;
        if (!isAStackOfCommunicationTalismans(o)) continue;
        const mark = markOn(o);
        if (mark === null) continue;
        const kind = whatTheSlipsAre(o);
        const whose = whoseSlipsTheyAre(o);
        let key: string | null = null;
        if (kind === 'blanks' && isBlanks(o, mark)) key = blanks(mark);
        else if (kind === 'keyed' && whose !== null && isKeyed(o, mark, whose)) key = keyed(whose, mark);
        else if (kind === 'twins' && whose !== null) key = twins(mark, whose);
        if (key === null) continue;
        index(key, i);
        atFirst.set(key, (atFirst.get(key) ?? 0) + quantityOf(o));
    }
    const has = (key: string): number => {
        let n = 0;
        for (const i of at.get(key) ?? []) n += quantityOf(objects[i]!);
        return n;
    };
    const put = (key: string, make: () => ObjectRecord, count: number): void => {
        if (count <= 0) return;
        const i = at.get(key)?.[0];
        if (i === undefined) {
            at.set(key, [objects.length]);
            const row = make();
            objects.push({ ...row, data: { ...row.data, quantity: count } });
            return;
        }
        const row = objects[i]!;
        objects[i] = { ...row, data: { ...row.data, quantity: quantityOf(row) + count } };
    };
    const takeFrom = (key: string, count: number): number => {
        const rows = at.get(key) ?? [];
        let wanted = Math.max(0, Math.floor(count));
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
        carriedAtFirst: (holderId, houseId) => atFirst.get(keyed(holderId, houseId)) ?? 0,
        carried: (holderId, houseId) => has(keyed(holderId, houseId)),
        theHouseHas: houseId => has(blanks(houseId)),
        twinsKept: (houseId, senderId) => has(twins(houseId, senderId)),
        cutPairsFor: input => {
            const short = Math.max(0, Math.floor(input.upTo) - has(keyed(input.toId, input.houseId)));
            if (short === 0) return 0;
            const pairs = input.fromTheTreasury
                ? takeFrom(blanks(input.houseId), 2 * Math.min(short, Math.floor(has(blanks(input.houseId)) / 2))) / 2
                : short;
            if (pairs === 0) return 0;
            put(keyed(input.toId, input.houseId), () => aStack({
                slips: 'keyed', houseId: input.houseId, houseName: input.houseName,
                holderId: input.toId, holderName: input.toName, quantity: 0, onDay: input.onDay
            }), pairs);
            put(twins(input.houseId, input.toId), () => aStack({
                slips: 'twins', houseId: input.houseId, houseName: input.houseName,
                holderId: input.toId, holderName: input.toName, quantity: 0,
                locationId: input.hallLocationId, onDay: input.onDay
            }), pairs);
            return pairs;
        },
        burnOne: (houseId, senderId) => {
            if (has(keyed(senderId, houseId)) === 0 || has(twins(houseId, senderId)) === 0) return false;
            takeFrom(keyed(senderId, houseId), 1);
            takeFrom(twins(houseId, senderId), 1);
            return true;
        },
        close: () => {
            let write = 0;
            for (let read = 0; read < objects.length; read++) {
                const o = objects[read]!;
                if (isAStackOfCommunicationTalismans(o) && whatTheSlipsAre(o) !== 'blanks' && quantityOf(o) === 0) continue;
                objects[write++] = o;
            }
            objects.length = write;
            at.clear();
        }
    };
}

/**
 * A new stack row. Mortal grade, so `mundane`, so counted - read off the catalog
 * row's grade rather than written in.
 */
function aStack(input: {
    slips: WhatTheSlipsAre;
    houseId: string;
    houseName: string;
    /** Whose slips: the carrier of a keyed half, the sender twins answer for. Unused for blanks. */
    holderId?: string | null;
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
    const whose = input.slips === 'blanks' ? null : (input.holderId ?? null);
    const carried = input.slips === 'keyed' ? whose : null;
    const id = input.slips === 'blanks' ? blanksIdFor(input.houseId)
        : input.slips === 'keyed' ? keyedIdFor(input.houseId, whose ?? '')
        : twinsIdFor(input.houseId, whose ?? '');
    const row = makeObject({
        id,
        name: input.slips === 'twins'
            ? `twins of ${input.holderName || whose}'s ${input.houseName} ${THE_COMMUNICATION_TALISMAN.name}s`
            : `${input.houseName} ${THE_COMMUNICATION_TALISMAN.name}s`,
        kind: 'other',
        significance: howMuchAGradeIsWorthTracking(THE_COMMUNICATION_TALISMAN.grade),
        description: input.slips === 'blanks'
            ? `Blank communication talismans marked with ${input.houseName}, keyed to nobody yet.`
            : input.slips === 'twins'
                ? `The halves ${input.houseName} keeps of the slips it cut for ${input.holderName || whose}. `
                  + 'A slip burnt by them arrives here.'
                : `Communication talismans marked with ${input.houseName} and keyed to ${input.holderName || whose}. `
                  + THE_COMMUNICATION_TALISMAN.what,
        possessorId: carried,
        ownerId: carried ?? input.houseId,
        ownerName: carried === null ? input.houseName : (input.holderName ?? ''),
        tags: [A_STACK_OF_COMMUNICATION_TALISMANS, `house:${input.houseId}`],
        data: {
            markedBy: input.houseId,
            slips: input.slips,
            ...(input.slips === 'keyed' ? { keyedTo: whose } : {}),
            ...(input.slips === 'twins' ? { twinOf: whose } : {}),
            quantity: Math.max(0, Math.floor(input.quantity)),
            talismanId: THE_COMMUNICATION_TALISMAN.id,
            grade: THE_COMMUNICATION_TALISMAN.grade
        }
    });
    if (input.onDay !== undefined) {
        row.provenance.push({
            onDay: Math.floor(input.onDay),
            holderId: carried,
            holderName: carried === null ? input.houseName : (input.holderName ?? ''),
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

/** The treasury's blanks, for the treasury seeder. */
export function aHousesStockOfCommunicationTalismans(input: {
    houseId: string;
    houseName: string;
    quantity: number;
    locationId: string | null;
    onDay?: number;
}): ObjectRecord {
    return aStack({ ...input, slips: 'blanks' });
}

/**
 * Add blanks to the treasury (a null holder), or keyed halves to somebody. Makes
 * the row where there is none. Mutates `objects`. Returns how many are there now.
 */
export function addToTheStack(
    objects: ObjectRecord[],
    input: {
        houseId: string;
        houseName: string;
        /** Null for the treasury's blanks. */
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
        objects.push(aStack({
            ...input, slips: input.holderId === null ? 'blanks' : 'keyed', quantity: add
        }));
        return add;
    }
    const row = objects[at]!;
    const now = quantityOf(row) + add;
    objects[at] = { ...row, data: { ...row.data, quantity: now } };
    return now;
}

/**
 * Put twins in a house's hall for somebody's slips. Mutates `objects`. Returns
 * how many the hall keeps for them now.
 */
export function keepTheTwins(
    objects: ObjectRecord[],
    input: {
        houseId: string;
        houseName: string;
        senderId: string;
        senderName?: string;
        count: number;
        hallLocationId: string | null;
        onDay?: number;
    }
): number {
    const add = Math.max(0, Math.floor(input.count));
    const at = objects.findIndex(o => isTwins(o, input.houseId, input.senderId));
    if (at < 0) {
        if (add === 0) return 0;
        objects.push(aStack({
            slips: 'twins', houseId: input.houseId, houseName: input.houseName,
            holderId: input.senderId, holderName: input.senderName, quantity: add,
            locationId: input.hallLocationId, onDay: input.onDay
        }));
        return add;
    }
    const row = objects[at]!;
    const now = quantityOf(row) + add;
    objects[at] = { ...row, data: { ...row.data, quantity: now } };
    return now;
}

/** Take one twin of somebody's slips out of the hall. Mutates `objects`. False where there is none. */
export function takeOneTwin(objects: ObjectRecord[], houseId: string, senderId: string): boolean {
    for (let i = objects.length - 1; i >= 0; i--) {
        const row = objects[i]!;
        if (!isTwins(row, houseId, senderId) || quantityOf(row) === 0) continue;
        objects[i] = { ...row, data: { ...row.data, quantity: quantityOf(row) - 1 } };
        return true;
    }
    return false;
}

/**
 * Take up to `count` off a stack: blanks off the treasury for a null holder,
 * keyed halves off somebody. Mutates `objects`. A keyed half that reaches nothing
 * is removed; the treasury's row stays at nought, because an empty shelf is still
 * a shelf. Returns how many were taken.
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
 * Somebody's slips break: both halves of every pair bound to them, of one house
 * or of every house. Mutates `objects` in place. Returns how many slips broke.
 *
 * WHERE THEIR TOKEN AND LAMP BREAK, AND NOWHERE ELSE. The token and the lamp are
 * read off their holder's life (`theTokenStillAnswers`), so nothing writes their
 * breaking; a slip is a counted row, so something has to. It is asked where the
 * death is settled (`settleNpcDeath`, and the player's own estate), before
 * anybody goes through the body, so a looter finds nothing to take; and where
 * somebody leaving a house hands its token back ({@link handBackTheirSlips}).
 * Never a sweep over who is dead.
 *
 * NO ROW MOVES. A broken stack is left at nought, as a burnt-out one is, and
 * the word pass sweeps it (`TheStacksInHand.close`); so a caller holding indexes
 * into `objects` keeps them.
 */
export function theirSlipsBreak(
    objects: ObjectRecord[],
    personId: string,
    onlyOfHouse: string | null = null
): number {
    let broke = 0;
    for (let i = 0; i < objects.length; i++) {
        const o = objects[i]!;
        if (!isAStackOfCommunicationTalismans(o) || whatTheSlipsAre(o) === 'blanks') continue;
        if (whoseSlipsTheyAre(o) !== personId) continue;
        if (onlyOfHouse !== null && markOn(o) !== onlyOfHouse) continue;
        const n = quantityOf(o);
        if (n === 0) continue;
        broke += n;
        objects[i] = { ...o, data: { ...o.data, quantity: 0 } };
    }
    return broke;
}

/**
 * Take away the stacks of a house that has ended. Mutates `objects`. Returns how
 * many slips went.
 *
 * Its treasury's blanks are paper with nobody to cut them into pairs, and its
 * hall's twins have no hall. The people who carried its halves are off its roll
 * and broke theirs handing its token back; this is what is left.
 */
export function takeAwayWhatAnswersToNobody(
    objects: ObjectRecord[],
    standing: ReadonlySet<string>
): number {
    let gone = 0;
    let write = 0;
    for (let read = 0; read < objects.length; read++) {
        const o = objects[read]!;
        if (isAStackOfCommunicationTalismans(o)) {
            const mark = markOn(o);
            if (mark === null || !standing.has(mark)) {
                gone += quantityOf(o);
                continue;
            }
        }
        objects[write++] = o;
    }
    objects.length = write;
    return gone;
}

/**
 * Leaving a house breaks the slips it keyed to you, as its token goes back.
 * Mutates `objects` in place. Returns how many slips broke.
 *
 * The design owner: a house asks the people who leave to give its slips back,
 * and a slip is keyed to its holder, so what goes back is paper that no longer
 * answers: both halves of their pairs of that house break
 * ({@link theirSlipsBreak}). Blanks are the treasury's and never in anybody's
 * hands, so nothing unkeyed has to go back.
 *
 * `rollOf` answers the house somebody is on today, null for none, and undefined
 * for somebody the caller is not asking about, who is skipped.
 */
export function handBackTheirSlips(
    objects: ObjectRecord[],
    rollOf: (personId: string) => string | null | undefined
): number {
    const leaving: { personId: string; houseId: string }[] = [];
    for (const o of objects) {
        if (!isAStackOfCommunicationTalismans(o) || whatTheSlipsAre(o) !== 'keyed' || quantityOf(o) === 0) continue;
        const mark = markOn(o);
        const whose = whoseSlipsTheyAre(o);
        if (mark === null || whose === null || o.possessorId !== whose) continue;
        const onRoll = rollOf(whose);
        if (onRoll !== undefined && onRoll !== mark) leaving.push({ personId: whose, houseId: mark });
    }
    let broke = 0;
    for (const one of leaving) broke += theirSlipsBreak(objects, one.personId, one.houseId);
    return broke;
}

/**
 * Who reads what arrives at a house's hall: the person who received it.
 *
 * *"The messages go to people, obviously."* The Internal Affairs Elder where the
 * office has a holder standing at the seat (`theInternalAffairsElderIn`); a
 * disciple posted to the office where one is, and no such posting exists yet;
 * and otherwise the most senior of the house standing at its seat. Null where
 * nobody of the house is there to read it, and then the word sits at its twin
 * unread by anybody the world can name.
 */
export function whoReadsTheHall(
    state: Pick<WorldState, 'npcs' | 'factions' | 'locations'>,
    houseId: string
): { id: string; name: string } | null {
    const house = state.factions.find(f => f.id === houseId && f.dissolvedOnDay === null);
    const seat = house?.seatLocationId ?? null;
    if (!house || seat === null) return null;
    const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === houseId);
    const there = roll.filter(n => n.locationId === seat);
    const holderId = theInternalAffairsElderIn(
        state.locations, house, roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex }))
    );
    const holder = holderId === null ? undefined : there.find(n => n.id === holderId);
    if (holder) return { id: holder.id, name: holder.name };
    const senior = [...there].sort((a, b) => b.factionRankIndex - a.factionRankIndex
        || b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    return senior ? { id: senior.id, name: senior.name } : null;
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
    /** They carry none of this house's slips keyed to them. */
    | 'no_slip'
    /** The hall keeps no twin for the slip, so it has nowhere to arrive. */
    | 'no_twin'
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
    /**
     * Who reads it where it arrives, when the caller already knows
     * ({@link whoReadsTheHall}); asked of the world otherwise.
     */
    receivedBy?: { id: string; name: string } | null;
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
 * The word arrives: the one fact sending it writes, received by a person. Takes
 * no slip - whoever burnt it has already taken it and its twin off their stacks,
 * a world row for one of the world's people or a pouch for the player.
 */
export function theWordArrives(
    state: WorldState,
    input: Omit<SendingWord, 'howFar' | 'stacks'> & { walkingDays: number | null }
): HistoricalFact | null {
    const house = state.factions.find(f => f.id === input.houseId && f.dissolvedOnDay === null);
    const seat = house?.seatLocationId ?? null;
    if (!house || seat === null) return null;

    const site = input.aboutLocationId ?? seat;
    const reader = input.receivedBy === undefined ? whoReadsTheHall(state, house.id) : input.receivedBy;
    const actors: HistoricalActor[] = [{ id: input.senderId, name: input.senderName, role: SENT_WORD_HOME }];
    if (reader !== null && reader.id !== input.senderId) {
        actors.push({ id: reader.id, name: reader.name, role: THE_ONE_WHO_RECEIVED_IT });
    }
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
            receivedById: reader?.id ?? (to.kind === 'an_office' ? to.holderId
                : to.kind === 'a_person' ? to.id : null),
            sentFrom: input.fromLocationId,
            walkingDays: input.walkingDays
        }
    }), { bystanders: false, recur: false });
}

/** The role of whoever read word where it arrived. */
export const THE_ONE_WHO_RECEIVED_IT = 'received it';

/**
 * Burn one of somebody's slips of this house to send word to its hall.
 *
 * Refuses nothing it cannot say a number for: no slip keyed to them is a count,
 * no twin in the hall is a count, out of reach is a distance against the slip's
 * reach. Takes the slip and its twin and writes the fact, or does none of it.
 * Mutates `state.objects` and the ledger.
 */
export function burnACommunicationTalisman(state: WorldState, input: SendingWord): WordSent {
    const carrying = input.stacks
        ? input.stacks.carried(input.senderId, input.houseId)
        : howManyTheyCarry(state.objects, input.senderId, input.houseId);
    const reach = whetherWordReachesTheHouse(state, input);
    if (reach.house === null) return { sent: false, why: 'no_house', walkingDays: null, carrying };
    if (carrying === 0) return { sent: false, why: 'no_slip', walkingDays: reach.walkingDays, carrying };
    const twins = input.stacks
        ? input.stacks.twinsKept(input.houseId, input.senderId)
        : howManyTwinsTheHallKeeps(state.objects, input.houseId, input.senderId);
    if (twins === 0) return { sent: false, why: 'no_twin', walkingDays: reach.walkingDays, carrying };
    if (!reach.reaches) return { sent: false, why: 'out_of_reach', walkingDays: reach.walkingDays, carrying };

    if (input.stacks) input.stacks.burnOne(reach.house.id, input.senderId);
    else {
        takeOffTheStack(state.objects, { houseId: reach.house.id, holderId: input.senderId, count: 1 });
        takeOneTwin(state.objects, reach.house.id, input.senderId);
    }
    const fact = theWordArrives(state, { ...input, walkingDays: reach.walkingDays });
    if (fact === null) return { sent: false, why: 'no_house', walkingDays: reach.walkingDays, carrying };
    return { sent: true, fact, left: carrying - 1, walkingDays: reach.walkingDays ?? 0 };
}

/** Whether a fact is word sent on a communication talisman. */
export function isWordSentHome(fact: Pick<HistoricalFact, 'data'>): boolean {
    return fact.data.communicationTalisman === true;
}
