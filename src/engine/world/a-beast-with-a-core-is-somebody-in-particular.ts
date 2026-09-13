/**
 * A beast with a core, as a row among the people.
 *
 * `hunting-a-spirit-beast.ts` answers what is on a piece of ground out of the
 * CATALOG, so the hawk somebody spared was one of a count and there was nothing
 * to hang a favour on. `ObligationRecord.holderId` is a plain string and would
 * happily point at a beast; nothing ever gave one an id. That is the whole of
 * the gap this file closes, and it closes it with the machinery that already
 * tracks people rather than with a registry beside it.
 *
 * THE LINE IS THE CORE, AND IT IS NOT RESTATED HERE. `bandOf` and `hasACore`
 * already read `BEAST_CORE_ORDINAL`; this file calls them and never the
 * constant. A fourth expression of one boundary is how the three that exist
 * start to disagree.
 *
 * ── ONE ROW PER SPECIES PER PIECE OF GROUND ──────────────────────────────
 *
 * Every catalog entry at or above the core is `groupSize: 1` - eleven of
 * eleven, checked by `a-beast-with-a-core-is-somebody.test.ts` rather than
 * assumed - so the thing holding this ground IS the individual, and the id is
 * a function of the two facts that identify it. Nothing is stored to say which
 * one this is, so nothing can drift, and walking back onto the same ledge
 * reaches the same row.
 *
 * ── MINTED ON CONTACT, NEVER SEEDED ──────────────────────────────────────
 *
 * MEASURED FIRST, by `scripts/probe-how-many-beasts-have-a-core.ts` on seed
 * `cored-beast-measure`. A world opens holding 1,158 locations, of which 126
 * are ground rather than rooms inside a compound, and 610 living people - 96 of
 * them standing at the core rung or above. Giving every piece of ground every
 * species that could survive on it is 761 rows at day 0 and 844 at two hundred
 * years: more rows than there are people, eight times as many as there are
 * people at the same height, for things nobody has ever stood in front of. The
 * per-year pass walks `npcs`, so that is the cost of the world doubled to
 * remember animals nobody has met.
 *
 * AND THAT FIGURE IS NOT EVEN STABLE. Re-run forty minutes later on the same
 * seed it was 913, because another agent's location work had added settlements.
 * A store keyed on ground grows with whatever happens to the ground, which is a
 * second reason not to key one on it.
 *
 * A core is worth money and money is what makes a thing singular - `items.md`'s
 * own rule, and an object becomes tracked when it acquires a holder and a
 * history rather than when it is made. The same rule applied to a living thing
 * is: the row is written when somebody meets it. Day 0 holds none. What the
 * ground holds before anybody walks it is what `whatIsOnThisGround` already
 * says it holds, and a row for an unmet beast would be a second copy of that.
 *
 * ── AND IT NEEDS NOTHING ELSE TO BE SOMEBODY ─────────────────────────────
 *
 * Once the row exists and stands where the player stands, every person-shaped
 * read reaches it unchanged: `othersPresent` finds it, `whatSparingThemLeft`
 * takes it as `theirRecord`, the ledger holds it as `holderId`, and the world
 * sim moves its ordinal the way it moves anybody's, because `isTheWorldsToMove`
 * is true of it. The crossing at `BEAST_CHANGE_ORDINAL` then costs nothing at
 * all: the id does not change when the ordinal does, so the favour written
 * about the animal is held by the person, which is the entire trope.
 */

import {
    BEASTS,
    BEAST_CHANGE_ORDINAL,
    type Beast
} from '../../data/cultivation/beasts.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { clampOrdinal, lifespanForOrdinal } from '../cultivation/realms.js';
import { abilityAt, bandOf, hasACore, readsAsSomebody } from './hunting-a-spirit-beast.js';
import { createNpc, setRealm, type NpcRecord } from './npc-state.js';
import { DEFAULT_LAYER, type LayerKey } from './layers.js';

