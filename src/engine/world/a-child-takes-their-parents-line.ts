/**
 * What a family line comes to in a child: the blood, the surname and the edge.
 *
 * Moved out of `applyDemography` when a house raising one of its own needed
 * the same thing (`a-house-takes-in-one-of-its-own.ts`). Somebody who was always
 * there was born to somebody, and a row minted with no line was a person with
 * nobody to inherit from and nobody to leave anything to: measured on `pass-a`
 * and `pass-b` over 200 years, 619 of them died and every one was heirless.
 * One reading for both, so a birth and a raising cannot come to disagree about
 * what a family is.
 */

import { canBeTheTwoParentsOf } from '../birth/what-sex-somebody-is-and-what-it-is-for.js';
import { bloodlineForChild } from './hunting-a-spirit-beast.js';
import { addLineageEdge, createLineageRecord, lineageIdOf } from './lineage.js';
import type { NpcRecord } from './npc-state.js';
import type { Roster } from './the-ties-an-ordinary-life-produces.js';
import type { WorldState } from './world-state.js';

/**
 * The child as their parent's line leaves them, and the lineage edge written.
 *
 * Mutates `state.lineages` in place; returns the child's record, which the
 * caller has not pushed yet.
 */
export function aChildTakesTheirParentsLine(
    state: WorldState,
    child: NpcRecord,
    parent: NpcRecord,
    roster: Roster
): NpcRecord {
    let npc = child;
    const spouseTie = parent.relationships.find(r => r.kind === 'spouse');
    const spouseAt = spouseTie ? roster.at.get(spouseTie.targetId) : undefined;
    const spouse = spouseAt === undefined ? null : state.npcs[spouseAt];
    const otherBloodParent = spouse
        && canBeTheTwoParentsOf(parent.identity.sex, spouse.identity.sex)
        ? spouse
        : null;
    const line = bloodlineForChild(
        parent.identity.bloodline,
        otherBloodParent?.identity.bloodline ?? null
    );
    if (line !== null || npc.identity.bloodline !== null) {
        npc = { ...npc, identity: { ...npc.identity, bloodline: line } };
    }

    const surname = parent.name.split(' ')[0];
    npc = { ...npc, name: `${surname} ${npc.name.split(' ').slice(1).join(' ')}`.trim() };
    // THE PARENT'S OWN LINE, AND NOT EVERY LINE OF THAT NAME. A record keyed on
    // the surname alone put a child into a family of strangers who happened to
    // share it, which is the defect `a-family-is-the-people-you-are-kin-to.ts`
    // was written against: a family is who you are kin to. A parent with no
    // record yet founds one, and it is theirs.
    let lineage = state.lineages.find(l => l.memberIds.includes(parent.id));
    if (!lineage) {
        lineage = createLineageRecord({
            id: lineageIdOf(surname, parent.id),
            surname,
            founderId: parent.id,
            foundedOnDay: parent.identity.bornOnDay
        });
        state.lineages.push(lineage);
    }
    const lineageId = lineage.id;
    const next = addLineageEdge(lineage, {
        parentId: parent.id,
        childId: npc.id,
        relation: 'descendant',
        onDay: npc.identity.bornOnDay
    });
    const at = state.lineages.findIndex(l => l.id === lineageId);
    if (at >= 0) state.lineages[at] = next;
    return npc;
}
