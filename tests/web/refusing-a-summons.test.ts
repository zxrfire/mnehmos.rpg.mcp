/**
 * Saying no to your own house, and what it costs.
 *
 * `encounters/duties.ts` promises the whole of this in its opening lines - "the
 * house calls on you. You may refuse, and refusing is a row in the obligations
 * ledger rather than a shrug" - and every piece existed except the answer.
 * `recordEncounters` discarded `occurrence.duty`, so a summons interrupted a
 * span, printed a sentence and was gone by the next turn. `refuseDuty` takes
 * `'refused' | 'failed' | 'lapsed'` and the only call anywhere in the repository
 * passed `'failed'`, on the branch where the cultivator had died: the sole way
 * to not finish a duty was to be killed doing it.
 *
 * Two tiers, per AGENTS.md. The unit tests below say what happens; the rate test
 * at the bottom says it happens at all, measured where a player would meet it.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { makeGame, makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { summonsPool } from '../../src/engine/encounters/duties';
import {
    dutyFromOffer,
    membershipFor,
    openLedgerBetween,
    recordEncounters
} from '../../src/web/encounters';
import {
    SUMMONS_FLAG_KEY,
    readPendingSummons,
    rememberSummons
} from '../../src/web/pending-summons';
import {
    CHALLENGE_AT,
    REFUSAL_COST_BY_SEVERITY,
    STANDING_ON_JOINING,
    refusalCost
} from '../../src/engine/cultivation/leadership';
import { readJsonFlag } from '../../src/server/consolidated/cultivation-support';

const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

/**
 * Put a real ask in front of a real member.
 *
 * The duty is drawn from `summonsPool` and built by `dutyFromOffer`, which are
 * the two functions the world itself uses - so nothing here is a hand-written
 * duty shaped to make a test pass. Only the ROLL is bypassed, because a 2.8%
 * per-turn event is not something to assert an outcome through.
 */
