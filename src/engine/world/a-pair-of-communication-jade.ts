/**
 * A pair of communication jade: word from one half to the other, as often as
 * wanted.
 *
 * The catalog row is `THE_PAIRED_COMMUNICATION_JADE` in
 * `src/data/cultivation/communication-talismans.ts`. The slips beside it are
 * spent one a message and arrive at a house's hall; a pair of communication jade
 * is a private channel between two people and is not spent at all.
 *
 * ALWAYS SAY IT IN FULL. A jade TAG is the token cut with a house's name, and it
 * is not this. New prose and new symbols say *a pair of communication jade*, or
 * *a jade pair*, never bare jade; the bare names below are older than the rule.
 * See `how-a-word-reaches-somebody-who-is-not-there.md`.
 *
 * ── WHAT IT IS ───────────────────────────────────────────────────────────
 *
 *   two rows      one per half, tracked (earth grade), each keyed to its holder
 *                 and naming its twin. Either half sends to whoever holds the
 *                 other
 *   who has one   masters and elders. A master gives one half to a disciple they
 *                 value, read off the standing they hold the disciple at, and
 *                 keeps the twin ({@link mastersGiveJadeToDisciplesTheyValue})
 *   who makes it  a hand that can work earth grade (`canRefineGrade`), on the
 *                 crafting curve (`daysAtTheWork`), which is the date the pair
 *                 is dated
 *   when it stops its holder's token and lamp break ({@link theirJadeBreaks},
 *                 where the death is settled), or the jade is destroyed. Both
 *                 halves are collected then: a pair that answers to nothing is
 *                 not a thing the world keeps a row for
 *   what it is worth  the maker's time and materials, as any commission
 *                 ({@link whatAPairOfJadeIsWorth})
 */

import { THE_PAIRED_COMMUNICATION_JADE } from '../../data/cultivation/communication-talismans.js';
import { canRefineGrade } from '../cultivation/who-can-refine-a-grade-of-medicine.js';
import { isElderRank } from '../cultivation/leadership.js';
import { theInternalAffairsElderIn } from './a-house-expects-somebody-it-took-on.js';
import { daysAtTheWork, whatACommissionComesTo } from '../social-leverage/commissioning-a-craft.js';
import { makeFact, type HistoricalFact } from './history.js';
import type { NpcRecord } from './npc-state.js';
import { howMuchAGradeIsWorthTracking, makeObject, type ObjectRecord } from './possessions.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import type { WorldState } from './world-state.js';

/** The tag both halves carry. */
export const A_COMMUNICATION_JADE = 'communication-jade';

/** The role of whoever spoke into a jade. */
export const SPOKE_INTO_A_JADE = 'spoke into a jade';

/** The role of whoever holds the other half. */
export const HEARD_IT_ON_A_JADE = 'received it';

/**
 * The standing a master holds a disciple at before they give them a half.
 *
 * Above where the bond starts (`DISCIPLE_STANDING`, a half), so a master gives
 * one to a disciple they have come to value and not to everybody who knelt.
 */
export const A_DISCIPLE_THEY_VALUE = 0.6;

/** The states in which somebody's lamp still burns, so their half still answers. */
const THE_LAMP_BURNS: ReadonlySet<string> = new Set(['alive', 'missing', 'sealed']);

export interface AJadeHalf {
    id: string;
    name: string;
}

/** The two halves of a new pair, made by `maker` for `keeps` and `gives`. */
export function aPairOfCommunicationJade(input: {
    maker: { id: string; name: string; ordinal: number };
    /** Who keeps the first half. */
    keeps: { id: string; name: string };
    /** Who is given the second. */
    gives: { id: string; name: string };
    /** The day the work began; the pair is dated when the work is done. */
    onDay: number;
    locationId?: string | null;
}): [ObjectRecord, ObjectRecord] {
    const days = daysAtTheWork(THE_PAIRED_COMMUNICATION_JADE.grade, input.maker.ordinal);
    const madeOn = Math.floor(input.onDay) + days;
    const pairId = `communication-jade-${input.keeps.id}-${input.gives.id}-${madeOn}`;
    const half = (holder: { id: string; name: string }, twin: { id: string; name: string }, side: 'a' | 'b') =>
        makeObject({
            id: `${pairId}-${side}`,
            name: THE_PAIRED_COMMUNICATION_JADE.name,
            kind: 'artifact',
            significance: howMuchAGradeIsWorthTracking(THE_PAIRED_COMMUNICATION_JADE.grade),
            description: `${THE_PAIRED_COMMUNICATION_JADE.what} Its other half is ${twin.name}'s.`,
            // A made thing stands at the hand that made it.
            power: Math.max(0, Math.floor(input.maker.ordinal)),
            possessorId: holder.id,
            ownerId: holder.id,
            ownerName: holder.name,
            locationId: input.locationId ?? null,
            volume: 0.1,
            weight: 0.2,
            tags: [A_COMMUNICATION_JADE, `pair:${pairId}`],
            data: {
                pairId,
                keyedTo: holder.id,
                twinId: `${pairId}-${side === 'a' ? 'b' : 'a'}`,
                grade: THE_PAIRED_COMMUNICATION_JADE.grade,
                madeBy: input.maker.id,
                daysAtTheWork: days
            },
            provenance: [{
                onDay: madeOn,
                holderId: holder.id,
                holderName: holder.name,
                how: holder.id === input.maker.id ? 'crafted' : 'gifted',
                source: input.maker.name,
                previousHolderId: holder.id === input.maker.id ? null : input.maker.id,
                previousHolderName: holder.id === input.maker.id ? null : input.maker.name,
                factId: null,
                note: `One half of a pair; the other is ${twin.name}'s.`
            }]
        });
    return [half(input.keeps, input.gives, 'a'), half(input.gives, input.keeps, 'b')];
}

