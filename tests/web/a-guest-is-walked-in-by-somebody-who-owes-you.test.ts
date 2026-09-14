/**
 * The guest road was offered by exactly the people with no reason to take it.
 *
 * `whoWouldWalkYouIn` is the second of a house gate's three roads: you have no
 * standing, but somebody of the house is out here and owes you, and they spend
 * that to bring you through. Its own header says so - *"the reason they do it is
 * that they owe you"* - and it read the ledger off the columns:
 *
 *     row.kind === 'debt' || row.kind === 'favor'   &&   row.subjectId === you
 *
 * A DEBT AND A FAVOUR DO NOT AGREE ABOUT WHICH COLUMN IS THE OWER, and
 * `whichWayItPoints` in `grudges.ts` says it outright: a debt's HOLDER has to
 * make it good, a favour's SUBJECT does. So the debt arm was right and the
 * favour arm was exactly backwards - it found the house's people the PLAYER
 * owed, and offered them as hosts.
 *
 * A favour is the commoner row of the two (`aFavourForTheWork`, the kindness
 * done to something on a hillside), so the road mostly did not work and, where
 * it did, worked for the wrong reason.
 *
 * Pinned per kind and in both directions, because one example would have caught
 * this only by luck: the bug is invisible on a debt.
 */

import { describe, it, expect } from 'vitest';

import { makeGameInWorld } from './harness';
import { whoWouldWalkYouIn } from '../../src/web/walking-up-to-a-house';
import { createObligation } from '../../src/engine/social/grudges';
import { writeOneObligation } from '../../src/storage/repos/obligation.repo';
import type { SomebodyOfTheHouse } from '../../src/engine/world/standing-at-the-gate-of-a-house';

const HOST: SomebodyOfTheHouse = { id: 'npc-host', name: 'A Disciple', rankIndex: 3 };

/**
 * One ledger row, and who `whoWouldWalkYouIn` picks off the back of it.
 *
 * `holder` and `subject` are passed as the words the ledger uses rather than as
 * "who owes whom", because the whole defect was somebody reading those two
 * columns as if they meant the same thing for every kind.
 */
async function withOneRow(
    seed: string,
    row: { kind: 'debt' | 'favor'; holderId: string; subjectId: string }
): Promise<SomebodyOfTheHouse | null> {
    const { game, db } = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const { cultivator } = await game.newRun('Lin Baoqing');
    const put = (id: string) => (id === 'you' ? cultivator.id : id);

    writeOneObligation(db as never, createObligation({
        kind: row.kind,
        holderId: put(row.holderId),
        subjectId: put(row.subjectId),
        cause: 'other',
        severity: 'serious',
        onDay: 0,
        description: 'A thing done that has not been made good.'
    }));

    return whoWouldWalkYouIn(game as never, cultivator, [HOST]);
}

describe('who would walk you through a gate', () => {
    it('is somebody who owes you a favour, which you HOLD', async () => {
        // `aFavourForTheWork` writes it this way: the one owed the kindness is
        // the holder. So a host who owes you is the subject of your row.
        expect(await withOneRow('favour-owed-to-you', {
            kind: 'favor', holderId: 'you', subjectId: HOST.id
        })).toEqual(HOST);
    });

    it('is not somebody YOU owe a favour to', async () => {
        // The arm that was inverted. Nobody walks a stranger past a gate
        // because the stranger is already in their debt.
        expect(await withOneRow('favour-owed-by-you', {
            kind: 'favor', holderId: HOST.id, subjectId: 'you'
        })).toBeNull();
    });

    it('is somebody who owes you a debt, which they hold', async () => {
        expect(await withOneRow('debt-owed-to-you', {
            kind: 'debt', holderId: HOST.id, subjectId: 'you'
        })).toEqual(HOST);
    });

    it('is not somebody you owe a debt to', async () => {
        expect(await withOneRow('debt-owed-by-you', {
            kind: 'debt', holderId: 'you', subjectId: HOST.id
        })).toBeNull();
    });

    it('is nobody at all when the house has nobody out here', async () => {
        const { game } = await makeGameInWorld({
            seed: 'nobody-out-here', worldSeed: 'world-nobody-out-here'
        });
        const { cultivator } = await game.newRun('Lin Baoqing');
        expect(whoWouldWalkYouIn(game as never, cultivator, [])).toBeNull();
    });
});
