/**
 * The room a house gives you, played: leave a thing, go away, come back for it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, IN THREE PARTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. `promotion-inside-a-house.ts` prices a seat on stipends and QUARTERS, and
 *    nothing in the engine gave anybody quarters. `seclusion-verbs.ts` said the
 *    opposite outright: below the Lid, buildings are a house's and not
 *    anybody's.
 * 2. `whereTheyKeepTheirThings` had handed out a holder key for a residence
 *    since the residence layer was written and had NO CALLER in `src/web` or
 *    `src/server`, so no sentence a player could type ever put anything down
 *    anywhere.
 * 3. `I go home` parsed as `unclear`, and `I head home` became a journey to a
 *    place called "home" - not a world row, so it refused.
 *
 * MEASURED on the seeded world `quarters-probe`: 38 houses, 1,154 locations, 37
 * dormitories and 38 residences, every one already named for a rank, and not
 * one assigned to anybody.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS PINNED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Behaviour a player would notice: the sentence reaches the verb, the thing
 * moves off the body and stays put across a journey and across a reload, the
 * room does not reach across a province, and `home` answers all three of its
 * cases. Not pinned: which room, which litre figure, which house - those are
 * the compound's and the catalog's and they move.
 *
 * WORLD PINNED, because every one of these reads a compound out of it.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness';
import { makeObject } from '../../src/engine/world/possessions';
import { theQuartersThisCultivatorHas } from '../../src/web/leaving-a-thing-in-your-own-room';
import { WHAT_A_RING_HOLDS } from '../../src/engine/world/what-a-body-can-carry-and-what-a-ring-holds';
import { gradeForOrdinal } from '../../src/data/cultivation/techniques';
import { parseIntent } from '../../src/web/actions';
import { SECTS } from '../../src/data/cultivation/sects';
import { getPill } from '../../src/data/cultivation/pills';
import {
    addToPouch,
    everythingInThePouch,
    pouchQuantity
} from '../../src/server/consolidated/cultivation-support';
import { whereAHouseLetsYouKeepThings } from '../../src/engine/world/the-room-a-house-gives-you';
import { whereHomeIs } from '../../src/web/travel-verbs';
import { theyTakeGroundAndMakeItTheirs } from '../../src/engine/world/somewhere-that-is-theirs';
import { abodeLocationId } from '../../src/engine/world/immortal-world';
import { IMMORTAL_LAYER } from '../../src/engine/world/layers';

const A_PILL = 'pill-minor-healing';

/** The lowest house anybody can get into, chosen the way the theft test does. */
const LOCAL_SECT = SECTS
    .filter(sect => sect.recruits)
    .reduce((best, sect) =>
        sect.admissionOrdinal < best.admissionOrdinal
        || (sect.admissionOrdinal === best.admissionOrdinal && sect.id < best.id) ? sect : best);

async function aDiscipleWithAPillAndARoom(seed: string, rankIndex = 1) {
    const harness = await makeGameInWorld({ seed, worldSeed: `${seed}-w` });
    const { cultivator } = await harness.game.newRun('Wen Shu');
    harness.db.prepare('UPDATE cultivators SET realm_ordinal = 12 WHERE id = ?')
        .run(cultivator.id);
    harness.repos.sects.addMember(LOCAL_SECT.id, cultivator.id, rankIndex);
    addToPouch(harness.db, cultivator.id, A_PILL, 'pill', 3);
    // IN THE HOUSE'S OWN PROVINCE. A road across a border is its real length now
    // (`provinceRoadDays`), and a walk of days can be stopped by whoever it meets; the room, not
    // the road, is what these pin.
    harness.repos.cultivators.update(cultivator.id, { location: 'Green Water City' });
    return { harness, cultivatorId: cultivator.id };
}

/** Read out of the catalog, because any name the game prints is one it must accept. */
const WHAT_IT_IS_CALLED = getPill(A_PILL)!.name;

