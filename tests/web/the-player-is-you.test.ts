/**
 * THE PLAYER IS `you`.
 *
 * Measured across thirty played verbs, the player's own name reached the
 * narration from three places, and every other line in the game says `you`. So
 * one answer read:
 *
 *     Kong Zhaoshan is here, and reads as a little beneath you.
 *     No apology was made and none was accepted. Whatever stands between
 *     Zhen Wuxia and them stands exactly as high as it did, unaltered.
 *
 * Two people in three sentences, one of whom is the reader, twice. The three
 * sources - `unresolved-attempt-denials.ts`, `factsForInteraction` and the
 * reprisal account in `what-somebody-does-about-being-wronged.ts` - were each
 * written in the third person on the reasoning that `facts.lines` spoke that
 * way and a narrator would turn it around. `facts.lines` does not speak that
 * way, and the deterministic renderer ships the switch straight through.
 *
 * THE ONE EXEMPTION IS ASKING FOR IT. `who am I` answers with the name,
 * because the name is the question. Nothing else here does.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';

const PLAYER = 'Zhen Wuxia';

describe('the player reads as the second person', () => {
    it('never names them in the third person in their own account', async () => {
        const { game, db, repos } = await makeGameInWorld({
            seed: 'you-not-them', worldSeed: 'you-not-them', worldEnabled: true
        });
        const { cultivator } = await game.newRun(PLAYER);
        repos.sects.addMember('sect-azure-cloud-pavilion', cultivator.id, 3);
        db.prepare('UPDATE cultivators SET spirit_stones = 5000, realm_ordinal = 12 WHERE id = ?')
            .run(cultivator.id);

        const offences: string[] = [];
        for (const said of [
            'I greet the nearest person',
            'I apologise to them',
            'I threaten them',
            'I try to bribe them',
            'I interrogate them',
            'I try to recruit them',
            'I deceive them',
            'I try to seduce them',
            'I offer to trade with them',
            'I take a manual from the sect library',
            'what stands between me and them',
            'what do people say about me',
            'what is my standing',
            'I look around'
        ]) {
            const answer = await game.act(said) as unknown as { narration: string };
            if (answer.narration.includes(PLAYER)) {
                const sentence = /[^.]*Zhen Wuxia[^.]*\./.exec(answer.narration)?.[0] ?? '';
                offences.push(`${said} -> ${sentence.trim()}`);
            }
        }
        expect(offences, 'the player was named in their own account').toEqual([]);
    }, 600_000);

    it('answers with the name when the name is the question', async () => {
        const { game } = await makeGameInWorld({
            seed: 'who-am-i', worldSeed: 'who-am-i', worldEnabled: true
        });
        await game.newRun(PLAYER);
        const answer = await game.act('who am I') as unknown as { narration: string };
        expect(answer.narration).toContain(PLAYER);
    }, 600_000);
});
