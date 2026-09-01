/**
 * The coherence rules for how factions stand with each other.
 *
 * The whole point of the module under test is that a relationship cannot be
 * half-recorded, so most of what is asserted here is symmetry: ask A about B
 * and ask B about A, and the two answers have to be the same tie seen from two
 * sides. Feeling may differ. Fact may not.
 */

import { describe, it, expect } from 'vitest';

import {
    FACTION_RELATIONSHIPS,
    FactionRelationshipSchema,
    relationshipsOf,
    relationshipBetween,
    allFactionRelationshipPairs
} from '../../src/data/cultivation/faction-relationships.js';
import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import {
    APEX_INSTITUTIONS,
    COURTS,
    FACTION_PARENTAGE,
    getApexInstitution,
    getCourt,
    idsForFaction
} from '../../src/data/cultivation/governance-and-water-rights.js';

/** Everything the register draws an entry or a panel for. */
const BODIES: readonly { id: string; name: string }[] = [
    ...SECTS.map(s => ({ id: s.id, name: s.name })),
    ...APEX_INSTITUTIONS.filter(a => a.factionId === null).map(a => ({ id: a.id, name: a.name })),
    ...COURTS.filter(c => c.embodiedByFactionId === null).map(c => ({ id: c.id, name: c.name }))
];

const resolves = (id: string): boolean =>
    getSect(id) !== undefined || getApexInstitution(id) !== undefined || getCourt(id) !== undefined;

const relsFor = (id: string) => relationshipsOf(id, idsForFaction(id));

