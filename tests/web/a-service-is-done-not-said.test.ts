/**
 * The service rung, from the sentence a player types to the ledger it lands in.
 *
 * `what-they-will-take-instead-of-money.ts` names five media and the fourth had
 * nothing behind it. Measured before this work: the one changed beast reachable
 * everywhere in the world wants a service 93% of the time, and the refusal it
 * produced said only what the medium was - "something done, by you, that they
 * cannot do themselves" - with no verb anywhere that could do one and nothing
 * that would have noticed if a player had.
 *
 * Three things are pinned here, and they are the three the rung was missing:
 *
 *   THE ROAD    a sentence reaches the verb. Two of them, because the act has
 *               two steps and the ledger decides which one a sentence is.
 *   THE WRITE   the row goes into the obligations table and comes back out of
 *               it as a service, through the same repo every other account uses.
 *   THE READ    the ask reads it. `howTheAskForAPieceWent` puts the offer one
 *               rung higher when a term has been served, which is what turns
 *               the commonest refusal in the game into a grant.
 *
 * Red-checked, three ways: dropping `serve` from `OATH_INTENTS` and its branch
 * from the pattern table fails the routing block; making
 * `servicesYouHaveDoneFor` accept open rows fails "a word given buys nothing";
 * dropping `youDidThemAService` from the ask fails the ladder block.
 */

import { describe, it, expect } from 'vitest';

import { makeDb, makeGameInWorld } from './harness';
import { parseIntent } from '../../src/web/actions';
import {
    aServiceSpentOn,
    isAService,
    servicesYouHaveDoneFor,
    theServiceYouGaveYourWordOn,
    theServiceYouWouldSpend,
    undertakingAService
} from '../../src/engine/social-leverage/a-service-is-something-done';
import { createObligation, settleObligation } from '../../src/engine/social/grudges';
import {
    ledgerAbout,
    writeOneObligation,
    type ObligationDb,
    type ObligationWriteDb
} from '../../src/storage/repos/obligation.repo';
import { howTheAskForAPieceWent } from '../../src/web/asking-something-that-can-refuse-for-a-piece-of-it';
import { BEASTS } from '../../src/data/cultivation/beasts';
import { readsAsSomebody } from '../../src/engine/world/hunting-a-spirit-beast';
import { whatItCouldPartWith } from '../../src/engine/world/what-it-costs-to-give-away-a-piece-of-yourself';

// ── THE ROAD ─────────────────────────────────────────────────────────────

describe('a sentence reaches the service rung', () => {
    /**
     * Both steps are the same intent on purpose. Which one a sentence is, is a
     * fact about the ledger - is there already an open term between these two -
     * and not a fact about the words, so the parser does not have to tell a
     * promise from its discharge.
     */
    it.each([
        'i do him a service',
        'i do a service for the old man',
        'i serve out my term',
        'i will do the service'
    ])('"%s" is the service verb', said => {
        const plan = parseIntent(said);
        expect(plan.action).toBe('oath');
        expect(plan.intent).toBe('serve');
    });

    it('reads who it is for off the sentence, with the work trimmed off', () => {
        expect(parseIntent('i do a service for the old man').target).toBe('old man');
    });

    /**
     * A QUESTION IS STILL A QUESTION. The branch sits above the ledger read and
     * above `AN_OATH`, which already claims `term of service`, so a sentence
     * that opens as a question has to be left to the read or asking what you
     * are under would spend a season.
     */
    it('does not turn a question about a term into a term being served', () => {
        const asked = parseIntent('what is my term of service');
        expect(asked.intent).not.toBe('serve');
    });

    /**
     * A FAVOUR IS THE RUNG BELOW AND IS NOT THIS. Deliberate: a favour is a
     * standing account and a service is work, and a sentence that meant either
     * would make the two rungs one.
     */
    it('does not claim a sentence about doing somebody a favour', () => {
        expect(parseIntent('i do him a favour').intent).not.toBe('serve');
    });
});

// ── THE WRITE ────────────────────────────────────────────────────────────

