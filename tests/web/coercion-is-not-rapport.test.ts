/**
 * Robbing somebody and threatening them must not make you closer to them.
 *
 * FOUND BY PLAYING, at ordinal 29 against a stranger who could not answer:
 * `I threaten <somebody>` and `I steal from <somebody>` both LANDED, and the
 * only record either left was a relationship row - the victim's side typed
 * `patron`, strength 0.1, roles `was_bought`, history *"X got something out of
 * Y"*. The obligation ledger was empty. So the standing model, which reads that
 * table, would have treated extortion as rapport, and `oddsOf` reads a tie's
 * strength as an unsigned positive worth up to 30 points - so each robbery made
 * the next thing you wanted off that person EASIER.
 *
 * The engine already knew better on the other branch: a REFUSED threat writes a
 * grudge, through `whatARefusalLeaves`. These tests are the successful path
 * being made to agree with the refused one.
 *
 * WHERE THE SIGN LIVES, because that was the design question. `relationships.ts`
 * has hostile TYPES - `enemy`, `rival`, `sworn_enemy` - so a hostile row is
 * expressible; what is not expressible is a hostile STRENGTH, because strength
 * is how much a tie matters to its holder and every reader treats it as
 * goodwill. The sign this layer really supports is the ledger's KIND, and
 * `grudges.ts` names robbery and humiliation in as many words. So a wrong that
 * lands writes no tie at all and writes the grudge instead, and that is what is
 * pinned here.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type Database from 'better-sqlite3';

import { makeGameInWorld, engineCalls } from './harness';

interface TieRow { type: string; strength: number; roles: string }
interface LedgerRow { holder_id: string; subject_id: string; kind: string; cause: string; status: string }

const tiesTo = (db: Database.Database, playerId: string): TieRow[] =>
    db.prepare('SELECT type, strength, roles FROM relationships WHERE to_character_id = ?')
        .all(playerId) as TieRow[];

const ledgerAbout = (db: Database.Database, playerId: string): LedgerRow[] =>
    db.prepare('SELECT holder_id, subject_id, kind, cause, status FROM obligations WHERE subject_id = ?')
        .all(playerId) as LedgerRow[];

/**
 * A cultivator nobody standing here can touch, so the attempt lands.
 *
 * The world is PINNED as well as the run. A played test that fixes a seed and
 * not a world is pinning a coincidence: `createWorld` mints `randomUUID()` when
 * the installation has none, so the same run seed meets a different several
 * hundred people every execution.
 *
 * AND THE SEEDS ARE CHOSEN SO THE ATTEMPT LANDS, which is worth saying out
 * loud because it is the weak part of this file. What is being measured is what
 * happens WHEN a wrong lands; the landing itself is scaffolding, and it is a
 * roll at roughly even odds - swept across six seeds it came out 34, 54, 56,
 * 65, 78 and 79 in a hundred. So these seeds are pinned to two that land with
 * room to spare rather than to two that happened to.
 *
 * It should be FORCED instead, and cannot be yet. `ADMIN <verb> <sentence>`
 * takes the whole remaining line as the target - "coerce I threaten the nearest
 * cultivator" resolves nobody - so forcing cannot currently carry the player's
 * own sentence into a verb that needs a target out of it. That is a gap in the
 * admin surface rather than in this file, and when it closes these seeds stop
 * mattering.
 */
async function standingOverEverybody(seed: string) {
    const { db, game } = await makeGameInWorld({ seed, worldSeed: `world-${seed}` });
    const { cultivator } = await game.newRun('Lin Zhaoyi');
    db.prepare(
        'UPDATE cultivators SET realm_ordinal = 29, spirit_stones = 50000, hp = 9000, '
        + 'max_hp = 9000 WHERE id = ?'
    ).run(cultivator.id);
    await game.act('I look around');
    return { db, game, id: cultivator.id };
}

