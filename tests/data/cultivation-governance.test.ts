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
import { readFileSync } from 'node:fs';

import {
    SECTS,
    SECT_ANCESTRY,
    getSect,
    getSectAdmission,
    sectThreat,
    sectsWithASealedCeiling,
    canProjectLastRealm,
    HOLLOW_COURT_FOSTERAGE,
    WITHDRAWN_POWERS,
    SECT_ANCESTRY as ANCESTRY_FOR_CANDIDACY
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
    AZURE_CLOUD_INTAKE,
    DEFERENCE_HOLDINGS,
    BORDER_KINDS,
    REGION_GOVERNANCE,
    UNBACKED_PLAYER_TRADE,
    getApexInstitution,
    leaderTitleOf,
    leaderTitleOfCourt,
    secondTitleOf,
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
        expect(APEX_INSTITUTIONS.length).toBeLessThanOrEqual(3);
        for (const a of APEX_INSTITUTIONS) {
            expect(() => ApexInstitutionSchema.parse(a), a.id).not.toThrow();
        }

        // The hidden ones. Being unnameable is what the two ancient apexes
        // trade for being unreachable, and every invariant below is a
        // consequence of that trade rather than of being an apex - the third,
        // which has a front gate, meets none of them and should not.
        const hidden = APEX_INSTITUTIONS.filter(a => a.heritage === 'ancient');
        expect(hidden.length).toBe(2);
        for (const a of hidden) {
            expect(a.startingAwareness).toBe('unaware');
            expect(mayBeNamed(a.startingAwareness), `${a.id} may not be named to a beginner`).toBe(false);
            expect(a.awarenessSources.length, `${a.id} is unlearnable`).toBeGreaterThanOrEqual(3);
            // It can act on a player who cannot name it.
            expect(a.actsWithoutAttribution.length).toBeGreaterThanOrEqual(3);
            expect(unattributedEffectsOf(a.id).length).toBe(a.actsWithoutAttribution.length);
        }

        // And the visible one acts in its own name, which is the trade run the
        // other way: everything it does is attributable, dated and remembered.
        const visible = APEX_INSTITUTIONS.filter(a => a.heritage === 'recent');
        expect(visible.length).toBe(1);
        expect(mayBeNamed(visible[0].startingAwareness)).toBe(true);
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
        // The chain terminates on itself: it reaches no court and no apex,
        // which is the structural statement that nothing is above it.
        const chain = chainToApex(HOLLOW_COURT);
        expect(chain).toEqual([HOLLOW_COURT]);
        expect(chain.some(id => getApexInstitution(id) || getCourt(id))).toBe(false);
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

// ─────────────────────────────────────────────────────────────────────────
// REDUNDANCY IS WHAT BUYS REACH
//
// Several bodies hold the last realm. Almost none of them can send it
// anywhere, and the reason is arithmetic rather than temperament.
// ─────────────────────────────────────────────────────────────────────────

describe('who can actually put the last realm somewhere else', () => {
    it('gives each apex exactly one, and pins them to the seat', () => {
        for (const apex of APEX_INSTITUTIONS) {
            expect(apex.lastRealm.count, apex.id).toBe(1);
            expect(apex.lastRealm.pinned, apex.id).toBe(true);
            // The ordinal is real; the availability is not.
            expect(apex.powerOrdinal).toBeGreaterThanOrEqual(41);
        }
    });

    it('lets exactly one faction in the world spare one', () => {
        const projectors = SECTS.map(s => s.id).filter(canProjectLastRealm);
        expect(projectors).toEqual(['sect-hollow-court']);
        expect(WITHDRAWN_POWERS['sect-hollow-court'].count).toBeGreaterThan(1);

        // And no apex qualifies, however strong it is at home.
        for (const apex of APEX_INSTITUTIONS) {
            expect(canProjectLastRealm(apex.id), apex.id).toBe(false);
        }
    });

    it('makes the Court stronger than the apexes on both counts', () => {
        const court = getSect('sect-hollow-court')!;
        const withdrawn = WITHDRAWN_POWERS[court.id];
        for (const apex of APEX_INSTITUTIONS) {
            expect(court.powerOrdinal).toBeGreaterThan(apex.powerOrdinal);
            expect(withdrawn.count).toBeGreaterThan(apex.lastRealm.count);
        }
    });

    it('does not let redundancy become availability', () => {
        // Being able to spare one is not the same as being willing to. The
        // Court is busy rather than pinned, and busy is a decision it keeps
        // making - so the appearance list stays short.
        const withdrawn = WITHDRAWN_POWERS['sect-hollow-court'];
        expect(withdrawn.hasAppearedFor.length).toBeLessThanOrEqual(4);
        expect(withdrawn.occupiedBy).toBeTruthy();
    });
});

describe('fosterage: the door is not shut, it is just the same door', () => {
    it('sends them out and lets them back on the same terms as anyone', () => {
        const requirement = getSectAdmission('sect-hollow-court')!.requirement;
        expect(requirement).toMatch(/fostered out/i);
        // The distinction the rule turns on. If this ever reads as a bar, the
        // Court becomes cruel rather than indifferent, which is a different
        // faction.
        expect(requirement).toMatch(/not barred/i);
        expect(requirement).toMatch(/same terms as a stranger/i);
    });

    it('gates on age rather than on rank, and says why', () => {
        const f = HOLLOW_COURT_FOSTERAGE;
        expect(f.returnOrdinal).toBe(getSect('sect-hollow-court')!.admissionOrdinal);
        expect(f.returnByAge).toBeGreaterThan(0);
        // Age, because the question is whether the rest of the road fits in the
        // life that is left - not whether they are impressive now.
        expect(f.returnByAge).toBeLessThan(500);
    });

    it('fosters only to sects that actually exist and are reputable', () => {
        expect(HOLLOW_COURT_FOSTERAGE.fosteredTo.length).toBeGreaterThanOrEqual(3);
        for (const id of HOLLOW_COURT_FOSTERAGE.fosteredTo) {
            const host = getSect(id);
            expect(host, `unknown foster sect ${id}`).toBeDefined();
            expect(host!.alignment, `${id} is not a fit host`).not.toBe('demonic');
            expect(host!.recruits, `${id} takes nobody`).toBe(true);
        }
    });

    it('makes not returning a life rather than a punishment', () => {
        // Half the point. If the fallback is bleak the rule reads as exile, and
        // the Court stops being holy ground and becomes a cult.
        expect(HOLLOW_COURT_FOSTERAGE.otherwise.length).toBeGreaterThan(120);
        expect(HOLLOW_COURT_FOSTERAGE.otherwise).toMatch(/elder|deference|reputable/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT THE PINNED ONE IS SITTING ON
//
// Each apex was founded by somebody who crossed, and each of them sent one
// object back down. Those objects are the only thing in the world the Hollow
// Court wants, and the only thing worth spending a sealed ancestor on.
// ─────────────────────────────────────────────────────────────────────────

describe('the sent-down treasures', () => {
    it('gives every apex exactly one, intact, and never used', () => {
        for (const apex of APEX_INSTITUTIONS) {
            const gift = apex.sentDown;
            expect(gift.intact, apex.id).toBe(true);
            expect(gift.reserveTerms.length, apex.id).toBeGreaterThan(60);
            // Two uses, and both of them are the two things that cross the Lid:
            // comprehension of the crossing, and a message upward.
            expect(gift.uses.length).toBeGreaterThanOrEqual(2);
            expect(gift.uses.join(' ')).toMatch(/comprehension/i);
            expect(gift.uses.join(' ')).toMatch(/channel upward/i);
        }
    });

    it('ties the object to the seat, so the pin has a reason', () => {
        for (const apex of APEX_INSTITUTIONS) {
            // The holder is pinned BECAUSE of the object. If these ever come
            // apart, the apexes are just strong rather than stuck.
            expect(apex.lastRealm.pinned).toBe(true);
            expect(apex.sentDown.ifUncovered.length).toBeGreaterThan(80);
            expect(apex.sentDown.ifUncovered).toMatch(/seat|sits|sitting|elsewhere|vacated|reach|defence/i);
        }
    });

    it('is a formidable artifact before it is anything to do with the Lid', () => {
        // Immortal-made is a statement about construction first. Strip out
        // ascension entirely and each is still the best object anyone has heard
        // described, which is why the wanting is not confined to the few with a
        // realistic route upward.
        for (const apex of APEX_INSTITUTIONS) {
            expect(apex.sentDown.asAnArtifact.length, apex.id).toBeGreaterThan(80);
        }
        const byId = Object.fromEntries(APEX_INSTITUTIONS.map(a => [a.id, a.sentDown]));
        // And the two are good at different things, so they are not one prize
        // described twice.
        expect(byId['apex-deep-survey'].asAnArtifact).toMatch(/conceal|formation|arbitration|lied to/i);
        expect(byId['apex-long-cut'].asAnArtifact).toMatch(/fixed|ground|perimeter/i);
    });

    it('names a contender set much wider than the Court', () => {
        // The Court has the clearest motive. It is not the reason the seats are
        // never left - the sealed ancestors are. A one-time asset traded for a
        // permanent advantage is a good trade, and everyone can do that sum.
        const uncovered = APEX_INSTITUTIONS.map(a => a.sentDown.ifUncovered).join(' ');
        expect(uncovered).toMatch(/seal/i);
        expect(uncovered).toMatch(/every sect|contenders/i);

        // And the sealed ancestors that make that true actually exist.
        const sealed = Object.values(SECT_ANCESTRY).filter(r => r.dormant != null);
        expect(sealed.length).toBeGreaterThan(1);
    });

    it('keeps the two objects distinct in what they cost to take', () => {
        const byId = Object.fromEntries(APEX_INSTITUTIONS.map(a => [a.id, a.sentDown]));
        // One can be carried off. One cannot, and has to be used in place -
        // which is a different heist and a different kind of siege.
        expect(byId['apex-deep-survey'].ifUncovered).toMatch(/taken|carried/i);
        expect(byId['apex-long-cut'].ifUncovered).toMatch(/cannot be carried|in place/i);
    });
});

describe('a seal cuts both ways', () => {
    it('carries a disaster clause as its stated purpose', () => {
        // Defensive read: what the sect tells itself the seal is for, and it is
        // true. Every wake condition in the catalog is somebody losing.
        for (const [id, record] of Object.entries(SECT_ANCESTRY)) {
            const sealed = record.dormant;
            if (!sealed) continue;
            expect(sealed.wakeCondition.length, id).toBeGreaterThan(40);
            expect(sealed.wakeCost.length, id).toBeGreaterThan(40);
        }
    });

    it('is spendable in the other direction, and the catalog says so', () => {
        // Offensive read: the sect does not say this out loud, so the code has
        // to. If this note goes, the sealed ancestors quietly become scenery.
        const src = readSects();
        expect(src).toMatch(/A SEAL CUTS BOTH WAYS/);
        expect(src).toMatch(/opening move/i);
    });
});

/** The doc comment IS the artefact here, so it is what gets asserted on. */
function readSects(): string {
    return readFileSync('src/data/cultivation/sects.ts', 'utf-8');
}

describe('the third apex: young, visible, and holding outright', () => {
    const AZURE = 'sect-azure-cloud-pavilion';

    it('is an apex in the structure, not only in the province gossip', () => {
        const apex = getApexInstitution('apex-azure-cloud');
        expect(apex, 'the Pavilion is missing from APEX_INSTITUTIONS').toBeDefined();
        expect(apex!.heritage).toBe('recent');
        expect(apex!.lastRealm.count).toBe(1);
        expect(apex!.lastRealm.pinned).toBe(true);
        expect(apex!.sentDown.id).toBe('artifact-the-standing-edge');
        // The catalog and the structure agree about the same object.
        const gift = SECT_ANCESTRY[AZURE].partingGift!;
        expect(gift.id).toBe(apex!.sentDown.id);
        expect(gift.intact).toBe(true);
    });

    it('holds outright and pays nobody, since the crossing', () => {
        const p = getParentage(AZURE)!;
        expect(p.governance).toBe('unassailable');
        expect(p.parentFactionId).toBeNull();
        expect(p.terms).toBeNull();
        expect(p.unbackedReason).toBeNull();
        expect(chainToApex(AZURE)).toEqual([AZURE]);
        // And it is no longer counted among the Third Sill's tenants.
        expect(getSubsidiariesOf('court-third-sill').map(x => x.factionId)).not.toContain(AZURE);
    });

    it('is the only apex a starting cultivator can name', () => {
        const named = APEX_INSTITUTIONS.filter(a => a.startingAwareness !== 'unaware');
        expect(named.map(a => a.id)).toEqual(['apex-azure-cloud']);
        // Visibility is the exposure, and the catalog has to say so.
        expect(named[0].instability).toMatch(/found|gate|watched|joined/i);
    });

    it('is the weakest of the three and the shallowest', () => {
        const apexes = APEX_INSTITUTIONS;
        const azure = getApexInstitution('apex-azure-cloud')!;
        expect(azure.powerOrdinal).toBe(Math.min(...apexes.map(a => a.powerOrdinal)));
        expect(apexes.filter(a => a.heritage === 'ancient').length).toBe(2);
        expect(apexes.filter(a => a.heritage === 'recent').length).toBe(1);
        // Still the last realm, still below the Court.
        expect(azure.powerOrdinal).toBeGreaterThanOrEqual(41);
        expect(azure.powerOrdinal).toBeLessThan(getSect('sect-hollow-court')!.powerOrdinal);
    });

    it('is one person deep, which is what shallow heritage measures', () => {
        const azure = getApexInstitution('apex-azure-cloud')!;
        // Top of the last realm ladder by a hair, then a cliff. Three stages
        // of nothing is not a secret - any rival counting the roster finds it.
        expect(azure.powerOrdinal).toBe(41);
        expect(azure.powerOrdinal - azure.secondStrongestOrdinal).toBeGreaterThanOrEqual(3);
        expect(azure.depthNote).toMatch(/cliff|one person deep|nobody in between/i);

        // The ancient two are filled in underneath and survive losing anyone.
        for (const a of APEX_INSTITUTIONS.filter(x => x.heritage === 'ancient')) {
            expect(a.powerOrdinal - a.secondStrongestOrdinal, a.id).toBeLessThanOrEqual(4);
        }
    });

    it('is not weak, because it is the only one with anything left to spend', () => {
        // Age runs backwards for consumables. The inversion is the whole reason
        // the lowest ordinal of the three is not the weakest position of the
        // three in a short exchange.
        const byId = Object.fromEntries(APEX_INSTITUTIONS.map(a => [a.id, a]));
        expect(byId['apex-azure-cloud'].stock.remaining).toBe('nearly_intact');
        expect(byId['apex-deep-survey'].stock.remaining).toBe('spent');
        expect(byId['apex-long-cut'].stock.remaining).toBe('depleted');
        // And nobody can restock, for the same reason every time.
        for (const a of APEX_INSTITUTIONS) {
            expect(a.stock.cannotRestock, a.id).toMatch(/Lid|through|come back|second source/i);
        }
    });

    it('gives all three a distinct way to lose the position', () => {
        const reasons = APEX_INSTITUTIONS.map(a => a.instability);
        expect(new Set(reasons).size).toBe(reasons.length);
        for (const r of reasons) expect(r.length).toBeGreaterThan(80);
    });
});

describe('why the Court cannot be robbed', () => {
    it('can dispatch and still hold the mountain, and no apex can', () => {
        const court = WITHDRAWN_POWERS['sect-hollow-court'];
        // Sending two still leaves the ground covered. One holder cannot both
        // guard the object and pursue whoever took it, which is the correct
        // play against an apex and no play at all against the Court.
        expect(court.count - 2).toBeGreaterThanOrEqual(1);
        for (const apex of APEX_INSTITUTIONS) {
            expect(apex.lastRealm.count - 1).toBe(0);
        }
    });
});


// ─────────────────────────────────────────────────────────────────────────
// BUYING PEOPLE
// The third intake model. Wide mouth, unchanged throat, and a probation that
// is really an affinity test nobody involved can name.
// ─────────────────────────────────────────────────────────────────────────

describe('the Azure Cloud intake', () => {
    const sect = getSect(AZURE_CLOUD_INTAKE.factionId)!;
    const admission = getSectAdmission(AZURE_CLOUD_INTAKE.factionId)!;

    it('belongs to a real apex and a real sect', () => {
        expect(getApexInstitution(AZURE_CLOUD_INTAKE.apexId)).toBeDefined();
        expect(sect).toBeDefined();
    });

    it('follows from the two things already established about them', () => {
        expect(AZURE_CLOUD_INTAKE.theTrade).toMatch(/thin on members, rich in resources/i);
        expect(AZURE_CLOUD_INTAKE.theTrade).toMatch(/sister/i);
        expect(AZURE_CLOUD_INTAKE.theTrade).toMatch(/into people/i);
        // Circumstance, not values, and it would end with the sending.
        expect(AZURE_CLOUD_INTAKE.itIsCircumstanceNotValues).toMatch(/would run the same programme/i);
        expect(AZURE_CLOUD_INTAKE.itIsCircumstanceNotValues).toMatch(/end the year the sending stopped/i);
    });

    it('explains why no other apex can copy it, in their own terms', () => {
        expect(AZURE_CLOUD_INTAKE.whyNobodyElseCanDoIt).toMatch(/Hollow Court/);
        expect(AZURE_CLOUD_INTAKE.whyNobodyElseCanDoIt).toMatch(/Void Refinement/);
        expect(AZURE_CLOUD_INTAKE.whyNobodyElseCanDoIt).toMatch(/Deep Survey/);
        expect(AZURE_CLOUD_INTAKE.whyNobodyElseCanDoIt).toMatch(/Long Cut/);
        // And it does not contradict the Long Cut, which tests everybody already.
        expect(DIRECT_RULE.intakeModel).toBe('tests everyone');
        expect(AZURE_CLOUD_INTAKE.intakeModel).not.toBe(DIRECT_RULE.intakeModel);
    });

    it('tests what is testable and says plainly what it cannot reach', () => {
        expect(AZURE_CLOUD_INTAKE.whatTheyTest.length).toBeGreaterThanOrEqual(4);
        const all = AZURE_CLOUD_INTAKE.whatTheyTest.join(' ');
        expect(all).toMatch(/root/i);
        expect(all).toMatch(/temperament/i);
        expect(all).toMatch(/taught/i);
        expect(AZURE_CLOUD_INTAKE.whatTheyCannotTest).toMatch(/affinity/i);
        expect(AZURE_CLOUD_INTAKE.whatTheyCannotTest).toMatch(/rolled at creation|never shown|only by exposure/i);
        expect(AZURE_CLOUD_INTAKE.whatTheyCannotTest).toMatch(/nobody in the world/i);
        expect(AZURE_CLOUD_INTAKE.soTheAssessmentIs).toMatch(/insufficient/i);
        expect(AZURE_CLOUD_INTAKE.theGambleIsThePoint).toMatch(/wager/i);
    });

    it('makes probation the empirical answer to the thing no instrument reaches', () => {
        const pr = AZURE_CLOUD_INTAKE.probation;
        expect(AZURE_CLOUD_INTAKE.soTheyBuyTimeInstead).toMatch(/probation/i);
        expect(pr.theModel).toMatch(/Nobody is admitted/i);
        expect(pr.whatItActuallyIs).toMatch(/affinity test, run empirically/i);
        expect(pr.whatItActuallyIs).toMatch(/went quiet/i);
        expect(pr.whatItActuallyIs).toMatch(/cannot name what the instrument detects/i);
    });

    it('gives them an explanation of their own that is wrong in an interesting way', () => {
        const pr = AZURE_CLOUD_INTAKE.probation;
        expect(pr.whatTheyThinkTheyAreTesting).toMatch(/character/i);
        expect(pr.whatTheyThinkTheyAreTesting).toMatch(/eighteen months/i);
        expect(pr.whyThatExplanationIsWrong).toMatch(/not dedication/i);
        expect(pr.whyThatExplanationIsWrong).toMatch(/recognition/i);
        // And the mechanism that makes it work is breadth of exposure.
        expect(pr.theRound).toMatch(/only ever been offered one chance/i);
    });

    it('stages the commitment, which is what makes the gamble affordable', () => {
        const pr = AZURE_CLOUD_INTAKE.probation;
        expect(pr.stagedCommitment).toMatch(/Probation is cheap/i);
        expect(pr.stagedCommitment).toMatch(/Full admission is expensive/i);
        expect(pr.stagedCommitment).toMatch(/Deep Survey and the Long Cut could not/i);
        expect(pr.theLength).toMatch(/four to seven years/i);
        expect(pr.theLength).toMatch(/continuous cost/i);
    });

    it('keeps the throat of the funnel exactly as narrow as it was', () => {
        expect(AZURE_CLOUD_INTAKE.theFunnel).toMatch(/bar at the narrow end has not moved/i);
        expect(AZURE_CLOUD_INTAKE.theFunnel).toMatch(/no discount/i);
        expect(AZURE_CLOUD_INTAKE.notTheSoftApex).toMatch(/Washing out is the ordinary outcome/i);
        // And the numbers agree with the prose.
        expect(AZURE_CLOUD_INTAKE.theLossRate.testedEachYear).toMatch(/thousand/i);
        expect(AZURE_CLOUD_INTAKE.theLossRate.confirmedEachYear).toMatch(/three or four/i);
        expect(AZURE_CLOUD_INTAKE.theLossRate.producedInACentury).toMatch(/eleven/i);
    });

    it('withholds the name, and for the same reason the bar is high', () => {
        expect(AZURE_CLOUD_INTAKE.theNameIsWithheld).toMatch(/does not get to say/i);
        expect(AZURE_CLOUD_INTAKE.theNameIsWithheld).toMatch(/same fact/i);
        expect(AZURE_CLOUD_INTAKE.theBestNameYouCannotSpend).toMatch(/forbidden to spend it/i);
        expect(AZURE_CLOUD_INTAKE.noProtectionOutside).toMatch(/unaffiliated/i);
        expect(AZURE_CLOUD_INTAKE.claimingItFalsely).toMatch(/detectable/i);
        // Somebody did it, and what happened is written down.
        expect(AZURE_CLOUD_INTAKE.claimingItFalsely).toMatch(/sent him home/i);
        expect(AZURE_CLOUD_INTAKE.whatTheWashoutMaySay).toMatch(/were tested/i);
    });

    it('has a probationary rank that is expressible and deliberately not spliced in', () => {
        expect(AZURE_CLOUD_INTAKE.theRank.title).toBe('Probationer');
        expect(AZURE_CLOUD_INTAKE.theRank.notSplicedIntoTheRankArray).toMatch(/rankRealmBand/);
        // The sect ladder is untouched, which is the whole point of that note.
        expect(sect.ranks[0]).toBe('Sword Servant');
        expect(sect.ranks.length).toBe(6);
    });

    it('keeps the door at the bottom without moving the membership bar', () => {
        expect(admission.probationOrdinal).toBe(0);
        expect(admission.minOrdinal).toBe(3);
        expect(admission.minOrdinal).toBe(sect.admissionOrdinal);
        expect(admission.requirement).toMatch(/never moved/i);
        expect(admission.requirement).toMatch(/wide intake, narrow conversion/i);
        // Nobody else in the catalog has a probation floor.
        const withProbation = SECTS.filter(x => getSectAdmission(x.id)?.probationOrdinal !== undefined);
        expect(withProbation.map(x => x.id)).toEqual([AZURE_CLOUD_INTAKE.factionId]);
    });

    it('is the only apex whose door sits at the bottom of the ladder', () => {
        expect(sect.powerOrdinal).toBe(41);
        expect(AZURE_CLOUD_INTAKE.theAnomaly).toMatch(/41/);
        expect(AZURE_CLOUD_INTAKE.whoWouldNoticeIt).toMatch(/almost nobody/i);
        // The Hollow Bell Wanderers reach the same number for the opposite reason.
        const bell = getSectAdmission('sect-hollow-bell-wanderers')!;
        expect(bell.minOrdinal).toBe(0);
        expect(AZURE_CLOUD_INTAKE.theSameNumberForOppositeReasons).toMatch(/Hollow Bell/);
        expect(AZURE_CLOUD_INTAKE.theSameNumberForOppositeReasons).toMatch(/opposite reasons/i);
    });

    it('opens a second door for the tiers that have no placement at all', () => {
        expect(AZURE_CLOUD_INTAKE.originTiers).toEqual(['thin_county', 'market_town']);
        expect(AZURE_CLOUD_INTAKE.theSecondDoor).toMatch(/nerve/i);
        expect(AZURE_CLOUD_INTAKE.theSecondDoor).toMatch(/found and measured/i);
        expect(AZURE_CLOUD_INTAKE.itIsRare).toMatch(/never met anyone/i);
    });

    it('makes rejection a wound, and failing probation the worse one', () => {
        expect(AZURE_CLOUD_INTAKE.rejectionIsAWound).toMatch(/found wanting/i);
        expect(AZURE_CLOUD_INTAKE.rejectionIsAWound).toMatch(/never having been looked at/i);
        expect(AZURE_CLOUD_INTAKE.whatRejectionProduces.length).toBeGreaterThanOrEqual(4);
        const pr = AZURE_CLOUD_INTAKE.probation;
        expect(pr.failingProbationIsTheWorseWound).toMatch(/you were inside/i);
        expect(pr.theWashoutIsNotAMortal).toMatch(/asking\.md/);
        expect(pr.theWashoutIsNotAMortal).toMatch(/two rungs below/i);
        // And some are kept for reasons that are not promise.
        expect(pr.notAllForPromise).toMatch(/useful|liked/i);
        expect(pr.howDisciplesRegardThem).toMatch(/ugly/i);
    });

    it('describes a finder with a route, a method and a quota', () => {
        const sc = AZURE_CLOUD_INTAKE.theScouts;
        expect(sc.howMany).toMatch(/six/i);
        expect(sc.theRoute).toMatch(/fourteen months|circuit/i);
        expect(sc.theMethod).toMatch(/without the subject knowing/i);
        expect(sc.theQuota).toMatch(/two put forward/i);
        // The quota has a consequence, which is the point of writing one.
        expect(sc.theQuota).toMatch(/last two months of the year/i);
        expect(sc.whatItIsLikeToMeetOne).toMatch(/never learn what happened/i);
    });

    it('hands the engine work off without doing any of it', () => {
        expect(AZURE_CLOUD_INTAKE.engineHandoff).toMatch(/origin\.ts/);
        expect(AZURE_CLOUD_INTAKE.engineHandoff).toMatch(/placement\.reach/);
        expect(AZURE_CLOUD_INTAKE.engineHandoff).toMatch(/No engine file is edited here/i);
        expect(AZURE_CLOUD_INTAKE.engineGaps.length).toBeGreaterThanOrEqual(3);
        const gaps = AZURE_CLOUD_INTAKE.engineGaps.join(' ');
        expect(gaps).toMatch(/sectId/);
        expect(gaps).toMatch(/rank rather than the presence/i);
        expect(gaps).toMatch(/admissionOrdinal/);
    });
});

describe('the seats stand on recorded rungs', () => {
    it('records one seat per count, ordered by the rule the Court uses', () => {
        for (const [factionId, w] of Object.entries(WITHDRAWN_POWERS)) {
            expect(w.seats.length, factionId + ' count disagrees with its seats').toBe(w.count);
            // Ordinal descending. Ties are legal and are where age decides.
            for (let i = 1; i < w.seats.length; i++) {
                expect(w.seats[i].ordinal, factionId + ' seat ' + i + ' outranks the one above it')
                    .toBeLessThanOrEqual(w.seats[i - 1].ordinal);
            }
        }
    });

    it('puts First Seat on the faction ordinal, which is what the rule says', () => {
        for (const [factionId, w] of Object.entries(WITHDRAWN_POWERS)) {
            const sect = getSect(factionId);
            if (!sect) continue;
            expect(w.seats[0].ordinal, factionId + ': First Seat is not the strongest member')
                .toBe(sect.powerOrdinal);
        }
    });

    it('keeps at least one tie, because the tiebreak has to do visible work', () => {
        // Second and Third on the same rung is the age rule showing up in the
        // data. If every seat had a distinct ordinal the rule would be inert.
        const court = WITHDRAWN_POWERS['sect-hollow-court'];
        const ordinals = court.seats.map(s => s.ordinal);
        expect(new Set(ordinals).size).toBeLessThan(ordinals.length);
    });
});

describe('Seat is the Hollow Court vocabulary and nobody else uses it', () => {
    it('derives every apex and court title from the body it belongs to', () => {
        const seen = new Set<string>();
        for (const a of APEX_INSTITUTIONS) {
            const leader = leaderTitleOf(a);
            const second = secondTitleOf(a);
            // Named for the object it sits on, and for the body respectively.
            expect(leader).toContain('Lord');
            expect(leader).toContain(a.sentDown.name.split(' ').pop()!);
            // Grand Elder, not Warden: three factions in the catalog are Wardens
            // of something, and one of them guards the world-heart.
            expect(second).toContain('Grand Elder');
            expect(leader + second, a.id + ' borrows the Court vocabulary').not.toMatch(/Seat/i);
            // Distinct, or the titles would not identify anybody.
            expect(seen.has(leader), 'duplicate title ' + leader).toBe(false);
            seen.add(leader);
        }
        for (const c of COURTS) {
            const t = leaderTitleOfCourt(c);
            expect(t).toContain('Lord');
            expect(t, c.id + ' borrows the Court vocabulary').not.toMatch(/Seat/i);
            expect(seen.has(t), 'duplicate title ' + t).toBe(false);
            seen.add(t);
        }
    });

    it('leaves the bare rank to the faction that means something by it', () => {
        // A Council Seat is a seat on a council and is ordinary English. What
        // belongs to the Court alone is the unqualified rank, and the ordinal
        // positions it sorts into.
        const bare = SECTS.filter(s => s.ranks.some(r => /^(first |second |third |fourth )?seat$/i.test(r)));
        expect(bare.map(s => s.id)).toEqual(['sect-hollow-court']);
    });
});
