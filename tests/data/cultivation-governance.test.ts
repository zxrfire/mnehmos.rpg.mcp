/**
 * Governance validation: the pyramid, the four models, the feeder, arrival at
 * the bottom, and the guest-elder relationship.
 *
 * The load-bearing assertions here are the ones a tool could otherwise get
 * wrong quietly:
 *
 *   - nothing carries across an upward move, and `arrivalStateFor` returns
 *     zeroes rather than the cultivator's existing standing
 *   - apex rank ladders are not ordinal-derived, and are marked as such
 *   - a starting cultivator is `unaware` of every apex, so nothing above the
 *     map may be named in narration to them
 *   - every unbacked sect has ONE specific reason it still exists
 */

import { describe, it, expect } from 'vitest';

import { SECTS, getSect } from '../../src/data/cultivation/sects.js';
import { REGIONS, getRegion } from '../../src/data/cultivation/regions.js';
import {
    APEX_INSTITUTIONS,
    ApexInstitutionSchema,
    COURTS,
    CourtSchema,
    FACTION_PARENTAGE,
    ParentageSchema,
    GUEST_ELDERS,
    GuestElderSchema,
    FEEDER,
    ARRIVAL_RULES,
    DIRECT_RULE,
    DEFERENCE_HOLDINGS,
    BORDER_KINDS,
    REGION_GOVERNANCE,
    UNBACKED_PLAYER_TRADE,
    getApexInstitution,
    getCourt,
    getParentage,
    getSubsidiariesOf,
    chainToApex,
    tierOf,
    getGuestElders,
    mayBeNamed,
    unattributedEffectsOf,
    arrivalStateFor
} from '../../src/data/cultivation/hierarchy.js';

describe('the pyramid', () => {
    it('places every faction in the catalog somewhere in the stack', () => {
        for (const s of SECTS) {
            const p = getParentage(s.id);
            expect(p, `${s.id} has no governance record`).toBeDefined();
            expect(p!.factionId).toBe(s.id);
            expect(p!.holds.length).toBeGreaterThan(40);
            expect(p!.note.length).toBeGreaterThan(40);
        }
        for (const id of Object.keys(FACTION_PARENTAGE)) {
            expect(getSect(id), `governance record for unknown faction ${id}`).toBeDefined();
        }
        for (const p of Object.values(FACTION_PARENTAGE)) {
            expect(() => ParentageSchema.parse(p), p.factionId).not.toThrow();
        }
    });

    it('resolves every parent to a faction, a court or an apex', () => {
        for (const p of Object.values(FACTION_PARENTAGE)) {
            if (p.parentFactionId === null) continue;
            const resolved = getSect(p.parentFactionId)
                ?? getCourt(p.parentFactionId)
                ?? getApexInstitution(p.parentFactionId);
            expect(resolved, `${p.factionId} holds from unknown ${p.parentFactionId}`).toBeDefined();
            expect(p.parentFactionId, `${p.factionId} holds from itself`).not.toBe(p.factionId);
        }
    });

    it('stacks: a subsidiary of a subsidiary reaches an apex by walking up', () => {
        const chain = chainToApex('sect-gleaners-company');
        expect(chain[0]).toBe('sect-gleaners-company');
        expect(chain).toContain('sect-weir-office');
        expect(chain).toContain('court-ninth-face');
        expect(chain[chain.length - 1]).toBe('apex-long-cut');
        expect(tierOf('sect-gleaners-company')).toBeGreaterThanOrEqual(3);

        // A vein-holder is nearer the top than its own sub-holder.
        expect(tierOf('sect-verdant-spring-hall'))
            .toBeGreaterThan(tierOf('sect-nine-peaks-ascetic-order'));
        // And an unbacked league has nowhere to walk.
        expect(chainToApex('sect-hollow-bell-wanderers')).toEqual(['sect-hollow-bell-wanderers']);
    });

    it('prices the lease: what it costs and what it buys', () => {
        const leased = Object.values(FACTION_PARENTAGE).filter(p => p.terms !== null);
        expect(leased.length, 'nobody holds anything on terms').toBeGreaterThanOrEqual(8);
        for (const p of leased) {
            const t = p.terms!;
            expect(t.buys.length, `${p.factionId} pays for nothing`).toBeGreaterThanOrEqual(2);
            expect(t.renewal.length, `${p.factionId} renewal`).toBeGreaterThan(60);
            expect(t.tributeStonesPerYear + t.inKind.length + t.disciplesPerCycle,
                `${p.factionId} lease costs nothing at all`).toBeGreaterThan(0);
        }
        // The Sill's subsidiaries owe disciples upward: the feeder made contractual.
        const owingDisciples = leased.filter(p => p.terms!.disciplesPerCycle > 0);
        expect(owingDisciples.length).toBeGreaterThanOrEqual(4);
    });

    it('keeps the apex above the map and out of the sect catalog', () => {
        for (const a of APEX_INSTITUTIONS) {
            expect(getSect(a.id), `${a.id} must not be a joinable sect`).toBeUndefined();
        }
        for (const c of COURTS) {
            expect(getSect(c.id), `${c.id} must not be a joinable sect`).toBeUndefined();
            // A court may be embodied by a faction that IS in the catalog.
            if (c.embodiedByFactionId) {
                expect(getSect(c.embodiedByFactionId)).toBeDefined();
            }
        }
        // Two provinces stay two provinces.
        expect(REGIONS.length).toBe(2);
    });
});