function standAnAskInFrontOfThem(
    harness: any,
    cultivatorId: string,
    onDay = 0,
    pick = 0
) {
    const { repos, knowledge } = harness;
    const cultivator = repos.cultivators.getById(cultivatorId)!;
    const membership = membershipFor({ repos, knowledge, world: null } as any, cultivator);
    const pool = summonsPool(cultivator.realmOrdinal, membership);
    if (pool.length === 0) return null;
    const candidate = pool[Math.min(pick, pool.length - 1)];
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

async function memberAt(seed: string, ordinal = 8) {
    const harness = makeGame({ seed }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
        .run(ordinal, cultivator.id);
    harness.repos.sects.addMember(LOCAL_SECT.id, cultivator.id, 0);
    return { harness, cultivatorId: cultivator.id };
}

// ─────────────────────────────────────────────────────────────────────────
// THE SENTENCE REACHES THE VERB
// ─────────────────────────────────────────────────────────────────────────

describe('a player can say the thing', () => {
    it('routes refusals to the act and questions about them to the price', () => {
        for (const text of [
            'I refuse',
            'I refuse the summons',
            'I decline the summons',
            'I will not go',
            'I turn them down',
            'I say no'
        ]) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('sect');
            expect(plan.intent, text).toBe('refuse');
        }

        // The qualified reading is checked first, so a question about the price
        // is never answered by paying it. This is the whole reason the two
        // patterns are ordered the way they are.
        for (const text of [
            'what would refusing cost me',
            'what happens if I refuse',
            'how bad is turning them down',
            'what has been asked of me',
            'who sent for me'
        ]) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('sect');
            expect(plan.intent, text).toBe('summons');
        }
    });

    it('does not steal a marriage refusal, which had the verbs first', () => {
        // `familyStep` runs at the top of the table and claims every declining
        // verb carrying a match noun. The two are separated by their nouns, and
        // that separation is what makes a bare "I refuse" safe to take.
        for (const text of [
            'I refuse the match',
            'I decline the betrothal',
            'I turn down the proposal'
        ]) {
            expect(parseIntent(text).action, text).toBe('decline');
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE PRICE IS SHOWN BEFORE IT IS PAID
// ─────────────────────────────────────────────────────────────────────────

describe('what saying no would cost, without saying it', () => {
    it('names the number and spends nothing', async () => {
        const { harness, cultivatorId } = await memberAt('refuse-price');
        const pending = standAnAskInFrontOfThem(harness, cultivatorId);
        expect(pending, 'the pool should offer this member something').not.toBeNull();

        const asked = await harness.game.act('what would refusing cost me');
        const said = asked.narration ?? '';

        const expected = REFUSAL_COST_BY_SEVERITY[pending!.duty.refusal.severity];
        expect(said).toContain(String(expected));
        expect(said.toLowerCase()).toContain('standing');

        // Priced only. The ask is still standing, nothing is in the ledger, and
        // the membership is untouched - which is the difference between a
        // decision and a surprise.
        expect(readPendingSummons(harness.repos, cultivatorId)).not.toBeNull();
        expect(openLedgerBetween(harness.repos, cultivatorId, LOCAL_SECT.id)).toHaveLength(0);
        expect(harness.repos.sects.getMembership(cultivatorId)).not.toBeNull();
    });

    it('says so plainly when nothing has been asked', async () => {
        const { harness } = await memberAt('refuse-nothing');
        const asked = await harness.game.act('I refuse');
        const said = (asked.narration ?? '').toLowerCase();
        // A refusal with nothing to refuse is not an error, and the answer has
        // to be about the house rather than about the sentence.
        expect(said).toContain('nothing');
        expect(said).not.toContain('do not understand');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// SAYING IT
// ─────────────────────────────────────────────────────────────────────────

describe('refusing writes both ends of it', () => {
    it('spends standing, files the grudge against the house, and clears the ask', async () => {
        const { harness, cultivatorId } = await memberAt('refuse-commit');
        const pending = standAnAskInFrontOfThem(harness, cultivatorId)!;
        const cost = refusalCost(pending.duty.refusal.severity as any, pending.duty.origin);

        const done = await harness.game.act('I refuse');
        const said = done.narration ?? '';
        expect(said.length).toBeGreaterThan(0);

        // THE ASK IS ANSWERED. The flag is gone, so refusing twice is not a way
        // to spend the same standing twice.
        expect(readPendingSummons(harness.repos, cultivatorId)).toBeNull();
        expect(readJsonFlag(harness.db, cultivatorId, SUMMONS_FLAG_KEY)).toBeNull();

        // THE HOUSE HOLDS IT. `createGrudge({ holderId: factionId })` - the
        // direction that makes this a consequence rather than a note.
        const ledger = openLedgerBetween(harness.repos, cultivatorId, LOCAL_SECT.id);
        expect(ledger).toHaveLength(1);
        expect(ledger[0].holderId).toBe(LOCAL_SECT.id);
        expect(ledger[0].subjectId).toBe(cultivatorId);
        expect(ledger[0].severity).toBe(pending.duty.refusal.severity);
        expect(ledger[0].tags).toContain('refused');

        // THE STANDING MOVED, AND DOWNWARD. Before this verb existed, a member
        // below the ordering rung could not spend standing at all: it began at
        // STANDING_ON_JOINING and only ever recovered.
        const after = readJsonFlag<{ standing: number }>(
            harness.db, cultivatorId, `house:${LOCAL_SECT.id}`
        );
        expect(after).not.toBeNull();
        expect(after!.standing).toBeLessThan(STANDING_ON_JOINING);
        expect(after!.standing).toBeCloseTo(STANDING_ON_JOINING - cost.standingCost, 5);
    });

    it('records a lapse rather than a refusal once the day has gone', async () => {
        const { harness, cultivatorId } = await memberAt('refuse-lapse');
        const pending = standAnAskInFrontOfThem(harness, cultivatorId)!;

        // Push the run past the day it had to be answered by. The two outcomes
        // are a real distinction - one is a decision and the other is what
        // happens to somebody who made none - and both were unreachable.
        harness.db.prepare('UPDATE runs SET elapsed_days = ?')
            .run(pending.duty.dueOnDay + 1);

        await harness.game.act('I refuse');
        const ledger = openLedgerBetween(harness.repos, cultivatorId, LOCAL_SECT.id);
        expect(ledger).toHaveLength(1);
        expect(ledger[0].tags).toContain('lapsed');
        expect(ledger[0].tags).not.toContain('refused');
    });

    it('throws the member out once their credit is spent, and takes the row with it', async () => {
        const { harness, cultivatorId } = await memberAt('refuse-dismissal');

        // Walk the standing down to just above the door rather than asserting a
        // count of refusals: how many it takes is a calibration, and this test
        // is about the house acting on the threshold `resolveAct` already had.
        harness.db.prepare(`
            INSERT INTO cultivator_flags (cultivator_id, key, value, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(cultivator_id, key) DO UPDATE SET value = excluded.value
        `).run(cultivatorId, `house:${LOCAL_SECT.id}`, JSON.stringify({
            standing: CHALLENGE_AT + 1,
            accruedToDay: 0,
            ownFollowing: 0,
            expelled: [], departed: [], externalElders: [],
            admissionOrdinal: null, teaches: null, curriculumSetOnDay: null,
            membersAdded: 0, membersLost: 0, obstructions: 0, challengedTimes: 0
        }));

        standAnAskInFrontOfThem(harness, cultivatorId);
        expect(harness.repos.sects.getMembership(cultivatorId)).not.toBeNull();

        const done = await harness.game.act('I refuse');

        // THE ROW IS ACTUALLY GONE. `resolveAct` decides the dismissal; if the
        // membership survived it, the narration would be asserting an outcome
        // with no state change behind it - which is the one thing the authority
        // rule forbids, and it would have read perfectly in the prose.
        expect(harness.repos.sects.getMembership(cultivatorId)).toBeNull();
        expect((done.narration ?? '').length).toBeGreaterThan(0);
    });

    it('forgets an ask that outlived the membership', async () => {
        const { harness, cultivatorId } = await memberAt('refuse-departed');
        standAnAskInFrontOfThem(harness, cultivatorId);

        harness.repos.sects.removeMember(LOCAL_SECT.id, cultivatorId);

        // Walking out settles what the house was owed - `leave` says so out
        // loud - so an ask must not be the one obligation that survives it.
        expect(readPendingSummons(harness.repos, cultivatorId)).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE RATE TEST
// Not "does the arithmetic work" - that is above. This asks whether the ask
// SURVIVES A PLAYED TURN, which is the thing that was broken: the duty was
// computed correctly every time and thrown away before the player could
// answer it.
// ─────────────────────────────────────────────────────────────────────────

describe('a summons the world rolls survives to the turn after it', () => {
    /**
     * The closed form, and why it is not a played sample.
     *
     * Measured on this tree: a member working a month draws a summons about
     * **once in sixty spans**, and cultivating a month drew none in sixty -
     * `SUMMONS_TURN_CHANCE` is 0.028 against an `arrivalExposure` of 1.1 for
     * labour and 0.55 for seclusion, before the place rate. So a played sample
     * big enough to put a threshold on would be several hundred spans, and a
     * small one would assert nothing while looking as though it did.
     *
     * The rate is also not what changed. `attemptSummons` was drawing correctly
     * the whole time; what was broken is that `recordEncounters` mapped the
     * occurrence to its summary and dropped `occurrence.duty` on the floor. So
     * the thing to measure is the survival, and it can be measured exactly:
     * push a real roll through the real function and ask the player's own
     * question afterwards.
     */
    it('keeps what the roll produced, and the player can find it by asking', async () => {
        const { harness, cultivatorId } = await memberAt('roll-survives');
        const { repos, knowledge } = harness;
        const cultivator = repos.cultivators.getById(cultivatorId)!;
        const membership = membershipFor({ repos, knowledge, world: null } as any, cultivator);

        const pool = summonsPool(cultivator.realmOrdinal, membership);
        // If this is ever zero the test is measuring nothing, so it is a
        // precondition rather than a silent skip.
        expect(pool.length).toBeGreaterThan(0);

        const candidate = pool[0];
        const duty = dutyFromOffer(candidate, membership, 0);

        // An occurrence shaped exactly as `resolveOccurrence` shapes one that
        // carries a duty: `interrupts` true, `source` a summons, the duty
        // attached. Pushed through the REAL `recordEncounters`, which is the
        // function that used to throw the duty away.
        const roll: any = {
            occurrences: [{
                id: candidate.entry.id,
                entryId: candidate.entry.id,
                kind: candidate.entry.kind,
                valence: 'neutral',
                dayOffset: 0,
                absoluteDay: 0,
                interrupts: true,
                stance: 'none',
                event: {
                    kind: 'encounter',
                    dayOffset: 0,
                    summary: `${candidate.entry.name}, put to them by name.`
                },
                deltas: { hp: 0, spiritStones: 0 },
                confrontation: null,
                duty,
                scene: null,
                contact: null,
                grants: [],
                castIds: [],
                source: 'summons'
            }]
        };

        recordEncounters(knowledge, cultivator, 0, roll, repos);

        // IT SURVIVED. This is the assertion the whole change exists for.
        const standing = readPendingSummons(repos, cultivatorId);
        expect(standing).not.toBeNull();
        expect(standing!.duty.factionId).toBe(LOCAL_SECT.id);
        expect(standing!.entryId).toBe(candidate.entry.id);

        // AND IT IS FINDABLE AT THE POINT A PLAYER WOULD MEET IT, which is by
        // typing a sentence rather than by reading a column. The answer has to
        // name a number, because a summons a player cannot price is the trap
        // the design owner ruled against.
        const asked = await harness.game.act('what has been asked of me');
        const said = asked.narration ?? '';
        expect(said).toContain(String(REFUSAL_COST_BY_SEVERITY[duty.refusal.severity]));

        // And answering it settles it.
        await harness.game.act('I refuse');
        expect(readPendingSummons(repos, cultivatorId)).toBeNull();
        expect(openLedgerBetween(repos, cultivatorId, LOCAL_SECT.id)).toHaveLength(1);
    });

    /**
     * The played arm, kept deliberately small and deliberately threshold-free.
     *
     * At roughly one summons in sixty spans, a bar here would be a coin flip
     * dressed as a guard - AGENTS.md's "pool the sample, never widen the bar",
     * pointed at the decision not to write the bar in the first place. What it
     * asserts instead is an IDENTITY that cannot pass vacuously in the
     * direction that matters: every ask this sample DID leave standing was
     * answerable by a typed sentence. A run that draws none says nothing and
     * fails nothing, and the count is printed so a person can see which
     * happened.
     */
    it('every ask a played sample leaves standing can be answered', async () => {
        let spans = 0;
        let leftStanding = 0;
        let answerable = 0;

        for (const worldSeed of ['sum-a', 'sum-b']) {
            const harness = await makeGameInWorld({
                seed: `roll-${worldSeed}`, worldSeed
            }) as any;
            const { cultivator } = await harness.game.newRun('Lu Yan');
            harness.db.prepare(
                'UPDATE cultivators SET realm_ordinal = 8, spirit_stones = 9000 WHERE id = ?'
            ).run(cultivator.id);
            harness.repos.sects.addMember(LOCAL_SECT.id, cultivator.id, 0);

            for (let turn = 0; turn < 20; turn++) {
                // `work` rather than `cultivate`: labour is the highest arrival
                // exposure a member can choose, and it feeds them, so the span
                // does not end in starvation before the house ever sends.
                await harness.game.act('I work for a month');
                spans++;
                if (!readPendingSummons(harness.repos, cultivator.id)) continue;
                leftStanding++;

                const asked = await harness.game.act('what has been asked of me');
                if (/\d/.test(asked.narration ?? '')) answerable++;

                await harness.game.act('I refuse');
                expect(readPendingSummons(harness.repos, cultivator.id)).toBeNull();
            }
        }

        // eslint-disable-next-line no-console
        console.log(
            `[summons] ${spans} spans worked, ${leftStanding} asks left standing, `
            + `${answerable} answerable by a typed sentence.`
        );
        expect(answerable).toBe(leftStanding);
        expect(spans).toBe(40);
    }, 900_000);
});
