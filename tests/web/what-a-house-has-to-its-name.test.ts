/**
 * WHAT A HOUSE HAS TO ITS NAME.
 *
 * The question anybody asks about a body before they join it, rob it, marry
 * into it or move against it, and there was no sentence for it. Every part of
 * the answer already existed and none of it was reachable:
 *
 *   THE PURSE   `resources.spirit_stones`, which is now a real store that goes
 *               down when it is robbed and up when it is given to.
 *   THE THINGS  the rows in the one possessions table the house both owns and
 *               holds - the same read `whatIsLeftInTheHold` does for a war
 *               settlement, because a curious person is asking about exactly
 *               the shape a settlement moves.
 *   THE GROUND  the seat, and what is standing over it.
 *
 * ── AND IT IS GATED, BECAUSE A VAULT IS NOT PUBLIC ───────────────────────
 *
 * The same three bands `who-stands-behind-them.ts` uses, for the same reason.
 * Where a house SITS is public - a ward nobody can see is deterring nobody -
 * and what is in the vault is not. A cultivator low on the ladder gets what a
 * person in a market would say, which is that they would have to be somebody
 * the house deals with.
 *
 * ── AND THERE IS NO TOTAL, DELIBERATELY ──────────────────────────────────
 *
 * Adding a purse to a shelf of objects produces one number that says nothing
 * true. A house with nine medicines and no stones and a house with stones and
 * an empty vault are in completely different positions, and telling them apart
 * is the whole point of asking.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../src/data/cultivation/index';
import { parseIntent } from '../../src/web/actions';
import { makeObject } from '../../src/engine/world/possessions';
import { theThingsAHouseIsSittingOn } from '../../src/web/what-a-house-has-to-its-name';
import { makeGameInWorld } from './harness';

function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

/** A house this cultivator has actually heard of, asked rather than named. */
async function somebodyAndAHouseTheyKnow(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: seed });
    const { cultivator } = await harness.game.newRun('Curious');
    await harness.game.act('I look around');
    const knows = (id: string): boolean =>
        (harness.game as unknown as { knowledge: {
            isAwareOf(who: string, kind: string, id: string): boolean;
        } }).knowledge.isAwareOf(cultivator.id, 'sect', id);
    const known = SECTS.find(sect => knows(sect.id));
    expect(known, 'this cultivator has heard of nobody').toBeTruthy();
    return { harness, id: cultivator.id, house: known! };
}

describe('the sentence', () => {
    it('reaches the read, in the ways people ask it', () => {
        for (const [sentence, target] of [
            ['what does the Azure Dew Sect have', 'Azure Dew Sect'],
            ['how rich is the Clear River Alliance', 'Clear River Alliance']
        ] as const) {
            const plan = parseIntent(sentence) as { intent?: string; target?: string };
            expect(plan.intent, sentence).toBe('what_they_hold');
            expect(plan.target, sentence).toBe(target);
        }
    });

    /**
     * A NAME AND NOT A PHRASE. `extractSubject` returns everything after the
     * marker, which on this question is the name plus the verb that finished
     * the sentence - "Azure Dew Sect have" - and a bare pronoun where the
     * sentence used one.
     */
    it('carries a name rather than the tail of the sentence', () => {
        const plan = parseIntent('what does the sect hold') as { target?: string };
        expect(plan.target).not.toMatch(/\bhold\b/);
        // And a pronoun names nobody, so the asker means their own house.
        expect((parseIntent('what is in their vault') as { target?: string }).target)
            .toBeUndefined();
    });

    /** AND IT IS NOT THE MARKET, WHICH HAS PRICES ON IT. */
    it('leaves the verbs around it alone', () => {
        expect(parseIntent('what is for sale here').action).toBe('market');
        expect(parseIntent('what is made here').intent).toBe('what_is_made_here');
        expect(parseIntent('who stands behind the Azure Dew Sect').intent)
            .toBe('who_is_above_them');
    });
});

describe('what is counted as theirs', () => {
    /**
     * BOTH OWNED AND HELD, which is the same read a war settlement does. A
     * thing a house owns that somebody else is carrying is not in its vault,
     * and the day that stops being true for a settlement it must stop being
     * true here.
     */
    it('counts only what the house is actually sitting on', () => {
        const row = (id: string, name: string, ownerId: string, possessorId: string) =>
            makeObject({
                id, name, kind: 'artifact', significance: 'significant', power: 20,
                ownerId, ownerName: 'a house', possessorId
            });
        const held = theThingsAHouseIsSittingOn(
            [
                row('a', 'in the vault', 'h', 'h'),
                row('b', 'lent out', 'h', 'somebody'),
                row('c', 'somebody else\'s', 'other', 'other')
            ],
            'h'
        );
        expect(held.map(t => t.id)).toEqual(['a']);
    });
});

describe('played', () => {
    /**
     * THE GATE, WHICH IS THE WHOLE DESIGN. Where a house sits is public and
     * what is in its vault is not.
     */
    it('tells a low cultivator where the house sits and nothing about its purse', async () => {
        const { harness, id, house } = await somebodyAndAHouseTheyKnow('holds-low');
        harness.repos.cultivators.update(id, { realmOrdinal: 4 });

        const answer = await harness.game.act(
            `what does the ${house.name.replace(/^The /, '')} have`
        );
        const heard = said(answer);
        expect(heard).toMatch(/would have to be somebody they deal with/i);
        expect(heard).not.toMatch(/spirit stones against its name/i);
        expect(heard).not.toMatch(/On its shelves/i);
    }, 200_000);

    /** And somebody who deals with houses gets the figures. */
    it('gives the purse and the shelves to somebody who has climbed', async () => {
        const { harness, id, house } = await somebodyAndAHouseTheyKnow('holds-high');
        harness.repos.cultivators.update(id, { realmOrdinal: 35 });

        const answer = await harness.game.act(
            `what does the ${house.name.replace(/^The /, '')} have`
        );
        const heard = said(answer);
        expect(heard).toMatch(/spirit stones against its name|holding nothing at all in stones/i);
        expect(heard).toMatch(/On its shelves|nothing on its shelves/i);
        // A read costs nothing.
        expect(heard).not.toMatch(/days? pass/i);
    }, 200_000);

    /**
     * AND NAMING NOBODY MEANS YOUR OWN, which is what "what is in the vault"
     * asks. Somebody on nobody's roll is told so rather than being asked again.
     */
    it('answers about your own house when the sentence named none', async () => {
        const { harness } = await somebodyAndAHouseTheyKnow('holds-mine');
        const answer = await harness.game.act('what is in their vault');
        expect(said(answer)).toMatch(/on nobody's roll|no house it would be/i);
    }, 200_000);
});
