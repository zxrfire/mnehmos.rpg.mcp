/**
 * Upholding a complaint used to cost the person it was about nothing.
 *
 * Both ends of this arc were built and the middle was not. A witness walks up
 * the hill (`reporting-what-you-saw.ts`), the house opens a row
 * (`false-decree-reports.ts`), the player who holds the punishment hall says
 * "I uphold the complaint against X" - and the row closed, the narration said
 * they were "answerable", and nothing was taken. A verdict with no sentence
 * behind it is the officeless-elder problem at the other end: standing with no
 * jurisdiction attached, only now it is jurisdiction with no consequence
 * attached.
 *
 * ── What decides it, and what deliberately does not ──────────────────────
 *
 * Three inputs, all of them already written down somewhere else: whether it can
 * be shown, how bad it was (`Severity` on the row, decided once at creation),
 * and what kind of house this is (`SectAlignment`). THERE IS NO TABLE OF
 * OFFENCES and these assertions would not survive one - they pin that the same
 * row gets a different sentence in a righteous house and a demonic one, which
 * is only true if the alignment is what moves it.
 *
 * The sentence is a position on one ordered ladder, and the fine is priced off
 * `duties.ts` - a fine is the errands it would take to work off, at this
 * person's rung. So the assertions read the figure out of `whatAFineComesTo`
 * rather than hard-coding it: a number typed into a test is a number the next
 * person cannot tell from a measurement.
 *
 * RED-CHECKED. Making `howFarThisHouseWillGo` return the same number for every
 * alignment fails the righteous-and-demonic pair; returning the complaint from
 * `handDownWhatTheRoomDecided` without moving contribution fails the fine.
 */

import { describe, it, expect } from 'vitest';
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { getMembersOf } from '../../src/data/cultivation/members';
import { complaintsBroughtTo } from '../../src/web/false-decree-reports';
import {
    A_FINE_WAS_PAID,
    A_REBUKE_ON_THE_RECORD,
    handDownWhatTheRoomDecided,
    whatAFineComesTo
} from '../../src/web/a-room-hands-down-what-it-decided';
import {
    SENTENCES_IN_ORDER,
    whatTheRoomDecides
} from '../../src/engine/social-leverage/what-a-room-decides-about-one-of-its-own';
import { createObligation } from '../../src/engine/social/grudges';
import { writeOneObligation, ledgerAbout } from '../../src/storage/repos/obligation.repo';
import { AGAINST_THEIR_OWN } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { whoseCallItIs } from '../../src/engine/social-leverage/what-an-elder-is-in-charge-of';
import { willNotBeMoved } from '../../src/data/cultivation/a-favour-skips-the-admission-bar';
import {
    A_RUNG_THAT_WAS_GIVEN,
    whatABoughtRungLeaves
} from '../../src/engine/social-leverage/a-rung-nobody-earned';

/**
 * The shallowest righteous house that recruits, read off the catalog. A
 * righteous house is chosen because it is the one whose ceiling makes the two
 * ordinary sentences - the rebuke and the fine - the ones that land, and those
 * are the two this arc carries out end to end.
 */
const HOUSE = SECTS
    .filter(sect => sect.recruits && sect.alignment === 'righteous')
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

const REPORTED = 'they gave an order in the house\'s name that was not theirs to give';

/** The room's own reading, with only the severity and the house varying. */
function brought(alignment: 'righteous' | 'neutral' | 'demonic' | null) {
    return {
        what: { does: 'reports' as const, toId: 'elder', line: REPORTED },
        theirsToPunish: true,
        alignment,
        houseId: HOUSE.id,
        theHouseGaveThemSomething: false
    };
}

/**
 * A player holding the room, and a member of the house with something to lose.
 *
 * Arranged rather than played to here - the sibling test
 * `reporting-a-false-decree.test.ts` already proves a complaint is reachable by
 * playing, and this one is about what happens after one is in front of you.
 */
async function aRoomAndSomebodyInFrontOfIt(seed: string, stones = 4000) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'hands-down-w' }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db.prepare('UPDATE cultivators SET realm_ordinal = 21 WHERE id = ?')
        .run(cultivator.id);
    harness.repos.sects.addMember(HOUSE.id, cultivator.id, HOUSE.ranks.length - 2);

    const other = getMembersOf(HOUSE.id).find(m => m.rankIndex === 0)
        ?? getMembersOf(HOUSE.id)[0];

    // A real row for the offender, so a fine has something to take. Copied off
    // the player's own so the spirit root and the attributes are legal ones the
    // game minted rather than shapes invented in a test.
    const me = harness.repos.cultivators.getById(cultivator.id)!;
    harness.repos.cultivators.create({
        ...me, id: other.id, name: other.name, kind: 'npc', spiritStones: stones
    });
    harness.repos.sects.addMember(HOUSE.id, other.id, 0);
    harness.repos.sects.addContribution(HOUSE.id, other.id, 2000);

    return { harness, playerId: cultivator.id, other };
}

