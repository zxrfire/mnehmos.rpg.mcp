/**
 * Asking your own house for a structural repair dose.
 *
 * THE STANDARD HAD NO ASKER. `willTheHouseSpendOnThem` - blood, the house's
 * chosen, or a century of its investment - was written beside the live holdings
 * and read only by its test, so a member whose foundation broke could barter a
 * stranger's house out of a dose and could not ask their own, which is the one
 * door the catalog says the medicine goes through: *"it is spent on the house's
 * own."* `asking-your-house-for-a-repair-dose.ts` is the ask, reached by the
 * request and the petition a player already makes.
 *
 * WHAT IS ARRANGED AND WHAT IS PLAYED. The break, the rung, the place on the
 * roll and - in the second case - the blood tie are arranged, the way the dose
 * tests arrange a dose in the hand: playing to a broken crossing is the fixture
 * that goes flaky. The ASK is played, and so is whatever the house does.
 *
 * THE ASSERTIONS ARE BEHAVIOUR: whether the break is still something the ladder
 * sees, and whether the house's shelf is one dose lighter. The house, the dose
 * and the seniors are read off the world rather than pinned.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { getSect } from '../../src/data/cultivation/sects';
import { getStructuralRepairMedicine } from '../../src/data/cultivation/structural-repair-medicine';
import { brokenStatusOf } from '../../src/engine/cultivation/what-goes-wrong-at-a-realm-boundary';
import { elderRungOf } from '../../src/engine/cultivation/leadership';
import { repairMedicineHeldBy } from '../../src/engine/world/who-holds-the-structural-repair-medicine';
import type { WorldState } from '../../src/engine/world/world-state';

/** A house the catalog seeds with Second Casting Pills. */
const HOUSE = getSect('sect-cinnabar-crucible-sect')!;
const SECOND_CASTING = getStructuralRepairMedicine('repair-second-pour')!;

async function aBrokenMemberOfTheHouse(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: `${seed}-w` }) as any;
    const { cultivator } = await harness.game.newRun('Wen Shu');
    // At the house's own floor, so the house's people stand above them: an
    // ordinary disciple, not one of its chosen.
    const ordinal = Math.max(HOUSE.admissionOrdinal, 1);
    harness.db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?').run(ordinal, cultivator.id);
    harness.repos.cultivators.addInjury(cultivator.id, {
        severity: 'crippling',
        source: 'failed_breakthrough',
        description: 'The foundation set wrong.',
        sustainedOnTurn: 0,
        woundType: 'broken-foundation'
    });
    harness.repos.sects.addMember(HOUSE.id, cultivator.id, 0);
    await harness.game.act('I look around');
    const world = () => (harness.game as { atHand: WorldState }).atHand;
    const onTheShelf = () => repairMedicineHeldBy(world(), HOUSE.id)
        .reduce((n, row) => n + row.count, 0);
    const body = () => harness.repos.cultivators.getById(cultivator.id)!;
    return { harness, cultivator, world, onTheShelf, body };
}

describe('asking your own house for a repair dose', () => {
    it('GIVEN an ordinary disciple of the house WHEN they ask for one THEN the box stays shut, kindly', async () => {
        const { harness, world, onTheShelf, body } = await aBrokenMemberOfTheHouse('repair-ask-ordinary');
        // The arrangement holds: the house's own people stand above them, so
        // they are not one of its chosen.
        const above = world().npcs.filter(n => n.status === 'alive' && n.factionId === HOUSE.id
            && n.cultivation.realmOrdinal > body().realmOrdinal);
        expect(above.length, 'the house has fewer than three people above the asker').toBeGreaterThanOrEqual(3);
        const before = onTheShelf();
        expect(before).toBeGreaterThan(0);

        const said = (await harness.game.act(`I ask my sect for a ${SECOND_CASTING.name}`)).narration ?? '';

        expect(said).toMatch(/box will not be opened/i);
        expect(brokenStatusOf(body().injuries)).toBe('broken-foundation');
        expect(onTheShelf()).toBe(before);
    }, 300_000);

    it('GIVEN the child of one of its elders WHEN they ask THEN the house spends a dose and the break closes', async () => {
        const { harness, cultivator, world, onTheShelf, body } = await aBrokenMemberOfTheHouse('repair-ask-blood');
        const elderRung = elderRungOf(HOUSE.ranks.length);
        const senior = world().npcs.find(n => n.status === 'alive' && n.factionId === HOUSE.id
            && n.factionRankIndex >= elderRung);
        expect(senior, 'the house has nobody at its elder rung').toBeDefined();
        senior!.relationships.push({
            targetId: cultivator.id, targetName: cultivator.name, kind: 'child', standing: 0.8,
            note: 'Their child.', sinceDay: 0, lastChangedDay: 0, factIds: [], inheritedFromId: null
        } as never);
        const before = onTheShelf();

        await harness.game.act(`I ask my sect for a ${SECOND_CASTING.name}`);

        expect(brokenStatusOf(body().injuries)).toBeNull();
        expect(onTheShelf()).toBe(before - 1);
    }, 300_000);

    it('GIVEN somebody on no roll WHEN they ask THEN it is not theirs to ask', async () => {
        const harness = await makeGameInWorld({ seed: 'repair-ask-nobody', worldSeed: 'repair-ask-nobody-w' }) as any;
        const { cultivator } = await harness.game.newRun('Wen Shu');
        harness.repos.cultivators.addInjury(cultivator.id, {
            severity: 'crippling', source: 'failed_breakthrough', description: 'The foundation set wrong.',
            sustainedOnTurn: 0, woundType: 'broken-foundation'
        });
        const said = (await harness.game.act(`I ask my sect for a ${SECOND_CASTING.name}`)).narration ?? '';
        expect(said).toMatch(/not ours|nobody's/i);
        expect(brokenStatusOf(harness.repos.cultivators.getById(cultivator.id)!.injuries)).toBe('broken-foundation');
    }, 300_000);
});
