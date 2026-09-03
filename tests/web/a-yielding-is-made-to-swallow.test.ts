/**
 * Somebody made to kneel and then made to swallow something.
 *
 * The other thing a submission opens, and the last of the four pieces. It was
 * refused for a while and the refusal was correct: the sentence could not
 * become an honest act, because every effect in the pill catalog was a benefit
 * and the trope needs a pill that does harm. Both now exist, so it can.
 *
 * WHAT IS PINNED IS THE LESSON THIS FAMILY HAS TAUGHT TWICE. The intent
 * existing is not enough and the phrasing reaching it is not enough - a row
 * that routes to a verb which then does nothing reports success, and a player
 * cannot tell that from an act that worked. So these go through to the world:
 * the pouch row is spent, the state on their record moves, and the ledger
 * opens.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, engineCalls } from './harness';
import { addToPouch } from '../../src/server/consolidated/cultivation-support.js';
import { parseIntent } from '../../src/web/verb-pattern-table.js';
import {
    HOLLOWING_PILL_ID,
    SOUL_QUENCHING_PILL_ID
} from '../../src/data/cultivation/pills.js';
import { whoseHandThisBodyIsUnder } from '../../src/engine/social/a-body-under-somebody-elses-hand.js';

const SEED = 'made-to-swallow';

interface ProbeNpc {
    id: string;
    name: string;
    soulState: string;
    identityContinuity: number;
    tags: string[];
}
interface OpenWorld { atHand: { npcs: ProbeNpc[] } | null }
interface AsksItsOwnRoster { present: (c: unknown) => { id: string; name: string }[] }

describe('the sentence reaches the act', () => {
    /**
     * Told apart from `hand_over` on the OBJECT, which is the one thing about
     * this verb's intents that a sentence can actually decide. A thing going
     * in and a thing coming out are both in the words; what the compliance was
     * FOR, when nothing is named, is not.
     */
    it.each([
        ['I force him to swallow it', 'him'],
        ['I make him swallow the pill', 'him'],
        ['I make her eat it', 'her'],
        ['I force Qiu Wanbo to swallow the pill', 'Qiu Wanbo'],
        ['I make Qiu Wanbo swallow it', 'Qiu Wanbo']
    ])('%s reaches swallow, naming the person and not the act', (said, who) => {
        expect(parseIntent(said), said).toMatchObject({
            action: 'coerce', intent: 'swallow', target: who
        });
    });

    /** And it takes nothing off the handing family it sits above. */
    it.each([
        ['I make him hand over everything', 'hand_over'],
        ['I force her to empty her pockets', 'hand_over'],
        ['I force him to hand over the ledger', 'hand_over'],
        ['I make him kneel', 'submit']
    ])('%s is still %s', (said, intent) => {
        expect(parseIntent(said).intent, said).toBe(intent);
    });
});

async function standingOverSomebody(pillId: string | null) {
    const { db, game } = await makeGameInWorld({
        seed: `${SEED}-${pillId ?? 'empty'}`,
        worldSeed: `world-${SEED}`,
        adminMode: true
    });
    const { cultivator } = await game.newRun('Lin Zhaoyi');
    db.prepare(
        'UPDATE cultivators SET realm_ordinal = 29, hp = 9000, max_hp = 9000 WHERE id = ?'
    ).run(cultivator.id);
    await game.act('I look around');

    const world = (game as unknown as OpenWorld).atHand!;
    const here = (game as unknown as AsksItsOwnRoster).present(cultivator);
    const mark = here
        .map(row => world.npcs.find(npc => npc.id === row.id))
        .find((npc): npc is ProbeNpc => npc !== undefined)!;
    expect(mark, `nobody with a world row was standing here on ${SEED}`).toBeDefined();

    // Through the engine's own writer rather than a hand-rolled insert: a test
    // that invents a row shape is testing a table it made up.
    if (pillId) addToPouch(db, cultivator.id, pillId, 'pill', 1);
    return { db, game, mark, playerId: cultivator.id };
}

describe('what goes down their throat', () => {
    /** THE POISON, forced on somebody else rather than taken. */
    it('puts a soul out with the quiet pill', async () => {
        const { game, mark } = await standingOverSomebody(SOUL_QUENCHING_PILL_ID);
        await game.act(`I make ${mark.name} swallow it`);

        expect(mark.soulState).toBe('fading');
        expect(mark.identityContinuity).toBe(0);
    }, 200_000);

    /**
     * THE HOLLOWING, which is the largest row this system writes. The hand and
     * the emptying are separate facts and both land.
     */
    it('puts a body under your hand with the hollowing pill, and opens the account', async () => {
        const { db, game, mark, playerId } = await standingOverSomebody(HOLLOWING_PILL_ID);
        await game.act(`I make ${mark.name} swallow it`);

        expect(mark.soulState).toBe('fragmented');
        expect(mark.identityContinuity).toBe(0);
        expect(whoseHandThisBodyIsUnder(mark.tags)).toBe(playerId);

        const held = db.prepare(
            'SELECT cause, severity, holder_id, status FROM obligations WHERE subject_id = ?'
        ).all(playerId) as { cause: string; severity: string; holder_id: string; status: string }[];
        const row = held.find(r => r.cause === 'violated');
        expect(row, 'nothing on the ledger about it').toBeDefined();
        expect(row!.severity).toBe('unforgivable');
        expect(row!.holder_id).toBe(mark.id);
        expect(row!.status).toBe('open');
    }, 200_000);

    /**
     * AND THE CHOICE THE TWO MODULES GENERATE BETWEEN THEM. You cannot both
     * control somebody and read them: hollowing the courier destroys what the
     * courier knew. Nobody wrote that rule.
     */
    it('leaves nothing to read in a body it put under your hand', async () => {
        const { game, mark } = await standingOverSomebody(HOLLOWING_PILL_ID);
        await game.act(`I make ${mark.name} swallow it`);

        const { whatASoulSearchTakes } =
            await import('../../src/engine/social/what-a-soul-search-takes.js');
        expect(whatASoulSearchTakes({
            searcherOrdinal: 44,
            subjectOrdinal: 5,
            subject: mark,
            held: [{
                id: 'k1', claimKey: 'c', statement: 'where they were taken',
                stance: 'knows', confidence: 0.9, stage: 'known'
            }]
        }).why).toBe('nothing_left');
    }, 200_000);

    /** Nothing to put in it, said rather than silently doing nothing. */
    it('says so when there is no pill to force', async () => {
        const { game, mark } = await standingOverSomebody(null);
        const acted = await game.act(`I make ${mark.name} swallow it`);

        expect(acted.narration).toMatch(/nothing to put in it/);
        expect(mark.soulState).toBe('intact');
        expect(engineCalls(acted).some(c => c.name === 'alchemy.forced')).toBe(false);
    }, 200_000);
});