describe('the four governance models', () => {
    it('marks every faction with exactly one model, and all four are used', () => {
        const models = new Set(Object.values(FACTION_PARENTAGE).map(p => p.governance));
        for (const model of ['federated', 'administered', 'deference', 'unbacked'] as const) {
            expect(models.has(model), `no faction uses the ${model} model`).toBe(true);
        }
    });

    it('runs the two provinces on different models, visible at the border', () => {
        expect(REGION_GOVERNANCE['region-low-fall'].model).toBe('federated');
        expect(REGION_GOVERNANCE['region-quiet-marches'].model).toBe('administered');
        for (const g of Object.values(REGION_GOVERNANCE)) {
            expect(g.fromBelow.length).toBeGreaterThan(80);
            expect(g.joining.length).toBeGreaterThan(60);
        }
        expect(REGION_GOVERNANCE['region-low-fall'].joining)
            .not.toBe(REGION_GOVERNANCE['region-quiet-marches'].joining);
        // Joining one means joining a sect; joining the other means processing.
        expect(REGION_GOVERNANCE['region-quiet-marches'].joining).toMatch(/process/i);

        // Every faction seated in a region uses a model consistent with it:
        // the Marches has no federated leases anywhere.
        const marches = getRegion('region-quiet-marches')!;
        for (const id of marches.factionIds) {
            expect(getParentage(id)!.governance, `${id} is leased inside a directly ruled province`)
                .not.toBe('federated');
        }
    });

    it('makes direct rule do all the work and recruit for itself', () => {
        expect(DIRECT_RULE.apexId).toBe('apex-long-cut');
        expect(DIRECT_RULE.intakeModel).toBe('tests everyone');
        expect(DIRECT_RULE.intake).toMatch(/register|clerk|tested/i);
        expect(DIRECT_RULE.staffing.length).toBeGreaterThan(80);
        expect(DIRECT_RULE.brittleness.length).toBeGreaterThan(80);
        expect(DIRECT_RULE.legalism.length).toBeGreaterThan(100);
        // No client sects: nothing in the Marches holds a lease from the apex.
        const marchesLeases = Object.values(FACTION_PARENTAGE)
            .filter(p => p.governance === 'administered' && p.relation === 'subsidiary');
        expect(marchesLeases.length, 'a direct ruler has no subsidiaries').toBe(0);
        // The local hegemon is staff, not a vassal.
        expect(getParentage('sect-weir-office')!.relation).toBe('administration');
        expect(getParentage('sect-gleaners-company')!.relation).toBe('contracted');
    });

    it('holds a deference zone on a belief that decays', () => {
        expect(DEFERENCE_HOLDINGS.length).toBeGreaterThanOrEqual(1);
        for (const d of DEFERENCE_HOLDINGS) {
            const sect = getSect(d.factionId)!;
            expect(sect, `${d.factionId} is not in the catalog`).toBeDefined();
            expect(sect.alignment, 'deference suits a sect people are glad to have nearby')
                .toBe('righteous');
            expect(getParentage(d.factionId)!.governance).toBe('deference');
            // Small, selective, and it cannot grow without changing kind.
            expect(d.disciples).toBeLessThanOrEqual(8);
            expect(d.selectivityIsLoadBearing.length).toBeGreaterThan(100);
            expect(d.cannotGrow.length).toBeGreaterThan(100);
            // The core is walkable; the zone is not, and is contested.
            expect(d.administeredCore.length).toBeGreaterThan(60);
            expect(d.zoneIsContested.length).toBeGreaterThan(100);
            // Last tested, what happened, and what non-response would cost.
            expect(d.lastTestedYearsAgo).toBeGreaterThan(0);
            expect(d.whatHappened.length).toBeGreaterThan(150);
            expect(d.responseTimeDays).toBeLessThan(30);
            expect(d.ifTheyDoNotAnswer).toMatch(/evaporat|everywhere|season/i);
        }
    });

    it('gives every unbacked sect one specific reason it still exists', () => {
        const unbacked = Object.values(FACTION_PARENTAGE).filter(p => p.governance === 'unbacked');
        expect(unbacked.length).toBeGreaterThanOrEqual(5);
        for (const p of unbacked) {
            expect(p.unbackedReason, `${p.factionId} survives by general resilience`).not.toBeNull();
            expect(p.independenceStance, `${p.factionId} has no stance on it`).not.toBeNull();
            expect(p.costOfIndependence, `${p.factionId} pays nothing for independence`).not.toBeNull();
            expect(p.costOfIndependence!.length).toBeGreaterThan(80);
            expect(p.parentFactionId).toBeNull();
            expect(p.terms).toBeNull();
        }
        // Independence is a real value and a real vanity: both stances exist.
        const stances = new Set(unbacked.map(p => p.independenceStance));
        expect(stances.has('proud')).toBe(true);
        expect(stances.has('would_take_a_backer')).toBe(true);
        // And the reasons are varied rather than one excuse repeated.
        expect(new Set(unbacked.map(p => p.unbackedReason)).size).toBeGreaterThanOrEqual(4);
    });

    it('states the three borders as different kinds of thing', () => {
        expect(BORDER_KINDS.federated).toMatch(/lease|document/i);
        expect(BORDER_KINDS.administered).toMatch(/patrol/i);
        expect(BORDER_KINDS.deference).toMatch(/willing to find out/i);
        for (const b of Object.values(BORDER_KINDS)) expect(b.length).toBeGreaterThan(80);
    });

    it('presents the unbacked trade honestly in both directions', () => {
        expect(UNBACKED_PLAYER_TRADE.upside.length).toBeGreaterThanOrEqual(3);
        expect(UNBACKED_PLAYER_TRADE.downside.length).toBeGreaterThanOrEqual(4);
        expect(UNBACKED_PLAYER_TRADE.trap).toMatch(/ceiling|nowhere to send/i);
    });
});