/**
 * What marks a row as one of these, and the only place that fact lives.
 *
 * The convention the seeder already uses - `catalog:member`, `faction:<id>` -
 * so this is a tag lookup rather than a branch on an id, and what species it is
 * resolves against `BEASTS` the way a faction tag resolves against the houses.
 */
export const BEAST_TAG_PREFIX = 'beast:';

/**
 * The id of the one standing on this ground. Derived, so it cannot drift.
 *
 * A FUNCTION OF THE SPECIES AND THE GROUND, AND OF NOTHING ELSE. The rung is
 * deliberately not in it: the whole point of the row is that the rung can move,
 * and an id carrying it would hand the favour to a stranger at the moment the
 * animal became a person.
 */
export function idOfTheOneOnThisGround(speciesId: string, locationId: string): string {
    return `npc-${speciesId}-${locationId}`;
}

/** The species this row is, or null for an ordinary person. */
export function theSpeciesItIs(npc: Pick<NpcRecord, 'tags'>): Beast | null {
    const tag = npc.tags.find(t => t.startsWith(BEAST_TAG_PREFIX));
    if (!tag) return null;
    return BEASTS.find(b => b.id === tag.slice(BEAST_TAG_PREFIX.length)) ?? null;
}

/** Whether this row is one of these at all. */
export function isOneOfTheBeasts(npc: Pick<NpcRecord, 'tags'>): boolean {
    return theSpeciesItIs(npc) !== null;
}

/**
 * Why this one gets no row, or null when it gets one.
 *
 * A refusal that says what would have changed it, which is what every refusal
 * in this engine owes. Below the core there is no particular animal for
 * anybody to have had a view about, so there is nothing to refuse ACCESS to -
 * the ground still has what the ground has.
 */
export function whyThisOneIsNotAnybodyInParticular(beast: Beast): string | null {
    if (hasACore(beast)) return null;
    return `${beast.name} stands at ordinal ${beast.ordinal} and has no core. It is an amount `
        + 'on a piece of ground rather than an individual - pelts and sinew, the same way a '
        + 'bowl of millet is - so there is nobody here to owe anybody anything. What carries a '
        + 'core carries a history somebody can ask about two centuries later.';
}

export interface StandingUpABeast {
    beast: Beast;
    /** The ground it holds. Half of its identity, so it is never optional. */
    locationId: string;
    /** The world seed, for the rolls `createNpc` takes. */
    seed: string;
    /** Absolute day it was met. */
    onDay: number;
    layer?: LayerKey;
}

/**
 * How long it spent getting to this rung.
 *
 * DERIVED RATHER THAN CHOSEN, because its whole method is time: it sat on the
 * best ground it could hold and did not die. What that cost is a whole life at
 * the band below - the lifespan of the highest rung that gets strictly less
 * than this one does - so a beast is as old as the band it outlasted.
 *
 * THE BAND AND NOT THE RUNG, and the difference is load-bearing. The ladder's
 * lifespans come in steps: 17 through 20 all get five hundred years, so
 * "a life at the rung below" hands a Glacier Lynx at 19 exactly the five
 * hundred it is allowed and it arrives already dead. Reading down to where the
 * number actually changes leaves every one of them old and still standing,
 * which is what the catalog's own notes describe - longer on the mountain than
 * the compound under it, and still there.
 */
function whatItSpentGettingHere(ordinal: number): number {
    const allowed = lifespanForOrdinal(ordinal);
    for (let rung = ordinal - 1; rung >= 0; rung--) {
        const below = lifespanForOrdinal(rung);
        if (below < allowed) return below;
    }
    return 0;
}

/**
 * Stand the one on this ground up as a row.
 *
 * WHAT IT IS MADE OF IS AUTHORED, so the row's specialties come off the
 * species' element rather than off a rolled spirit root. Read as a value and
 * never branched on, which is what `Beast.element` is for.
 */
