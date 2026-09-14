/**
 * A false account of yourself, and the two ends it can be caught from.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE GAP THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `recordAnAccountGiven` wrote a lie into a hearer's head, stamped the row
 * `fabricated`, and there it stopped. Measured across `src/` before this work:
 * the only readers of a knowledge row's disagreement were `provenanceOf` - a
 * read nothing in the world called with two holders - and an operator. NO
 * PERSON IN THE WORLD EVER COMPARED AN ACCOUNT AGAINST ANYTHING, so a player
 * could give a different house to every gate guard in the province and never
 * once be asked, and a stranger who borrowed a house name could never be
 * caught in it either.
 *
 * The design owner's ruling was that a challenge is BIDIRECTIONAL - *"i meant
 * two WAYS as in bidirectional"* - which is the same word already ruling that
 * an account is written at both ends. So both directions are asserted here,
 * and a green file with only one of them is half a feature.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE ASSERTIONS ENCODE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * THE COMPARISON IS OVER THE PARTS, NOT THE STATEMENT. `disagreementsAbout`
 * groups held claims by exact statement, and a holder's rows about one person
 * include the bare existence row beside an account - two strings that differ
 * without disagreeing. So an account has to be read back out of the statement
 * it was written into, and the parts compared.
 *
 * A PART EITHER SIDE IS SILENT ABOUT IS NOT A DISAGREEMENT. Somebody who gave
 * no house has not contradicted a house.
 *
 * BEING CAUGHT NEEDS BOTH HALVES. The world has to hold the account as untrue
 * AND the person gainsaying has to land on the same part. Either alone is a
 * challenge that missed, and a challenge that misses is a thing the player did
 * to somebody - it goes on the ledger facing the other way.
 *
 * NOTHING DECIDES WHO IS RIGHT. Where the two do not meet, the engine says
 * the accounts cannot both stand and says nothing else.
 *
 * WHAT IS NOT COVERED HERE, said plainly rather than left to be discovered.
 * `whatTheirMarksSayAbout` - the second route to having something to put
 * against a claimed house, which is reading the marks the person is actually
 * wearing - has no case below, because arranging it needs somebody standing in
 * the square who is on a house's roll AND whose house this cultivator can
 * name, and the world does not reliably put one there. That is a gap somebody
 * has written down, not an argued decision.
 *
 * Red-checked, one at a time:
 *   - returning `[]` from `whereTwoAccountsDisagree` turns the routing-free
 *     cases and both played gainsayings red;
 *   - making `whatTheyCaught` return every part of `against` rather than the
 *     intersection with `notSo` turns "a hearer who is the one who is wrong"
 *     and "a challenge with nothing behind it" red;
 *   - dropping the grudge write in `tellSomebody` turns the caught case red
 *     while leaving the gainsaying line green, which is the split the two
 *     halves are meant to have.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';
import {
    theAccountAsAStatement,
    theAccountInAStatement,
    whereTwoAccountsDisagree
} from '../../src/web/an-account-of-yourself';
import { whoseAccountIsBeingChallenged } from '../../src/web/two-accounts-of-one-person';

interface OpenRecord {
    holder_id: string;
    subject_id: string | null;
    kind: string;
    cause: string;
    severity: string;
}

function openLedger(
    db: { prepare(sql: string): { all(...args: unknown[]): unknown } }
): OpenRecord[] {
    return db.prepare(
        'SELECT holder_id, subject_id, kind, cause, severity FROM obligations '
        + "WHERE status = 'open' ORDER BY id"
    ).all() as OpenRecord[];
}

/**
 * The people the player can speak to. `present` is the roster the engine
 * itself uses, so picking them any other way arranges a situation the verb
 * will not agree it is in.
 */
function whoIsHere(game: any, cultivator: { id: string; location: string }) {
    return game.present(cultivator) as { id: string; name: string }[];
}