describe('above the map', () => {
    it('has apex institutions a starting cultivator does not know exist', () => {
        expect(APEX_INSTITUTIONS.length).toBeGreaterThanOrEqual(1);
        expect(APEX_INSTITUTIONS.length).toBeLessThanOrEqual(2);
        for (const a of APEX_INSTITUTIONS) {
            expect(() => ApexInstitutionSchema.parse(a), a.id).not.toThrow();
            expect(a.startingAwareness).toBe('unaware');
            expect(mayBeNamed(a.startingAwareness), `${a.id} may not be named to a beginner`).toBe(false);
            expect(a.awarenessSources.length, `${a.id} is unlearnable`).toBeGreaterThanOrEqual(3);
            // It can act on a player who cannot name it.
            expect(a.actsWithoutAttribution.length).toBeGreaterThanOrEqual(3);
            expect(unattributedEffectsOf(a.id).length).toBe(a.actsWithoutAttribution.length);
        }
        for (const c of COURTS) {
            expect(() => CourtSchema.parse(c), c.id).not.toThrow();
            expect(getApexInstitution(c.apexId), `${c.id} serves unknown apex`).toBeDefined();
            expect(mayBeNamed(c.startingAwareness)).toBe(false);
        }
        // Whisper is still not enough to speak a name.
        expect(mayBeNamed('whisper')).toBe(false);
        expect(mayBeNamed('named')).toBe(true);
    });

    it('ranks by service rather than by realm at the top', () => {
        for (const a of APEX_INSTITUTIONS) {
            expect(a.rankIsOrdinalDerived, `${a.id} ranks by cultivation`).toBe(false);
            expect(a.ranks.length).toBeGreaterThanOrEqual(4);
            expect(a.rankNote.length).toBeGreaterThan(120);
            for (const r of a.ranks) {
                expect(r.decidedBy.length).toBeGreaterThan(30);
                // Nothing may be decided by the ordinal.
                expect(r.decidedBy).not.toMatch(/realm|ordinal|cultivation base/i);
            }
            // Rank and realm only reconverge high up, and it is recorded where.
            expect(a.ranksByRealmAboveOrdinal).toBeGreaterThanOrEqual(21);
        }
        // Stated plainly: a stronger cultivator can be junior to a weaker one.
        expect(getApexInstitution('apex-deep-survey')!.rankNote)
            .toMatch(/Core Formation .*Foundation Establishment/i);
    });

    it('recontextualises a faction the player already knows', () => {
        const rootSill = getCourt('court-root-sill')!;
        expect(rootSill.embodiedByFactionId).toBe('sect-kiln-wardens');
        expect(getParentage('sect-kiln-wardens')!.relation).toBe('court');
        // The Wardens' oddities in the sect catalog are what the reveal explains.
        expect(getSect('sect-kiln-wardens')!.recruits).toBe(false);
    });
});

