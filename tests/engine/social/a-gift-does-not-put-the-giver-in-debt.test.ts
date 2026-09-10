/**
 * Handing somebody a gift put the GIVER in debt to them.
 *
 * FOUND BY PLAYING, in the social sweep, and proved by putting one gift row
 * through the read a player gets when they ask what they owe:
 *
 *     youOwe: "Owed by you to Shen Liefeng: gifted resource, and the world
 *              holds it as a small thing. I handed them a flask, asking
 *              nothing for it."
 *
 * A player hands somebody a flask asking nothing for it, and the ledger records
 * that they now owe the person they were being generous to. Every gift the
 * player made worked the wrong way, and so did every gift and every loan the
 * world made on its own for two hundred years.
 *
 * ── ONE INVERSION, WRITTEN DOWN, AND THE WRITERS DID NOT ASK ─────────────
 *
 * A FAVOUR IS OWED TO ITS HOLDER. That is the single exception on this ledger -
 * every other kind is carried BY its holder - and `whichWayItPoints` exists
 * solely to answer it, under a header whose whole subject is this mistake:
 *
 *   *One exception stated in two places is a rule nobody knows. It is stated
 *   here now, once, and both readers ask rather than remember - because the
 *   next reader of this ledger is a player asking what they are owed, and a
 *   reader that gets `favor` backwards tells them somebody owes them a thing
 *   they in fact owe.*
 *
 * The readers do ask. It was the WRITERS that remembered, and remembered
 * wrong. Three of the four rows in the engine that open a favour were authored
 * with the holder and subject the wrong way about:
 *
 *     handOver, `gifted_resource`                       -> the giver owed
 *     whatAChangeOfHandsLeaves, gifted/awarded          -> the giver owed
 *     whatAChangeOfHandsLeaves, lent                    -> the LENDER owed
 *
 * and the fourth, `aFavourForTheWork` in `commissioning-a-craft.ts`, is the
 * same act - a thing made and handed over for nothing - written correctly.
 *
 * The two wrong ones cite each other. `what-a-change-of-hands-leaves.ts` says
 * *`handOver` already says so about the counted tier; this is the same sentence
 * about the tracked one*, which is how one mistake became two. And `lent` got
 * it wrong in the same paragraph that states the rule correctly in prose:
 * *what the holder owes is the use of it*.
 *
 * ── WHY THE TESTS DID NOT CATCH IT ───────────────────────────────────────
 *
 * Because they read the id columns. `handing-somebody-a-thing.test.ts` pinned
 * the wrong direction under a comment saying it was the right one - *the
 * recipient holds it about the giver, not the other way about* - and the
 * change-of-hands test bucketed rows by `holderId` under the labels *the loser*
 * and *the receiver*. Both are the conflation `whichWayItPoints` was written to
 * end, performed by the thing meant to prevent it.
 *
 * So every assertion here goes through `whichWayItPoints`, and the one that
 * matters goes further still, through the sentence the player actually reads.
 */

import { describe, it, expect } from 'vitest';

import { whichWayItPoints, type ObligationRecord } from '../../../src/engine/social/grudges';
import {
    whatStandsBetweenYouAndEverybody
} from '../../../src/web/what-stands-between-you-and-everybody';
import { handOver, type GiveDeps } from '../../../src/web/handing-somebody-a-thing';
import { whatAChangeOfHandsLeaves } from '../../../src/engine/world/what-a-change-of-hands-leaves';
import type { Cultivator } from '../../../src/schema/cultivation';

const ME = 'me';
const THEM = 'npc-them';

const GIVER = { id: ME, name: 'Wen Shuyi', spiritStones: 40 } as unknown as Cultivator;

function giving(): GiveDeps {
    return {
        giver: GIVER,
        recipient: { id: THEM, name: 'Shen Liefeng' },
        namedRecipient: 'Shen Liefeng',
        othersHere: ['Shen Liefeng'],
        pouch: [{ itemId: 'herb-qi-grass', kind: 'herb', quantity: 2, name: 'Qi Gathering Grass' }],
        heldArts: [],
        onDay: 100
    };
}

