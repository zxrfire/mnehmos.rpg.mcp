/**
 * Design guards for the territory layer and the ancient tier.
 *
 * These are the claims that would drift silently. Two kinds:
 *
 *   REFERENTIAL - an id somewhere that has to resolve somewhere else. A
 *   prefecture held by a faction that does not exist reads exactly like a
 *   prefecture held by nobody, which is a real and different answer, so the
 *   difference has to be asserted rather than eyeballed.
 *
 *   DESIGN - the claims the authoring guides make, expressed as tests so that
 *   the next person to add a region or an ancient art cannot quietly break
 *   them. `making-places-different.md` says contrast beats addition;
 *   `ancient.md` says ancient is categorical rather than better. Both of those
 *   are checkable in a weak but real way, and a weak check that fires is worth
 *   more than a strong claim nobody reads.
 */

import { describe, it, expect } from 'vitest';

import {
    ARTERIALS,
    DRIVEN_PROVINCE_SCHEDULE_ORDER,
    PREFECTURES,
    PROVINCES,
    LOW_FALL_PROVINCE_ID,
    QUIET_MARCHES_PROVINCE_ID,
    PrefectureSchema,
    ProvinceSchema,
    ArterialSchema,
    arterialsOf,
    contestedGround,
    delegatedFrom,
    getPrefecture,
    getProvince,
    prefectureForFaction,
    prefecturesOf,
    provinceForFaction,
    provinceForRegion,
    REGIONS,
    HOME_REGION_ID,
    ADJACENT_REGION_ID
} from '../../src/data/cultivation/regions.js';
import {
    APEX_INSTITUTIONS,
    COURTS,
    FACTION_PARENTAGE
} from '../../src/data/cultivation/hierarchy.js';
import {
    SECTS,
    prefectureOfSect,
    provinceOfSect,
    delegatedFromSect,
    territoryOfSect,
    sectsSeatedIn
} from '../../src/data/cultivation/sects.js';
import {
    ANCIENT_ARTS,
    ANCIENT_TECHNIQUE_IDS,
    ARCHIVE_COPIES,
    LOST_MATERIALS,
    MEDICINE_HOLDINGS,
    MODERN_AND_ANCIENT,
    STOCKED_INHERITANCES,
    THE_THOUSAND_AUTUMN_PILL,
    absenceTierOf,
    ancientTechniques,
    housesStillHoldingMedicine,
    housesThatSpentTheirs,
    materialGatedArts,
    unresolvedAncientReferences
} from '../../src/data/cultivation/lost-ages.js';
import {
    EXTINCT_HERB_IDS,
    EXTINCTION_NOTES,
    FORAGEABLE_HERBS,
    HERBS,
    findHerbsForOrdinal,
    rollHerb
} from '../../src/data/cultivation/herbs.js';
import { getPill } from '../../src/data/cultivation/pills.js';
import { getRecipe } from '../../src/data/cultivation/recipes.js';
import { TECHNIQUES, getTechnique } from '../../src/data/cultivation/techniques.js';
import { SITES } from '../../src/data/cultivation/inheritance-trials.js';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms.js';

/** Everything that can legitimately hold or grant ground. */
const HOLDER_IDS: ReadonlySet<string> = new Set<string>([
    ...SECTS.map(s => s.id),
    ...APEX_INSTITUTIONS.map(a => a.id),
    ...COURTS.map(c => c.id)
]);

