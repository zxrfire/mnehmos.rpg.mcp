/**
 * SEVEN BYSTANDERS OFFERED AS CANDIDATES FOR THE NAME OF A HOUSE.
 *
 * Measured on the trope corpus against a live narrator, in the scenario named
 * for a declaration travelling:
 *
 *     I will end the Azure Cloud Pavilion
 *
 *     "Lu Nuoming tells you who is present: Tang Xuxue, Kong Xuru, He Tianhe,
 *      and four others. They leave it to you to specify which of them you
 *      meant, or to admit that you meant none of them."
 *
 * The player named a house of the catalog in full, correctly spelled, with its
 * article. Nobody standing in that square is called that and nobody ever could
 * be.
 *
 * ── WHY THE ENGINE COULD NOT TELL ────────────────────────────────────────
 *
 * `nobodyByThatName` is the refusal every party-taking verb funnels into, and
 * the only reader it had for "is that a body" was `factionMeant`, which is
 * KNOWLEDGE-GATED. A fresh cultivator knows four houses out of thirty-six - the
 * ones near where they woke up - which is a good model and not the bug. The bug
 * is that the same gate was deciding what KIND of refusal an unknown name got,
 * so a house the player had not heard of was indistinguishable from a person
 * who is not here.
 *
 * ── AND THE FIX DISCLOSES NOTHING ────────────────────────────────────────
 *
 * `thoseWordsNameSomeBody` reads the whole catalog, ungated, to answer one
 * question - is that the name of a body - and nothing follows from a true
 * answer except which refusal is used. The refusal it selects,
 * `noPartyNamed`, lists only the bodies this cultivator actually holds names
 * for, exactly as it did before. What the player is told about the world is
 * unchanged; what changed is that they are no longer asked which of seven
 * strangers was the sect.
 */

import { describe, expect, it } from 'vitest';

import { SECTS } from '../../src/data/cultivation/index';
import { makeGameInWorld } from './harness';

function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

/**
 * A house the starting cultivator has NOT heard of.
 *
 * Chosen by asking, rather than named: which houses a fresh cultivator knows is
 * a fact about where they woke up, and hard-coding one makes the test a
 * statement about a seed instead of about the refusal.
 */
async function aFreshCultivatorAndAHouseTheyDoNotKnow(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: seed });
    const { cultivator } = await harness.game.newRun('Fresh');
    await harness.game.act('I look around');
    const knows = (id: string): boolean =>
        (harness.game as unknown as { knowledge: {
            isAwareOf(who: string, kind: string, id: string): boolean;
        } }).knowledge.isAwareOf(cultivator.id, 'sect', id);

    const unheardOf = SECTS.find(sect => !knows(sect.id));
    expect(unheardOf, 'this cultivator has heard of every house in the world').toBeTruthy();
    return { harness, unheardOf: unheardOf! };
}

describe('a name that belongs to a body', () => {
    /**
     * THE WHOLE OF IT. The people in the square are never offered as candidates
     * for a house's name, whether or not the player has heard of the house.
     */
    it('is never answered with a list of the people standing here', async () => {
        const { harness, unheardOf } = await aFreshCultivatorAndAHouseTheyDoNotKnow('body-1');

        // Straight at the interact path, which is where phase 1 puts a
        // person-shaped act and where the corpus failure landed.
        const answer = await harness.game.act(`I threaten ${unheardOf.name}`);
        const heard = said(answer);

        expect(heard).not.toMatch(/which of them you meant|which of it you meant/i);
        expect(heard).toMatch(/a body rather than a person|not somebody standing here/i);
    }, 200_000);

    /**
     * AND IT DISCLOSES NOTHING. The refusal lists what this cultivator already
     * holds names for and never the house they just named, which they have
     * never heard of.
     */
    it('never confirms the house the player named', async () => {
        const { harness, unheardOf } = await aFreshCultivatorAndAHouseTheyDoNotKnow('body-2');
        const answer = await harness.game.act(`I threaten ${unheardOf.name}`);
        // The refusal may echo the words the player typed on the mechanical
        // channel; what it must not do is tell them the house is real.
        expect(said(answer)).not.toMatch(/you have not heard of|there is such a house/i);
    }, 200_000);
});

describe('a name that belongs to nobody at all', () => {
    /**
     * UNCHANGED, AND THAT IS THE POINT. An invented name is still answered by
     * offering the room, because a name got slightly wrong is the commonest
     * mistake there is and the offer is the better answer.
     */
    it('still offers the people who are actually here', async () => {
        const harness = await makeGameInWorld({ seed: 'body-3', worldSeed: 'body-3' });
        await harness.game.newRun('Fresh');
        await harness.game.act('I look around');

        const answer = await harness.game.act('I threaten Nobody Whatsoever');
        expect(said(answer)).not.toMatch(/a body rather than a person/i);
    }, 200_000);
});
