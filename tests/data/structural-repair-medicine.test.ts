/**
 * The medicine that mends a cracked cultivator: the catalog, the ceilings and
 * the price.
 *
 * The two ceilings are the whole design and they are asserted here rather than
 * described anywhere: nothing made below the Lid reaches a break above the end
 * of Deity Transformation, and NOTHING reaches the crossing into Tribulation
 * Transcendence at all. The second is a rule rather than a shortage, and the
 * crossing layer states the same rule from its own side - so the two are
 * checked against each other, because a disagreement between them would be a
 * bug wearing a design decision.
 */
import { describe, it, expect } from 'vitest';
import {
    STRUCTURAL_REPAIR_MEDICINES,
    STRUCTURAL_REPAIR_HOLDINGS,
    StructuralRepairMedicineSchema,
    RepairHoldingSchema,
    getStructuralRepairMedicine
} from '../../src/data/cultivation/structural-repair-medicine.js';
import {
    NOTHING_REPAIRS_ABOVE_ORDINAL,
    ordinaryGradeCeiling,
    mendsThisBreak,
    repairRefusalReason,
    cheapestMedicineFor,
    applyStructuralRepair,
    repairCashPrice,
    repairWeightInStones,
    shareOfALifetimeAt,
    anIndividualCouldPay,
    sentDownLedgerTotals,
    readAllRepairMedicine
} from '../../src/engine/cultivation/what-structural-repair-medicine-can-reach.js';
import {
    BROKEN_STATUSES,
    REPAIRED_IN_THE_CRUCIBLE
} from '../../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary.js';

/** Every structural break, and what the world has for it. */
function coverageOfEveryBreak() {
    return BROKEN_STATUSES.map(woundKey => {
        const atOrdinal = ordinalCarrying(woundKey);
        const medicine = cheapestMedicineFor(woundKey, atOrdinal);
        return {
            woundKey,
            atOrdinal,
            medicineId: medicine?.id ?? null,
            madeBelowTheLid: medicine?.madeBelowTheLid ?? null,
            theCrucibleClearsIt: REPAIRED_IN_THE_CRUCIBLE[woundKey] ?? false
        };
    });
}
import { REALM_TIERS } from '../../src/engine/cultivation/realms.js';
import { WOUND_TYPES } from '../../src/data/cultivation/wounds.js';
import { PILLS } from '../../src/data/cultivation/pills.js';
import { InjurySchema, type Injury } from '../../src/schema/cultivation.js';
import { ordinalCarrying } from '../support/how-many-of-the-broken-are-ever-mended.js';

const openingHoldersOf = (medicineId: string) =>
    STRUCTURAL_REPAIR_HOLDINGS.filter(h => h.medicineId === medicineId);
const sentDownMedicines = () => STRUCTURAL_REPAIR_MEDICINES.filter(m => !m.madeBelowTheLid);

const GRAND_ASCENSION = REALM_TIERS.find(t => t.key === 'grand_ascension')!;
const DEITY_TRANSFORMATION = REALM_TIERS.find(t => t.key === 'deity_transformation')!;
const TRIBULATION = REALM_TIERS.find(t => t.key === 'tribulation_transcendence')!;

describe('the catalog', () => {
    it('every row satisfies the schema', () => {
        for (const m of STRUCTURAL_REPAIR_MEDICINES) {
            expect(() => StructuralRepairMedicineSchema.parse(m)).not.toThrow();
        }
        for (const h of STRUCTURAL_REPAIR_HOLDINGS) {
            expect(() => RepairHoldingSchema.parse(h)).not.toThrow();
        }
    });

    it('holds four grades and no chaos grade', () => {
        const grades = STRUCTURAL_REPAIR_MEDICINES.map(m => m.grade);
        expect(new Set(grades)).toEqual(new Set(['mortal', 'earth', 'heaven', 'immortal']));
        expect(grades).not.toContain('chaos');
    });

    it('only ever names wounds the crossing layer actually produces', () => {
        for (const m of STRUCTURAL_REPAIR_MEDICINES) {
            for (const key of m.mends) {
                expect(BROKEN_STATUSES, `${m.id} names ${key}`).toContain(key);
                expect(WOUND_TYPES.some(w => w.key === key), `${key} is in wounds.ts`).toBe(true);
            }
        }
    });

    it('every holding names a medicine that exists', () => {
        for (const h of STRUCTURAL_REPAIR_HOLDINGS) {
            expect(getStructuralRepairMedicine(h.medicineId), h.medicineId).not.toBeNull();
        }
    });

    it('reach rises with grade, so a higher grade always covers a lower one', () => {
        const order = ['mortal', 'earth', 'heaven', 'immortal'];
        const byGrade = order.map(g => STRUCTURAL_REPAIR_MEDICINES.find(m => m.grade === g)!);
        for (let i = 1; i < byGrade.length; i++) {
            expect(byGrade[i].reachesUpToOrdinal).toBeGreaterThan(byGrade[i - 1].reachesUpToOrdinal);
        }
    });
});

