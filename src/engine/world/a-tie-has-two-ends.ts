/**
 * A TIE HAS TWO ENDS.
 *
 * The design owner's standing rule: every relationship is bidirectional. A row
 * one person holds about another is half of something, and the other person
 * holds the other half, even where the two halves disagree about what it is
 * worth. Measured before this file on one pinned world: 154 of 978 ties at
 * world open had nobody at the other end, and 2,919 of 18,561 after forty years.
 *
 * WHAT THE OTHER END IS. A tie that is a structure has a named other half:
 * a parent's `child` row is answered by the child's `parent` row, a `master` by a
 * `disciple`, a `patron` by a `client`, a `creditor` by a `debtor`. A spouse, kin,
 * an ally, a rival, an enemy and an acquaintance are the same word from both
 * sides. {@link THE_OTHER_END} is the whole of that.
 *
 * WHAT THIS WRITES, AND WHAT IT LEAVES. The other half is written where it is
 * missing. Where the other person already holds a row, their standing and their
 * words are theirs and stay: a feeling is answered by the structure the tie now
 * is, a structure they already hold is never turned into another, and nothing
 * they feel is overwritten by somebody else's feeling.
 *
 * AND THE STANDING IS NOT COPIED ACROSS BY DEFAULT. How a killer stands toward
 * the person they killed is not how the dead stand toward the killer. A
 * structure is answered at the same standing (a parent and a child, a master and
 * a disciple); anything else is answered at nothing, in the word for nothing,
 * unless the writer says what the other side holds.
 */

import {
    isATemperature,
    relationshipWith,
    upsertRelationship,
    whatStandsBetween,
    type NpcRecord,
    type RelationshipInput,
    type RelationshipKind
} from './npc-state.js';
import { kindFor } from './gatherings.js';

/** The other half of each kind of tie. */
export const THE_OTHER_END: Readonly<Record<RelationshipKind, RelationshipKind>> = Object.freeze({
    kin: 'kin',
    spouse: 'spouse',
    parent: 'child',
    child: 'parent',
    master: 'disciple',
    disciple: 'master',
    // Being taught is not being taken on. See `RelationshipKind`.
    teacher: 'student',
    student: 'teacher',
    former_master: 'former_disciple',
    former_disciple: 'former_master',
    ally: 'ally',
    rival: 'rival',
    enemy: 'enemy',
    patron: 'client',
    client: 'patron',
    creditor: 'debtor',
    debtor: 'creditor',
    acquaintance: 'acquaintance'
});

/**
 * Whether a kind is a structure whose other half is named, rather than a feeling
 * the other side has their own of: every kind that is answered by a different
 * word, and the two that are the same word because both halves are one household.
 */
export function isAStructure(kind: RelationshipKind): boolean {
    return THE_OTHER_END[kind] !== kind || kind === 'kin' || kind === 'spouse';
}

/** What the other side holds, where the writer knows. */
export interface TheOtherHalf {
    standing?: number;
    note?: string;
    kind?: RelationshipKind;
}

/**
 * Write the other half of a tie somebody now holds, onto the person it is about.
 *
 * `holder` is who holds the tie just written and `tie` is what they hold. A
 * target the roster does not hold is nobody to write onto.
 */
export function andTheOtherEnd(
    npcs: NpcRecord[],
    holder: Pick<NpcRecord, 'id' | 'name'>,
    tie: Pick<RelationshipInput, 'targetId' | 'kind' | 'standing' | 'factIds'>,
    onDay: number,
    half: TheOtherHalf = {}
): void {
    const at = npcs.findIndex(row => row.id === tie.targetId);
    if (at < 0 || tie.targetId === holder.id) return;
    const other = npcs[at]!;
    const structural = isAStructure(tie.kind);

    // THE MATCHING KIND, AND ONLY IT. Rows are keyed by the pair and the kind
    // (`whatStandsBetween`), so the other half of a master tie is their
    // `disciple` row and nothing else they hold about this person is in the way:
    // a wife who is also a fellow disciple keeps both, and neither half is
    // written over the other.
    if (structural || half.kind !== undefined) {
        const kind = half.kind ?? THE_OTHER_END[tie.kind];
        const held = relationshipWith(other, holder.id, kind);
        if (held !== null && half.standing === undefined && half.note === undefined) return;
        npcs[at] = upsertRelationship(other, {
            targetId: holder.id,
            targetName: holder.name,
            kind,
            standing: half.standing ?? held?.standing ?? tie.standing,
            note: half.note ?? held?.note ?? '',
            factIds: tie.factIds ?? []
        }, onDay);
        return;
    }

    // A FEELING IS ANSWERED BY WHATEVER THEY ALREADY FEEL, or by nothing said in
    // the word for nothing. How a killer stands toward the person they killed is
    // not how the dead stand toward the killer.
    const feeling = whatStandsBetween(other, holder.id).find(row => !isAStructure(row.kind));
    if (feeling !== null && feeling !== undefined) {
        if (half.standing === undefined && half.note === undefined) return;
        npcs[at] = upsertRelationship(other, {
            targetId: holder.id,
            targetName: holder.name,
            kind: feeling.kind,
            standing: half.standing ?? feeling.standing,
            note: half.note ?? feeling.note,
            factIds: tie.factIds ?? []
        }, onDay);
        return;
    }

    const standing = half.standing ?? 0;
    npcs[at] = upsertRelationship(other, {
        targetId: holder.id,
        targetName: holder.name,
        kind: kindFor(standing),
        standing,
        note: half.note ?? '',
        factIds: tie.factIds ?? []
    }, onDay);
}

/**
 * A tie somebody no longer holds is gone from the other end too.
 *
 * The one place a world takes a tie away rather than rewriting it is a crossing's
 * toll, which severs a bond. The player's side of the same toll has always ended
 * it at the OTHER person (`severBond`: the person who knew them stops knowing
 * them), so a severed bond has no end left on either side. `before` and `after`
 * are the same person on either side of the change.
 */
export function andLetGoAtTheOtherEnd(
    npcs: NpcRecord[],
    before: Pick<NpcRecord, 'id' | 'relationships'>,
    after: Pick<NpcRecord, 'relationships'>
): void {
    // Per pair AND kind, because rows are keyed that way: letting go of a
    // `disciple` row does not let go of the marriage standing beside it. The
    // four temperatures count as one key here, because they are one row that
    // moves (`isATemperature`): somebody whose `ally` row cooled to `enemy` has
    // not let anything go, and deleting the far `ally` row would be a lie.
    const key = (tie: { targetId: string; kind: RelationshipKind }): string =>
        `${tie.targetId}|${isATemperature(tie.kind) ? 'feeling' : tie.kind}`;
    const kept = new Set(after.relationships.map(key));
    for (const tie of before.relationships) {
        if (kept.has(key(tie))) continue;
        const at = npcs.findIndex(row => row.id === tie.targetId);
        if (at < 0) continue;
        const other = npcs[at]!;
        const answer = THE_OTHER_END[tie.kind];
        const answers = (back: { targetId: string; kind: RelationshipKind }): boolean =>
            back.targetId === before.id
            && (back.kind === answer || (isATemperature(tie.kind) && isATemperature(back.kind)));
        if (!other.relationships.some(answers)) continue;
        npcs[at] = {
            ...other,
            relationships: other.relationships.filter(back => !answers(back))
        };
    }
}

