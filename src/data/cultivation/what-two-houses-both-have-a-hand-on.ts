/**
 * What two houses both have a hand on, and therefore what they are contending
 * over whether or not anybody wrote it down.
 *
 * `faction-relationships.ts` answers *what tie is there between these two* -
 * who holds from whom, who feuds with whom, how warm each end is. This module
 * answers the question standing beside it, which the register had no way to
 * ask: *what is the object they are both reaching for*. Those are different
 * facts and the catalog has always held both, in different tables.
 *
 * WHY THIS IS DERIVED AND NOT A FIELD
 * -----------------------------------
 * The obvious shape is an `enemies: [...]` and a `competitors: [...]` beside
 * the `rivals` list that already exists. It is the wrong shape, and the reason
 * is the rule about lore: two houses claiming one founding ARE at odds by
 * virtue of the claim, and asserting it a second time in a list beside the
 * claim gives the world two places to disagree with itself. The register is a
 * reflection. So a contention here is never authored - it falls out of an
 * object that two bodies are both already recorded as holding, and it names the
 * table it fell out of so a reader can go and check.
 *
 * The worked case, and the one this module was built for. The Kiln Court and
 * the Root Sill Court are the two halves of one posting that split nine hundred
 * years ago; each kept a different token of the same founding, and neither has
 * written to the other since. Nothing in `rivals` connects them - both lists are
 * empty - and neither carries an ambition, so nothing in `contestedWith`
 * connects them either. What DOES connect them is already in the catalog:
 * `event-the-reposting` names both as parties and carries `explains: 'the
 * claim'`, which is the catalog's own word for an ancestral or lineage claim.
 * Two bodies, one founding, both on record. The contention is read out of that
 * row rather than written next to it.
 *
 * THE SHAPE, WHICH IS THE POINT
 * -----------------------------
 * There is no branch on a kind of relation anywhere in this file, and adding a
 * tenth source of contention must never introduce one.
 *
 * A body projects onto a SET OF CLAIMS. Two bodies contend over the
 * intersection. That is the whole algorithm, and it is one line. Everything
 * else is a table of extractors, each of exactly one shape -
 * `(ids) => Claim[]` - so a tenth source is a tenth row in `CLAIM_SOURCES` and
 * touches no other code. If a new kind of contention ever needs a branch in
 * `contentionBetween`, the shape has gone wrong and the fix is upstream.
 *
 * NOTHING HERE DECIDES ANYTHING. There is no score, no threshold at which a
 * contention becomes a feud, and no helper that ranks one claim above another.
 * A contention is the observation that two bodies have their hands on one
 * object; how warm they are about it is `Warmth`, it is a separate fact, and
 * the two are deliberately not combined into a number.
 */

import { SECTS, DAO_HOUSES, getSect, getDaoHouse } from './sects.js';
import {
    COURTS,
    FACTION_PARENTAGE,
    getApexInstitution,
    getCourt,
    idsForFaction
} from './governance-and-water-rights.js';
import { SHARED_EVENTS } from './faction-history.js';
import { getRegionForFaction } from './regions.js';

// ─────────────────────────────────────────────────────────────────────────
// THE SHAPE
// ─────────────────────────────────────────────────────────────────────────

/**
 * One thing a body has a hand on.
 *
 * `on` is the object's key and is the whole of the matching. Two bodies produce
 * the same key for the same object or they do not contend, so a key must be
 * derived from the object rather than from either holder - `founding:<event>`,
 * never `founding:<whoever-is-asking>`.
 */
export interface Claim {
    /** The object, keyed so that two bodies holding it agree by construction. */
    on: string;
    /** What the object is, in words. The detail surface prints this. */
    what: string;
    /** Which table it was read out of, so a reader can go and check. */
    from: string;
}

/**
 * Two bodies with their hands on one object.
 *
 * Symmetric by construction: it is computed from an intersection, so there is
 * no way to produce it from one side and not the other. That is the same
 * correctness argument `faction-relationships.ts` makes for storing a tie as a
 * pair, arrived at differently - here the symmetry is a property of the
 * operation rather than of the storage, which is stronger, because there is no
 * row for anybody to edit out of agreement with its twin.
 */
export interface Contention {
    on: string;
    what: string;
    from: string;
}

/**
 * One source of claims. Adding a source is adding a row, never a branch.
 *
 * Every extractor takes the full id set of a body - a body is filed under a
 * court id and a sect id about half the time - and returns what that body has
 * a hand on according to one table. An extractor that needed to know which
 * KIND of body it was looking at would be the beginning of the enumeration
 * this file exists to avoid; none of them does.
 */
interface ClaimSource {
    readonly from: string;
    claimsOf(ids: ReadonlySet<string>): Claim[];
}