describe('faction relationships - the authored catalog', () => {
    it('every authored pair satisfies the schema', () => {
        for (const rel of FACTION_RELATIONSHIPS) {
            expect(() => FactionRelationshipSchema.parse(rel), rel.id).not.toThrow();
        }
    });

    it('every authored id is a body that exists somewhere in the catalog', () => {
        for (const rel of FACTION_RELATIONSHIPS) {
            expect(resolves(rel.aId), `${rel.id}: aId ${rel.aId}`).toBe(true);
            expect(resolves(rel.bId), `${rel.id}: bId ${rel.bId}`).toBe(true);
        }
    });

    it('no body is in a relationship with itself, under any of its ids', () => {
        for (const rel of FACTION_RELATIONSHIPS) {
            const aliases = idsForFaction(rel.aId);
            expect(aliases.includes(rel.bId), `${rel.id} pairs one body with itself`).toBe(false);
        }
    });

    it('authored ids are unique', () => {
        const ids = FACTION_RELATIONSHIPS.map(r => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('faction relationships - one tie, two sides', () => {
    it('a pair appears exactly once in the world, however many tables imply it', () => {
        const keys = allFactionRelationshipPairs()
            .map(p => [p.aId, p.bId].sort().join('::'));
        expect(new Set(keys).size, 'a tie is recorded twice').toBe(keys.length);
    });

    /**
     * The rule the module exists for. Asymmetry of feeling is wanted; asymmetry
     * of fact is a bug, and this is what would catch one if the pair type were
     * ever loosened into two mirrored records.
     */
    it('both sides agree on the facts and mirror the direction', () => {
        for (const pair of allFactionRelationshipPairs()) {
            const mine = relationshipBetween(pair.aId, pair.bId);
            const theirs = relationshipBetween(pair.bId, pair.aId);
            expect(mine, `${pair.id}: A has no row for B`).toBeDefined();
            expect(theirs, `${pair.id}: B has no row for A`).toBeDefined();
            if (!mine || !theirs) continue;

            expect(mine.id, pair.id).toBe(theirs.id);
            expect(mine.kind, pair.id).toBe(theirs.kind);
            expect(mine.what, pair.id).toBe(theirs.what);
            expect(mine.since, pair.id).toBe(theirs.since);
            expect(mine.source, pair.id).toBe(theirs.source);

            const inverse = { above: 'below', below: 'above', alongside: 'alongside' } as const;
            expect(inverse[mine.stance], `${pair.id}: stances do not mirror`).toBe(theirs.stance);

            // Each side's own word is the other side's report of it, so an
            // entry can print an asymmetry without a reader opening the other.
            expect(mine.warmth, pair.id).toBe(theirs.theirWarmth);
            expect(theirs.warmth, pair.id).toBe(mine.theirWarmth);
        }
    });

    it('a resolved row never names the body it is printed on', () => {
        for (const body of BODIES) {
            const aliases = idsForFaction(body.id);
            for (const rel of relsFor(body.id)) {
                expect(aliases.includes(rel.otherId), `${body.id} relates to itself`).toBe(false);
            }
        }
    });

    it('no body is listed twice on one entry under two of its ids', () => {
        for (const body of BODIES) {
            const others = relsFor(body.id).map(r => idsForFaction(r.otherId).join('/'));
            expect(new Set(others).size, `${body.name} lists one body twice`).toBe(others.length);
        }
    });
});

describe('faction relationships - coverage', () => {
    it('every body in the world stands in at least one', () => {
        const bare = BODIES.filter(b => relsFor(b.id).length === 0).map(b => b.name);
        expect(bare, 'these bodies have no relationships at all').toEqual([]);
    });

    it('every grant in the parentage table produces a tie in both directions', () => {
        for (const p of Object.values(FACTION_PARENTAGE)) {
            if (!p.parentFactionId) continue;
            const up = relationshipBetween(p.factionId, p.parentFactionId);
            expect(up, `${p.factionId} does not record its patron`).toBeDefined();
            expect(up?.stance, `${p.factionId}: its patron is not above it`).toBe('above');
            const down = relationshipBetween(p.parentFactionId, p.factionId);
            expect(down?.stance, `${p.parentFactionId}: its client is not under it`).toBe('below');
        }
    });

    it('every rivalry produces a tie, and rivalries are symmetric to begin with', () => {
        for (const sect of SECTS) {
            for (const rivalId of sect.rivals) {
                expect(getSect(rivalId)?.rivals.includes(sect.id),
                    `${sect.name} claims a feud ${rivalId} does not carry`).toBe(true);
                const tie = relationshipBetween(sect.id, rivalId);
                expect(tie, `${sect.name} vs ${rivalId} produced no tie`).toBeDefined();
            }
        }
    });

    it('every court is under its apex and the apex is over it', () => {
        for (const court of COURTS) {
            const up = relationshipBetween(court.id, court.apexId);
            expect(up, `${court.name} does not record the apex that posted it`).toBeDefined();
            expect(up?.stance, court.name).toBe('above');
        }
    });
});

describe('faction relationships - the two bodies nobody joins', () => {
    const ROOT_SILL = 'sect-kiln-wardens';
    const KILN = 'court-kiln';

    it('the Root Sill Court and the Kiln Court are related to each other at all', () => {
        const tie = relationshipBetween(ROOT_SILL, KILN);
        expect(tie, 'the pair the whole section was asked for is missing').toBeDefined();
        expect(tie?.stance).toBe('alongside');
        expect(tie?.kind).toBe('two_bodies_nobody_joins');
        expect(tie?.source).toBe('authored');
    });

    it('the two of them feel differently about the same tie', () => {
        const ours = relationshipBetween(ROOT_SILL, KILN);
        const theirs = relationshipBetween(KILN, ROOT_SILL);
        expect(ours?.warmth).not.toBe(theirs?.warmth);
        // One carries a named grievance and the other does not, which is the
        // whole asymmetry: the half that walked has a complaint with a cause
        // and a date, and the half that stayed has nothing to complain about.
        expect(ours?.grievance).not.toBeNull();
        expect(theirs?.grievance).toBeNull();
    });

    it('the pair are the only two bodies in the catalog with a posting', () => {
        const postings = [
            ...COURTS.filter(c => c.posting).map(c => c.id),
            ...Object.values(FACTION_PARENTAGE).filter(p => p.posting).map(p => p.factionId)
        ].sort();
        expect(postings).toEqual([KILN, ROOT_SILL].sort());
    });

    it('the Root Sill answers one apex and is severed from the other, and both agree', () => {
        const long = relationshipBetween(ROOT_SILL, 'apex-long-cut');
        expect(long?.stance).toBe('above');
        expect(long?.kind).toBe('apex_and_posting');
        // Warm upward against a patron that is only civil back, which is the
        // shape the section exists to make visible.
        expect(long?.warmth).toBe('warm');
        expect(long?.theirWarmth).toBe('civil');

        const survey = relationshipBetween(ROOT_SILL, 'apex-deep-survey');
        expect(survey?.kind).toBe('severed_patronage');
        expect(survey?.grievance).not.toBeNull();
    });

    it('the current patron in the tie is the one the parentage table names', () => {
        expect(FACTION_PARENTAGE[ROOT_SILL]?.parentFactionId).toBe('apex-long-cut');
        const above = relsFor(ROOT_SILL).filter(r => r.stance === 'above').map(r => r.otherId);
        expect(above).toContain('apex-long-cut');
        expect(above).toContain('apex-deep-survey');
    });
});

describe('faction relationships - upward and downward warmth', () => {
    it('the register can show a body warm one way and cold the other', () => {
        // Not a hypothetical shape: assert that the catalog actually contains a
        // body whose warmth differs across two of its own ties, because a
        // section built to show asymmetry and containing none would be a
        // section nobody needs.
        const asymmetric = BODIES.filter(b => {
            const words = new Set(relsFor(b.id).map(r => r.warmth));
            return words.size > 1;
        });
        expect(asymmetric.length).toBeGreaterThan(0);
    });

    it('at least one tie has the two sides feeling differently', () => {
        const mismatched = allFactionRelationshipPairs().filter(p => {
            const tie = relationshipBetween(p.aId, p.bId);
            return tie !== undefined && tie.warmth !== tie.theirWarmth;
        });
        expect(mismatched.length).toBeGreaterThan(0);
    });

    it('every body with something under it says how it treats them', () => {
        for (const body of BODIES) {
            for (const rel of relsFor(body.id).filter(r => r.stance === 'below')) {
                expect(rel.warmth, `${body.name} -> ${rel.otherName}`).toBeTruthy();
                expect(rel.andSoTheyDo.length, `${body.name} -> ${rel.otherName}`).toBeGreaterThan(0);
            }
        }
    });
});
