/**
 * Cross-catalog consistency, as a rule rather than as a habit.
 *
 * `scripts/audit-lore.ts` walks every catalog and reports where they disagree.
 * Most of what it finds is judgement - an orphaned art may be deliberate, a
 * house may hold somebody stronger than it ever produced because it recruits.
 * This file holds the part that is never judgement: an id that resolves to
 * nothing, or two catalogs stating different numbers for the same fact.
 *
 * Both classes were at zero when this was written, and both had been non-zero
 * within the hour. The Azure Cloud Pavilion existed under two ids with nothing
 * joining them, so a query against one could not see what the other owned; the
 * artifact catalog carried three owner ids that resolved to no faction at all.
 * Neither was caught by any suite, because every suite tested one catalog.
 */

import { describe, it, expect } from 'vitest';

import { SECTS, SECT_ANCESTRY, sectThreat, intakeRouteOf } from '../../src/data/cultivation/sects.js';
import {
    APEX_INSTITUTIONS, COURTS, FACTION_PARENTAGE, idsForFaction
} from '../../src/data/cultivation/hierarchy.js';
import { ARTIFACTS } from '../../src/data/cultivation/artifacts.js';
import { MEMBERS } from '../../src/data/cultivation/members.js';
import { TECHNIQUES } from '../../src/data/cultivation/techniques.js';
import { FACTION_CHARACTER, HIGH_REALM_PROVENANCE } from '../../src/data/cultivation/faction-character.js';

const factionIds = new Set<string>([
    ...SECTS.map(s => s.id),
    ...APEX_INSTITUTIONS.map(a => a.id),
    ...COURTS.map(c => c.id)
]);
const techniqueIds = new Set(TECHNIQUES.map(t => t.id));

/** True where an id names a real house, under either of the ids it may have. */
function resolves(id: string): boolean {
    return factionIds.has(id) || idsForFaction(id).some(x => factionIds.has(x));
}

describe('every id points at something', () => {
    it('gives every artifact an owner that exists', () => {
        for (const a of ARTIFACTS) {
            if (a.ownerId === null) continue;
            expect(resolves(a.ownerId), `${a.name} is owned by ${a.ownerId}`).toBe(true);
        }
    });

    it('puts every person in a faction that exists', () => {
        for (const m of MEMBERS) {
            expect(resolves(m.factionId), `${m.name} serves ${m.factionId}`).toBe(true);
        }
    });

    it('keeps the parentage table pointing at real houses in both directions', () => {
        for (const [id, entry] of Object.entries(FACTION_PARENTAGE)) {
            expect(resolves(id), `parentage keyed by unknown ${id}`).toBe(true);
            const parent = entry.parentFactionId;
            if (parent === null || parent === undefined) continue;
            const known = resolves(parent) || COURTS.some(c => c.id === parent);
            expect(known, `${id} answers to unknown ${parent}`).toBe(true);
        }
    });

    it('keys the side catalogs by houses that exist', () => {
        for (const id of Object.keys(SECT_ANCESTRY)) {
            expect(resolves(id), `ancestry for unknown ${id}`).toBe(true);
        }
        for (const id of Object.keys(FACTION_CHARACTER)) {
            expect(resolves(id), `character for unknown ${id}`).toBe(true);
        }
        for (const id of Object.keys(HIGH_REALM_PROVENANCE)) {
            expect(resolves(id), `provenance for unknown ${id}`).toBe(true);
        }
    });

    it('teaches only arts that exist, and names rivals that exist', () => {
        for (const s of SECTS) {
            for (const t of s.teaches) {
                expect(techniqueIds.has(t), `${s.name} teaches unknown ${t}`).toBe(true);
            }
            if (s.signatureTechniqueId) {
                expect(techniqueIds.has(s.signatureTechniqueId), `${s.name} signature`).toBe(true);
            }
            for (const r of s.rivals ?? []) {
                expect(resolves(r), `${s.name} names unknown rival ${r}`).toBe(true);
            }
        }
    });

    it('puts every apex object in the artifact catalog', () => {
        for (const apex of APEX_INSTITUTIONS) {
            const sentDown = (apex as { sentDown?: { id: string; name: string } }).sentDown;
            if (!sentDown) continue;
            const object = ARTIFACTS.find(a => a.id === sentDown.id);
            expect(object, `${apex.name}: ${sentDown.id} is not in ARTIFACTS`).toBeDefined();
        }
    });
});