// ─────────────────────────────────────────────────────────────────────────
// THE SOURCES
//
// Ordered by how specific the object is. A founding both bodies descend from
// is a sharper thing to be contending over than a patron they both happen to
// hold from, and the register prints them in this order for that reason.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The two things a shared event can be about that more than one body can hold.
 *
 * A lineage and a piece of ground. Every other value of `explains` accounts for
 * a figure that belongs to a single house, and two bodies who were both in the
 * room when one of them lost its pipeline are not contending over anything.
 *
 * WHAT THIS STILL GETS WRONG, WHICH IS A DATA GAP AND NOT A BUG HERE.
 * `parties` does not distinguish a body that CLAIMS the object from a body that
 * was merely involved. The reposting has four parties - the two halves of the
 * split, and the two apexes on either side of it - and only the two halves
 * claim the founding. So the Root Sill reads as contending with the Long Cut,
 * which is its own patron and which it is warm to.
 *
 * That reading is defensible rather than wrong: the authored tie says outright
 * that what the Long Cut acquired with those people was a claim on the sealed
 * thing behind the gate, so it does have a hand on the object. But it is
 * weaker than the contention between the two halves, and nothing in the data
 * says so.
 *
 * It is left as it is on purpose. The available fixes were both worse: keying
 * the distinction off whether a party is an apex is a branch on a kind of body,
 * which is the shape this file exists to avoid, and dropping a body's own
 * patron would delete real contentions elsewhere. The honest repair is upstream
 * - a shared event that names which of its parties are claimants - and that is
 * a change to `SharedEventSchema` and to sixteen event rows, which belongs to
 * whoever owns that catalog rather than to this reader of it.
 */
const EVENTS_ABOUT_AN_OBJECT: ReadonlySet<string> = new Set(['the claim', 'the holding']);

const nameOf = (id: string): string =>
    getSect(id)?.name
    ?? getCourt(id)?.name
    ?? getApexInstitution(id)?.name
    ?? getDaoHouse(id)?.name
    ?? id;

const CLAIM_SOURCES: readonly ClaimSource[] = [
    // ── the shared events, where the event was about an object ───────
    //
    // Being in the room together is not contending. `explains` is the catalog's
    // own statement of what sort of figure an event accounts for, and only two
    // of its eight values name a THING that more than one body can have a hand
    // on: a lineage ('the claim') and ground ('the holding'). The rest account
    // for a figure belonging to one house - the gap between its power and its
    // pipeline, its peak, its intake, its reputation - and two houses who were
    // both present when one of them peaked are not contending over anything.
    //
    // 'the rivalry' is excluded for a second reason as well as that one: a
    // rivalry is already carried symmetrically in `rivals` and already derives
    // a tie of its own, so counting it here would report one feud twice under
    // two names.
    //
    // This is a filter on the catalog's own field, not a branch on a kind of
    // relation. A ninth `explains` value needs no code here - it is either in
    // the set below or it is not, and that is a one-line data decision.
    {
        from: 'the shared events',
        claimsOf(ids) {
            const out: Claim[] = [];
            for (const event of SHARED_EVENTS) {
                if (!EVENTS_ABOUT_AN_OBJECT.has(event.explains)) continue;
                if (!event.parties.some(p => ids.has(p))) continue;
                out.push({
                    on: `event:${event.id}`,
                    what: `${event.what} Both bodies are parties to it and both carry an account, ${event.yearsAgo.toLocaleString()} years on. What it accounts for: ${event.explains}.`,
                    from: 'the shared events'
                });
            }
            return out;
        }
    },

    // ── the contested claims: the catalog already says so ────────────
    //
    // The one source where the catalog states the contention outright, on both
    // sides, and asserts the symmetry in its own tests. Keyed on the sorted
    // pair because the object is named in prose rather than given an id: two
    // houses contesting one thing produce one key and it is the same key from
    // either end.
    {
        from: 'the contested claims',
        claimsOf(ids) {
            const out: Claim[] = [];
            for (const sect of SECTS) {
                if (!ids.has(sect.id)) continue;
                const ambition = sect.ambition;
                if (!ambition) continue;
                for (const otherId of ambition.contestedWith) {
                    out.push({
                        on: `contested:${[sect.id, otherId].sort().join('|')}`,
                        what: `Both have a hand on the same thing, and the catalog records it from both sides. ${sect.name} wants: ${ambition.wants}`,
                        from: 'the contested claims'
                    });
                }
            }
            return out;
        }
    },

    // ── the same patron: two clients of one house ────────────────────
    //
    // Not a feud and frequently not even a coolness - the point is that a grant
    // is renewed by somebody with a finite amount of attention, and two bodies
    // holding from one house are asking the same person for the same thing on
    // the same schedule whether or not either has ever said so.
    {
        from: 'the grant table',
        claimsOf(ids) {
            const out: Claim[] = [];
            for (const id of ids) {
                const parent = FACTION_PARENTAGE[id]?.parentFactionId;
                if (!parent) continue;
                out.push({
                    on: `patron:${parent}`,
                    what: `Both hold from ${nameOf(parent)}, so both are asking one house for renewals, grants and attention out of the same finite supply.`,
                    from: 'the grant table'
                });
            }
            return out;
        }
    },

    // ── the same road: two houses teaching one art ───────────────────
    //
    // A house that teaches an art recruits the people who want it. Two houses
    // teaching the same one are drawing from one pool, which is competition in
    // the ordinary sense of the word and is nowhere recorded as such.
    {
        from: 'the teach lists',
        claimsOf(ids) {
            const out: Claim[] = [];
            for (const sect of SECTS) {
                if (!ids.has(sect.id)) continue;
                for (const techniqueId of sect.teaches) {
                    out.push({
                        on: `road:${techniqueId}`,
                        what: 'Both teach the same art, so both draw on the people who came looking for it.',
                        from: 'the teach lists'
                    });
                }
            }
            return out;
        }
    },

    // ── the same ground: two houses seated in one province ───────────
    //
    // The weakest of the sources and deliberately kept, because it is the one
    // that is true of almost everybody and therefore says something only in
    // combination with the others. A province is a finite amount of vein, of
    // applicant and of arbitration, and every house seated in one is drawing on
    // it. On its own it is not worth a reader's attention; alongside a founding
    // both bodies claim, it is the reason the claim matters.
    {
        from: 'the seating lists',
        claimsOf(ids) {
            const out: Claim[] = [];
            const seen = new Set<string>();
            for (const id of ids) {
                const region = getRegionForFaction(id);
                if (!region || seen.has(region.id)) continue;
                seen.add(region.id);
                out.push({
                    on: `ground:${region.id}`,
                    what: `Both are seated in ${region.name}, drawing on one province's vein, one pool of applicants and one set of benches.`,
                    from: 'the seating lists'
                });
            }
            return out;
        }
    }
];

