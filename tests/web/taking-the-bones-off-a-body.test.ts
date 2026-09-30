/**
 * The bones off a dead body: a material, an act at the body, and an account.
 *
 * Owner rulings 2026-09-25: demonic cultivators craft from human bones, and the
 * bone of an ordinal 44 is a treasure; artifacts are made of beast or human
 * parts; one grade table governs every grade.
 *
 * What these assert:
 *
 *   - "take the bones", "strip the bones from the body" and "harvest the corpse"
 *     reach `gather`, the verb that already owned "harvest", and a beast's parts
 *     and a body's pockets keep their own verbs.
 *   - A body at ordinal 44 yields bone of the grade `gradeOfWhatABodyYields`
 *     gives (the one grade table's `madeFrom` column, the same call a dead
 *     beast's parts are graded by), tracked, and dearer than any earth-grade
 *     material in the catalogs. It costs a day. A second take off the same body
 *     yields nothing and costs nothing.
 *   - A righteous house whose member stood there holds it; a demonic one does
 *     not; done out of sight, a witness below your rung does not see it
 *     (`aWitnessSeesThrough`, which is `concealmentHolds` per witness).
 *   - A demonic piece at the bench takes bone where an ordinary one takes a
 *     beast's part, and the ordinary recipe never takes bone.
 *
 * Arranged, not played to: a body, and who is standing over it, are written
 * into the world directly, the way `aRecruiterOfTheHouseIsHere` stands a person
 * in the square.
 */

import { describe, expect, it } from 'vitest';
import { makeGameInWorld, type Harness } from './harness.js';
import { activeWorld } from '../../src/server/state/cultivation-world.js';
import { parseIntent } from '../../src/web/actions.js';
import { addToPouch, pouchQuantity } from '../../src/server/consolidated/cultivation-support.js';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo.js';
import { boneItemId, getBone } from '../../src/data/cultivation/bones.js';
import { gradeOfWhatABodyYields } from '../../src/engine/cultivation/a-cultivators-body-is-material.js';
import { everyIngredientThatIs } from '../../src/engine/cultivation/what-a-cauldron-will-take.js';
import { refiningOrdinalFor } from '../../src/engine/cultivation/who-can-refine-a-grade-of-medicine.js';
import { howAGradeIsStored } from '../../src/engine/world/possessions.js';
import { markDead } from '../../src/engine/world/npc-state.js';
import { theAreasOf } from '../../src/engine/world/where-in-a-place-somebody-is-standing.js';
import { whoHoldsItAgainstYou } from '../../src/engine/world/bones-off-a-body.js';
import {
    fillsTheSlot,
    whatItIsMadeOf,
    whatWouldFill
} from '../../src/data/cultivation/what-an-artifact-is-made-of.js';

const WORLD = 'bones-off-a-body';

interface AtTheBody {
    harness: Harness;
    playerId: string;
    witnessHouseId: string | null;
    bodyId: string;
}

/**
 * A player standing over a body at `deadOrdinal` that belongs to no house, with
 * nobody else in the square but, where asked, one living member of a house of
 * that alignment standing beside them.
 */
async function standingOverABody(seed: string, opts: {
    deadOrdinal: number;
    witness?: 'righteous' | 'demonic';
    playerOrdinal?: number;
}): Promise<AtTheBody> {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD });
    const { game, db } = harness;
    const { cultivator } = await game.newRun('Bai Suyin');
    if (opts.playerOrdinal !== undefined) {
        db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?').run(opts.playerOrdinal, cultivator.id);
    }
    const me = game.repos.cultivators.getById(cultivator.id)!;
    const world = (await activeWorld()).state;
    const here = game.worldPlaceOf(me)!;
    const elsewhere = world.locations.find(l => l.id !== here)!.id;
    const day = Math.floor(world.currentDay);
    const isThePlayer = (tags: readonly string[]) => tags.includes('the-player');

    for (let i = 0; i < world.npcs.length; i++) {
        const n = world.npcs[i]!;
        if (n.locationId === here && !isThePlayer(n.tags)) world.npcs[i] = { ...n, locationId: elsewhere };
    }

    const bodyAt = world.npcs.findIndex(n => n.status === 'alive' && !isThePlayer(n.tags));
    const living = world.npcs[bodyAt]!;
    world.npcs[bodyAt] = markDead({
        ...living,
        locationId: here,
        factionId: null,
        cultivation: { ...living.cultivation, realmOrdinal: opts.deadOrdinal }
    }, day, 'Killed on the road.');

    let witnessHouseId: string | null = null;
    if (opts.witness) {
        const below = (ordinal: number) => opts.playerOrdinal === undefined || ordinal < opts.playerOrdinal;
        const at = world.npcs.findIndex(n => n.status === 'alive' && !isThePlayer(n.tags)
            && n.factionId !== null && below(n.cultivation.realmOrdinal)
            && world.factions.some(f => f.id === n.factionId && f.alignment === opts.witness && f.dissolvedOnDay === null));
        const npc = world.npcs[at]!;
        witnessHouseId = npc.factionId;
        world.npcs[at] = {
            ...npc,
            locationId: here,
            activity: { kind: 'out_with_a_party', note: 'On the road.', withIds: [], sinceDay: day, untilDay: day + 150, returnTo: npc.locationId }
        };
        const place = world.locations.find(l => l.id === here)!;
        const area = theAreasOf(world, place).whereIs.get(npc.id);
        if (area) game.repos.cultivators.standIn(cultivator.id, area);
        game.theWorldMoved();
        const present = game.present(game.repos.cultivators.getById(cultivator.id)!);
        expect(present.map(row => row.id), 'the witness is not standing with the player').toContain(npc.id);
    } else {
        game.theWorldMoved();
    }
    return { harness, playerId: cultivator.id, witnessHouseId, bodyId: living.id };
}

