/**
 * The places on the character sheet: where you are, home, your house's seat, and every place you
 * know of, each marked by how you know it.
 *
 * The owner: "add the sidebar, i need a list of known places otherwise the game is too hard to
 * play ... a player cannot remember", "put the location of my home, my sect, places i know of and
 * can go", "put it above techniques", and "having everything there and just toggling visibility
 * once known and then confirmed, for the awareness levels". So the knowledge gate decides what is
 * on the list: a place they are unaware of is not there; one heard of (whispered, named, placed)
 * is there as heard; one they have stood in (encountered, known) is there as been.
 *
 * Pure, and handed what it reads: the engine's server modules sit in an import cycle that a new
 * importer of them can trip at startup.
 */

import { stageRank } from '../engine/social/discovery.js';
import { whatKindOfPlace, type ASettlementTier } from '../engine/world/what-somebody-knows-of-the-land.js';
import type { AwarenessRow } from './knowledge.js';

export interface APlaceOnTheSheet {
    name: string;
    /** Heard of, or been there. */
    known: 'heard' | 'been';
    here: boolean;
    home: boolean;
    /** Their house's seat. */
    house: boolean;
    /** Village, town, city, provincial capital; null for anything that is not a settlement. */
    kind: ASettlementTier | null;
}

/** Stood in: encountered or known. Below that, heard of. */
const BEEN_FROM = stageRank('encountered');
/** Anything above unaware is on the list. */
const HEARD_FROM = stageRank('whisper');

export function thePlacesOnTheSheet(input: {
    /** Their awareness rows of kind `place`. */
    places: readonly AwarenessRow[];
    here: string | null;
    abode: string | null;
    /** Their house's seat, by name, or null. */
    seat: string | null;
    /** Whether their home is quarters at that seat. */
    livesAtTheSeat: boolean;
}): APlaceOnTheSheet[] {
    const byName = new Map<string, APlaceOnTheSheet>();
    const add = (name: string | null, known: 'heard' | 'been', mark: Partial<APlaceOnTheSheet> = {}) => {
        if (!name) return;
        const had = byName.get(name);
        byName.set(name, {
            name,
            known: had?.known === 'been' || known === 'been' ? 'been' : 'heard',
            here: (had?.here ?? false) || (mark.here ?? false),
            home: (had?.home ?? false) || (mark.home ?? false),
            house: (had?.house ?? false) || (mark.house ?? false),
            kind: whatKindOfPlace(name)
        });
    };

    for (const row of input.places) {
        const stage = stageRank(row.stage);
        if (stage >= HEARD_FROM) add(row.name, stage >= BEEN_FROM ? 'been' : 'heard');
    }
    add(input.here, 'been', { here: true });
    add(input.abode, 'been', { home: true });
    if (input.seat) add(input.seat, byName.get(input.seat)?.known ?? 'heard', { house: true, home: input.livesAtTheSeat });

    const order = (place: APlaceOnTheSheet) =>
        place.here ? 0 : place.home ? 1 : place.house ? 2 : place.known === 'been' ? 3 : 4;
    return [...byName.values()].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
}