// ─────────────────────────────────────────────────────────────────────────
// SCARCITY, WHICH IS WHAT MAKES A CLAIM A CONTENTION
//
// The first version of this file had no such notion and it produced 2,432
// contention rows over 37 bodies - about thirty contenders each, which is to
// say every house contending with every other house, which is to say nothing.
// 1,964 of those rows came from the teach lists. The cause is not a bug in the
// extractor: twenty-four of the world's houses teach the Lesser Qi-Gathering
// Manual, because it is the manual everybody teaches. Two houses both teaching
// the beginner's book are not competing for anybody. They are both in the
// world.
//
// So a claim contends only where it is SCARCE, and the world's own numbers say
// where that line falls. Holders per claim key, measured across all 37 distinct
// bodies:
//
//     1 holder : 58 keys        6 holders :  1 key
//     2 holders: 58 keys        8 holders :  5 keys
//     3 holders:  7 keys       10 holders :  1 key
//     4 holders:  5 keys       13 holders :  2 keys
//     5 holders:  3 keys       17 holders :  1 key
//                              24 holders :  2 keys
//
// That is bimodal with an empty region in it. One cluster runs from a single
// holder up to six and is what contention means - a founding two bodies both
// descend from, a patron four houses hold from, an art six teach. The other
// starts at eight and is the universal furniture of the world: the two starter
// manuals at 24 apiece, the home province at 17.
//
// The cut is stated as a share of the world rather than as a count, because the
// catalog grows and a hardcoded 7 would quietly stop meaning what it meant. And
// it is not a tuning knob: it lands in the gap between 6 and 8, so any fraction
// from about a seventh to a fifth of the world produces exactly the same
// partition. If a future catalog fills that gap in, this comment is the thing
// to re-measure, not the constant to widen. See AGENTS.md, "rarity is a
// population statement, not a price" - this is that rule applied to objects
// instead of to people.
// ─────────────────────────────────────────────────────────────────────────

/** Above this share of the world's bodies, a claim is common ground. */
const CONTESTED_SHARE = 1 / 5;

/** Every distinct body in the world, collapsed across the ids it is filed under. */
const ALL_BODIES: readonly string[] = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of [...SECTS.map(s => s.id), ...COURTS.map(c => c.id), ...DAO_HOUSES.map(h => h.id)]) {
        const key = idsForFaction(id).sort().join('|') || id;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(id);
    }
    return out;
})();

