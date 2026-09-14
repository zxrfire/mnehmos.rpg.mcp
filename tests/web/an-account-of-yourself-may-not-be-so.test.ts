/**
 * Giving a false account of yourself, played, and the two rows it leaves.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE GAP THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `SourceKind` carried `fabricated` from the day the knowledge layer was
 * written, `stageCeilingFor` had a case for it, `isGroundless` read it, and
 * `migrations.social.ts` indexed on it. Measured across `src/` before this
 * work: ONE producer anywhere - `asking-what-people-are-saying.ts`, which
 * stamps it on a rumour the world's own distortion pass had already marked
 * `invented`. Nothing wrote one for somebody inventing an account of
 * THEMSELVES, so the genre's commonest move - arriving in a new province under
 * a name, a house and a rung that are not yours - had no representation at
 * all, and nothing in the world was ever known to be untrue.
 *
 * Measured on the deterministic reader before the verb was widened:
 *
 *   "I tell the gate guard that I am of the Cinnabar Crucible Sect"
 *       -> interact(target="the gate guard that I am of the Cinnabar
 *                           Crucible Sect", intent=talk)
 *
 * the same swallowed-proposition failure `telling-a-wrong.ts` was built for,
 * one subject over.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHAT THE ASSERTIONS ENCODE
 * ═════════════════════════════════════════════════════════════════════════
 *
 * IT IS WRITTEN AT BOTH ENDS. The hearer holds the claim; the speaker holds
 * having given it. One row alone is a lie with no author, and nothing in the
 * world could ever ask what this person has been saying about themselves.
 *
 * THE SOURCE IS DECIDED BY THE WORLD, NOT BY THE WORDS. The same sentence
 * writes `told` from somebody who is who they say they are and `fabricated`
 * from somebody who is not. Nothing reads the sentence for sincerity.
 *
 * THE ENGINE DOES NOT SAY. The player-facing channel carries what the hearer
 * now holds and never that it was false - a player who was lied to has no way
 * to find out except by meeting somebody who holds the other account, and the
 * inspector channel is where the engine's own reading of it goes.
 *
 * AND THE CATCH FALLS OUT OF `provenanceOf`. No new read was written for it:
 * two holders, one subject, two statements that disagree, which is what that
 * method's own comment already promised - "two names for one thing, from two
 * sources, one of which was making it up".
 *
 * Red-checked: writing `sourceKind: 'told'` unconditionally in
 * `recordAnAccountGiven` turns the first two cases red, and dropping the
 * speaker's own row turns the third red.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';
import { existenceClaimKey } from '../../src/web/knowledge';
import {
    whatAccountWasGiven,
    whatHouseTheyClaimInstead,
    whereTheAccountIsNotSo
} from '../../src/web/an-account-of-yourself';

interface KnowledgeRow {
    holder_id: string;
    claim_key: string;
    statement: string;
    source_kind: string;
    source_note: string;
}

/** Every live row about one subject, whoever holds it. */
function rowsAbout(
    db: { prepare(sql: string): { all(...args: unknown[]): unknown } },
    subjectId: string
): KnowledgeRow[] {
    return db.prepare(
        'SELECT holder_id, claim_key, statement, source_kind, source_note '
        + 'FROM knowledge_records WHERE claim_key = ? AND superseded = 0 '
        + 'ORDER BY holder_id, id'
    ).all(existenceClaimKey('cultivator', subjectId)) as KnowledgeRow[];
}

/**
 * The people the player can speak to. `present` is the roster the engine
 * itself uses, so picking them any other way arranges a situation the verb
 * will not agree it is in.
 */
function whoIsHere(game: any, cultivator: { id: string; location: string | null }) {
    return game.present(cultivator) as { id: string; name: string }[];
}

