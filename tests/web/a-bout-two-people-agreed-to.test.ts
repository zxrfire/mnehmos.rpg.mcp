/**
 * A bout two people agreed to, and what it costs to break the agreement.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────
 *
 * AGENTS.md: **"Kill somebody during an agreed bout and you will obviously face
 * consequences."** Nothing stops you. The engine does not reach in and prevent
 * it, and it does not quietly make the bout unable to kill. What happens
 * instead is that the world answers.
 *
 * ── WHAT WAS MEASURED BEFORE THIS ────────────────────────────────────────
 *
 * Nothing answered. "I spar with him" and "I pin him" both parsed to `subdue`
 * and were indistinguishable from that point on; `seedObligations` keys on the
 * outcome alone, so a bout that ruined somebody wrote exactly what a mugging
 * writes; and a killing wrote nothing at all, because the resolver is right
 * that the dead hold nothing and nobody else was ever asked. Forty seeded runs
 * that sparred until the player died produced zero rows in `obligations`.
 *
 * ── WHY THE TWO PLAYED TESTS SWEEP SEEDS ─────────────────────────────────
 *
 * Not to paper over a flaky assertion. When these were written a confrontation
 * driven through `GameService` was not reproducible from its seed at all: the
 * three combat streams were keyed on `randomUUID()` row ids, so the same seed,
 * the same sentence and the same starting state produced a different fight
 * from one process to the next. That is fixed and pinned by
 * `tests/server/consolidated/a-confrontation-replays-from-its-seed.test.ts`,
 * and a played run can now be pinned end to end - with `makeGameInWorld`,
 * which fixes the WORLD seed as well, because `makeGame` alone leaves the
 * population to a minted one and a seed pinned without a world is a
 * coincidence pinned.
 *
 * The sweep stays anyway, because it is measuring something a single seed
 * cannot say. What these assert is a RATE - a peer bout goes past what was
 * agreed in the large majority of runs - and one pinned seed would only ever
 * report that one bout did. So these ask for the event across a handful of
 * seeds and assert what the ledger holds once it happens.
 */

import { readFileSync } from 'node:fs';

import { parseIntent, validatePlan } from '../../src/web/actions';
import { makeGame, cultivatorRow } from './harness';

interface OpenAccount {
    kind: string;
    severity: string;
    cause: string;
    tags: string;
    holder_id: string;
    subject_id: string;
}

function obligations(db: { prepare: (sql: string) => { all: () => unknown[] } }): OpenAccount[] {
    return db.prepare(
        'SELECT kind, severity, cause, tags, holder_id, subject_id FROM obligations'
    ).all() as OpenAccount[];
}

describe('the agreement is carried, and it is carried as a closed value', () => {
    /**
     * The word was being thrown away at the parser boundary, which is how the
     * distinction came to be missing: not by a decision, by omission.
     */
    it('marks a spar, a duel and a challenge as agreed', () => {
        for (const text of [
            'I challenge someone of my own realm to a duel',
            'I challenge him to a duel',
            'I duel the nearest cultivator',
            'I spar with someone of my own rank'
        ]) {
            expect(parseIntent(text).terms, text).toBe('agreed');
        }
    });

    /** A fight nobody agreed to says nothing about terms, because there are none. */
    it('leaves an ordinary attack unmarked', () => {
        expect(parseIntent('I attack the nearest cultivator').terms).toBeUndefined();
        expect(parseIntent('I kill the nearest cultivator').terms).toBeUndefined();
        expect(parseIntent('I murder a disciple').terms).toBeUndefined();
    });

    /**
     * And it changes nothing about what is asked of the resolver. `subdue` is
     * what an agreed bout already meant to the combat layer and it stays that,
     * so the closed set of goals is untouched. The two sentences produce the
     * same plan but for the goal and the terms.
     */
    it('does not touch the goal handed to the resolver', () => {
        const bout = parseIntent('I spar with someone of my own rank');
        const fight = parseIntent('I attack someone of my own rank');
        expect(bout.intent).toBe('subdue');
        expect(parseIntent('I kill the nearest cultivator').intent).toBe('kill');
        expect(bout.action).toBe(fight.action);
        expect(bout.target).toBe(fight.target);
    });

    /**
     * Kept only on the verb that owns it. A model saying a journey was agreed
     * has said nothing, and letting the word ride along would put something in
     * the ledger that means nothing.
     */
    it('keeps a model-planned agreement on the fight and nowhere else', () => {
        const onAFight = validatePlan({ action: 'attack', target: 'him', terms: 'agreed' });
        expect(onAFight.ok).toBe(true);
        expect(onAFight.ok && onAFight.action.terms).toBe('agreed');

        const elsewhere = validatePlan({ action: 'move', target: 'the pass', terms: 'agreed' });
        expect(elsewhere.ok).toBe(true);
        expect(elsewhere.ok && elsewhere.action.terms).toBeUndefined();
    });
});

