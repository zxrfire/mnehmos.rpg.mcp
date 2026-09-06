/**
 * Placing a child at a house, when there is no child.
 *
 * `placeAChild` composed the child's id as the constant
 * `child_of_<cultivator>`, commented as "the id the household tie already
 * carries". `haveAChild` writes the tie under `child_<me>_<them>_<day>`, and it
 * is the only writer of one - so the two conventions had never agreed, nothing
 * checked either against the other, and `spendAWord` never asked whether a
 * child existed at all.
 *
 * Both halves were live. A player who had never used the `child` verb typed
 * "I ask <somebody> to place my child at <a house>": the house checks passed,
 * a serious `sponsored_admission` favour went onto the obligation ledger, a
 * defining patron tie was recorded, and the answer was "the child is on the
 * roll at the bottom of it". There was no child. And in the honest direction it
 * failed too: a player who HAD raised one got a placement whose participants
 * named `child_of_<me>`, an id no row carries - which the same block's comment
 * calls "the only route a placed child has back to their own story".
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { theChildrenTheyRaised } from '../../src/web/encounters';

const WORLD = 'world-place-a-child';

interface Said { narration?: string; error?: string }
const heard = (said: Said): string => said.narration ?? said.error ?? '';

function favours(db: any, subjectId: string): { kind: string; participants: string }[] {
    return db.prepare(
        'SELECT kind, participants FROM obligations WHERE holder_id = ? OR subject_id = ?'
    ).all(subjectId, subjectId) as { kind: string; participants: string }[];
}

describe('placing a child', () => {
    it('refuses when the player has never raised one, and writes nothing', async () => {
        const { db, game } = await makeGameInWorld({ seed: 'no-child', worldSeed: WORLD });
        const { cultivator } = await game.newRun('Childless');

        expect(theChildrenTheyRaised(game.repos, cultivator.id)).toEqual([]);
        const before = favours(db, cultivator.id).length;

        const said = await game.act(
            'I place my child at the Azure Cloud Pavilion'
        ) as unknown as Said;

        expect(heard(said)).toMatch(/no child|there is nobody/i);
        // The whole of the defect: a favour was written for a placement that
        // could not have happened.
        expect(favours(db, cultivator.id).length).toBe(before);
    }, 300_000);

    /**
     * And once there IS one, the id the placement uses is the id the tie
     * carries. The two conventions are now one row read twice.
     */
    it('reads the child off the tie the raising wrote', async () => {
        const { game } = await makeGameInWorld({ seed: 'a-child', worldSeed: 'world-c1' });
        const { cultivator } = await game.newRun('Parent');
        await game.act('I look around');

        const here = (game as unknown as { present(c: unknown): { name: string }[] })
            .present(cultivator);
        expect(here.length, 'nobody here to have a child with').toBeGreaterThan(0);
        await game.act(`I have a child with ${here[0]!.name}`);

        const raised = theChildrenTheyRaised(game.repos, cultivator.id);
        expect(raised).toHaveLength(1);
        expect(raised[0]!.id).toMatch(new RegExp(`^child_${cultivator.id}_`));
        // The id the old code would have used, which nothing has ever written.
        expect(raised[0]!.id).not.toBe(`child_of_${cultivator.id}`);

        // And the placement no longer refuses for want of a child: whatever it
        // answers now is about the house.
        const said = await game.act(
            'I place my child at the Azure Cloud Pavilion'
        ) as unknown as Said;
        expect(heard(said)).not.toMatch(/no child to place/i);
    }, 300_000);
});
