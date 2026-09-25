/**
 * Who is on each faction's roll, from every catalog that holds people, in one
 * place.
 *
 * WHY THIS EXISTS. A faction's membership was never a thing you could ask for.
 * It was a property of each PERSON - `Member.factionId` - and anything that
 * wanted the other direction rebuilt it by scanning: the register filtered
 * `MEMBERS`, the court panel read `Court.roster`, and the Empyrean Court's people
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
 *   off-ladder titles  the one thing a `Member` row cannot express: somebody
 *                      holding a position that is not a rung. A court's
 *                      offices are parallel jobs; the Empyrean Court's Guest
 *                      stands above the ladder rather than on it.
 *
 * THE EMPYREAN COURT USED TO BE A WHOLE THIRD SOURCE HERE AND IS NOT ANY MORE.
 * Everybody on its ladder is on `MEMBERS` with the rest of the world, projected
 * out of `hollow-court-roster.ts` where they are still authored - that file
 * kept its own shape because it carries things no other house needs, like the
 * alias somebody works under outside. A second ROLL was a second answer to one
 * question, and the seeder reading only the first one is what left the apex of
 * the setting populated by strangers who did not match the register.
 *
 * WHAT IS DELIBERATELY NOT ON A ROLL. The dead, the sealed and the ascended.
 * They are on the ANCESTRAL record, which is a different question with a
 * different answer - a roll says who can be met, and a wall of tablets says who
 * cannot. The register keeps those apart on the page for the same reason and it
 * should stay that way.
 *
 * `rollOf` DECIDES NOTHING. It sorts and returns rows, and a faction's ordinal
 * is still its strongest acting member and still lives on the faction rather
 * than on a sum over this list.
 *
 * ONE THING BELOW IT DOES DECIDE, and it is stated where it happens rather than
 * hidden here: `whoCountsTowardThisHouse` says how much of a SECONDED person a
 * house has, because somebody standing a watch at another body is on two rolls
 * and the two shares have to sum to one person. That is a fact about where
 * people are, not a strength arithmetic - what to do with the weights is the
 * rating's business and is in `how-strong-a-house-actually-is.ts`.
 */

import { MEMBERS } from './members.js';
import { COURTS, idsForFaction } from './governance-and-water-rights.js';
import { HOLLOW_COURT_ROSTER } from './hollow-court-roster.js';

