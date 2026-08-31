/**
 * World-layer content validation: the two regions, the two traditions, the
 * faction distinctness pass, and the mortal economy.
 *
 * Companion to `cultivation-content.test.ts`, which validates the catalogs
 * themselves. This file validates the things that make the catalogs a place
 * rather than a list, and it enforces the two authoring tests from
 * `docs/world/making-places-different.md`:
 *
 *   region  - name three things true here and false one province over
 *   faction - one sentence that could not be said about any other faction
 *
 * It also enforces the hard constraint that the world has ONE ladder: local
 * vocabularies must tile `REALM_TIERS` exactly, and may not correspond inside
 * a realm.
 */

import { describe, it, expect } from 'vitest';

import { REALM_TIERS } from '../../src/engine/cultivation/realms.js';
import { STARTING_SPIRIT_STONES } from '../../src/schema/cultivation.js';
import { SECTS, getSect, getDaoHouse } from '../../src/data/cultivation/sects.js';
import { getPill, MINOR_HEALING_PILL_ID, GRAIN_ABSTINENCE_PILL_ID } from '../../src/data/cultivation/pills.js';
import {
    REGIONS,
    RegionSchema,
    HOME_REGION_ID,
    ADJACENT_REGION_ID,
    getRegion,
    getRegionForFaction,
    getBranchesOf,
    localRankBand,
    localRankName,
    translateLocalTitle,
    rankMisreadingFor,
    canAdvanceHere,
    disciplineWorksIn,
    regionContrast,
    RANK_MISREADINGS,
    TITLE_TRANSLATIONS,
    PLACERS
} from '../../src/data/cultivation/regions.js';
import {
    TRADITIONS,
    TraditionSchema,
    TRADITION_WAR,
    TWICE_WORKED,
    CROSS_TRADITION_ERRORS,
    getTradition,
    traditionForRegion,
    killRequirement
} from '../../src/data/cultivation/traditions.js';
import {
    OCCUPATIONS,
    OccupationSchema,
    PRICES,
    PriceSchema,
    SETTLEMENTS,
    SettlementSchema,
    MORTAL_ATTITUDES,
    CASH_PER_STONE,
    getPrice,
    findWorkForOrdinal,
    pricesByCategory,
    mortalAttitudeFor,
    monthsOfSurvival,
    stonesToCash
} from '../../src/data/cultivation/mortal-world.js';
import {
    FACTION_CHARACTER,
    getFactionCharacter,
    getProductionTier,
    inheritanceGap,
    decliningFactions,
    getHighRealmProvenance,
    survivorsOfARicherAge,
    HIGH_REALM_PROVENANCE,
    HIGH_REALM_THRESHOLD,
    PROVENANCE_PENDING
} from '../../src/data/cultivation/faction-character.js';

function expectUniqueIds(entries: readonly { id: string }[], label: string): void {
    const seen = new Set(entries.map(e => e.id));
    expect(seen.size, `duplicate ${label} ids`).toBe(entries.length);
}

