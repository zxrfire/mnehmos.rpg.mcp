/**
 * A catalog person and their world row are one person.
 *
 * ── The defect this closes ───────────────────────────────────────────────
 *
 * `members.ts` describes a hundred and eighty-six named people by a CATALOG id
 * - `member-yan-shuling`, `hollow-court-shen-quan` - and `seedNamedFigures`
 * instantiates each of them into the world as `npc-` plus that id. Both strings
 * are load-bearing, both are in live use, and until this module existed nothing
 * said they were the same human being.
 *
 * `lore.ts` speaks of these people by their catalog id, so the hearsay layer
 * writes the player's knowledge record under it. Every player-facing presence
 * read - `castFor`, `company`, `resolveCultivator`, `nobodyByThatName`, the
 * world digest's `knowsNpc` - asks about the WORLD row id. Measured on a
 * seeded world before this: 203 lore people, 428 world NPCs, ZERO ids in
 * common. Standing on the Azure Cloud Pavilion's own ground, having been told
 * 175 of those names by the ordinary channel, the player could name none of
 * the nine catalog people in the square.
 *
 * The guarantee at stake is the one stated on `personName` in `history.ts`:
 * the knowledge system is keyed by id while everything the player reads is
 * keyed by name, so a name that reaches the player has to be a name the player
 * has. `personName` protects it from the duplicate-name end. This protects it
 * from the two-ids-for-one-person end, which is the same guarantee failing for
 * the opposite reason.
 *
 * ── Why the catalog id is the canonical one ──────────────────────────────
 *
 * It exists for all of them. The world id exists for 185: the guest elders,
 * the wanderers, the sealed ancestors and the bodies on the immortal channels
 * are named in the catalogs and instantiated nowhere, so there is no world row
 * to key them under and never will be for some of them. Canonicalising the
 * other way would mean minting an id for a person who has no row - a key that
 * nothing writes, which is its own well-documented defect.
 *
 * The mapping catalog -> world is the seeder's own rule and is total. The
 * mapping back is a lookup against the catalog, which is what makes it safe.
 *
 * ── The strip is on the CATALOG, never on the prefix ─────────────────────
 *
 * `game.ts` carried this translation ad hoc in two places as
 * `id.startsWith('npc-') ? id.slice(4) : ...`, and that shape is wrong in a way
 * that only shows up on the ids it was not written for. The world is full of
 * `npc-95` (procedural), `npc-apex-azure-dew-sect` (a house's apex) and
 * `npc-above-3` (the far side of the Lid), and a prefix strip renames the first
 * to `95` and invents a person who does not exist. So the question asked here
 * is never "does it start with npc-"; it is "is the remainder somebody the
 * catalog holds".
 *
 * The naming convention is not the rule either. Ten of the catalog's people -
 * the Hollow Court's seats and the mountains under them, which is the apex of
 * the setting - are filed under `hollow-court-` rather than `member-`, so a
 * rule keyed on the `member-` prefix would have silently excluded the top of
 * the world. The set is read off `MEMBERS` for exactly that reason.
 */

import { MEMBERS } from '../../data/cultivation/members.js';

/**
 * The prefix `seedNamedFigures` puts in front of a catalog id.
 *
 * Exported so the seeder and the reverse lookup cannot drift. It was written
 * inline in the seeder and nowhere else knew the rule.
 */
export const WORLD_ROW_PREFIX = 'npc-';

/** Every id the catalog holds a named person under. Built once. */
let catalogPeople: Set<string> | null = null;

function catalogIds(): Set<string> {
    if (!catalogPeople) catalogPeople = new Set(MEMBERS.map(member => member.id));
    return catalogPeople;
}

/** The world row a catalog person is instantiated as. The seeder's own rule. */
export function worldIdForCatalogPerson(catalogId: string): string {
    return `${WORLD_ROW_PREFIX}${catalogId}`;
}

/** True when the catalog holds a person under this id. */
export function isCatalogPerson(id: string): boolean {
    return catalogIds().has(id);
}

/**
 * The catalog person a world row stands for, or null.
 *
 * Null for every procedural NPC, every seeded apex, everybody above the Lid,
 * and every `cultivators` row - all of which are people whose only id is the
 * one they already have.
 */
export function catalogPersonBehind(id: string): string | null {
    if (!id.startsWith(WORLD_ROW_PREFIX)) return null;
    const behind = id.slice(WORLD_ROW_PREFIX.length);
    return catalogIds().has(behind) ? behind : null;
}

/**
 * The one id this person is known by, whichever of their two you have.
 *
 * The identity function for everybody else, which is most of the world. It is
 * deliberately total and deliberately dull: a caller should be able to run
 * every id it holds through this without having to know which population it
 * came from.
 */
export function theOneIdAPersonIsKnownBy(id: string): string {
    return catalogPersonBehind(id) ?? id;
}
