/**
 * Somebody walking up the hill with your name.
 *
 * `authority-for-an-order.ts` made a false decree deliver nothing and cost the
 * giver standing. Played, that was 3.36 standing for forging a mandate, and the
 * transcript ended with the servant working it out and going back to what they
 * were doing. The design owner's answer:
 *
 *   > or rat him out to the punishment elder
 *
 * Every piece existed - `whoAnswersAbout` for the door,
 * `ifCaughtAtSomethingTheHousePunishes` for what the house does,
 * `whatYourOwnHouseOpensAboutYou` for the row - and nothing joined them. And
 * nothing anywhere READ an `AGAINST_THEIR_OWN` row, so holding the punishment
 * hall was standing with no jurisdiction attached.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { getMembersOf } from '../../src/data/cultivation/members';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import {
    whatTheWitnessDoesAboutIt,
    whereAComplaintGoes
} from '../../src/engine/social-leverage/reporting-what-you-saw';
import {
    KEPT_TO_THEMSELVES,
    REPORTED_BY_A_WITNESS,
    complaintsBroughtTo,
    reportWhatTheySaw,
    settleAComplaint
} from '../../src/web/false-decree-reports';
import { isYourOwnHouseHoldingIt } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';

const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

const ROOMS = [
    { purpose: 'punishment_hall' as const, holderId: 'elder', depth: 3 },
    { purpose: 'treasury' as const, holderId: 'head', depth: 4 }
];

const PEER = {
    id: 'w', name: 'Weng Er', standing: null, role: 'peer' as const, grievance: null
};

/** Make one member of the house resent the player, on the ordinary table. */
function theyResentYou(harness: any, playerId: string, otherId: string) {
    harness.db.prepare(`INSERT OR REPLACE INTO relationships
        (id, from_character_id, to_character_id, type, label, strength, significance,
         attitude, roles, history, active, established_on_day, last_updated_on_day)
        VALUES (?, ?, ?, 'rival', '', -0.6, 'notable', 'resentment', '[]', '', 1, 0, 0)`)
        .run(`r-${playerId}-${otherId}`, playerId, otherId);
}

async function forgerAt(rankIndex: number, seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'report-w' }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db.prepare('UPDATE cultivators SET realm_ordinal = 21 WHERE id = ?')
        .run(cultivator.id);
    harness.repos.sects.addMember(LOCAL_SECT.id, cultivator.id, rankIndex);
    return { harness, id: cultivator.id };
}

function houseRows(harness: any) {
    return ledgerAbout(harness.db as never, LOCAL_SECT.id)
        .filter(row => row.status === 'open' && isYourOwnHouseHoldingIt(row));
}

// ─────────────────────────────────────────────────────────────────────────
// THE READING
// ─────────────────────────────────────────────────────────────────────────

