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
 * The original header described a rate measurement, but these assertions
 * search for an actual breach and then check what the ledger holds. They do
 * not establish how often a peer bout breaches its terms. The existing seed
 * sets are retained. Held fights now finish all their rounds. The house-account
 * arm meets an existing ranked house member on their actual public routine
 * and matches the player's rung to theirs before preparing the player's body;
 * a starting-rung rogue with no people cannot supply a house account.
 * The ordinary-fight arm starts with a real peer in the same area and lets
 * the fight continue across rounds; birthplace and one-shot resolution were
 * stale premises for that comparison.
 * The player-death arm likewise meets a live peer through current placement.
 * Its original four seeds and eight bouts remain: each bout now plays all its
 * exchanges, because one attack sentence no longer resolves a whole fight.
 * Continuing uses the standing fight's own strike answer, bounded by its
 * body-derived round budget. Every exchange must advance that same fight or
 * conclude it: repeating a peer-selection sentence can refuse after routines
 * move the peer, leaving a non-null fight without making any combat progress.
 * The aggressor arm also has to finish each held bout. All arms meet a real
 * public peer at their current routine location, rather than at their home row.
 */

import { readFileSync } from 'node:fs';

import { parseIntent, validatePlan } from '../../src/web/actions';
import { makeGameInWorld, cultivatorRow, type Harness } from './harness';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing';
import { routineOf } from '../../src/engine/world/npc-routines';

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

/** The fixture meets somebody where their actual day puts them, then plays every round. */
async function meetAPeer(h: Pick<Harness, 'game' | 'repos'>, ofAHouse = false) {
    const me = h.game.currentRun().cultivator;
    const world = (await h.game.loadWorld())!;
    const candidates = ofAHouse ? [...world.npcs].sort((a, b) =>
        Math.abs(a.cultivation.realmOrdinal - me.realmOrdinal) - Math.abs(b.cultivation.realmOrdinal - me.realmOrdinal))
        : world.npcs;
    for (const peer of candidates) {
        if (peer.status !== 'alive' || peer.id === me.id
            || !ofAHouse && peer.cultivation.realmOrdinal !== me.realmOrdinal) continue;
        if (ofAHouse && (!peer.factionId || peer.factionRankIndex < 0
            || !world.factions.some(house => house.id === peer.factionId && house.dissolvedOnDay === null))) continue;
        const actual = routineOf(world, peer);
        const place = world.locations.find(row => row.id === actual.locationId && row.kind === 'settlement');
        if (actual.home || !place) continue;
        const area = theAreasOf(world, place).whereIs.get(peer.id);
        if (!area || area.includes('#room#')) continue;
        if (ofAHouse && peer.cultivation.realmOrdinal !== me.realmOrdinal) {
            h.repos.cultivators.advanceRealm(me.id, peer.cultivation.realmOrdinal - me.realmOrdinal);
        }
        h.repos.cultivators.update(me.id, { location: place.name });
        h.repos.cultivators.standIn(me.id, area);
        if (!h.game.present(h.game.currentRun().cultivator).some(person => person.id === peer.id)) continue;
        h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, peer);
        return peer;
    }
    throw new Error('The arranged world has no public peer to meet at this hour.');
}

