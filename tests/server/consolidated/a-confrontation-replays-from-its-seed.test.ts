/**
 * The same seeded confrontation against the same state keeps its mechanics.
 * Random row ids once changed one measured fight from 1668 HP to 2208 HP,
 * with one injury instead of none. These paired runs compare every exchange.
 * Whole-run reproducibility is not required by the current design.
 *
 * Opponent outcomes must reach the database too. A completed killing ends the
 * opponent; capture and humiliation leave them alive. Bodily destruction now
 * asks the existence resolver what remains. An unprepared remnant ends the
 * person even when the combat resolver's soul-finishing requirement is unmet.
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
                location: 'Burnt Earth'
            });
            setRank(getDb(), created.cultivator.id, realmStart('foundation_establishment'));
            return whatHappened(await combat({
                action: 'resolve',
                thrown: { with: 'edge', at: 'throat', force: 'everything' },
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
                location: 'Burnt Earth'
            });
            const rival = await cultivation({
                action: 'create_cultivator',
                name: 'Wen Sho',
                kind: 'npc',
                location: 'Burnt Earth'
            });
            setRank(getDb(), created.cultivator.id, realmStart('foundation_establishment'));
            setRank(getDb(), rival.cultivator.id, realmStart('foundation_establishment'));

            return whatHappened(await combat({
                action: 'resolve',
                cultivatorId: created.cultivator.id,
                thrown: { with: 'fist', at: 'unstated', force: 'committed' },
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
                location: 'Burnt Earth'
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
            action: 'create_cultivator', name: 'Shen Yue', seed, location: 'Burnt Earth'
        });
        const rival = await cultivation({
            action: 'create_cultivator', name: 'Wen Sho', kind: 'npc', location: 'Burnt Earth'
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
            thrown: { with: 'edge', at: 'throat', force: 'everything' },
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
            thrown: { with: 'fist', at: 'unstated', force: 'committed' },
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
            toMakeAnExampleOfThem: true,
            fightToTheEnd: true,
            opponent: { cultivatorId: rivalId }
        });

        expect(result.outcome).toBe('humiliation');
        expect(result.opponentDied).toBe(false);
        expect(stored(rivalId).alive).toBe(true);
    });

    /**
     * A body-directed victory still reports an unfinished soul requirement.
     * The existence resolver now records the person's ending and any remnant;
     * a remnant is not the person (engine/cultivation/README.md).
     */
    it('records the existence resolver ending when the body is destroyed', async () => {
        freshDb();
        const created = await cultivation({
            action: 'create_cultivator', name: 'Shen Yue', seed: 'remnant-seed', location: 'Burnt Earth'
        });
        const rival = await cultivation({
            action: 'create_cultivator', name: 'Elder Rong', kind: 'npc', location: 'Burnt Earth'
        });
        setRank(getDb(), created.cultivator.id, 44, { hp: 9000, maxHp: 9000 });
        setRank(getDb(), rival.cultivator.id, realmStart('nascent_soul'), {
            hp: 40, maxHp: 40, traditionId: 'tradition-drawn'
        });

        const result = await combat({
            action: 'resolve',
            cultivatorId: created.cultivator.id,
            thrown: { with: 'edge', at: 'throat', force: 'everything' },
            fightToTheEnd: true,
            opponent: { cultivatorId: rival.cultivator.id }
        });

        expect(result.outcome).toBe('body_destroyed');
        expect(result.finished).toBe(false);
        expect(result.opponentDied).toBe(true);
        expect(stored(rival.cultivator.id).alive).toBe(false);
        expect(['remnant', 'physically_dead']).toContain(stored(rival.cultivator.id).existenceState);
    });

    /**
     * The soul-boundary wound removes the body's survival route. Both the
     * retired and current wound keys are read by the live combat assessment;
     * treatment restores the tradition's ordinary finishing requirement.
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