describe('the sentence reaches the room', () => {
    it('routes putting a thing away and fetching it back', () => {
        for (const text of [
            'I put my sword in my room',
            'I leave the pills in my quarters',
            'I stow the manual in my room'
        ]) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('stow');
            expect(plan.intent, text).toBe('leave');
            expect(plan.target, text).toBeTruthy();
        }
        for (const text of [
            'I fetch my sword from my room',
            'I take my sword from my room',
            'I take the healing pill back out of my quarters'
        ]) {
            const plan = parseIntent(text);
            expect(plan.action, text).toBe('stow');
            expect(plan.intent, text).toBe('collect');
        }
        expect(parseIntent('what is in my room').action).toBe('stow');
        expect(parseIntent('what is in my room').intent).toBe('look');
    });

    it('does not swallow sentences that merely mention a room', () => {
        // "I take the north road" is the sentence this branch would eat if it
        // keyed on the verb rather than on a possessed room noun.
        expect(parseIntent('I take the north road').action).not.toBe('stow');
        expect(parseIntent('I cultivate in my room').action).not.toBe('stow');
    });
});

describe('a thing left in the room stays there', () => {
    it('comes off the body, survives a journey, and comes back', async () => {
        const { harness, cultivatorId } = await aDiscipleWithAPillAndARoom('quarters-play');
        const room = whereAHouseLetsYouKeepThings(LOCAL_SECT.id, cultivatorId);

        await harness.game.act('I go home');
        await harness.game.act(`I put the ${WHAT_IT_IS_CALLED} in my room`);

        expect(pouchQuantity(harness.db, cultivatorId, A_PILL)).toBe(2);
        expect(pouchQuantity(harness.db, room, A_PILL)).toBe(1);

        // ELEVEN DAYS AWAY AND IT IS STILL THERE. A store that empties when the
        // player walks off is not a room.
        await harness.game.act('I travel to Iron Ridge');
        expect(pouchQuantity(harness.db, room, A_PILL)).toBe(1);

        await harness.game.act('I go home');
        await harness.game.act(`I take the ${WHAT_IT_IS_CALLED} from my room`);
        expect(pouchQuantity(harness.db, cultivatorId, A_PILL)).toBe(3);
        expect(pouchQuantity(harness.db, room, A_PILL)).toBe(0);
    });

    /**
     * A thing, not a stack. The owner: "separate inventory (what is handy to me right now) from
     * ownership (I can leave things in my sect abode ...)". The room holds a sword the way a ring
     * does, and the inventory says it is kept there and whether it can be reached from here.
     */
    it('keeps a thing as well as a stack, and says where it is kept', async () => {
        const { harness, cultivatorId } = await aDiscipleWithAPillAndARoom('quarters-a-thing');
        const room = whereAHouseLetsYouKeepThings(LOCAL_SECT.id, cultivatorId);
        harness.game.atHand!.objects.push(makeObject({
            id: 'sword-left', name: 'an iron sword', kind: 'artifact', power: 2, volume: 3,
            possessorId: cultivatorId, ownerId: cultivatorId
        }));
        const sword = () => harness.game.atHand!.objects.find(o => o.id === 'sword-left')!;

        await harness.game.act('I go home');
        await harness.game.act('I put the sword in my room');
        expect(sword().possessorId).toBe(room);

        // A road can stop a journey short, so go on until they are there.
        for (let leg = 0; leg < 6 && harness.repos.cultivators.getById(cultivatorId)!.location !== 'Iron Ridge'; leg++) {
            await harness.game.act('I travel to Iron Ridge');
        }
        expect(harness.repos.cultivators.getById(cultivatorId)!.location).toBe('Iron Ridge');
        const away = await harness.game.act('what am I carrying');
        const said = [away.narration ?? '', ...harness.game.state().log.slice(-8).map(e => e.text)].join(' ');
        expect(said).toMatch(/Kept in your room at [^:]+: an iron sword/);
        expect(said).toMatch(/Not reachable from where you are standing/);

        // And the road home can stop short the same way.
        for (let leg = 0; leg < 6 && sword().possessorId !== cultivatorId; leg++) {
            await harness.game.act('I go home');
            await harness.game.act('I take the sword from my room');
        }
        expect(sword().possessorId).toBe(cultivatorId);
    });

    it('does not reach across a province', async () => {
        const { harness, cultivatorId } = await aDiscipleWithAPillAndARoom('quarters-reach');
        const room = whereAHouseLetsYouKeepThings(LOCAL_SECT.id, cultivatorId);

        await harness.game.act('I travel to Iron Ridge');
        const answer = await harness.game.act(`I put the ${WHAT_IT_IS_CALLED} in my room`);

        expect(pouchQuantity(harness.db, room, A_PILL)).toBe(0);
        expect(pouchQuantity(harness.db, cultivatorId, A_PILL)).toBe(3);
        // And it says where the room is rather than pretending not to read the
        // sentence.
        expect(answer.narration.toLowerCase()).toContain('room does not reach');
    });

    it('is in SQLite and not in the process', async () => {
        const { harness, cultivatorId } = await aDiscipleWithAPillAndARoom('quarters-reload');
        const room = whereAHouseLetsYouKeepThings(LOCAL_SECT.id, cultivatorId);

        await harness.game.act('I go home');
        await harness.game.act(`I put the ${WHAT_IT_IS_CALLED} in my room`);

        // The row read through a fresh statement against the same file, which
        // is the only claim "survives a reload" actually makes. A store that
        // lives until the process ends would be empty here only if it were in
        // memory; this asserts the row is where a restart would find it.
        const row = harness.db
            .prepare('SELECT quantity FROM cultivator_pouch WHERE holder_id = ? AND item_id = ?')
            .get(room, A_PILL) as { quantity: number } | undefined;
        expect(row?.quantity).toBe(1);
    });
});

