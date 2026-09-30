/** A personal bond keeps the named person; it does not create a sect recruit. */
import type { Cultivator, Run } from '../schema/cultivation.js';
import { forStream } from '../engine/cultivation/rng.js';
import { whetherYouMayTake, whatABondOpens } from '../engine/social-leverage/taking-somebody-as-your-own.js';
import { resolveAttempt } from '../engine/social-leverage/an-attempt-to-move-somebody.js';
import { upsertRelationship } from '../engine/world/npc-state.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../engine/world/history.js';
import { recordABondBothWays } from './encounters.js';
import { writeOneObligation } from '../storage/repos/obligation.repo.js';
import { theRollLands } from '../server/consolidated/forcing-an-attempt-to-land.js';
import { factsForToolResult } from './facts.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

export function acceptANamedDisciple(game: GameService, run: Run, cultivator: Cultivator, named?: string): Execution {
    const resolved = named ? game.partyPutTo(cultivator, named, game.scopeFor(cultivator)) : null;
    const person = resolved?.kind === 'cultivator'
        ? game.present(cultivator).find(p => p.id === resolved.id) ?? null : null;
    const world = game.atHand;
    const student = person && game.present(cultivator).some(row => row.id === person.id)
        ? world?.npcs.find(row => row.id === person.id && row.status === 'alive') : null;
    const answer = (line: string, ok: boolean) => ({
        ...game.freeAction(run, 'sect', factsForToolResult(line, [line], line)),
        outcome: ok ? 'executed' as const : 'refused' as const,
        events: [], timeSkip: null, breakthrough: null,
        facts: factsForToolResult(line, [line], line),
        calls: [{ name: 'engine.acceptANamedDisciple', action: 'sect' as const, summary: line, ok }]
    });
    if (!world || !student) return answer('The person you would take as your disciple is not standing here.', false);
    const day = Math.floor(world.currentDay);
    const master = { id: cultivator.id, name: cultivator.name, ordinal: cultivator.realmOrdinal };
    const junior = { id: student.id, name: student.name, ordinal: student.cultivation.realmOrdinal,
        masterId: (student.relationships.find(tie => tie.kind === 'master' && tie.targetId === cultivator.id)
            ?? student.relationships.find(tie => tie.kind === 'master'))?.targetId };
    const may = whetherYouMayTake(master, junior);
    if (!may.may) return answer(may.reason, false);
    const house = game.repos.sects.getMembership(cultivator.id)?.sectId ?? null;
    const tie = student.relationships.find(row => row.targetId === cultivator.id);
    const consent = resolveAttempt({
        actor: { ...master, charm: cultivator.attributes.charm, factionId: house, alignment: null },
        subject: { id: student.id, name: student.name, ordinal: student.cultivation.realmOrdinal,
            factionId: student.factionId, alignment: world.factions.find(f => f.id === student.factionId)?.alignment ?? null },
        ask: 'a_real_favour', onDay: day,
        theirTie: tie ? { active: true, strength: Math.max(0, tie.standing) } : null,
        rng: forStream(run.seed, 'taking-a-named-disciple', day, run.turn, student.id),
        theAttemptLands: theRollLands('an_approach_to_somebody')
    });
    if (consent.outcome !== 'taken' && consent.outcome !== 'turned') return answer(`${student.name} declines to become your disciple.`, false);
    const opened = whatABondOpens({ master, student: junior, onDay: day });
    game.db.transaction(() => {
        recordABondBothWays(game.repos, opened.ties.map(row => ({ fromId: row.holderId,
            toId: row.targetId, type: row.kind as 'master' | 'disciple', strength: row.standing })), day, opened.sealing.summary);
        for (const row of [...opened.oaths, ...opened.grudges]) writeOneObligation(game.db, row);
    })();
    for (const row of opened.ties) {
        const at = world.npcs.findIndex(npc => npc.id === row.holderId);
        if (at >= 0) world.npcs[at] = upsertRelationship(world.npcs[at]!, row, day);
    }
    appendWorldFact(world, makeFact({ day, kind: 'said_in_public', locationId: student.locationId,
        summary: opened.sealing.summary, actors: [{ id: master.id, name: master.name, role: 'master' },
            { id: student.id, name: student.name, role: 'disciple' }] }));
    game.theWorldMoved();
    return answer(`${student.name} becomes your disciple. You owe them teaching and they owe you service while the bond stands.`, true);
}
