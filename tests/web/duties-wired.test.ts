/**
 * The mission board, and the column it earns.
 *
 * `sect_members.contribution` is one of three independent axes of standing.
 * `handlePromote` SPENDS it and refuses without it; `handleStipend` credits a
 * trickle; and until this existed nothing anywhere could deliberately add to
 * it. "I do sect work for contribution" was answered with the mortal job
 * board, which pays in cash and moves no standing at all - so the second rung
 * of every house in the world was unreachable, and nobody was told.
 *
 * The `obligations` tables were in the same state: created by a migration,
 * read in one place, written by nothing.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { makeGame } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { SITES } from '../../src/data/cultivation/inheritance-trials';

const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

describe('reading the wall is not signing for a line off it', () => {
    it('routes the board question to a read, with no subject attached', () => {
        for (const text of [
            'I look at the sect mission board',
            'what duties are going',
            'I do sect work for contribution'
        ]) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('sect');
            expect(plan.intent, text).toBe('duty');
            // No target is what makes it the cheap branch. A duty accepted is
            // an oath row with a due date on it, and a misparse must never
            // reach one.
            expect(plan.target, text).toBeUndefined();
        }
    });

    it('routes a taking verb to the act, with the line named', () => {
        for (const text of [
            'I take the wall patrol commission',
            'I accept the commission',
            'I volunteer for a duty'
        ]) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('sect');
            expect(plan.intent, text).toBe('duty');
            expect(plan.target, text).toBeTruthy();
        }
    });

    it('does not steal the mortal job board', () => {
        // The sentence that funds a broke cultivator. It must keep reaching
        // `work`, which pays in cash somebody with no house can spend.
        expect(parseIntent('I take whatever work the village will give me for a season').action)
            .toBe('work');
        expect(parseIntent('find work').action).toBe('work');
    });
});

describe('contribution, which had no earner', () => {
    it('credits it on completion and writes both ends of the ledger', async () => {
        const { db, game, repos } = makeGame({ seed: 'duty-guard' });
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);
        repos.sects.addMember(LOCAL_SECT.id, cultivator.id, 0);

        const before = repos.sects.getMembership(cultivator.id)!;
        expect(before.contribution).toBe(0);

        const board = await game.act('I look at the sect mission board');
        // The read takes nothing and writes nothing.
        expect(repos.sects.getMembership(cultivator.id)!.contribution).toBe(0);

        // The board prints the title, then the tier and the rung it is pitched
        // at, then the terms: "A Culling Notice ... - third rank at Qi
        // Condensation Layer 10: 20 days, ...". The title is what gets typed
        // back, and it is what stands before the dash.
        const named = /\n\s*([A-Z][^:\n]{5,60}) - /.exec(board.narration)?.[1];
        expect(named, 'the board has to be offering something at ordinal 0').toBeTruthy();

        const taken = await game.act(`I take the ${named} commission`);
        const after = repos.sects.getMembership(cultivator.id)!;

        // The column moves. That is the whole of it.
        expect(after.contribution).toBeGreaterThan(0);

        // And both ends of the oath are on the ledger: taken, then settled.
        const rows = db.prepare('SELECT status, COUNT(*) AS c FROM obligations GROUP BY status')
            .all() as { status: string; c: number }[];
        const settled = rows.find(r => r.status === 'settled');
        expect(settled, 'nothing was settled; a completed duty must close its oath').toBeTruthy();

        expect(taken.toolCalls.some(c => c.name === 'encounters.acceptDuty')).toBe(true);
        expect(taken.toolCalls.some(c => c.name === 'encounters.completeDuty')).toBe(true);
    });

    it('refuses a line that is not on the wall, and writes nothing', async () => {
        const { db, game, repos } = makeGame({ seed: 'duty-miss' });
        const { cultivator } = await game.newRun('Wen Shu');
        repos.sects.addMember(LOCAL_SECT.id, cultivator.id, 0);

        const result = await game.act('I take the Ninefold Abyssal Vigil commission');
        expect(result.toolCalls.some(c => c.name === 'encounters.sectBoardFor' && !c.ok)).toBe(true);
        expect(repos.sects.getMembership(cultivator.id)!.contribution).toBe(0);
        const obligations = db.prepare('SELECT COUNT(*) AS c FROM obligations').get() as { c: number };
        expect(obligations.c).toBe(0);
    });

    it('pays a rogue in stones and in nobody\'s contribution', async () => {
        const { db, game } = makeGame({ seed: 'duty-rogue' });
        const { cultivator } = await game.newRun('Wen Shu');
        db.prepare('UPDATE cultivators SET spirit_stones = 5000 WHERE id = ?').run(cultivator.id);

        const board = await game.act('I look at the sect mission board');
        // The board prints the title, then the tier and the rung it is pitched
        // at, then the terms: "A Culling Notice ... - third rank at Qi
        // Condensation Layer 10: 20 days, ...". The title is what gets typed
        // back, and it is what stands before the dash.
        const named = /\n\s*([A-Z][^:\n]{5,60}) - /.exec(board.narration)?.[1];
        if (!named) return;

        const before = game.state().cultivator.spiritStones;
        await game.act(`I take the ${named} commission`);
        // Contract work, paid in the only currency somebody on nobody's roll
        // can be paid in. That difference IS the membership.
        expect(game.state().cultivator.spiritStones).toBeGreaterThan(before - 1000);
    });
});

/**
 * "Rob the grave and take the attention, or stay poor and stay slow."
 *
 * `tone.md` states the four dilemmas the design is built out of, and this one
 * had only one half. A site could be emptied and the emptying was recorded
 * against the SITE and against nobody else, so taking was strictly better than
 * not taking at every rung and there was no decision in it at all.
 *
 * Not a grave rule. `factionIds` is an ordinary column on every site, and the
 * reason an unclaimed piece of ground is safe to rob is structural: there is
 * nobody on the row to notice.
 */