describe('the rung decides how good the room is', () => {
    it('houses a higher rung better, and strands nothing on the way up', async () => {
        const { harness, cultivatorId } = await aDiscipleWithAPillAndARoom('quarters-rung');
        const room = whereAHouseLetsYouKeepThings(LOCAL_SECT.id, cultivatorId);

        await harness.game.act('I go home');
        await harness.game.act(`I put the ${WHAT_IT_IS_CALLED} in my room`);
        const asDisciple = await harness.game.act('what is in my room');

        harness.repos.sects.setRank(LOCAL_SECT.id, cultivatorId, LOCAL_SECT.ranks.length - 1);
        const asHead = await harness.game.act('what is in my room');

        const litres = (narration: string): number =>
            Number(/It holds (\d+) litres/.exec(narration)?.[1] ?? 0);
        expect(litres(asHead.narration)).toBeGreaterThan(litres(asDisciple.narration));
        // PROMOTION MOVES THE ROOM AND NOT THE PACK. A holder key on the room
        // would have left this behind the moment the house raised them.
        expect(pouchQuantity(harness.db, room, A_PILL)).toBe(1);
        expect(asHead.narration).toContain(WHAT_IT_IS_CALLED);
    });
});

describe('losing your place hands your things back', () => {
    it('empties the room onto the person, expelled or not', async () => {
        const { harness, cultivatorId } = await aDiscipleWithAPillAndARoom('quarters-expelled');
        const room = whereAHouseLetsYouKeepThings(LOCAL_SECT.id, cultivatorId);

        await harness.game.act('I go home');
        await harness.game.act(`I put the ${WHAT_IT_IS_CALLED} in my room`);
        expect(pouchQuantity(harness.db, room, A_PILL)).toBe(1);

        harness.repos.sects.removeMember(LOCAL_SECT.id, cultivatorId);

        // Nothing is left under a key no verb can reach, which is the one
        // outcome the storage must never produce.
        expect(pouchQuantity(harness.db, room, A_PILL)).toBe(0);
        expect(pouchQuantity(harness.db, cultivatorId, A_PILL)).toBe(3);
        expect(everythingInThePouch(harness.db, room)).toHaveLength(0);
    });
});

