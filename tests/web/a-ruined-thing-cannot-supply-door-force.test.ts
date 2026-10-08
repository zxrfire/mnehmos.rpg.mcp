/**
 * Shared door-force audit, 2026-10-03: whatTheyCouldBreakADoorWith checked only
 * custody and finite power. A stored row tagged ruined but retaining its old
 * power/custody was therefore priced as usable for public force and account
 * senders. Native ruin normally clears both fields, so this is a stored-state
 * compatibility boundary, not a claim that native ruin produces such a row.
 * isRuined is the existing stored-state authority and must win on either read.
 * Controls use an actual catalog blade and native possession transfer/ruin.
 * Broken-but-retained material is a separate damage state, never called ruined.
 * No new force math or combat durability policy is introduced here.
 */
import { expect, it } from 'vitest';
import { ARTIFACTS } from '../../src/data/cultivation/artifacts.js';
import { createWorld } from '../../src/engine/world/world-state.js';
import { transferPossession, ruin, isRuined } from '../../src/engine/world/possessions.js';
import { breakIt } from '../../src/engine/world/object-damage.js';
import { canUnmake } from '../../src/engine/cultivation/whether-a-weapon-survives-being-used.js';
import { whatTheyCouldBreakADoorWith } from '../../src/web/who-comes-to-settle-an-account.js';

function holdingARealBlade() {
    const person = { id: 'actual-force-holder', name: 'Actual holder', realmOrdinal: 0 };
    const catalog = ARTIFACTS.find(row => /blade|sabre/i.test(row.name)
        && row.power !== null && Number.isFinite(row.power) && row.power > person.realmOrdinal);
    expect(catalog, 'an existing graded catalog blade stronger than the body').toBeDefined();
    const object = transferPossession(structuredClone(catalog!), { onDay: 0,
        toHolderId: person.id, toHolderName: person.name, how: 'lent', source: 'explicit force fixture' });
    const world = createWorld({ seed: 'actual-door-force', regionCount: 0, skipPriorAges: true });
    world.objects.push(object);
    return { person, world, object };
}

it('the same held blade supplies force when usable and supplies none when actually tagged ruined', () => {
    const { person, world, object } = holdingARealBlade();
    const grade = object.power!;
    expect(whatTheyCouldBreakADoorWith(world, person)).toBe(grade);
    expect(canUnmake(whatTheyCouldBreakADoorWith(world, person), grade).reaches).toBe(true);
    // Explicit archived-row arrangement retains old columns: one ruined tag is authority.
    const ruined = { ...object, tags: [...object.tags, 'ruined'] };
    world.objects[0] = ruined;
    expect(isRuined(ruined)).toBe(true);
    expect(whatTheyCouldBreakADoorWith(world, person)).toBe(person.realmOrdinal);
    expect(canUnmake(whatTheyCouldBreakADoorWith(world, person), grade).reaches).toBe(false);
    expect(world.objects[0]!.possessorId).toBe(person.id);
    expect(world.objects[0]!.power).toBe(grade);
});

it('force follows actual possession on transfer, not the retained legal owner', () => {
    const { person, world, object } = holdingARealBlade();
    const other = { id: 'actual-new-holder', name: 'New holder', realmOrdinal: 0 };
    const transferred = transferPossession(object, { onDay: 1,
        toHolderId: other.id, toHolderName: other.name, how: 'lent' });
    world.objects[0] = transferred;
    expect(transferred.ownerId).toBe(object.ownerId);
    expect(whatTheyCouldBreakADoorWith(world, person)).toBe(person.realmOrdinal);
    expect(whatTheyCouldBreakADoorWith(world, other)).toBe(object.power);
    world.objects[0] = { ...transferred, tags: [...transferred.tags, 'ruined'] };
    expect(whatTheyCouldBreakADoorWith(world, other)).toBe(other.realmOrdinal);
});

it('native ruin and later custody transfer cannot restore ended material force', () => {
    const { person, world, object } = holdingARealBlade();
    const ended = ruin(object, { onDay: 1, source: 'actually consumed in the fixture' });
    expect(ended.power).toBeNull();
    expect(ended.possessorId).toBeNull();
    world.objects[0] = transferPossession(ended, { onDay: 2,
        toHolderId: person.id, toHolderName: person.name, how: 'found' });
    expect(isRuined(world.objects[0]!)).toBe(true);
    expect(whatTheyCouldBreakADoorWith(world, person)).toBe(person.realmOrdinal);
    expect(whatTheyCouldBreakADoorWith(null, person)).toBe(person.realmOrdinal);
});

it('retained broken material and a stronger body keep their existing distinct authority', () => {
    const { person, world, object } = holdingARealBlade();
    const broken = breakIt(object, { onDay: 1, source: 'native damage fixture' });
    expect(isRuined(broken)).toBe(false);
    world.objects[0] = broken;
    expect(whatTheyCouldBreakADoorWith(world, person)).toBe(broken.power);
    const stronger = { ...person, realmOrdinal: object.power! + 1 };
    expect(whatTheyCouldBreakADoorWith(world, stronger)).toBe(stronger.realmOrdinal);
});