describe('the feeder and arrival', () => {
    it('selects a very few upward, by several routes', () => {
        expect(FEEDER.intakeSize).toBeLessThanOrEqual(12);
        expect(FEEDER.selectionRoutes.length).toBeGreaterThanOrEqual(3);
        const total = FEEDER.selectionRoutes.reduce((sum, r) => sum + r.share, 0);
        expect(total, 'the routes should account for the whole intake').toBe(FEEDER.intakeSize);
        const routes = FEEDER.selectionRoutes.map(r => r.route);
        expect(routes.some(r => /competition/i.test(r))).toBe(true);
        expect(routes.some(r => /recommend/i.test(r))).toBe(true);
        expect(routes.some(r => /purchase/i.test(r))).toBe(true);
        // The exposure event: a competition is where a mis-sorted cultivator
        // first sees their own Dao practised properly.
        expect(FEEDER.exposureNote.length).toBeGreaterThan(150);
        expect(FEEDER.whatHappensToTheRest.length).toBeGreaterThan(80);
    });

    it('carries nothing across, and the data cannot be made to', () => {
        expect(ARRIVAL_RULES.carriesOver).toEqual([]);
        expect(ARRIVAL_RULES.entryRankIndex).toBe(0);
        expect(ARRIVAL_RULES.doesNotCarry.length).toBeGreaterThanOrEqual(5);
        for (const line of ARRIVAL_RULES.doesNotCarry) expect(line.length).toBeGreaterThan(40);

        const arrival = arrivalStateFor('sect-azure-cloud-pavilion', 'apex-deep-survey');
        expect(arrival.rankIndex).toBe(0);
        expect(arrival.rankTitle).toBe('Unplaced');
        expect(arrival.contributionCarried).toBe(0);
        expect(arrival.reputationCarried).toBe(0);
        expect(arrival.seniorityCarried).toBe(0);
        expect(arrival.titlesRecognised).toEqual([]);

        // The same, from anywhere, including the most prestigious sect there is.
        for (const from of ['sect-hollow-bell-wanderers', 'sect-nine-peaks-ascetic-order', 'sect-standing-grove']) {
            const a = arrivalStateFor(from, 'apex-deep-survey');
            expect(a.rankIndex).toBe(0);
            expect(a.contributionCarried).toBe(0);
        }
    });

    it('does not soften it anywhere in the flavour text', () => {
        expect(ARRIVAL_RULES.firstMonth).toMatch(/demotion|nobody/i);
        expect(ARRIVAL_RULES.unapologetic).toMatch(/harsh|softens|confusion/i);
        expect(ARRIVAL_RULES.whatDoesTravel).toMatch(/realm|understand/i);
    });
});

