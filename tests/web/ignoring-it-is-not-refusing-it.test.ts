/**
 * SAYING NOTHING IS NOT SAYING NO.
 *
 * Measured on the trope corpus against a live narrator, in the scenario named
 * for it - the house sends for you, and the next thing typed was:
 *
 *     I ignore it        -> shrug
 *
 * The commonest answer anybody gives a summons in this genre, and there was no
 * verb for it. The player had been told the house had sent, and the engine
 * could only offer them a decision they had not made.
 *
 * ── WHY IT IS ITS OWN INTENT AND NOT A PHRASING OF `refuse` ──────────────
 *
 * Because they cost different things at different times, and folding them
 * together would charge somebody for a decision they never made.
 *
 *   REFUSING is a decision. You answer, the standing is spent today, and
 *   `refuseDuty` writes `'refused'` - *Declined when asked.*
 *
 *   IGNORING is the absence of one, and the calendar decides what it costs.
 *   In time it costs NOTHING: the ask stays standing until its due day, which
 *   is what a due day is for. Overdue, the lapse lands, and the ledger already
 *   keeps the difference - *The term ran out on day N with nothing done.*
 *
 * `refuseDuty` has taken `'lapsed'` since it was written and the distinction
 * was already argued in the engine: *one of them is a decision and the other
 * is what happens to somebody who made none.* Nothing here is a new mechanic.
 * What was missing was a sentence that reaches the second one on purpose.
 *
 * ── AND A PRONOUN IS SAFE HERE FOR A STRUCTURAL REASON ───────────────────
 *
 * `pending-summons.ts` allows exactly ONE standing ask at a time, deliberately
 * - *a player holding four unanswered summonses is a chore list rather than a
 * decision* - so bare `it` has one referent and cannot be pointed at the wrong
 * thing. Where nothing is standing at all the verb says so and writes nothing.
 *
 * What it must never take is a PERSON. Ignoring somebody standing in front of
 * you is a different act with a different subject, and `I ignore him` reached
 * this row before the pronouns were cut out of it.
 */

import { describe, expect, it } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { SECTS } from '../../src/data/cultivation/index';
import { summonsPool } from '../../src/engine/encounters/duties';
import { dutyFromOffer, membershipFor } from '../../src/web/encounters';
import { readPendingSummons, rememberSummons } from '../../src/web/pending-summons';
import { makeGame, makeGameInWorld } from './harness';

function said(result: unknown): string {
    return String((result as { narration?: string }).narration ?? '');
}

