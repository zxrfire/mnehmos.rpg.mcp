/**
 * What two houses both have a hand on, and therefore what they are contending over
 * whether or not anybody wrote it down.
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
 */
export interface Contention {
    on: string;
    what: string;
    from: string;
}

/**
 * One source of claims. Adding a source is adding a row, never a branch.
 */
interface ClaimSource {
    readonly from: string;
    claimsOf(ids: ReadonlySet<string>): Claim[];
}

// THE SOURCES

/**
 * The two things a shared event can be about that more than one body can hold.
 */
const EVENTS_ABOUT_AN_OBJECT: ReadonlySet<string> = new Set(['the claim', 'the holding']);

const nameOf = (id: string): string =>
    getSect(id)?.name
    ?? getCourt(id)?.name
    ?? getApexInstitution(id)?.name
    ?? getDaoHouse(id)?.name
    ?? id;

const CLAIM_SOURCES: readonly ClaimSource[] = [
    // the shared events, where the event was about an object
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

    // the contested claims: the catalog already says so
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

    // the same ground: two houses seated in one province
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

// SCARCITY, WHICH IS WHAT MAKES A CLAIM A CONTENTION

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
 */
export function claimsOf(factionId: string): readonly Claim[] {
    return rawClaimsOf(factionId).filter(c => isScarce(c.on));
}

/**
 * What two bodies are both reaching for. Empty is the common answer.
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
