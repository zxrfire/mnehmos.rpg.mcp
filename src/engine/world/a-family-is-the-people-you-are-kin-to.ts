/**
 * A FAMILY IS THE PEOPLE YOU ARE KIN TO, AND NOT THE PEOPLE WHO SHARE YOUR NAME.
 *
 * `seedLineages` grouped the world by SURNAME and attached everybody to the
 * nearest earlier person with the same one, eighteen years up. That is what
 * `the-families-a-world-opens-holding.ts` records as a known defect and declines
 * to fix in its own header - *"the surname chain is the one that should change,
 * and it is somebody's to change deliberately"* - and what
 * `a-family-that-came-down-from-a-changed-beast.ts` rules against outright: *"a
 * stranger with the same name proves nothing at all."*
 *
 * MEASURED, over three seeded worlds, before this file: 43 lineage records, 893
 * to 928 members, the biggest family 52 to 65 people, and of 850 to 885 parent
 * edges, 833 to 875 - about 98 in a hundred - joined two people with no kinship
 * between them of any kind. An elder of the Nine Peaks inherited from Lu Sheng
 * because both are called Lu.
 *
 * ── WHAT A FAMILY IS HERE ────────────────────────────────────────────────
 *
 * The kinship the world actually wrote: `parent`, `child`, `kin` and `spouse`
 * rows, written by the marriage pass, the household pass and every birth since.
 * Those rows are the same ones `whoTheyCarryFor` reads, so the people a house
 * acts for, the people a telling lands on, and the people who inherit are one
 * population rather than three.
 *
 * A record is one CONNECTED COMPONENT of that graph: parents, their children,
 * those children's children, the siblings between them and the spouse who
 * married in. Two people are in one family when kinship joins them, however far
 * apart they stand - which is what a family is - and never because a name
 * matched.
 *
 * ── AND THE EDGES SAY WHAT THE TIE SAYS ──────────────────────────────────
 *
 * `heirsOf` reads edges by relation and in one order, so what is written here
 * decides who inherits:
 *
 *     parent -> child      `descendant`, the first thing the estate looks for
 *     spouse -> spouse     `clan`, both ways, so a widow is not a stranger to
 *                          the household's own property
 *
 * A sibling gets no edge of their own: they are their parents' `descendant`
 * already, and a second edge between them would make a brother inherit ahead of
 * a child.
 */

import { addLineageEdge, createLineageRecord, type LineageRecord } from './lineage.js';
import { surnameOf } from './history.js';
import type { NpcRecord, RelationshipKind } from './npc-state.js';
import type { WorldState } from './world-state.js';

/** The rows that make two people one family. */
export const THE_KIN_A_FAMILY_IS: ReadonlySet<RelationshipKind> =
    new Set<RelationshipKind>(['parent', 'child', 'kin', 'spouse']);

/** Whether this row is kinship rather than any other kind of tie. */
export function isKinship(kind: RelationshipKind): boolean {
    return THE_KIN_A_FAMILY_IS.has(kind);
}

/**
 * Every family in this world, read off the kinship its people hold.
 *
 * Pure: it builds the records and the caller pushes them. Ids are
 * `lin-<surname>-<founder>` so two unrelated families of one name are two
 * records, which is the whole point of the change.
 */
export function lineagesFromTheKinTheWorldWrote(
    state: Pick<WorldState, 'npcs'>
): LineageRecord[] {
    const byId = new Map(state.npcs.map(npc => [npc.id, npc]));
    const seen = new Set<string>();
    const out: LineageRecord[] = [];

    for (const person of state.npcs) {
        if (seen.has(person.id)) continue;
        // Walk the kinship out from this person, so a component is found once
        // and from whoever the roster reached first.
        const family: NpcRecord[] = [];
        const queue = [person.id];
        seen.add(person.id);
        while (queue.length > 0) {
            const at = byId.get(queue.shift()!);
            if (at === undefined) continue;
            family.push(at);
            for (const tie of at.relationships) {
                if (!isKinship(tie.kind) || seen.has(tie.targetId) || !byId.has(tie.targetId)) continue;
                seen.add(tie.targetId);
                queue.push(tie.targetId);
            }
        }
        if (family.length < 2) continue;

        const inOrder = family.slice().sort((a, b) =>
            a.identity.bornOnDay - b.identity.bornOnDay || (a.id < b.id ? -1 : 1));
        const founder = inOrder[0]!;
        let lineage = createLineageRecord({
            id: `lin-${surnameOf(founder.name).toLowerCase()}-${founder.id}`,
            surname: surnameOf(founder.name),
            founderId: founder.id,
            foundedOnDay: founder.identity.bornOnDay
        });

        const written = new Set<string>();
        for (const member of inOrder) {
            for (const tie of member.relationships) {
                if (!byId.has(tie.targetId)) continue;
                // One edge per pair per relation, written from the parent's end
                // so the direction is the one `heirsOf` walks.
                if (tie.kind === 'child') {
                    const key = `d:${member.id}:${tie.targetId}`;
                    if (written.has(key)) continue;
                    written.add(key);
                    lineage = addLineageEdge(lineage, {
                        parentId: member.id,
                        childId: tie.targetId,
                        relation: 'descendant',
                        onDay: byId.get(tie.targetId)!.identity.bornOnDay
                    });
                } else if (tie.kind === 'spouse') {
                    const key = `c:${member.id}:${tie.targetId}`;
                    if (written.has(key)) continue;
                    written.add(key);
                    lineage = addLineageEdge(lineage, {
                        parentId: member.id,
                        childId: tie.targetId,
                        relation: 'clan',
                        onDay: Math.max(member.identity.bornOnDay, byId.get(tie.targetId)!.identity.bornOnDay)
                    });
                }
            }
        }
        if (lineage.edges.length === 0) continue;
        lineage.holdings = { spirit_stones: 0 };
        out.push(lineage);
    }
    return out;
}
