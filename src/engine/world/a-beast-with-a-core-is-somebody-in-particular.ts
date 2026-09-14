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
    anythingAtThisRungSpeaks,
    type Beast
} from '../../data/cultivation/beasts.js';
import { DAYS_PER_YEAR } from '../cultivation/cultivation.js';
import { clampOrdinal } from '../cultivation/realms.js';
import { abilityAt, bandOf, hasACore } from './hunting-a-spirit-beast.js';
import { addGoal, createNpc, setRealm, type NpcRecord } from './npc-state.js';
import { DEFAULT_LAYER, type LayerKey } from './layers.js';
import {
    asItStandsNow,
    whatItSpentGettingHere
} from './a-beast-climbs-by-sitting-where-it-is.js';
import { whatThisOneHasAlwaysWanted } from './what-a-beast-has-always-wanted.js';
import { personName } from './history.js';
import { forStream } from '../cultivation/rng.js';

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

/** One of these, with its species read at the rung it actually stands on. */
export interface TheOneOnThisGround {
    npc: NpcRecord;
    /** The catalog row: where its KIND is usually found. */
    species: Beast;
    /** The same row read at this one's rung, for every read that takes a `Beast`. */
    asItStands: Beast;
}

/**
 * The ones with rows of their own standing on this piece of ground.
 *
 * The hunt and the world sim both need it and neither may filter on the catalog
 * ordinal: a row is what the ground actually holds, and the whole point of a row
 * is that it has moved since the catalog placed its kind.
 */
export function theOnesInParticularAt(
    npcs: readonly NpcRecord[],
    locationId: string
): TheOneOnThisGround[] {
    const out: TheOneOnThisGround[] = [];
    for (const npc of npcs) {
        if (npc.status !== 'alive' || npc.locationId !== locationId) continue;
        const species = theSpeciesItIs(npc);
        if (species === null) continue;
        out.push({ npc, species, asItStands: asItStandsNow(species, npc.cultivation.realmOrdinal) });
    }
    return out;
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
    /**
     * Names already spoken for in this world, for the one that names itself.
     * Passed through to `createNpc` unchanged, and for its reason: the
     * knowledge table is keyed by id while everything the player reads is keyed
     * by name, so two people sharing one breaks the rule that a name you were
     * told is a name you have.
     */
    takenNames?: ReadonlySet<string>;
}

/**
 * Stand the one on this ground up as a row.
 *
 * WHAT IT IS MADE OF IS AUTHORED, so the row's specialties come off the
 * species' element rather than off a rolled spirit root. Read as a value and
 * never branched on, which is what `Beast.element` is for.
 *
 * AND WHAT IT IS CALLED DEPENDS ON WHETHER IT HAS CROSSED. Below the change the
 * species name is the honest label: it is an animal, and "a Thunder Hawk" is
 * what anybody standing there would say. At or above it, it named itself, and
 * the name is rolled from the same table every person in this world is named
 * from - `personName` through `createNpc`, avoiding `takenNames`. The design
 * owner, on a player who could reach one only by typing its species:
 * *"calling them an ape in human form is disrespectful."* So the species is a
 * fact about what somebody is and is never how they are addressed, and nothing
 * needed adding to the catalog: a name belongs to an individual and the row
 * already exists.
 *
 * AND IT IS MINTED AT THE CATALOG'S RUNG, WHICH IS A DECISION. The individual
 * on this ledge climbs after this, in world time - see
 * `a-beast-climbs-by-sitting-where-it-is.ts` - and the clock it climbs on
 * starts the day the row is written, not the day the world opened. Measured on
 * the first cut, which used the world's calendar age instead: a world opens at
 * year 1,000, so every beast in it was minted at what a thousand years does,
 * and `something-with-a-core-is-somebody-you-can-spare.test.ts` went red - a
 * Thunder Hawk placed at 17 came up somewhere in the twenties and a rung-22
 * player could no longer beat it. That is not the world running. It is a
 * balance change baked into seeding.
 *
 * The cost of the decision, stated plainly rather than hidden: a species on
 * ground nobody has ever walked does not climb, because nothing is tracking it
 * to climb. That follows from this file's own measured ruling that a row is
 * written on contact, and it is the same trade - what the ground holds before
 * anybody meets it is what `whatIsOnThisGround` says it holds.
 *
 * ── THE RENAMING GAP, AND WHY IT IS NOT ONE ─────────────────────────────
 *
 * It used to be written here that a beast met at 17 and spared, which later
 * climbs past 29, keeps the species name it was given, because renaming it
 * would break the rule that a name you were told is a name you have. That was
 * stated as an absence with no answer. It has one, and it costs nothing:
 *
 * A NAME IS NOT TAKEN AWAY, A SECOND ONE IS ADDED. {@link theNameItTookAtTheChange}
 * rolls the person's name at the crossing and {@link theNamesThisOneAnswersTo}
 * returns both - the species name first, because that is the one the player was
 * told and the one their knowledge rows carry. Nothing is stored for it: the
 * species name is a function of the `beast:` tag the row already has, so the
 * two names cannot drift and no write can forget one.
 *
 * That is also the honest fiction. Somebody who knew the thing on that ledge as
 * a Thunder Hawk for forty years does not stop knowing it as one because it now
 * has a name, and the design owner's objection to a player reaching one by its
 * species - *"calling them an ape in human form is disrespectful"* - is about
 * how somebody is ADDRESSED, which is the row's `name` and is now the person's.
 *
 * AND TYPING THE OLD NAME REACHES IT. `resolveCultivator` scored against
 * `row.name` alone while its candidates carried no tags, so the old name
 * reached nobody; `RosterEntry` now carries the row's tags and `best` scores
 * every name a row answers to, preferring the one it is addressed by. The
 * design owner: *"it might answer to its old name but it prefers this one."*
 */
