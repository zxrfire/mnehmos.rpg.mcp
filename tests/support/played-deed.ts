/** Keep the completed played scenario; assertions and hearsay readers still run. */
import { makeGameInWorld, cultivatorRow } from '../web/harness.js';
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
    const them = world.npcs.find(n =>
        n.id !== playerId && n.status === 'alive' && n.locationId === fact.locationId)
        ?? world.npcs.find(n => n.id !== playerId && n.status === 'alive')!;
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
                            db.prepare('UPDATE cultivators SET hp = max_hp, battles_survived = 400 WHERE id = ?')
                                .run(cultivator.id);
                            db.prepare('DELETE FROM cultivator_injuries WHERE cultivator_id = ?').run(cultivator.id);
                            await game.act('I spar with someone of my own rank');
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