function complain(harness: any, aboutId: string, severity: 'slight' | 'serious') {
    const row = createObligation({
        kind: 'grudge',
        holderId: HOUSE.id,
        subjectId: aboutId,
        cause: 'betrayal',
        severity,
        onDay: 0,
        description: `${REPORTED}. A witness took it to the room complaints go to.`,
        participants: [HOUSE.id],
        tags: [AGAINST_THEIR_OWN, 'house_does:questioned_about_the_source']
    });
    writeOneObligation(harness.db, row);
    return row;
}

// ─────────────────────────────────────────────────────────────────────────
// THE READING
// ─────────────────────────────────────────────────────────────────────────

describe('what the room decides', () => {
    it('writes nothing at all when nobody brought it', () => {
        for (const does of ['swallows_it', 'says_nothing_and_remembers', 'nowhere_to_take_it'] as const) {
            const said = whatTheRoomDecides({
                ...brought('righteous'),
                severity: 'unforgivable',
                what: { does, toId: null, line: 'x' }
            });
            // Not a lighter sentence. NO CASE - and the difference is the whole
            // reason the witness layer exists.
            expect([does, said.sentence]).toEqual([does, 'no case']);
        }
    });

    it('gives the same row a different sentence in a different kind of house', () => {
        const same = { severity: 'unforgivable' as const };
        const righteous = whatTheRoomDecides({ ...brought('righteous'), ...same }).sentence;
        const neutral = whatTheRoomDecides({ ...brought('neutral'), ...same }).sentence;
        const demonic = whatTheRoomDecides({ ...brought('demonic'), ...same }).sentence;

        // Ordered, and strictly - a demonic house goes further than a neutral
        // one and a neutral one further than a righteous one, for the identical
        // offence. That is what the alignment is for.
        const at = (s: string) => SENTENCES_IN_ORDER.indexOf(s as never);
        expect(at(righteous)).toBeLessThan(at(neutral));
        expect(at(neutral)).toBeLessThan(at(demonic));
    });

    it('never hands down a sentence it cannot carry out', () => {
        // Nothing was ever given, so taking it back is nothing happening. The
        // room does the rung below instead, which is the gift-and-loan split
        // doing real work rather than a sanction that quietly does not land.
        const grave = whatTheRoomDecides({ ...brought('neutral'), severity: 'serious' });
        expect(grave.sentence).not.toBe('what the house gave is taken back');

        const gave = whatTheRoomDecides({
            ...brought('neutral'), severity: 'serious', theHouseGaveThemSomething: true
        });
        expect(gave.sentence).toBe('what the house gave is taken back');
    });

    it('routes every sentence to something that exists', () => {
        for (const severity of ['slight', 'serious', 'grave', 'unforgivable'] as const) {
            for (const alignment of ['righteous', 'neutral', 'demonic'] as const) {
                const said = whatTheRoomDecides({ ...brought(alignment), severity });
                expect([severity, alignment, said.carriedOutBy.length > 0])
                    .toEqual([severity, alignment, true]);
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// SOMEBODY SPEAKING FOR THEM
// ─────────────────────────────────────────────────────────────────────────

describe('intercession', () => {
    /** The room, asked the way `whoseCallItIs` asks it, rather than invented. */
    const theRoom = whoseCallItIs({
        purpose: 'punishment_hall',
        portfolios: [{ purpose: 'punishment_hall', holderId: 'elder', depth: 3 }],
        roll: [{ id: 'elder', rankIndex: 3 }, { id: 'head', rankIndex: 5 }],
        rankCount: 6
    });

    it('moves it one rung, and only for the right kind of thing', () => {
        const at = (s: string) => SENTENCES_IN_ORDER.indexOf(s as never);
        const alone = whatTheRoomDecides({ ...brought('demonic'), severity: 'grave' });
        const spokenFor = whatTheRoomDecides({
            ...brought('demonic'), severity: 'grave',
            intercession: { room: theRoom, offered: 'a favour', wants: 'a favour' }
        });
        expect(spokenFor.word).toBe('it moved one rung');
        expect(at(spokenFor.sentence)).toBe(at(alone.sentence) - 1);
        // ONE RUNG, not the distance between what was wanted and what was put
        // up. A hold offered where a favour was wanted is a bigger thing and
        // still buys exactly one rung, or the sentence would be a price list.
        const heavier = whatTheRoomDecides({
            ...brought('demonic'), severity: 'grave',
            intercession: { room: theRoom, offered: 'a hold', wants: 'a favour' }
        });
        expect(at(heavier.sentence)).toBe(at(spokenFor.sentence));
    });

    it('does not move for the wrong kind of thing, whatever the amount', () => {
        const said = whatTheRoomDecides({
            ...brought('demonic'), severity: 'grave',
            intercession: { room: theRoom, offered: 'stones', wants: 'a service' }
        });
        expect(said.word).toBe('the wrong kind of thing');
        expect(said.sentence).toBe(said.beforeAnybodySpoke);
    });

    it('names the bodies no word reaches, rather than failing quietly', () => {
        // Read off the favour stance, not listed again here: a house whose
        // admission bar does not move for a favour is a house whose punishment
        // room does not either.
        const unreachable = willNotBeMoved()[0];
        expect(unreachable, 'the catalog names at least one').toBeTruthy();
        const said = whatTheRoomDecides({
            ...brought('demonic'),
            houseId: unreachable.factionId,
            severity: 'grave',
            intercession: { room: theRoom, offered: 'a favour', wants: 'a favour' }
        });
        expect(said.word).toBe('no word reaches this body');
        expect(said.sentence).toBe(said.beforeAnybodySpoke);
    });

    it('has nobody to speak to where nobody holds the room', () => {
        const empty = whoseCallItIs({
            purpose: 'punishment_hall',
            portfolios: [{ purpose: 'punishment_hall', holderId: null, depth: 3 }],
            roll: [],
            rankCount: 6
        });
        const said = whatTheRoomDecides({
            ...brought('demonic'), severity: 'grave',
            intercession: { room: empty, offered: 'a favour', wants: 'a favour' }
        });
        expect(said.word).toBe('nobody to speak to');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED, AS THE ROOM
// ─────────────────────────────────────────────────────────────────────────

describe('played, holding the room complaints go to', () => {
    it('hands down a fine, and the contribution and the stones actually move', async () => {
        const { harness, other } = await aRoomAndSomebodyInFrontOfIt('hands-down-fine');
        complain(harness, other.id, 'serious');
        expect(complaintsBroughtTo(harness.repos, HOUSE.id)).toHaveLength(1);

        const hadContribution = harness.repos.sects.getMembership(other.id)!.contribution;
        const hadStones = harness.repos.cultivators.getById(other.id)!.spiritStones;

        const said = (await harness.game.act(`I uphold the complaint against ${other.name}`))
            .narration ?? '';
        expect(said.toLowerCase()).toContain('uphold');

        // The complaint is closed, and something happened to somebody.
        expect(complaintsBroughtTo(harness.repos, HOUSE.id)).toHaveLength(0);
        const asked = whatAFineComesTo(
            harness.repos.cultivators.getById(other.id)!.realmOrdinal, 'serious'
        );
        expect(asked.contribution).toBeGreaterThan(0);
        expect(harness.repos.sects.getMembership(other.id)!.contribution)
            .toBe(hadContribution - asked.contribution);
        expect(harness.repos.cultivators.getById(other.id)!.spiritStones)
            .toBe(hadStones - asked.stones);

        const receipt = ledgerAbout(harness.db as never, other.id)
            .filter(row => (row.tags ?? []).includes(A_FINE_WAS_PAID));
        expect(receipt).toHaveLength(1);
    }, 300_000);

    it('hands down a rebuke, which is a row and nothing else', async () => {
        const { harness, other } = await aRoomAndSomebodyInFrontOfIt('hands-down-rebuke');
        complain(harness, other.id, 'slight');
        const hadContribution = harness.repos.sects.getMembership(other.id)!.contribution;
        const hadStones = harness.repos.cultivators.getById(other.id)!.spiritStones;

        await harness.game.act(`I uphold the complaint against ${other.name}`);

        // NOTHING WAS TAKEN, and the record is the sanction: it is open, the
        // house holds it, and everything that reads what a house holds about
        // its own will find it.
        expect(harness.repos.sects.getMembership(other.id)!.contribution).toBe(hadContribution);
        expect(harness.repos.cultivators.getById(other.id)!.spiritStones).toBe(hadStones);
        const rebuke = ledgerAbout(harness.db as never, other.id)
            .filter(row => (row.tags ?? []).includes(A_REBUKE_ON_THE_RECORD));
        expect(rebuke).toHaveLength(1);
        expect(rebuke[0].holderId).toBe(HOUSE.id);
        expect(rebuke[0].status).toBe('open');
    }, 300_000);

    it('judges a bought rung, which was already sitting in the ledger with nobody to bring it',
        async () => {
            // The first real offence this could be pointed at, and it needed no
            // wiring: `whatABoughtRungLeaves` already writes a row the house
            // HOLDS about the person who gave the rung, tagged
            // `a_rung_that_was_given` on top of `against_their_own`. So it is
            // already in `complaintsBroughtTo`, and the room reads its severity
            // like any other row - which is the whole argument for there being
            // no table of offences. Nothing here knows what a rung is.
            const { harness, other } = await aRoomAndSomebodyInFrontOfIt('hands-down-bought-rung');
            const left = whatABoughtRungLeaves({
                houseId: HOUSE.id,
                houseName: HOUSE.name,
                giverId: other.id,
                raisedId: 'somebody-raised',
                raisedName: 'Somebody',
                toRankTitle: HOUSE.ranks[1] ?? 'a rung',
                doing: 'questioned_about_the_source',
                onDay: 0,
                knownTo: [HOUSE.id]
            });
            expect(left.theGiverAnswersFor, 'the house opens one about the giver').not.toBeNull();
            writeOneObligation(harness.db, createObligation(left.theGiverAnswersFor!));

            const waiting = complaintsBroughtTo(harness.repos, HOUSE.id);
            expect(waiting).toHaveLength(1);
            expect(waiting[0].tags).toContain(A_RUNG_THAT_WAS_GIVEN);

            const hadStones = harness.repos.cultivators.getById(other.id)!.spiritStones;
            const said = (await harness.game.act(`I uphold the complaint against ${other.name}`))
                .narration ?? '';
            expect(said.toLowerCase()).toContain('uphold');
            expect(harness.repos.cultivators.getById(other.id)!.spiritStones)
                .toBeLessThan(hadStones);
            expect(complaintsBroughtTo(harness.repos, HOUSE.id)).toHaveLength(0);
        }, 300_000);

    it('takes nothing at all on a dismissal', async () => {
        const { harness, other } = await aRoomAndSomebodyInFrontOfIt('hands-down-dismissed');
        complain(harness, other.id, 'serious');
        const hadStones = harness.repos.cultivators.getById(other.id)!.spiritStones;

        await harness.game.act(`I dismiss the complaint against ${other.name}`);
        expect(complaintsBroughtTo(harness.repos, HOUSE.id)).toHaveLength(0);
        expect(harness.repos.cultivators.getById(other.id)!.spiritStones).toBe(hadStones);
    }, 300_000);
});

// ─────────────────────────────────────────────────────────────────────────
// THE FUNCTION, CALLED DIRECTLY
// ─────────────────────────────────────────────────────────────────────────

describe('handing it down', () => {
    /**
     * This once read "says which module carries out the ones it does not",
     * because five of the seven sentences were routed and none of them ran.
     * All seven are carried out now - `a-room-carries-out-more-than-a-fine.
     * test.ts` is where each one is proved - and what survives here is the
     * half that still matters: A SENTENCE THE STORE CANNOT CARRY SAYS SO. This
     * call gives no `byOrdinal`, so what a seal would hold cannot be read, and
     * the report is a refusal rather than a success nobody can find in a table.
     */
    it('never reports a sentence it did not carry out', async () => {
        const { harness, other } = await aRoomAndSomebodyInFrontOfIt('hands-down-routed');
        const complaint = complain(harness, other.id, 'serious');
        const handed = handDownWhatTheRoomDecided({
            repos: harness.repos,
            complaint,
            byId: 'somebody',
            offenderId: other.id,
            offenderName: other.name,
            offenderOrdinal: 10,
            houseId: HOUSE.id,
            houseName: HOUSE.name,
            onDay: 1,
            // A demonic reading of the same row, which reaches a sentence this
            // call has not given the handler enough to run.
            brought: brought('demonic')
        });
        expect(handed.notCarriedOutHere).not.toBeNull();
        expect(handed.contributionTaken).toBe(0);
        // AND THE COMPLAINT IS STILL SETTLED, because the room settled it. A
        // row left open after the room has read it is the state this whole arc
        // exists to leave behind.
        expect(handed.settled?.status).toBe('settled');
    }, 300_000);
});