describe('the ledger holds that you did it', () => {
    const openTerm = (db: ReturnType<typeof makeDb>, onDay = 100) => {
        const row = createObligation(undertakingAService({
            doerId: 'cultivator-1',
            forWhomId: 'npc-7',
            forWhomName: 'the one on the ledge',
            what: 'Clear whatever is in the upper gorge.',
            ask: 'a_real_favour',
            onDay
        }));
        writeOneObligation(db as unknown as ObligationWriteDb, row);
        return row;
    };

    it('round-trips through the obligations table as a service', () => {
        const db = makeDb();
        const row = openTerm(db);

        const back = ledgerAbout(db as unknown as ObligationDb, 'cultivator-1');
        expect(back).toHaveLength(1);
        expect(back[0].id).toBe(row.id);
        expect(isAService(back[0])).toBe(true);
        expect(back[0].terms).toContain('upper gorge');
    });

    /**
     * THE DEFECT THIS WHOLE MECHANIC EXISTS AGAINST: a sentence that put the
     * player on the second-highest rung of the ladder with nothing spent.
     */
    it('a word given buys nothing until the days are served', () => {
        const db = makeDb();
        openTerm(db);

        const ledger = ledgerAbout(db as unknown as ObligationDb, 'cultivator-1');
        expect(theServiceYouGaveYourWordOn(ledger, 'cultivator-1', 'npc-7')).not.toBeNull();
        expect(servicesYouHaveDoneFor(ledger, 'cultivator-1', 'npc-7')).toHaveLength(0);
    });

    /**
     * SETTLING IT SETTLES THE ROW THAT WAS OPENED, and the id is what makes
     * that true: `createObligation` derives one from the pair, the cause and
     * the day, so a settlement written on a different day would be a SECOND row
     * and the open one would stand for ever. That defect has been shipped once
     * already, on the duty path, and the ledger read is the screen the whole
     * social engine is read through.
     */
    it('serving it settles the same row rather than opening a second', () => {
        const db = makeDb();
        const row = openTerm(db);

        writeOneObligation(db as unknown as ObligationWriteDb, settleObligation(row, {
            resolution: 'oath_fulfilled',
            onDay: 133,
            byId: 'cultivator-1',
            note: 'Served out.'
        }));

        const ledger = ledgerAbout(db as unknown as ObligationDb, 'cultivator-1');
        expect(ledger).toHaveLength(1);
        expect(ledger[0].status).toBe('settled');
        expect(servicesYouHaveDoneFor(ledger, 'cultivator-1', 'npc-7')).toHaveLength(1);
    });

    it('a spent term stays in the record and stops being standing', () => {
        const db = makeDb();
        const row = openTerm(db);
        const done = settleObligation(row, {
            resolution: 'oath_fulfilled',
            onDay: 133,
            byId: 'cultivator-1',
            note: 'Served out.'
        });
        writeOneObligation(db as unknown as ObligationWriteDb, aServiceSpentOn(done, 'a core'));

        const ledger = ledgerAbout(db as unknown as ObligationDb, 'cultivator-1');
        expect(ledger).toHaveLength(1);
        expect(ledger[0].status).toBe('settled');
        expect(theServiceYouWouldSpend(ledger, 'cultivator-1', 'npc-7')).toBeNull();
    });
});

// ── AND THE WHOLE OF IT, PLAYED ──────────────────────────────────────────

/**
 * The two steps as a player reaches them, in one pinned world.
 *
 * A precondition arranged by hand proves the mechanic and not the road, so this
 * is the sibling that reaches the same state by PLAYING - which is the thing
 * this repo has shipped content without three times over.
 */