// ─────────────────────────────────────────────────────────────────────────
describe('provinces, arterials and prefectures', () => {
    it('every entry parses against its schema and ids are unique', () => {
        for (const p of PROVINCES) expect(() => ProvinceSchema.parse(p), p.id).not.toThrow();
        for (const p of PREFECTURES) expect(() => PrefectureSchema.parse(p), p.id).not.toThrow();
        for (const a of ARTERIALS) expect(() => ArterialSchema.parse(a), a.id).not.toThrow();

        for (const list of [PROVINCES, PREFECTURES, ARTERIALS]) {
            const ids = list.map(x => x.id);
            expect(new Set(ids).size, `duplicate ids in ${ids[0]}`).toBe(ids.length);
        }
    });

    it('every prefecture sits in a province, and every province lists its own', () => {
        for (const pref of PREFECTURES) {
            expect(getProvince(pref.provinceId), `${pref.id} names province ${pref.provinceId}`)
                .toBeDefined();
            const province = getProvince(pref.provinceId)!;
            expect(province.prefectureIds, `${province.id} does not list ${pref.id}`)
                .toContain(pref.id);
        }
        for (const province of PROVINCES) {
            for (const id of province.prefectureIds) {
                expect(getPrefecture(id), `${province.id} lists unknown prefecture ${id}`)
                    .toBeDefined();
            }
            expect(prefecturesOf(province.id).map(p => p.id).sort())
                .toEqual([...province.prefectureIds].sort());
        }
    });

    it('every holder, sub-holder and granter resolves to something that exists', () => {
        for (const pref of PREFECTURES) {
            if (pref.heldByFactionId) {
                expect(HOLDER_IDS.has(pref.heldByFactionId), `${pref.id} held by unknown ${pref.heldByFactionId}`)
                    .toBe(true);
            }
            if (pref.delegatedFromId) {
                expect(HOLDER_IDS.has(pref.delegatedFromId), `${pref.id} granted by unknown ${pref.delegatedFromId}`)
                    .toBe(true);
            }
            for (const sub of pref.subHoldings) {
                expect(HOLDER_IDS.has(sub.factionId), `${pref.id} sub-holder ${sub.factionId}`).toBe(true);
                expect(HOLDER_IDS.has(sub.delegatedFromId), `${pref.id} sub-granter ${sub.delegatedFromId}`)
                    .toBe(true);
            }
        }
    });

    it('every province is held by a real apex, through a real court where it names one', () => {
        const apexIds = new Set(APEX_INSTITUTIONS.map(a => a.id));
        const courtIds = new Set(COURTS.map(c => c.id));
        for (const p of PROVINCES) {
            expect(apexIds.has(p.heldByApexId), `${p.id} held by unknown apex`).toBe(true);
            if (p.administeredByCourtId) {
                expect(courtIds.has(p.administeredByCourtId), `${p.id} court`).toBe(true);
            }
        }
    });

    it('links the two played provinces to their regions, and leaves the rest without one', () => {
        expect(provinceForRegion(HOME_REGION_ID)?.id).toBe(LOW_FALL_PROVINCE_ID);
        expect(provinceForRegion(ADJACENT_REGION_ID)?.id).toBe(QUIET_MARCHES_PROVINCE_ID);
        for (const p of PROVINCES) {
            if (p.standing === 'played') {
                expect(p.regionId, `${p.id} is played and has no region`).not.toBeNull();
                expect(REGIONS.some(r => r.id === p.regionId), `${p.id} region`).toBe(true);
                expect(p.prefectureIds.length, `${p.id} is played and has no prefectures`)
                    .toBeGreaterThan(0);
                expect(p.whatIsKnownOfIt, `${p.id} is played and carries a rumour field`).toBeNull();
            } else {
                expect(p.regionId, `${p.id} is named-only and has a region`).toBeNull();
                expect(p.prefectureIds, `${p.id} is named-only and has prefectures`).toEqual([]);
                // Thin on purpose is not the same as silent. A named-only
                // province has to say what anybody actually knows of it,
                // because that is the entire content of the entry.
                expect(p.whatIsKnownOfIt, `${p.id} is named-only and says nothing`).toBeTruthy();
                expect(p.startingAwareness, `${p.id} is named-only and is not hidden`).toBe('unaware');
            }
        }
    });

    it('CONTRAST BEATS ADDITION: a prefecture is a different kind of object in each province', () => {
        // The claim `making-places-different.md` makes and the one this whole
        // section is most likely to violate. A Low Fall holding is a surveyed
        // catchment; a Marches holding is a face district. If somebody ever
        // adds a catchment to the Marches, the two provinces have started to
        // blur and this is where it shows.
        for (const pref of prefecturesOf(LOW_FALL_PROVINCE_ID)) {
            expect(pref.kind, `${pref.id} is in the Low Fall and is not a catchment`).toBe('catchment');
        }
        for (const pref of prefecturesOf(QUIET_MARCHES_PROVINCE_ID)) {
            expect(pref.kind, `${pref.id} is in the Marches and is not a face district`)
                .toBe('face_district');
        }
    });

    it('NO SECTS IN THE MARCHES: every district holder is staff or a contractor, never a tenant', () => {
        // The region claims there is no intermediate institution of any kind.
        // That claim is now territorial and therefore checkable: nothing in
        // the Marches may hold ground as a `subsidiary`, which is the relation
        // a leased sect has.
        for (const pref of prefecturesOf(QUIET_MARCHES_PROVINCE_ID)) {
            const holders = [
                ...(pref.heldByFactionId ? [pref.heldByFactionId] : []),
                ...pref.subHoldings.map(s => s.factionId)
            ];
            for (const id of holders) {
                const parentage = FACTION_PARENTAGE[id];
                if (!parentage) continue;
                expect(parentage.relation, `${id} holds ${pref.id} as a ${parentage.relation}`)
                    .not.toBe('subsidiary');
            }
        }
    });

    it('records paper and ground separately, and says which way they disagree', () => {
        for (const pref of PREFECTURES) {
            expect(pref.onPaper.length, `${pref.id} paper`).toBeGreaterThan(40);
            expect(pref.onTheGround.length, `${pref.id} ground`).toBeGreaterThan(40);
            expect(pref.onPaper, `${pref.id} paper and ground are the same sentence`)
                .not.toBe(pref.onTheGround);
        }
        // The late age is not a footnote: most ground should NOT read the same
        // in the record as on the ground. If this ever drops to nothing, the
        // territory layer has become a tidy map of a world that is not tidy.
        expect(contestedGround().length, 'no prefecture anywhere disagrees with its own record')
            .toBeGreaterThan(0);
        // And ground the record carries with nobody against it must genuinely
        // have been granted to nobody. The field is about the RECORD, not
        // about who is standing there: the Hollow Reach has an occupant and a
        // blank column, which is the whole of what makes it the Hollow Reach.
        for (const pref of PREFECTURES) {
            if (pref.discrepancy !== 'no_holder_of_record') continue;
            const granted = pref.heldByFactionId !== null && pref.delegatedFromId !== null;
            expect(granted, `${pref.id} has no holder of record and is somebody's tenant`)
                .toBe(false);
        }
    });

    it('THE ASYMMETRY: the Long Cut is broad, the Survey is deep, and the Pavilion holds no province', () => {
        const byId = new Map(APEX_INSTITUTIONS.map(a => [a.id, a]));
        const survey = byId.get('apex-deep-survey')!;
        const longCut = byId.get('apex-long-cut')!;
        const pavilion = byId.get('apex-azure-cloud')!;

        expect(survey.holdsProvinceIds).toEqual([LOW_FALL_PROVINCE_ID]);
        expect(longCut.holdsProvinceIds.length).toBeGreaterThan(survey.holdsProvinceIds.length);
        expect(longCut.holdsProvinceIds).toContain(QUIET_MARCHES_PROVINCE_ID);

        // A province is something a house accumulates over an age, and the
        // Pavilion has not had one. This is `heritage: 'recent'` as territory.
        expect(pavilion.heritage).toBe('recent');
        expect(pavilion.holdsProvinceIds, 'the youngest apex holds a province').toEqual([]);
        expect(pavilion.holdsPrefectureIds.length, 'the youngest apex holds nothing at all')
            .toBeGreaterThan(0);

        for (const apex of APEX_INSTITUTIONS) {
            for (const id of apex.holdsProvinceIds) {
                expect(getProvince(id), `${apex.id} holds unknown province ${id}`).toBeDefined();
                expect(getProvince(id)!.heldByApexId, `${id} does not name ${apex.id} back`)
                    .toBe(apex.id);
            }
            for (const id of apex.holdsPrefectureIds) {
                expect(getPrefecture(id), `${apex.id} holds unknown prefecture ${id}`).toBeDefined();
            }
        }
    });

    it('every court grants inside the province its own region stands on', () => {
        for (const court of COURTS) {
            const province = provinceForRegion(court.grantsInRegionId);
            expect(province, `${court.id} names region ${court.grantsInRegionId}`).toBeDefined();
            for (const id of court.grantsInPrefectureIds) {
                const pref = getPrefecture(id);
                expect(pref, `${court.id} grants in unknown prefecture ${id}`).toBeDefined();
                expect(pref!.provinceId, `${court.id} grants outside its own province`)
                    .toBe(province!.id);
            }
        }
        // The Kiln administers a datum nobody draws on. Its emptiness is the
        // whole of what the Kiln is, and it is the one court allowed none.
        const kiln = COURTS.find(c => c.id === 'court-kiln')!;
        expect(kiln.grantsInPrefectureIds).toEqual([]);
    });

    it('the four arterials sit under one province and number one to four', () => {
        const lowFall = arterialsOf(LOW_FALL_PROVINCE_ID);
        expect(lowFall.length).toBe(ARTERIALS.length);
        expect(lowFall.map(a => a.ordinalInSystem)).toEqual([1, 2, 3, 4]);
        // The finding that was already in the data: the only arterial anything
        // branches from is administered by a court of the OTHER apex.
        const eleven = lowFall.find(a => a.ordinalInSystem === 3)!;
        const court = COURTS.find(c => c.id === eleven.administeredByCourtId)!;
        expect(court.apexId).not.toBe(getProvince(LOW_FALL_PROVINCE_ID)!.heldByApexId);
    });

    it('the driven schedule covers exactly the Long Cut provinces, with the Marches last', () => {
        const longCut = APEX_INSTITUTIONS.find(a => a.id === 'apex-long-cut')!;
        expect([...DRIVEN_PROVINCE_SCHEDULE_ORDER].sort())
            .toEqual([...longCut.holdsProvinceIds].sort());
        expect(DRIVEN_PROVINCE_SCHEDULE_ORDER[DRIVEN_PROVINCE_SCHEDULE_ORDER.length - 1])
            .toBe(QUIET_MARCHES_PROVINCE_ID);
    });

    it('resolves a sect to its ground, and says plainly when nobody granted it', () => {
        expect(prefectureOfSect('sect-nine-peaks-ascetic-order')?.id).toBe('prefecture-nine-peaks');
        expect(provinceOfSect('sect-nine-peaks-ascetic-order')?.id).toBe(LOW_FALL_PROVINCE_ID);
        expect(delegatedFromSect('sect-nine-peaks-ascetic-order')).toBe('court-third-sill');

        // The five with an empty answer, and five completely different reasons
        // for it. This is the field that makes them comparable at all.
        for (const id of [
            'sect-azure-cloud-pavilion',
            'sect-hollow-court',
            'sect-standing-grove',
            'sect-clear-river-alliance',
            'sect-sixmile-wardens'
        ]) {
            expect(delegatedFromSect(id), `${id} was granted its ground by somebody`).toBeNull();
        }

        const territory = territoryOfSect('sect-verdant-spring-hall');
        expect(territory).toBeDefined();
        expect(territory!.isPrincipalHolder).toBe(false);
        expect(territory!.delegatedFromId).toBe('sect-nine-peaks-ascetic-order');

        expect(sectsSeatedIn('prefecture-gorge-head').map(s => s.id))
            .toContain('sect-azure-cloud-pavilion');
        expect(prefectureForFaction('nobody-at-all')).toBeUndefined();
        expect(provinceForFaction('nobody-at-all')).toBeUndefined();
        expect(delegatedFrom('nobody-at-all')).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the ancient tier', () => {
    it('every id the tier names resolves in a real catalog', () => {
        expect(unresolvedAncientReferences()).toEqual([]);
    });

    it('the era axis covers the whole catalog and agrees with the set', () => {
        expect(new Set(ANCIENT_ARTS.map(a => a.techniqueId))).toEqual(
            new Set([...ANCIENT_TECHNIQUE_IDS])
        );
        for (const t of TECHNIQUES) {
            expect(t.era, `${t.id} era`).toBe(ANCIENT_TECHNIQUE_IDS.has(t.id) ? 'ancient' : 'modern');
        }
        expect(ancientTechniques().length).toBe(ANCIENT_ARTS.length);
    });

    it('CATEGORICAL, NOT ELEMENTAL: no ancient art carries an element', () => {
        // The one half of the modern/ancient distinction that a row can be
        // held to. Carrying an element is what the other era does.
        for (const t of ancientTechniques()) {
            expect(t.element, `${t.id} is ancient and carries an element`).toBeNull();
        }
    });

    it('ABANDONED IS NOT CONDEMNED: no ancient art is filed forbidden', () => {
        // The four condemned arts spend somebody else and the world forbids
        // them. The ancient roads cost the practitioner and nothing forbids
        // them, and the difference has to stay visible in `category` or the
        // social consequence of picking one up collapses into the other.
        for (const t of ancientTechniques()) {
            expect(t.category, `${t.id} is ancient and filed forbidden`).not.toBe('forbidden');
        }
    });

    it('NOT A STRICT UPGRADE: every ancient art names when the ordinary one is better', () => {
        for (const a of ANCIENT_ARTS) {
            expect(a.capability.length, `${a.techniqueId} capability`).toBeGreaterThan(60);
            expect(a.costToTheUser.length, `${a.techniqueId} costs the user nothing`)
                .toBeGreaterThan(40);
            expect(a.whyTheEraStopped.length, `${a.techniqueId} does not say why the era stopped`)
                .toBeGreaterThan(60);
            // The guard that keeps the abandonment coherent. An art with no
            // answer here is better in every situation, and then nobody would
            // have walked away from it.
            expect(a.whenTheModernArtWins.length, `${a.techniqueId} is a strict upgrade`)
                .toBeGreaterThan(40);
            expect(a.whoPractisesIt.length, `${a.techniqueId} practitioners`).toBeGreaterThan(30);
        }
        expect(MODERN_AND_ANCIENT.theTest.length).toBeGreaterThan(100);
    });

    it('NOT ALWAYS, BUT SOMETIMES: only some ancient arts carry a material upkeep', () => {
        const gated = materialGatedArts();
        expect(gated.length, 'no ancient art has an upkeep').toBeGreaterThan(0);
        expect(gated.length, 'every ancient art has an upkeep, which is a tax not a characteristic')
            .toBeLessThan(ANCIENT_ARTS.length);
        for (const a of gated) {
            expect(EXTINCT_HERB_IDS.has(a.upkeepHerbId!), `${a.techniqueId} upkeep is not extinct`)
                .toBe(true);
            // The world's supply stops somewhere, on mastery's own scale.
            expect(a.worldSupplyCeiling, `${a.techniqueId} has an upkeep and no ceiling`).not.toBeNull();
            expect(a.worldSupplyCeiling!).toBeGreaterThan(0);
            expect(a.worldSupplyCeiling!).toBeLessThan(1);
        }
        for (const a of ANCIENT_ARTS) {
            if (!a.upkeepHerbId) {
                expect(a.worldSupplyCeiling, `${a.techniqueId} has no upkeep and a supply ceiling`)
                    .toBeNull();
            }
        }
    });

    it('sorts absence into the three tiers, and puts material before choice', () => {
        expect(absenceTierOf('word-of-continuance')).toBe('no_surviving_copy');
        expect(absenceTierOf('sealed-field-of-the-shut-hour')).toBe('lost');
        expect(absenceTierOf('sixteen-thread-command')).toBe('abandoned');
        expect(absenceTierOf('cross-meridian-strike')).toBe('present');
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('extinction', () => {
    it('an extinct herb is still a real row and is never foraged', () => {
        for (const id of EXTINCT_HERB_IDS) {
            const herb = HERBS.find(h => h.id === id);
            expect(herb, `${id} is marked extinct and is not in the catalog`).toBeDefined();
            // A marker with no reason attached is the same silence somewhere
            // else - the discipline NO_SURVIVING_COPY_NOTES is held to.
            expect(EXTINCTION_NOTES[id], `${id} is extinct and does not say why`).toBeDefined();
            expect(EXTINCTION_NOTES[id].length, `${id} reason is too thin`).toBeGreaterThan(150);
            expect(FORAGEABLE_HERBS.some(h => h.id === id), `${id} is still forageable`).toBe(false);
        }
        expect(FORAGEABLE_HERBS.length).toBe(HERBS.length - EXTINCT_HERB_IDS.size);
    });

    it('nothing at any rung, in any biome, at any sample, ever draws an extinct herb', () => {
        for (const ordinal of [0, 12, 24, 36, MAX_ORDINAL]) {
            for (const h of findHerbsForOrdinal(ordinal)) {
                expect(EXTINCT_HERB_IDS.has(h.id), `${h.id} reachable at ${ordinal}`).toBe(false);
            }
        }
        for (const sample of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999999]) {
            const herb = rollHerb(MAX_ORDINAL, sample);
            expect(herb).toBeDefined();
            expect(EXTINCT_HERB_IDS.has(herb!.id), `${herb!.id} was foraged`).toBe(false);
        }
    });

    it('every lost material says what it closed, and nothing is lost for no reason', () => {
        expect(LOST_MATERIALS.length).toBe(EXTINCT_HERB_IDS.size);
        for (const m of LOST_MATERIALS) {
            expect(EXTINCT_HERB_IDS.has(m.herbId), `${m.herbId}`).toBe(true);
            for (const id of m.closedRecipeIds) expect(getRecipe(id), id).toBeDefined();
            for (const id of m.gatesTechniqueIds) expect(getTechnique(id), id).toBeDefined();
            // Something has to have been closed, or the extinction is scenery.
            const closed = m.closedRecipeIds.length + m.gatesTechniqueIds.length;
            expect(closed, `${m.herbId} went extinct and took nothing with it`).toBeGreaterThan(0);
            expect(m.closedObjectKinds.length, `${m.herbId} closed object kinds`).toBeGreaterThan(0);
        }
    });

    it('THE RECIPE SURVIVES: the formula is readable, complete, and cannot be filled', () => {
        const recipe = getRecipe(THE_THOUSAND_AUTUMN_PILL.recipeId);
        expect(recipe, 'the formula does not exist').toBeDefined();
        // Every invariant recipes.ts commits to holds. It is an ordinary
        // formula. It simply names something that is not in the world.
        expect(recipe!.ingredients.some(i => EXTINCT_HERB_IDS.has(i.itemId)))
            .toBe(true);
        expect(recipe!.ingredients.every(i => HERBS.some(h => h.id === i.itemId))).toBe(true);
        expect(recipe!.producesPillId).toBe(THE_THOUSAND_AUTUMN_PILL.pillId);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('the thousand-year medicine', () => {
    it('is an ordinary pill row, and take it away and nothing is left over', () => {
        const pill = getPill(THE_THOUSAND_AUTUMN_PILL.pillId);
        expect(pill, 'the medicine is not in the pill catalog').toBeDefined();
        expect(pill!.effect, 'the medicine invented a new effect').toBe('extend_lifespan');
        // A flat thousand at any level. The flatness is what prices it, and
        // nothing anywhere branches on who swallows it.
        expect(pill!.potency).toBe(1_000);
        // Different in kind rather than bigger: the whole rest of the lifespan
        // ladder is a bargain with a price attached, and this one is not.
        expect(pill!.toxicity, 'the medicine costs the taker something').toBe(0);
        for (const other of TECHNIQUES) void other; // no technique should be involved at all
        const otherLifespanPills = (
            ['pill-decade-lengthening', 'pill-two-decade-longevity', 'pill-century-lotus',
             'pill-thousand-year-cypress', 'pill-immortal-longevity'] as const
        ).map(id => getPill(id)!);
        for (const p of otherLifespanPills) {
            expect(p.toxicity, `${p.id} should be a bargain and is free`).toBeGreaterThan(0);
        }
        // The most valuable object the catalog can price, and not for sale.
        for (const p of otherLifespanPills) {
            expect(pill!.value).toBeGreaterThan(p.value);
        }
    });

    it('records who still holds one and who has already spent theirs', () => {
        for (const h of MEDICINE_HOLDINGS) {
            expect(HOLDER_IDS.has(h.factionId), `${h.factionId} does not exist`).toBe(true);
            expect(h.howItIsKnown.length, `${h.factionId} howItIsKnown`).toBeGreaterThan(60);
            if (h.standing === 'spent_theirs') {
                // A house that has spent its one is a different house, and the
                // difference has to be stated or the record is just a flag.
                expect(h.whatBecameOfIt, `${h.factionId} spent theirs and does not say on whom`)
                    .toBeTruthy();
            } else {
                expect(h.whatBecameOfIt, `${h.factionId} still holds one and has a disposal note`)
                    .toBeNull();
            }
        }
        expect(housesStillHoldingMedicine().length).toBeGreaterThan(0);
        expect(housesThatSpentTheirs().length, 'nobody has ever spent one').toBeGreaterThan(0);
        // The supply is fixed and small. If this list ever grows past a
        // handful, "ancient sects hold exactly one" has stopped being true.
        expect(MEDICINE_HOLDINGS.length).toBeLessThanOrEqual(8);
        expect(new Set(MEDICINE_HOLDINGS.map(h => h.factionId)).size).toBe(MEDICINE_HOLDINGS.length);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('copies, stock and stocked inheritances', () => {
    it('records which houses hold a copy and whether they can still feed it', () => {
        for (const c of ARCHIVE_COPIES) {
            expect(HOLDER_IDS.has(c.factionId), `${c.factionId} does not exist`).toBe(true);
            expect(getTechnique(c.techniqueId), `${c.techniqueId} does not exist`).toBeDefined();
            expect(ANCIENT_TECHNIQUE_IDS.has(c.techniqueId), `${c.techniqueId} is not an ancient art`)
                .toBe(true);
            expect(c.willingToPartWithIt.length, `${c.factionId} disposal`).toBeGreaterThan(40);
        }
        // THE ONE EXCEPTION: somebody holding the book and the last of the
        // material, who has told nobody. Allowed once. Sparingly means once.
        const remnants = ARCHIVE_COPIES.filter(c => c.stock === 'remnant');
        expect(remnants.length, 'more than one house is quietly holding material').toBe(1);
    });

    it('keeps stocked inheritances rare, and their ceilings honest', () => {
        expect(STOCKED_INHERITANCES.length, 'stocked inheritances have stopped being rare').toBe(1);
        for (const s of STOCKED_INHERITANCES) {
            expect(SITES.some(site => site.id === s.siteId), `${s.siteId} is not a site`).toBe(true);
            expect(getTechnique(s.techniqueId), s.techniqueId).toBeDefined();
            expect(EXTINCT_HERB_IDS.has(s.upkeepHerbId), s.upkeepHerbId).toBe(true);
            // Genuinely far, and then it stops. A stocked inheritance that
            // carried somebody to the end of an art would evaporate the
            // scarcity the whole tier rests on.
            expect(s.carriesToMastery).toBeGreaterThan(0);
            expect(s.carriesToMastery, `${s.siteId} carries somebody to the end of the art`)
                .toBeLessThan(1);
            expect(s.whyThatFar.length, `${s.siteId} does not say why that far`).toBeGreaterThan(60);
            expect(s.whenItRunsOut.length).toBeGreaterThan(60);
        }
    });

    it('provisions past what the world can supply, which is the whole point of one', () => {
        // The elder is right about the world and wrong about this cultivator.
        // If a stocked inheritance stopped at or below the public ceiling it
        // would not be defying anything.
        for (const s of STOCKED_INHERITANCES) {
            const art = ANCIENT_ARTS.find(a => a.techniqueId === s.techniqueId);
            if (!art?.worldSupplyCeiling) continue;
            expect(s.carriesToMastery, `${s.siteId} does not get past the world's supply`)
                .toBeGreaterThan(art.worldSupplyCeiling);
        }
    });
});
