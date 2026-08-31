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

import {
    SECTS,
    SECT_ANCESTRY,
    getSect,
    sectThreat,
    sectsWithASealedCeiling,
    WITHDRAWN_POWERS
} from '../../src/data/cultivation/sects.js';
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

// ─────────────────────────────────────────────────────────────────────────
// ONE RANKING
//
// The governance stack and the power table describe the same world and used to
// be scored on different scales - every faction carried a `powerOrdinal` while
// the two institutions above all of them carried none, so "who outranks whom"
// had two incompatible answers. These assertions keep them one ranking.
// ─────────────────────────────────────────────────────────────────────────

describe('the stack and the power table are one ranking', () => {
    /** Realm of whoever a body can actually field. Apex, court or sect. */
    function actingPowerOf(id: string): number | null {
        return getApexInstitution(id)?.powerOrdinal
            ?? getCourt(id)?.powerOrdinal
            ?? getSect(id)?.powerOrdinal
            ?? null;
    }

    it('measures the apexes and courts on the same scale as everyone else', () => {
        for (const apex of APEX_INSTITUTIONS) {
            expect(ApexInstitutionSchema.parse(apex).powerOrdinal).toBeGreaterThan(0);
        }
        for (const court of COURTS) {
            expect(CourtSchema.parse(court).powerOrdinal).toBeGreaterThan(0);
        }
    });

    it('keeps every holder weaker than what it holds from', () => {
        // A grant is only worth something if the granter can take it back. An
        // edge where the tenant outranks the landlord is not a lease, it is a
        // fiction the tenant is choosing to maintain - and if that is what is
        // meant, it belongs in the deference model, not in a parentage edge.
        const offences: string[] = [];
        for (const p of Object.values(FACTION_PARENTAGE)) {
            if (!p.parentFactionId) continue;
            const child = actingPowerOf(p.factionId);
            const parent = actingPowerOf(p.parentFactionId);
            if (child == null || parent == null) continue;
            if (parent <= child) {
                offences.push(`${p.factionId} (${child}) holds from ${p.parentFactionId} (${parent})`);
            }
        }
        expect(offences, offences.join('; ')).toEqual([]);
    });

    it('puts each apex above every court beneath it', () => {
        for (const court of COURTS) {
            const apex = getApexInstitution(court.apexId);
            expect(apex, court.apexId).toBeDefined();
            expect(apex!.powerOrdinal).toBeGreaterThan(court.powerOrdinal);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
// ACTING POWER IS NOT SEALED POWER
// ─────────────────────────────────────────────────────────────────────────

describe('what a sect can field, versus what it can spend once', () => {
    const VOID_REFINEMENT_START = 29;
    const TRIBULATION_END = 44;

    it('seals only what is worth the formation to hold', () => {
        // A seal is a formation running for centuries off a vein. Below Void
        // Refinement nobody would pay for it; above Tribulation Transcendence
        // nothing in the Late Age was built to hold one.
        for (const [sectId, record] of Object.entries(SECT_ANCESTRY)) {
            const sealed = record.dormant;
            if (!sealed) continue;
            expect(sealed.realmOrdinal, `${sectId}: ${sealed.name}`)
                .toBeGreaterThanOrEqual(VOID_REFINEMENT_START);
            expect(sealed.realmOrdinal, `${sectId}: ${sealed.name}`)
                .toBeLessThanOrEqual(TRIBULATION_END);
        }
    });

    it('uses the whole band rather than one comfortable rung', () => {
        const sealed = Object.values(SECT_ANCESTRY)
            .map(r => r.dormant)
            .filter((d): d is NonNullable<typeof d> => d != null);
        expect(sealed.length).toBeGreaterThanOrEqual(3);
        expect(new Set(sealed.map(d => d.sealGrade)).size).toBeGreaterThanOrEqual(3);
        expect(Math.max(...sealed.map(d => d.realmOrdinal))
            - Math.min(...sealed.map(d => d.realmOrdinal))).toBeGreaterThanOrEqual(5);
    });

    it('never folds a sealed ancestor into public strength', () => {
        // The whole point: an eleven-disciple sect with something under the
        // mountain must still read as an eleven-disciple sect from outside.
        for (const [sectId, record] of Object.entries(SECT_ANCESTRY)) {
            const sealed = record.dormant;
            if (!sealed) continue;
            const sect = getSect(sectId);
            if (!sect) continue;
            expect(sect.powerOrdinal, `${sectId} absorbed its sealed ancestor`)
                .not.toBe(sealed.realmOrdinal);
        }
    });

    it('reports acting and ceiling separately, and they can differ', () => {
        const raised = sectsWithASealedCeiling();
        expect(raised.length).toBeGreaterThan(0);
        for (const sect of raised) {
            const threat = sectThreat(sect.id)!;
            expect(threat.acting).toBe(sect.powerOrdinal);
            expect(threat.ceiling).toBeGreaterThan(threat.acting);
            // A ceiling you cannot trigger is not a ceiling.
            expect(threat.wakeCondition).toBeTruthy();
            expect(threat.wakeCost).toBeTruthy();
        }
    });

    it('keeps at least one sealed asset that outsiders cannot see', () => {
        // Sects lie in both directions, so the catalog must contain a case a
        // player has no way to read off the outside of the mountain.
        const hidden = Object.values(SECT_ANCESTRY)
            .filter(r => r.dormant && !r.dormant.publiclyKnown);
        expect(hidden.length).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE UNASSAILABLE CASE
// ─────────────────────────────────────────────────────────────────────────

describe('holding ground by being unanswerable', () => {
    const HOLLOW_COURT = 'sect-hollow-court';
    const VOID_REFINEMENT_START = 29;

    it('separates paying for independence from not being billable', () => {
        // 'unbacked' means holds nothing and pays continuously. The Court holds
        // its ground outright and pays nobody, and collapsing the two makes the
        // unbacked sects' actual precarity vanish.
        const court = getParentage(HOLLOW_COURT)!;
        expect(court.governance).toBe('unassailable');
        expect(court.parentFactionId).toBeNull();
        expect(court.unbackedReason).toBeNull();

        const unbacked = Object.values(FACTION_PARENTAGE)
            .filter(p => p.governance === 'unbacked');
        expect(unbacked.length).toBeGreaterThan(0);
        for (const p of unbacked) {
            expect(p.unbackedReason, `${p.factionId} is unbacked without a reason`).toBeTruthy();
        }
    });

    it('puts the strongest acting power in the world outside the stack', () => {
        // The Deep Survey administers the vein system. The one vein it does not
        // administer is the best one, and the reason is standing on it.
        const court = getSect(HOLLOW_COURT)!;
        const strongestApex = Math.max(...APEX_INSTITUTIONS.map(a => a.powerOrdinal));
        expect(court.powerOrdinal).toBeGreaterThan(strongestApex);
        expect(court.powerOrdinal).toBe(Math.max(...SECTS.map(s => s.powerOrdinal)));
        expect(chainToApex(HOLLOW_COURT)).toEqual([]);
    });

    it('admits on the bar alone, and forecloses inheritance explicitly', () => {
        const court = getSect(HOLLOW_COURT)!;
        expect(court.recruits).toBe(true);
        expect(court.admissionOrdinal).toBe(VOID_REFINEMENT_START);
        // The one door in the world where lineage buys nothing. If this text
        // ever softens, the Court becomes an ordinary powerful sect.
        const requirement = getSectAdmission(HOLLOW_COURT)!.requirement;
        expect(requirement).toMatch(/fostered out/i);
    });

    it('keeps the awake ceiling out of the room', () => {
        // Awake, unsealed, and almost never present. The failure this guards is
        // the opposite of the sealed one: here the ordinal is honest and the
        // availability is the lie.
        const threat = sectThreat(HOLLOW_COURT)!;
        expect(threat.acting).toBe(44);
        expect(threat.ceiling).toBe(threat.acting);
        expect(threat.withdrawn).not.toBeNull();
        expect(threat.withdrawn!.hasAppearedFor.length).toBeGreaterThan(0);

        // Everyone else at the top of the ladder is asleep under a mountain.
        for (const [id, record] of Object.entries(SECT_ANCESTRY)) {
            if (id === HOLLOW_COURT) continue;
            const sect = getSect(id);
            if (!sect || sect.powerOrdinal < 41) continue;
            expect(WITHDRAWN_POWERS[id], `${id} is awake at the last realm too`).toBeUndefined();
        }
    });

    it('holds the withdrawn list to almost nothing', () => {
        // A ceiling several factions hold is not a ceiling.
        expect(Object.keys(WITHDRAWN_POWERS).length).toBeLessThanOrEqual(2);
    });
});