describe('reading an account back out of the row it was written into', () => {
    /**
     * The backward half of `theAccountAsAStatement`, and it lives beside it so
     * the two move together. Without it a held account is a sentence nothing
     * can compare against anything.
     */
    it('round-trips every shape an account is written in', () => {
        const shapes = [
            { name: 'Shen Wuyi', house: null, rung: null },
            { name: 'Shen Wuyi', house: 'Hollow Court', rung: null },
            { name: 'Shen Wuyi', house: null, rung: 'core_formation' as const },
            { name: 'Shen Wuyi', house: 'Hollow Court', rung: 'core_formation' as const }
        ];
        for (const shape of shapes) {
            const back = theAccountInAStatement(theAccountAsAStatement(shape, 'Fallback'));
            expect(back, `"${theAccountAsAStatement(shape, 'Fallback')}" reads back`).not.toBeNull();
            expect(back!.name).toBe('Shen Wuyi');
            expect(back!.house).toBe(shape.house);
            expect(back!.rung).toBe(shape.rung);
        }
    });

    /**
     * The speaker's own row wraps the hearer's statement, and a read that
     * stopped at the wrapper would leave every lie unauthored again.
     */
    it('reads the speaker\'s own record of having given one', () => {
        const said = theAccountAsAStatement(
            { name: 'Shen Wuyi', house: 'Hollow Court', rung: null }, 'Fallback'
        );
        const back = theAccountInAStatement(`An account given to Duan Shutao: ${said}`);
        expect(back?.house).toBe('Hollow Court');
    });

    /**
     * The rows that are NOT accounts, and must not be read as ones. This is the
     * whole reason the comparison is not `disagreementsAbout`.
     */
    it('is empty-handed on a row that is not an account', () => {
        expect(theAccountInAStatement('Duan Shutao exists.')).toBeNull();
        expect(theAccountInAStatement('The Hollow Court is somewhere out there.')).toBeNull();
        expect(theAccountInAStatement('')).toBeNull();
    });

    /**
     * Silence is not contradiction, which is the difference between this and
     * `whereTheAccountIsNotSo`: that one compares a claim against the world and
     * knows which is true, this one compares two claims and knows only that
     * they cannot both be.
     */
    it('calls only the parts both accounts speak to', () => {
        const withHouse = { name: 'Shen Wuyi', house: 'Hollow Court', rung: null };
        const withRung = { name: 'Shen Wuyi', house: null, rung: 'core_formation' as const };
        expect(whereTwoAccountsDisagree(withHouse, withRung)).toEqual([]);

        const otherHouse = { name: 'Shen Wuyi', house: 'Azure Dew Sect', rung: null };
        expect(whereTwoAccountsDisagree(withHouse, otherHouse)).toEqual(['house']);

        const otherName = { name: 'Bai Luo', house: 'Hollow Court', rung: null };
        expect(whereTwoAccountsDisagree(withHouse, otherName)).toEqual(['name']);

        // Two spellings of one name are one name, and it is the same
        // normalisation the forward comparison uses.
        expect(whereTwoAccountsDisagree(
            withHouse, { name: 'shen wuyi', house: 'the Hollow Court', rung: null }
        )).toEqual([]);
    });
});

describe('the sentence reaches the verb', () => {
    it('routes a denial of somebody\'s own account to challenge', () => {
        const denied = parseIntent('I tell him he is not of that sect');
        expect(denied.action).toBe('challenge');
        expect(denied.target).toBe('him');

        expect(parseIntent('I call her a liar about her rank').action).toBe('challenge');
        expect(parseIntent('I put it to Duan Shutao that he never was a disciple there').action)
            .toBe('challenge');
    });

    /**
     * The two neighbours it must not steal, and both were measured as `tell`
     * before this verb existed. A deed put on somebody is a telling; an account
     * of the SPEAKER is a telling; only a denial of the HEARER's own account is
     * this.
     */
    it('leaves both tellings where they were', () => {
        expect(parseIntent('I tell him that Cao Antao killed his brother').action).toBe('tell');
        expect(parseIntent('I tell the gate guard that I am of the Cinnabar Crucible Sect').action)
            .toBe('tell');
        expect(whoseAccountIsBeingChallenged('I tell him that his brother is dead')).toBeNull();
        expect(whoseAccountIsBeingChallenged('I tell her that she was seen at the pass'))
            .toBeNull();
    });
});