describe('the two ceilings, enforced rather than described', () => {
    it('nothing made below the Lid reaches past Deity Transformation', () => {
        expect(ordinaryGradeCeiling()).toBe(DEITY_TRANSFORMATION.ordinalEnd);
        for (const m of STRUCTURAL_REPAIR_MEDICINES) {
            if (!m.madeBelowTheLid) continue;
            expect(m.reachesUpToOrdinal).toBeLessThanOrEqual(DEITY_TRANSFORMATION.ordinalEnd);
        }
        // And the refusal actually fires at the first rung above it.
        const heaven = STRUCTURAL_REPAIR_MEDICINES.find(m => m.grade === 'heaven')!;
        expect(mendsThisBreak(heaven, 'partial-refinement', 29)).toBe(false);
        expect(repairRefusalReason(heaven, 'partial-refinement', 29))
            .toMatch(/refined on this side of the Lid/);
    });

    it('nothing at all reaches the crossing into Tribulation Transcendence', () => {
        expect(NOTHING_REPAIRS_ABOVE_ORDINAL).toBe(GRAND_ASCENSION.ordinalEnd);
        for (const m of STRUCTURAL_REPAIR_MEDICINES) {
            expect(m.reachesUpToOrdinal).toBeLessThanOrEqual(GRAND_ASCENSION.ordinalEnd);
            expect(mendsThisBreak(m, 'imperfect-tribulation-body', TRIBULATION.ordinalStart)).toBe(false);
        }
        expect(cheapestMedicineFor('imperfect-tribulation-body', TRIBULATION.ordinalStart)).toBeNull();
    });

    it('agrees with the crossing layer about which break has no answer', () => {
        // The one break the crucible does not clear must also be the one no
        // medicine reaches. If these ever disagree, one of them is wrong.
        for (const [key, clearedByCrossing] of Object.entries(REPAIRED_IN_THE_CRUCIBLE)) {
            const reachable = cheapestMedicineFor(key, ordinalCarrying(key)) !== null;
            expect(reachable, `${key}: crucible ${clearedByCrossing}, medicine ${reachable}`)
                .toBe(clearedByCrossing);
        }
    });

    /**
     * THE AXIS MOVED FROM THE NAMED BREAK TO THE RANK, AND THIS IS WHERE IT
     * SHOWS.
     *
     * This asserted that a dose refuses anything outside `BROKEN_STATUSES`, and
     * `incomplete-cultivation` was in the list of things it must turn away. The
     * design owner ruled that a dose repairs EVERY permanent injury at its rank,
     * so that row is now on the other side of this test rather than gone from
     * it: the premise was overturned, not the assertion weakened.
     *
     * What did not move is the thing the test was really protecting: one of
     * eleven objects in the world is not spent on a wound that closes by itself.
     */
    it('refuses a wound that closes on its own, and answers one that does not', () => {
        const earth = STRUCTURAL_REPAIR_MEDICINES.find(m => m.grade === 'earth')!;
        for (const key of ['heart-demon', 'torn-meridians', null]) {
            expect(mendsThisBreak(earth, key, 17), `${key} is not permanent`).toBe(false);
        }
        // Permanent, inside this grade's reach, and not on its `mends` list -
        // which used to be the refusal and is now the ruling.
        expect(WOUND_TYPES.find(w => w.key === 'incomplete-cultivation')?.permanent).toBe(true);
        expect(earth.mends).not.toContain('incomplete-cultivation');
        expect(mendsThisBreak(earth, 'incomplete-cultivation', 17)).toBe(true);
        // And the rank is still the limit: the same wound on a bigger body is
        // past what this grade reaches.
        expect(mendsThisBreak(earth, 'incomplete-cultivation', earth.reachesUpToOrdinal + 1))
            .toBe(false);
    });

    /**
     * A RULING, NOT AN INFERENCE, AND THE LITERAL READING WAS THE OTHER THING.
     *
     * "Repairs all permanent injuries at that rank" taken literally had a
     * medicine that dissolves and re-lays a cultivation base closing a rooted
     * heart demon. Asked directly, the design owner: *"no a repair dose does not
     * reach wounds"* of the mind. So the axis is rank and the bound is
     * `woundNature` - `cleanse_deviation` is the line that exists for the mind.
     */
    it('works on a body and not on a mind, whatever the rank says', () => {
        const mental = WOUND_TYPES.filter(w => w.permanent && w.nature !== 'physical');
        expect(mental.length, 'no permanent wound of the mind to check the bound against')
            .toBeGreaterThan(0);
        for (const medicine of STRUCTURAL_REPAIR_MEDICINES) {
            for (const wound of mental) {
                expect(
                    mendsThisBreak(medicine, wound.key, 0),
                    `${medicine.id} reached ${wound.key}`
                ).toBe(false);
            }
        }
        // And a physical one at the same rung still answers, or the bound is
        // just a broken predicate wearing a ruling.
        const physical = WOUND_TYPES.find(w =>
            w.permanent && w.nature === 'physical' && w.key !== 'burnt-span')!;
        expect(cheapestMedicineFor(physical.key, 0)).not.toBeNull();
    });

    /**
     * AND IT DOES NOT HAND BACK YEARS, WHICH IS THE SECOND RULING AND THE
     * SECOND TIME THE ROW WAS ALREADY RIGHT.
     *
     * `burnt-span` is physical and permanent, so the rank rule reached it and
     * should not have. The design owner: *"it doesn't hand back burnt lifespan,
     * that's what that immortal pill is for."* The row has said so since it was
     * written - *"Nothing below the Lid returns spent years. The rung above
     * returns them, which is exactly the trap"* - and nothing was reading it.
     */
    it('does not return a spent span, at any rung', () => {
        const span = WOUND_TYPES.find(w => w.key === 'burnt-span')!;
        expect([span.permanent, span.nature], 'burnt-span stopped being a permanent physical wound')
            .toEqual([true, 'physical']);
        for (const medicine of STRUCTURAL_REPAIR_MEDICINES) {
            expect(mendsThisBreak(medicine, span.key, 0), `${medicine.id} returned a spent span`)
                .toBe(false);
        }
        expect(cheapestMedicineFor(span.key, 0)).toBeNull();
        // What does answer it is the other line, and it is not empty.
        expect(PILLS.some(p => p.effect === 'extend_lifespan')).toBe(true);
    });

    it('mends the break it is for, and drops the wound rather than treating it', () => {
        const earth = STRUCTURAL_REPAIR_MEDICINES.find(m => m.grade === 'earth')!;
        // Built through the schema rather than asserted into shape. The cast
        // that used to stand here was hiding a source of 'breakthrough', which
        // is not one an injury can have - the enum reads `failed_breakthrough`
        // - along with a missing id and turn. Nothing caught it because
        // `applyStructuralRepair` reads only `woundType`.
        const injuries: Injury[] = [
            InjurySchema.parse({
                id: '00000000-0000-4000-8000-000000000001',
                severity: 'crippling', source: 'failed_breakthrough', sustainedOnTurn: 0,
                treated: false, description: 'x', woundType: 'cracked-core'
            }),
            InjurySchema.parse({
                id: '00000000-0000-4000-8000-000000000002',
                severity: 'minor', source: 'combat', sustainedOnTurn: 0,
                treated: false, description: 'y', woundType: 'torn-meridians'
            })
        ];
        const after = applyStructuralRepair(injuries, earth, 'cracked-core', 17);
        expect(after.map(i => i.woundType)).toEqual(['torn-meridians']);
        // Out of reach: the dose is gone and the person is where they were.
        expect(applyStructuralRepair(injuries, earth, 'unfulfilled-ascension', 37)).toHaveLength(2);
    });

    it('covers every break the crossing layer produces, or says plainly that it does not', () => {
        const coverage = coverageOfEveryBreak();
        expect(coverage).toHaveLength(BROKEN_STATUSES.length);
        const uncovered = coverage.filter(c => c.medicineId === null);
        expect(uncovered.map(c => c.woundKey)).toEqual(['imperfect-tribulation-body']);
        // Everything above the ordinary ceiling is answerable only by an
        // object nobody on this side can make.
        for (const row of coverage) {
            if (row.atOrdinal <= ordinaryGradeCeiling()) continue;
            if (row.medicineId === null) continue;
            expect(row.madeBelowTheLid, row.woundKey).toBe(false);
        }
    });
});