/** Whether a row is a half of a communication jade. */
export function isAJadeHalf(o: Pick<ObjectRecord, 'tags'>): boolean {
    return o.tags.includes(A_COMMUNICATION_JADE);
}

/** Whether a half is whole and keyed to whoever holds it. */
function isWhole(o: ObjectRecord): boolean {
    return isAJadeHalf(o) && o.data.broken !== true && !o.tags.includes('destroyed') && !o.tags.includes('ruined')
        && o.possessorId !== null && o.data.keyedTo === o.possessorId;
}

/**
 * The half this person holds whose twin is held by that one, both whole and
 * both holders' lamps burning. Null where they share no working pair.
 */
export function theJadeBetween(
    state: Pick<WorldState, 'objects' | 'npcs'>,
    holderId: string,
    otherId: string,
    /** The lamp of somebody the world does not hold, such as the player. */
    lampBurnsFor: (id: string) => boolean = () => true
): ObjectRecord | null {
    const lamp = (id: string) => {
        const npc = state.npcs.find(n => n.id === id);
        return npc ? THE_LAMP_BURNS.has(npc.status) : lampBurnsFor(id);
    };
    if (!lamp(holderId) || !lamp(otherId)) return null;
    // ONE PASS, AND NO MAP OF EVERY OBJECT IN THE WORLD. This is asked on the
    // ordinary road - every word sent to a person goes through it - and a world
    // holds tens of thousands of things by the time it is old. What it needs is
    // the few halves these two hold, which is almost always none or one each.
    const mine: ObjectRecord[] = [];
    const theirs: ObjectRecord[] = [];
    for (const o of state.objects) {
        if (!isWhole(o)) continue;
        if (o.possessorId === holderId) mine.push(o);
        else if (o.possessorId === otherId) theirs.push(o);
    }
    if (mine.length === 0 || theirs.length === 0) return null;
    for (const half of mine) {
        const twinId = String(half.data.twinId);
        if (theirs.some(t => t.id === twinId)) return half;
    }
    return null;
}

/** Everybody whose half answers to one this person holds. */
export function whoTheirJadeReaches(
    state: Pick<WorldState, 'objects' | 'npcs'>,
    holderId: string
): string[] {
    // The twins of what this person holds, and then who holds those: two passes
    // over the objects and one small set, rather than a map of all of them.
    const twins = new Set<string>();
    for (const o of state.objects) {
        if (!isWhole(o) || o.possessorId !== holderId) continue;
        twins.add(String(o.data.twinId));
    }
    if (twins.size === 0) return [];
    const out: string[] = [];
    for (const o of state.objects) {
        if (!twins.has(o.id) || !isWhole(o) || o.possessorId === null) continue;
        out.push(o.possessorId);
    }
    return out;
}

export type WordOnJade =
    | { sent: true; fact: HistoricalFact; half: ObjectRecord }
    | { sent: false; why: 'no_jade' };

/**
 * Speak into a jade: the word reaches whoever holds its twin, and nothing is
 * spent. Writes one fact, received by that person. Refuses where the two share
 * no working pair.
 */
