/**
 * Stealing a carriage or a spirit boat, and what the world then holds.
 *
 * WHY THIS EXISTS
 * ---------------
 * `whatALiftTook` moved SPIRIT STONES and nothing else, and said so in its own
 * docstring: taking a tracked thing off a person "is a different event and is
 * not done here... That is worth building and it is worth building
 * deliberately." So the largest things anybody owns were unstealable at every
 * phrasing, while a purse was not.
 *
 * Its two neighbours were both already right and neither reached this.
 * `takeFromYourOwnHouse` takes off a shelf and only a house you are on the roll
 * of - its own refusal says "what you are describing is robbing strangers".
 * Coercion takes everything a beaten person is CARRYING, and a craft is never
 * carried: `mintCraft` leaves `possessorId` null on every one of them and
 * records where it is in `data.mooredAt`, so a possession query sees no craft
 * anywhere in the world.
 *
 * WHAT IS BEING PINNED
 * --------------------
 * Three facts, and the second is the one the whole design rests on:
 *
 *   possession moves          the thief is holding it
 *   OWNERSHIP DOES NOT        `transfersOwnership` defaults false, and
 *                             `items.md` is emphatic: a thief who becomes an
 *                             owner by the act of theft erases the only thread
 *                             anybody could have followed
 *   the mooring follows       a hull whose possessor moved and whose
 *                             `mooredAt` did not is a register saying the boat
 *                             is at its owner's dock and in the thief's hands
 *                             at once
 *
 * BOTH SEEDS ARE PINNED, and the played case sweeps several run seeds against
 * one world: whether a lift LANDS is `resolveAttempt`'s roll, and asserting an
 * outcome off a single draw would be pinning a coincidence in the way this
 * repo has had to correct twice.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import {
    liftIt,
    whatIsWithinReachOf,
    whichThingTheyMeant
} from '../../src/web/object-theft.js';
import { mintCraft } from '../../src/engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import { getConveyanceRecipe } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { makeObject, type ObjectRecord } from '../../src/engine/world/possessions.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';

const WORLD = 'a-boat-changes-hands';

function aSpiritBoatOwnedBy(ownerId: string, ownerName: string, mooredAt: string): ObjectRecord {
    const recipe = getConveyanceRecipe('build-spirit-boat')!;
    return mintCraft(recipe, {
        id: `obj-craft-${ownerId}-probe`,
        name: recipe.name,
        ownerId,
        ownerName,
        wrightId: ownerId,
        wrightName: ownerName,
        // The rung that makes it a tracked individual at all. Below heaven
        // grade there is no "which one" to steal.
        bestHandOrdinal: 30,
        onDay: 0,
        mooredAt
    })!;
}

describe('the sentence names the thing and the person', () => {
    it('aims the theft at the owner and carries what was named', () => {
        const plan = parseIntent('I steal the spirit boat from Wei Lanya');
        expect(plan.action).toBe('interact');
        expect(plan.intent).toBe('steal');
        // The person, because `resolveAttempt` prices a theft against whoever
        // it is taken from.
        expect(plan.target).toBe('Wei Lanya');
        // And the thing, which used to be thrown away by
        // `namesTheThingRatherThanThePerson` and is what says WHICH of their
        // things is being taken.
        expect((plan.topic ?? '').toLowerCase()).toContain('spirit boat');
    });

    it('reads the possessive form the same way', () => {
        const plan = parseIntent("I steal Wei Lanya's carriage");
        expect(plan.intent).toBe('steal');
        expect(plan.target).toBe('Wei Lanya');
        expect((plan.topic ?? '').toLowerCase()).toContain('carriage');
    });

    it('does not take a sentence about riding one', () => {
        // The two verbs share every noun and are separated by the verb alone.
        expect(parseIntent('I take the carriage to Iron Gate').action).toBe('ride');
        expect(parseIntent('I buy a carriage').action).toBe('buy');
        expect(parseIntent('I build a carriage').action).toBe('craft');
    });
});

describe('what is within reach of somebody standing here', () => {
    const boat = aSpiritBoatOwnedBy('npc-1', 'Wei Lanya', 'Iron Gate');

    it('sees a craft moored where you are, which a possession query cannot', () => {
        // `mintCraft` leaves the possessor null forever, so this row is
        // invisible to every reader that asks who is holding what.
        expect(boat.possessorId).toBeNull();
        const world = { objects: [boat] } as never;

        expect(whatIsWithinReachOf(world, 'npc-1', 'Iron Gate')).toHaveLength(1);
        expect(whatIsWithinReachOf(world, 'npc-1', 'Iron Gate')[0].because).toBe('moored');
    });

    it('does not see one moored somewhere else', () => {
        const world = { objects: [boat] } as never;
        expect(whatIsWithinReachOf(world, 'npc-1', 'Clear River Ford')).toEqual([]);
        expect(whatIsWithinReachOf(world, 'npc-1', null)).toEqual([]);
    });

    it('does not see somebody else\'s', () => {
        const world = { objects: [boat] } as never;
        expect(whatIsWithinReachOf(world, 'npc-2', 'Iron Gate')).toEqual([]);
    });

    it('leaves the counted tier alone, which has no row to take', () => {
        const mundane = makeObject({
            id: 'obj-cart', name: 'A drawn carriage', kind: 'artifact',
            significance: 'mundane', ownerId: 'npc-1', data: { mooredAt: 'Iron Gate' }
        });
        const world = { objects: [mundane] } as never;
        expect(whatIsWithinReachOf(world, 'npc-1', 'Iron Gate')).toEqual([]);
    });

    it('resolves the name the game printed', () => {
        const within = whatIsWithinReachOf({ objects: [boat] } as never, 'npc-1', 'Iron Gate');
        expect(whichThingTheyMeant(within, 'spirit boat')?.object.id).toBe(boat.id);
        expect(whichThingTheyMeant(within, 'A spirit boat')?.object.id).toBe(boat.id);
        expect(whichThingTheyMeant(within, 'the manual')).toBeNull();
    });
});

describe('the lift itself', () => {
    const boat = aSpiritBoatOwnedBy('npc-1', 'Wei Lanya', 'Iron Gate');

    it('moves possession, leaves ownership, and brings the mooring with it', () => {
        const within = whatIsWithinReachOf({ objects: [boat] } as never, 'npc-1', 'Iron Gate');
        const lifted = liftIt(within[0], {
            thiefId: 'player', thiefName: 'Shen Wu', fromName: 'Wei Lanya',
            onDay: 400, here: 'Clear River Ford'
        });

        expect(lifted.object.possessorId).toBe('player');
        // The whole design. `items.md`: a thief who becomes an owner by the act
        // of theft erases the only thread anybody could have followed.
        expect(lifted.object.ownerId).toBe('npc-1');
        expect(lifted.object.knownOwnershipBy).toContain('npc-1');
        expect(lifted.object.data.mooredAt).toBe('Clear River Ford');

        const last = lifted.object.provenance[lifted.object.provenance.length - 1];
        expect(last.how).toBe('stolen');
        expect(last.previousHolderId).toBeNull();
        expect(lifted.object.provenance.length).toBe(boat.provenance.length + 1);
        // Severity is `howBadlyThisIsMissed`, off the row's own significance,
        // which is the same reading the house path takes.
        expect(lifted.severity).toBe('serious');
    });

    it('does not mutate the row it was handed', () => {
        const within = whatIsWithinReachOf({ objects: [boat] } as never, 'npc-1', 'Iron Gate');
        liftIt(within[0], {
            thiefId: 'player', thiefName: 'Shen Wu', fromName: 'Wei Lanya',
            onDay: 400, here: 'Clear River Ford'
        });
        expect(boat.possessorId).toBeNull();
        expect(boat.data.mooredAt).toBe('Iron Gate');
    });
});

describe('played: a boat changes hands', () => {
    // `ADMIN_MODE` is read at call time, so a test can turn it on and put it
    // back. Forcing is the scaffolding here and not the subject; see below.
    let adminBefore: string | undefined;
    beforeAll(() => {
        adminBefore = process.env.ADMIN_MODE;
        process.env.ADMIN_MODE = 'true';
    });
    afterAll(() => {
        if (adminBefore === undefined) delete process.env.ADMIN_MODE;
        else process.env.ADMIN_MODE = adminBefore;
    });

    /**
     * `ADMIN interact <the player's own sentence>` runs the ordinary verb with
     * the one uncertain question answered - `an_approach_to_somebody` - and
     * nothing else about the turn is different.
     *
     * The landing is scaffolding here, not the subject. What is being measured
     * is what happens WHEN a theft of a craft lands, and leaving that to a roll
     * is how two agents in this repo have already pinned a coincidence: the
     * same sentence typed plainly came back "Cao Nuolin refused" at 37 in a
     * hundred, and asserting off one draw either way says nothing.
     */
    async function theTheftLands(seed: string) {
        const { db, game } = await makeGameInWorld({
            seed, worldSeed: WORLD, adminMode: true
        });
        const { cultivator } = await game.newRun('Shen Wu');
        db.prepare(
            'UPDATE cultivators SET realm_ordinal = 34, hp = 9000, max_hp = 9000 WHERE id = ?'
        ).run(cultivator.id);
        await game.act('I look around');

        const known = new KnowledgeGate(db).awareness(cultivator.id)
            .find(row => row.kind === 'cultivator');
        expect(known, 'the pinned world opened with nobody the player could name').toBeDefined();

        const world = await game.loadWorld();
        const here = game.state().cultivator.location ?? '';
        const boat = aSpiritBoatOwnedBy(known!.id, known!.name, here);
        world.objects.push(boat);

        return { db, game, cultivator, known: known!, boat };
    }

    it('takes the boat, moves no title, and brings the mooring with it', async () => {
        const { db, game, cultivator, known, boat } = await theTheftLands('lift-a');
        const purseBefore = game.state().cultivator.spiritStones;

        await game.act(`ADMIN interact I steal the spirit boat from ${known.name}`);

        const after = (await game.loadWorld()).objects.find(row => row.id === boat.id)!;
        expect(after.possessorId).toBe(cultivator.id);
        // OWNERSHIP DOES NOT MOVE. `items.md`: a thief who becomes an owner by
        // the act of theft erases the only thread anybody could have followed.
        expect(after.ownerId).toBe(known.id);
        expect(after.provenance[after.provenance.length - 1].how).toBe('stolen');
        // And the register does not say it is at its owner's dock and in the
        // thief's hands at once.
        expect(after.data.mooredAt).toBe(game.state().cultivator.location);
        // A lift is one act: the purse was not emptied as well.
        expect(game.state().cultivator.spiritStones).toBe(purseBefore);

        // The deed is on somebody's ledger, which is what makes the twelfth
        // approach to this person the twelfth rather than another first.
        const held = db.prepare(
            'SELECT COUNT(*) AS n FROM obligations WHERE holder_id = ? AND subject_id = ?'
        ).get(known.id, cultivator.id) as { n: number };
        expect(held.n).toBeGreaterThan(0);
    }, 300_000);

    it('says what was taken, and says it is still theirs', async () => {
        const { game, known } = await theTheftLands('lift-b');
        const said = await game.act(
            `ADMIN interact I steal the spirit boat from ${known.name}`
        ) as { narration?: string };
        const prose = (said.narration ?? '').toLowerCase();

        expect(prose).toContain('spirit boat');
        // A player who is not told the register still names somebody else is a
        // player who will sail it into the province it was built in.
        expect(prose).toContain('still');
        expect(prose).toContain(known.name.toLowerCase());
    }, 300_000);

    it('falls back to the purse when the sentence names nothing of theirs', async () => {
        const { game, known, boat } = await theTheftLands('lift-c');

        await game.act(`ADMIN interact I steal from ${known.name}`);

        const after = (await game.loadWorld()).objects.find(row => row.id === boat.id)!;
        // Naming nothing takes what is on them. The boat is not on them, and
        // the object half must not fire on a sentence that did not ask for it.
        expect(after.possessorId).toBeNull();
        expect(after.ownerId).toBe(known.id);
    }, 300_000);
});
