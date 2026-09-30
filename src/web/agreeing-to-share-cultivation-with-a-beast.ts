import { openHandednessOf } from '../engine/social-leverage/how-freely-somebody-parts-with-what-they-have.js';
import { forStream } from '../engine/cultivation/rng.js';
import { agreeBeastContract, endBeastContract } from '../engine/world/beast-cultivation-contracts.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import { factsForToolResult } from './facts.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

export function aBeastCultivationAgreement(service: GameService, run: Run, player: Cultivator,
    named: string, share: number, ending: boolean): Execution {
    const world = service.atHand;
    const here = service.present(player);
    const party = service.somebodyAtHand(named, player)
        ?? here.find(row => row.name.toLowerCase() === named.trim().toLowerCase());
    const beast = world?.npcs.find(row => row.id === party?.id && row.status === 'alive');
    const self = world?.npcs.find(row => row.id === player.id);
    let ok = false;
    let line = 'The person you named is not here. Nothing happened.';
    if (world && beast && self) {
        const day = Math.floor(world.currentDay);
        if (ending) {
            const row = world.obligations.find(row => row.kind === 'oath' && row.status === 'open'
                && row.holderId === beast.id && row.subjectId === player.id && row.tags.includes('beast-cultivation-contract'));
            ok = !!row && endBeastContract(world, player.id, day);
            line = ok ? 'The beast cultivation contract ends. The other party holds the broken oath against you.'
                : 'No beast cultivation contract stands between you.';
        } else {
            const witness = here.find(row => row.id !== beast.id && row.id !== player.id);
            const standing = beast.relationships.find(row => row.targetId === player.id)?.standing ?? 0;
            if (!witness) line = 'Nobody else is here to witness the cultivation oath. Nothing happened.';
            else if (!(share > 0 && share < 1)) line = 'A qi share must leave both parties some of the draw: more than 0% and less than 100%.';
            else if (forStream(run.seed, 'beast-contract-consent', beast.id, run.turn).next()
                >= Math.min(0.95, Math.max(0.05, share + standing * 0.5 + 0.1 * openHandednessOf(beast.id)))) line = `${party!.name} declines the terms. Nothing happened.`;
            else {
                ok = agreeBeastContract(world, { ...self, locationId: service.worldPlaceOf(player) }, beast, witness.id, share, day);
                line = ok ? `The witnessed cultivation oath stands. ${Math.round(share * 100)}% of your qi draw goes to the other party on this ground. A rise into another major realm or loss of this ground releases both parties; leaving early opens a serious broken-oath account.`
                    : 'The agreement needs a speaking beast on this ground and two parties free of another cultivation contract.';
            }
        }
        if (ok) service.theWorldMoved();
    }
    const result = service.freeAction(run, 'oath', factsForToolResult(line, [line]));
    result.calls = [{ name: ending ? 'beast.endContract' : 'beast.agreeContract', action: 'oath', summary: line, ok }];
    return result;
}