describe('what that particular person does', () => {
    const base = { theyOweYou: 0, theyHoldAboutYou: 0, toId: 'elder', rungsAbove: 0 };

    it('takes it up the hill when they resent you', () => {
        // Any one of the three is a reason, and a tenth reason is another row
        // rather than another branch.
        for (const witness of [
            { ...PEER, standing: -0.4 },
            { ...PEER, role: 'rival' as const },
            { ...PEER, grievance: 'passed over for the same place' }
        ]) {
            expect(whatTheWitnessDoesAboutIt({ ...base, witness }).does).toBe('reports');
        }
    });

    it('swallows it when they owe you', () => {
        const said = whatTheWitnessDoesAboutIt({
            ...base, witness: { ...PEER, standing: -0.9 }, theyOweYou: 1
        });
        // Checked before the resentment on purpose: somebody who owes you and
        // dislikes you is somebody who owes you. A debt that never binds
        // anybody is a ledger with no reason to exist.
        expect(said.does).toBe('swallows_it');
    });

    it('says nothing and remembers when there is nothing either way', () => {
        expect(whatTheWitnessDoesAboutIt({ ...base, witness: PEER }).does)
            .toBe('says_nothing_and_remembers');
    });

    it('does not let fear silence somebody, because reporting avoids the fight', () => {
        // The obvious model has this backwards. Being frightened of somebody is
        // a reason not to CONFRONT them, and taking it to somebody bigger is
        // precisely the route that avoids confrontation. A large rung buys
        // advantage and never exemption.
        const terrified = whatTheWitnessDoesAboutIt({
            ...base, witness: { ...PEER, standing: -0.4 }, rungsAbove: 25
        });
        expect(terrified.does).toBe('reports');
    });

    it('has nowhere to take it when the room is the offender\'s own', () => {
        expect(whereAComplaintGoes({ portfolios: ROOMS, aboutId: 'elder', headId: 'head' }))
            .toBe('head');
        // Nobody is brought a complaint about themselves, and with no head
        // above them it goes nowhere - which is what being the most senior
        // person in a small house buys.
        expect(whereAComplaintGoes({ portfolios: ROOMS, aboutId: 'elder', headId: 'elder' }))
            .toBeNull();
        expect(whatTheWitnessDoesAboutIt({
            ...base, witness: { ...PEER, standing: -0.9 }, toId: null
        }).does).toBe('nowhere_to_take_it');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED, AS THE FORGER
// ─────────────────────────────────────────────────────────────────────────

describe('played, as the forger', () => {
    it('is reported by somebody who resents him, and the house opens a row', async () => {
        const { harness, id } = await forgerAt(1, 'report-told');
        const onTheRung = getMembersOf(LOCAL_SECT.id).filter(m => m.rankIndex === 0);
        expect(onTheRung.length, 'a named witness on the ordered rung').toBeGreaterThan(0);
        theyResentYou(harness, id, onTheRung[0].id);

        expect(houseRows(harness)).toHaveLength(0);
        const said = (await harness.game.act(
            'By order of the Sect, the disciples are to gather herbs'
        )).narration ?? '';

        expect(said).toContain('walk up the hill');
        const rows = houseRows(harness);
        expect(rows).toHaveLength(1);
        expect(rows[0].holderId).toBe(LOCAL_SECT.id);
        expect(rows[0].subjectId).toBe(id);
        expect(rows[0].tags).toContain(REPORTED_BY_A_WITNESS);
    }, 300_000);

    it('is not reported by somebody with nothing against him, and it is still remembered',
        async () => {
            const { harness, id } = await forgerAt(1, 'report-quiet');
            await harness.game.act('By order of the Sect, the disciples are to gather herbs');

            // THE HOUSE WAS NEVER TOLD, so the house holds nothing.
            expect(houseRows(harness)).toHaveLength(0);

            // AND THE WITNESS DID NOT FORGET. "says nothing and remembers" - the
            // remembering is a row rather than a mood, held by them, and a lever
            // for as long as it stays open.
            const kept = ledgerAbout(harness.db as never, id)
                .filter(row => (row.tags ?? []).includes(KEPT_TO_THEMSELVES));
            expect(kept).toHaveLength(1);
            expect(kept[0].subjectId).toBe(id);
            expect(kept[0].holderId).not.toBe(LOCAL_SECT.id);
        }, 300_000);

    it('opens nothing at all when the order was a legitimate one', async () => {
        const { harness, id } = await forgerAt(1, 'report-clean');
        const onTheRung = getMembersOf(LOCAL_SECT.id).filter(m => m.rankIndex === 0);
        if (onTheRung[0]) theyResentYou(harness, id, onTheRung[0].id);

        // A personal order claims nothing, so there is nothing to have been
        // false about it however much the witness dislikes them.
        await harness.game.act('I order the disciples to gather herbs');
        expect(houseRows(harness)).toHaveLength(0);
    }, 300_000);
});

// ─────────────────────────────────────────────────────────────────────────
// PLAYED, AS THE ELDER
// ─────────────────────────────────────────────────────────────────────────

describe('played, as the room it goes to', () => {
    it('routes the sentences', () => {
        expect(parseIntent('what has been brought to me').intent).toBe('complaints');
        const upheld = parseIntent('I uphold the complaint against Wen Shu');
        expect(upheld.intent).toBe('complaints');
        expect(upheld.topic).toBe('upheld');
        expect(upheld.target).toBe('Wen Shu');
        expect(parseIntent('I dismiss the complaint against Wen Shu').topic).toBe('dismissed');
    });

    it('refuses somebody who holds the rank but not the room', async () => {
        const { harness } = await forgerAt(1, 'report-norank');
        const said = (await harness.game.act('what has been brought to me')).narration ?? '';
        // Gated on the portfolio and never on the rank, and the refusal names
        // the thing they would have to go and get - the room, not the rank.
        expect(said.toLowerCase()).toContain('holds it');
        expect(said.toLowerCase()).toContain('the room, not the rank');
    }, 300_000);

    it('shows a member their own row and will not let them close it', async () => {
        const { harness, id } = await forgerAt(1, 'report-self');
        const onTheRung = getMembersOf(LOCAL_SECT.id).filter(m => m.rankIndex === 0);
        theyResentYou(harness, id, onTheRung[0].id);
        await harness.game.act('By order of the Sect, the disciples are to gather herbs');
        expect(houseRows(harness)).toHaveLength(1);

        harness.repos.sects.setRank(LOCAL_SECT.id, id, LOCAL_SECT.ranks.length - 2);

        const listed = (await harness.game.act('what has been brought to me')).narration ?? '';
        // Shown, because a player must be able to see what the house holds
        // about them...
        expect(listed).toContain('Wen Shu');
        expect(listed.toLowerCase()).toContain('not yours to decide');

        // ...and not decidable, because holding the room is not a way of
        // closing your own record. The same rule `whereAComplaintGoes` applies
        // at the routing end, applied at the deciding end.
        const tried = (await harness.game.act('I dismiss the complaint against Wen Shu'))
            .narration ?? '';
        expect(tried.toLowerCase()).toContain('over your head');
        expect(houseRows(harness)).toHaveLength(1);
    }, 300_000);

    it('decides one that is about somebody else', async () => {
        const { harness, id } = await forgerAt(LOCAL_SECT.ranks.length - 2, 'report-judge');
        const roster = getMembersOf(LOCAL_SECT.id);
        const other = roster.find(m => m.rankIndex === 0)!;
        const witness = roster.find(m => m.id !== other.id) ?? other;

        // A row about somebody who is NOT the player. Nothing in the world
        // simulation forges a mandate yet, so this drives the same handler with
        // an NPC as the offender - which is the whole point of it not being
        // written against a player id.
        reportWhatTheySaw({
            repos: harness.repos,
            offenderId: other.id,
            offenderName: other.name,
            offenderOrdinal: 10,
            houseId: LOCAL_SECT.id,
            houseName: LOCAL_SECT.name,
            alignment: 'neutral',
            portfolios: [{ purpose: 'punishment_hall', holderId: id, depth: 3 }],
            headId: null,
            witness: {
                id: witness.id, name: witness.name, rankIndex: 0, realmOrdinal: 8,
                role: 'rival', standing: { type: 'rival', strength: -0.5, times: 1 }
            },
            onDay: 0,
            what: `${other.name} gave an order in the house's name.`
        });
        expect(complaintsBroughtTo(harness.repos, LOCAL_SECT.id)).toHaveLength(1);

        const said = (await harness.game.act(`I uphold the complaint against ${other.name}`))
            .narration ?? '';
        expect(said.toLowerCase()).toContain('uphold');
        // The row is closed and it says who closed it - the office exercised
        // rather than held.
        expect(complaintsBroughtTo(harness.repos, LOCAL_SECT.id)).toHaveLength(0);
    }, 300_000);

    it('settles through the ledger\'s own resolutions rather than new words', async () => {
        const { harness, id } = await forgerAt(LOCAL_SECT.ranks.length - 2, 'report-verdicts');
        const other = getMembersOf(LOCAL_SECT.id).find(m => m.rankIndex === 0)!;
        const made = reportWhatTheySaw({
            repos: harness.repos,
            offenderId: other.id, offenderName: other.name, offenderOrdinal: 10,
            houseId: LOCAL_SECT.id, houseName: LOCAL_SECT.name, alignment: 'neutral',
            portfolios: [{ purpose: 'punishment_hall', holderId: id, depth: 3 }],
            headId: null,
            witness: {
                id: 'x', name: 'X', rankIndex: 0, realmOrdinal: 8,
                role: 'rival', standing: { type: 'rival', strength: -0.5, times: 1 }
            },
            onDay: 0, what: 'A false decree.'
        });
        expect(made.record).not.toBeNull();

        const upheld = settleAComplaint(harness.repos, made.record!, {
            verdict: 'upheld', byId: id, onDay: 1, note: 'n'
        });
        expect(upheld.settlement?.resolution).toBe('avenged');

        const dismissed = settleAComplaint(harness.repos, made.record!, {
            verdict: 'dismissed', byId: id, onDay: 1, note: 'n'
        });
        expect(dismissed.settlement?.resolution).toBe('proven_false');
    }, 300_000);
});