describe('the price', () => {
    it('is never within reach of the patient at their own rung', () => {
        for (const m of STRUCTURAL_REPAIR_MEDICINES) {
            // Twelve lifetimes of their own accumulation. Nobody saves for one.
            expect(shareOfALifetimeAt(m, m.pricedAtOrdinal)).toBeGreaterThan(10);
        }
    });

    it('puts the middle grade at the top of the ladder and nowhere else', () => {
        const heaven = STRUCTURAL_REPAIR_MEDICINES.find(m => m.grade === 'heaven')!;
        // Not payable by a Deity Transformation cultivator out of a whole life.
        expect(anIndividualCouldPay(heaven, DEITY_TRANSFORMATION.ordinalStart)).toBe(false);
        // Payable at Grand Ascension, and it takes a real share of everything
        // they will ever have - which is what "it would hurt" means as a number.
        expect(anIndividualCouldPay(heaven, GRAND_ASCENSION.ordinalStart)).toBe(true);
        const share = shareOfALifetimeAt(heaven, GRAND_ASCENSION.ordinalStart);
        expect(share).toBeGreaterThan(0.2);
        expect(share).toBeLessThan(1);
    });

    it('draws the cash line where the barter line is, and not somewhere else', () => {
        for (const m of STRUCTURAL_REPAIR_MEDICINES) {
            const cash = repairCashPrice(m);
            expect(cash === null).toBe(m.terms !== 'private_sale');
            if (cash !== null) expect(cash).toBe(repairWeightInStones(m));
        }
        // The sent-down grade never has a price, at any figure.
        for (const m of sentDownMedicines()) {
            expect(repairCashPrice(m)).toBeNull();
            expect(m.terms).toBe('favour_or_singular_thing');
        }
    });

    it('rises strictly with reach', () => {
        const rows = readAllRepairMedicine();
        for (let i = 1; i < rows.length; i++) {
            expect(rows[i].weightInStones).toBeGreaterThan(rows[i - 1].weightInStones);
            expect(rows[i].reachesUpToOrdinal).toBeGreaterThan(rows[i - 1].reachesUpToOrdinal);
        }
    });
});

