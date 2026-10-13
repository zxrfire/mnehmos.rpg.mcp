/** Door access reads actual held key objects, never a rank or a remembered name. */
import { isRuined, type ObjectRecord } from './possessions.js';

export function theDoorKeysTheyActuallyCarry(objects: readonly ObjectRecord[], personId: string): string[] {
    return objects.filter(o => o.possessorId === personId && o.kind === 'key' && !isRuined(o))
        .flatMap(o => typeof o.data.keyId === 'string' ? [o.id, o.data.keyId] : [o.id]);
}