/**
 * How many bodies hold each claim, and therefore which claims say anything.
 *
 * Computed once over the whole world, which is the only scale at which the
 * question makes sense: whether an object is scarce is a fact about the object
 * and never about whoever is currently asking.
 */
// Built on first use rather than at module load. It reads every body's raw
// claims, so building it eagerly would run the extractors against a module that
// has not finished initialising - which it did, and which failed loudly.
let scarceClaims: ReadonlySet<string> | null = null;

function isScarce(on: string): boolean {
    if (!scarceClaims) {
        const holders = new Map<string, number>();
        for (const id of ALL_BODIES) {
            for (const claim of rawClaimsOf(id)) holders.set(claim.on, (holders.get(claim.on) ?? 0) + 1);
        }
        const ceiling = ALL_BODIES.length * CONTESTED_SHARE;
        const out = new Set<string>();
        for (const [key, n] of holders) if (n <= ceiling) out.add(key);
        scarceClaims = out;
    }
    return scarceClaims.has(on);
}

// ─────────────────────────────────────────────────────────────────────────
// THE ANSWER
// ─────────────────────────────────────────────────────────────────────────

const claimCache = new Map<string, readonly Claim[]>();

/**
 * Everything one body has a hand on, before scarcity is considered.
 *
 * Separate from `claimsOf` because the scarcity table is computed FROM this -
 * asking how many bodies hold a claim cannot itself depend on the answer.
 */
function rawClaimsOf(factionId: string): readonly Claim[] {
    const cached = claimCache.get(factionId);
    if (cached) return cached;

    const ids = new Set(idsForFaction(factionId));
    // A body filed under two ids must project onto ONE claim set, or it
    // contends with itself. `idsForFaction` is the same id-collapsing the
    // register and the relationship catalog already use, so all three agree.
    ids.add(factionId);

    const out: Claim[] = [];
    const seen = new Set<string>();
    for (const source of CLAIM_SOURCES) {
        for (const claim of source.claimsOf(ids)) {
            if (seen.has(claim.on)) continue;
            seen.add(claim.on);
            out.push(claim);
        }
    }
    claimCache.set(factionId, out);
    return out;
}

/**
 * Everything one body has a hand on that is scarce enough to contend over.
 *
 * The common ground is dropped rather than ranked low, because a list whose
 * first thirty entries are "we are both in the world" is not a list a reader
 * gets to the bottom of.
 */
export function claimsOf(factionId: string): readonly Claim[] {
    return rawClaimsOf(factionId).filter(c => isScarce(c.on));
}

/**
 * What two bodies are both reaching for. Empty is the common answer.
 *
 * The whole algorithm, and it is deliberately one intersection with no
 * weighting, no ordering by importance and no cutoff. A caller that wants only
 * the sharp ones filters on `from`; this function's job is to be complete and
 * checkable rather than opinionated.
 */
export function contentionBetween(aId: string, bId: string): Contention[] {
    // A body does not contend with itself, and this is not theoretical: a court
    // and the sect that IS that court are two ids for one body. Without this,
    // every such body would contend with itself over every claim it holds.
    const aIds = new Set([aId, ...idsForFaction(aId)]);
    if (idsForFaction(bId).some(id => aIds.has(id)) || aIds.has(bId)) return [];

    const theirs = new Map(claimsOf(bId).map(c => [c.on, c]));
    return claimsOf(aId)
        .filter(c => theirs.has(c.on))
        .map(c => ({ on: c.on, what: c.what, from: c.from }));
}

/**
 * Every body in the world that has a hand on something this one is holding.
 *
 * Used by the register to answer "who does it compete with" without the caller
 * having to know what the sources are. Sorted by how much the two have in
 * common, because a body sharing a founding and a province with somebody is a
 * sharper fact than a body sharing only a province with forty others.
 */
export function contendersWith(factionId: string): { otherId: string; otherName: string; over: Contention[] }[] {
    const everybody = [
        ...SECTS.map(s => s.id),
        ...COURTS.map(c => c.id),
        ...DAO_HOUSES.map(h => h.id)
    ];
    const seen = new Set<string>();
    const out: { otherId: string; otherName: string; over: Contention[] }[] = [];

    for (const otherId of everybody) {
        // One body, one row, whichever of its ids came up first.
        const key = idsForFaction(otherId).sort().join('|') || otherId;
        if (seen.has(key)) continue;
        seen.add(key);

        const over = contentionBetween(factionId, otherId);
        if (!over.length) continue;
        out.push({ otherId, otherName: nameOf(otherId), over });
    }

    return out.sort((x, y) => y.over.length - x.over.length || x.otherName.localeCompare(y.otherName));
}
