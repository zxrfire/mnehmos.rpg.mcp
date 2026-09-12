/**
 * The finite-use rule, reached by playing.
 *
 * `a-heaven-grade-manual-runs-out.test.ts` pins the rule; this is its sibling,
 * and it exists because a rule the world obeys and the player does not is the
 * defect `AGENTS.md` names first. The whole of the rule reaching a player is
 * one sentence - "I learn <the book>" - so that is what is played here.
 *
 * WHAT IS ARRANGED AND WHAT IS PLAYED. The book is put into the player's hand
 * directly, because the honest route to holding a house's manual is already
 * proved by `taking-from-your-own-house.test.ts` - it takes the row off the
 * shelf, moves possession, leaves ownership, and writes the `stolen` link -
 * and playing forty turns to reach a shelf that happens to carry a heaven-grade
 * book is the fixture that goes flaky. The rung, the root and the roll are
 * arranged for the same reason. The ACT is played and nothing about it is
 * arranged.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { SECTS, TECHNIQUES } from '../../src/data/cultivation/index';
import { makeObject, isRuined, type ObjectRecord } from '../../src/engine/world/possessions';
import { usesSpentOn } from '../../src/engine/world/what-a-manual-has-left-in-it';

interface WorldAtHand { objects: ObjectRecord[] }

/** A heaven-grade manual somebody in this world actually teaches. */
const BOOK = TECHNIQUES
    .filter(t => t.category === 'cultivation' && t.grade === 'heaven' && t.element !== null)
    .map(t => ({ t, house: SECTS.find(s => s.teaches.includes(t.id)) }))
    .find(row => row.house !== undefined)!;

async function holdingIt(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: `${seed}-w` }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db
        .prepare('UPDATE cultivators SET realm_ordinal = ?, spirit_root = ? WHERE id = ?')
        .run(BOOK.t.requiredOrdinal, `single_${BOOK.t.element}`, cultivator.id);
    harness.repos.sects.addMember(BOOK.house!.id, cultivator.id, 0);

    // One turn, so the world is loaded and the book can be put in the hand.
    await harness.game.act('I look around');
    const world = (harness.game as { atHand: WorldAtHand }).atHand;
    world.objects.push(makeObject({
        id: `the-copy-${seed}`,
        name: BOOK.t.name,
        kind: 'manual',
        significance: 'significant',
        possessorId: cultivator.id,
        ownerId: cultivator.id,
        ownerName: 'Wen Shu',
        data: { techniqueId: BOOK.t.id, copies: 1 }
    }));

    const copy = () => (harness.game as { atHand: WorldAtHand }).atHand
        .objects.find(o => o.id === `the-copy-${seed}`)!;
    return { harness, cultivatorId: cultivator.id, copy };
}

describe('a heaven-grade book the player reads out', () => {
    it('GIVEN a copy in hand WHEN the art is learned THEN a use is spent off it', async () => {
        const { harness, copy } = await holdingIt('manual-uses');
        expect(usesSpentOn(copy())).toBe(0);

        const said = (await harness.game.act(`I learn ${BOOK.t.name}`)).narration ?? '';
        expect(said.length).toBeGreaterThan(0);

        expect(usesSpentOn(copy())).toBe(1);
        expect(isRuined(copy())).toBe(false);
    }, 300_000);

    it('GIVEN the last use WHEN it is taken THEN the book ends and nobody is holding it', async () => {
        const { harness, cultivatorId, copy } = await holdingIt('manual-spent');
        // Two already spent, arranged. The third is played.
        copy().data.usesSpent = 2;

        await harness.game.act(`I learn ${BOOK.t.name}`);

        const after = copy();
        expect(usesSpentOn(after)).toBe(3);
        expect(isRuined(after)).toBe(true);
        // `ruin` takes it out of every hand, which is what makes the next
        // reader's refusal fall out of the gate that was already there.
        expect(after.possessorId).toBeNull();
        expect(after.possessorId).not.toBe(cultivatorId);
        expect(after.power).toBeNull();
        // SPENT IS NOT GONE. The row still says what became of it.
        expect(after.provenance[after.provenance.length - 1].how).toBe('lost');
    }, 300_000);
});