describe('the sentence reaches the verb', () => {
    /**
     * The table is the fallback and the model reads first, but the fallback is
     * a shipping mode and a sentence it cannot route is a sentence that does
     * not exist on a machine with no model.
     */
    it('routes an account of yourself to tell, with the claim intact', () => {
        const told = parseIntent('I tell the gate guard that I am of the Cinnabar Crucible Sect');
        expect(told.action).toBe('tell');
        expect(told.target).toBe('the gate guard');
        expect(told.topic).toContain('Cinnabar Crucible Sect');

        const introduced = parseIntent(
            'I introduce myself to the steward as a Core Formation cultivator'
        );
        expect(introduced.action).toBe('tell');
        expect(introduced.target).toBe('the steward');
        // Put back into the first person by the reader, so everything
        // downstream has one rule for what makes a claim about the speaker.
        expect(introduced.topic).toMatch(/^I am /);
    });

    /**
     * The neighbour this must not steal. A greeting with no name, house or
     * rung in it is ordinary conversation and belongs to `interact`.
     */
    it('leaves a bare greeting where it was', () => {
        expect(parseIntent('I introduce myself to the steward').action).not.toBe('tell');
        expect(parseIntent('I tell him that his brother is dead').action).toBe('tell');
        expect(whatAccountWasGiven('his brother is dead')).toBeNull();
    });

    /**
     * `Verdant Spring Valley` ends in a word this world puts on ground, which
     * is why the reader takes the catalog's names before it takes a type noun,
     * and why it takes only the type nouns that can stand alone.
     */
    it('does not read a place a cultivator is from as a house', () => {
        expect(whatAccountWasGiven('I am from the north valley')).toBeNull();
        expect(whatAccountWasGiven('I am of the Hollow Court')?.house).toBe('Hollow Court');
    });
});