describe('the sent-down ledger', () => {
    it('reconciles, so a holdings edit cannot quietly lose one', () => {
        const ledger = sentDownLedgerTotals();
        expect(ledger.reconciles).toBe(true);
        expect(ledger.standing + ledger.spent + ledger.unaccounted).toBe(ledger.everArrived);
    });

    it('is held only by the bodies with somebody above the Lid still answering', () => {
        const holders = sentDownMedicines()
            .flatMap(m => openingHoldersOf(m.id))
            .map(h => h.factionId);
        expect(new Set(holders)).toEqual(new Set([
            'apex-earth-vein-tower',
            'apex-myriad-course-hall',
            'sect-azure-cloud-pavilion'
        ]));
    });

    it('is a small number, which is the entire design', () => {
        expect(sentDownLedgerTotals().standing).toBeLessThan(12);
    });
});

describe('who holds the grade that reaches Deity Transformation', () => {
    it('is only apexes and one court, because nobody else could pay for one', () => {
        const heaven = STRUCTURAL_REPAIR_MEDICINES.find(m => m.grade === 'heaven')!;
        const holders = openingHoldersOf(heaven.id).map(h => h.factionId);
        for (const id of holders) {
            expect(id.startsWith('apex-') || id.startsWith('court-') || id === 'sect-azure-cloud-pavilion',
                `${id} holds the Deity Transformation repair`).toBe(true);
        }
        // And exactly one of them is a body that might ever sell.
        const sellers = openingHoldersOf(heaven.id).filter(h => h.factionId.startsWith('court-'));
        expect(sellers).toHaveLength(1);
    });
});