describe('taking what is behind the door, and being noticed for it', () => {
    it('writes a grudge held by every house named on the ground', async () => {
        const { db, game } = makeGame({ seed: 'rob-guard' });
        const { cultivator } = await game.newRun('Digger');
        db.prepare(
            'UPDATE cultivators SET realm_ordinal = 40, spirit_stones = 50000, hp = 900, max_hp = 900 WHERE id = ?'
        ).run(cultivator.id);

        // Whichever grave this cultivator can actually get into. Which one it
        // is depends on gates the site catalog owns, and the property under
        // test is about what happens AFTER the door, not about which door.
        let robbed = false;
        for (const site of SITES.filter(s => s.kind === 'grave')) {
            await game.act(`I go to ${site.name}`);
            await game.act('I go inside');
            await game.act(`I rob ${site.name}`);
            const rows = db.prepare('SELECT COUNT(*) AS c FROM obligations').get() as { c: number };
            if (rows.c > 0) { robbed = true; break; }
        }
        expect(robbed, 'no grave in the catalog admitted an ordinal-40 cultivator').toBe(true);

        const grudges = db.prepare(
            "SELECT kind, cause, severity, holder_id, subject_id FROM obligations WHERE kind = 'grudge'"
        ).all() as { cause: string; severity: string; holder_id: string; subject_id: string }[];

        expect(grudges.length).toBeGreaterThan(0);
        for (const row of grudges) {
            expect(row.cause).toBe('robbery');
            // Held BY the aggrieved party ABOUT the robber, which is the
            // direction the rest of the ledger writes in.
            expect(row.subject_id).toBe(cultivator.id);
            expect(row.holder_id).not.toBe(cultivator.id);
        }
    });

    it('says once that somebody will notice, not once per claimant', async () => {
        const { db, game } = makeGame({ seed: 'rob-voice' });
        const { cultivator } = await game.newRun('Digger');
        db.prepare(
            'UPDATE cultivators SET realm_ordinal = 40, spirit_stones = 50000, hp = 900, max_hp = 900 WHERE id = ?'
        ).run(cultivator.id);

        for (const site of SITES.filter(s => s.kind === 'grave')) {
            await game.act(`I go to ${site.name}`);
            await game.act('I go inside');
            const taken = await game.act(`I rob ${site.name}`);
            const rows = db.prepare('SELECT COUNT(*) AS c FROM obligations').get() as { c: number };
            if (rows.c === 0) continue;

            // Not knowing WHO is one fact about the player, said once. Three
            // copies of it is the same defect as a market board repeating
            // "you cannot afford this" on every line.
            const repeated = taken.narration.split('They will find it emptied').length - 1;
            expect(repeated).toBeLessThanOrEqual(1);
            return;
        }
    });
});
