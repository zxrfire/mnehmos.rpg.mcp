/**
 * Two oaths, two kinds of consequence, and the difference is who it was sworn to.
 *
 * The design owner:
 *
 *   > you can swear to the azure dew sect. if you break it they send people.
 *   > but swearing to the dao house, you suffer the tribulation punishment.
 *   > AND they might send people too, cuz they view oath breaks with contempt
 *
 * So nothing here reads the WORDS of the oath to decide how bad breaking it is.
 * The magnitude is a fact about the party on the other side of it, which is why
 * a house that does nothing but witness oaths is worth having in the world.
 */

import { describe, expect, it } from 'vitest';

import { makeGame } from './harness';
import { parseIntent } from '../../src/web/verb-pattern-table';
import {
    DESCENT_TRIBULATION_STRIKES,
    strikesForABrokenDaoOath
} from '../../src/engine/cultivation/existence';

interface Row { kind: string; cause: string; holder_id: string; status: string }

const ledger = (db: ReturnType<typeof makeGame>['db']): Row[] =>
    db.prepare('SELECT kind, cause, holder_id, status FROM obligations').all() as Row[];

const struckIn = (calls: readonly { name: string }[]): boolean =>
    calls.some(c => c.name === 'engine.weatherTheStrikes');

describe('a word given to a house', () => {
    /**
     * The ordinary kind. Nothing comes out of the sky; what stands afterwards
     * is an account somebody holds, and what they do about it is theirs.
     */
    it('is answered by the house, not by the heavens', async () => {
        const { game, db } = makeGame({ seed: 'sect-oath', worldEnabled: true });
        await game.newRun('Probe');
        await game.act('I swear an oath to the Azure Dew Sect');
        const broke = await game.act('I break the oath I swore');

        expect(struckIn(broke.toolCalls), 'no tribulation for a word given to a sect')
            .toBe(false);
        const opened = ledger(db).filter(row => row.cause === 'broken_oath');
        expect(opened.length, 'somebody is holding it').toBeGreaterThan(0);
    });
});

describe('a dao oath', () => {
    /**
     * *heaven doesn't care, but you did promise. it doesn't care what you
     * promised.* The strike is not a judgement on what the oath was for, and
     * nothing in this path reads the words of it.
     */
    it('is answered by the sky as well', async () => {
        const { game, db } = makeGame({ seed: 'dao-oath', worldEnabled: true });
        await game.newRun('Probe');
        await game.act('I swear a dao oath to the Vermilion Seal Terrace');
        const broke = await game.act('I break the dao oath I swore');

        expect(struckIn(broke.toolCalls), 'the sky answered').toBe(true);
        // AND the house still holds it, which is the "they might send people
        // too" half. Whether they act is their discretion and not this test's.
        expect(
            ledger(db).some(row =>
                row.cause === 'broken_oath' && row.holder_id === 'house-vermilion-seal'),
            'the Vermilion Seal Terrace is holding an account about it'
        ).toBe(true);
    });

    /** The house is known to everybody, or the verb has no way in. */
    it('can be sworn by somebody who was never introduced to the house', async () => {
        const { game } = makeGame({ seed: 'known-house', worldEnabled: true });
        await game.newRun('Probe');
        const sworn = await game.act('I swear a dao oath to the Vermilion Seal Terrace');
        expect(sworn.toolCalls.map(c => c.name)).toContain('social.createObligation');
    });
});

describe('what the sky draws, and off whom', () => {
    /**
     * Nine strikes is what an immortal weathers coming down through their own
     * hole. Handed to a Qi Condensation disciple it is not a punishment, it is
     * a delete - the design owner caught exactly that: *that would just kill
     * people, cuz that is for immortals lol.*
     */
    it('scales to the realm, and tops out at the crossing', () => {
        expect(strikesForABrokenDaoOath(0)).toBe(1);
        expect(strikesForABrokenDaoOath(4)).toBe(5);
        expect(strikesForABrokenDaoOath(9)).toBe(DESCENT_TRIBULATION_STRIKES);
        // Never zero. Somebody at the bottom of the ladder is still struck.
        expect(strikesForABrokenDaoOath(-3)).toBe(1);
        // And never past the crossing, whatever is above the top of the ladder.
        expect(strikesForABrokenDaoOath(40)).toBe(DESCENT_TRIBULATION_STRIKES);
    });

    /**
     * COUNTED FROM WHAT THEY ARE NOW. *you can imagine someone making an oath
     * pre immortal, not being able to fulfil it.* Rising makes an unkept word
     * more dangerous, not less, and nothing had to be written for that.
     */
    it('counts from the breaker rather than from the oath', () => {
        expect(strikesForABrokenDaoOath(8)).toBeGreaterThan(strikesForABrokenDaoOath(1));
    });
});

describe('an oath about a thing is not the thing', () => {
    /**
     * The design owner: *oaths don't have to be like, I promise I won't do x,
     * it can also be I promise I WILL do X.* An undertaking names the act it is
     * an undertaking about, and the act is in the future and owed - which is
     * the whole of what a dao oath is for.
     *
     * Measured before this: "I swear a dao oath that I will kill him" drew a
     * sword. The violence branch sits five hundred lines above the oath branch
     * and "kill him" was all it needed.
     */
    it('swears about a killing rather than doing one', () => {
        expect(parseIntent('I swear a dao oath that I will kill him').action).toBe('oath');
        expect(parseIntent('I swear a blood oath to destroy the Iron Ridge').action).toBe('oath');
        expect(parseIntent('I take an oath that I will bring back the herb').action).toBe('oath');
    });

    /**
     * And the guard is narrow. It takes an explicit swearing with the oath
     * NAMED, so a sentence that means it still means it.
     */
    it('leaves a plain killing alone', () => {
        expect(parseIntent('I kill him').action).toBe('attack');
        expect(parseIntent('I attack the elder').action).toBe('attack');
        expect(parseIntent('I challenge him to a duel').action).toBe('attack');
    });
});