export function standUpTheOneOnThisGround(input: StandingUpABeast): NpcRecord {
    const { beast, locationId, seed, onDay } = input;
    const ordinal = clampOrdinal(beast.ordinal);
    const spentGettingHere = whatItSpentGettingHere(ordinal);

    const npc = createNpc(seed, {
        id: idOfTheOneOnThisGround(beast.id, locationId),
        name: anythingAtThisRungSpeaks(ordinal) ? undefined : beast.name,
        takenNames: input.takenNames,
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
    const placed = setRealm(npc, ordinal, onDay - spentGettingHere * DAYS_PER_YEAR);

    // WHAT IT WANTS IS WRITTEN AT THE CORE, NOT AT THE CHANGE. The want is a
    // fact about the animal, so the row carries it from the day the row exists
    // and the crossing does not touch it - see
    // `what-a-beast-has-always-wanted.ts`. Opened on the day it spent getting
    // here rather than today, because it has wanted this for as long as it has
    // been what it is, and `howLongTheyHaveWantedIt` reads that day out.
    return addGoal(
        placed,
        whatThisOneHasAlwaysWanted({ beast, locationId }),
        onDay - spentGettingHere * DAYS_PER_YEAR
    );
}

/**
 * The name a row takes when the world moves it past the change.
 *
 * Rolled from the table every person in this world is named from, on the same
 * stream `createNpc` uses, so a name minted here and a name minted at stand-up
 * are the same kind of name and neither is a beast name.
 *
 * Returns null where nothing should change: one already past the change named
 * itself when it was met, and one still below it has no name to take.
 */
export function theNameItTookAtTheChange(
    npc: NpcRecord,
    seed: string,
    takenNames?: ReadonlySet<string>
): string | null {
    if (!itHasCrossed(npc)) return null;
    if (theSpeciesItIs(npc) === null) return null;
    // The species name is what a row below the change is called. Anything else
    // is a name it already rolled, and rolling a second would be the rename
    // this file refuses.
    if (npc.name !== theSpeciesItIs(npc)?.name) return null;
    return personName(forStream(seed, 'npc-name', npc.id), takenNames);
}

/**
 * Every name this row answers to, most particular first.
 *
 * DERIVED, WHICH IS WHAT MAKES THE CROSSING SAFE. A player who was told
 * `Thunder Hawk` holds a knowledge row saying `Thunder Hawk`, and that row
 * keeps reaching this individual after it takes a person's name, because the
 * species name is a function of the tag rather than of the `name` column.
 * Nothing is stored, so nothing can drift and no write can forget.
 *
 * An ordinary person and a beast below the change both come back with one name,
 * which is the same answer they gave before this existed.
 */
export function theNamesThisOneAnswersTo(npc: Pick<NpcRecord, 'name' | 'tags'>): string[] {
    const species = theSpeciesItIs(npc);
    if (species === null || species.name === npc.name) return [npc.name];
    return [species.name, npc.name];
}

/**
 * Whether this individual has made the change, and therefore speaks.
 *
 * ITS OWN ORDINAL AND NOT THE SPECIES', which is the only reason this function
 * exists: the catalog row says where that kind is usually found, and the point
 * of a row is that this one can have gone further.
 *
 * THERE USED TO BE A SECOND FUNCTION HERE. `itSpeaksNow` asked the catalog row
 * first and only fell through to the crossing when the species sat below it,
 * because a species could be authored mute above the change. The design owner
 * overruled that - *"species can't be categorized as speaks false. under 29 =
 * speaks false."* - and with the column gone the two functions became one
 * expression under two names, which is the drift AGENTS.md forbids. Crossing is
 * the speech. There is one predicate.
 */
export function itHasCrossed(npc: Pick<NpcRecord, 'cultivation'>): boolean {
    return anythingAtThisRungSpeaks(npc.cultivation.realmOrdinal);
}

/**
 * What this one is now, as facts. The narrator writes the scene.
 */
export interface WhatItIsNow {
    species: Beast;
    ordinal: number;
    /** `counted`, `tracked` or `person`, read off THIS one's rung. */
    band: ReturnType<typeof bandOf>;
    /** Past the change, which is the same fact as speaking. */
    crossed: boolean;
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
    const asItStands = asItStandsNow(species, ordinal);
    return {
        species,
        ordinal,
        band: bandOf(asItStands),
        crossed: itHasCrossed(npc),
        ability: abilityAt(asItStands),
        rungsClimbed: ordinal - species.ordinal
    };
}