const harvestedGrudgesHeldAgainst = (at: AtTheBody) =>
    ledgerAbout(at.harness.db, at.playerId)
        .filter(row => row.subjectId === at.playerId && row.cause === 'harvested');

describe('the sentence reaches gather', () => {
    it('reads taking the bones, stripping them and harvesting the corpse as one act at a body', () => {
        for (const said of [
            'I take the bones',
            'I strip the bones from the body',
            'I harvest the corpse',
            'I take his bones',
            'I butcher the body for its bones',
            'I strip the corpse of its bones'
        ]) {
            const plan = parseIntent(said);
            expect(plan.action, said).toBe('gather');
            expect(plan.target, said).toMatch(/\b(?:bones?|corpse|body)\b/);
        }
    });

    it('leaves a beast\'s parts to the hunt and a body\'s pockets to the taking verb', () => {
        expect(parseIntent('I hunt a beast and take the bones off it').action).toBe('hunt');
        expect(parseIntent('I strip the body').action).not.toBe('gather');
        expect(parseIntent('I harvest the spirit grass growing here').target).not.toMatch(/bones?|corpse|body/);
    });
});

describe('a body at ordinal 44', () => {
    it('yields bone of the grade the one table gives, worth a treasure, for a day, and only once', async () => {
        const at = await standingOverABody('bones-at-44', { deadOrdinal: 44 });
        const { game, db } = at.harness;
        const grade = gradeOfWhatABodyYields(44)!;
        const bone = getBone(boneItemId(grade))!;

        const daysBefore = game.state().run.elapsedDays;
        const said = (await game.act('I take the bones')).narration;
        expect(said).toContain(bone.name);
        expect(game.state().run.elapsedDays).toBeGreaterThan(daysBefore);
        expect(pouchQuantity(db, at.playerId, bone.id)).toBe(1);

        // A treasure: a row with a history, past every earth-grade material.
        expect(howAGradeIsStored(grade)).toBe('tracked');
        const row = (await activeWorld()).state.objects
            .find(o => o.data.materialId === bone.id && o.possessorId === at.playerId);
        expect(row, 'no row for a tracked bone').toBeDefined();
        expect(row!.data.deadId, 'the bone does not say whose body it came off').toBe(at.bodyId);
        const dearestEarth = Math.max(...everyIngredientThatIs({ grade: 'earth' }).map(r => r.value));
        expect(bone.value).toBeGreaterThan(dearestEarth);

        // The second take: nothing, and no day.
        const daysAfter = game.state().run.elapsedDays;
        const again = (await game.act('I strip the bones from the body')).narration;
        expect(again).toMatch(/taken before/);
        expect(pouchQuantity(db, at.playerId, bone.id)).toBe(1);
        expect(game.state().run.elapsedDays).toBe(daysAfter);
    }, 300_000);
});