describe('the world\'s own people gainsay an account put to them', () => {
    /**
     * Two accounts to one person, and the second one is answered. The read runs
     * at the telling - one indexed lookup at a scene that is already happening -
     * rather than as a pass over anybody's rows.
     */
    it('answers the second account and opens what being caught costs', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'gainsay-1', worldSeed: 'gainsay-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const here = whoIsHere(game, cultivator);
        expect(here.length, 'this world puts people where a run opens').toBeGreaterThan(0);
        const hearer = here[0];

        // The player opens on nobody's roll, so both houses are accounts that
        // are not so, and the SECOND is the one they are caught in.
        expect(game.sectNameFor(cultivator)).toBeNull();
        await game.act(`I tell ${hearer.name} that I am of the Cinnabar Crucible Sect`);
        const before = openLedger(db);

        const again = await game.act(`I tell ${hearer.name} that I am of the Hollow Court`);

        expect(again.narration).toContain(hearer.name);
        const gainsaying = again.toolCalls.find(
            (row: { name: string; summary: string }) =>
                row.name === 'social.createObligation' && row.summary.includes('could not be')
        );
        expect(gainsaying, 'being caught reaches the ledger').toBeDefined();

        const opened = openLedger(db).filter(
            row => !before.some(had => had.holder_id === row.holder_id
                && had.subject_id === row.subject_id && had.cause === row.cause)
        );
        const held = opened.find(
            row => row.holder_id === hearer.id && row.subject_id === cultivator.id
        );
        expect(held, 'the person who was lied to is the one holding it').toBeDefined();
        expect(held!.kind).toBe('grudge');
        // The cause and the weight are read off the closed wrongs table rather
        // than typed in here, so a change there moves this with it.
        expect(held!.cause).toBe('betrayal');
    }, 180000);

    /**
     * AND THE GAINSAYING CAN BE THE WRONG ONE. Somebody holding a false account
     * of the player says so exactly as loudly, and nothing opens against a
     * player who has said nothing untrue. The engine does not tell either of
     * them which of the two is holding the bad row.
     */
    it('says so and opens nothing when the account being denied is true', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'gainsay-2', worldSeed: 'gainsay-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const hearer = whoIsHere(game, cultivator)[0];

        // Somebody else told them a name for this person, and it is not the
        // one they have. Written through the same gate every other acquisition
        // goes through.
        game.knowledge.learn({
            holderId: hearer.id,
            kind: 'cultivator',
            id: cultivator.id,
            name: 'Bai Luo',
            onDay: 0,
            sourceKind: 'told',
            sourceNote: 'What a carter said in the market.',
            stage: 'placed',
            statement: theAccountAsAStatement(
                { name: 'Bai Luo', house: null, rung: null }, 'Bai Luo'
            )
        });
        const before = openLedger(db);

        const said = await game.act(`I tell ${hearer.name} my name is ${cultivator.name}`);

        expect(said.narration).toContain(hearer.name);
        expect(openLedger(db).length, 'nothing opens against somebody telling the truth')
            .toBe(before.length);
    }, 180000);
});

describe('and the player gainsays one that was put to them', () => {
    /**
     * The other end of the same read. Two accounts of one person in the
     * player's own hands, the newer put to the person's face, and the world's
     * own row says the newer one was not theirs to give.
     */
    it('lands, and the liar is the one who ends up being held to something', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'challenge-1', worldSeed: 'gainsay-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const them = whoIsHere(game, cultivator)[0];
        for (const [day, name] of [[3, 'Shen Wuyi'], [4, 'Bai Luo']] as const) {
            game.knowledge.learn({
                holderId: cultivator.id,
                kind: 'cultivator',
                id: them.id,
                name,
                onDay: day,
                sourceKind: 'fabricated',
                sourceNote: 'Said of themselves at the gate.',
                stage: 'placed',
                statement: theAccountAsAStatement({ name, house: null, rung: null }, name)
            });
        }
        const before = openLedger(db);

        await game.act(`I tell ${them.name} he is not the name he gave`);

        const opened = openLedger(db).filter(
            row => !before.some(had => had.holder_id === row.holder_id
                && had.subject_id === row.subject_id && had.cause === row.cause)
        );
        const held = opened.find(
            row => row.holder_id === cultivator.id && row.subject_id === them.id
        );
        expect(held, 'the player is the one holding it when the challenge lands').toBeDefined();
        expect(held!.cause).toBe('betrayal');
    }, 180000);

    /**
     * AND A CHALLENGE WITH NOTHING BEHIND IT IS A THING THE PLAYER DID. The
     * account they hold is true and nothing contradicts it, so what happened is
     * that somebody was called a liar in front of whoever was standing there -
     * and it goes on the ledger facing the other way. This is the assertion
     * that keeps the verb from being an oracle.
     */
    it('costs the challenger when there is nothing to put against it', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'challenge-2', worldSeed: 'gainsay-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const them = whoIsHere(game, cultivator)[0];
        game.knowledge.learn({
            holderId: cultivator.id,
            kind: 'cultivator',
            id: them.id,
            name: them.name,
            onDay: 3,
            sourceKind: 'told',
            sourceNote: 'Said of themselves at the gate.',
            stage: 'placed',
            statement: theAccountAsAStatement(
                { name: them.name, house: null, rung: null }, them.name
            )
        });
        const before = openLedger(db);

        const put = await game.act(`I tell ${them.name} he is not the name he gave`);

        // Never says who is right, because nothing here knows.
        expect(put.narration.toLowerCase()).not.toContain('fabricat');

        const opened = openLedger(db).filter(
            row => !before.some(had => had.holder_id === row.holder_id
                && had.subject_id === row.subject_id && had.cause === row.cause)
        );
        const held = opened.find(
            row => row.holder_id === them.id && row.subject_id === cultivator.id
        );
        expect(held, 'the person called a liar is the one holding it').toBeDefined();
        expect(held!.cause).toBe('humiliation');
    }, 180000);
});
