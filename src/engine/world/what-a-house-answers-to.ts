/**
 * Who a house answers to, and how two houses stand to each other.
 *
 * THE STRUCTURE WAS ALWAYS THERE AND ONE LINE THREW IT AWAY. That is the finding
 * this file exists to record, because it is not obvious from either end.
 *
 * `FACTION_PARENTAGE` in `governance-and-water-rights.ts` has carried the whole
 * relation all along: a `parentFactionId`, a `relation` including `apex`, the
 * governance model, and what each house holds. Four modules already read it.
 * Then `seeding.ts` built the world with
 *
 *     if (cf.parentFactionId) faction.standing[cf.parentFactionId] = 0.4;
 *
 * and after that line the only trace of a directed, structural fact was a warmth
 * of 0.4 on one house's scalar map. Everything downstream asked the scalar,
 * because the scalar was all that survived: the killing read, the doors, the
 * gatherings, the war code. A pass wanting to know whether one house answers to
 * another had nothing to ask.
 *
 * So nothing here is a new store and nothing is migrated. The parentage table is
 * the record; these are the two questions the engine could not put to it.
 *
 * ── AND THE WARMTH IS A CONSEQUENCE, NOT THE RECORD ──────────────────────
 *
 * Seeding may still warm a house toward the one it holds from - that is usually
 * true - but the warmth is now downstream of the relation rather than standing
 * in for it. A grant survives the two of them disliking each other, which is
 * exactly what a number between -1 and 1 could not express.
 *
 * ── WHAT THIS IS FOR, BESIDE KNOWING ─────────────────────────────────────
 *
 * The grant is the institutional road upward: a feeder school feeds, and a
 * generation's outstanding disciple is selected up along it. The rule, the
 * trigger and the detail that makes it land are in
 * `docs/world/houses/patronage.md` and are not restated here.
 *
 * IT IS ONE ROAD. The design owner: *"its ONE road a person may climb."* A
 * master noticing somebody, walking out and joining a stronger house, being
 * taken in as an elder from outside, founding your own, or simply climbing where
 * you stand are all built and all live elsewhere. A house with no grant loses
 * the road, not the ceiling.
 *
 * And a road is not a conveyor: holding a grant means somebody MAY be called up,
 * never that anybody is.
 */

import { FACTION_PARENTAGE } from '../../data/cultivation/governance-and-water-rights.js';
import type { FactionRecord } from './world-state.js';

/**
 * How warmly a house starts out toward the one it holds from.
 *
 * A FLAT NUMBER FOR EVERY PARENT IS THE BUG IN MINIATURE. Seeding gave every
 * subsidiary in the world `0.4` toward its parent, which says every house feels
 * identically about the house above it - in a world containing both the Azure
 * hill, where the design owner puts the relationship at *"the best relationship
 * possible"*, and a house that refused a grant and was never forgiven. Warmth
 * varying by house is what the scalar is FOR and it had never once been used
 * for it.
 *
 * Read off the terms the catalog already states rather than invented: a
 * subsidiary that pays no tribute and carries no levy is inside the parent's own
 * arrangement - the Azure case, where the terms *"have never been written down
 * because both parties are the same institution"* - and one that pays is at
 * arm's length, however correct the relation.
 *
 * NULL IS NOT NOUGHT, and this cost a broken test to learn. The first version
 * returned 0 where the table was silent, and a zero is indistinguishable from
 * *these two have no relation* at all 38 sites that read the scalar. Two houses
 * the old unconditional line warmed - the Pavilion toward the Third Sluice among
 * them - silently lost their standing entirely. So: null where nothing is known,
 * and the caller decides what to do about it. That is the same class of defect
 * as the flat 0.4 itself: a number that cannot say *I do not know*.
 *
 * AND THE TWO SOURCES DISAGREE ABOUT THE PAVILION, which is a catalog finding
 * rather than a bug here. The sect catalog gives `sect-azure-cloud-pavilion` a
 * parent of `court-third-sill`; `FACTION_PARENTAGE` calls it an apex holding on
 * no grant from anyone, and its own prose says why - it *"was a Third Sluice
 * tenant for fifteen hundred years and stopped being one in the year Ru Anjing
 * crossed."* One field is current and one is historical, and nothing says which.
 * The caller's field is treated as authoritative here because it is what built
 * the world before this file existed.
 *
 * UNMEASURED. What to read afterwards: whether warm parents stay warm over a
 * long run, or whether the ordinary passes wear every relation down to the same
 * number anyway, which would mean the seeding value never mattered.
 */
export function howWarmlyTheyStartTowardTheirParent(houseId: string): number | null {
    const row = FACTION_PARENTAGE[houseId];
    if (row === undefined || row.parentFactionId === null) return null;
    const tribute = row.terms?.tributeStonesPerYear ?? 0;
    const levied = row.levy !== null && row.levy !== undefined;
    return tribute === 0 && !levied ? INSIDE_THE_SAME_ARRANGEMENT : AT_ARMS_LENGTH;
}

/** A subsidiary inside the parent's own arrangement: the warmest a grant runs. */
export const INSIDE_THE_SAME_ARRANGEMENT = 0.8;

/** And one that pays for what it holds, which is correct rather than close. */
export const AT_ARMS_LENGTH = 0.4;

/** Every house that answers to this one, directly. */
export function whoAnswersTo(houseId: string): string[] {
    const out: string[] = [];
    for (const row of Object.values(FACTION_PARENTAGE)) {
        if (row.parentFactionId === houseId) out.push(row.factionId);
    }
    return out.sort();
}

/**
 * How warmly two houses stand to each other, as one answer.
 *
 * Standing is two half-edges - each house keeps its own map - so the two can
 * disagree. The answer is the colder of the two, because a relation is only as
 * warm as the wariest end of it. A half nobody wrote is not a zero: reading a
 * silent half as 0 once made a feeder school and its patron neutral houses.
 * Seeding now writes both halves; a pass that moves only one still leaves the
 * other silent.
 */
export function standingBetweenRows(
    a: Pick<FactionRecord, 'id' | 'standing'> | null,
    b: Pick<FactionRecord, 'id' | 'standing'> | null
): number {
    return colderOf(a, b, a?.id ?? '', b?.id ?? '');
}

function colderOf(
    a: Pick<FactionRecord, 'standing'> | null,
    b: Pick<FactionRecord, 'standing'> | null,
    aId: string,
    bId: string
): number {
    const oneWay = a?.standing[bId];
    const orTheOther = b?.standing[aId];
    if (oneWay === undefined && orTheOther === undefined) return 0;
    if (oneWay === undefined) return orTheOther ?? 0;
    if (orTheOther === undefined) return oneWay;
    return Math.min(oneWay, orTheOther);
}
