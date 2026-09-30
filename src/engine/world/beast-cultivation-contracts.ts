import { writeItDown } from './the-word-an-npc-gave.js';
import { createObligation, settleObligation } from '../social/grudges.js';
import { forStream } from '../cultivation/rng.js';
import { realmIndexOf } from '../cultivation/realms.js';
import { theSpeciesItIs, itHasCrossed } from './a-beast-with-a-core-is-somebody-in-particular.js';
import { isTheWorldsToMove, type NpcRecord } from './npc-state.js';
import type { WorldState } from './world-state.js';

const CONTRACT = 'beast-cultivation-contract';
interface Terms { ground: string; share: number; realm: number }

export function beastContractFor(world: WorldState, cultivatorId: string) {
    return world.obligations.find(row => row.kind === 'oath' && row.tags.includes(CONTRACT) && row.status === 'open'
        && row.subjectId === cultivatorId);
}

/** The agreed share reduces the cultivator's own draw, wherever it is computed. */
export function beastQiShare(world: WorldState, cultivatorId: string): number {
    const row = beastContractFor(world, cultivatorId);
    return row ? (JSON.parse(row.terms!) as Terms).share : 0;
}

export function reviewPlayerBeastContract(world: WorldState, playerId: string, place: string | null,
    ordinal: number, day: number): boolean {
    const row = beastContractFor(world, playerId);
    if (!row) return false;
    const terms = JSON.parse(row.terms!) as Terms;
    if (place !== terms.ground || realmIndexOf(ordinal) > terms.realm) return endBeastContract(world, playerId, day, true);
    return false;
}

export function agreeBeastContract(world: WorldState, cultivator: NpcRecord, beast: NpcRecord,
    witnessId: string, share: number, day: number): boolean {
    if (beastContractFor(world, cultivator.id) || beastContractFor(world, beast.id)
        || world.obligations.some(row => row.kind === 'oath' && row.status === 'open' && row.tags.includes(CONTRACT) && row.holderId === beast.id)
        || !theSpeciesItIs(beast) || !itHasCrossed(beast) || !cultivator.locationId
        || cultivator.locationId !== beast.locationId || share <= 0 || share >= 1) return false;
    writeItDown(world, createObligation({ kind: 'oath', holderId: beast.id, subjectId: cultivator.id,
        id: `beast-contract:${beast.id}:${cultivator.id}:${day}:${world.obligations.length}`,
        cause: 'other', severity: 'serious', onDay: day,
        description: `${cultivator.name} and ${beast.name} share cultivation on agreed ground.`,
        terms: JSON.stringify({ ground: beast.locationId, share,
            realm: Math.max(realmIndexOf(cultivator.cultivation.realmOrdinal), realmIndexOf(beast.cultivation.realmOrdinal)) } satisfies Terms),
        participants: [cultivator.id, beast.id, witnessId], tags: [CONTRACT, 'witnessed'] }));
    return true;
}

/** Either party can leave. Outgrowing the terms or losing the ground releases both. */
export function endBeastContract(world: WorldState, personId: string, day: number, released = false): boolean {
    const at = world.obligations.findIndex(row => row.kind === 'oath' && row.status === 'open' && row.tags.includes(CONTRACT)
        && (row.holderId === personId || row.subjectId === personId));
    if (at < 0) return false;
    const row = world.obligations[at]!;
    writeItDown(world, settleObligation(row, { resolution: 'oath_released', onDay: day,
        byId: personId, note: released ? 'The agreed ground or realm no longer holds.' : 'One party ended the agreement.' }));
    if (!released) writeItDown(world, createObligation({ kind: 'grudge', id: `beast-contract-broken:${row.id}`,
        holderId: row.holderId === personId ? row.subjectId! : row.holderId, subjectId: personId,
        cause: 'broken_oath', severity: row.severity, onDay: day,
        description: 'The cultivation agreement ended before its terms were met.', tags: [CONTRACT] }));
    return true;
}

/** Transfer only the days actually cultivated; credit survives the end of the oath. */
export function shareBeastCultivation(world: WorldState, cultivatorId: string, days: number): void {
    const row = beastContractFor(world, cultivatorId);
    if (!row || days <= 0) return;
    const at = world.npcs.findIndex(npc => npc.id === row.holderId && npc.status === 'alive');
    if (at < 0) return;
    const beast = world.npcs[at]!;
    world.npcs[at] = { ...beast, cultivation: { ...beast.cultivation,
        bondedCultivationDays: (beast.cultivation.bondedCultivationDays ?? 0) + days * beastQiShare(world, cultivatorId) } };
}

/** Yearly world play uses the same agreement and sharing as a player sitting an art. */
export function advanceBeastContracts(world: WorldState, day: number): void {
    const byId = new Map(world.npcs.map(npc => [npc.id, npc]));
    for (const row of [...world.obligations]) {
        if (!row.tags.includes(CONTRACT) || row.kind !== 'oath' || row.status !== 'open') continue;
        const cultivator = byId.get(row.subjectId!);
        const beast = byId.get(row.holderId);
        const terms = JSON.parse(row.terms!) as Terms;
        if (!cultivator || !beast || cultivator.status !== 'alive' || beast.status !== 'alive'
            || (isTheWorldsToMove(cultivator) && cultivator.locationId !== terms.ground) || beast.locationId !== terms.ground
            || Math.max(realmIndexOf(cultivator.cultivation.realmOrdinal), realmIndexOf(beast.cultivation.realmOrdinal)) > terms.realm) {
            endBeastContract(world, row.subjectId!, day, true);
        } else {
            if (isTheWorldsToMove(cultivator)) {
                const days = Math.max(0, day - row.recordedOnDay);
                shareBeastCultivation(world, cultivator.id, days);
                const at = world.npcs.findIndex(npc => npc.id === cultivator.id);
                const live = world.npcs[at]!;
                world.npcs[at] = { ...live, cultivation: { ...live.cultivation,
                    accumulatingSinceDay: Math.min(day, live.cultivation.accumulatingSinceDay + days * terms.share) } };
                row.recordedOnDay = day;
            }
            const standing = beast.relationships.find(tie => tie.targetId === cultivator.id)?.standing ?? 0;
            if (forStream(world.seed, 'beast-contract-ending', row.id, Math.floor(day / 365)).next()
                < Math.max(0.001, 0.03 * (1 - standing))) endBeastContract(world, beast.id, day);
        }
    }
    for (const beast of world.npcs) {
        if (beast.status !== 'alive' || !theSpeciesItIs(beast) || !itHasCrossed(beast)) continue;
        const others = world.npcs.filter(npc => npc.status === 'alive' && isTheWorldsToMove(npc)
            && npc.id !== beast.id && npc.locationId === beast.locationId && !theSpeciesItIs(npc));
        const cultivator = others.find(npc => (beast.relationships.find(tie => tie.targetId === npc.id)?.standing ?? 0) > 0);
        const witness = others.find(npc => npc.id !== cultivator?.id);
        if (cultivator && witness && forStream(world.seed, 'beast-contract-offer', beast.id, Math.floor(day / 365)).next() < 0.03) {
            agreeBeastContract(world, cultivator, beast, witness.id, 0.25, day);
        }
    }
}
