/**
 * Masters notice a heavenly seedling, and say so.
 *
 * The design owner, on why most juniors have no master and some have three:
 * *"unless you are a heavenly seedling"*. A talent like that is sought after, by
 * more than one master, including ones who were not looking. The world already
 * does this to its own people at the opening and once a year
 * (`the-disciples-a-world-opens-with.ts`); this is the same read pointed at the
 * player.
 *
 * ── WHAT IT DOES AND WHAT IT DOES NOT ────────────────────────────────────
 *
 * It says who has noticed. Nothing is written onto the player and no bond is
 * opened: a master saying they would take somebody on is an offer, and the road
 * from an offer to a bond is the discipleship path the player already walks -
 * "I ask <name> to take me as a disciple" - which asks `whetherYouMayTake` and
 * writes the bond through `whatABondOpens`. The design owner's standing ruling
 * that the player finds their own master is exactly that: the world may put
 * somebody in front of them, and it may not kneel for them.
 *
 * Said once per master, and remembered on a flag so a player standing in a hall
 * for ten turns is not told ten times.
 */

import { isAHeavenlySeedling } from '../engine/world/the-disciples-a-world-opens-with.js';
import { FOUNDATION_ORDINAL } from '../engine/cultivation/realms.js';
import { elderRungOf } from '../engine/cultivation/leadership.js';
import { getSpiritRoot } from '../engine/cultivation/spirit-roots.js';
import { physiqueOrNull } from '../engine/cultivation/physiques.js';
import type { NpcRecord } from '../engine/world/npc-state.js';
import type { WorldState } from '../engine/world/world-state.js';
import { readFlag, writeFlag } from '../server/consolidated/cultivation-support.js';
import type { Cultivator } from '../schema/cultivation.js';
import type { GameService } from './turn-engine.js';

/** The flag holding who has already offered. */
export const MASTERS_WHO_HAVE_OFFERED = 'masters-who-have-offered';

/** Whether a player's own talent reads as a heavenly seedling. */
export function thePlayerReadsAsASeedling(cultivator: Cultivator, tags: readonly string[] = []): boolean {
    return isAHeavenlySeedling({
        cultivation: { spiritRoot: cultivator.spiritRoot } as NpcRecord['cultivation'],
        identity: { physique: cultivator.physique ?? null } as NpcRecord['identity'],
        tags: [...tags]
    });
}

/**
 * The masters standing where this person is who would take them on: of a house,
 * past Foundation, on their house's elder rung, and above them.
 *
 * Every one of them, and not the best: the point of a seedling is that more than
 * one wants them, including masters who were not looking for anybody.
 */
export function mastersWhoWouldOfferToTakeThemOn(
    world: WorldState,
    person: { id: string; locationId: string | null; ordinal: number }
): NpcRecord[] {
    if (person.locationId === null) return [];
    const ranks = new Map(world.factions.map(f => [f.id, f.ranks.length] as const));
    return world.npcs
        .filter(npc => npc.status === 'alive' && npc.id !== person.id
            && npc.locationId === person.locationId
            && npc.factionId !== null
            && npc.cultivation.realmOrdinal >= FOUNDATION_ORDINAL
            && npc.cultivation.realmOrdinal > person.ordinal
            && npc.factionRankIndex >= elderRungOf(ranks.get(npc.factionId) ?? 0))
        .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
            || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export interface WhoHasNoticedThem {
    lines: string[];
    structure: string;
}

/**
 * What the masters standing here say to a player whose talent reads as a
 * seedling. Null where nobody new has noticed.
 */
export function mastersNoticeAHeavenlySeedling(
    game: GameService,
    cultivator: Cultivator
): WhoHasNoticedThem | null {
    const world = game.atHand;
    if (!world || !cultivator.alive) return null;
    if (!thePlayerReadsAsASeedling(cultivator)) return null;
    // Somebody who already answers to a master is not being competed for.
    const already = world.npcs.find(n => n.id === cultivator.id);
    if (already?.relationships.some(r => r.kind === 'master')) return null;

    const here = game.worldPlaceOf(cultivator);
    const offering = mastersWhoWouldOfferToTakeThemOn(world, {
        id: cultivator.id, locationId: here, ordinal: cultivator.realmOrdinal
    });
    if (offering.length === 0) return null;

    const said = new Set((readFlag(game.repos.db, cultivator.id, MASTERS_WHO_HAVE_OFFERED) ?? '')
        .split(',').filter(Boolean));
    const fresh = offering.filter(m => !said.has(m.id));
    if (fresh.length === 0) return null;

    const root = getSpiritRoot(cultivator.spiritRoot);
    const physique = physiqueOrNull(cultivator.physique ?? null);
    const what = physique ? physique.name : root.name;
    const lines = fresh.slice(0, 2).map(master => {
        const house = world.factions.find(f => f.id === master.factionId);
        return `${master.name}${house ? ` of ${house.name}` : ''} has been watching you, and says what everybody `
            + `with eyes says about a ${what}: that it should not be left to find its own way. They would take `
            + `you as a disciple, if you asked.`;
    });
    if (fresh.length > 2) {
        lines.push(`${fresh.length - 2} other${fresh.length - 2 === 1 ? '' : 's'} standing here have said much the same.`);
    }
    for (const m of fresh) said.add(m.id);
    writeFlag(game.repos.db, cultivator.id, MASTERS_WHO_HAVE_OFFERED, [...said].join(','));
    return {
        lines,
        structure: `mastersNoticeAHeavenlySeedling: ${fresh.length} offered (${fresh.map(m => m.id).join(', ')}), `
            + `read off ${cultivator.spiritRoot}${physique ? ` and ${physique.key}` : ''}. Nothing written on anybody: `
            + 'the bond is the discipleship path.'
    };
}
