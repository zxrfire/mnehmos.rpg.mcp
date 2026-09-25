/**
 * A child somebody's act conceived, carried to term and counted by the world.
 *
 * Every other child in this world comes from `applyDemography`, which draws a
 * parent and brings the child into the count at sixteen to twenty-two, born
 * that many years earlier. Nothing took a conception from outside that draw, so
 * the furnace rite rolled `conceived` and the roll went nowhere. This file is
 * the ONE entry point for a conception an act caused, and it hands the child to
 * the same demography pass every other child comes through - it makes nobody
 * itself.
 *
 * Three stages, each a date:
 *
 *   conceived     `aChildIsConceived` writes a tag on the carrier's row naming
 *                 both parents and the due day. The carrier's row, because a
 *                 carrier who dies before the due day takes the pregnancy with
 *                 them, and a mortal who dies is dropped from the world with
 *                 everything on the row.
 *   born          the first demography pass on or after the due day. If the
 *                 carrier was alive on the due day, a `birth` fact names both
 *                 parents, and both parents' rows carry the birth forward.
 *   counted       the first demography pass on or after the child's
 *                 {@link THE_AGE_A_CHILD_IS_COUNTED_AT}th year. The demography
 *                 loop makes the row, exactly as it makes every other one, with
 *                 the carrier as the parent it draws and both parents'
 *                 lineage edges written.
 *
 * WHY SIXTEEN AND NOT THE DUE DAY. The world holds nobody younger than the age
 * its births arrive at, and its passes are written for that: recruitment takes
 * anybody unaffiliated at the admission rung, somebody on no roll moves on to a
 * road or a ruin, a war fields whoever is standing there. An infant row would
 * be enrolled and sent walking. So the child is born on the due day - the fact
 * and the lineage date say so - and is counted when every other child is.
 *
 * Tags and not a scheduled effect: `advanceTime` writes a chronicle row for
 * every effect that lands, on its day, whether or not the carrier is still
 * alive, and the landing is not kept on the effect afterwards.
 */

import { bloodlineForChild } from './hunting-a-spirit-beast.js';
import { makeFact } from './history.js';
import { addLineageEdge, createLineageRecord, lineageIdOf } from './lineage.js';
import type { NpcRecord } from './npc-state.js';
import { appendWorldFact } from './who-was-there-when-it-happened.js';
import { indexById, type WorldState } from './world-state.js';

const DAYS_PER_YEAR = 365;

/** Days from conception to the due day. One number, here. */
export const DAYS_A_CHILD_IS_CARRIED = 270;

/**
 * The age at which a child an act conceived enters the world's count: the
 * youngest age `applyDemography` brings anybody in at (it draws 16 to 22).
 */
export const THE_AGE_A_CHILD_IS_COUNTED_AT = 16;

/** On the carrier's row between the conception and the due day. */
const A_CHILD_DUE = 'a-child-due:';
/** On both parents' rows between the birth and the day the child is counted. */
const A_CHILD_BORN = 'a-child-born:';

/** One child the demography pass owes the world this year. */
export interface AChildOwed {
    carrierId: string;
    otherParentId: string;
    bornOnDay: number;
}

interface Carried {
    carrierId: string;
    otherParentId: string;
    day: number;
}

function payload(c: Carried): string {
    return `${c.carrierId}|${c.otherParentId}|${c.day}`;
}

function parse(tag: string, prefix: string): Carried | null {
    if (!tag.startsWith(prefix)) return null;
    const [carrierId, otherParentId, day] = tag.slice(prefix.length).split('|');
    const n = Number(day);
    if (!carrierId || !otherParentId || !Number.isFinite(n)) return null;
    return { carrierId, otherParentId, day: n };
}

function rowOf(state: WorldState, id: string): NpcRecord | null {
    const at = indexById(state.npcs, id);
    return at >= 0 ? state.npcs[at]! : null;
}

function tagRow(state: WorldState, id: string, tag: string): boolean {
    const at = indexById(state.npcs, id);
    if (at < 0) return false;
    const row = state.npcs[at]!;
    if (!row.tags.includes(tag)) state.npcs[at] = { ...row, tags: [...row.tags, tag] };
    return true;
}

/**
 * THE ENTRY POINT. A conception an act caused, handed to the world.
 *
 * Written on the carrier's row, or on the other parent's where the world holds
 * no row for the carrier. Returns false where it holds neither, and then there
 * is nowhere for the child to come from.
 */
export function aChildIsConceived(
    state: WorldState,
    input: { carrierId: string; otherParentId: string; dueOnDay: number }
): boolean {
    const tag = A_CHILD_DUE + payload({
        carrierId: input.carrierId,
        otherParentId: input.otherParentId,
        day: Math.floor(input.dueOnDay)
    });
    return tagRow(state, input.carrierId, tag) || tagRow(state, input.otherParentId, tag);
}

/**
 * Whether the carrier was alive on the due day. A carrier the world holds no
 * row for is not one it can say died.
 */
function carriedToTerm(state: WorldState, carrierId: string, dueOnDay: number): boolean {
    const carrier = rowOf(state, carrierId);
    if (!carrier) return true;
    if (carrier.status !== 'physically_dead') return true;
    return carrier.diedOnDay !== null && carrier.diedOnDay >= dueOnDay;
}