/** The same house `refusing-a-summons.test.ts` uses, picked the same way. */
const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal
        || (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

/**
 * A real ask in front of a real member, drawn the way the world draws one.
 *
 * `summonsPool` and `dutyFromOffer` are the world's own two functions, so
 * nothing here is a hand-written duty shaped to make a test pass. Only the ROLL
 * is bypassed - a per-turn event of a few percent is not something to assert an
 * outcome through. Lifted from `refusing-a-summons.test.ts`, which stages the
 * same thing for the opposite verb.
 */
function standAnAskInFrontOfThem(harness: any, cultivatorId: string, onDay = 0) {
    const { repos, knowledge } = harness;
    const cultivator = repos.cultivators.getById(cultivatorId)!;
    const membership = membershipFor({ repos, knowledge, world: null } as any, cultivator);
    const pool = summonsPool(cultivator.realmOrdinal, membership);
    if (pool.length === 0) return null;
    const candidate = pool[0];
    const duty = dutyFromOffer(candidate, membership, onDay);
    const pending = {
        duty,
        entryId: candidate.entry.id,
        what: `${candidate.entry.name}, put to them by name.`,
        spokenOnDay: onDay
    };
    rememberSummons(repos, cultivatorId, pending);
    return pending;
}

async function aMemberWithAnAskStanding(seed: string) {
    const harness = makeGame({ seed }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
        .run(8, cultivator.id);
    harness.repos.sects.addMember(LOCAL_SECT.id, cultivator.id, 0);
    const pending = standAnAskInFrontOfThem(harness, cultivator.id);
    expect(pending, 'no summons could be drawn for this member').toBeTruthy();
    return { harness, id: cultivator.id as string, pending: pending! };
}

describe('the sentence', () => {
    it('reaches a verb, in the ways people say it', () => {
        for (const sentence of [
            'I ignore it',
            'I ignore the summons',
            'I ignore the call',
            'I do nothing about it',
            'I let it lie',
            'I ignore what the house wants'
        ]) {
            const parsed = parseIntent(sentence);
            expect(parsed.action, sentence).toBe('sect');
            expect(parsed.intent, sentence).toBe('ignore');
        }
    });

    /**
     * AND IT IS NOT THE REFUSAL VERB. The two are different acts and the table
     * has to keep them apart, or the intent is decorative.
     */
    it('is not refusing, and refusing is not it', () => {
        expect(parseIntent('I refuse').intent).toBe('refuse');
        expect(parseIntent('I refuse the summons').intent).toBe('refuse');
        expect(parseIntent('I turn them down').intent).toBe('refuse');
        expect(parseIntent('I ignore it').intent).not.toBe('refuse');
    });

    /**
     * A THING AND NEVER A PERSON. Answering a snub with the house's paperwork
     * is the confident-wrong-act shape this repo keeps having to unpick.
     */
    it('never takes a person as what is being ignored', () => {
        for (const sentence of ['I ignore him', 'I ignore her', 'I ignore them']) {
            expect(parseIntent(sentence).intent, sentence).not.toBe('ignore');
        }
    });

    /** And asking whether anybody sent is still a question. */
    it('leaves the read that finds a summons alone', () => {
        expect(parseIntent('has anybody sent for me').intent).toBe('summons');
        expect(parseIntent('what does the house want of me').intent).toBe('summons');
    });
});

describe('played', () => {
    /**
     * NOTHING STANDING, AND IT SAYS SO. The whole risk of routing a pronoun is
     * here, and what makes it acceptable is that the answer is true, free, and
     * writes nothing.
     */
    it('writes nothing when nobody has asked for anything', async () => {
        const { game, repos } = await makeGameInWorld({
            seed: 'ignore-nothing', worldSeed: 'world-ignore-nothing'
        });
        const { cultivator } = await game.newRun('Deaf');
        await game.act('I look around');

        const before = repos.cultivators.getById(cultivator.id)!;
        const answer = await game.act('I ignore it');
        const after = repos.cultivators.getById(cultivator.id)!;

        expect(said(answer)).toMatch(/Nothing is being asked of you|belong to nothing|Nothing is outstanding/i);
        expect(after.spiritStones).toBe(before.spiritStones);
        // A shrug is exactly what this must never be again.
        expect(said(answer)).not.toMatch(/does not resolve into anything/i);
    }, 200_000);

    /**
     * IN TIME, IT COSTS NOTHING AND THE ASK IS STILL THERE. This is the half
     * that makes ignoring a distinct act rather than a slower refusal: the
     * player has spent nothing, the flag is untouched, and what they are told
     * is the price of the decision they have not made.
     */
    it('spends nothing while the day has not gone, and leaves the ask standing', async () => {
        const { harness, id } = await aMemberWithAnAskStanding('ignore-in-time');
        const before = harness.repos.cultivators.getById(id)!;

        const answer = await harness.game.act('I ignore it');

        expect(said(answer)).toMatch(/say nothing|still standing/i);
        // NOT ANSWERED. The flag is the whole of what makes it an ask.
        expect(readPendingSummons(harness.repos, id), 'the ask was consumed').not.toBeNull();
        expect(harness.repos.cultivators.getById(id)!.spiritStones).toBe(before.spiritStones);
        // And no grudge was opened, because nothing was decided.
        const rows = harness.db.prepare(
            'SELECT COUNT(*) AS n FROM obligations WHERE subject_id = ?'
        ).get(id) as { n: number };
        expect(rows.n).toBe(0);
    }, 200_000);

    /**
     * AND THE DAY GOES, AND IT LANDS AS A LAPSE. `refuseDuty` has kept the
     * difference since it was written - *The term ran out on day N with nothing
     * done* against *Declined when asked* - and until there was a verb for
     * ignoring, `'lapsed'` could only be reached by refusing late.
     */
    it('lands as a lapse once the day it had to be answered by has gone', async () => {
        const { harness, id, pending } = await aMemberWithAnAskStanding('ignore-too-long');

        // Past the due day. The clock is the run's, not this verb's, and the
        // row is where the run reads it from.
        harness.db.prepare('UPDATE runs SET elapsed_days = ?')
            .run(pending.duty.dueOnDay + 1);

        const answer = await harness.game.act('I ignore it');

        expect(said(answer)).toMatch(/day it had to be answered by has gone/i);
        expect(readPendingSummons(harness.repos, id), 'a lapsed ask is still standing').toBeNull();
        const rows = harness.db.prepare(
            'SELECT tags FROM obligations WHERE subject_id = ?'
        ).all(id) as { tags: string }[];
        expect(rows.length, 'the lapse wrote nothing').toBeGreaterThan(0);
        expect(rows.some(r => r.tags.includes('lapsed')), 'written as a refusal, not a lapse')
            .toBe(true);
        expect(rows.some(r => r.tags.includes('refused'))).toBe(false);
    }, 200_000);
});
