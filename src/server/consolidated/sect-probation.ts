/**
 * The far end of a published door: reading a probation, and applying what the
 * house decided.
 *
 * `sect-guest.ts` owns the roll - who is sitting in, since when, and what they
 * are shown. This file owns the day the house stops watching. The engine half
 * is `engine/encounters/where-a-probation-ends-and-who-is-placed-where.ts`,
 * which is pure and decides nothing about the database; everything here is the
 * write.
 *
 * ── WHY A DECIDED JUDGEMENT APPLIES ON A READ ────────────────────────────
 *
 * Normally a read that writes is a defect. This one is not, and the reason is
 * whose act it is. The Pavilion "takes them, scores them, and places them" -
 * the scoring happens on the house's clock, not on the player's turn, and by
 * the time somebody walks back up the terraces to ask, the decision has
 * already been made about them. There is nothing here for a player to accept
 * or decline, and offering them the choice would be inventing a negotiation
 * the catalog is explicit there is not one of.
 *
 * So: while the judgement reads `carried` nothing is written and the terms
 * come back as they always did. The first call after it stops reading
 * `carried` applies it, once, and the roll is cleared - which makes every
 * later call take a different branch, so it is idempotent by construction.
 *
 * ── AND IT IS REACHED FROM TWO PLACES ON PURPOSE ─────────────────────────
 *
 * `sect_manage({ action: 'guest' })` is somebody presenting themselves. But a
 * probationer who never uses that verb again would otherwise sit in a decided
 * probation forever, so `standing` - "where do I stand", which is the sentence
 * a person in that position actually types - reads it too. Before this, a
 * probationer asking `standing` got "Unaffiliated. No stipend, no array, no
 * elder, and nobody to notice if this run ends badly", which is true, and
 * omits that they are in year thirty of an apex's intake.
 */

import { rankName } from '../../engine/cultivation/realms.js';
import {
    judgeProbation,
    recallFrom,
    placementLadderFrom,
    spansAlong,
    type ProbationJudgement
} from '../../engine/encounters/where-a-probation-ends-and-who-is-placed-where.js';
import { publishedDoorOf } from '../../engine/encounters/what-a-house-will-teach-somebody-it-has-not-taken.js';
import { getSect } from '../../data/cultivation/sects.js';
import type { Cultivator, Run } from '../../schema/cultivation.js';
import { guestPlaceHeldBy, FLAG_GUEST_STUDENT_OF } from './sect-guest.js';
import { entryRankIndexFor } from '../../engine/cultivation/what-each-rung-of-a-house-ladder-requires.js';
import {
    FLAG_STIPEND_PAID_DAY,
    clearFlag,
    writeFlag,
    type CultivationRepos
} from './cultivation-support.js';

const DAYS_IN_A_YEAR = 365;

/**
 * Where this cultivator stands in a probation, or null when they are not in
 * one. Pure: reads the roll and the catalogs and writes nothing.
 *
 * Null for a guest of a house that does not publish a door, because an
 * ordinary guest place has no far end of this kind - it ends when the guest
 * walks out, or when the house offers membership, and neither is a sort.
 */
export function probationOf(
    repos: CultivationRepos,
    cultivator: Pick<Cultivator, 'id' | 'realmOrdinal' | 'age'>,
    run: Pick<Run, 'elapsedDays'>
): ProbationJudgement | null {
    const roll = guestPlaceHeldBy(repos.db, cultivator.id);
    if (!roll) return null;
    if (publishedDoorOf(roll.hostFactionId) === null) return null;
    const today = Math.floor(run.elapsedDays);
    return judgeProbation({
        hostFactionId: roll.hostFactionId,
        ordinal: cultivator.realmOrdinal,
        age: cultivator.age,
        yearsOnTheRoll: Math.max(0, today - roll.sinceDay) / DAYS_IN_A_YEAR
    });
}

/** What the placement is, said the way the world says it. */
function narrate(judgement: ProbationJudgement, name: string): string {
    switch (judgement.outcome) {
        case 'placed':
            return judgement.depth === 0
                ? `${name} is kept at the terraces. The score was read out, nobody softened it, `
                  + 'and the placement is the answer.'
                : `${name} is placed at ${judgement.factionName}. Being sent down is not a `
                  + 'disgrace and the gorge has not read it as one for four hundred years: the '
                  + 'alternative at every other house in the province is the gate, with no '
                  + 'record that you were ever there.';
        case 'kept':
            return `${name} does not cross, and is kept on. Not a disciple - the bar behind the `
                + 'door has not moved and is not going to - but the house has spent long '
                + 'enough on them to have a use for them.';
        case 'turned_out':
            return `${name} is turned out. Nobody is unkind about it and nobody explains. The `
                + 'only true sentence left to them afterwards is that they were tested by the '
                + 'Pavilion, which is a boast and an admission of failure in the same breath.';
        case 'carried':
            return `${name} is still being carried. Nothing has been decided and the house is `
                + 'not in a hurry.';
    }
}

export interface AppliedProbation {
    probationEnded: true;
    outcome: ProbationJudgement['outcome'];
    band: ProbationJudgement['band'];
    hostFactionId: string;
    placedAtFactionId: string | null;
    placedAtName: string | null;
    rankIndex: number | null;
    rankTitle: string | null;
    yearsOnTheRoll: number;
    ageAtIntake: number;
    ageNow: number;
    /** The age the terraces would have stopped at for this person. */
    apexAgeCeiling: number | null;
    standingAt: string;
    reason: string;
    narrationHint: string;
}