/** One written row, from the input a writer produces. */
function asARow(input: {
    kind: ObligationRecord['kind'];
    holderId: string;
    subjectId: string | null;
    description?: string;
}): ObligationRecord {
    return {
        id: 'ob-1',
        kind: input.kind,
        holderId: input.holderId,
        subjectId: input.subjectId,
        cause: 'gifted_resource',
        severity: 'slight',
        incurredOnDay: 10,
        triggeringEventId: null,
        description: input.description ?? 'They were handed a thing, asking nothing for it.',
        participants: [input.holderId, input.subjectId ?? ''],
        tags: ['gift'],
        terms: null,
        dueOnDay: null,
        status: 'open',
        settlement: null,
        inheritance: [],
        generation: 0,
        originHolderId: input.holderId,
        fromBelief: false,
        recordedOnDay: 10
    } as ObligationRecord;
}

/** Who is on the hook for a row, asked rather than remembered. */
function whoOwes(row: Pick<ObligationRecord, 'kind' | 'holderId' | 'subjectId'>): string | null {
    const points = whichWayItPoints(row);
    return points.sense === 'owes' ? points.owerId : points.offenderId;
}

describe('a gift is owed for by the person who took it', () => {
    it('does not tell the giver they owe for what they gave away', () => {
        const out = handOver(giving(), 'the purse', undefined);
        expect(out.refused).toBe(false);
        expect(out.favour).not.toBeNull();
        expect(whoOwes(out.favour!)).toBe(THEM);
    });

    /**
     * THE SENTENCE THE PLAYER READS. The assertion above is the mechanism; this
     * is the defect, and it is the only place it was visible.
     */
    it('the ledger read does not put the gift under what you owe', () => {
        const out = handOver(giving(), 'the purse', undefined);
        const stands = whatStandsBetweenYouAndEverybody({
            rows: [asARow(out.favour!)],
            meId: ME,
            nameOf: id => (id === ME ? 'You' : 'Shen Liefeng')
        });

        expect(stands.youOwe).toHaveLength(0);
        expect(stands.owedToYou).toHaveLength(1);
        expect(stands.owedToYou[0]!.line).toContain('Owed to you by Shen Liefeng');
    });

    /**
     * AND THE WORLD'S OWN GIFTS AND LOANS, which are the same row written by a
     * different hand and were wrong in the same direction.
     */
    it.each(['gifted', 'awarded', 'lent'] as const)(
        'a thing %s leaves the account on whoever ends up holding it',
        how => {
            const rows = whatAChangeOfHandsLeaves({
                objectId: 'obj-1',
                objectName: 'a thing',
                how,
                significance: 'notable',
                onDay: 1000,
                from: { id: THEM, name: 'Shen Liefeng' },
                to: { id: ME, name: 'You' },
                knownToTheLoser: true
            });
            expect(rows).toHaveLength(1);
            expect(whoOwes(rows[0]!)).toBe(ME);
        }
    );

    /**
     * AND THE ONE THAT WAS ALREADY RIGHT STAYS RIGHT. A theft is not a favour
     * and does not invert, so a fix aimed at the favour rows must not touch it.
     */
    it('a taking still weighs on whoever took it', () => {
        const rows = whatAChangeOfHandsLeaves({
            objectId: 'obj-1',
            objectName: 'a thing',
            how: 'stolen',
            significance: 'notable',
            onDay: 1000,
            from: { id: THEM, name: 'Shen Liefeng' },
            to: { id: ME, name: 'You' },
            knownToTheLoser: true
        });
        expect(rows).toHaveLength(1);
        expect(rows[0]!.kind).toBe('grudge');
        expect(whoOwes(rows[0]!)).toBe(ME);
    });
});