describe('two catalogs never state the same fact differently', () => {
    it('never puts a member above the house they serve', () => {
        for (const s of SECTS) {
            const strongest = MEMBERS
                .filter(m => m.factionId === s.id && typeof m.realmOrdinal === 'number')
                .reduce((best, m) => Math.max(best, m.realmOrdinal as number), -1);
            if (strongest < 0) continue;
            expect(strongest, `${s.name} stands at ${s.powerOrdinal} and holds a ${strongest}`)
                .toBeLessThanOrEqual(s.powerOrdinal);
        }
    });

    it('agrees with itself about what a house can put on the ground today', () => {
        for (const s of SECTS) {
            const threat = sectThreat(s.id);
            if (!threat) continue;
            // `acting` is the public figure and must be the sect's own. What is
            // asleep belongs to `ceiling`, and a sealed ancestor may be level
            // with or below the house holding it - which is legal, and was
            // being asserted as impossible until the Azure Cloud Pavilion's
            // protector turned out to be exactly that.
            expect(threat.acting, `${s.name}`).toBe(s.powerOrdinal);
            expect(threat.ceiling, `${s.name} ceiling`).toBeGreaterThanOrEqual(threat.acting);
        }
    });

    it('never records a house as having topped out below where it stands', () => {
        for (const s of SECTS) {
            const provenance = HIGH_REALM_PROVENANCE[s.id];
            if (!provenance) continue;
            expect(provenance.highestOrdinal, `${s.name}`).toBeGreaterThanOrEqual(s.powerOrdinal);
        }
    });

    it('only lets a house hold somebody it never produced if it can recruit', () => {
        for (const s of SECTS) {
            const peak = FACTION_CHARACTER[s.id]?.production?.peakOrdinal;
            if (typeof peak !== 'number' || peak >= s.powerOrdinal) continue;
            expect(
                intakeRouteOf(s.id),
                `${s.name} stands at ${s.powerOrdinal}, produced at most ${peak}, and cannot take anybody in`
            ).toBe('open');
        }
    });

    it('has the pyramid agree with itself about who answers to whom', () => {
        for (const apex of APEX_INSTITUTIONS) {
            for (const courtId of apex.courtIds) {
                const court = COURTS.find(c => c.id === courtId);
                expect(court, `${apex.name} lists unknown court ${courtId}`).toBeDefined();
                expect(court!.apexId, `${court!.name} is listed by ${apex.name}`).toBe(apex.id);
            }
        }
        for (const court of COURTS) {
            const apex = APEX_INSTITUTIONS.find(a => a.id === court.apexId);
            expect(apex, `${court.name} serves unknown ${court.apexId}`).toBeDefined();
            expect(apex!.courtIds, `${apex!.name} does not list ${court.name}`).toContain(court.id);
        }
    });

    it('keeps every court under the apex it answers to', () => {
        for (const court of COURTS) {
            const apex = APEX_INSTITUTIONS.find(a => a.id === court.apexId)!;
            expect(court.powerOrdinal, `${court.name} against ${apex.name}`)
                .toBeLessThan(apex.powerOrdinal);
        }
    });

    it('resolves one house to the same holdings under either of its ids', () => {
        // The Azure Cloud Pavilion has a row in SECTS and a row in
        // APEX_INSTITUTIONS. Anything keyed by faction must find the same
        // things whichever id it was handed, or the house silently owns
        // nothing from one direction.
        for (const apex of APEX_INSTITUTIONS) {
            if (apex.factionId === null) continue;
            expect(idsForFaction(apex.factionId)).toContain(apex.id);
            expect(idsForFaction(apex.id)).toContain(apex.factionId);
            expect(factionIds.has(apex.factionId), `${apex.name} has no sect row`).toBe(true);
        }
    });
});
