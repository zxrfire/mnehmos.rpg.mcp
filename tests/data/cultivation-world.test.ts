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

import { MAX_ORDINAL, REALM_TIERS } from '../../src/engine/cultivation/realms.js';
import { STARTING_SPIRIT_STONES } from '../../src/schema/cultivation.js';
import { SECTS, getSect, getDaoHouse } from '../../src/data/cultivation/sects.js';
import { getApexInstitution } from '../../src/data/cultivation/hierarchy.js';
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
    PLACERS,
    EAST_REGION_ID,
    NORTH_REGION_ID,
    SOUTH_REGION_ID,
    RUIN_NAMES,
    SCAR_NAMES,
    GeneratedPlaceNameSchema
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
    it('holds the five of the spine, one of them home', () => {
        expect(REGIONS.length).toBe(5);
        for (const r of REGIONS) expect(() => RegionSchema.parse(r), r.id).not.toThrow();
        expectUniqueIds(REGIONS, 'region');
        expect(REGIONS.filter(r => r.role === 'home').length).toBe(1);
        for (const id of [HOME_REGION_ID, ADJACENT_REGION_ID, EAST_REGION_ID, NORTH_REGION_ID, SOUTH_REGION_ID]) {
            expect(getRegion(id), `${id} is not in the catalog`).toBeDefined();
        }
    });

    it('spreads the factions out instead of stacking them in one province', () => {
        // The defect this split exists to fix: 32 of 32 houses in two
        // provinces meant every house shared ground with almost every other
        // one, and territory, rivalry and distance had nothing to measure
        // against. No province may hold a majority of the catalog.
        const total = SECTS.length;
        for (const r of REGIONS) {
            expect(r.factionIds.length, `${r.id} holds too much of the world`)
                .toBeLessThanOrEqual(Math.ceil(total * 0.6));
            expect(r.factionIds.length, `${r.id} is seated by nobody`)
                .toBeGreaterThanOrEqual(2);
        }
        // And the home province is still the densest, because it is the centre
        // and every road in the world runs through it.
        const home = getRegion(HOME_REGION_ID)!;
        for (const r of REGIONS) {
            if (r.id === HOME_REGION_ID) continue;
            expect(r.factionIds.length).toBeLessThan(home.factionIds.length);
        }
    });

    it('gives every province a ceiling that means something, and the apex one that does not', () => {
        // `localCeilingOrdinal` caps NPC advancement in pressure.ts and sets
        // trial thresholds in seeding.ts, so a flat gradient is a flat world.
        const ceilings = REGIONS.map(r => r.localCeilingOrdinal);
        expect(new Set(ceilings).size, 'two provinces share a ceiling').toBe(REGIONS.length);
        // Exactly one province has no ceiling at all, and it is the one the
        // world's apex stands in. This is readable from the number alone.
        const uncapped = REGIONS.filter(r => r.localCeilingOrdinal >= MAX_ORDINAL);
        expect(uncapped.length).toBe(1);
        expect(uncapped[0].id).toBe(HOME_REGION_ID);
        expect(uncapped[0].factionIds).toContain('sect-hollow-court');
        // Every other province has a real ceiling, and it is not a rounding of
        // the top: a province capped one rung below the ladder is not capped.
        for (const r of REGIONS) {
            if (r.id === HOME_REGION_ID) continue;
            expect(r.localCeilingOrdinal, `${r.id} has a nominal ceiling`)
                .toBeLessThan(MAX_ORDINAL - 4);
            expect(r.ceilingNote.length, `${r.id} does not say why`).toBeGreaterThan(60);
        }
        // And the water is the floor of the world.
        expect(getRegion(SOUTH_REGION_ID)!.localCeilingOrdinal)
            .toBeLessThan(getRegion(ADJACENT_REGION_ID)!.localCeilingOrdinal);
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
        // No two provinces may share a sensory identity or a custom. With two
        // regions this was one comparison; with five it is the assertion that
        // actually stops the map blurring, which is what
        // `making-places-different.md` exists to prevent.
        for (const key of ['colour', 'light', 'sound', 'smell', 'food'] as const) {
            const seen = new Set(REGIONS.map(r => r.register[key]));
            expect(seen.size, `two provinces share register.${key}`).toBe(REGIONS.length);
        }
        for (const key of ['socialPrinciple', 'death', 'taboo', 'threatModel', 'naming', 'time'] as const) {
            const seen = new Set(REGIONS.map(r => r.customs[key]));
            expect(seen.size, `two provinces share customs.${key}`).toBe(REGIONS.length);
        }
        // Governing facts, too. A province that borrows another's governing
        // fact has no reason to exist separately from it.
        expect(new Set(REGIONS.map(r => r.governingFact)).size).toBe(REGIONS.length);
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

    it('connects the provinces symmetrically, through a centre, and by water past it', () => {
        const byId = new Map(REGIONS.map(r => [r.id, r]));
        for (const r of REGIONS) {
            expect(r.connections.length, `${r.id} connections`).toBeGreaterThanOrEqual(2);
            expect(new Set(r.connections.map(c => c.kind)).size).toBeGreaterThanOrEqual(2);
            for (const c of r.connections) {
                expect(c.otherRegionId, `${r.id} connects to itself`).not.toBe(r.id);
                const other = byId.get(c.otherRegionId);
                expect(other, `${r.id} connects to unknown ${c.otherRegionId}`).toBeDefined();
                // Symmetric, and at the same cost. A road that is eleven days
                // one way and six the other is a bug, not a gradient.
                const back = other!.connections.filter(b => b.otherRegionId === r.id);
                expect(back.length, `${c.otherRegionId} does not connect back to ${r.id}`)
                    .toBeGreaterThan(0);
                for (const b of back) {
                    expect(b.travelDays, `${r.id}<->${other!.id} disagree on distance`)
                        .toBe(c.travelDays);
                }
            }
        }

        // Every province reaches the home province directly, which is what
        // makes it the centre rather than merely the first entry.
        for (const r of REGIONS) {
            if (r.id === HOME_REGION_ID) continue;
            expect(
                r.connections.some(c => c.otherRegionId === HOME_REGION_ID),
                `${r.id} cannot reach the centre`
            ).toBe(true);
        }

        // And the only links that bypass the centre are by water. This is the
        // whole reason the sea is in the catalog: it opens a route between two
        // coasts that no road makes.
        const bypasses = REGIONS.flatMap(r => r.connections
            .filter(c => r.id !== HOME_REGION_ID && c.otherRegionId !== HOME_REGION_ID)
            .map(c => ({ from: r.id, c })));
        expect(bypasses.length, 'nothing goes round the centre at all').toBeGreaterThan(0);
        for (const b of bypasses) {
            expect(b.c.kind, `${b.from} bypasses the centre overland`).toBe('sea_crossing');
        }
        // A crossing is slower than any road in the world, without exception.
        const longestRoad = Math.max(...REGIONS.flatMap(r => r.connections
            .filter(c => c.kind !== 'sea_crossing').map(c => c.travelDays)));
        for (const b of bypasses) {
            expect(b.c.travelDays, 'a sea crossing is quicker than a road')
                .toBeGreaterThan(longestRoad);
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
        for (const row of regionContrast()) {
            expect(Object.keys(row.byRegion).length, `${row.aspect} omits a province`)
                .toBe(REGIONS.length);
        }
    });

    it('THE WATER IS NOT A PROVINCE WITH A DIFFERENT COLOUR', () => {
        const sea = getRegion(SOUTH_REGION_ID)!;
        // No vein under it, so the standard method is not slow here, it is
        // absent - which is what `docs/world/qi.md` already says about ground
        // with no vein, applied rather than waived.
        expect(disciplineWorksIn(SOUTH_REGION_ID, 'ordinary drawing')).toBe(false);
        expect(disciplineWorksIn(HOME_REGION_ID, 'ordinary drawing')).toBe(true);
        // The thinnest air and the lowest rate in the world, and the dearest
        // goods, because everything is carried and nothing is made.
        for (const r of REGIONS) {
            if (r.id === SOUTH_REGION_ID) continue;
            expect(sea.cultivation.ambientRateMultiplier)
                .toBeLessThan(r.cultivation.ambientRateMultiplier);
            expect(sea.priceMultiplier).toBeGreaterThan(r.priceMultiplier);
        }
        // Nobody holds it, and it is the only province where that is true.
        expect(sea.politics).toBe('no_authority');
        expect(REGIONS.filter(r => r.politics === 'no_authority').length).toBe(1);
        // Only water carries a sea crossing, and it carries more than one.
        for (const r of REGIONS) {
            const crossings = r.connections.filter(c => c.kind === 'sea_crossing');
            if (r.id === SOUTH_REGION_ID) expect(crossings.length).toBeGreaterThanOrEqual(2);
            for (const c of crossings) {
                expect(
                    r.id === SOUTH_REGION_ID || c.otherRegionId === SOUTH_REGION_ID,
                    `${r.id} has a sea crossing that does not touch the water`
                ).toBe(true);
            }
        }
    });

    it('names the generated half of the map without putting the kind in the name', () => {
        // `history.ts` and `locations.ts` currently build ruin and scar names
        // by concatenating a LocationKind onto a generated toponym. These
        // tables are what they should draw from instead; the rule is that a
        // reader must not be able to recover the kind from the name.
        const forbidden = /\b(ruin|scar|compound|sealed|precinct|chamber|vault|settlement|wilds|vein|hall)\b/i;
        for (const table of [RUIN_NAMES, SCAR_NAMES]) {
            expect(table.length).toBeGreaterThanOrEqual(14);
            for (const entry of table) {
                expect(() => GeneratedPlaceNameSchema.parse(entry), entry.name).not.toThrow();
                expect(forbidden.test(entry.name), `${entry.name} carries its own kind`).toBe(false);
                // Plain. A place name that runs to five words is a description.
                expect(entry.name.split(' ').length, `${entry.name} is not a name`)
                    .toBeLessThanOrEqual(3);
            }
        }
        const all = [...RUIN_NAMES, ...SCAR_NAMES].map(e => e.name);
        expect(new Set(all).size, 'a generated name is reused').toBe(all.length);
        // And no generated name may collide with an authored place, which
        // would put two different places in front of a narrator under one word.
        const authored = new Set(REGIONS.flatMap(r => r.places.map(p => p.name.toLowerCase())));
        for (const name of all) expect(authored.has(name.toLowerCase()), name).toBe(false);
        // Every one of the five naming sources is actually used.
        const sources = new Set([...RUIN_NAMES, ...SCAR_NAMES].map(e => e.source));
        expect(sources.size).toBe(5);
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
            // Apexes are factions too. The two ancient ones have no sect row
            // because nobody can join them, and they carried no character
            // record at all until it turned out that left the sheet unable to
            // say how either could be paid - which is the one question a
            // reader has about an institution they can never be a member of.
            const known = getSect(id) ?? getApexInstitution(id);
            expect(known, `character for unknown faction ${id}`).toBeDefined();
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

    it('separates what each one is known for from what it is good at', () => {
        for (const [id, c] of Object.entries(FACTION_CHARACTER)) {
            expect(c.knownFor, `${id} has no reputation record`).toBeDefined();
            expect(c.knownFor.outside.length, `${id} outside`).toBeGreaterThan(60);
            expect(c.knownFor.actuallyGoodAt.length, `${id} actuallyGoodAt`).toBeGreaterThan(60);
            expect(c.knownFor.theGap.length, `${id} theGap`).toBeGreaterThan(40);
            // The whole point: the two halves must not be the same claim.
            expect(
                c.knownFor.outside.toLowerCase(),
                `${id} is known for exactly what it is good at, which is not a gap`
            ).not.toBe(c.knownFor.actuallyGoodAt.toLowerCase());
        }
    });

    it('keeps every reputation distinct, the way the sentences are', () => {
        const outside = Object.values(FACTION_CHARACTER).map(c => c.knownFor.outside);
        expect(new Set(outside).size, 'two factions share a reputation').toBe(outside.length);
        const real = Object.values(FACTION_CHARACTER).map(c => c.knownFor.actuallyGoodAt);
        expect(new Set(real).size, 'two factions share a capability').toBe(real.length);
    });

    it('lets reputation run ahead of capability in at least one case', () => {
        // Usually the world underrates a faction. The Weir Office is the
        // inversion, and the catalog would be a monotone without it.
        const weir = FACTION_CHARACTER['sect-weir-office']!;
        expect(weir.knownFor.actuallyGoodAt).toMatch(/nothing anybody outside would recognise/i);
        expect(weir.knownFor.theGap).toMatch(/ahead of capability/i);
        expect(weir.knownFor.theGap).toMatch(/positional/i);
    });

    it('lets some factions have quietly stopped doing the thing they are for', () => {
        const stopped = Object.entries(FACTION_CHARACTER).filter(([, c]) => c.quietlyStopped);
        expect(stopped.length, 'nobody in the catalog is coasting, which is not honest').toBeGreaterThanOrEqual(3);
        for (const [id, c] of stopped) {
            expect(c.quietlyStopped!.length, `${id} quietlyStopped`).toBeGreaterThan(120);
        }
        // And it is a decision nobody made, rather than a policy anybody announced.
        const all = stopped.map(([, c]) => c.quietlyStopped!).join(' ');
        expect(all).toMatch(/Nobody decided this|has not come up|no decision anywhere/i);
        // Not everybody, or the world reads as uniformly decayed.
        expect(stopped.length).toBeLessThan(Object.keys(FACTION_CHARACTER).length / 3);
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
            expect(p.peakOrdinal).toBeLessThanOrEqual(MAX_ORDINAL);
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
        expect(survivorsOfARicherAge(41)).toEqual([]);
    });
});
