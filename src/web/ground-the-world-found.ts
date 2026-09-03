/**
 * Ground the simulation uncovered, made reachable by a player.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS EXISTS FOR
 * ═════════════════════════════════════════════════════════════════════════
 *
 * `nameableSites` and `whereCouldTheyGo` read the STATIC catalogs and nothing
 * else - `SITES` and the region gazetteer - and never `state.locations`. So
 * every ruin, vault and sealed place the world found on its own went into a
 * table nothing player-facing read, permanently.
 *
 * That was survivable while the discovery engine did nothing. It is not now:
 * the old world genuinely ran dry at 0.0 openings per century in the last fifth
 * of a 5,000-year run, with all 709 in-ground sites still unfound, and the
 * repaired engine produces 4.1-5.0 openings per century across 5,000 years with
 * provinces visibly diverging. So the world steadily uncovers closed ground and
 * a player could only ever visit the thirty places written down before the game
 * started. It is this repository's signature defect - a system that binds the
 * simulation and does not reach the played game - in its purest form.
 *
 * ── Why this is a separate surface from `trials.ts` ──────────────────────
 *
 * A catalog `Site` is mostly AUTHORED PROSE: `RuinAccessSchema` alone demands
 * three strings of at least eighty characters, each written for one place and
 * no other, and the interior demands more. That writing is why the authored
 * sites play as well as they do.
 *
 * A prospected find has none of it. It carries STRUCTURE - character, origin,
 * scale, intent standing, who it was, what it admits, its floor and its ceiling
 * - and no sentences. Synthesising a `Site` from one would mean inventing those
 * eighty-character strings, which would give every generated ruin in the world
 * the same voice and would be exactly the template the authored catalog exists
 * to avoid.
 *
 * So this states what is known and never composes what is not. The narrator
 * dresses it, out of facts the engine actually holds, which is the same
 * division every other read in this package keeps.
 */

import type { LocationRecord } from '../engine/world/locations.js';
import type { WorldState } from '../engine/world/world-state.js';
import { FOUND_BY_PROSPECTING_TAG } from '../engine/world/how-the-world-keeps-finding-more-ruins.js';
import {
    readAdmission,
    type AdmissionReading,
    type RuinAccess
} from '../data/cultivation/inheritance-trials.js';
import { rankName } from '../engine/cultivation/realms.js';
import { matchScore, MATCH_THRESHOLD } from './entities.js';

/**
 * One piece of ground the world found, as the engine holds it.
 *
 * Every field is copied from `location.data`, which the prospecting pass wrote.
 * Nothing here is derived and nothing is invented.
 */
export interface FoundGround {
    id: string;
    name: string;
    /** `vault`, `compound`, `cave` - the catalog's own `RuinCharacter` values. */
    character: string;
    origin: string | null;
    scale: string | null;
    intentStanding: string | null;
    /** Whose it was, where the world recorded a person. */
    occupantName: string | null;
    /** The rung they stood at, which is what set the depth. */
    setByOrdinal: number | null;
    /** How much of what was put up is still standing, 0..1. */
    wardIntegrity: number | null;
    /** The day it was found, in world days. */
    discoveredOnDay: number | null;
    /** What the ground does to a body, in the same three shapes the catalog uses. */
    access: RuinAccess | null;
    /**
     * True where being able to name this needs no source, because everybody
     * from here can.
     *
     * See {@link foundGroundIn} for the rule and why it is not a discovery leak.
     */
    countyKnowledge: boolean;
}

/**
 * Ground that stood open before this life started, rather than during it.
 *
 * The tag `locationFromRuin` puts on the twelve compounds the prior ages left.
 * They are the world's OWN history rather than anybody's find, and that is the
 * distinction the county rule in {@link foundGroundIn} turns on.
 */
const LEFT_BY_THE_PRIOR_AGES_TAG = 'late_age';

/** An opened prior-age ruin: sealed centuries ago, and got into since. */
function isOpenedPriorAgeRuin(location: LocationRecord): boolean {
    return location.kind === 'ruin'
        && (location.tags ?? []).includes(LEFT_BY_THE_PRIOR_AGES_TAG)
        && !location.sealed
        && location.discovered !== false;
}

/**
 * Whether a world location is open ground a player could be standing outside.
 *
 * Two sources and they are not the same kind of thing. The prospecting pass
 * uncovers ground DURING a run; the prior ages left twelve sealed compounds
 * that the world may since have got into. Both are a discovered ruin with an
 * access rule, which is all this surface needs - and the second was invisible
 * here, so a run could open with an open ruin in the next valley and no verb
 * that would ever mention it.
 */
export function isFoundGround(location: LocationRecord): boolean {
    if (isOpenedPriorAgeRuin(location)) return true;
    return (location.tags ?? []).includes(FOUND_BY_PROSPECTING_TAG)
        && location.discovered !== false;
}