export function sendWordOnJade(
    state: WorldState,
    input: {
        senderId: string;
        senderName: string;
        toId: string;
        toName: string;
        says: string;
        onDay: number;
        fromLocationId: string | null;
        lampBurnsFor?: (id: string) => boolean;
    }
): WordOnJade {
    const half = theJadeBetween(state, input.senderId, input.toId, input.lampBurnsFor);
    if (half === null) return { sent: false, why: 'no_jade' };
    const fact = appendWorldFact(state, makeFact({
        day: Math.floor(input.onDay),
        kind: 'said_in_public',
        scale: 'personal',
        visibility: 'secret',
        magnitude: 0.2,
        summary: `${input.senderName} spoke into a communication jade, and ${input.toName} heard it: ${input.says}`,
        actors: [
            { id: input.senderId, name: input.senderName, role: SPOKE_INTO_A_JADE },
            { id: input.toId, name: input.toName, role: HEARD_IT_ON_A_JADE }
        ],
        locationId: input.fromLocationId,
        factionIds: [],
        data: { communicationJade: true, pairId: half.data.pairId, receivedById: input.toId }
    }), { bystanders: false, recur: false });
    return { sent: true, fact, half };
}

/**
 * Somebody's jade breaks with their token and lamp. Mutates `objects` in place.
 * Returns how many halves broke.
 *
 * Asked where the death is settled, as the slips are (`theirSlipsBreak`).
 *
 * BOTH HALVES GO, AND THEY ARE NOT KEPT. A pair answers to nothing once either
 * end of it is gone, and a thing that answers to nothing is not a fact anybody
 * needs to keep. The design owner on the parallel case: destroy them or leave
 * them, *"honestly for simplicity"*. So the pair is collected rather than marked.
 *
 * IT WAS A LEAK, AND THE SCAN WAS THE WORSE HALF. Marked rows stayed in
 * `state.objects` for the life of the world, so the count grew with everybody
 * who had EVER held a pair rather than with everybody who holds one - and the
 * reads below walked every object in the world, so they got slower exactly as a
 * world got old, which is the case least able to afford it. A world opens
 * holding 42 pairs and the world mints more every year it runs.
 *
 * Returns how many halves were collected.
 */
export function theirJadeBreaks(objects: ObjectRecord[], personId: string, _onDay: number): number {
    const gone = new Set<string>();
    for (const o of objects) {
        if (!isAJadeHalf(o) || o.data.keyedTo !== personId) continue;
        gone.add(o.id);
        const twinId = o.data.twinId;
        if (typeof twinId === 'string') gone.add(twinId);
    }
    if (gone.size === 0) return 0;
    let collected = 0;
    for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i]!;
        if (!isAJadeHalf(o) || !gone.has(o.id)) continue;
        objects.splice(i, 1);
        collected++;
    }
    return collected;
}

/** What a pair is worth, in stone-equivalent: its maker's time and the materials. */
export function whatAPairOfJadeIsWorth(makerOrdinal: number): number | null {
    return whatACommissionComesTo(THE_PAIRED_COMMUNICATION_JADE.grade, false, makerOrdinal);
}

/** Whether a master would give this disciple a half: a hand for the grade, and a disciple they value. */
export function wouldGiveThemAHalf(
    master: Pick<NpcRecord, 'status' | 'cultivation'>,
    standingTowardTheDisciple: number,
    valuedAt: number = A_DISCIPLE_THEY_VALUE
): boolean {
    return master.status === 'alive'
        && canRefineGrade(THE_PAIRED_COMMUNICATION_JADE.grade, master.cultivation.realmOrdinal)
        && standingTowardTheDisciple >= valuedAt;
}

/**
 * Where a master takes somebody on: a master who already values them gives them
 * a half and keeps the twin. Mutates `state.objects`. True where a pair was made.
 *
 * Read off what the master held them at before the bond as well as the bond
 * itself, since a bond starts where every bond does (`DISCIPLE_STANDING`). The
 * student may be somebody the world does not hold, such as the player.
 */
export function aMasterWhoValuesThemGivesAHalf(
    state: Pick<WorldState, 'npcs' | 'objects'>,
    input: { masterId: string; student: { id: string; name: string }; heldAt: number; onDay: number }
): boolean {
    const master = state.npcs.find(n => n.id === input.masterId);
    if (!master || !wouldGiveThemAHalf(master, input.heldAt)) return false;
    if (theJadeBetween(state, master.id, input.student.id) !== null) return false;
    state.objects.push(...aPairOfCommunicationJade({
        maker: { id: master.id, name: master.name, ordinal: master.cultivation.realmOrdinal },
        keeps: { id: master.id, name: master.name },
        gives: input.student,
        onDay: input.onDay,
        locationId: master.locationId
    }));
    return true;
}

/**
 * Who makes a house's jade for its elders: the Internal Affairs Elder, and with
 * nobody holding that office the most senior of the house standing at its seat,
 * the same fallback the hall's reader takes. Null where that person cannot work
 * earth grade.
 */