describe('a wrong that lands is not an arrangement', () => {
    it.each([
        ['I threaten the nearest cultivator', 'humiliation', 'wrong-humiliation-e'],
        ['I steal from the nearest cultivator', 'robbery', 'wrong-robbery-e']
    ])('%s writes a grudge and no tie', async (said, cause, seed) => {
        const { db, game, id } = await standingOverEverybody(seed);

        const acted = await game.act(said);

        // It came off. If it had not, this would be measuring a refusal, which
        // already wrote a grudge before any of this.
        const attempt = engineCalls(acted).find(c => c.name === 'engine.resolveAttempt');
        expect(attempt?.summary, said).toMatch(/they agreed/);

        // THE DEFECT. Nothing in the relationship table points at the player.
        expect(tiesTo(db, id), 'a wrong wrote a tie').toEqual([]);

        // AND THE RECORD IT WRITES INSTEAD, on the other side of the ledger.
        const held = ledgerAbout(db, id);
        expect(held).toHaveLength(1);
        expect(held[0].kind).toBe('grudge');
        expect(held[0].cause).toBe(cause);
        expect(held[0].status).toBe('open');
        // Held BY the person it was done to, the way the aggrieved side holds
        // every other wrong in this engine.
        expect(held[0].holder_id).not.toBe(id);
    }, 200_000);

    /**
     * The refusal to write is said out loud, because a record silently not
     * written is indistinguishable from a record nobody thought of. The
     * mechanical channel carries what the resolver offered and why it was
     * declined, which is the only place a future reader can find out.
     */
    it('says on the engine channel what it declined to write', async () => {
        const { game } = await standingOverEverybody('wrong-says-so-e');
        const acted = await game.act('I threaten the nearest cultivator');

        const tie = engineCalls(acted).find(c => c.name === 'social.recordTie');
        expect(tie, 'the tie decision was not reported at all').toBeDefined();
        expect(tie!.ok).toBe(false);
        expect(tie!.summary).toMatch(/No tie written/);
        expect(tie!.summary).toMatch(/patron/);

        const wrote = engineCalls(acted).find(c => c.name === 'social.createObligation');
        expect(wrote?.ok).toBe(true);
    }, 200_000);

    /**
     * THE POINT OF THE WHOLE THING, measured on the odds rather than on the
     * rows: having robbed somebody must make the next approach to them harder.
     *
     * Before the fix each landed wrong ADDED to their side of the tie, and
     * `oddsOf` reads `theirTie.strength * TIE_WEIGHT` as an unsigned positive.
     * Now the same event writes a grudge, and `grudgeAgainstYou` reads it as a
     * negative. Same person, same day, two attempts: the second is priced worse
     * than the first, and it is the sign of the difference that is being
     * asserted rather than any particular figure.
     */
    it('makes the next approach to that person harder, not easier', async () => {
        const { game } = await standingOverEverybody('wrong-costs');

        const first = await game.act('I threaten the nearest cultivator');
        const who = /^(.+?), asked /.exec(
            engineCalls(first).find(c => c.name === 'engine.resolveAttempt')!.summary
        )?.[1];
        expect(who, 'could not read who was pressed').toBeDefined();

        const grudged = engineCalls(await game.act(`I threaten ${who}`))
            .find(c => c.name === 'engine.resolveAttempt')!;
        // The term is named on the channel by `WHAT_EACH_TERM_IS`. Its presence
        // is the assertion: before the fix there was never an open grudge to
        // read, because the event wrote a tie in the other direction.
        expect(grudged.summary).toMatch(/an open grudge they hold cost \d+ points?/);
    }, 200_000);
});

describe('an ordinary ask still leaves the tie it always left', () => {
    /**
     * The control, and it is what stops the change above being a blanket
     * deletion. A bribe, a courtship and a recruitment pitch are not wrongs
     * however badly they land, so `WRONG_BEHIND_INTENT` does not name them and
     * `recordWhatTheAskLeft` writes their tie exactly as before.
     */
    it('a landed bribe still makes them your client', async () => {
        const { db, game, id } = await standingOverEverybody('not-a-wrong');

        // Named rather than pointed at, and deliberately: `extractSubject`
        // takes everything after the verb to the end of the sentence, so
        // "I bribe the nearest cultivator with 40 spirit stones" is looked up
        // as a person called "nearest cultivator with 40 spirit stones" and
        // resolves to nobody. That is a live parser defect and it is not this
        // test's subject; naming the person routes around it.
        const met = engineCalls(await game.act('I talk to the nearest cultivator'))
            .find(c => c.name === 'engine.resolveParty');
        const who = /\.\s+(.+?) is here/.exec(met?.summary ?? '')?.[1] ?? null;
        expect(who, 'nobody nameable is standing here').not.toBeNull();

        // Bribed until one lands rather than on a seed picked for landing on
        // the first try. The odds are the resolver's and pinning them here
        // would be pinning them; what is being measured is what a LANDING
        // leaves, so the honest fixture is to keep asking until there is one.
        let landed = false;
        for (let tries = 0; tries < 8 && !landed; tries++) {
            const acted = await game.act(`I bribe ${who} with 40 spirit stones`);
            landed = /they agreed/.test(
                engineCalls(acted).find(c => c.name === 'engine.resolveAttempt')?.summary ?? ''
            );
        }
        expect(landed, 'no bribe landed in eight tries').toBe(true);

        const tie = tiesTo(db, id);
        expect(tie, 'the tie a transaction leaves was deleted along with the wrongs')
            .toHaveLength(1);
        expect(['patron', 'client']).toContain(tie[0].type);
    }, 200_000);
});
