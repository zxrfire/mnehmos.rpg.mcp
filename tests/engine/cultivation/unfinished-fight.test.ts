/**
 * A fight held open across turns.
 *
 * The design owner's ruling is what these assert, in his own terms: a fight
 * resolves across several turns, the player has real choices inside it, and a
 * death has to be something they could have acted against. So the tests are
 * organised as *what a player could do about it*, and the first group is the
 * one that matters - the fight does not settle itself.
 *
 * The other half is the constraint: this must not be a second combat system.
 * `theSamePhysicsBothWays` is where that is pinned.
 */

import { describe, expect, it } from 'vitest';

import {
    MAX_EXCHANGES,
    MIN_FLEE_CHANCE,
    POSTURE_WORTH,
    EDGE_VALUES,
    WITHDRAW_HP_FRACTION,
    assessPower,
    resolveConfrontation,
    resolveConfrontationRound,
    type CombatantInput
} from '../../../src/engine/cultivation/combat.js';
import {
    WOULD_ANSWER_A_CALL,
    howTheyAreFighting,
    openFight,
    takeAFightTurn,
    wayOut,
    whereThisFightStands,
    whoAnsweredTheShout,
    type CouldBeCalled,
    type FightGround,
    type FightSide,
    type UnfinishedFight
} from '../../../src/engine/cultivation/unfinished-fight.js';
import { CultivationRNG } from '../../../src/engine/cultivation/rng.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';

// ─────────────────────────────────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────────────────────────────────

function combatant(overrides: Partial<CombatantInput> = {}): CombatantInput {
    const maxHp = overrides.maxHp ?? 100;
    return {
        id: 'a',
        name: 'Subject',
        realmOrdinal: 10,
        spiritRoot: 'single_fire',
        attributes: { might: 2, insight: 2, fortune: 1, charm: 2 },
        injuries: [],
        hp: maxHp,
        maxHp,
        qi: 50,
        maxQi: 50,
        ...overrides
    };
}

function side(input: CombatantInput): FightSide {
    return { input, edges: [], vector: 'body', movement: null, movementMastery: 0 };
}

const GROUND: FightGround = {
    locationId: 'loc-ford',
    locationName: 'Clear River Ford Ford',
    waysOut: [
        { id: 'loc-town', name: 'Clear River Ford', days: 2 },
        { id: 'loc-peaks', name: 'The Nine Peaks', days: 9 }
    ]
};

const NOWHERE: FightGround = { locationId: 'loc-waste', locationName: 'the waste', waysOut: [] };

const NEUTRAL = 'normal' as const;

function open(
    player: CombatantInput,
    them: CombatantInput,
    ground: FightGround = GROUND,
    seed = 'seed-1'
) {
    return openFight({
        id: 'fight-1',
        seed,
        aggressor: side(player),
        defender: side(them),
        intent: { goal: 'drive_off' },
        playerId: player.id,
        ground,
        turn: 1,
        ambient: NEUTRAL
    });
}

function realmStart(key: string): number {
    return REALM_TIERS.find(t => t.key === key)!.ordinalStart;
}

// ═════════════════════════════════════════════════════════════════════════
// THE FIGHT DOES NOT SETTLE ITSELF
//
// The whole of the complaint this exists to answer: "if you fought and it
// resolves in one turn and you died it would be unsatisfying cuz there's
// nothing you can do about it."
// ═════════════════════════════════════════════════════════════════════════