/**
 * Rebuild the access rule off what the find recorded.
 *
 * The prospecting pass stores `admits`, `floorOrdinal` and `ceilingOrdinal` as
 * plain fields; `readAdmission` wants the discriminated union. This is the one
 * conversion, and it returns null rather than guessing when the row is missing
 * something - a find with no recorded access is ground nobody has read yet, and
 * saying so is better than defaulting it open.
 *
 * The long strings the catalog's own union carries are empty here and are never
 * read: `readAdmission`'s `account` is not used for found ground, because there
 * is no authored sentence to quote. `describeFoundGround` states the structure
 * instead, which is the whole distinction this file is built on.
 */
function accessOf(data: Record<string, unknown>): RuinAccess | null {
    const admits = typeof data.admits === 'string' ? data.admits : null;
    const floor = typeof data.floorOrdinal === 'number' ? data.floorOrdinal : null;
    if (admits === null || floor === null) return null;

    if (admits === 'nobody_above_the_line') {
        const ceiling = typeof data.ceilingOrdinal === 'number' ? data.ceilingOrdinal : null;
        if (ceiling === null) return null;
        return {
            admits: 'nobody_above_the_line',
            floorOrdinal: floor,
            ceilingOrdinal: ceiling,
            whatReadsThePerson: '',
            whyItRefusesPower: '',
            soWhoGoesInstead: ''
        };
    }
    if (admits === 'elders_and_above') {
        return {
            admits: 'elders_and_above',
            floorOrdinal: floor,
            whyNobodyBelowComesBack: '',
            whoTheyGoFor: '',
            whatComesBackForThatPerson: ''
        };
    }
    return {
        admits: 'anyone_who_survives_it',
        floorOrdinal: floor,
        whatIsDownThere: '',
        whatItDoesToSomebodyShortOfIt: ''
    };
}

