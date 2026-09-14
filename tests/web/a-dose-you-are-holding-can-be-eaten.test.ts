/**
 * The medicine that mends a cracked cultivator had no way in.
 *
 * Four grades, eleven doses placed in the world, a price model, a holdings
 * table, a live read of who is carrying one - and `applyStructuralRepair` had
 * NO CALLER ANYWHERE outside its own tests. A player who bartered a house out
 * of a Second Pour Pill was carrying an object no sentence could spend. That is
 * this repository's signature defect: a complete subsystem that compiles,
 * typechecks and is reachable by nothing. The design owner, asked whether to
 * build the road: *"obviously yes you ought to be able to eat it"*.
 *
 * WHY `swallow` CARRIED IT AND NO NEW VERB WAS ADDED. All four doses are called
 * pills, so `PILL_NOUNS` already routed "I swallow the Second Pour Pill" to
 * `consume_pill`. What `consume_pill` could not do was FIND one: it reads the
 * pouch, and a dose is an `ObjectRecord` in `state.objects` because there is no
 * counted tier for a thing there are eleven of. The whole difference between a
 * dose and a pill is which of the two places it is kept in.
 *
 * WHAT IS ARRANGED AND WHAT IS PLAYED. The rung, the break and the dose in the
 * hand are arranged - the honest route to a house parting with one is the
 * barter verb, which has its own tests, and playing to a broken crossing is the
 * fixture that goes flaky. The SWALLOWING is played and nothing about it is
 * arranged.
 *
 * THE ASSERTIONS ARE BEHAVIOUR. What the player would notice: the break is no
 * longer something the ladder sees, the dose is spent, and a dose that reaches
 * nothing is still in the hand afterwards. Nothing here pins a house, a name or
 * an id the engine chose.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { makeObject, type ObjectRecord } from '../../src/engine/world/possessions';
import {
    STRUCTURAL_REPAIR_MEDICINES,
    getStructuralRepairMedicine
} from '../../src/data/cultivation/structural-repair-medicine';
import {
    everyRepairHolding,
    significanceOfDose
} from '../../src/engine/world/who-holds-the-structural-repair-medicine';
import { brokenStatusOf } from '../../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary';
import { theThingAskedFor, thisRowIs } from '../../src/web/what-a-holder-would-take-for-it';

interface WorldAtHand { objects: ObjectRecord[] }

/** The cheap one: mends a broken foundation, reaches to the end of that realm. */
const SECOND_POUR = getStructuralRepairMedicine('repair-second-pour')!;
/** The dear one below the Lid, which reaches far higher and costs accordingly. */
const SOUL_SEATING = getStructuralRepairMedicine('repair-soul-seating')!;