describe('an account of yourself, given to somebody', () => {
    it('writes a fabricated row in the hearer and a record of it on the speaker', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'account-1', worldSeed: 'account-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const here = whoIsHere(game, cultivator);
        expect(here.length, 'this world puts people where a run opens').toBeGreaterThan(0);
        const hearer = here[0];

        // A house nobody on this row belongs to. The player opens on nobody's
        // roll, so any house at all is an account that is not so.
        expect(game.sectNameFor(cultivator)).toBeNull();
        const said = await game.act(
            `I tell ${hearer.name} that I am of the Cinnabar Crucible Sect`
        );

        const rows = rowsAbout(db, cultivator.id);
        const held = rows.find(row => row.holder_id === hearer.id);
        const own = rows.find(row => row.holder_id === cultivator.id);

        expect(held, 'the hearer holds an account of the player').toBeDefined();
        expect(held!.source_kind).toBe('fabricated');
        expect(held!.statement).toContain('Cinnabar Crucible Sect');

        // THE HALF WITHOUT WHICH NOBODY CAN EVER BE CAUGHT. A claim whose
        // author holds no record of having made it is a claim nothing in the
        // world can trace back.
        expect(own, 'the speaker holds having given it').toBeDefined();
        expect(own!.source_kind).toBe('fabricated');
        expect(own!.source_note).toContain(hearer.name);

        // AND THE ENGINE DOES NOT SAY. The mechanical channel may; what
        // reaches the player and the narrator may not.
        expect(said.narration.toLowerCase()).not.toContain('fabricat');
        expect(said.narration.toLowerCase()).not.toContain('not so');
        expect(said.narration.toLowerCase()).not.toContain('lie');
        const call = said.toolCalls.find(row => row.name === 'knowledge.recordAnAccountGiven');
        expect(call, 'the inspector is told which it was').toBeDefined();
        expect(call!.summary).toContain('fabricated');
    }, 180000);

    /**
     * The same sentence shape, and the world decides. Nothing here reads the
     * words for whether the speaker meant them.
     */
    it('writes told when the account is so', async () => {
        const { db, game } = await makeGameInWorld({
            seed: 'account-2', worldSeed: 'account-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const here = whoIsHere(game, cultivator);
        const hearer = here[0];

        // Read off the ladder rather than typed in: a run opens at the bottom
        // rung, and naming that realm is a true account of where they stand.
        const truthfully = whereTheAccountIsNotSo(
            { name: null, house: null, rung: 'qi_condensation' },
            { name: cultivator.name, house: null, realmOrdinal: cultivator.realmOrdinal }
        );
        expect(truthfully, 'the arrangement is a true account').toHaveLength(0);

        await game.act(`I tell ${hearer.name} that I am a Qi Condensation cultivator`);

        const held = rowsAbout(db, cultivator.id).find(row => row.holder_id === hearer.id);
        expect(held).toBeDefined();
        expect(held!.source_kind).toBe('told');
    }, 180000);

    /**
     * THE CATCH, AND IT NEEDED NO NEW READ.
     *
     * `provenanceOf` already hands back every live row one holder has about one
     * entity, with the statement it was got in. Two holders, one subject, and
     * the disagreement is the two lists not matching - which is the whole of
     * what "somebody later meets a person who knows the real account" needs.
     */
    it('lets the true account and the false one be seen to disagree', async () => {
        const { game } = await makeGameInWorld({
            seed: 'account-3', worldSeed: 'account-world', worldEnabled: true
        });
        const { cultivator } = await game.newRun('Prober');
        await game.act('I look around');

        const here = whoIsHere(game, cultivator);
        expect(here.length, 'two people, so two accounts can be held').toBeGreaterThan(1);
        const [hearer, whoKnows] = here;

        await game.act(`I tell ${hearer.name} that I am of the Cinnabar Crucible Sect`);

        // Somebody who was there for it. Written through the same gate every
        // other perception goes through, at the stage witnessing earns.
        game.knowledge.learn({
            holderId: whoKnows.id,
            kind: 'cultivator',
            id: cultivator.id,
            name: cultivator.name,
            onDay: 0,
            sourceKind: 'witnessed',
            sourceNote: 'Grew up in the same county.',
            stage: 'known',
            statement: `${cultivator.name} is of no house at all.`
        });

        const asTold = game.knowledge
            .provenanceOf(hearer.id, 'cultivator', cultivator.id)
            .map((row: { statement: string }) => row.statement);
        const asItIs = game.knowledge
            .provenanceOf(whoKnows.id, 'cultivator', cultivator.id)
            .map((row: { statement: string }) => row.statement);

        expect(asTold.length).toBeGreaterThan(0);
        expect(asItIs.length).toBeGreaterThan(0);
        // Two people in one province, one subject, and nothing they hold is
        // the same sentence. That is the disagreement, and it is readable
        // without anything in the world being told which of them is right.
        expect(asTold.some((said: string) => asItIs.includes(said))).toBe(false);
        expect(asTold.join(' ')).toContain('Cinnabar Crucible Sect');
        expect(asItIs.join(' ')).toContain('no house');
    }, 180000);
});

describe('the world\'s own people do it too', () => {
    /**
     * A rate rather than a simulation, and the two things that must hold of it:
     * it is rare, and it never hands somebody their own house back.
     */
    it('has a stranger claim a house that is not theirs, rarely', () => {
        const houses = ['Hollow Court', 'Azure Dew Sect', 'Iron Ridge Hall'];
        const always = { chance: () => true, int: (min: number, _max: number) => min };
        const never = { chance: () => false, int: (min: number, _max: number) => min };

        expect(whatHouseTheyClaimInstead({ rng: never, theirOwn: null, houses })).toBeNull();

        const claimed = whatHouseTheyClaimInstead({
            rng: always, theirOwn: 'Hollow Court', houses
        });
        expect(claimed).not.toBeNull();
        expect(claimed).not.toBe('Hollow Court');

        // Nowhere to borrow a name from is not a lie, it is silence.
        expect(whatHouseTheyClaimInstead({
            rng: always, theirOwn: 'Hollow Court', houses: ['Hollow Court']
        })).toBeNull();
    });
});
