/**
 * Who is on each faction's roll, from every catalog that holds people, in one
 * place.
 *
 * WHY THIS EXISTS. A faction's membership was never a thing you could ask for.
 * It was a property of each PERSON - `Member.factionId` - and anything that
 * wanted the other direction rebuilt it by scanning: the register filtered
 * `MEMBERS`, the court panel read `Court.roster`, and the Hollow Court's people
 * were nowhere at all. Three readers, three different answers to one question,
 * and none of them able to say how many people a house has without doing the
 * scan again.
 *
 * So the roll is a first-class thing that can be asked for, and it is a UNION
 * rather than a fourth store. Nothing is copied here. Every entry is a row that
 * already exists somewhere, restated in one shape with `source` saying where it
 * came from, so a reader can go and check it and so a new catalog of people
 * joins the roll by being added to this file's list rather than by every
 * consumer learning about it.
 *
 * THE THREE SOURCES TODAY
 * -----------------------
 *   members            `members.ts` - the roster at human scale, weighted hard
 *                      toward the bottom of the ladder, which is where the
 *                      player starts and where almost everybody is.
 *   court officers     `COURTS[].roster` - three to six people doing a job on
 *                      somebody else's vein. Not a ladder and not sorted like
 *                      one; a court's offices are parallel jobs.
 *   the Hollow Court   `hollow-court-roster.ts` - the one house whose people
 *                      could not live in `members.ts`, because that catalog is
 *                      calibrated for the bottom of the ladder and everybody
 *                      here is at Void Refinement or above.
 *
 * WHAT IS DELIBERATELY NOT ON A ROLL. The dead, the sealed and the ascended.
 * They are on the ANCESTRAL record, which is a different question with a
 * different answer - a roll says who can be met, and a wall of tablets says who
 * cannot. The register keeps those apart on the page for the same reason and it
 * should stay that way.
 *
 * NOTHING HERE DECIDES ANYTHING. `rollOf` sorts and returns rows. There is no
 * strength-of-house arithmetic, no headcount threshold and no derived power: a
 * faction's ordinal is its strongest acting member and lives on the faction,
 * not on a sum over this list.
 */

import { MEMBERS } from './members.js';
import { COURTS, idsForFaction } from './governance-and-water-rights.js';
import { HOLLOW_COURT_ROSTER } from './hollow-court-roster.js';

/** Which catalog a row came out of, so a reader can go and check it. */
export type RollSource = 'members' | 'court officers' | 'the Hollow Court roster';

/**
 * One person on a roll, in the shape every source can answer in.
 *
 * Deliberately thin. The full record stays where it lives and is reached by
 * `id`; what a roll needs to answer is who is here, at what rung, holding what
 * office, and where to go for the rest of it.
 */
export interface RollEntry {
    id: string;
    name: string;
    /** The id this person is filed under, which may be a court or a sect. */
    factionId: string;
    /** The office or rung they hold, in that body's own words. */
    rank: string;
    /** Position on the body's own ladder, or null where the body has none. */
    rankIndex: number | null;
    realmOrdinal: number;
    source: RollSource;
    /** One line about what they are doing here. Never a summary of the person. */
    doing: string;
}

const ALL: readonly RollEntry[] = [
    ...MEMBERS.map(m => ({
        id: m.id,
        name: m.name,
        factionId: m.factionId,
        rank: m.rank,
        rankIndex: m.rankIndex,
        realmOrdinal: m.realmOrdinal,
        source: 'members' as const,
        doing: m.wants
    })),
    ...COURTS.flatMap(c => c.roster.map(o => ({
        id: o.id,
        name: o.name,
        factionId: c.id,
        rank: o.title,
        // Null on purpose. A court's offices are parallel jobs rather than
        // rungs, and giving them an index would invent a chain of command out
        // of a set of people doing different work.
        rankIndex: null,
        realmOrdinal: o.realmOrdinal,
        source: 'court officers' as const,
        doing: o.office
    }))),
    ...HOLLOW_COURT_ROSTER.map(m => ({
        id: m.id,
        name: m.name,
        factionId: 'sect-hollow-court',
        rank: m.tier,
        rankIndex: m.rankIndex,
        realmOrdinal: m.realmOrdinal,
        source: 'the Hollow Court roster' as const,
        doing: m.howFarAlong
    }))
];

const BY_FACTION: ReadonlyMap<string, RollEntry[]> = (() => {
    const map = new Map<string, RollEntry[]>();
    for (const entry of ALL) {
        const bucket = map.get(entry.factionId);
        if (bucket) bucket.push(entry);
        else map.set(entry.factionId, [entry]);
    }
    // Strongest first, then by name, which is the order every consumer wanted
    // and each was applying for itself.
    for (const bucket of map.values()) {
        bucket.sort((a, b) => b.realmOrdinal - a.realmOrdinal || a.name.localeCompare(b.name));
    }
    return map;
})();

/**
 * Everybody on this body's roll, strongest first.
 *
 * Resolved through every id the body is filed under, because a court that is
 * also a sect has a row in two catalogs and its people were written against
 * whichever id their author had in front of them. Asking with either id gets
 * the same roll.
 */
export function rollOf(factionId: string): RollEntry[] {
    const seen = new Set<string>();
    const out: RollEntry[] = [];
    for (const id of idsForFaction(factionId)) {
        for (const entry of BY_FACTION.get(id) ?? []) {
            if (seen.has(entry.id)) continue;
            seen.add(entry.id);
            out.push(entry);
        }
    }
    return out.sort((a, b) => b.realmOrdinal - a.realmOrdinal || a.name.localeCompare(b.name));
}

/** How many people are on it. Never a measure of the body's strength. */
export function rollSizeOf(factionId: string): number {
    return rollOf(factionId).length;
}

/** The whole world's roll, for tests and for anything sweeping every body. */
export function everybodyOnARoll(): readonly RollEntry[] {
    return ALL;
}
