/** The player and one real companion share the foreground's actual melee. */
import { openMelee, takeMeleeRound, assessPower, assessGap, OUTCOME_FOR_FATE,
    type CombatantInput, type ConfrontationResult, type MeleeResult, type UnfinishedMelee,
    type RoundResult } from '../engine/cultivation/combat.js';
import { takeAFightTurn, type FightAnswer, type FightTurn, type FightTurnContext } from '../engine/cultivation/unfinished-fight.js';
import { forStream } from '../engine/cultivation/rng.js';
import type { StandingFight } from './fight-answers.js';

export interface ForegroundPartyFight {
    ally: CombatantInput;
    secondAttacker?: CombatantInput;
    state: UnfinishedMelee | null;
    result: MeleeResult | null;
}

function conclusion(held: StandingFight, result: MeleeResult, ambient: FightTurnContext['ambient']): ConfrontationResult {
    const self = result.combatants.find(person => person.id === held.self.id)!;
    const enemy = result.combatants.find(person => person.id === held.opponent.id)!;
    const lost = self.felledBy !== null || self.fate === 'withdrew' || self.fate === 'crippled';
    const loser = lost ? self : enemy;
    const winner = loser.felledBy ?? (result.winningSideId === 'party'
        ? result.combatants.find(person => person.sideId === 'party' && person.fate === 'standing')?.id
        : result.winningSideId === 'attackers' ? enemy.id : null);
    const aggressor = assessPower(held.state.aggressor.input, { ambient });
    const defender = assessPower(held.state.defender.input, { ambient });
    return { outcome: lost ? OUTCOME_FOR_FATE[self.fate] : result.outcome,
        playerSideWon: !lost && result.winningSideId === 'party',
        winnerId: winner ?? null, loserId: winner ? loser.id : null,
        aggressor, defender, gap: assessGap(aggressor, defender), exchanges: result.exchanges,
        hp: result.hp, injuries: result.injuries, finished: loser.finished,
        killRequirement: loser.killRequirement, remnant: loser.remnant,
        brokenObjects: result.exchanges.flatMap(exchange => exchange.result.weapon?.broke
            ? [{ carrierId: exchange.attackerId, breakerId: exchange.defenderId, broke: exchange.result.weapon }] : []),
        obligations: result.obligations.filter(row => row.holderId === held.self.id),
        narrationHint: result.combatants.map(person => `${person.name}: ${person.fate.replace(/_/g, ' ')}.`).join(' ') };
}

