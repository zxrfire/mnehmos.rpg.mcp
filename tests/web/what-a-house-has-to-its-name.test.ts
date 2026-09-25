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
import { theThingsAHouseIsSittingOn, whatAHouseHasToItsName } from '../../src/web/what-a-house-has-to-its-name';
import { makeGameInWorld } from './harness';

function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

/** How this file addresses a house, which is how a player would. */
function asked(house: { name: string }): string {
    return house.name.replace(/^The /, '');
}

/**
 * Whether the question can be put about this house at all.
 *
 * ── A GAP THAT WAS WRITTEN DOWN HERE, AND IS NOW CLOSED ──────────────────
 *
 * 16 of the 38 houses could not be asked this question. Measured by running
 * `parseIntent('what does the <name> have')` over every row of `SECTS`: TEN
 * reached no intent at all and SIX were taken by the deposit counter. Both
 * causes were a word read out of a house's own name, and both are fixed -
 * `WHAT_A_HOUSE_HAS` asks the catalog which words a house is called by instead
 * of a hand list, and `legacyStep` no longer reads a house's name as a question
 * about its counter.
 *
 * The ratchet is the sweep in `the-nouns-a-house-ends-with.test.ts`, which is
 * where this family already lived and where a catalog growth is checked. This
 * stays an assertion rather than a filter, because the file it sits in is about
 * the BAND GATE over a vault, and a house the question cannot carry never
 * reaches the gate to be tested against it.
 */
function theQuestionReaches(house: { name: string }): boolean {
    const plan = parseIntent(`what does the ${asked(house)} have`) as
        { intent?: string; target?: string };
    return plan.intent === 'what_they_hold' && plan.target === asked(house);
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
    const heardOf = SECTS.filter(sect => knows(sect.id));
    expect(heardOf.length, 'this cultivator has heard of nobody').toBeGreaterThan(0);

    // The first one they were born knowing. It used to be filtered for whether
    // the question could be put about it at all - `holds-low` opens knowing the
    // Six Li Patrol and the Bountiful Sheaf Sect, and neither could be asked -
    // and now every house can, so the filter is an assertion.
    const known = heardOf[0];
    expect(
        theQuestionReaches(known),
        `${known.name} cannot be asked what it has`
    ).toBe(true);
    return { harness, id: cultivator.id, house: known };
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
    /**
     * The ground is public, and the record and the ground can disagree. The
     * Pavilion holds the Gorge Head outright while the Third Sluice's book still
     * carries it as a tenant; the Mist Court holds its own line inside it.
     */
    it('says what ground a house holds, on the record and as it stands', () => {
        const read = (factionId: string, houseName: string) => whatAHouseHasToItsName({
            world: null, house: null, houseName, factionId, readerOrdinal: 0, today: 0
        }).lines.join(' ');

        const pavilion = read('sect-azure-cloud-pavilion', 'The Azure Cloud Pavilion');
        expect(pavilion).toMatch(/holds The Gorge Head/);
        expect(pavilion).toMatch(/On the record: Still carried on the Third Sluice's book/);
        expect(pavilion).toMatch(/On the ground: Held outright and openly/);

        const mist = read('sect-azure-mist-court', 'The Azure Mist Court');
        expect(mist).toMatch(/sits in The Gorge Head/);
        expect(mist).toMatch(/On the record: The lower gorge and the mist terraces/);
        expect(mist).not.toMatch(/On the ground/);
    });

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

    /**
     * AND NOBODY CARRYING IT IS NOT SOMEBODY ELSE CARRYING IT.
     *
     * The predicate read `possessorId === factionId`, which treats those two as
     * the same fact. A craft is moored and never carried - `craft()` and
     * `mintCraft` both set `possessorId: null`, because a hull with a possessor
     * is one `bestObjectHeldBy` would arm somebody with - so every hull and
     * every titled carriage in the world was owned by a house and listed against
     * none of them. A visitor asking what the Azure Cloud Pavilion had to its
     * name was told about its shelves and not about the best hull in two
     * provinces, sitting in its own yard.
     *
     * Red-checked by putting `possessorId === factionId` back: this goes red on
     * the moored row and the test above stays green, which is the pair that
     * says the two cases are genuinely different.
     */
    it('counts a thing it owns that nobody is carrying', () => {
        const held = theThingsAHouseIsSittingOn(
            [
                makeObject({
                    id: 'hull', name: 'A hull', kind: 'artifact',
                    significance: 'significant', power: 38,
                    ownerId: 'h', ownerName: 'a house', possessorId: null
                }),
                makeObject({
                    id: 'theirs', name: 'Somebody else\'s hull', kind: 'artifact',
                    significance: 'significant', power: 38,
                    ownerId: 'other', ownerName: 'another house', possessorId: null
                })
            ],
            'h'
        );
        expect(held.map(t => t.id)).toEqual(['hull']);
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

        const answer = await harness.game.act(`what does the ${asked(house)} have`);
        const heard = said(answer);
        expect(heard).toMatch(/would have to be somebody they deal with/i);
        expect(heard).not.toMatch(/spirit stones against its name/i);
        expect(heard).not.toMatch(/On its shelves/i);
    }, 200_000);

    /** And somebody who deals with houses gets the figures. */
    it('gives the purse and the shelves to somebody who has climbed', async () => {
        const { harness, id, house } = await somebodyAndAHouseTheyKnow('holds-high');
        harness.repos.cultivators.update(id, { realmOrdinal: 35 });

        const answer = await harness.game.act(`what does the ${asked(house)} have`);
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