/**
 * The year's work, for `applyDemography`: births that have come due, and the
 * children of earlier ones who are now old enough to be counted.
 *
 * Mutates `state` in place, as every pass in this layer does. Returns the
 * children the demography loop makes this year, in roster order.
 */
export function theChildrenAnActConceived(state: WorldState, day: number): AChildOwed[] {
    // ── BORN: THE DUE DAY HAS COME ───────────────────────────────────────
    const due: { at: number; tag: string; carried: Carried }[] = [];
    for (let at = 0; at < state.npcs.length; at++) {
        for (const tag of state.npcs[at]!.tags) {
            const carried = parse(tag, A_CHILD_DUE);
            if (carried && carried.day <= day) due.push({ at, tag, carried });
        }
    }
    for (const { at, tag, carried } of due) {
        const row = state.npcs[at]!;
        state.npcs[at] = { ...row, tags: row.tags.filter(t => t !== tag) };
        if (!carriedToTerm(state, carried.carrierId, carried.day)) continue;

        const carrier = rowOf(state, carried.carrierId);
        const other = rowOf(state, carried.otherParentId);
        appendWorldFact(state, makeFact({
            day: carried.day,
            kind: 'birth',
            scale: 'personal',
            summary: `A child was born to ${carrier?.name ?? carried.carrierId} and `
                + `${other?.name ?? carried.otherParentId}.`,
            actors: [
                { id: carried.carrierId, name: carrier?.name ?? carried.carrierId, role: 'bore the child' },
                { id: carried.otherParentId, name: other?.name ?? carried.otherParentId, role: 'parent' }
            ],
            locationId: carrier?.locationId ?? null,
            factionIds: carrier?.factionId ? [carrier.factionId] : [],
            visibility: 'faction',
            magnitude: 0.2,
            causeKnown: true
            // Two births to the same two people are two children.
        }), { recur: false });

        const born = A_CHILD_BORN + payload(carried);
        tagRow(state, carried.carrierId, born);
        tagRow(state, carried.otherParentId, born);
    }

    // ── COUNTED: OLD ENOUGH FOR THE WORLD TO HOLD THEM ───────────────────
    const owed = new Map<string, AChildOwed>();
    for (let at = 0; at < state.npcs.length; at++) {
        const row = state.npcs[at]!;
        let kept: string[] | null = null;
        for (const tag of row.tags) {
            const born = parse(tag, A_CHILD_BORN);
            if (!born || born.day + THE_AGE_A_CHILD_IS_COUNTED_AT * DAYS_PER_YEAR > day) continue;
            kept ??= row.tags.slice();
            kept.splice(kept.indexOf(tag), 1);
            if (!owed.has(tag)) {
                owed.set(tag, {
                    carrierId: born.carrierId,
                    otherParentId: born.otherParentId,
                    bornOnDay: born.day
                });
            }
        }
        if (kept) state.npcs[at] = { ...row, tags: kept };
    }
    return [...owed.values()];
}

/**
 * Who a child an act conceived is raised by: the carrier, or the other parent
 * where the world no longer holds the carrier's row. The parent the demography
 * loop would otherwise have drawn.
 */
export function whoRaisesThem(state: WorldState, owed: AChildOwed): NpcRecord | null {
    return rowOf(state, owed.carrierId) ?? rowOf(state, owed.otherParentId);
}

/**
 * The blood parent the household path did not write: their lineage edge, and a
 * bloodline read off both parents rather than off the carrier's spouse.
 *
 * Writes `state.lineages` in place and returns the child's record, which the
 * caller has not pushed yet. A parent the world holds no row for gets no edge -
 * a line is founded by somebody with a name on a row.
 */
export function theOtherBloodParent(
    state: WorldState,
    child: NpcRecord,
    owed: AChildOwed,
    raisedBy: NpcRecord | null
): NpcRecord {
    const carrier = rowOf(state, owed.carrierId);
    const other = rowOf(state, owed.otherParentId);
    const notYetWritten = raisedBy?.id === owed.carrierId ? other : carrier;
    if (!notYetWritten || notYetWritten.id === raisedBy?.id) return child;

    const surname = notYetWritten.name.split(' ')[0]!;
    let line = state.lineages.find(l => l.memberIds.includes(notYetWritten.id));
    if (!line) {
        line = createLineageRecord({
            id: lineageIdOf(surname, notYetWritten.id),
            surname,
            founderId: notYetWritten.id,
            foundedOnDay: notYetWritten.identity.bornOnDay
        });
        state.lineages.push(line);
    }
    const lineId = line.id;
    const at = state.lineages.findIndex(l => l.id === lineId);
    state.lineages[at] = addLineageEdge(line, {
        parentId: notYetWritten.id,
        childId: child.id,
        relation: 'descendant',
        onDay: child.identity.bornOnDay
    });

    const blood = bloodlineForChild(
        carrier?.identity.bloodline ?? null,
        other?.identity.bloodline ?? null
    );
    return blood === child.identity.bloodline
        ? child
        : { ...child, identity: { ...child.identity, bloodline: blood } };
}