/**
 * Write what the house decided, and clear the roll.
 *
 * Called only where {@link probationOf} has already returned something other
 * than `carried`. Returns null otherwise so a caller can fall through without
 * a second check.
 */
export function applyProbation(
    repos: CultivationRepos,
    cultivator: Cultivator,
    run: Run,
    judgement: ProbationJudgement
): AppliedProbation | null {
    if (judgement.outcome === 'carried') return null;
    const roll = guestPlaceHeldBy(repos.db, cultivator.id);
    if (!roll) return null;

    let placedAt: string | null = null;
    let rankIndex: number | null = null;
    let rankTitle: string | null = null;

    repos.db.transaction(() => {
        if (judgement.outcome === 'placed' && judgement.factionId) {
            const target = getSect(judgement.factionId);
            // Seated by the same rule a walk-up is seated by, because what
            // somebody is seated by is what they visibly are, and a placement
            // that used its own arithmetic would drift from `handleJoin`.
            rankIndex = target
                ? entryRankIndexFor(
                    target.ranks, target.admissionOrdinal, cultivator.realmOrdinal
                )
                : 0;
            placedAt = judgement.factionId;
        } else if (judgement.outcome === 'kept') {
            // HARD ZERO, and not the entry rule. Somebody kept on did not
            // cross, and seating them by what they visibly are would promote a
            // washout for having got some of the way. Rank 0 is the menial and
            // probationary tier that `FIRST_RANK_THE_BAR_GOVERNS` in
            // `members.ts` already exempts from the admission bar - which is
            // exactly where `member-yan-shuling` stands, Sword Servant at
            // ordinal 5, and that row is what this branch produces.
            rankIndex = 0;
            placedAt = roll.hostFactionId;
        }

        if (placedAt !== null && rankIndex !== null) {
            const membership = repos.sects.addMember(placedAt, cultivator.id, rankIndex);
            rankTitle = membership?.rankTitle
                ?? getSect(placedAt)?.ranks[rankIndex]
                ?? null;
            // A new member is not owed backdated wages for the years they spent
            // on the roll drawing nothing, which is the same rule `handleJoin`
            // applies and for the same reason.
            writeFlag(repos.db, cultivator.id, FLAG_STIPEND_PAID_DAY, String(run.elapsedDays));
        }
        // The roll ends either way. Placed, kept or turned out, nobody is a
        // probationer afterwards.
        clearFlag(repos.db, cultivator.id, FLAG_GUEST_STUDENT_OF);
    })();

    return {
        probationEnded: true,
        outcome: judgement.outcome,
        band: judgement.band,
        hostFactionId: roll.hostFactionId,
        placedAtFactionId: placedAt,
        placedAtName: placedAt === null ? null : getSect(placedAt)?.name ?? placedAt,
        rankIndex,
        rankTitle,
        yearsOnTheRoll: Math.round(judgement.yearsOnTheRoll * 10) / 10,
        ageAtIntake: Math.round(judgement.ageAtIntake * 10) / 10,
        ageNow: Math.round(judgement.ageNow * 10) / 10,
        apexAgeCeiling: judgement.apexAgeCeiling === null
            ? null
            : Math.round(judgement.apexAgeCeiling * 10) / 10,
        standingAt: rankName(cultivator.realmOrdinal),
        reason: judgement.reason,
        narrationHint: narrate(judgement, cultivator.name)
    };
}

/**
 * What a probationer is told while they are still being carried, so that the
 * arrangement is legible from the inside rather than being a silence with a
 * verdict at the end of it.
 */
export function carriedProbationFacts(judgement: ProbationJudgement): Record<string, unknown> {
    const ladder = placementLadderFrom(judgement.factionId ?? '');
    const spans = spansAlong(ladder);
    return {
        onTheRollFor: Math.round(judgement.yearsOnTheRoll * 10) / 10,
        takenAtAge: Math.round(judgement.ageAtIntake * 10) / 10,
        ageNow: Math.round(judgement.ageNow * 10) / 10,
        yearsLeftBeforeTheHouseDecides: Math.round(judgement.yearsLeftToCross * 10) / 10,
        // Said out loud rather than sprung. Every one of these is a fact about
        // where the person would be put, and a probation whose terms are a
        // secret is a worse thing than the one the catalog describes.
        wherePlacementLeadsTo: ladder.map((id, depth) => ({
            factionId: id,
            factionName: getSect(id)?.name ?? id,
            band: depth === 0 ? 'exceptional' : depth === 1 ? 'promising' : 'unformed',
            crossWithinYears: spans[depth],
            byAge: spans[depth] === null
                ? null
                : Math.round((judgement.ageAtIntake + (spans[depth] as number)) * 10) / 10
        })),
        reason: judgement.reason
    };
}

/**
 * Whether somebody placed down the chain has outrun the house holding them.
 *
 * The recall roll, which the Mist keeps and everybody at the Mist can quote
 * the current number of. Read off the shelf: a house sends somebody up the
 * moment there is nothing left it can teach them.
 */
export function recallDueFor(
    repos: CultivationRepos,
    cultivator: Pick<Cultivator, 'id' | 'realmOrdinal'>
): { toFactionId: string; toFactionName: string; pastTheShelfAt: number } | null {
    const membership = repos.sects.getMembership(cultivator.id);
    if (!membership) return null;
    return recallFrom(membership.sectId, cultivator.realmOrdinal);
}