async function holdingADose(
    seed: string,
    medicine: typeof SECOND_POUR,
    body: { ordinal: number; woundType: string | null }
) {
    const harness = await makeGameInWorld({ seed, worldSeed: `${seed}-w` }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db
        .prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
        .run(body.ordinal, cultivator.id);
    if (body.woundType !== null) {
        harness.repos.cultivators.addInjury(cultivator.id, {
            severity: 'crippling',
            source: 'failed_breakthrough',
            description: 'The structure did not set.',
            sustainedOnTurn: 0,
            woundType: body.woundType
        });
    }

    // One turn, so the world is loaded and the dose can be put in the hand.
    await harness.game.act('I look around');
    const world = (harness.game as { atHand: WorldAtHand }).atHand;
    world.objects.push(makeObject({
        id: `dose-${seed}`,
        name: medicine.name,
        kind: 'pill',
        significance: significanceOfDose(medicine),
        power: null,
        description: medicine.description,
        possessorId: cultivator.id,
        ownerId: cultivator.id,
        ownerName: 'Wen Shu',
        tags: ['pill', 'structural-repair', `medicine:${medicine.id}`],
        data: { medicineId: medicine.id, spent: false }
    }));

    const dose = () => (harness.game as { atHand: WorldAtHand }).atHand
        .objects.find(o => o.id === `dose-${seed}`)!;
    const body_ = () => harness.repos.cultivators.getById(cultivator.id)!;
    return { harness, dose, body: body_ };
}

describe('a dose in your own hands', () => {
    /**
     * The whole point. A break the ladder stops somebody at, and a dose whose
     * rank reaches it.
     */
    it('GIVEN a broken foundation WHEN the dose is swallowed THEN the break is gone', async () => {
        const { harness, dose, body } = await holdingADose(
            'dose-mends', SECOND_POUR,
            { ordinal: SECOND_POUR.pricedAtOrdinal, woundType: 'broken-foundation' }
        );
        expect(brokenStatusOf(body().injuries)).toBe('broken-foundation');

        const said = (await harness.game.act(`I swallow the ${SECOND_POUR.name}`)).narration ?? '';
        expect(said.length).toBeGreaterThan(0);

        // What the ladder sees is what matters: `brokenStatusesOn` skips a
        // treated row, so a break that is closed is a break the road no longer
        // stops for.
        expect(brokenStatusOf(body().injuries)).toBeNull();
        // SPENT IS NOT GONE. The row stays so that what became of one of eleven
        // objects is answerable afterwards, exactly as it is when a house
        // spends one on its own.
        expect(dose().data.spent).toBe(true);
        expect(dose().tags).toContain('spent');
    }, 300_000);

    /**
     * A dose that reaches nothing is a very expensive thing wasted, so the
     * player is told what it answers WHILE IT IS STILL IN THEIR HAND. The
     * refusal is the engine's own sentence out of `repairRefusalReason`; this
     * pins only that one arrives and that nothing was spent producing it.
     */
    it('GIVEN nothing it reaches WHEN it is swallowed THEN it is refused and still held', async () => {
        const { harness, dose, body } = await holdingADose(
            'dose-reaches-nothing', SOUL_SEATING,
            { ordinal: SOUL_SEATING.pricedAtOrdinal, woundType: null }
        );
        expect(brokenStatusOf(body().injuries)).toBeNull();

        const said = (await harness.game.act(`I swallow the ${SOUL_SEATING.name}`)).narration ?? '';
        expect(said).toMatch(new RegExp(SOUL_SEATING.name, 'i'));
        expect(dose().data.spent).not.toBe(true);
    }, 300_000);

    /**
     * And whether to waste your own property is not the engine's question. The
     * same `anyway` the wasted-pill refusal has always taken.
     */
    it('GIVEN the refusal WHEN it is said again with anyway THEN the dose goes down', async () => {
        const { harness, dose } = await holdingADose(
            'dose-anyway', SOUL_SEATING,
            { ordinal: SOUL_SEATING.pricedAtOrdinal, woundType: null }
        );
        await harness.game.act(`I swallow the ${SOUL_SEATING.name}`);
        expect(dose().data.spent).not.toBe(true);

        await harness.game.act(`I swallow the ${SOUL_SEATING.name} anyway`);
        expect(dose().data.spent).toBe(true);
    }, 300_000);
});

describe('asking a holder what they would take for a dose', () => {
    /**
     * `theThingAskedFor` read four catalogs and not this one, so "ask her what
     * she would take for a Soul-Seating Pill" came back "Nothing in the world
     * is called that a person would barter over" - a false sentence about a
     * catalog with eleven objects placed in the world off it.
     */
    it('resolves every grade of repair medicine, past the cash line', () => {
        for (const medicine of STRUCTURAL_REPAIR_MEDICINES) {
            const asked = theThingAskedFor(medicine.name, null);
            expect(asked?.id, `${medicine.name} reaches no catalog`).toBe(medicine.id);
            // The rung the price is quoted at, which is the same figure
            // `repairWeightInStones` weighs one by - so the barter bar and the
            // stone weight cannot disagree about which is the heavier ask.
            expect(asked?.carriesTo).toBe(medicine.pricedAtOrdinal);
            // NONE OF THE FOUR IS BOUGHT AT A COUNTER, whatever its terms say.
            expect(asked?.pastTheCashLine).toBe(true);
        }
    });

    /** The four grades sort by worth, which is what makes the bar mean something. */
    it('prices the grades in the order the ladder puts them in', () => {
        const rungs = [...STRUCTURAL_REPAIR_MEDICINES]
            .map(m => theThingAskedFor(m.name, null)!.carriesTo);
        expect([...rungs].sort((a, b) => a - b)).toEqual(rungs);
    });

    /**
     * THE REFUSAL USED TO LIE ABOUT TWO OF THE FOUR GRADES.
     *
     * `repairStorageModel` keeps the dear two as rows and the cheap two as a
     * count in a house's `resources` - a house keeping two of the cheap one is
     * keeping a number, not two stories. The "who else is holding one" read
     * scanned `state.objects` and nothing else, so for a Second Pour Pill or a
     * Core-Knitting Pill it reported an empty world while the register held
     * several, and told the player their problem was finding one.
     *
     * The claim pinned here is the one the refusal rests on: every grade has
     * somebody the register can name.
     */
    it('can name a holder of every grade, including the ones kept as a count', async () => {
        const harness = await makeGameInWorld({
            seed: 'dose-holders', worldSeed: 'dose-holders-w'
        }) as any;
        await harness.game.newRun('Wen Shu');
        await harness.game.act('I look around');
        const world = (harness.game as { atHand: any }).atHand;

        for (const medicine of STRUCTURAL_REPAIR_MEDICINES) {
            const holders = everyRepairHolding(world)
                .filter((row: { medicineId: string }) => row.medicineId === medicine.id);
            expect(holders.length, `nobody holds a ${medicine.name}`).toBeGreaterThan(0);

            // And for a counted grade there is deliberately no row at all, so a
            // read that scans `state.objects` alone sees an empty world. That
            // is the shape of the old defect, asserted rather than described.
            if (holders.every((row: { storage: string }) => row.storage === 'count')) {
                const rows = (world.objects as ObjectRecord[])
                    .filter(o => o.data?.medicineId === medicine.id && o.data?.spent !== true);
                expect(rows.length, `${medicine.name} should be a count, not a row`).toBe(0);
            }
        }
    }, 300_000);

    /**
     * A dose row files its catalog id under `data.medicineId`, because its own
     * id records which house's shelf it was seeded onto. `thisRowIs` knew three
     * conventions and this was the fourth, which is why a holder holding one
     * read as holding none.
     */
    it('finds a dose row by the id its own kind is filed under', () => {
        const row = { id: 'repair-dose-court-kiln-x-1', data: { medicineId: SOUL_SEATING.id } };
        expect(thisRowIs(row as never, SOUL_SEATING.id)).toBe(true);
        expect(thisRowIs(row as never, SECOND_POUR.id)).toBe(false);
    });
});
