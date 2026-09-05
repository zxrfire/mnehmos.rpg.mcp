/**
 * Who is left when somebody dies, for the layer that decides who holds an
 * account for it.
 *
 * `heirsOf` answers a different question - who inherits the estate and the
 * goals - and is downward-only, because that is what inheritance is. Grief is
 * not. Reading a killing off the heir list alone made the commonest
 * arrangement in the genre open nothing at all: kill somebody's young master
 * and his father, his brother and his wife hold none of it, while the same
 * person merely VANISHING opened an account for every one of those ties in
 * `when-somebody-does-not-come-back.ts`.
 */

import type { InheritanceRelation } from '../social/grudges.js';
import type { HeirRef } from './lineage.js';
import type { NpcRecord, RelationshipKind } from './npc-state.js';

/**
 * The ties that leave somebody holding it, in the ledger's own words.
 *
 * The relation names how the HOLDER stands to the dead, not the other way
 * round: a tie to their `parent` comes back `clan` because the record travels
 * up to the parent, and a tie to their `child` comes back `descendant`.
 */
const WHO_CARRIES_IT: Readonly<Partial<Record<RelationshipKind, InheritanceRelation>>> =
    Object.freeze({
        child: 'descendant',
        parent: 'clan',
        spouse: 'clan',
        kin: 'clan',
        disciple: 'disciple'
    });

/**
 * Everybody who is left, heirs first.
 *
 * `stillHere` drops anybody the world has already buried. Heirs keep their own
 * relation where a tie names the same person twice, because the estate is the
 * heavier claim.
 */
export function whoTheyLeave(input: {
    dead: NpcRecord;
    heirs: readonly HeirRef[];
    stillHere: (id: string) => boolean;
}): { id: string; relation: InheritanceRelation }[] {
    const out: { id: string; relation: InheritanceRelation }[] = [];
    const seen = new Set<string>();

    for (const heir of input.heirs) {
        if (seen.has(heir.id) || !input.stillHere(heir.id)) continue;
        seen.add(heir.id);
        out.push({ id: heir.id, relation: heir.relation });
    }
    for (const tie of input.dead.relationships) {
        const relation = WHO_CARRIES_IT[tie.kind];
        if (!relation) continue;
        if (seen.has(tie.targetId) || !input.stillHere(tie.targetId)) continue;
        seen.add(tie.targetId);
        out.push({ id: tie.targetId, relation });
    }
    return out;
}