export function standUpTheOneOnThisGround(input: StandingUpABeast): NpcRecord {
    const { beast, locationId, seed, onDay } = input;
    const ordinal = clampOrdinal(beast.ordinal);
    const spentGettingHere = whatItSpentGettingHere(ordinal);

    const npc = createNpc(seed, {
        id: idOfTheOneOnThisGround(beast.id, locationId),
        name: beast.name,
        bornOnDay: onDay - spentGettingHere * DAYS_PER_YEAR,
        onDay,
        locationId,
        layer: input.layer ?? DEFAULT_LAYER,
        factionId: null,
        factionRankIndex: -1,
        // It takes no orders and holds no purse. A house that has an
        // arrangement with one did not buy it.
        spiritStones: 0,
        occupation: 'unknown',
        description: beast.note,
        cultivation: {
            realmOrdinal: ordinal,
            specialties: beast.element ? [beast.element] : []
        },
        tags: [`${BEAST_TAG_PREFIX}${beast.id}`]
    });

    // The rung it is standing on was reached a long time ago, so the settling
    // clock does not read as somebody who crossed this year.
    return setRealm(npc, ordinal, onDay - spentGettingHere * DAYS_PER_YEAR);
}

/**
 * Whether this individual has made the change.
 *
 * ITS OWN ORDINAL AND NOT THE SPECIES', which is the only reason this function
 * exists: the catalog row says where that kind is usually found, and the point
 * of a row is that this one can have gone further.
 */
export function itHasCrossed(npc: Pick<NpcRecord, 'cultivation'>): boolean {
    return npc.cultivation.realmOrdinal >= BEAST_CHANGE_ORDINAL;
}

/**
 * Whether this one can be spoken to.
 *
 * TWO CASES, AND THE CATALOG DECIDES WHICH. `speaks` is a floor and not an iff:
 * two entries stand above the change and say nothing, and they are the worst
 * things in the catalog precisely because there is nothing to negotiate with.
 * That authorship is a ruling about a species that has ALREADY crossed, so
 * where the catalog row itself sits at or above the change, its answer stands.
 * Where the row sits below it, the catalog has said nothing about what this
 * kind is like afterwards, and the crossing is what confers the shape and the
 * voice.
 */
export function itSpeaksNow(npc: Pick<NpcRecord, 'tags' | 'cultivation'>): boolean {
    const species = theSpeciesItIs(npc);
    if (!species) return false;
    if (species.ordinal >= BEAST_CHANGE_ORDINAL) return readsAsSomebody(species);
    return itHasCrossed(npc);
}

/**
 * What this one is now, as facts. The narrator writes the scene.
 */
export interface WhatItIsNow {
    species: Beast;
    ordinal: number;
    /** `counted`, `tracked` or `person`, read off THIS one's rung. */
    band: ReturnType<typeof bandOf>;
    crossed: boolean;
    speaks: boolean;
    /** How far its species ability has come at the rung it is actually at. */
    ability: ReturnType<typeof abilityAt>;
    /** How many rungs it has moved since the catalog placed its kind. */
    rungsClimbed: number;
}

export function whatItIsNow(npc: NpcRecord): WhatItIsNow | null {
    const species = theSpeciesItIs(npc);
    if (!species) return null;
    const ordinal = npc.cultivation.realmOrdinal;
    // The bands are a function of a rung, so they are asked of THIS one's rung
    // rather than of the catalog's. `bandOf` and `abilityAt` take a `Beast`, so
    // the species row is handed over with the rung this individual is on - the
    // same row, read at where it actually got to.
    const asItStands: Beast = { ...species, ordinal };
    return {
        species,
        ordinal,
        band: bandOf(asItStands),
        crossed: itHasCrossed(npc),
        speaks: itSpeaksNow(npc),
        ability: abilityAt(asItStands),
        rungsClimbed: ordinal - species.ordinal
    };
}
