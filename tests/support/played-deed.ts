/** Keep the completed played scenario; assertions and hearsay readers still run.
 * The old probe asked for new spars while the previous held fight was open, or
 * while peers were elsewhere. Meet a real house peer on their public routine,
 * prepare the player at that peer's rung, and finish the native round budget.
 * The original run/world seed sets and ordinary fight outcomes are retained. */
import { makeGameInWorld, cultivatorRow, type Harness } from '../web/harness.js';
import { routineOf } from '../../src/engine/world/npc-routines.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { circulating, whatTheySay } from '../../src/engine/world/what-people-are-saying.js';
import { resetCultivationWorlds } from '../../src/server/state/cultivation-world.js';
import type { HistoricalFact } from '../../src/engine/world/history.js';
import type { WorldState } from '../../src/engine/world/world-state.js';
import { serializedFixture } from './serialized-fixture.js';

export interface LedgerRow {
    kind: string;
    cause: string;
    severity: string;
    holder_id: string;
    subject_id: string;
    triggering_event_id: string | null;
    tags: string;
}

interface Candidate {
    fact: HistoricalFact;
    world: WorldState;
    playerId: string;
    rows: LedgerRow[];
}

export function aTeller(world: WorldState, playerId: string, fact: HistoricalFact) {
    const absent = world.npcs.filter(n => n.id !== playerId && n.status === 'alive'
        && !fact.witnessIds.includes(n.id) && !fact.actors.some(actor => actor.id === n.id));
    const them = absent.find(n => n.factionId && fact.factionIds.includes(n.factionId))
        ?? absent.find(n => n.locationId === fact.locationId) ?? absent[0]!;
    return {
        id: them.id,
        name: them.name,
        realmOrdinal: them.cultivation.realmOrdinal,
        regionId: null,
        factionId: them.factionId ?? null
    };
}

class NoCandidate extends Error {
    constructor(readonly everInThePool: boolean) { super('No completed candidate'); }
}

async function meetAHousePeer(h: Pick<Harness, 'game' | 'repos'>) {
    const me = h.game.currentRun().cultivator;
    const world = (await h.game.loadWorld())!;
    const candidates = [...world.npcs].sort((a, b) =>
        Math.abs(a.cultivation.realmOrdinal - me.realmOrdinal) - Math.abs(b.cultivation.realmOrdinal - me.realmOrdinal));
    for (const peer of candidates) {
        if (peer.status !== 'alive' || peer.id === me.id || !peer.factionId || peer.factionRankIndex < 0
            || !world.factions.some(house => house.id === peer.factionId && house.dissolvedOnDay === null)) continue;
        const actual = routineOf(world, peer);
        const place = world.locations.find(row => row.id === actual.locationId && row.kind === 'settlement');
        if (actual.home || !place) continue;
        const area = theAreasOf(world, place).whereIs.get(peer.id);
        if (!area || area.includes('#room#')) continue;
        if (peer.cultivation.realmOrdinal !== me.realmOrdinal) {
            h.repos.cultivators.advanceRealm(me.id, peer.cultivation.realmOrdinal - me.realmOrdinal);
        }
        h.repos.cultivators.update(me.id, { location: place.name });
        h.repos.cultivators.standIn(me.id, area);
        if (!h.game.present(h.game.currentRun().cultivator).some(person => person.id === peer.id)) continue;
        h.game.theyGaveTheirName(h.game.currentRun().cultivator, h.game.currentRun().run, peer);
        return peer;
    }
    return null;
}

async function finishTheBout(h: Pick<Harness, 'game'>, sentence: string) {
    let acted = await h.game.act(sentence);
    if (!acted.toolCalls.some(call => call.ok && ['combat.round', 'combat_manage.resolve'].includes(call.name))) {
        throw new Error('The arranged peer did not enter a fight: ' + JSON.stringify(acted.toolCalls));
    }
    const budget = h.game.fight ? h.game.fight.state.roundBudget - h.game.fight.state.roundsFought : 0;
    for (let round = 0; round < budget && h.game.fight && h.game.currentRun().cultivator.alive; round++) {
        const id = h.game.fight.state.id, before = h.game.fight.state.roundsFought;
        acted = await h.game.act('I keep swinging');
        if (h.game.fight && (h.game.fight.state.id !== id || h.game.fight.state.roundsFought <= before)) {
            throw new Error('The held bout did not advance: ' + JSON.stringify(acted.toolCalls));
        }
    }
    if (h.game.fight) throw new Error('The bout exceeded its native round budget.');
}

export async function playedDeed(repeated: boolean): Promise<{
    candidate: Candidate | null; everInThePool: boolean;
}> {
    try {
        const bytes = await serializedFixture('played-deed', [
            'tests/support/played-deed.ts', 'tests/web/a-player-deed-enters-the-world.test.ts'
        ], { repeated }, async () => {
            let everInThePool = false;
            const prefix = repeated ? 'deed-heard' : 'deed-bout';
            try {
                for (let n = 0; n < 30; n++) {
                    const { db, game, repos } = await makeGameInWorld({
                        seed: `${prefix}-${n}`, worldSeed: `${prefix}-${n}`, worldEnabled: true
                    });
                    try {
                        const { cultivator } = await game.newRun('Duellist');
                        repos.sects.addMember('sect-azure-cloud-pavilion', cultivator.id, 1);
                        await game.act('I look around');
                        for (let bouts = 0; bouts < 20; bouts++) {
                            if (!cultivatorRow(db, cultivator.id).alive) break;
                            const peer = await meetAHousePeer({ game, repos });
                            if (!peer) break;
                            db.prepare('UPDATE cultivators SET hp = max_hp, battles_survived = 400 WHERE id = ?')
                                .run(cultivator.id);
                            db.prepare('DELETE FROM cultivator_injuries WHERE cultivator_id = ?').run(cultivator.id);
                            await finishTheBout({ game }, `I spar with ${peer.name}`);
                            const world = (await game.loadWorld())!;
                            const fact = world.history.facts.find(f => f.kind === 'betrayal'
                                && f.actors.some(a => a.id === cultivator.id));
                            if (!fact) continue;
                            if (repeated) {
                                const teller = aTeller(world, cultivator.id, fact);
                                if (circulating(world, teller, world.currentDay, 5000)
                                    .some(f => f.id === fact.id)) everInThePool = true;
                                if (!whatTheySay(world, teller, world.currentDay, 40)
                                    .some(r => r.factId === fact.id)) continue;
                            }
                            const rows = db.prepare(
                                'SELECT kind, cause, severity, holder_id, subject_id, triggering_event_id, tags FROM obligations'
                            ).all() as LedgerRow[];
                            return Buffer.from(JSON.stringify({
                                candidate: { fact, world, playerId: cultivator.id, rows }, everInThePool
                            }));
                        }
                    } finally { db.close(); }
                }
                throw new NoCandidate(everInThePool);
            } finally { resetCultivationWorlds(); }
        });
        return JSON.parse(bytes.toString('utf8'));
    } catch (error) {
        if (error instanceof NoCandidate) return { candidate: null, everInThePool: error.everInThePool };
        throw error;
    }
}