// ─────────────────────────────────────────────────────────────────────────
describe('regions', () => {
    it('holds exactly two, and does not grow a third', () => {
        expect(REGIONS.length).toBe(2);
        for (const r of REGIONS) expect(() => RegionSchema.parse(r), r.id).not.toThrow();
        expectUniqueIds(REGIONS, 'region');
        expect(REGIONS.filter(r => r.role === 'home').length).toBe(1);
    });

    it('makes the adjacent region less densely authored, on purpose', () => {
        const home = getRegion(HOME_REGION_ID)!;
        const away = getRegion(ADJACENT_REGION_ID)!;
        expect(away.factionIds.length).toBeLessThan(home.factionIds.length / 4);
        expect(away.factionIds.length).toBeGreaterThanOrEqual(3);
    });

    it('seats every faction in the catalog in exactly one region', () => {
        const seated = new Set<string>();
        for (const region of REGIONS) {
            for (const id of region.factionIds) {
                expect(getSect(id), `region names unknown faction ${id}`).toBeDefined();
                expect(seated.has(id), `${id} seated twice`).toBe(false);
                seated.add(id);
            }
        }
        for (const s of SECTS) {
            expect(seated.has(s.id), `${s.id} is seated nowhere`).toBe(true);
            expect(getRegionForFaction(s.id)).toBeDefined();
        }
    });

    it('has a governing fact with derivations, a register and varied customs', () => {
        for (const r of REGIONS) {
            expect(r.governingFact.length).toBeGreaterThan(60);
            expect(r.derivations.length, `${r.id} derivations`).toBeGreaterThanOrEqual(3);
            for (const key of ['colour', 'light', 'sound', 'smell', 'food'] as const) {
                expect(r.register[key].length, `${r.id} register.${key}`).toBeGreaterThan(3);
            }
            for (const key of ['socialPrinciple', 'death', 'taboo', 'threatModel', 'naming', 'time'] as const) {
                expect(r.customs[key].length, `${r.id} customs.${key}`).toBeGreaterThan(40);
            }
        }
        const [home, away] = REGIONS;
        for (const key of ['colour', 'sound', 'smell', 'food'] as const) {
            expect(home.register[key]).not.toBe(away.register[key]);
        }
        for (const key of ['socialPrinciple', 'death', 'taboo', 'threatModel', 'naming', 'time'] as const) {
            expect(home.customs[key]).not.toBe(away.customs[key]);
        }
    });

    it('passes the region test: three things true here and false one province over', () => {
        for (const r of REGIONS) {
            expect(r.trueHereFalseThere.length, `${r.id}`).toBeGreaterThanOrEqual(3);
            for (const line of r.trueHereFalseThere) expect(line.length).toBeGreaterThan(40);
        }
    });

    it('records what a cultivator notices on crossing the border', () => {
        const away = getRegion(ADJACENT_REGION_ID)!;
        expect(away.crossingNotes.length).toBeGreaterThanOrEqual(6);
        for (const note of away.crossingNotes) expect(note.length).toBeGreaterThan(40);
        expect(getRegion(HOME_REGION_ID)!.crossingNotes.length).toBeGreaterThanOrEqual(3);
    });

    it('connects the two regions in both directions and in several ways', () => {
        for (const r of REGIONS) {
            const other = r.id === HOME_REGION_ID ? ADJACENT_REGION_ID : HOME_REGION_ID;
            expect(r.connections.length, `${r.id} connections`).toBeGreaterThanOrEqual(2);
            for (const c of r.connections) expect(c.otherRegionId).toBe(other);
            expect(new Set(r.connections.map(c => c.kind)).size).toBeGreaterThanOrEqual(2);
        }
        for (const r of REGIONS) {
            for (const b of r.branches) {
                expect(getSect(b.parentSectId), `${r.id} branch of unknown ${b.parentSectId}`).toBeDefined();
                expect(getRegionForFaction(b.parentSectId)!.id).not.toBe(r.id);
            }
        }
        expect(getBranchesOf('sect-stonewright-consortium').length).toBeGreaterThan(0);
    });

    it('changes cultivation itself, not just the scenery', () => {
        const home = getRegion(HOME_REGION_ID)!;
        const away = getRegion(ADJACENT_REGION_ID)!;
        expect(away.cultivation.method).not.toBe(home.cultivation.method);
        expect(away.cultivation.ambientRateMultiplier).toBeLessThan(home.cultivation.ambientRateMultiplier);
        expect(away.cultivation.missingDisciplines.length).toBeGreaterThanOrEqual(2);
        expect(away.localCeilingOrdinal).toBeLessThan(home.localCeilingOrdinal);
        expect(away.politics).not.toBe(home.politics);
        expect(disciplineWorksIn(ADJACENT_REGION_ID, 'alchemy')).toBe(false);
        expect(disciplineWorksIn(HOME_REGION_ID, 'alchemy')).toBe(true);
        expect(canAdvanceHere(ADJACENT_REGION_ID, 3)).toBe(true);
        expect(canAdvanceHere(ADJACENT_REGION_ID, 12)).toBe(false);
        expect(regionContrast().length).toBeGreaterThanOrEqual(5);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('one ladder, local vocabulary', () => {
    it('relabels the shared ladder and never defines a second one', () => {
        for (const region of REGIONS) {
            const bands = region.cultivation.localRankNames;
            expect(bands.length, `${region.id} band count`).toBe(REALM_TIERS.length);
            bands.forEach((band, i) => {
                const tier = REALM_TIERS[i];
                expect(band.fromOrdinal, `${region.id} band ${i} start`).toBe(tier.ordinalStart);
                expect(band.toOrdinal, `${region.id} band ${i} end`).toBe(tier.ordinalEnd);
                expect(band.standardName).toBe(tier.name);
                expect(band.standardSubdivisions).toBe(tier.subRanks.length);
                expect(band.subRankCorrespondence).toBe('none');
            });
        }
    });

    it('aligns at realm boundaries and refuses to align inside them', () => {
        const marches = getRegion(ADJACENT_REGION_ID)!.cultivation.localRankNames;
        const mismatched = marches.filter(b => b.localSubdivisions !== b.standardSubdivisions);
        expect(mismatched.length).toBeGreaterThanOrEqual(marches.length / 2);
        for (const band of marches) expect(band.subRankNote.length).toBeGreaterThan(40);
    });

    it('translates a local title to a realm, with the disputes attached', () => {
        expect(localRankName(ADJACENT_REGION_ID, 18)).toBe('Keystone');
        expect(localRankName(HOME_REGION_ID, 18)).toBe('Core Formation');
        const t = translateLocalTitle(ADJACENT_REGION_ID, 'Standing Cut')!;
        expect(t.fromOrdinal).toBe(13);
        expect(t.toOrdinal).toBe(16);
        expect(t.standardName).toBe('Foundation Establishment');
        expect(t.disputes.length).toBeGreaterThanOrEqual(3);
        expect(translateLocalTitle(ADJACENT_REGION_ID, 'not a rank')).toBeUndefined();
        expect(localRankBand(ADJACENT_REGION_ID, 15)!.localName).toBe('Standing Cut');
    });

    it('records the misreading as an incident, not an assertion', () => {
        expect(TITLE_TRANSLATIONS.length).toBeGreaterThanOrEqual(3);
        expect(new Set(TITLE_TRANSLATIONS.map(t => t.mapping)).size).toBe(TITLE_TRANSLATIONS.length);
        expect(RANK_MISREADINGS.length).toBeGreaterThanOrEqual(1);
        const m = rankMisreadingFor('Standing Cut')!;
        expect(m.realmIsClear.length).toBeGreaterThan(60);
        expect(m.insideIsNot.length).toBeGreaterThan(60);
        expect(m.systematicDirection.length).toBeGreaterThan(60);
        expect(m.recordedIncident.length, 'the incident must be specific').toBeGreaterThan(200);
        expect(PLACERS.trade).toBe('placer');
        expect(getDaoHouse('house-ninefold-ledger')!.services.some(s => /placement/i.test(s))).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('two traditions', () => {
    it('has exactly two, and they are seated one per region', () => {
        expect(TRADITIONS.length, 'two is a quarrel; three is a taxonomy').toBe(2);
        for (const t of TRADITIONS) expect(() => TraditionSchema.parse(t), t.id).not.toThrow();
        expect(traditionForRegion(HOME_REGION_ID)!.id).toBe('tradition-drawn');
        expect(traditionForRegion(ADJACENT_REGION_ID)!.id).toBe('tradition-cut');
        for (const r of REGIONS) expect(getTradition(r.traditionId)).toBeDefined();
    });

    it('gives them different answers to being killed, and they are inverses', () => {
        expect(getTradition('tradition-drawn')!.death.persistsFromOrdinal).toBe(21);
        expect(getTradition('tradition-cut')!.death.persistsFromOrdinal).toBeNull();

        const drawnAt24 = killRequirement('tradition-drawn', 24);
        const cutAt24 = killRequirement('tradition-cut', 24);
        expect(drawnAt24.soulAttackWorks).toBe(true);
        expect(cutAt24.soulAttackWorks).toBe(false);
        expect(drawnAt24.bodyIsEnough).toBe(false);
        expect(drawnAt24.note).not.toBe(cutAt24.note);
        expect(killRequirement('tradition-drawn', 12).bodyIsEnough).toBe(true);
    });

    it('is recognisable on sight, with no investigation required', () => {
        for (const t of TRADITIONS) {
            expect(t.recognition.length, `${t.id} recognition`).toBeGreaterThanOrEqual(3);
            for (const sign of t.recognition) expect(sign.length).toBeGreaterThan(40);
        }
        expect(getTradition('tradition-drawn')!.recognition.join(' ')).toMatch(/candle|warm|move/i);
        expect(getTradition('tradition-cut')!.recognition.join(' ')).toMatch(/still|flat|straight/i);
    });

    it('has a war behind it that the geography still records', () => {
        expect(TRADITION_WAR.yearsAgo).toBeGreaterThan(100);
        expect(TRADITION_WAR.lowFallAccount).not.toBe(TRADITION_WAR.marchesAccount);
        expect(TRADITION_WAR.trueAccount).not.toBe(TRADITION_WAR.lowFallAccount);
        expect(TRADITION_WAR.trueAccount).not.toBe(TRADITION_WAR.marchesAccount);
        expect(TRADITION_WAR.discoverableTraces.length).toBeGreaterThanOrEqual(3);
        expect(TRADITION_WAR.whatTheGeographyRecords.length).toBeGreaterThan(60);
    });

    it('makes walking both roads strange rather than strong', () => {
        expect(TWICE_WORKED.costs.length).toBeGreaterThanOrEqual(3);
        expect(TWICE_WORKED.recordedCount).toBeLessThan(20);
        expect(TWICE_WORKED.disputedCount).toBeLessThan(TWICE_WORKED.recordedCount);
        expect(TWICE_WORKED.drawnOpinion.length).toBeGreaterThan(40);
        expect(TWICE_WORKED.cutOpinion.length).toBeGreaterThan(40);
    });

    it('records what each tradition gets wrong about the other', () => {
        expect(CROSS_TRADITION_ERRORS.length).toBeGreaterThanOrEqual(3);
        expect(new Set(CROSS_TRADITION_ERRORS.map(e => e.heldBy)).size,
            'both sides must be wrong about something').toBe(2);
        for (const e of CROSS_TRADITION_ERRORS) {
            expect(e.consequence.length, e.belief).toBeGreaterThan(60);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('faction distinctness pass', () => {
    it('covers every faction in the catalog', () => {
        for (const s of SECTS) {
            expect(getFactionCharacter(s.id), `${s.id} has no character record`).toBeDefined();
        }
        for (const id of Object.keys(FACTION_CHARACTER)) {
            expect(getSect(id), `character for unknown faction ${id}`).toBeDefined();
        }
    });

    it('gives each one a visible practice, a grievance, a fear and a wrong belief', () => {
        for (const [id, c] of Object.entries(FACTION_CHARACTER)) {
            expect(c.practice.length, `${id} practice`).toBeGreaterThan(60);
            expect(c.grievance.length, `${id} grievance`).toBeGreaterThan(40);
            expect(c.fear.length, `${id} fear`).toBeGreaterThan(40);
            expect(c.lateness.length, `${id} lateness`).toBeGreaterThan(60);
            expect(c.disagreement.length, `${id} disagreement`).toBeGreaterThan(60);
            expect(c.wrongAbout.length, `${id} wrongAbout`).toBeGreaterThan(60);
            expect(c.unitOfValue.length, `${id} unitOfValue`).toBeGreaterThan(30);
        }
    });

    it('passes the faction test: every sentence is unique to its faction', () => {
        const sentences = Object.values(FACTION_CHARACTER).map(c => c.distinctSentence);
        expect(new Set(sentences).size, 'two factions share a sentence').toBe(sentences.length);
        for (const s of sentences) expect(s.length).toBeGreaterThan(60);
    });

    it('varies the unit of value, so negotiations differ', () => {
        const units = Object.values(FACTION_CHARACTER).map(c => c.unitOfValue.split('.')[0].toLowerCase());
        expect(new Set(units).size).toBeGreaterThan(Object.keys(FACTION_CHARACTER).length * 0.7);
    });

    it('ranks factions by what they can produce, not who they contain', () => {
        for (const s of SECTS) {
            const p = getProductionTier(s.id)!;
            expect(p.reliableOrdinal, `${s.id} produces above its peak`).toBeLessThanOrEqual(p.peakOrdinal);
            expect(p.reliableOrdinal, `${s.id} produces above its strongest member`)
                .toBeLessThanOrEqual(s.powerOrdinal);
            expect(p.note.length).toBeGreaterThan(40);
            expect(p.peakOrdinal).toBeLessThanOrEqual(45);
        }
    });

    it('distinguishes living on inheritance from a working pipeline', () => {
        // A wide gap between the strongest member and what the sect can still
        // turn out is a sect coasting on people it did not train.
        const coasting = SECTS.filter(s => inheritanceGap(s.id, s.powerOrdinal) >= 10);
        expect(coasting.length, 'nobody is coasting on old members').toBeGreaterThanOrEqual(1);
        const healthy = SECTS.filter(s => inheritanceGap(s.id, s.powerOrdinal) <= 8);
        expect(healthy.length, 'nobody has a pipeline near its own ceiling').toBeGreaterThanOrEqual(3);
        // And the starkest inheritance case is measured against the PEAK: a
        // sect that once produced a crossing and now turns out Core Formation.
        const onInheritance = SECTS.filter(s => {
            const p = getProductionTier(s.id)!;
            return p.peakOrdinal - p.reliableOrdinal >= 20;
        });
        expect(onInheritance.length, 'nobody is living on an ancient peak').toBeGreaterThanOrEqual(2);
        const declining = decliningFactions();
        expect(declining.length).toBeGreaterThan(5);
        for (let i = 1; i < declining.length; i++) {
            expect(declining[i].lost).toBeLessThanOrEqual(declining[i - 1].lost);
        }
    });

    it('makes the Hollow Court the extreme case of the two metrics disagreeing', () => {
        const court = getSect('sect-hollow-court')!;
        expect(getProductionTier(court.id)!.reliableOrdinal).toBe(0);
        expect(court.powerOrdinal).toBe(44);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the mortal world', () => {
    it('parses, and anchors two currencies against the starting purse', () => {
        for (const o of OCCUPATIONS) expect(() => OccupationSchema.parse(o), o.id).not.toThrow();
        for (const p of PRICES) expect(() => PriceSchema.parse(p), p.id).not.toThrow();
        for (const s of SETTLEMENTS) expect(() => SettlementSchema.parse(s), s.kind).not.toThrow();
        expectUniqueIds(OCCUPATIONS, 'occupation');
        expectUniqueIds(PRICES, 'price');
        expect(CASH_PER_STONE).toBe(100);
        expect(stonesToCash(STARTING_SPIRIT_STONES)).toBe(3_000);
    });

    it('prices things in a legible order, from a bowl of millet upward', () => {
        const order = [
            'price-millet', 'price-meal', 'price-inn-night', 'price-month-rations',
            'price-month-lodging', 'price-cave-ordinary', 'price-mule', 'price-cart',
            'price-grant-day', 'price-cave-vein', 'price-farmland-mu'
        ];
        for (let i = 1; i < order.length; i++) {
            expect(getPrice(order[i])!.cash, `${order[i]} should cost more than ${order[i - 1]}`)
                .toBeGreaterThan(getPrice(order[i - 1])!.cash);
        }
        expect(getPrice('price-minor-healing-pill')!.cash)
            .toBe(stonesToCash(getPill(MINOR_HEALING_PILL_ID)!.value));
        expect(getPrice('price-qi-gathering-pill')!.cash)
            .toBe(stonesToCash(getPill('pill-qi-gathering')!.value));
        expect(getPrice('price-clear-meridian-pill')!.cash)
            .toBe(stonesToCash(getPill('pill-clear-meridian')!.value));
        expect(getPill(GRAIN_ABSTINENCE_PILL_ID)!.value * CASH_PER_STONE)
            .toBeGreaterThan(getPrice('price-farmland-mu')!.cash * 50);
    });

    it('gives a poor cultivator something to do between breakthroughs', () => {
        const earlyWork = findWorkForOrdinal(4).filter(o => o.kind !== 'mortal');
        expect(earlyWork.length, 'nothing for a Qi Condensation cultivator to do')
            .toBeGreaterThanOrEqual(4);
        const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
        const mortalPay = OCCUPATIONS.filter(o => o.kind === 'mortal').map(o => o.cashPerMonth);
        const cultivatorPay = OCCUPATIONS.filter(o => o.kind === 'cultivator').map(o => o.cashPerMonth);
        expect(avg(cultivatorPay)).toBeGreaterThan(avg(mortalPay) * 2);
        expect(OCCUPATIONS.some(o => o.risk === 'lethal')).toBe(true);
        expect(OCCUPATIONS.filter(o => o.minOrdinal === 0).length).toBeGreaterThanOrEqual(10);
    });

    it('describes every settlement kind as somewhere with things in it', () => {
        const kinds = new Set(SETTLEMENTS.map(s => s.kind));
        for (const kind of ['hamlet', 'village', 'market_town', 'sect_town', 'city'] as const) {
            expect(kinds.has(kind), `missing settlement kind ${kind}`).toBe(true);
        }
        for (const s of SETTLEMENTS) {
            expect(s.contains.length).toBeGreaterThanOrEqual(3);
            expect(s.cultivatorCanGet.length).toBeGreaterThanOrEqual(3);
            expect(s.lacks.length, `${s.kind} lacks nothing`).toBeGreaterThanOrEqual(2);
        }
    });

    it('varies how mortals regard cultivators by realm and by region', () => {
        expect(MORTAL_ATTITUDES.length).toBeGreaterThanOrEqual(4);
        for (const a of MORTAL_ATTITUDES) expect(a.lowFall).not.toBe(a.quietMarches);
        const low = mortalAttitudeFor(3, HOME_REGION_ID)!;
        expect(low).toMatch(/unimpressed|chicken|deference/i);
        expect(mortalAttitudeFor(3, ADJACENT_REGION_ID)).not.toBe(low);
        expect(mortalAttitudeFor(30, HOME_REGION_ID)).not.toBe(low);
    });

    it('makes the starting purse a survivable number of months, not a fortune', () => {
        const rough = monthsOfSurvival(STARTING_SPIRIT_STONES, 'rough');
        expect(rough).toBeGreaterThan(10);
        expect(rough).toBeLessThan(40);
        expect(monthsOfSurvival(STARTING_SPIRIT_STONES, 'cave')).toBeLessThan(1);
        expect(pricesByCategory('food').length).toBeGreaterThanOrEqual(3);
    });
});

// -------------------------------------------------------------------------
describe('survivors of a richer age', () => {
    it('makes every high-realm faction say which age it climbed in', () => {
        const high = SECTS.filter(s => s.powerOrdinal > HIGH_REALM_THRESHOLD);
        expect(high.length, 'nobody stands high enough to need an account').toBeGreaterThanOrEqual(6);
        for (const sect of high) {
            if (PROVENANCE_PENDING.has(sect.id)) continue;
            const p = getHighRealmProvenance(sect.id);
            expect(p, `${sect.id} stands at ${sect.powerOrdinal} and does not say when it climbed`)
                .toBeDefined();
            expect(p!.highestOrdinal, `${sect.id} provenance disagrees with its power ordinal`)
                .toBe(sect.powerOrdinal);
            expect(p!.climbedYearsAgo, `${sect.id} climbed too recently to be a survivor`)
                .toBeGreaterThanOrEqual(100);
            expect(p!.climbedWhere.length).toBeGreaterThan(60);
            expect(p!.ageNote.length).toBeGreaterThan(60);
            expect(p!.whyNobodyHasSince.length, `${sect.id} does not say what has happened since`)
                .toBeGreaterThan(100);
            expect(p!.settledBelief.length, `${sect.id} does not say what people believe`)
                .toBeGreaterThan(60);
        }
    });

    it('claims a long silence, never an impossibility', () => {
        // The top of the ladder is reachable in the present day with
        // extraordinary luck AND extraordinary talent - vanishingly rare, and
        // genuinely possible. Every competent institution believes otherwise
        // and is almost right. Nothing here may assert the stronger claim, or
        // the world turns out to have been lying the day a player manages it.
        const impossibility = [
            /\bimpossible\b/i,
            /cannot be done/i,
            /could not be done/i,
            /no longer possible/i,
            /nothing available today/i,
            /any ambient/i,
            /anywhere in the world/i,
            /ceiling is the world/i
        ];
        for (const [factionId, p] of Object.entries(HIGH_REALM_PROVENANCE)) {
            const claim = `${p.whyNobodyHasSince} ${p.settledBelief} ${p.ageNote}`;
            for (const pattern of impossibility) {
                expect(pattern.test(claim), `${factionId} asserts impossibility: ${pattern}`).toBe(false);
            }
        }
    });

    it('separates the record from the belief, which is where the gap lives', () => {
        for (const [factionId, p] of Object.entries(HIGH_REALM_PROVENANCE)) {
            expect(getSect(factionId), `provenance for unknown faction ${factionId}`).toBeDefined();
            // The record is a duration or a count: how long it has been.
            expect(p.whyNobodyHasSince, `${factionId} record states no elapsed time or symptom`)
                .toMatch(/years|century|centuries|since|no longer|stall|closed|dead/i);
            // The belief is attributed to somebody, not asserted by the catalog.
            expect(p.settledBelief, `${factionId} states a belief with no believer`)
                .toMatch(/believ|settled|holds|takes it|tell you|teaches|regard|conclud|presents/i);
        }
        // And at least one faction declines to correct the belief, or dissents
        // from it - the gap has to be visible somewhere in the catalog.
        const beliefs = Object.values(HIGH_REALM_PROVENANCE).map(p => p.settledBelief).join(' ');
        expect(beliefs).toMatch(/decline to correct|does not|has not concluded|insisting otherwise/i);
    });

    it('keeps the pending list explicit and small', () => {
        expect(PROVENANCE_PENDING.size).toBeLessThanOrEqual(2);
        for (const id of PROVENANCE_PENDING) {
            expect(getSect(id), `pending provenance for unknown faction ${id}`).toBeDefined();
            expect(getSect(id)!.powerOrdinal).toBeGreaterThan(HIGH_REALM_THRESHOLD);
        }
    });

    it('takes its threshold as an argument rather than restating an engine number', () => {
        // Content must not carry a second copy of a reachability measurement.
        expect(survivorsOfARicherAge().length).toBeGreaterThanOrEqual(2);
        expect(survivorsOfARicherAge(35).every(s => s.provenance.highestOrdinal > 35)).toBe(true);
        expect(survivorsOfARicherAge(40)).toEqual([]);
    });
});
