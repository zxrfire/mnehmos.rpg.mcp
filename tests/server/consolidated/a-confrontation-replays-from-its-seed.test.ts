/**
 * A confrontation replays from its seed, and a killing needs somebody to have
 * meant it.
 *
 * Two defects, both in `combat_manage`, both found while somebody was building
 * something else.
 *
 * ── ONE: THE SAME SEED PRODUCED A DIFFERENT FIGHT ────────────────────────
 *
 * The tool's own header promises that "the same call against the same state
 * returns the same fight, and a player who died can replay it", and AGENTS.md
 * makes reproducibility from the seed a rule rather than a nicety. It was not
 * true. `combat_strike`, `combat_resolve` and `combat_flee` each mixed
 * `cultivator.id` and `opponent.id` into `forStream`, and EVERY cultivator row
 * id in this engine is a `randomUUID()` - so the stream was stable inside one
 * process and meaningless outside it.
 *
 * Measured before the fix, on one seed with the world pinned so that the same
 * player met the same opponent both times: 1668 HP against 2208 HP, one
 * injury against none. That is the same class of defect `oneCrowd` in
 * `hearsay.ts` was written to fix - there the crowd's ORDER was unstated and
 * the opponent moved; here the opponent was right and the STREAM moved.
 * `resolveConfrontation` was byte-identical in both cases.
 *
 * These tests run one confrontation twice in one process against two fresh
 * databases, which is exactly the condition that used to break it: same seed,
 * same sentence, same starting state, different row ids. Every exchange is
 * compared, not just the ending, because the ending is the coarsest thing a
 * fight has and it agreed by luck often enough to hide this.
 *
 * ── TWO: THE PLAYER COULD NOT KILL ANYBODY ON RECORD ─────────────────────
 *
 * `resolve` applied the opponent's HP and their wounds and then asked
 * `evaluateDeathConditions` about the player and about nobody else. So an
 * opponent driven to nothing was AT nothing, and every system that answers a
 * killing - grudges, blood feuds, a house losing a member, the standing hit
 * for going too far in an agreed bout - was unreachable from the player's side
 * while NPCs killed each other in the simulation all day.
 *
 * The fix is deliberately not "ask the gate about both parties": an empty bar
 * reads as `combat_defeat` by default, so that would turn every spar into a
 * homicide. The resolver already knew the answer. `finishOutcome` reads the
 * aggressor's `goal` - `subdue` ends at `capture`, `humiliate` at
 * `humiliation`, `drive_off` at `withdrawal`, and only `kill` against a body
 * the tradition says is enough returns `lethal`, which is what
 * `result.finished` means. So the gate is asked exactly when the resolver says
 * a finishing happened, and the tests in the second block below are the two
 * sides of that line.
 *
 * Two things the fix does NOT do, both deliberate and both pinned below. It
 * does not touch the player's half, which still ends a run at an empty bar the
 * way it always has. And it does not reach an opponent with no cultivator row -
 * which is most of the people a played fight meets, because they live in world
 * state - so `resolve` still writes nothing at all about them. That is a
 * boundary this tool does not cross today rather than a gate it forgot to ask.
 *
 * ── AND ONE RULING THAT ARRIVES THROUGH THE SAME DOOR ────────────────────
 *
 * A realm-boundary wound locks the ability its realm exists to grant. For
 * Nascent Soul that ability is surviving the destruction of your body, so a
 * crippled nascent soul makes an ordinary killing enough - `killRequirement`
 * now reads the target's wounds, which the last test pins. The line that wires
 * it into the live path is one call in `assessPower`, and it is held out of
 * this commit because `combat.ts` is carrying another agent's unfinished work.
 */

import { handleCombatManage } from '../../../src/server/consolidated/combat-manage.js';
import { handleCultivationManage } from '../../../src/server/consolidated/cultivation-manage.js';
import { closeDb, getDb } from '../../../src/storage/index.js';
import { CultivatorRepository } from '../../../src/storage/repos/cultivator.repo.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { killRequirement } from '../../../src/engine/cultivation/tradition.js';

const ctx = { sessionId: 'confrontation-replay' };