function stringOr(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
function numberOr(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * What a prior-age ruin does to a body, off the bars the world already holds.
 *
 * Those twelve carry no `admits` in `data` - `locationFromRuin` writes a seal
 * year and a former house, not an access rule - and the answer is not missing,
 * it is one column over. `survival` IS the floor: nothing forbids the entry now
 * that the seal is off and nobody is left to refuse anybody, and whether it was
 * a good idea is settled on the way out. The same conversion the prospecting
 * pass makes for a dead house's seat.
 *
 * Derived rather than stored, so a ruin whose bars move does not go on
 * advertising the old ones.
 */
function accessFromTheBars(location: LocationRecord): RuinAccess {
    return {
        admits: 'anyone_who_survives_it',
        floorOrdinal: location.thresholds.survival,
        whatIsDownThere: '',
        whatItDoesToSomebodyShortOfIt: ''
    };
}

/** One find, read off the world row. */
export function foundGroundOf(location: LocationRecord): FoundGround {
    const data = (location.data ?? {}) as Record<string, unknown>;
    return {
        id: location.id,
        name: location.name,
        character: stringOr(data.ruinCharacter) ?? location.kind,
        origin: stringOr(data.ruinOrigin),
        scale: stringOr(data.ruinScale),
        intentStanding: stringOr(data.intentStanding),
        occupantName: stringOr(data.occupantName),
        setByOrdinal: numberOr(data.setByOrdinal),
        wardIntegrity: numberOr(data.wardIntegrity),
        discoveredOnDay: numberOr(location.discoveredOnDay),
        // What the prospecting pass recorded, and where it recorded nothing,
        // what the bars on the row already say. Still null for a find nobody
        // has read - that is a real answer and stays one.
        access: accessOf(data)
            ?? (isOpenedPriorAgeRuin(location) ? accessFromTheBars(location) : null),
        // A ruin the province got into a lifetime ago is a different kind of
        // thing from one uncovered last spring, and the difference decides
        // whether knowing about it needs a source. See `foundGroundIn`.
        countyKnowledge: isOpenedPriorAgeRuin(location)
    };
}

/**
 * Everything the world has found in one province that this cultivator may name.
 *
 * Gated on the same awareness predicate the authored sites use, because a find
 * is a place like any other: the world knowing about it is not the player
 * knowing about it, and handing over every ruin in the province the moment one
 * is uncovered would spend a discovery somebody else made.
 *
 * Province-scoped for the same reason `quietGroundIn` is - this is local
 * geography, and a ruin four provinces away is a name somebody has to say to
 * you.
 *
 * ── AND ONE THING IS NOT A DISCOVERY ─────────────────────────────────────
 *
 * A ruin the province got into a lifetime ago, in the county you were born in,
 * is not somebody's find. It is the county, and `seedStartingAwareness` already
 * hands the whole county out unconditionally on the argument that *"a child in
 * a temple town can name the market town two days off, because everybody around
 * them could before that child could walk."* It reads `REGIONS` for that, and
 * these compounds are not in `REGIONS` - the world made them - so the floor
 * everybody has stopped at the edge of the static catalog and a run opened with
 * nothing to aim at.
 *
 * So the gate is asked for everything the world UNCOVERED and skipped for
 * ground that stood open before this life began. That is the same line, drawn
 * in the same place, over a place the catalog could not list. Prospected finds
 * are unchanged: those are discoveries and are spent by whoever made them.
 *
 * ── AND THE PROVINCE FILTER CANNOT REACH THEM EITHER ─────────────────────
 *
 * `locationFromRuin` sets no `parentId`, so **a seeded ruin is in the world and
 * in no province** - which `findUndiscoveredUnder` in
 * `how-the-world-keeps-finding-more-ruins.ts` had already found and documented,
 * for the same reason: it made the whole seeded stock unreachable to a pass that
 * filtered by region. Its answer was that a party from anywhere may claim one,
 * and this is the same answer from the player's side.
 *
 * A site that is in no province is not four provinces away - it is unplaced,
 * which is exactly the sort of ground somebody stumbles onto. So the province
 * filter is asked of everything that HAS a province and skipped for what does
 * not. If the seeding pass ever parents these, this stops firing on its own and
 * the ordinary rule takes over.
 */
export function foundGroundIn(
    world: WorldState | null,
    regionId: string | null,
    holdsRecordFor: (locationId: string) => boolean
): FoundGround[] {
    if (!world) return [];
    return world.locations
        .filter(isFoundGround)
        .filter(row => regionId === null || row.parentId === null || row.parentId === regionId)
        .filter(row => isOpenedPriorAgeRuin(row) || holdsRecordFor(row.id))
        .map(foundGroundOf)
        .sort((a, b) => (b.setByOrdinal ?? 0) - (a.setByOrdinal ?? 0) || (a.name < b.name ? -1 : 1));
}

/** Which find a sentence meant, out of the ones this cultivator may name. */
export function resolveFoundGround(
    query: string,
    permitted: readonly FoundGround[]
): FoundGround | null {
    const wanted = query.trim();
    if (wanted.length < 3) return null;
    let winner: FoundGround | null = null;
    let winning = 0;
    for (const ground of permitted) {
        const score = matchScore(wanted, ground.name);
        if (score > winning) {
            winner = ground;
            winning = score;
        }
    }
    return winning >= MATCH_THRESHOLD ? winner : null;
}

/** What this ground does to a body at this ordinal, or null where it is unread. */
export function readFoundGroundAccess(
    ground: FoundGround,
    ordinal: number
): AdmissionReading | null {
    return ground.access ? readAdmission(ground.access, ordinal) : null;
}

/**
 * The engine's own account of a find, in facts rather than in composed prose.
 *
 * Deliberately a list of measured things. The authored catalog gets to say that
 * the cave which checks the work "wanted something that is not power"; this
 * gets to say what character it is, who left it, at what rung, and what the
 * ground does - and the narrator makes sentences of that. Writing in the
 * authored register here would flatten every generated ruin in the world into
 * one voice, which is the failure the authored catalog is expensive to avoid.
 */
export function describeFoundGround(ground: FoundGround): string[] {
    const readable = (value: string): string => value.replace(/_/g, ' ');
    const lines: string[] = [];

    lines.push(
        `${ground.name}: ${readable(ground.character)}`
        + `${ground.scale ? `, ${readable(ground.scale)}` : ''}`
        + `${ground.origin ? `, ${readable(ground.origin)}` : ''}.`
    );

    if (ground.occupantName && ground.setByOrdinal !== null) {
        lines.push(
            `It was ${ground.occupantName}, who stood at ${rankName(ground.setByOrdinal)}. `
            + 'What is in it is one person\'s own inventory rather than a table roll.'
        );
    } else if (ground.setByOrdinal !== null) {
        lines.push(
            `Whoever left it stood at ${rankName(ground.setByOrdinal)}, which is what set how `
            + 'deep it goes.'
        );
    }

    if (ground.wardIntegrity !== null) {
        const percent = Math.round(ground.wardIntegrity * 100);
        lines.push(
            percent >= 80
                ? `What was put up around it is still standing, at about ${percent} per cent.`
                : percent >= 25
                    ? `The wards are about ${percent} per cent of what they were. Time has been at them.`
                    : `Almost nothing of the wards is left - about ${percent} per cent. Whatever `
                      + 'kept people out is not keeping them out any more.'
        );
    }

    if (ground.access) {
        const floor = rankName(ground.access.floorOrdinal);
        lines.push(
            ground.access.admits === 'nobody_above_the_line'
                ? `It is closed from above: nothing over `
                  + `${rankName(ground.access.ceilingOrdinal)} is let in, and under ${floor} the `
                  + 'ground is deeper than the body.'
                : ground.access.admits === 'elders_and_above'
                    ? `Nothing under ${floor} comes back out of it, and whoever goes is not the `
                      + 'one who gains by it.'
                    : `Anybody may walk in. Under ${floor} they do not walk out.`
        );
    } else {
        lines.push(
            'Nobody has read what it does to a body yet. That is the first thing to find out '
            + 'about it, and finding out is not free.'
        );
    }

    return lines;
}