describe('home is a place, or plainly nowhere', () => {
    it('is the house that quarters you', async () => {
        const { harness, cultivatorId } = await aDiscipleWithAPillAndARoom('home-house');
        const world = await harness.game.loadWorld();
        const cultivator = harness.repos.cultivators.getById(cultivatorId)!;

        const home = whereHomeIs(harness.game, world, cultivator);
        expect(home.kind).toBe('quarters');

        const answer = await harness.game.act('I go home');
        // Arriving at the house's own ground, by the road `move` already takes
        // a member down. Not a new route: the gate reads them on the way in.
        expect(answer.narration).toContain(LOCAL_SECT.name);
    });

    it('is the abode first, where there is one', async () => {
        const { harness, cultivatorId } = await aDiscipleWithAPillAndARoom('home-abode');
        const world = (await harness.game.loadWorld())!;
        const cultivator = harness.repos.cultivators.getById(cultivatorId)!;

        const settled = theyTakeGroundAndMakeItTheirs(world, {
            residentId: cultivatorId,
            onDay: Math.floor(world.currentDay),
            locationId: abodeLocationId(cultivatorId),
            name: 'the cloud terrace',
            layer: IMMORTAL_LAYER
        });
        expect(settled.ok, 'the player needs a world row for this to mean anything').toBe(true);

        // Somebody on a roll AND holding ground answers with the ground. A
        // house quarters you; an abode is yours.
        expect(whereHomeIs(harness.game, settled.state, cultivator).kind).toBe('abode');
    });

    /**
     * An abode of your own keeps things too, and holds what a ring of your grade holds. The owner:
     * "just do a flat amount, mortal, earth, heaven grade depending on your ordinal".
     */
    it('keeps things in an abode of your own, as much as your grade holds, and only there', async () => {
        const { harness, cultivatorId } = await aDiscipleWithAPillAndARoom('abode-keeps');
        const world = (await harness.game.loadWorld())!;
        const settled = theyTakeGroundAndMakeItTheirs(world, {
            residentId: cultivatorId,
            onDay: Math.floor(world.currentDay),
            locationId: abodeLocationId(cultivatorId),
            name: 'the cloud terrace',
            layer: IMMORTAL_LAYER
        });
        expect(settled.ok).toBe(true);
        Object.assign(harness.game.atHand!, settled.state);
        const cultivator = harness.repos.cultivators.getById(cultivatorId)!;
        const mine = theQuartersThisCultivatorHas(harness.game, harness.game.atHand!, cultivator)!;
        expect(mine.quarters.locationId).toBe(abodeLocationId(cultivatorId));
        expect(mine.quarters.room).toBe(WHAT_A_RING_HOLDS[gradeForOrdinal(cultivator.realmOrdinal)]);
        expect(mine.reachedFrom(abodeLocationId(cultivatorId))).toBe(true);
        expect(mine.reachedFrom(null)).toBe(false);
    });

    it('says nothing plainly when there is nowhere', async () => {
        const harness = await makeGameInWorld({ seed: 'home-rogue', worldSeed: 'home-rogue-w' });
        const { cultivator } = await harness.game.newRun('Nobody');
        const world = await harness.game.loadWorld();

        expect(whereHomeIs(harness.game, world, cultivator).kind).toBe('nowhere');

        const answer = await harness.game.act('I go home');
        // Homelessness is the ordinary condition of a rogue here. It has to
        // read as a fact rather than as a sentence the engine could not parse.
        expect(answer.narration.toLowerCase()).toContain('nowhere in this world that is yours');
        expect(answer.toolCalls.some(call => call.action === 'unclear')).toBe(false);
    });
});