function payload(response: { content: Array<{ text: string }> }): any {
    const text = response.content[0].text;
    const match = /<!-- [A-Z_]+_JSON\n([\s\S]*?)\n[A-Z_]+_JSON -->/.exec(text);
    return JSON.parse(match ? match[1] : text);
}

const combat = async (args: Record<string, unknown>) => payload(await handleCombatManage(args, ctx));
const cultivation = async (args: Record<string, unknown>) =>
    payload(await handleCultivationManage(args, ctx));

function realmStart(key: string): number {
    return REALM_TIERS.find(t => t.key === key)!.ordinalStart;
}

/** A fresh installation. The point of the exercise: new database, new row ids. */
function freshDb() {
    closeDb();
    return getDb(':memory:');
}

function setRank(
    db: ReturnType<typeof getDb>,
    id: string,
    ordinal: number,
    extra: Record<string, unknown> = {}
) {
    new CultivatorRepository(db).update(id, {
        realmOrdinal: ordinal,
        hp: 200,
        maxHp: 200,
        qi: 400,
        maxQi: 400,
        ...extra
    } as never);
}

/**
 * Everything the engine decided, and nothing that identifies the process.
 *
 * The ids are stripped rather than compared because they legitimately differ -
 * they are `randomUUID()`s and always were. What must not differ is a single
 * number the engine produced, so every exchange is here with its damage, its
 * roll-derived advantage, the bar after it and the wound it left.
 */
function whatHappened(result: any) {
    return {
        outcome: result.outcome,
        finished: result.finished,
        exchanges: result.exchanges.map((x: any) => ({
            index: x.index,
            damage: x.damage,
            nullified: x.nullified,
            advantage: x.advantage,
            defenderHpAfter: x.defenderHpAfter,
            injury: x.injury?.severity ?? null
        })),
        selfInjuries: result.injuries.self.map((i: any) => i.severity),
        opponentInjuries: result.injuries.opponent.map((i: any) => i.severity),
        died: result.died,
        opponentDied: result.opponentDied
    };
}

describe('a confrontation replays from its seed', () => {
    /**
     * The described-opponent case. Only one row id is in play here - the
     * player's - and it was enough on its own to make the fight differ.
     */
    it('runs the same fight twice against a described opponent', async () => {
        const run = async () => {
            freshDb();
            const created = await cultivation({
                action: 'create_cultivator',
                name: 'Shen Yue',
                seed: 'replay-seed',
                location: 'Sweptground'
            });
            setRank(getDb(), created.cultivator.id, realmStart('foundation_establishment'));
            return whatHappened(await combat({
                action: 'resolve',
                goal: 'kill',
                fightToTheEnd: true,
                opponent: {
                    name: 'a rival',
                    realmOrdinal: realmStart('foundation_establishment'),
                    maxHp: 200
                }
            }));
        };

        const first = await run();
        const second = await run();

        // Stated so a failure says which half went. A fight that never happened
        // agrees with itself trivially.
        expect(first.exchanges.length).toBeGreaterThan(1);
        expect(second).toEqual(first);
    });

    /**
     * The real-row case, where BOTH ids are `randomUUID()`s. This is the one
     * `game.ts` reaches when the person in the square has a database row.
     */
    it('runs the same fight twice against a cultivator on record', async () => {
        const run = async () => {
            freshDb();
            const created = await cultivation({
                action: 'create_cultivator',
                name: 'Shen Yue',
                seed: 'replay-seed-2',
                location: 'Sweptground'
            });
            const rival = await cultivation({
                action: 'create_cultivator',
                name: 'Wen Sho',
                kind: 'npc',
                location: 'Sweptground'
            });
            setRank(getDb(), created.cultivator.id, realmStart('foundation_establishment'));
            setRank(getDb(), rival.cultivator.id, realmStart('foundation_establishment'));

            return whatHappened(await combat({
                action: 'resolve',
                cultivatorId: created.cultivator.id,
                goal: 'subdue',
                fightToTheEnd: true,
                opponent: { cultivatorId: rival.cultivator.id }
            }));
        };

        const first = await run();
        const second = await run();

        expect(first.exchanges.length).toBeGreaterThan(1);
        expect(second).toEqual(first);
    });

    /** The same promise for the other two actions that draw from a stream. */
    it('runs the same flight twice', async () => {
        const run = async () => {
            freshDb();
            const created = await cultivation({
                action: 'create_cultivator',
                name: 'Shen Yue',
                seed: 'replay-seed-3',
                location: 'Sweptground'
            });
            setRank(getDb(), created.cultivator.id, realmStart('qi_condensation'));
            const result = await combat({
                action: 'flee',
                opponent: { name: 'a rival', realmOrdinal: realmStart('foundation_establishment') }
            });
            return {
                escaped: result.escaped,
                chance: result.chance,
                roll: result.roll,
                damage: result.damage,
                injury: result.injury?.severity ?? null
            };
        };

        expect(await run()).toEqual(await run());
    });
});