describe('who holds it', () => {
    it('is a righteous house whose member saw it', async () => {
        const at = await standingOverABody('bones-righteous', { deadOrdinal: 20, witness: 'righteous' });
        await at.harness.game.act('I harvest the corpse');
        const held = harvestedGrudgesHeldAgainst(at);
        expect(held.map(row => row.holderId)).toContain(at.witnessHouseId);
    }, 300_000);

    it('is not a demonic house whose member saw it', async () => {
        const at = await standingOverABody('bones-demonic', { deadOrdinal: 20, witness: 'demonic' });
        const said = (await at.harness.game.act('I take the bones')).narration;
        expect(said).toMatch(/saw it/);
        expect(harvestedGrudgesHeldAgainst(at)).toEqual([]);
        // A counted grade's bone still says whose body it came off.
        const grade = gradeOfWhatABodyYields(20)!;
        expect(howAGradeIsStored(grade)).toBe('counted');
        const row = (await activeWorld()).state.objects
            .find(o => o.data.materialId === boneItemId(grade) && o.possessorId === at.playerId);
        expect(row?.data.deadId).toBe(at.bodyId);
    }, 300_000);

    it('is nobody, where it was done out of sight of a witness below your rung', async () => {
        const at = await standingOverABody('bones-unseen', { deadOrdinal: 20, witness: 'righteous', playerOrdinal: 24 });
        const said = (await at.harness.game.act('Hiding my presence, I take the bones')).narration;
        expect(said).toMatch(/Nobody saw it/);
        expect(harvestedGrudgesHeldAgainst(at)).toEqual([]);
    }, 300_000);

    it('reads its default off one table: righteous, neutral, demonic, and the dead one\'s own house', () => {
        const saw = (alignment: 'righteous' | 'neutral' | 'demonic') =>
            [{ id: 'w', ordinal: 5, houseId: `house-${alignment}`, alignment }];
        expect(whoHoldsItAgainstYou({ saw: saw('righteous'), theDeadsHouseId: null })[0]?.severity).toBe('grave');
        expect(whoHoldsItAgainstYou({ saw: saw('neutral'), theDeadsHouseId: null })[0]?.severity).toBe('serious');
        expect(whoHoldsItAgainstYou({ saw: saw('demonic'), theDeadsHouseId: null })).toEqual([]);
        expect(whoHoldsItAgainstYou({ saw: saw('demonic'), theDeadsHouseId: 'their-house' }))
            .toEqual([{ houseId: 'their-house', severity: 'grave', because: 'their_dead' }]);
        expect(whoHoldsItAgainstYou({ saw: [], theDeadsHouseId: 'their-house' })).toEqual([]);
    });
});

describe('a demonic piece at the bench', () => {
    it('takes bone where an ordinary piece takes a beast\'s part, and the ordinary one never takes bone', () => {
        const bone = boneItemId('earth');
        const demonic = whatItIsMadeOf('earth', true)!;
        expect(demonic.some(slot => fillsTheSlot(slot, bone))).toBe(true);
        expect(whatItIsMadeOf('earth')!.some(slot => fillsTheSlot(slot, bone))).toBe(false);
        expect(whatItIsMadeOf('heaven')!.some(slot => fillsTheSlot(slot, boneItemId('heaven')))).toBe(false);
    });

    it('is made out of bone, and refused without it naming the bone', async () => {
        const harness = await makeGameInWorld({ seed: 'bones-at-the-bench-2', worldSeed: WORLD });
        const { game, db } = harness;
        const { cultivator } = await game.newRun('Bai Suyin');
        db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?')
            .run(refiningOrdinalFor('earth') + 8, cultivator.id);
        const recipe = whatItIsMadeOf('earth', true)!;
        const rest = recipe.filter(slot => slot.from !== 'a_person').map(slot => whatWouldFill(slot)[0]!.id);
        for (const id of rest) addToPouch(db, cultivator.id, id, 'herb', 1);

        const daysBefore = game.state().run.elapsedDays;
        const refused = (await game.act('I forge an earth-grade bone blade')).narration;
        expect(refused).toMatch(/bone/i);
        expect(game.state().run.elapsedDays).toBe(daysBefore);

        const bone = boneItemId('earth');
        addToPouch(db, cultivator.id, bone, 'herb', 1);
        const made = (await game.act('I forge an earth-grade bone blade')).narration;
        expect(made).toContain(`${getBone(bone)!.name} for earth-grade bone off a dead body`);
        expect(pouchQuantity(db, cultivator.id, bone)).toBe(0);
        // The seed is one whose roll holds at these odds, so the piece exists.
        const piece = (await activeWorld()).state.objects.find(o => o.possessorId === cultivator.id
            && o.kind === 'artifact' && o.provenance.some(link => link.note.includes(getBone(bone)!.name)));
        expect(piece, 'no piece made out of the bone').toBeDefined();
    }, 300_000);
});