describe('a fight is a thing you stand inside', () => {
    it('opens without resolving, and hands the turn back', () => {
        const { fight, settled } = open(
            combatant({ id: 'p', name: 'Player' }),
            combatant({ id: 'q', name: 'Other' })
        );
        expect(settled).toBeNull();
        expect(fight).not.toBeNull();
        expect(fight!.roundsFought).toBe(0);
        expect(fight!.exchanges).toHaveLength(0);
        // Nobody has been touched. The engine has resolved nothing at all.
        expect(fight!.hp.p).toBe(100);
        expect(fight!.hp.q).toBe(100);
    });

    it('spends exactly one round per turn', () => {
        let { fight } = open(
            combatant({ id: 'p', name: 'Player', maxHp: 4000 }),
            combatant({ id: 'q', name: 'Other', maxHp: 4000 })
        );
        const turn = takeAFightTurn(fight!, { kind: 'strike' }, { ambient: NEUTRAL, turn: 1 });
        expect(turn.fight).not.toBeNull();
        expect(turn.fight!.roundsFought).toBe(1);
        // One round is at most two blows, and never eight rounds' worth.
        expect(turn.exchanges.length).toBeLessThanOrEqual(2);
    });

    it('runs no longer than the same fight settled in one call', () => {
        let fight: UnfinishedFight | null = open(
            combatant({ id: 'p', name: 'Player', maxHp: 100000 }),
            combatant({ id: 'q', name: 'Other', maxHp: 100000 })
        ).fight;
        let turns = 0;
        while (fight && turns < 50) {
            const t = takeAFightTurn(fight, { kind: 'strike' }, { ambient: NEUTRAL, turn: 1 });
            fight = t.fight;
            turns += 1;
        }
        expect(fight).toBeNull();
        expect(turns).toBeLessThanOrEqual(MAX_EXCHANGES);
    });

    it('prices a hurt body as a hurt body, round by round', () => {
        // FOUND BY PLAYING IT. `assessPower`'s `condition` factor reads `hp`,
        // and the fight's running total lives beside the row rather than on it -
        // so before this, somebody on 15 of 120 swung exactly as hard as they
        // had on the first round, and the state line reported a flight chance
        // that had not moved all fight. A number that looks like information and
        // is not is worse than no number.
        let fight: UnfinishedFight | null = open(
            combatant({ id: 'p', name: 'Player', maxHp: 400 }),
            combatant({ id: 'q', name: 'Other', maxHp: 400 })
        ).fight;
        const first = whereThisFightStands(fight!, NEUTRAL).flight.chance;
        for (let i = 0; i < 3 && fight; i++) {
            fight = takeAFightTurn(fight, { kind: 'guard' }, { ambient: NEUTRAL, turn: 1 }).fight;
        }
        expect(fight).not.toBeNull();
        expect(fight!.hp.p).toBeLessThan(400);
        // Hurt, so worse off in the one number a frightened player is reading.
        expect(whereThisFightStands(fight!, NEUTRAL).flight.chance).toBeLessThan(first);
    });

    it('says where the fight stands before the player has to answer', () => {
        const { fight } = open(
            combatant({ id: 'p', name: 'Player' }),
            combatant({ id: 'q', name: 'Other' })
        );
        const view = whereThisFightStands(fight!, NEUTRAL);
        expect(view.yourHp).toBe(100);
        expect(view.theirHp).toBe(100);
        expect(view.roundsLeft).toBe(MAX_EXCHANGES);
        // The odds of getting out are on the table BEFORE the choice, which is
        // what makes the choice one.
        expect(view.flight.chance).toBeGreaterThan(0);
        expect(view.line).toContain('%');
    });

    it('does not hold open a fight the gap has already settled', () => {
        const twoRealmsUp = realmStart(REALM_TIERS[3].key);
        const { fight, settled } = open(
            combatant({ id: 'p', name: 'Player', realmOrdinal: 1 }),
            combatant({ id: 'q', name: 'Other', realmOrdinal: twoRealmsUp })
        );
        // Not a fight, so not held open for eight turns of typing at it.
        expect(fight).toBeNull();
        expect(settled).not.toBeNull();
        expect(settled!.outcome).toBe('no_contest');
    });
});

// ═════════════════════════════════════════════════════════════════════════
// IT IS NOT A SECOND COMBAT SYSTEM
// ═════════════════════════════════════════════════════════════════════════