async function playTheWholeFight(h: Pick<Harness, 'game' | 'db'>, sentence: string) {
    let acted = await h.game.act(sentence);
    expect(acted.toolCalls.some(call => call.ok && ['combat.round', 'combat_manage.resolve'].includes(call.name)),
        JSON.stringify(acted.toolCalls)).toBe(true);
    const remaining = h.game.fight === null ? 0
        : h.game.fight.state.roundBudget - h.game.fight.state.roundsFought;
    for (let exchange = 0; exchange < remaining && h.game.fight !== null
        && h.game.currentRun().cultivator.alive; exchange++) {
        const fightId = h.game.fight.state.id;
        const roundsBefore = h.game.fight.state.roundsFought;
        acted = await h.game.act('I keep swinging');
        expect(acted.toolCalls.some(call => call.ok && ['combat.round', 'combat_manage.resolve'].includes(call.name)),
            JSON.stringify(acted.toolCalls)).toBe(true);
        if (h.game.fight !== null) {
            expect(h.game.fight.state.id).toBe(fightId);
            expect(h.game.fight.state.roundsFought).toBeGreaterThan(roundsBefore);
        }
    }
    expect(h.game.state().fight, 'the fight ends within its own round budget').toBeNull();
    return acted;
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
     * AND A BOUT IS THE SAME VERB, at a swing two people can walk away from.
     *
     * This read *"it does not touch the GOAL handed to the resolver"* and
     * asserted `intent === 'subdue'` on a spar and `'kill'` on a killing. Both
     * were the goal model - the aggressor naming an ending in advance - and on
     * a spar it had a consequence: `subdue` returned `capture` whatever else
     * happened, so a bout could not go wrong. A bout going wrong is the one
     * thing the genre does with them constantly, and this repo has measured it
     * happening 115 times in 2,666 replays (`nobody-is-invincible.ts`).
     *
     * What is asked of the resolver now is the SWING, and the agreement rides
     * where it always belonged - on `terms`, which decides what a killing MEANT
     * rather than whether one can happen.
     */
    it('asks the resolver for a bout swing, and marks only the terms', () => {
        const bout = parseIntent('I spar with someone of my own rank');
        const fight = parseIntent('I attack someone of my own rank');

        // Bare hands, meant, nowhere in particular. Not a ceiling on harm.
        expect(bout.thrown).toEqual({ with: 'fist', at: 'unstated', force: 'committed' });
        expect(parseIntent('I kill the nearest cultivator').thrown?.force).toBe('everything');

        // The same verb at the same person. Only the agreement separates them.
        expect(bout.action).toBe(fight.action);
        expect(bout.target).toBe(fight.target);
        expect(bout.terms).toBe('agreed');
        expect(fight.terms).toBeUndefined();
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

        // ── POOLED, NOT WIDENED ──────────────────────────────────────────
        //
        // Thirty was enough while the search stopped at "any account about the
        // player", because a fight wrote exactly one kind. It now writes two -
        // see the note below - so the search has to walk past the common one
        // to reach the rare one this test is about, and thirty seeds started
        // landing on the wrong side of the draw in a pooled run while passing
        // on its own. Each seed now pins its OWN world as well, so the sample
        // is eighty known worlds rather than eighty draws from whatever the
        // process happened to build first - the bar is unchanged and the
        // sample is both bigger and reproducible.
        const seeds = Array.from({ length: 80 }, (_, n) => `bout-${n}`);
        for (const seed of seeds) {
            if (found) break;
            const { db, game, repos } = await makeGameInWorld({
                seed, worldSeed: seed, worldEnabled: true
            });
            const { cultivator } = await game.newRun('Duellist');
            const mine = 'sect-azure-cloud-pavilion';
            repos.sects.addMember(mine, cultivator.id, 1);
            await game.act('I look around');

            let held: OpenAccount[] = [];
            for (let bouts = 0; bouts < 20 && held.length === 0; bouts++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                // The account needs an actual house member. Meet one, and match
                // their rung before preparing the player's body for the search.
                const peer = await meetAPeer({ game, repos }, true);
                db.prepare(
                    'UPDATE cultivators SET hp = 5000, max_hp = 5000, battles_survived = 400 '
                    + 'WHERE id = ?'
                ).run(cultivator.id);
                db.prepare('DELETE FROM cultivator_injuries WHERE cultivator_id = ?')
                    .run(cultivator.id);
                await playTheWholeFight({ game, db }, `I spar with ${peer.name}`);
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

        expect(found, 'no agreed bout across eighty arranged worlds opened its house account').not.toBeNull();
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
            const { db, game, repos } = await makeGameInWorld({
                seed, worldSeed: seed, worldEnabled: true
            });
            const { cultivator } = await game.newRun('Duellist');
            repos.sects.addMember('house-immovable-mountain', cultivator.id, 1);
            await game.act('I look around');

            for (let bouts = 0; bouts < 8; bouts++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                const peer = await meetAPeer({ game, repos });
                const acted = await playTheWholeFight({ game, db }, `I spar with ${peer.name}`);
                const held = obligations(db)
                    .filter(row => row.holder_id === 'house-immovable-mountain' && row.kind === 'blood_feud');
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
            .toMatch(/Immovable Mountain Temple|answered to somebody|answered to nobody/i);
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
            const { db, game, repos } = await makeGameInWorld({
                seed, worldSeed: seed, worldEnabled: true
            });
            const { cultivator } = await game.newRun('Brawler');
            repos.sects.addMember('house-immovable-mountain', cultivator.id, 1);
            // A real peer in the same area, independent of the birth province.
            await meetAPeer({ game, repos });
            await game.act('I look around');

            for (let fights = 0; fights < 40 && rows.length === 0; fights++) {
                if (!cultivatorRow(db, cultivator.id).alive) break;
                const peer = await meetAPeer({ game, repos });
                await playTheWholeFight({ game, db }, `I attack ${peer.name}`);
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
                ).get(cultivator.id, 'house:house-immovable-mountain');
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
