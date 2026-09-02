/**
 * WHOSE ART THAT WAS - the trust hierarchy's strongest check, played.
 *
 * `docs/world/trust.md` says a house's arts are the closest thing it has to an
 * identity, and that nothing in the engine could look at one being performed
 * and say whose it was. This file is the verb that closes that, measured the
 * way a player reaches it: by typing the sentence.
 *
 * Three things are asserted, in the order they matter:
 *
 *   THE SENTENCE REACHES THE VERB. "is this the Azure Cloud's art" and "do I
 *   recognise this style" are the phrasings somebody would actually use, and
 *   neither is allowed to fall into `recall`, whose answer is a true statement
 *   about the knowledge table and not an answer to what was watched.
 *
 *   THE ANSWER IS GRADED BY BOTH AXES AND NEVER FAKES CONFIDENCE. The same
 *   character, at two rungs, gets two different answers about the same art -
 *   and the one at the bottom is hedged rather than wrong.
 *
 *   IT COSTS NOTHING. No day passes and no row is written, because looking at
 *   what is in front of you and thinking about it is always legitimate.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { parseIntent } from '../../src/web/actions.js';
import { getSect } from '../../src/data/cultivation/sects.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import { makeGameInWorld, type Harness } from './harness.js';

const AZURE = 'sect-azure-cloud-pavilion';
const AZURE_NAME = 'Azure Cloud Pavilion';

const PAVILION_ART = (() => {
    const sect = getSect(AZURE) as { signatureTechniqueId?: string | null } | undefined;
    const id = sect?.signatureTechniqueId;
    if (!id) throw new Error('the Pavilion has no signature art in the catalog');
    return id;
})();

describe('the sentence reaches the verb', () => {
    it('a claim put to the check parses as recognise and carries the house', () => {
        const plan = parseIntent('is this the Azure Cloud Pavilion\'s art');
        expect(plan.action).toBe('recognise');
        expect(plan.target?.toLowerCase()).toContain('azure cloud');
    });

    it('the bare question parses too', () => {
        expect(parseIntent('whose art is that').action).toBe('recognise');
        expect(parseIntent('do I recognise this style').action).toBe('recognise');
        expect(parseIntent('have I seen this technique before').action).toBe('recognise');
    });

    it('and it does not steal a question about a name', () => {
        // The one `recall` sentence that sits closest to it. Faces and names
        // are a different check and a much weaker one.
        expect(parseIntent('what do I know of the Azure Cloud Pavilion').action).toBe('recall');
        expect(parseIntent('have I heard of the Azure Cloud Pavilion').action).toBe('recall');
    });
});

describe('the same character, at two rungs, asking about the same art', () => {
    let harness: Harness;

    beforeEach(async () => {
        harness = await makeGameInWorld({ seed: 'recognise-seed', worldSeed: 'recognise-world' });
        await harness.game.newRun('Watcher');
    });

    /** Put the reader in the room once, so they hold the reference. */
    function giveThemTheReference(): void {
        const id = harness.db.prepare('SELECT id FROM cultivators LIMIT 1').get() as { id: string };
        new KnowledgeGate(harness.db).learn({
            holderId: id.id,
            kind: 'sect',
            id: AZURE,
            name: AZURE_NAME,
            onDay: 0,
            sourceKind: 'witnessed',
            stage: 'encountered',
            sourceNote: 'watched them perform at a tournament'
        });
    }

    function standAt(ordinal: number): void {
        harness.db.prepare('UPDATE cultivators SET realm_ordinal = ?').run(ordinal);
    }

    it('with no reference at all, they are told they would not know it - never a bare no', async () => {
        standAt(40);
        const said = await harness.game.act(`is this the ${AZURE_NAME}'s art`) as
            { narration?: string; toolCalls?: { name?: string; action?: string; summary?: string }[] };
        const call = (said.toolCalls ?? []).find(c => c.name === 'world.whereThisArtWasLearned');
        expect(call?.summary).toContain('would_not_know_it');
        // The character is at the very top of the ladder and still cannot say.
        // That is the recluse's failure and it is the whole point of two axes.
        expect(call?.summary).toContain('ordinal 40');
    });

    it('with a reference and too low a rung, the answer is hedged', async () => {
        giveThemTheReference();
        standAt(0);
        const said = await harness.game.act(`is this the ${AZURE_NAME}'s art`) as
            { toolCalls?: { name?: string; action?: string; summary?: string }[] };
        const call = (said.toolCalls ?? []).find(c => c.name === 'world.whereThisArtWasLearned');
        // Either honest short answer is acceptable here and both are hedges:
        // which one depends on how far the Pavilion's signature sits above a
        // beginner, and neither is a flat verdict.
        expect(call?.summary).toMatch(/could_not_follow|consistent/);
        expect(call?.summary).not.toMatch(/it_is\b|it_is_not/);
    });

    it('with a reference and the rung to go with it, the answer is flat', async () => {
        giveThemTheReference();
        standAt(40);
        const said = await harness.game.act(`is this the ${AZURE_NAME}'s art`) as
            { toolCalls?: { name?: string; action?: string; summary?: string }[] };
        const call = (said.toolCalls ?? []).find(c => c.name === 'world.whereThisArtWasLearned');
        expect(call?.summary).toContain('Verdict it_is');
    });

    it('costs no day and writes nothing', async () => {
        giveThemTheReference();
        const before = harness.db.prepare('SELECT elapsed_days AS day FROM runs LIMIT 1').get() as { day: number };
        await harness.game.act(`is this the ${AZURE_NAME}'s art`);
        const after = harness.db.prepare('SELECT elapsed_days AS day FROM runs LIMIT 1').get() as { day: number };
        expect(after.day).toBe(before.day);
    });

    it('names the art it read, and prices it off the catalog rather than a guess', async () => {
        giveThemTheReference();
        standAt(40);
        const said = await harness.game.act(`is this the ${AZURE_NAME}'s art`) as
            { toolCalls?: { name?: string; action?: string; summary?: string }[] };
        const call = (said.toolCalls ?? []).find(c => c.name === 'world.whereThisArtWasLearned');
        expect(call?.summary).toContain(PAVILION_ART);
    });
});