describe('a service, played', () => {
    const rows = (db: ReturnType<typeof makeDb>) => db
        .prepare('SELECT kind, cause, status, terms, settlement_resolution FROM obligations')
        .all() as { kind: string; cause: string; status: string; terms: string | null;
            settlement_resolution: string | null }[];

    const day = (db: ReturnType<typeof makeDb>) =>
        (db.prepare('SELECT elapsed_days FROM runs').get() as { elapsed_days: number }).elapsed_days;

    it('opens a term, spends nothing, then serves it out', async () => {
        const { game, db } = await makeGameInWorld({ worldSeed: 'the-service-road' });
        await game.newRun('Road Finder');
        // Whoever is standing here. Not named: which people a world puts at the
        // ford is the world's business, and a test naming one pins the seeding
        // rather than the verb.
        await game.act('who is standing here');
        const before = day(db);

        const given = await game.act('i do him a service');
        expect(given.narration).toMatch(/discharged by the days being served/i);
        // A WORD COSTS NOTHING TO GIVE. The days are the whole of what a
        // service is, so spending them at the promise would make it a favour.
        expect(day(db)).toBe(before);

        const open = rows(db);
        expect(open).toHaveLength(1);
        expect(open[0].kind).toBe('oath');
        expect(open[0].cause).toBe('service_term');
        expect(open[0].status).toBe('open');
        expect(open[0].terms).toMatch(/\d+ days\./);

        const served = await game.act('i do him a service');
        expect(served.narration).toMatch(/the term is served/i);
        expect(day(db)).toBeGreaterThan(before);

        // ONE ROW, SETTLED. A settlement written against a different day would
        // derive a different id and leave the open one standing for ever, which
        // is a defect this repo has already shipped once on the duty path.
        const after = rows(db);
        expect(after).toHaveLength(1);
        expect(after[0].status).toBe('settled');
        expect(after[0].settlement_resolution).toBe('oath_fulfilled');
    }, 180_000);
});

// ── THE READ ─────────────────────────────────────────────────────────────

describe('the one that wants a service can see that one was done', () => {
    /**
     * The counterparty is whatever speaks and stands on the service rung. Read
     * out of the catalog rather than named, because which species that is is
     * the catalog's business and a test naming one would go red the next time
     * somebody edits a row.
     */
    const speaking = BEASTS.filter(b =>
        readsAsSomebody(b) && b.veinRelation === 'indifferent');

    it('there is something in the world that wants one', () => {
        expect(speaking.length).toBeGreaterThan(0);
    });

    const ask = (youDidThemAService: boolean) => {
        const beast = speaking[0];
        return howTheAskForAPieceWent({
            beast,
            piece: whatItCouldPartWith(beast)[0],
            partyId: `npc-${beast.id}-a-gorge`,
            sentence: 'offered_something_instead',
            putDown: { stones: null, goods: null },
            theyOweYou: false,
            youDidThemAService,
            purse: 0,
            turn: 1,
            onDay: 400,
            seenBy: []
        });
    };

    /**
     * THE GAP, AS AN ASSERTION. Nothing in the pouch is the right kind of thing
     * for somebody on this rung, and before the service existed there was no
     * state a player could reach that was.
     */
    it('refuses an empty hand and names the road rather than only the rung', () => {
        const went = ask(false);
        expect(went.wants).toBe('a service');
        expect(went.granted).toBe(false);
        expect(went.lines.join(' ')).toMatch(/go and serve the term out/i);
    });

    it('takes a term that was served', () => {
        const went = ask(true);
        expect(went.offered).toBe('a service');
        expect(went.granted).toBe(true);
    });

    /**
     * A SERVICE OUTRANKS A FAVOUR, which is the ladder's own order. Asserted
     * because the two are read off the same ledger in the same place and
     * collapsing them would lose the rung this whole mechanic is for.
     */
    it('reads a service as a higher offer than a favour', () => {
        const beast = speaking[0];
        const both = howTheAskForAPieceWent({
            beast,
            piece: whatItCouldPartWith(beast)[0],
            partyId: `npc-${beast.id}-a-gorge`,
            sentence: 'offered_something_instead',
            putDown: { stones: null, goods: null },
            theyOweYou: true,
            youDidThemAService: true,
            purse: 0,
            turn: 1,
            onDay: 400,
            seenBy: []
        });
        expect(both.offered).toBe('a service');
    });
});
