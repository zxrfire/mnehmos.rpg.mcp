/**
 * An elder gives you an order, and the game had no word for yes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT WAS TYPED, AND WHAT CAME BACK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Played in a pinned world, a member of Azure Dew Sect at Qi Condensation
 * Layer 9. A senior of the house arrives in person and the ask stands:
 *
 *     > what has been asked of me
 *     Shu Wanping asked, and it is still standing: A merchant caravan is
 *     under attack at Iron Ridge by 7 raiders at Qi Condensation Layer 7.
 *     ... Azure Dew Sect has said where to be and when. Nothing was asked.
 *     It was brought by Shu Wanping. ... Term: 12 days, by day 162. Paid: 11
 *     contribution and 25 spirit stones on completion. Declining is recorded
 *     as serious.
 *     Saying no costs 14 standing and would leave you at 36 with Azure Dew
 *     Sect. The house writes it down as serious.
 *
 *     > I accept and go
 *     You turn the thought over and it does not resolve into anything you
 *     could actually do standing here.
 *
 * The same blank look for `I accept`, `I obey`, `I will go`, `I do as I am
 * told` and `I answer the summons`. Six ways of saying the one thing, and the
 * only answer the game had to an order was to refuse it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY, WHICH IS THE ONE THIS REPO KEEPS FINDING
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `acceptDuty` in `web/encounters.ts` had exactly one caller in the whole
 * repository - the noticeboard. Everything else was built: `attemptSummons`
 * draws the ask, `mouthFor` picks the senior who carries it, `rememberSummons`
 * keeps it between turns, `priceOfRefusing` prices the no, `refuseDuty` writes
 * it down. The half that was reachable was the half that costs you something.
 *
 * So this is a phrasing and a call site, not a mechanic. The verb runs the
 * board's own procedure - oath, span, settle - over the ask that was already
 * standing.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * AND WHOSE ASK IT IS, WHICH THE SCREEN LEFT OPEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The old screen said `Shu Wanping asked` and three lines later `Saying no
 * costs 14 standing with Azure Dew Sect`, and the two sentences disagree about
 * whose ask it is. `authority-for-an-order.ts` draws exactly that distinction -
 * an order in the house's name and a favour asked in person are different
 * things - so the answer now says which: the person who carried it, and the
 * authority it was carried on.
 *
 * WHAT THE ENGINE HOLDS TODAY, measured rather than assumed: every summons is
 * the house's. `mouthFor` picks a senior off the roll to CARRY an ask the house
 * drew, and no path anywhere produces an elder's own errand - the only
 * person-to-player ask in the engine is `ContactKind` `'asked'`, which fires at
 * `above <= -2` and is therefore always somebody junior. The `personal` half of
 * `AuthorityClaim` has no producer on this side of the game at all.
 *
 * ── BROKEN ON PURPOSE ────────────────────────────────────────────────────
 *
 * Both arms were run. Dropping the `accept` row from the phrasing table takes
 * three of the eight red - the routing, the played settlement and the sample.
 * Leaving the row and pointing the dispatch back at `refuseWhatTheHouseAsked`
 * takes the two played ones, which is what says the settlement is pinned on the
 * handler and not only on the parse.
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '../../src/web/actions';
import { makeGame, makeGameInWorld } from './harness';
import { SECTS } from '../../src/data/cultivation/index';
import { summonsPool } from '../../src/engine/encounters/duties';
import { dutyFromOffer, membershipFor, openLedgerBetween } from '../../src/web/encounters';
import {
    readPendingSummons,
    rememberSummons,
    whoIsAsking
} from '../../src/web/pending-summons';
import { STANDING_ON_JOINING } from '../../src/engine/cultivation/leadership';
import { readJsonFlag } from '../../src/server/consolidated/cultivation-support';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import type { Duty } from '../../src/engine/encounters/types';

const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal ||
        (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

/**
 * Put a real ask in front of a real member, through the two functions the
 * world itself uses. Only the ROLL is bypassed: a per-turn event in the low
 * single percent is not something to assert an outcome through.
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

describe('a player can say yes', () => {
    it('routes every way somebody agrees to an order', () => {
        for (const text of [
            'I accept',
            'I accept it',
            'I accept and go',
            'I accept the summons',
            'I accept the order',
            'I agree to it',
            'I consent',
            'I obey',
            'I comply',
            'I do as I am told',
            'I do what the elder asked of me',
            'I answer the summons',
            'I answer the call',
            'I will go',
            'I go as ordered',
            'I take it on'
        ]) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('sect');
            expect(plan.intent, text).toBe('accept');
        }
    });

    /**
     * The three neighbours it must not swallow, each of which had the words
     * first and each of which means something else entirely.
     */
    it('leaves the board, the match and the price question where they were', () => {
        // The board's own word. "I accept the duty" has meant taking a line off
        // the wall since that verb was written, and a player standing at a
        // noticeboard must not be told nobody has sent for them.
        expect(parseIntent('I accept the duty').intent).toBe('duty');
        expect(parseIntent('I take a duty off the sect board').intent).toBe('duty');

        // A marriage is a different negotiation and claims its verbs first.
        expect(parseIntent('I accept the match they have offered').action).toBe('propose');
        expect(parseIntent('I agree to the betrothal').action).toBe('propose');

        // ASKING IS NOT DOING, in both directions. The question about the price
        // must not be answered by paying it, and the sentence that plainly does
        // the thing must not be answered with a price.
        expect(parseIntent('what has been asked of me').intent).toBe('summons');
        expect(parseIntent('what would refusing cost me').intent).toBe('summons');
        expect(parseIntent('who sent for me').intent).toBe('summons');
        expect(parseIntent('I refuse').intent).toBe('refuse');
        expect(parseIntent('I will not go').intent).toBe('refuse');
        expect(parseIntent('I ignore it').intent).toBe('ignore');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// SAYING IT
// ─────────────────────────────────────────────────────────────────────────

describe('going where the house sent you', () => {
    it('writes the oath, clears the ask, and pays on completion', async () => {
        const { harness, cultivatorId } = await memberAt('accept-commit');
        const pending = standAnAskInFrontOfThem(harness, cultivatorId)!;
        expect(pending, 'the pool should offer this member something').not.toBeNull();
        const before = harness.repos.cultivators.getById(cultivatorId)!;

        const done = await harness.game.act('I accept and go');
        const said = done.narration ?? '';

        // THE ANSWER IS AN ANSWER. The ask is off the flag, so saying yes twice
        // is not a way to be paid twice for one sending.
        expect(readPendingSummons(harness.repos, cultivatorId)).toBeNull();

        // THE OATH IS ON THE LEDGER, held by the person who swore it, and it
        // carries the catalog row so somebody can read in forty years what was
        // sworn to.
        //
        // READ OFF THE WHOLE LEDGER AND NOT THE OPEN HALF OF IT, and the change
        // is the finding rather than an accommodation. This asked
        // `openLedgerBetween` for exactly one OPEN row after a duty had been
        // finished and paid, and it got one - because `completeDuty` derived
        // the oath from the settlement day while `acceptDuty` had written it on
        // the acceptance day, so the settled row was a SECOND row and the
        // accepted one stayed open forever. The row this line used to find was
        // the orphan. Played, one turn after being paid in full: *"Owed by you
        // to unaffiliated: service term... Due on day 20, which is already
        // past."* See `a-finished-duty-is-off-the-ledger.test.ts`.
        //
        // What this test was ever measuring is that the word is WRITTEN, held
        // by the swearer, and carries the catalog row. All three still hold;
        // being open was never the point, and after a completed term it is the
        // defect.
        expect(openLedgerBetween(harness.repos, cultivatorId, LOCAL_SECT.id)).toHaveLength(0);
        const ledger = ledgerAbout(harness.repos.db, cultivatorId)
            .filter(row => row.tags.includes('duty'));
        expect(ledger).toHaveLength(1);
        expect(ledger[0].holderId).toBe(cultivatorId);
        expect(ledger[0].status).toBe('settled');
        expect(ledger[0].tags).toContain('duty');
        expect(ledger[0].tags).toContain(pending.entryId);

        // PAID ON COMPLETION, in both currencies the duty's own terms name.
        const after = harness.repos.cultivators.getById(cultivatorId)!;
        expect(after.spiritStones - before.spiritStones).toBe(pending.duty.stones);
        const membership = harness.repos.sects.getMembership(cultivatorId)!;
        expect(membership.contribution).toBeGreaterThanOrEqual(pending.duty.contribution);

        // AND IT COSTS NO STANDING. Refusing spends; obeying does not, and a
        // verb that charged for both would make the decision meaningless.
        const house = readJsonFlag<{ standing: number }>(
            harness.db, cultivatorId, `house:${LOCAL_SECT.id}`
        );
        expect(house === null || house.standing >= STANDING_ON_JOINING).toBe(true);

        // The player is told what they agreed to, in the channel a narrator
        // cannot drop.
        expect(said).toMatch(/yes/i);
        expect(said).toContain(String(pending.duty.days));
    });

    it('says so plainly when nobody has sent for you, and writes nothing', async () => {
        const { harness, cultivatorId } = await memberAt('accept-nothing');
        const done = await harness.game.act('I accept');
        const said = done.narration ?? '';

        // The answer is about the HOUSE, not about the sentence. The blank
        // look this verb replaced also contains the word `wall` - it lists a
        // noticeboard among the things that would work - so a test that only
        // looked for that would pass over the defect it was written against.
        expect(said).toMatch(/not sent for you/);
        expect(said).toContain(LOCAL_SECT.name);
        expect(said).not.toMatch(/does not resolve into anything/);
        expect(openLedgerBetween(harness.repos, cultivatorId, LOCAL_SECT.id)).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ON WHOSE WORD, WHICH IS THE DISTINCTION THE SCREEN WAS MISSING
// ─────────────────────────────────────────────────────────────────────────

describe('the person who carried it and the authority behind it', () => {
    const base: Duty = {
        origin: 'summons',
        posture: 'told',
        factionId: 'sect-x',
        factionName: 'Azure Dew Sect',
        days: 12,
        contribution: 11,
        stones: 25,
        pitchOrdinal: 6,
        dueOnDay: 12,
        refusal: {
            kind: 'grudge',
            cause: 'broken_oath',
            severity: 'serious',
            description: 'Called on and did not come.'
        },
        scale: 'local',
        cohort: 0,
        access: { granted: false, note: '' },
        spokenBy: null
    } as Duty;

    it('separates the mouth from the authority, and says the word is the house\'s', () => {
        const carried = whoIsAsking({
            ...base,
            spokenBy: {
                id: 'member-shu-wanping',
                name: 'Shu Wanping',
                rankIndex: 5,
                realmOrdinal: 24,
                known: true,
                detail: null
            }
        });
        expect(carried.mouth).toBe('Shu Wanping');
        expect(carried.authority).toBe('Azure Dew Sect');
        // The whole point: it is not hers. A house order carries the house's
        // weight and its refusal lands on the house's ledger, and a player who
        // cannot tell that from a personal favour cannot price either.
        expect(carried.line).toContain('Shu Wanping');
        expect(carried.line).toContain('Azure Dew Sect');
        expect(carried.line).toMatch(/not Shu Wanping's own/);
        expect(carried.line).toMatch(/house's ledger/);
    });

    it('does not invent a messenger where the house sent none', () => {
        const bare = whoIsAsking(base);
        expect(bare.mouth).toBeNull();
        expect(bare.said).toBe('Azure Dew Sect');
        expect(bare.line).toContain('Azure Dew Sect');
    });

    it('shows it on the screen the player reads before deciding', async () => {
        const { harness, cultivatorId } = await memberAt('accept-authority');
        standAnAskInFrontOfThem(harness, cultivatorId);
        const asked = await harness.game.act('what has been asked of me');
        // Whoever the world named, the authority is stated rather than left to
        // be inferred from a cost three lines further down.
        expect(asked.narration ?? '').toContain(LOCAL_SECT.name);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// MEASURED WHERE A PLAYER WOULD MEET IT
// ─────────────────────────────────────────────────────────────────────────

/**
 * The unit tests above say what happens. This says it happens at all.
 *
 * An identity rather than a rate, for the reason the sibling refusal test
 * gives: a run that draws no summons says nothing and must fail nothing. What
 * cannot pass vacuously in the direction that matters is that every ask this
 * sample DID leave standing was answerable by typing yes.
 */
describe('every ask a played sample leaves standing can be agreed to', () => {
    it('accepts them, and the count is printed', async () => {
        let spans = 0;
        let leftStanding = 0;
        let agreed = 0;

        for (const worldSeed of ['yes-a', 'yes-b']) {
            const harness = await makeGameInWorld({
                seed: `roll-${worldSeed}`, worldSeed
            }) as any;
            const { cultivator } = await harness.game.newRun('Lu Yan');
            harness.db.prepare(
                'UPDATE cultivators SET realm_ordinal = 8, spirit_stones = 9000 WHERE id = ?'
            ).run(cultivator.id);
            harness.repos.sects.addMember(LOCAL_SECT.id, cultivator.id, 0);

            for (let turn = 0; turn < 16; turn++) {
                await harness.game.act('I work for a month');
                spans++;
                if (!readPendingSummons(harness.repos, cultivator.id)) continue;
                leftStanding++;

                const answered = await harness.game.act('I accept and go');
                if (/yes/i.test(answered.narration ?? '')) agreed++;
                expect(readPendingSummons(harness.repos, cultivator.id)).toBeNull();
            }
        }

        // eslint-disable-next-line no-console
        console.log(
            `[accept] ${spans} spans worked, ${leftStanding} asks left standing, `
            + `${agreed} agreed to by a typed sentence.`
        );
        expect(agreed).toBe(leftStanding);
        expect(spans).toBe(32);
    }, 900_000);
});
