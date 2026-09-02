/**
 * A house that takes one sex, refusing at the door, in the running game.
 *
 * The catalog half is `tests/data/a-court-that-takes-one-sex.test.ts`. This is
 * the half that matters more, because `AGENTS.md`'s most-repeated defect is a
 * rule that exists and that nothing in the running world ever consults: the
 * player's own route to the gate, through the same tool a player's sentence
 * reaches.
 *
 * The thing being asserted is the DIFFERENCE between the two refusals, not that
 * a refusal happens. A bar somebody could climb to and a door that is shut read
 * alike if nobody is careful, and telling somebody "not yet" about a thing that
 * is never sends them off to spend a century on a rung that changes nothing.
 */

import { describe, expect, it } from 'vitest';
import { makeGame } from './harness';
import { handleSectManage } from '../../src/server/consolidated/sect-manage';
import {
    A_HOUSE_THAT_TAKES_ONE_SEX
} from '../../src/data/cultivation/the-three-floors-a-house-admits-at';

const [CLOSED_HOUSE, TAKES] = Object.entries(A_HOUSE_THAT_TAKES_ONE_SEX)[0];
const REFUSED = TAKES === 'male' ? 'female' : 'male';

/** The machine-readable half of a `sect_manage` answer. */
function verdict(result: unknown): Record<string, unknown> {
    const text = ((result as { content: { text: string }[] }).content ?? [])
        .map(c => c.text).join('\n');
    const at = text.indexOf('SECT_MANAGE_JSON');
    if (at < 0) return {};
    const body = text.slice(at + 'SECT_MANAGE_JSON'.length);
    const end = body.lastIndexOf('}');
    try {
        return JSON.parse(body.slice(0, end + 1)) as Record<string, unknown>;
    } catch {
        return {};
    }
}

async function walkUp(sex: 'male' | 'female'): Promise<Record<string, unknown>> {
    const { db, game } = makeGame({ seed: `door-${sex}`, worldEnabled: true });
    const { cultivator } = await game.newRun('Lin Baoqing');
    // Well clear of the ordinal bar, so the only thing left that could refuse
    // is the door. Arranged rather than played to, which is what an admin
    // surface is for: this test is about the answer, not about the climb.
    db.prepare('UPDATE cultivators SET sex = ?, realm_ordinal = 20 WHERE id = ?')
        .run(sex, cultivator.id);

    return verdict(await handleSectManage({
        action: 'join',
        cultivatorId: cultivator.id,
        sectId: CLOSED_HOUSE
    } as never));
}

describe('a door that is shut is not a bar', () => {
    it('refuses the sex it does not take, and says it is never', async () => {
        const answer = await walkUp(REFUSED);

        expect(answer.error).toBe('house_takes_one_sex_only');
        expect(answer.takes).toBe(TAKES);
        expect(String(answer.message)).toContain('no version of this');
        // The two things it must NOT say, because both are the "come back
        // later" answer and this is not that.
        expect(String(answer.message)).not.toContain('Standing higher');
        expect(String(answer.message)).not.toContain('another look');
    }, 120_000);

    /**
     * And the other half, which is what makes the first half a finding rather
     * than a wall: somebody the house WOULD take is answered by the ordinary
     * machinery, and whatever it says, it does not say this.
     */
    it('says nothing about sex to somebody it would take', async () => {
        const answer = await walkUp(TAKES);
        expect(answer.error).not.toBe('house_takes_one_sex_only');
    }, 120_000);
});
