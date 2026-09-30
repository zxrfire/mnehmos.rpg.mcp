/** A spent structural dose repairs only after its exposed recovery span is lived. */
import type { StructuralRepairMedicine } from '../data/cultivation/structural-repair-medicine.js';
import { getWoundType } from '../data/cultivation/wounds.js';
import { applyStructuralRepair } from '../engine/cultivation/what-structural-repair-medicine-can-reach.js';
import type { Cultivator, Run } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';
import type { Execution } from './turn-wire-shapes.js';

export async function recoveringFromAStructuralRepair(
    game: GameService,
    run: Run,
    cultivator: Cultivator,
    medicine: StructuralRepairMedicine,
    woundKey: string | null
): Promise<Execution> {
    const spent = await game.shortSkip(run, cultivator, game.ambientFor(cultivator, run),
        0, `Recovering from ${medicine.name}`, medicine.recoveryDays, 'convalescence');
    const after = game.repos.cultivators.getById(cultivator.id)!;
    const complete = after.alive && !spent.cutShort
        && spent.timeSkip?.simulatedDays === medicine.recoveryDays;
    const kept = complete && woundKey !== null
        ? applyStructuralRepair(after.injuries, medicine, woundKey, after.realmOrdinal)
        : after.injuries;
    const closed = after.injuries.filter(before => !kept.some(still => still.id === before.id));
    game.db.transaction(() => {
        for (const injury of closed) game.repos.cultivators.treatInjury(injury.id, run.turn + 1);
        game.repos.runs.incrementTurn(run.id, 1);
    })();
    const line = !complete
        ? `Recovery from ${medicine.name} was interrupted. The dose is spent; the repair did not finish.`
        : closed.length > 0
            ? `${getWoundType(woundKey!)?.name ?? woundKey} is repaired after ${medicine.recoveryDays} days of recovery.`
            : `${medicine.name} is spent. No structural wound was repaired.`;
    spent.facts.lines.unshift(`You swallow the ${medicine.name}.`, line);
    (spent.facts.required ??= []).push(line);
    spent.facts.structure.push(`Structural repair: ${closed.length} injuries closed after `
        + `${spent.timeSkip?.simulatedDays ?? 0}/${medicine.recoveryDays} recovery days; complete=${complete}.`);
    spent.calls.push({ name: 'engine.applyStructuralRepair', action: 'consume_pill',
        summary: line, ok: complete });
    return spent;
}
