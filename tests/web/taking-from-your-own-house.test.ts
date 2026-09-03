/**
 * Taking a thing your own house owns.
 *
 * Found by playing: "I take a manual from the sect library without asking" was
 * answered with prose saying the hand closed around it, and NOTHING MOVED.
 * `steal` is an intent on `interact` and `factsForInteraction` says outright
 * that the intent is "carried for the narrator; read by no conditional", so
 * nothing ran. `transferPossession` is the one function that moves a row and
 * its callers were trade, bequest, estate, the hunt and the legacy path - not
 * one of them a taking.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { openLedgerBetween } from '../../src/web/encounters';
import { isYourOwnHouseHoldingIt } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';

const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

async function memberOfAHouseWithAShelf(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: `${seed}-w` }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db.prepare('UPDATE cultivators SET realm_ordinal = 12 WHERE id = ?')
        .run(cultivator.id);
    harness.repos.sects.addMember(LOCAL_SECT.id, cultivator.id, 0);
    return { harness, cultivatorId: cultivator.id };
}

describe('the sentence reaches an act', () => {
    it('routes the sentence that found the defect', () => {
        for (const text of [
            'I take a manual from the sect library without asking',
            'I steal a manual from the library',
            'I help myself to something from the sect archive',
            'I take a book from the house library'
        ]) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('sect');
            expect(plan.intent, text).toBe('take');
        }
    });

    it('leaves every counted-tier sentence with siphon, which already had them', () => {
        // The two crimes are separated by `keptAs` rather than by a list of
        // nouns, and this is the boundary asserted at the parser. Widening the
        // taking pattern until it swallowed the treasury would have been the
        // exact failure `verb-pattern-table.ts` warns about in its own header.
        for (const text of [
            'I take the sect treasury and leave in the night',
            'I steal from the sect reserves',
            'I skim some spirit stones from the coffers'
        ]) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('sect');
            expect(plan.intent, text).toBe('siphon');
        }
    });

    it('does not swallow the commonest use of the word take', () => {
        expect(parseIntent('I take a duty').intent).toBe('duty');
        expect(parseIntent('I take a commission').intent).toBe('duty');
        expect(parseIntent('I take whatever work the village will give me').action).toBe('work');
    });
});

describe('the object actually moves', () => {
    it('moves possession, leaves ownership, and writes the provenance link', async () => {
        const { harness, cultivatorId } = await memberOfAHouseWithAShelf('theft');
        const world = await harness.game.loadWorld();
        const shelf = world.objects.filter((o: any) => o.possessorId === LOCAL_SECT.id);
        expect(shelf.length, 'the house should be holding its library').toBeGreaterThan(0);

        const target = shelf.find((o: any) => o.significance !== 'mundane') ?? shelf[0];
        const before = target.provenance.length;

        const done = await harness.game.act(
            `I take ${target.name} from the sect library without asking`
        );
        expect((done.narration ?? '').length).toBeGreaterThan(0);

        const after = (await harness.game.loadWorld()).objects
            .find((o: any) => o.id === target.id)!;

        // POSSESSION MOVES.
        expect(after.possessorId).toBe(cultivatorId);
        // OWNERSHIP DOES NOT. `transferPossession` is emphatic that for a
        // taking it never should, and this is what makes the house's later
        // claim a row rather than an inference.
        expect(after.ownerId).toBe(LOCAL_SECT.id);
        // AND THE THEFT IS ON THE RECORD whether or not anybody saw it.
        expect(after.provenance.length).toBe(before + 1);
        expect(after.provenance[after.provenance.length - 1].how).toBe('stolen');
        expect(after.provenance[after.provenance.length - 1].previousHolderId)
            .toBe(LOCAL_SECT.id);
    }, 300_000);

    it('refuses the counted tier, and names the real reason rather than another verb', async () => {
        const { harness } = await memberOfAHouseWithAShelf('theft-counted');
        const world = await harness.game.loadWorld();
        const mundane = world.objects
            .find((o: any) => o.possessorId === LOCAL_SECT.id && o.significance === 'mundane');
        if (!mundane) return; // nothing mundane on this house's books; nothing to assert

        const said = (await harness.game.act(
            `I take ${mundane.name} from the sect library without asking`
        )).narration ?? '';
        // The refusal names the true reason - copies, no single row - rather
        // than pointing at `siphon`, which takes stones and not books.
        expect(said.toLowerCase()).toContain('copies');
        const after = (await harness.game.loadWorld()).objects
            .find((o: any) => o.id === mundane.id)!;
        expect(after.possessorId).toBe(LOCAL_SECT.id);
    }, 300_000);

    it('lists what is there when nothing was named, and moves nothing', async () => {
        const { harness } = await memberOfAHouseWithAShelf('theft-read');
        const before = (await harness.game.loadWorld()).objects
            .filter((o: any) => o.possessorId === LOCAL_SECT.id).length;

        await harness.game.act('I steal something from the sect library');

        const after = (await harness.game.loadWorld()).objects
            .filter((o: any) => o.possessorId === LOCAL_SECT.id).length;
        expect(after).toBe(before);
    }, 300_000);
});

describe('notice decides the record, never the theft', () => {
    it('opens no record when nobody of the house is standing there', async () => {
        const { harness, cultivatorId } = await memberOfAHouseWithAShelf('theft-unseen');
        const world = await harness.game.loadWorld();
        const target = world.objects
            .find((o: any) => o.possessorId === LOCAL_SECT.id && o.significance !== 'mundane');
        if (!target) return;

        await harness.game.act(`I take ${target.name} from the sect library without asking`);

        // The object moved and the house holds nothing against them, which is
        // the case the ordering exists to make possible. Wired the other way
        // round this would be a theft that did not happen.
        const after = (await harness.game.loadWorld()).objects
            .find((o: any) => o.id === target.id)!;
        expect(after.possessorId).toBe(cultivatorId);

        const ledger = openLedgerBetween(harness.repos, cultivatorId, LOCAL_SECT.id)
            .filter(isYourOwnHouseHoldingIt);
        expect(ledger).toHaveLength(0);
    }, 300_000);
});