describe('the blows land as blows land', () => {
    /**
     * The softening guard, and the most important assertion in the file.
     *
     * The tell AGENTS.md names is a line of code that reads what the two of
     * them SAID in order to decide what a body suffers. There is exactly one
     * defence against that and it is structural: the layer that decides damage,
     * wounds and death must not be able to see the terms at all. So this reads
     * the sources and requires that neither the resolver nor the combat tool
     * mentions them - if somebody ever threads `terms` into either, an agreed
     * bout has become the safe version of combat and this fails.
     *
     * A behavioural comparison would be better and is not available: a played
     * confrontation is not currently reproducible from its seed, so two runs of
     * the same fight differ whatever anybody changed.
     */
    it('keeps the terms out of the layer that decides what a body suffers', () => {
        for (const path of [
            'src/engine/cultivation/combat.ts',
            'src/server/consolidated/combat-manage.ts'
        ]) {
            const source = readFileSync(path, 'utf8');
            expect(/\bBoutTerms\b/.test(source), path).toBe(false);
            expect(/going-further-than-an-agreed-bout/.test(source), path).toBe(false);
        }
    });
});

describe('and the world answers', () => {
    /**
     * The player is the one who went too far. Their opponent's house opens an
     * account naming them - an ordinary obligation row, held by the aggrieved
     * party about the offender, inheritable like everything else in that
     * ledger - and their OWN house takes standing off them, because a house
     * that sent a disciple to a friendly bout and heard how it ended has been
     * told something about that disciple.
     *
     * ── WHAT THE SETUP DOES, AND WHY ─────────────────────────────────────
     *
     * It keeps the player standing and gives them the one edge the engine
     * already prices in the same units - battle experience - and it touches
     * NOTHING about the opponent, the rolls or the wounds. Both are there
     * because the aggressor side of this is otherwise very hard to reach:
     *
     *   THE WOUNDS   untreated wounds are the commonest cause of death in this
     *                game, so a player sparring repeatedly dies long before
     *                they can be the one at fault - which is the case the
     *                ruling is actually about.
     *   THE EDGE     a lopsided exchange is what tears something. Two exact
     *                peers mostly bruise each other, so a bout between them
     *                reaches `crippled` about once in eighty, and a test that
     *                asked for it unaided would be asking for a coincidence.
     *
     * The rung above it - the player as the KILLER - is reachable now, and it
     * took two changes rather than one. `combat_manage.resolve` learned to ask
     * the death gate about an opponent who has a row, and `game.ts` learned to
     * carry the resolver's findings to an opponent who has only a world record,
     * which is nearly everybody a player spars with. See
     * `a-fight-reaches-the-person-it-was-with.test.ts` for the join and
     * `whatFollowedTheBout` for where the two answers meet: `loserDied` is now
     * the loser's, whichever of them the loser was.
     */
    it('opens an account against a player who goes too far in an agreed bout', async () => {
        let found: { rows: OpenAccount[]; playerId: string; standing: number | null } | null = null;

        const seeds = Array.from({ length: 30 }, (_, n) => `bout-${n}`);
        for (const seed of seeds) {
            if (found) break;
            const { db, game, repos } = makeGame({ seed, worldEnabled: true });
            const { cultivator } = await game.newRun('Duellist');
            const mine = 'sect-azure-cloud-pavilion';
            repos.sects.addMember(mine, cultivator.id, 1);
            await game.act('I look around');

            let held: OpenAccount[] = [];
            for (let bouts = 0; bouts < 20 && held.length === 0; bouts++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                db.prepare(
                    'UPDATE cultivators SET hp = 5000, max_hp = 5000, battles_survived = 400 '
                    + 'WHERE id = ?'
                ).run(cultivator.id);
                db.prepare('DELETE FROM cultivator_injuries WHERE cultivator_id = ?')
                    .run(cultivator.id);
                await game.act('I spar with someone of my own rank');
                // ── THE ROW THIS TEST IS ABOUT, SELECTED BY WHAT IT IS ───
                //
                // A fight now writes two kinds of account about the loser and
                // this searches for one of them. `whatTheLoserNowHoldsAboutYou`
                // persists what `seedObligations` decided - the grudge the
                // person you beat holds, computed and dropped for as long as
                // played fights have existed - and it lands on almost every
                // bout, so a search that stops at "any row about the player"
                // stops on the first spar and never reaches the rare event
                // this test exists for. Its rows carry no terms tag, because
                // the resolver never knew what was agreed; the account opened
                // because the bout went PAST what was agreed carries one, and
                // that tag is its whole content.
                held = obligations(db).filter(row =>
                    row.subject_id === cultivator.id
                    && (JSON.parse(row.tags) as string[]).includes('agreed'));
            }

            if (held.length === 0) continue;

            const ledger = db.prepare(
                'SELECT value FROM cultivator_flags WHERE cultivator_id = ? AND key = ?'
            ).get(cultivator.id, `house:${mine}`) as { value: string } | undefined;
            found = {
                rows: held,
                playerId: cultivator.id,
                standing: ledger ? JSON.parse(ledger.value).standing : null
            };
        }

        expect(found, 'no agreed bout across thirty seeds ever landed on the player').not.toBeNull();
        const opened = found!.rows[0];
        // Held by their people, about the player. Never the other way round.
        expect(opened.holder_id).not.toBe(found!.playerId);
        // And the terms are in the record, because the terms are the content: a
        // descendant inherits this row and nothing else.
        expect(JSON.parse(opened.tags)).toContain('agreed');
        expect(['grave', 'unforgivable']).toContain(opened.severity);
        // Their own house heard what it was supposed to be before it heard how
        // it ended. `spendStanding` runs the house's own arithmetic; this only
        // checks that something was actually charged.
        expect(found!.standing).not.toBeNull();
        expect(found!.standing!).toBeLessThan(50);
    }, 300_000);

    /**
     * The same event with the names the other way round, and the one a player
     * meets far more often: they asked somebody for a bout and did not walk
     * away from it. Their house holds an unforgivable feud about whoever did
     * it - between LINES rather than between people, which is what `grudges.ts`
     * keeps `blood_feud` as a separate kind for.
     *
     * Before this the ledger held nothing at all in that case. The resolver is
     * right that the dead hold nothing; the mistake was never asking anybody
     * else.
     */
    it('opens a feud for a player killed in an agreed bout, and says so', async () => {
        let opened: OpenAccount | null = null;
        let said = '';

        for (const seed of ['killed-a', 'killed-b', 'killed-c', 'killed-d'] as const) {
            const { db, game, repos } = makeGame({ seed, worldEnabled: true });
            const { cultivator } = await game.newRun('Duellist');
            repos.sects.addMember('house-anchorhold', cultivator.id, 1);
            await game.act('I look around');

            for (let bouts = 0; bouts < 8; bouts++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                const acted = await game.act('I spar with someone of my own rank');
                const held = obligations(db)
                    .filter(row => row.holder_id === 'house-anchorhold' && row.kind === 'blood_feud');
                if (held.length > 0) {
                    opened = held[0];
                    said = acted.narration;
                    // The player is the one it happened TO, so the record names
                    // somebody else.
                    expect(opened.subject_id).not.toBe(cultivator.id);
                    break;
                }
            }
            if (opened) break;
        }

        expect(opened, 'no agreed bout across four seeds ever killed the player').not.toBeNull();
        expect(opened!.severity).toBe('unforgivable');
        expect(opened!.cause).toBe('killed_kin');
        expect(JSON.parse(opened!.tags)).toContain('agreed');

        // And it reached the player. A consequence that is computed, written to
        // the ledger and never shown is the invisible half of softening: the
        // player believes nothing happened, which is the same experience as
        // nothing having happened.
        expect(said, 'the ledger moved and the turn never mentioned it')
            .toMatch(/Anchorhold|answered to somebody|answered to nobody/i);
    }, 300_000);

    /**
     * And a fight nobody agreed to is written down as a fight. The same rung of
     * the same scale, one step lighter, out of the same table - there is no
     * branch anywhere that exists only for bouts, and no house docks a member
     * for winning an ordinary confrontation.
     */
    it('writes an ordinary confrontation as an ordinary confrontation', async () => {
        let rows: OpenAccount[] = [];
        let ledger: unknown;

        for (const seed of ['open-a', 'open-b', 'open-c'] as const) {
            const { db, game, repos } = makeGame({ seed, worldEnabled: true });
            const { cultivator } = await game.newRun('Brawler');
            repos.sects.addMember('house-anchorhold', cultivator.id, 1);
            await game.act('I look around');

            for (let fights = 0; fights < 8 && rows.length === 0; fights++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                await game.act('I attack someone of my own rank');
                // The terms row, selected by the tag that is its content. A
                // fight now writes two kinds of account about the loser - see
                // the note in the agreed-bout case above - and a bare
                // `obligations(db)` picks whichever the table hands back
                // first, which is an ordering accident rather than a subject.
                rows = obligations(db).filter(row =>
                    (JSON.parse(row.tags) as string[]).some(
                        tag => tag === 'open' || tag === 'agreed'));
            }
            if (rows.length > 0) {
                ledger = db.prepare(
                    'SELECT value FROM cultivator_flags WHERE cultivator_id = ? AND key = ?'
                ).get(cultivator.id, 'house:house-anchorhold');
                break;
            }
        }

        expect(rows.length, 'no open confrontation across three seeds ever landed').toBeGreaterThan(0);
        expect(JSON.parse(rows[0].tags)).toContain('open');
        expect(JSON.parse(rows[0].tags)).not.toContain('agreed');
        // A house does not dock a member for a fight it never asked them to be
        // gentle in, so no ledger was written at all.
        expect(ledger).toBeUndefined();
    }, 300_000);
});