describe('the death gate is asked about the opponent too', () => {
    /**
     * The setup every test below shares: a player who will win, and a rival on
     * record whose bar can actually be emptied. `fightToTheEnd` is on so the
     * loser does not break off before the question arises - the withdrawal
     * branch is the ordinary end of a cultivation fight and it is not what
     * either of these tests is about.
     */
    async function twoOfThem(seed: string, opponentHp: number) {
        freshDb();
        const created = await cultivation({
            action: 'create_cultivator', name: 'Shen Yue', seed, location: 'Sweptground'
        });
        const rival = await cultivation({
            action: 'create_cultivator', name: 'Wen Sho', kind: 'npc', location: 'Sweptground'
        });
        setRank(getDb(), created.cultivator.id, realmStart('core_formation'), {
            hp: 4000, maxHp: 4000
        });
        setRank(getDb(), rival.cultivator.id, realmStart('foundation_establishment'), {
            hp: opponentHp, maxHp: opponentHp
        });
        return { playerId: created.cultivator.id, rivalId: rival.cultivator.id };
    }

    const stored = (id: string) => new CultivatorRepository(getDb()).getById(id)!;

    it('kills a cultivator on record when the goal was to kill', async () => {
        const { playerId, rivalId } = await twoOfThem('kill-seed', 40);

        const result = await combat({
            action: 'resolve',
            cultivatorId: playerId,
            goal: 'kill',
            fightToTheEnd: true,
            opponent: { cultivatorId: rivalId }
        });

        expect(result.outcome).toBe('lethal');
        expect(result.finished).toBe(true);
        // The engine recorded it, and recorded it about the right person.
        expect(result.opponentDied).toBe(true);
        expect(result.opponentDeath.cause).toBe('combat_defeat');
        expect(result.died).toBe(false);

        const corpse = stored(rivalId);
        expect(corpse.alive).toBe(false);
        expect(corpse.deathCause).toBe('combat_defeat');
        // And the player is still standing, which is the half that used to be
        // the only half.
        expect(stored(playerId).alive).toBe(true);
    });

    /**
     * The blast-radius test, and the reason this was not a one-line widening of
     * the gate. The bar is emptied - `fightToTheEnd` guarantees it - and
     * nobody dies, because a bout that empties somebody without meaning to
     * leaves them beaten. This is what would break if a later change asked the
     * gate about the opponent unconditionally.
     */
    it('leaves a subdued cultivator beaten rather than dead', async () => {
        const { playerId, rivalId } = await twoOfThem('subdue-seed', 40);

        const result = await combat({
            action: 'resolve',
            cultivatorId: playerId,
            goal: 'subdue',
            fightToTheEnd: true,
            opponent: { cultivatorId: rivalId }
        });

        expect(result.outcome).toBe('capture');
        expect(result.finished).toBe(false);
        expect(result.opponentDied).toBe(false);
        expect(stored(rivalId).alive).toBe(true);
    });

    /** The same, for the goal a player reaches by asking to be let off. */
    it('leaves a humiliated cultivator alive', async () => {
        const { playerId, rivalId } = await twoOfThem('humiliate-seed', 40);

        const result = await combat({
            action: 'resolve',
            cultivatorId: playerId,
            goal: 'humiliate',
            fightToTheEnd: true,
            opponent: { cultivatorId: rivalId }
        });

        expect(result.outcome).toBe('humiliation');
        expect(result.opponentDied).toBe(false);
        expect(stored(rivalId).alive).toBe(true);
    });

    /**
     * And the tradition still overrules the intent. A Drawn cultivator above
     * Nascent Soul is not ended by a body-directed killing; the resolver
     * already said so with `body_destroyed`, and nothing here converts that
     * into a death behind its back.
     */
    it('does not record a death where the body was destroyed and the person was not', async () => {
        freshDb();
        const created = await cultivation({
            action: 'create_cultivator', name: 'Shen Yue', seed: 'remnant-seed', location: 'Sweptground'
        });
        const rival = await cultivation({
            action: 'create_cultivator', name: 'Elder Rong', kind: 'npc', location: 'Sweptground'
        });
        setRank(getDb(), created.cultivator.id, 44, { hp: 9000, maxHp: 9000 });
        setRank(getDb(), rival.cultivator.id, realmStart('nascent_soul'), {
            hp: 40, maxHp: 40, traditionId: 'tradition-drawn'
        });

        const result = await combat({
            action: 'resolve',
            cultivatorId: created.cultivator.id,
            goal: 'kill',
            fightToTheEnd: true,
            opponent: { cultivatorId: rival.cultivator.id }
        });

        expect(result.outcome).toBe('body_destroyed');
        expect(result.finished).toBe(false);
        expect(result.opponentDied).toBe(false);
    });

    /**
     * And the same person, carrying the wound that says otherwise.
     *
     * A realm-boundary wound locks the ability its realm exists to grant, and
     * what Nascent Soul grants is surviving the loss of your own body.
     * `wounds.ts` states it in the row - "mortal in the way that matters:
     * destroy the body and they are gone" - and `killRequirement` is the one
     * live door that sentence can arrive through, because `existence.ts`, which
     * looks like the natural home for it, has no caller in `src/` at all.
     *
     * ── WHY THIS IS ASKED OF THE RULE AND NOT OF THE RESOLVER ────────────
     *
     * It should be a pair to the `body_destroyed` test above it, differing only
     * by the wound. It is not, and the reason is contention rather than
     * design: the wiring line - `killRequirement(tradition, ordinal,
     * combatant.injuries)` in `assessPower` - lives in `combat.ts`, which is
     * carrying another agent's unfinished work, so it is not in this commit.
     * The rule is committed and pinned; when that file lands, the pair to the
     * test above becomes writable and should be written.
     *
     * Both retired and current keys, because a cultivator saved under the old
     * name is still carrying the same wound and must still be mortal.
     */
    it('makes an ordinary killing enough for a crippled nascent soul', () => {
        const wound = (key: string) => ([{
            id: 'w', severity: 'crippling', source: 'failed_breakthrough',
            description: 'The infant soul was born and did not finish forming.',
            sustainedOnTurn: 0, treated: false,
            cultivationPenalty: 0, breakthroughPenalty: 0, woundType: key
        }] as never);

        // The ladder's ordinary answer at this rung, and the one the wound
        // overturns. Stated so the test cannot pass by the rung being wrong.
        const whole = killRequirement('tradition-drawn', 24);
        expect(whole.bodyIsEnough).toBe(false);
        expect(whole.remnant).toBe('soul');

        for (const key of ['crippled-nascent-soul', 'unformed-nascent-soul']) {
            const crippled = killRequirement('tradition-drawn', 24, wound(key));
            expect(crippled.bodyIsEnough, key).toBe(true);
            expect(crippled.remnant, key).toBeNull();
        }

        // Treated, it is not this wound any more and the rung answers again.
        const treated = killRequirement('tradition-drawn', 24, [{
            ...(wound('crippled-nascent-soul') as any)[0], treated: true
        }] as never);
        expect(treated.bodyIsEnough).toBe(false);

        // An unknown carries the ordinary rule. A caller that did not pass
        // wounds has not claimed the person is whole.
        expect(killRequirement('tradition-drawn', 24, []).bodyIsEnough).toBe(false);

        // And a carver is untouched: their answer was never about a soul
        // leaving a body.
        expect(killRequirement('tradition-cut', 24, wound('crippled-nascent-soul')).bodyIsEnough)
            .toBe(false);
    });
});
