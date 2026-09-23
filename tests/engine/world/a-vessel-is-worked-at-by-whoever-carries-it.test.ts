/**
 * A cauldron or a refining furnace counts for whoever is carrying it, and every
 * house keeps both.
 *
 *   THE READ     the best vessel of a kind somebody carries is the one that adds
 *                most for their hand, a lent one included; a vessel above their
 *                rung does not answer; a ruined one is not there
 *   THE ODDS     a worked thing is rolled at the yard's figure for a hull of its
 *                grade, and the furnace adds its grade's value on top; a slip is
 *                not rolled
 *   THE HOUSES   every house keeps plain cauldrons and plain refining furnaces in
 *                the rooms those crafts are done in; a graded vessel no better
 *                at what its best hand can work; and a house focused on the craft
 *                keeps more of them: twice the cupboard and a second graded vessel
 *
 * Red-checked: see the report that landed this file.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
    WHAT_A_CAULDRON_ADDS,
    whatThisVesselAddsFor
} from '../../../src/engine/cultivation/what-you-refine-in.js';
import {
    canRefineGrade,
    refiningOrdinalFor
} from '../../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { makeObject, ruin } from '../../../src/engine/world/possessions.js';
import { theBestVesselToHand } from '../../../src/engine/world/the-vessel-somebody-works-at.js';
import {
    mintAMadeThing,
    theOddsTheWorkHolds
} from '../../../src/engine/social-leverage/whether-the-work-holds.js';
import { successRateFor } from '../../../src/engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import { CONVEYANCE_RECIPES } from '../../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import {
    howManyGradedVesselsAHouseKeeps,
    isFocusedOnTheCraftOf,
    theBestHandOnTheRoll,
    theGradeOfTheVesselAHouseKeeps
} from '../../../src/engine/world/what-a-house-refines-in.js';
import { bestFurnaceAHouseCouldKeep } from '../../../src/engine/world/what-a-house-keeps-in-its-treasury.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { loadCultivationCatalog, type WorldCatalog } from '../../../src/engine/world/catalog.js';
import { purposeOf } from '../../../src/engine/world/architecture.js';
import type { TechniqueGrade } from '../../../src/schema/cultivation.js';

const CORE = refiningOrdinalFor('earth');

function aVessel(id: string, tag: string, grade: TechniqueGrade, possessorId: string) {
    return makeObject({
        id, name: id, kind: 'artifact', possessorId, ownerId: 'sect-somebody',
        tags: [tag, `grade:${grade}`], data: { grade }
    });
}

describe('the vessel somebody works at', () => {
    it('is the one they carry that adds most for their hand, lent or not', () => {
        const objects = [
            aVessel('clay', 'cauldron', 'mortal', 'p'),
            aVessel('lent-earth', 'cauldron', 'earth', 'p'),
            aVessel('someone-elses', 'cauldron', 'heaven', 'q'),
            aVessel('a-furnace', 'refining_furnace', 'earth', 'p')
        ];
        const best = theBestVesselToHand(objects, 'p', 'cauldron', CORE);
        expect(best?.objectId).toBe('lent-earth');
        expect(best?.adds).toBe(WHAT_A_CAULDRON_ADDS.earth);
        // A furnace is not a cauldron, and nobody works at a thing somebody else holds.
        expect(theBestVesselToHand(objects, 'p', 'refining_furnace', CORE)?.objectId).toBe('a-furnace');
        expect(theBestVesselToHand(objects, 'nobody', 'cauldron', CORE)).toBeNull();
    });

    it('does not answer a hand below its rung, and a ruined one is not there', () => {
        const heaven = aVessel('heaven', 'cauldron', 'heaven', 'p');
        const earth = aVessel('earth', 'cauldron', 'earth', 'p');
        expect(theBestVesselToHand([heaven, earth], 'p', 'cauldron', CORE)?.objectId).toBe('earth');
        const gone = ruin(earth, { onDay: 1, source: 'a test', note: 'broken' });
        expect(theBestVesselToHand([gone], 'p', 'cauldron', CORE)).toBeNull();
    });
});

describe('whether the work holds', () => {
    it('reads the yard\'s own figure for a hull of the grade, and the furnace adds on top', () => {
        const ask = { named: 'a sword', grade: 'earth' as const };
        const bare = theOddsTheWorkHolds(ask, CORE, null);
        const yard = Math.max(...CONVEYANCE_RECIPES.filter(r => r.grade === 'earth').map(r => successRateFor(r, CORE)));
        expect(bare.rolled).toBe(true);
        expect(bare.chance).toBeCloseTo(yard, 10);
        const atAFurnace = theOddsTheWorkHolds(ask, CORE, 'earth');
        expect(atAFurnace.fromTheVessel).toBe(whatThisVesselAddsFor('refining_furnace', 'earth', CORE));
        expect(atAFurnace.chance).toBeGreaterThan(bare.chance);
        // Below its rung the furnace does not answer.
        expect(theOddsTheWorkHolds(ask, CORE, 'heaven').fromTheVessel).toBe(0);
    });

    it('does not roll a slip', () => {
        const odds = theOddsTheWorkHolds({ grade: 'mortal', slip: 'a_strike' }, 5, 'earth');
        expect(odds.rolled).toBe(false);
        expect(odds.chance).toBe(1);
    });

    it('mints a slip as a talisman and anything else as a made artifact at the maker\'s rung', () => {
        const maker = { id: 'm', name: 'Maker', ordinal: 20 };
        const slip = mintAMadeThing({ id: 's', ask: { named: 'a talisman', grade: 'mortal', slip: 'a_strike' }, maker, onDay: 3 });
        expect(slip.tags).toContain('talisman');
        const blade = mintAMadeThing({ id: 'b', ask: { named: 'a blade', grade: 'earth' }, maker, onDay: 3 });
        expect(blade.tags).toContain('made');
        expect(blade.power).toBe(20);
    });
});

describe('what a house refines in', () => {
    it('keeps its graded vessel at what its best hand can work, focused or not', () => {
        const keep = (bestHand: number) =>
            theGradeOfTheVesselAHouseKeeps({ bestHand, bestItCouldKeep: bestFurnaceAHouseCouldKeep });
        expect(keep(refiningOrdinalFor('heaven'))).toBe('heaven');
        expect(keep(CORE)).toBe('earth');
        expect(keep(CORE - 1)).toBeNull();
        expect(keep(-1)).toBeNull();
        expect(howManyGradedVesselsAHouseKeeps(true)).toBeGreaterThan(howManyGradedVesselsAHouseKeeps(false));
    });

    it('names the two focused houses by their catalog rows', () => {
        expect(isFocusedOnTheCraftOf('sect-cinnabar-crucible-sect', 'cauldron')).toBe(true);
        expect(isFocusedOnTheCraftOf('sect-cinnabar-crucible-sect', 'refining_furnace')).toBe(false);
    });

    describe('in a seeded world', () => {
        let catalog: WorldCatalog;
        let state: ReturnType<typeof seedWorld>['state'];
        beforeAll(async () => {
            catalog = await loadCultivationCatalog();
            state = seedWorld({ seed: 'vessels-in-their-rooms', catalog }).state;
        }, 120_000);

        it('every house that keeps clay cauldrons keeps plain refining furnaces in its Artifact Refining Hall', () => {
            const byId = new Map(state.locations.map(row => [row.id, row]));
            const cauldrons = state.objects.filter(row => row.id.startsWith('cauldrons-plain-'));
            expect(cauldrons.length).toBeGreaterThan(1);
            for (const lot of cauldrons) {
                const houseId = lot.ownerId!;
                const furnaces = state.objects.find(row => row.id === `refining_furnaces-plain-${houseId}`);
                expect(furnaces, houseId).toBeDefined();
                const where = furnaces!.locationId === null ? undefined : byId.get(furnaces!.locationId);
                expect(where ? purposeOf(where) : null, houseId).toBe('artifact_refining_hall');
            }
        });

        it('no graded vessel is past what the house\'s own best hand can work', () => {
            const graded = state.objects.filter(row => /^(?:furnace-|vessel-)/.test(row.id));
            expect(graded.length).toBeGreaterThan(0);
            for (const row of graded) {
                // The house off the row's own id: a house can have bestowed it since.
                const best = theBestHandOnTheRoll(state, row.id.replace(/^(?:furnace-|vessel-refining-furnace-|vessel-(?:cauldron|refining_furnace)-second-)/, ''));
                expect(canRefineGrade(row.data.grade as TechniqueGrade, best), row.id).toBe(true);
            }
        });

        it('the house whose trade is medicine keeps twice the cauldrons it keeps furnaces', () => {
            const houseId = 'sect-cinnabar-crucible-sect';
            const count = (id: string) => Number(state.objects.find(row => row.id === id)?.data.quantity ?? 0);
            const cauldrons = count(`cauldrons-plain-${houseId}`);
            expect(cauldrons).toBeGreaterThan(0);
            expect(cauldrons).toBe(2 * count(`refining_furnaces-plain-${houseId}`));
        });

        it('every house with a hand past mortal grade keeps a graded vessel of each kind, and the focused house a second cauldron', () => {
            let houses = 0;
            for (const lot of state.objects.filter(row => row.id.startsWith('cauldrons-plain-'))) {
                const houseId = lot.id.slice('cauldrons-plain-'.length);
                if (theBestHandOnTheRoll(state, houseId) < CORE) continue;
                houses++;
                expect(state.objects.some(row => row.id === `furnace-${houseId}`), houseId).toBe(true);
                expect(state.objects.some(row => row.id === `vessel-refining-furnace-${houseId}`), houseId).toBe(true);
            }
            expect(houses).toBeGreaterThan(1);
            const crucible = 'sect-cinnabar-crucible-sect';
            expect(theBestHandOnTheRoll(state, crucible)).toBeGreaterThanOrEqual(CORE);
            expect(state.objects.some(row => row.id === `vessel-cauldron-second-${crucible}`)).toBe(true);
            expect(state.objects.some(row => row.id === `vessel-refining_furnace-second-${crucible}`)).toBe(false);
        });
    });
});