/** Which catalog a row came out of, so a reader can go and check it. */
export type RollSource = 'members' | 'court officers' | 'an honorary title';

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
    // ── And the people a `Member` row cannot express: those off the ladder. ──
    //
    // `Member.rankIndex` is an index into a house's `ranks` and is not
    // nullable, because on every other house it always has one. A title that
    // sits OUTSIDE the ladder rather than beneath it has no index by
    // definition, and the two entries here that carry one - a court's parallel
    // offices, and the Empyrean Court's Guest - are the same shape rather than
    // two exceptions.
    //
    // Everybody at the Court who IS on the ladder reaches this roll through
    // `MEMBERS` with everybody else in the world. Only the off-ladder title
    // comes through here, which is why the filter is on `rankIndex` rather
    // than on a faction id: a second house granting an honorary seat would
    // need no change.
    ...HOLLOW_COURT_ROSTER.filter(m => m.rankIndex === null).map(m => ({
        id: m.id,
        name: m.name,
        factionId: 'sect-hollow-court',
        rank: m.tier,
        rankIndex: null,
        realmOrdinal: m.realmOrdinal,
        source: 'an honorary title' as const,
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

// ─────────────────────────────────────────────────────────────────────────
// SECONDMENT: TWO ROLLS, AND ONE PERSON
//
// THE TRIPOD WARDENS AND THE DEEPROOT COURT ARE POSTINGS, NOT SECTS. `sects.ts`
// has said so about the Wardens from the start - *"It teaches nothing and takes
// nobody"* - and `PostingSchema` in the governance catalog states the shape in
// full: there is no application to make, and the decision is taken by somebody
// else, about you, elsewhere. Nothing acted on it, so a body with no intake
// looked like a body with nobody.
//
// They are staffed by SECONDMENT, and the sending houses are not only the apex
// above them: lower sects get places too, which is the whole reason a posting
// is worth having from below - *"a rung of standing reached by being sent
// rather than by climbing, and the only career route in this world where the
// decision is somebody else's."* Places are allocated per sending house the
// same way places at a slotted ruin are, and that allocation is NOT built here:
// the slot mechanic belongs to the world tick and is being made general enough
// to staff a posting. This file does the counting only.
//
// ── A PERSON IS CONSERVED, AND THAT IS THE WHOLE RULE ────────────────────
//
// The design owner: *"each person counts as 1 - i don't want people more than
// '1'."* So a secondment SPLITS somebody rather than duplicating them, and
// every weight one person carries across every roll they appear on sums to
// exactly one.
//
//     0.9 at the posting      They are standing the watch. When the Tripod fields
//                             what it has, it fields them, and a warden at the
//                             world-heart is the Tripod's in every way that
//                             decides anything today.
//     0.1 at the sending      The tie, and it is real: they came from there,
//         house               they are still of it, and it will have them back.
//                             What it is not is availability - the house cannot
//                             call on them this afternoon.
//
// The asymmetry runs that way because the alternative reads a sect as
// undiminished by having sent its people away, which is plainly false and
// would make sending free. Nine to one keeps the price of a secondment real
// without turning it into a departure, which is a different arrangement with a
// different name.
//
// AND THE CONSERVATION IS THE POINT RATHER THAN THE FIGURES. A first draft of
// this rule read *"full weight at the posting and a fraction at home"*, which
// would have meant a seconded warden made the world bigger - a silent gain of
// people, every individual number looking plausible. Summing to one makes that
// impossible by construction instead of by care, which is why the split is
// stated as a split and asserted as one.
// ─────────────────────────────────────────────────────────────────────────

/** What a seconded person is worth to the body they are standing in. */
export const WHAT_A_SECONDED_PERSON_IS_WORTH_AT_THE_POSTING = 0.9;

/** And to the house that sent them. The two sum to one, by construction. */
export const WHAT_A_SECONDED_PERSON_IS_WORTH_AT_HOME =
    1 - WHAT_A_SECONDED_PERSON_IS_WORTH_AT_THE_POSTING;

/** One person on a roll, with how much of them this body actually has. */
export interface CountedBody {
    id: string;
    realmOrdinal: number;
    /** 1 for an ordinary member; a share where somebody is seconded. */
    weight: number;
}

/**
 * A place somebody has been sent, from somewhere.
 *
 * DELIBERATELY NOT A CATALOG HERE. The allocation is the world tick's and does
 * not exist yet; this is the shape the counting needs from it, so that when it
 * lands nothing about the rating has to change. What it has to supply per
 * person is three facts: who, where they are standing, and where they came
 * from.
 */
export interface Secondment {
    personId: string;
    realmOrdinal: number;
    /** The posting they are standing in. */
    postingFactionId: string;
    /** The house that sent them, which may be any house at all. */
    sendingFactionId: string;
}

/**
 * Everybody who counts toward this house, and how much of each of them it has.
 *
 * ONE FUNCTION FOR BOTH SIDES, which is what keeps the split honest: the
 * fraction is applied on the SENDING side here and nowhere else, so there is no
 * second place for it to be applied again or forgotten. Nobody is counted twice
 * within one house - a person seconded from a house to itself would be absurd
 * and is dropped rather than doubled.
 *
 * With no secondments supplied this is `rollOf` with a weight of one apiece,
 * which is what every caller gets until the allocation exists.
 */
export function whoCountsTowardThisHouse(
    factionId: string,
    secondments: readonly Secondment[] = []
): CountedBody[] {
    const ids = new Set(idsForFaction(factionId));
    const counted = new Map<string, CountedBody>();

    for (const entry of rollOf(factionId)) {
        counted.set(entry.id, { id: entry.id, realmOrdinal: entry.realmOrdinal, weight: 1 });
    }

    for (const sent of secondments) {
        if (sent.postingFactionId === sent.sendingFactionId) continue;
        const standingHere = ids.has(sent.postingFactionId);
        const sentFromHere = ids.has(sent.sendingFactionId);
        if (!standingHere && !sentFromHere) continue;
        counted.set(sent.personId, {
            id: sent.personId,
            realmOrdinal: sent.realmOrdinal,
            weight: standingHere
                ? WHAT_A_SECONDED_PERSON_IS_WORTH_AT_THE_POSTING
                : WHAT_A_SECONDED_PERSON_IS_WORTH_AT_HOME
        });
    }

    return [...counted.values()].sort((a, b) => b.realmOrdinal - a.realmOrdinal);
}