describe('guest elders', () => {
    it('are affiliated without belonging, and it is transactional both ways', () => {
        expect(GUEST_ELDERS.length).toBeGreaterThanOrEqual(2);
        expect(GUEST_ELDERS.length).toBeLessThanOrEqual(4);
        for (const g of GUEST_ELDERS) {
            expect(() => GuestElderSchema.parse(g), g.id).not.toThrow();
            expect(getSect(g.hostFactionId), `${g.id} hosted by unknown faction`).toBeDefined();
            expect(g.provides.length).toBeGreaterThan(60);
            expect(g.receives.length).toBeGreaterThan(60);
            // Both sides nervous, and neither can formally object to a walkout.
            expect(g.hostRisk.length).toBeGreaterThan(60);
            expect(g.guestRisk.length).toBeGreaterThan(60);
            expect(g.leaveClause.length).toBeGreaterThan(80);
            expect(g.leaveClause).toMatch(/no oath|nothing|no arrangement|not renew/i);
            // A guest is not a member: they hold no rank in the host.
            const host = getSect(g.hostFactionId)!;
            expect(host.ranks).not.toContain(g.name);
        }
        expect(getGuestElders('sect-azure-cloud-pavilion').length).toBeGreaterThan(0);
        expect(getGuestElders('sect-hollow-court')).toEqual([]);
    });

    it('gives a guest elder to hosts of different kinds', () => {
        const hosts = GUEST_ELDERS.map(g => g.hostFactionId);
        const models = new Set(hosts.map(h => getParentage(h)!.governance));
        expect(models.size, 'all the guest elders sit inside one governance model')
            .toBeGreaterThanOrEqual(2);
        // At least one guest is stronger than the institution hosting them.
        const stronger = GUEST_ELDERS.filter(g => g.realmOrdinal >= getSect(g.hostFactionId)!.powerOrdinal);
        expect(stronger.length).toBeGreaterThanOrEqual(1);
    });

    it('lists subsidiaries in both directions', () => {
        const sillHolders = getSubsidiariesOf('court-third-sill');
        expect(sillHolders.length).toBeGreaterThanOrEqual(8);
        for (const p of sillHolders) expect(p.governance).toBe('federated');
        expect(getSubsidiariesOf('sect-weir-office').map(p => p.factionId))
            .toContain('sect-gleaners-company');
        expect(getSubsidiariesOf('sect-hollow-bell-wanderers')).toEqual([]);
    });
});