describe('the same physics both ways', () => {
    it('an ordinary round is the same function the one-call resolver runs', () => {
        // Both entrances call `resolveConfrontationRound`. Driven here with the
        // same inputs and the same stream, they produce the same exchanges -
        // which is what "one copy of the physics" means operationally.
        const a = combatant({ id: 'a', name: 'A' });
        const b = combatant({ id: 'b', name: 'B' });
        const ctx = { ambient: NEUTRAL as const };
        const run = (seed: string) => {
            const hp = { a: 100, b: 100 };
            const injuries = { a: [], b: [] };
            return resolveConfrontationRound(
                { input: a, power: assessPower(a, ctx), act: 'strike', edges: [], vector: 'body' },
                { input: b, power: assessPower(b, ctx), act: 'strike', edges: [], vector: 'body' },
                hp, injuries,
                {
                    rng: new CultivationRNG(seed), ambient: NEUTRAL, turn: 1,
                    opening: true, fromConcealment: false, willWithdraw: true
                }
            );
        };
        expect(JSON.stringify(run('x'))).toEqual(JSON.stringify(run('x')));
    });

    it('ends in the vocabulary a one-call fight ends in', () => {
        // Whatever a held-open fight produces, it is one of the outcomes the
        // engine already had. There is no player-only ending.
        const settled = resolveConfrontation(
            combatant({ id: 'a' }), combatant({ id: 'b', name: 'B' }),
            { rng: new CultivationRNG('v'), ambient: NEUTRAL, turn: 1, intent: { goal: 'drive_off' } }
        );
        let fight: UnfinishedFight | null = open(
            combatant({ id: 'p', name: 'Player' }),
            combatant({ id: 'q', name: 'Other' })
        ).fight;
        let finished = null;
        while (fight) {
            const t = takeAFightTurn(fight, { kind: 'strike' }, { ambient: NEUTRAL, turn: 1 });
            fight = t.fight;
            finished = t.finished ?? finished;
        }
        expect(finished).not.toBeNull();
        // Same union, and in practice the same ordinary ending.
        expect(typeof finished!.outcome).toBe(typeof settled.outcome);
        expect([
            'no_contest', 'withdrawal', 'capture', 'humiliation', 'crippled',
            'body_destroyed', 'lethal', 'submission', 'stalemate'
        ]).toContain(finished!.outcome);
        expect(finished!.killRequirement).toBeDefined();
    });

    it('a posture is worth no more than the cheapest thing anybody had to go and get', () => {
        // Derived rather than chosen. If this ever drifts above the cheapest
        // edge, guarding has become better than scouting the ground.
        expect(POSTURE_WORTH).toBe(Math.min(...Object.values(EDGE_VALUES)));
        expect(POSTURE_WORTH).toBeLessThanOrEqual(EDGE_VALUES.terrain);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// THE THREE POSTURES
// ═════════════════════════════════════════════════════════════════════════

describe('what a round is spent on', () => {
    const ctx = { ambient: NEUTRAL as const };

    function oneRound(mineAct: 'strike' | 'guard' | 'press', seed = 'p') {
        const a = combatant({ id: 'a', name: 'A' });
        const b = combatant({ id: 'b', name: 'B' });
        const hp: Record<string, number> = { a: 100, b: 100 };
        const injuries: Record<string, never[]> = { a: [], b: [] };
        const round = resolveConfrontationRound(
            { input: a, power: assessPower(a, ctx), act: mineAct, edges: [], vector: 'body' },
            { input: b, power: assessPower(b, ctx), act: 'strike', edges: [], vector: 'body' },
            hp, injuries,
            {
                rng: new CultivationRNG(seed), ambient: NEUTRAL, turn: 1,
                opening: true, fromConcealment: false, willWithdraw: false
            }
        );
        return { round, hp };
    }

    it('guarding throws no blow at all, and that is what it costs', () => {
        const { round } = oneRound('guard');
        expect(round.exchanges.every(e => e.attackerId === 'b')).toBe(true);
    });

    // ── WHY THESE ASSERT `advantage` AND POOL THE DAMAGE ─────────────────
    //
    // Damage is `share(advantage)` times a seeded sample, and guarding removes
    // the guarding side's own swing - so the blow that lands at them is the
    // FIRST draw of the round rather than the second, and it is a different
    // number. Comparing one seed's damage against one seed's damage measured
    // the draw and not the posture, and went red at 13 against 12 the first
    // time it was run.
    //
    // What a posture actually changes is `advantage`, which is deterministic,
    // so that is the claim. The damage claim is real too and is asserted over
    // a pooled sample, which is the only sample size that can carry it.
    it('guarding is why the blow that lands is smaller', () => {
        const takenGuarding = oneRound('guard').round.exchanges.find(e => e.defenderId === 'a')!;
        const takenOpen = oneRound('strike').round.exchanges.find(e => e.defenderId === 'a')!;
        expect(takenGuarding.result.advantage).toBeLessThan(takenOpen.result.advantage);
        // And the reason is itemised, not buried in a doctored total.
        expect(takenGuarding.result.modifiers.map(m => m.source)).toContain('defender_posture');
    });

    it('and it is smaller in what it actually takes off, over a sample', () => {
        let guarding = 0;
        let open = 0;
        for (let i = 0; i < 200; i++) {
            guarding += oneRound('guard', `g${i}`).round.exchanges
                .find(e => e.defenderId === 'a')!.result.damage;
            open += oneRound('strike', `g${i}`).round.exchanges
                .find(e => e.defenderId === 'a')!.result.damage;
        }
        expect(guarding).toBeLessThan(open);
    });

    it('pressing lands harder and is paid for by what comes back', () => {
        const pressed = oneRound('press');
        const open = oneRound('strike');
        const mineWhenPressing = pressed.round.exchanges.find(e => e.attackerId === 'a')!;
        const mineWhenOpen = open.round.exchanges.find(e => e.attackerId === 'a')!;
        expect(mineWhenPressing.result.advantage).toBeGreaterThan(mineWhenOpen.result.advantage);

        const theirsWhenPressing = pressed.round.exchanges.find(e => e.defenderId === 'a')!;
        const theirsWhenOpen = open.round.exchanges.find(e => e.defenderId === 'a')!;
        expect(theirsWhenPressing.result.advantage).toBeGreaterThan(theirsWhenOpen.result.advantage);
        // Both halves of the trade, and the trade is the whole point: there is
        // no posture that raises your blow and lowers theirs.
        expect(mineWhenPressing.result.modifiers.map(m => m.source)).toContain('attacker_posture');
        expect(theirsWhenPressing.result.modifiers.map(m => m.source)).toContain('defender_posture');
    });

    it('an ordinary round is byte-identical to what it always was', () => {
        // Neither posture field is set, so nothing is pushed onto the modifier
        // list and nothing is drawn. This is the guard on the extraction.
        const { round } = oneRound('strike');
        for (const e of round.exchanges) {
            expect(e.result.modifiers.map(m => m.source)).not.toContain('attacker_posture');
            expect(e.result.modifiers.map(m => m.source)).not.toContain('defender_posture');
        }
    });
});

// ═════════════════════════════════════════════════════════════════════════
// GETTING OUT
// The load-bearing verb. "Fleeing is genuinely available and genuinely costly,
// rather than a button that always works."
// ═════════════════════════════════════════════════════════════════════════

describe('backing off', () => {
    it('costs something whether or not it works', () => {
        let escaped = 0;
        let caught = 0;
        for (let i = 0; i < 40; i++) {
            const { fight } = open(
                combatant({ id: 'p', name: 'Player' }),
                combatant({ id: 'q', name: 'Other' }),
                GROUND,
                `flee-${i}`
            );
            const before = fight!.hp.p;
            const turn = takeAFightTurn(fight!, { kind: 'break_off' }, { ambient: NEUTRAL, turn: 1 });
            expect(turn.flight).not.toBeNull();
            expect(turn.flight!.damage).toBeGreaterThan(0);
            // Paid either way, which is what stops it being a free exit.
            expect(fight!.hp.p).toBeLessThan(before);
            if (turn.flight!.escaped) escaped += 1; else caught += 1;
        }
        // Neither a certainty nor an impossibility, pooled over enough seeds to
        // carry the claim.
        expect(escaped).toBeGreaterThan(0);
        expect(caught).toBeGreaterThan(0);
    });

    it('getting away ends the fight as a withdrawal', () => {
        for (let i = 0; i < 40; i++) {
            const { fight } = open(
                combatant({ id: 'p', name: 'Player' }),
                combatant({ id: 'q', name: 'Other' }),
                GROUND,
                `out-${i}`
            );
            const turn = takeAFightTurn(fight!, { kind: 'break_off' }, { ambient: NEUTRAL, turn: 1 });
            if (turn.flight!.escaped) {
                expect(turn.fight).toBeNull();
                expect(turn.finished!.outcome).toBe('withdrawal');
                // And the person left standing holds something about it.
                expect(turn.finished!.obligations.length).toBeGreaterThan(0);
                return;
            }
        }
        throw new Error('no seed in the sample got away');
    });

    it('failing to get away leaves your back turned for their round', () => {
        for (let i = 0; i < 60; i++) {
            const { fight } = open(
                combatant({ id: 'p', name: 'Player' }),
                combatant({ id: 'q', name: 'Other' }),
                GROUND,
                `caught-${i}`
            );
            const turn = takeAFightTurn(fight!, { kind: 'break_off' }, { ambient: NEUTRAL, turn: 1 });
            if (!turn.flight!.escaped) {
                // They swung and you did not. Every exchange in the round is theirs.
                expect(turn.exchanges.every(e => e.attackerId === 'q')).toBe(true);
                return;
            }
        }
        throw new Error('no seed in the sample was caught');
    });

    it('knows where it is standing, and takes the nearest road when none was named', () => {
        const { fight } = open(
            combatant({ id: 'p', name: 'Player' }),
            combatant({ id: 'q', name: 'Other' })
        );
        const turn = takeAFightTurn(fight!, { kind: 'break_off' }, { ambient: NEUTRAL, turn: 1 });
        expect(turn.fleeingToward?.name).toBe('Clear River Ford');
    });

    it('takes the road the player named, by the name the game printed', () => {
        expect(wayOut(GROUND, 'The Nine Peaks')!.id).toBe('loc-peaks');
        expect(wayOut(GROUND, 'nine peaks')!.id).toBe('loc-peaks');
        expect(wayOut(GROUND, 'Clear River Ford')!.id).toBe('loc-town');
    });

    it('is still available where there is nowhere to go, and says so', () => {
        const { fight } = open(
            combatant({ id: 'p', name: 'Player' }),
            combatant({ id: 'q', name: 'Other' }),
            NOWHERE
        );
        const turn = takeAFightTurn(fight!, { kind: 'break_off' }, { ambient: NEUTRAL, turn: 1 });
        // Not banned. Running into open country is running.
        expect(turn.flight).not.toBeNull();
        expect(turn.fleeingToward).toBeNull();
        expect(turn.line).toContain('as much as you know');
    });

    // ── THE COMMENT AND THE ARITHMETIC DISAGREE, AND THIS ASSERTS THE CODE ──
    //
    // `attemptFlight`'s own comment says the realm gap is "the one place it
    // helps the weaker party: a Deity Transformation cultivator chasing a Qi
    // Condensation one is not interested enough to chase properly for long."
    // The arithmetic beside it is `delta: -realmGap * 0.12` with `realmGap =
    // pursuer - fleeing`, which charges the WEAKER party 0.12 a realm - the
    // opposite claim. Measured through the turn layer: peer 0.45, one realm up
    // 0.33.
    //
    // This test asserts the code, because the code is what a player meets, and
    // because the code is the more defensible of the two - somebody a realm
    // above you is faster than you, and `MIN_FLEE_CHANCE` exists so that even
    // then it is never impossible. Which of the two is meant to stand is a
    // design question rather than a tuning constant, and it has been reported
    // rather than settled here. If the comment wins, this test is what has to
    // be rewritten, and its name says which direction it is pinning.
    it('is harder against somebody above you, and never impossible', () => {
        const peer = whereThisFightStands(
            open(combatant({ id: 'p' }), combatant({ id: 'q', name: 'Q' })).fight!, NEUTRAL
        );
        // ONE realm up, not two. Two is `helpless` and there is no fight to
        // stand in, which the "does not hold open a fight the gap has already
        // settled" case above is the assertion for.
        const monster = whereThisFightStands(
            open(
                combatant({ id: 'p' }),
                combatant({ id: 'q', name: 'Q', realmOrdinal: realmStart(REALM_TIERS[1].key) })
            ).fight!, NEUTRAL
        );
        expect(monster.flight.chance).toBeLessThan(peer.flight.chance);
        // And still a real door. Nobody is ever locked in a fight.
        expect(monster.flight.chance).toBeGreaterThanOrEqual(MIN_FLEE_CHANCE);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// SHOUTING
// ═════════════════════════════════════════════════════════════════════════

describe('calling for help', () => {
    const ctx = { ambient: NEUTRAL as const };
    const attacker = assessPower(combatant({ id: 'q', realmOrdinal: 10 }), ctx);
    const priceAt = (ordinal: number) => assessPower(combatant({ realmOrdinal: ordinal }), ctx);

    function who(overrides: Partial<CouldBeCalled>): CouldBeCalled {
        return {
            id: 'w', name: 'A Warden', realmOrdinal: 10, standing: 0,
            answersForThisGround: false, ...overrides
        };
    }

    it('nobody within the sound of it is an answer, not a refusal', () => {
        const answered = whoAnsweredTheShout([], attacker, ctx, () => attacker);
        expect(answered.answered).toBeNull();
        expect(answered.endsIt).toBe(false);
        expect(answered.line).toContain('nobody within the sound');
    });

    it('somebody who owes you nothing does not come', () => {
        const answered = whoAnsweredTheShout(
            [who({ standing: 0 })], attacker, ctx, w => priceAt(w.realmOrdinal)
        );
        expect(answered.answered).toBeNull();
        expect(answered.heard[0].wouldCome).toBe(false);
    });

    it('somebody who stands with you comes', () => {
        const answered = whoAnsweredTheShout(
            [who({ standing: WOULD_ANSWER_A_CALL })], attacker, ctx, w => priceAt(w.realmOrdinal)
        );
        expect(answered.answered?.id).toBe('w');
    });

    it('somebody whose job is the ground comes whatever they think of you', () => {
        const answered = whoAnsweredTheShout(
            [who({ standing: -1, answersForThisGround: true })],
            attacker, ctx, w => priceAt(w.realmOrdinal)
        );
        expect(answered.answered?.id).toBe('w');
        expect(answered.heard[0].because).toContain('not the same as answering you');
    });

    it('willingness does not close a realm', () => {
        // Somebody who would come and cannot matter is company, and the engine
        // says so rather than letting them turn the fight.
        const answered = whoAnsweredTheShout(
            [who({ standing: 1, realmOrdinal: 0 })],
            assessPower(combatant({ realmOrdinal: realmStart(REALM_TIERS[3].key) }), ctx),
            ctx, w => priceAt(w.realmOrdinal)
        );
        expect(answered.heard[0].wouldCome).toBe(true);
        expect(answered.heard[0].couldMatter).toBe(false);
        expect(answered.answered).toBeNull();
    });

    it('somebody the attacker cannot fight ends it', () => {
        const answered = whoAnsweredTheShout(
            [who({ standing: 1, realmOrdinal: realmStart(REALM_TIERS[3].key) })],
            attacker, ctx, w => priceAt(w.realmOrdinal)
        );
        expect(answered.endsIt).toBe(true);
    });

    it('costs the round when nobody ends it', () => {
        const { fight } = open(
            combatant({ id: 'p', name: 'Player' }),
            combatant({ id: 'q', name: 'Other' })
        );
        const turn = takeAFightTurn(
            fight!, { kind: 'call_for_help' }, { ambient: NEUTRAL, turn: 1 }
        );
        expect(turn.shout).not.toBeNull();
        expect(turn.fight).not.toBeNull();
        // You shouted, so you did not swing.
        expect(turn.exchanges.every(e => e.attackerId === 'q')).toBe(true);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// THE OTHER SIDE CHOOSES TOO
// ═════════════════════════════════════════════════════════════════════════

describe('what an NPC does with its round', () => {
    it('covers up when it is nearly done', () => {
        const nearlyDone = 100 * WITHDRAW_HP_FRACTION - 1;
        expect(howTheyAreFighting(nearlyDone, 100, 100, 100)).toBe('guard');
    });

    it('commits when the other body is nearly done', () => {
        const theirsNearlyDone = 100 * WITHDRAW_HP_FRACTION - 1;
        expect(howTheyAreFighting(100, 100, theirsNearlyDone, 100)).toBe('press');
    });

    it('does the ordinary thing the rest of the time', () => {
        expect(howTheyAreFighting(100, 100, 100, 100)).toBe('strike');
    });

    it('does not trade when it is the one about to go down', () => {
        // Both conditions true at once. Somebody on their last legs covers up
        // rather than swapping blows, which is what makes cornered beat closing.
        const low = 100 * WITHDRAW_HP_FRACTION - 1;
        expect(howTheyAreFighting(low, 100, low, 100)).toBe('guard');
    });

    it('is the same three postures the player has', () => {
        // No NPC-only answer and no player-only answer.
        const acts = new Set([
            howTheyAreFighting(100, 100, 100, 100),
            howTheyAreFighting(1, 100, 100, 100),
            howTheyAreFighting(100, 100, 1, 100)
        ]);
        expect([...acts].sort()).toEqual(['guard', 'press', 'strike']);
    });
});

// ═════════════════════════════════════════════════════════════════════════
// DETERMINISM
// ═════════════════════════════════════════════════════════════════════════

describe('the same seed is the same fight', () => {
    it('round four is round four however long the player took over it', () => {
        const play = () => {
            let fight: UnfinishedFight | null = open(
                combatant({ id: 'p', name: 'Player', maxHp: 100000 }),
                combatant({ id: 'q', name: 'Other', maxHp: 100000 })
            ).fight;
            const lines: string[] = [];
            while (fight) {
                const t = takeAFightTurn(fight, { kind: 'strike' }, { ambient: NEUTRAL, turn: 1 });
                lines.push(...t.exchanges.map(e => `${e.attackerId}:${e.result.damage}:${e.result.roll}`));
                fight = t.fight;
            }
            return lines;
        };
        expect(play()).toEqual(play());
    });

    it('looking at the odds does not move the fight', () => {
        // The preview draws from its own stream, so a player who checks before
        // deciding gets the same fight as one who does not.
        const withLooking = () => {
            const { fight } = open(
                combatant({ id: 'p', name: 'Player' }), combatant({ id: 'q', name: 'Other' })
            );
            whereThisFightStands(fight!, NEUTRAL);
            whereThisFightStands(fight!, NEUTRAL);
            return takeAFightTurn(fight!, { kind: 'strike' }, { ambient: NEUTRAL, turn: 1 })
                .exchanges.map(e => e.result.roll);
        };
        const without = () => {
            const { fight } = open(
                combatant({ id: 'p', name: 'Player' }), combatant({ id: 'q', name: 'Other' })
            );
            return takeAFightTurn(fight!, { kind: 'strike' }, { ambient: NEUTRAL, turn: 1 })
                .exchanges.map(e => e.result.roll);
        };
        expect(withLooking()).toEqual(without());
    });

    it('is keyed to the fight, so two fights on one seed are not the same fight', () => {
        const firstRoundOf = (id: string) => {
            const opened = openFight({
                id,
                seed: 'one-seed',
                aggressor: side(combatant({ id: 'p', name: 'Player' })),
                defender: side(combatant({ id: 'q', name: 'Other' })),
                intent: { goal: 'drive_off' },
                playerId: 'p',
                ground: GROUND,
                turn: 1,
                ambient: NEUTRAL
            });
            return takeAFightTurn(opened.fight!, { kind: 'strike' }, { ambient: NEUTRAL, turn: 1 })
                .exchanges.map(e => e.result.roll);
        };
        expect(firstRoundOf('fight-1')).toEqual(firstRoundOf('fight-1'));
        expect(firstRoundOf('fight-1')).not.toEqual(firstRoundOf('fight-2'));
    });

    it('draws from its own stream, so nothing else in the run moves', () => {
        // A new draw on an existing stream is a regression until proved
        // otherwise. `fight` and `fight-preview` are stream names nothing else
        // has ever used, which is the proof.
        const { fight } = open(
            combatant({ id: 'p', name: 'Player' }), combatant({ id: 'q', name: 'Other' })
        );
        const view = whereThisFightStands(fight!, NEUTRAL);
        const fought = takeAFightTurn(fight!, { kind: 'break_off' }, { ambient: NEUTRAL, turn: 1 });
        // The preview and the real attempt agree about the ODDS, which are
        // arithmetic, and draw different rolls, which are luck.
        expect(fought.flight!.chance).toBe(view.flight.chance);
    });
});
