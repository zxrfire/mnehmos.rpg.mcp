/** Identify one existing counted dose for a promise; no stock is granted or prepaid. */
import type { GameService } from './turn-engine.js';
import type { Cultivator } from '../schema/cultivation.js';
import { getPill } from '../data/cultivation/pills.js';
import { pouchQuantity } from '../storage/cultivator-pouch.js';
import { isRuined, makeObject } from '../engine/world/possessions.js';
import { whatThisThingIs } from '../engine/world/what-a-house-gives-merit-for.js';
import { appendWorldFact } from '../engine/world/who-was-there-when-it-happened.js';
import { makeFact } from '../engine/world/history.js';
import { routineTime } from '../engine/world/npc-routines.js';

export function aPrivatePillPromiseNamesARealDose(game: GameService, body: Cultivator, pillId: string) {
    const world = game.atHand, pill = getPill(pillId);
    const quantity = pouchQuantity(game.db, body.id, pillId);
    if (!world || !body.alive || !pill || quantity <= 0) return null;
    const held = world.objects.filter(object => object.kind === 'pill' && !isRuined(object)
        && object.possessorId === body.id && object.ownerId === body.id && object.data.pillId === pillId);
    const heldQuantity = held.reduce((sum, object) => sum + (whatThisThingIs(object)?.quantity ?? 0), 0);
    if (heldQuantity > quantity) return null;
    const single = held.find(object => whatThisThingIs(object)?.quantity === 1);
    if (single) return single;
    const stack = held.find(object => (whatThisThingIs(object)?.quantity ?? 0) > 1);
    if (!stack && heldQuantity >= quantity) return null;
    const identified = appendWorldFact(world, makeFact({ day: routineTime(world), kind: 'opportunity', visibility: 'secret',
        locationId: game.worldPlaceOf(body), actors: [{ id: body.id, name: body.name, role: 'offered' }],
        summary: 'An existing pill dose was identified for the private offer.',
        data: { privatePillIdentified: true, pillId } }), { recur: false, bystanders: false });
    if (stack) {
        const at = world.objects.findIndex(object => object.id === stack.id);
        world.objects[at] = { ...stack, data: { ...stack.data, quantity: whatThisThingIs(stack)!.quantity - 1 } };
    }
    const dose = makeObject({ id: 'private-pill:' + identified.id, name: pill.name, kind: 'pill',
        description: pill.description, ownerId: body.id, ownerName: body.name, possessorId: body.id,
        provenance: stack?.provenance, data: { pillId, grade: pill.grade, quantity: 1 } });
    world.objects.push(dose);
    return dose;
}