export function takeTheForegroundPartyRound(held: StandingFight, answer: FightAnswer,
    ctx: FightTurnContext): FightTurn {
    const group = held.foregroundParty!;
    let completed: MeleeResult | null = null;
    const resolveRound: NonNullable<FightTurnContext['resolveRound']> = (aggressor, defender, hp, injuries, roundCtx) => {
        const selves = [aggressor, defender];
        const player = selves.find(person => person.input.id === held.self.id)!;
        const enemy = selves.find(person => person.input.id === held.opponent.id)!;
        const intents = { [player.input.id]: { ...held.state.intent, willWithdraw: false } };
        const meleeCtx = { rng: roundCtx.rng, ambient: ctx.ambient, turn: ctx.turn,
            intent: held.state.intent, intents,
            acts: { [player.input.id]: player.act, [enemy.input.id]: enemy.act },
            vectors: { [player.input.id]: player.vector, [enemy.input.id]: enemy.vector } };
        let turn = group.state ? { state: group.state, result: null } : openMelee([
            { id: 'party', name: 'the party', members: [player.input, group.ally] },
            { id: 'attackers', name: 'the attackers', members: [enemy.input,
                ...(group.secondAttacker ? [group.secondAttacker] : [])] }
        ], meleeCtx);
        if (turn.state) {
            held.state.roundBudget = turn.state.roundBudget;
            const state = { ...turn.state, hp: { ...turn.state.hp, [player.input.id]: hp[player.input.id] },
                injuries: { ...turn.state.injuries, [player.input.id]: injuries[player.input.id] } };
            turn = takeMeleeRound(state, meleeCtx);
            // A body already down has no further player action to spend. The
            // surviving foreground people finish the fight as themselves.
            while (turn.state && turn.state.hp[player.input.id] <= 0)
                turn = takeMeleeRound(turn.state, { ...meleeCtx, acts: {} });
        }
        group.state = turn.state;
        group.result = completed = turn.result;
        const allHp = turn.state?.hp ?? turn.result!.hp;
        const allWounds = turn.state?.injuries ?? turn.result!.injuries;
        Object.assign(hp, allHp); Object.assign(injuries, allWounds);
        const exchanges = (turn.state?.exchanges ?? turn.result!.exchanges).slice(held.state.exchanges.length);
        const inputOf = (original: CombatantInput) => turn.state?.fighters.find(person => person.input.id === original.id)?.input
            ?? { ...original, hp: allHp[original.id] };
        const view = (side: typeof aggressor) => { const input = inputOf(side.input);
            return { ...side, input, power: assessPower(input, { ambient: ctx.ambient }) }; };
        return { exchanges, brokenObjects: exchanges.flatMap(exchange => exchange.result.weapon?.broke
            ? [{ carrierId: exchange.attackerId, breakerId: exchange.defenderId, broke: exchange.result.weapon }] : []),
            aggressor: view(aggressor), defender: view(defender), winnerId: null, loserId: null, ending: null } satisfies RoundResult;
    };
    const turn = takeAFightTurn(held.state, answer, { ...ctx, resolveRound,
        roundConclusion: () => completed ? conclusion(held, completed, ctx.ambient) : null,
        otherCombatants: [group.ally, ...(group.secondAttacker ? [group.secondAttacker] : [])] });
    // An actual escape, yield, restraint or answered shout keeps the ordinary
    // player's ending. Those still fighting settle on their own bodies.
    if (turn.finished && !completed) {
        const meleeCtx = { rng: forStream(held.state.seed, 'party-after-player-left', held.state.id, held.state.roundsFought),
            ambient: ctx.ambient, turn: ctx.turn, intent: held.state.intent };
        let rest = group.state ? { state: structuredClone(group.state), result: null } : openMelee([
            { id: 'party', name: 'the party', members: [group.ally] },
            { id: 'attackers', name: 'the attackers', members: [held.state.aggressor.input,
                ...(group.secondAttacker ? [group.secondAttacker] : [])] }
        ], meleeCtx);
        if (rest.state) {
            rest.state.fighters = rest.state.fighters.filter(person => person.input.id !== held.self.id);
            rest.state.order = rest.state.order.filter(id => id !== held.self.id);
            while (rest.state) rest = takeMeleeRound(rest.state, meleeCtx);
        }
        group.state = null; group.result = rest.result;
        if ((answer.kind === 'yield' || answer.kind === 'spare') && rest.result?.winningSideId === 'party') {
            // The other person cannot hold a surrender or accept mercy after
            // the surviving companion has actually defeated them.
            const own = turn.finished;
            const hp = own.hp[held.self.id], wounds = own.injuries[held.self.id] ?? [];
            const power = assessPower({ ...held.self, hp }, { ambient: ctx.ambient });
            const joined: MeleeResult = { ...rest.result,
                hp: { ...rest.result.hp, [held.self.id]: hp },
                injuries: { ...rest.result.injuries, [held.self.id]: wounds },
                combatants: [...rest.result.combatants, { id: held.self.id, name: held.self.name,
                    sideId: 'party', power, hp, injuries: wounds, fate: 'standing',
                    killRequirement: power.kill, remnant: null, finished: false, felledBy: null }],
                exchanges: [...own.exchanges, ...rest.result.exchanges.slice(own.exchanges.length)] };
            turn.finished = conclusion(held, joined, ctx.ambient);
            turn.line += ` ${group.ally.name} finished the remaining fight.`;
        }
    }
    return turn;
}