export function whoMakesJadeForTheElders(
    state: Pick<WorldState, 'npcs' | 'locations'>,
    house: { id: string; ranks: readonly string[]; seatLocationId: string | null }
): NpcRecord | null {
    if (house.seatLocationId === null) return null;
    const roll = state.npcs.filter(n => n.status === 'alive' && n.factionId === house.id);
    const holderId = theInternalAffairsElderIn(state.locations, house, roll.map(n => ({ id: n.id, rankIndex: n.factionRankIndex })));
    const there = roll.filter(n => n.locationId === house.seatLocationId);
    const maker = (holderId === null ? undefined : there.find(n => n.id === holderId))
        ?? [...there].sort((a, b) => b.factionRankIndex - a.factionRankIndex
            || b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
            || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    if (!maker || !canRefineGrade(THE_PAIRED_COMMUNICATION_JADE.grade, maker.cultivation.realmOrdinal)) return null;
    return maker;
}

/**
 * The Internal Affairs Elder makes a pair for an elder of the house who has none
 * from them, and keeps the twin. Mutates `state.objects`. Returns the pairs made.
 *
 * The design owner: *"the Internal Affairs Elder makes them, or your own master
 * makes one for you. Elder-level work."* One pair a house a call, to the most
 * senior elder at the seat still without one, so the office works through its
 * elders over years rather than at once.
 */
export function theInternalAffairsElderMakesJadeForElders(
    state: Pick<WorldState, 'npcs' | 'objects' | 'locations' | 'factions'>,
    day: number
): number {
    let made = 0;
    for (const house of state.factions) {
        if (house.dissolvedOnDay !== null) continue;
        const maker = whoMakesJadeForTheElders(state, house);
        if (maker === null) continue;
        const elder = state.npcs
            .filter(n => n.status === 'alive' && n.factionId === house.id && n.id !== maker.id
                && n.locationId === house.seatLocationId
                && isElderRank(n.factionRankIndex, house.ranks.length)
                && theJadeBetween(state, n.id, maker.id) === null)
            .sort((a, b) => b.factionRankIndex - a.factionRankIndex || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
        if (!elder) continue;
        state.objects.push(...aPairOfCommunicationJade({
            maker: { id: maker.id, name: maker.name, ordinal: maker.cultivation.realmOrdinal },
            keeps: { id: maker.id, name: maker.name },
            gives: { id: elder.id, name: elder.name },
            onDay: day,
            locationId: house.seatLocationId
        }));
        made++;
    }
    return made;
}

/**
 * Masters give a half to the disciples they value and keep the twins. Mutates
 * `state.objects`. Returns how many pairs were made.
 *
 * One pair a master a call, to the disciple they hold highest who has none from
 * them, so it is sparing. `onlyElders` keeps it to masters on an elder rung,
 * which is what a world opening seeds.
 */
export function mastersGiveJadeToDisciplesTheyValue(
    state: Pick<WorldState, 'npcs' | 'objects'>,
    input: {
        day: number;
        onlyElders?: (npc: NpcRecord) => boolean;
        /** The standing they must hold a disciple at. {@link A_DISCIPLE_THEY_VALUE} unless said. */
        valuedAt?: number;
    }
): number {
    const byId = new Map(state.npcs.map(n => [n.id, n] as const));
    let made = 0;
    for (const master of state.npcs) {
        if (input.onlyElders && !input.onlyElders(master)) continue;
        const valued = master.relationships
            .filter(r => r.kind === 'disciple')
            .filter(r => wouldGiveThemAHalf(master, r.standing, input.valuedAt))
            .map(r => ({ tie: r, disciple: byId.get(r.targetId) }))
            .filter((x): x is { tie: typeof x.tie; disciple: NpcRecord } =>
                x.disciple !== undefined && x.disciple.status === 'alive'
                && theJadeBetween(state, master.id, x.disciple.id) === null)
            .sort((a, b) => b.tie.standing - a.tie.standing
                || (a.disciple.id < b.disciple.id ? -1 : a.disciple.id > b.disciple.id ? 1 : 0));
        const chosen = valued[0];
        if (!chosen) continue;
        state.objects.push(...aPairOfCommunicationJade({
            maker: { id: master.id, name: master.name, ordinal: master.cultivation.realmOrdinal },
            keeps: { id: master.id, name: master.name },
            gives: { id: chosen.disciple.id, name: chosen.disciple.name },
            onDay: input.day,
            locationId: master.locationId
        }));
        made++;
    }
    return made;
}
