/**
 * Somebody inside a house who is not of it, sitting in on its teaching.
 *
 * Ruled by the design owner over one evening, and every ruling is an assertion
 * below:
 *
 *   - Nothing refuses a lecture because the listener is not a member. *"You
 *     break in."* The gate is the world's obstacle; being in the room is the
 *     whole of the gate, and a player standing somewhere else is told where
 *     they are standing rather than told they may not.
 *   - *"Either you somehow blend in as a disciple, or you get kicked out."*
 *     Blending in is the trust model, which was already built
 *     (`docs/world/houses/trust.md`): realm against any concealment, reference
 *     for the house's faces measured against the house's REAL size rather than
 *     its roll, the ground, and what the stranger is wearing. The first cut read
 *     realm alone and could not tell a stranger in the house's robes in a house
 *     of hundreds from the same stranger in a house of twelve.
 *   - Being seen opens the ordinary row. `trespassed` is a kind of wrong whose
 *     shape is nothing taken and nobody harmed, so `severityOfTheWrong` reads it
 *     as slight without being told to.
 *   - *"An intruder is obviously treated differently from a disciple who broke a
 *     rule."* The same ladder in `whatTheRoomDecides`, read through what each
 *     rung NEEDS.
 *   - *"Depends on how strong, same as how regular fights resolve."* There is
 *     no standoff rule. Whether the house gets hands on them is the ordinary
 *     confrontation: the house people here if they can take them, somebody sent
 *     for if one will come, and otherwise the house can only ask them to leave.
 *     The first cut had a `hands` term inside the room, which is gone.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeGameInWorld } from './harness';
import { whoHoldsTheGround } from '../../src/engine/world/ground-holder';
import {
    severityOfTheWrong
} from '../../src/engine/social-leverage/what-somebody-does-about-being-wronged';
import {
    SENTENCES_IN_ORDER,
    whatTheRoomDecides,
    type WhatWasBrought
} from '../../src/engine/social-leverage/what-a-room-decides-about-one-of-its-own';
import {
    howManyAHouseReallyHas,
    whetherAFaceIsRemarkable,
    type AFaceBeingLookedAt
} from '../../src/web/a-teacher-giving-you-their-attention';
import { A_ROLL_A_PLAYER_COULD_KNOW } from '../../src/engine/world/a-house-raises-its-own';
import { aUniformFor } from '../../src/engine/world/a-recruit-is-given-their-plate-at-the-house';
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import { whetherYouAreWorthTheTrouble } from '../../src/engine/social-leverage/what-a-house-does-when-it-catches-you';
import { heightAloneWouldHideThem } from '../../src/engine/social/presence-recognition';
import type { Cultivator } from '../../src/schema/cultivation';
import {
    npcsStandingIn,
    whereCompoundsAre
} from '../../src/engine/world/where-inside-a-house-somebody-is-standing';

const WORLD = 'a-xianxia-run';

const adminBefore = process.env.ADMIN_MODE;
beforeAll(() => { process.env.ADMIN_MODE = 'true'; });
afterAll(() => {
    if (adminBefore === undefined) delete process.env.ADMIN_MODE;
    else process.env.ADMIN_MODE = adminBefore;
});

type Turn = { narration: string; toolCalls: { name: string; summary: string; ok: boolean }[] };
const everythingSaid = (turn: Turn) =>
    [turn.narration, ...turn.toolCalls.map(call => call.summary)].join('\n');

function aStranger(over: Partial<WhatWasBrought> = {}): WhatWasBrought {
    return {
        what: { does: 'reports', toId: 'a-house', line: 'Somebody saw it.' },
        theirsToPunish: true,
        alignment: 'righteous',
        severity: severityOfTheWrong('trespassed'),
        houseId: null,
        theHouseGaveThemSomething: false,
        oneOfTheirOwn: false,
        ...over
    };
}

const rung = (s: string) => SENTENCES_IN_ORDER.indexOf(s as never);

describe('the room, for somebody who is not one of its own', () => {
    it('reads wandering in to listen as the lightest thing there is', () => {
        expect(severityOfTheWrong('trespassed')).toBe('slight');
    });

    it('gives a weak stranger a light outcome at a righteous house and a heavier one at a demonic house', () => {
        const righteous = whatTheRoomDecides(aStranger({ alignment: 'righteous' }));
        const demonic = whatTheRoomDecides(aStranger({ alignment: 'demonic' }));
        expect(righteous.sentence).toBe('a rebuke');
        expect(rung(demonic.sentence)).toBeGreaterThan(rung(righteous.sentence));
    });

    it('never takes back from a stranger what was never given, whatever the caller says', () => {
        const told = whatTheRoomDecides(aStranger({
            alignment: 'demonic', severity: 'serious', theHouseGaveThemSomething: true
        }));
        expect(told.sentence).not.toBe('what the house gave is taken back');
    });

    it('leaves the member ladder exactly where it was', () => {
        const member = (alignment: WhatWasBrought['alignment']) => whatTheRoomDecides({
            what: { does: 'reports', toId: 'a-house', line: '' },
            theirsToPunish: true, alignment, severity: 'slight', houseId: null
        });
        expect(member('righteous').sentence).toBe('a rebuke');
        expect(member('neutral').sentence).toBe('a fine');
        expect(member('demonic').sentence).toBe('a fine');
    });
});

describe('whether a stranger\'s face stands out', () => {
    const inRobesInABigHouse: AFaceBeingLookedAt = {
        registers: true,
        knowsThem: false,
        inTheRobes: true,
        takenForRung: 3,
        strongestOfTheHouse: 30,
        houseSize: 300,
        groundUnderDuress: false
    };

    it('lets a stranger in the house\'s robes pass among the outer disciples of a large house', () => {
        expect(whetherAFaceIsRemarkable(inRobesInABigHouse).remarkable).toBe(false);
    });

    it('notices the same stranger in a small house where everybody knows everybody', () => {
        const small = whetherAFaceIsRemarkable({ ...inRobesInABigHouse, houseSize: A_ROLL_A_PLAYER_COULD_KNOW });
        expect(small.remarkable).toBe(true);
        expect(small.because).toMatch(/every face in it is known/);
    });

    it('notices a stranger without the robes, whatever the size of the house', () => {
        const bare = whetherAFaceIsRemarkable({ ...inRobesInABigHouse, inTheRobes: false });
        expect(bare.remarkable).toBe(true);
        expect(bare.because).toMatch(/robes/);
    });

    it('keeps each axis apart: a face that does not register, a known face, a bad year', () => {
        expect(whetherAFaceIsRemarkable({ ...inRobesInABigHouse, inTheRobes: false, registers: false }).remarkable)
            .toBe(false);
        expect(whetherAFaceIsRemarkable({ ...inRobesInABigHouse, knowsThem: true }).remarkable).toBe(true);
        expect(whetherAFaceIsRemarkable({ ...inRobesInABigHouse, groundUnderDuress: true }).remarkable).toBe(true);
        expect(whetherAFaceIsRemarkable({ ...inRobesInABigHouse, takenForRung: 31 }).remarkable).toBe(true);
    });

    it('measures a house by the rooms it sleeps people in, and by its roll where it sleeps nobody', async () => {
        const harness = await makeGameInWorld({ seed: 'house-size', worldSeed: WORLD });
        await harness.game.newRun('Prober');
        const world = (await harness.game.loadWorld())!;
        const withADormitory = world.locations.find(place => place.data?.purpose === 'dormitory');
        expect(withADormitory, 'no house in this world has a dormitory').toBeDefined();
        const houseId = String(withADormitory!.data.factionId);
        const roll = world.npcs.filter(npc => npc.status === 'alive' && npc.factionId === houseId).length;
        expect(howManyAHouseReallyHas(world, houseId)).toBeGreaterThan(roll);
        expect(howManyAHouseReallyHas({ locations: [], npcs: world.npcs }, houseId)).toBe(roll);
    }, 120_000);
});

/**
 * A house's own ground with a teacher on it and one of the house listening.
 *
 * `large` asks for a house whose real size is past what one person knows the
 * faces of, which is the house a stranger in its robes can pass in.
 */
async function insideAHouse(seed: string, opts: { large?: boolean } = {}) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD, adminMode: true });
    await harness.game.newRun('Prober');
    await harness.game.act('I buy a year of provisions');
    await harness.game.act('I buy the Lesser Qi-Gathering Manual');
    await harness.game.act('I learn Lesser Qi-Gathering Manual');
    const world = (await harness.game.loadWorld())!;
    const me = harness.game.currentRun().cultivator;

    let found: {
        placeId: string; placeName: string; teacherId: string; listenerId: string;
        houseId: string; houseName: string;
    } | null = null;
    for (const place of [...world.locations].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const ground = whoHoldsTheGround(world.locations, place.id);
        if (ground.holding !== 'held' || !ground.holderFactionId) continue;
        if (opts.large && howManyAHouseReallyHas(world, ground.holderFactionId) <= A_ROLL_A_PLAYER_COULD_KNOW) continue;
        const ofTheHouse = world.npcs
            .filter(npc => npc.locationId === place.id && npc.status === 'alive'
                && npc.factionId === ground.holderFactionId)
            .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
                || (a.id < b.id ? -1 : 1));
        const teacher = ofTheHouse[0];
        const listener = ofTheHouse.find(npc => npc.id !== teacher?.id
            && teacher !== undefined
            && npc.cultivation.realmOrdinal + 2 <= teacher.cultivation.realmOrdinal
            && npc.cultivation.realmOrdinal >= me.realmOrdinal);
        if (!teacher || !listener) continue;
        found = {
            placeId: place.id, placeName: place.name, teacherId: teacher.id, listenerId: listener.id,
            houseId: ground.holderFactionId, houseName: ground.holderName ?? ground.holderFactionId
        };
        break;
    }
    expect(found, 'no house ground in this world has a teacher and a weaker listener on it').not.toBeNull();

    const today = Math.floor(world.currentDay);
    for (const [who, other] of [[found!.teacherId, found!.listenerId], [found!.listenerId, found!.teacherId]]) {
        const at = world.npcs.findIndex(npc => npc.id === who);
        world.npcs[at] = {
            ...world.npcs[at]!,
            activity: {
                kind: 'teaching', note: 'a talk on the breath', withIds: [other!],
                sinceDay: today, untilDay: today + 3
            }
        };
    }
    harness.game.theWorldMoved();
    // IN THE ROOM THE TALK IS IN. A house's people at a talk are read into the
    // hall it is given in (`where-inside-a-house-somebody-is-standing.ts`), so
    // the player is put where the teacher is standing. Walking there is its own
    // test, in `people-stand-in-the-rooms-of-a-house.test.ts`, and this file is
    // about what happens once somebody is in the room.
    const compounds = whereCompoundsAre(world);
    const roomId = [found!.placeId, ...(compounds.bySeat.get(found!.placeId)?.inside ?? [])]
        .find(id => npcsStandingIn(world, id, compounds).some(npc => npc.id === found!.teacherId))!;
    const room = world.locations.find(place => place.id === roomId)!;
    harness.repos.cultivators.update(me.id, { location: room.name });
    const teacher = world.npcs.find(npc => npc.id === found!.teacherId)!;
    const listener = world.npcs.find(npc => npc.id === found!.listenerId)!;
    const here = harness.game.present(harness.game.currentRun().cultivator).map(row => row.id);
    expect(here, 'moving the player did not put the teacher in front of them').toContain(teacher.id);

    /** The house's robes on the player, the way a robe off a line would be. */
    const putOnTheRobes = () => {
        world.objects.push(aUniformFor({
            memberId: me.id, houseId: found!.houseId, houseName: found!.houseName, onDay: today
        }));
        harness.game.theWorldMoved();
    };
    return {
        harness, world, me, teacher, listener, putOnTheRobes,
        roomId, roomName: room.name, seatName: found!.placeName
    };
}

function watchTheRate(game: unknown): (number | null)[] {
    const seen: (number | null)[] = [];
    const g = game as { rateTermsFor(c: Cultivator): { guideOrdinal: number | null } };
    const original = g.rateTermsFor.bind(g);
    g.rateTermsFor = (c: Cultivator) => {
        const terms = original(c);
        seen.push(terms.guideOrdinal);
        return terms;
    };
    return seen;
}

describe('sitting in on a house\'s teaching without being of the house', () => {
    it('is seen without the house\'s robes, put out, and the row is opened', async () => {
        const { harness, me, teacher, seatName } = await insideAHouse('seen-inside');
        const before = harness.game.currentRun().run.elapsedDays;

        const turn = await harness.game.act(`I sit in on ${teacher.name}'s talk`) as Turn;
        const text = everythingSaid(turn);

        expect(turn.toolCalls.map(call => call.name), text).toContain('engine.whatTheRoomDecides');
        expect(turn.toolCalls.map(call => call.name)).not.toContain('world.theyGiveTheirAttention');
        expect(text).toMatch(/not in the house's robes/);
        // Out through the gate, and standing at the seat: being put out moves you.
        expect(text).toMatch(/walks you out through the gate/);
        expect(harness.game.currentRun().cultivator.location, text).toBe(seatName);
        expect(ledgerAbout(harness.db, me.id).some(row => row.tags.includes('trespassed')), text)
            .toBe(true);
        // No span: being put out ends the attention before it began.
        expect(harness.game.currentRun().run.elapsedDays).toBe(before);
    }, 180_000);

    it('passes in the house\'s robes in a large house, and gets the rate like anybody', async () => {
        const { harness, me, putOnTheRobes, teacher } = await insideAHouse('blends-in', { large: true });
        putOnTheRobes();
        const seen = watchTheRate(harness.game);

        const turn = await harness.game.act(`I sit in on ${teacher.name}'s talk`) as Turn;
        const text = everythingSaid(turn);

        expect(turn.toolCalls.map(call => call.name), text).toContain('world.theyGiveTheirAttention');
        expect(seen.some(g => g !== null && g > me.realmOrdinal), text).toBe(true);
        expect(ledgerAbout(harness.db, me.id).some(row => row.tags.includes('trespassed'))).toBe(false);
    }, 180_000);

    it('is not simply put out when nobody the house has can make them go', async () => {
        const { harness, world, me, teacher, listener, roomId, roomName } = await insideAHouse('too-strong');
        // A GUEST AT THE FRONT OF THE ROOM, of no house, standing high enough to
        // have something to give somebody past everybody of the house who is
        // listening. The house's own people beside the intruder are who look,
        // and who would have to put them out. Arranged, because a guest elder
        // lecturing in a compound is a row the world writes and not one a turn
        // reaches.
        // A guest is not read into the house's rooms by what they are at, so
        // the row is put in the hall outright, the way somebody sent for is.
        const at = world.npcs.findIndex(npc => npc.id === teacher.id);
        world.npcs[at] = {
            ...world.npcs[at]!,
            factionId: null,
            factionRankIndex: -1,
            locationId: roomId,
            cultivation: { ...world.npcs[at]!.cultivation, realmOrdinal: 44 }
        };
        harness.game.theWorldMoved();
        // HIGH ENOUGH THAT NOBODY OF THE HOUSE HERE COULD TAKE THEM, and not so
        // high that the listener beside them does not register the face at all
        // - `presence-recognition.ts` hides somebody that far up, and a stranger
        // nobody registers is a stranger nobody sees. Both read off the engine.
        const houseId = listener.factionId!;
        const strongestOfTheHouseHere = Math.max(...npcsStandingIn(world, roomId)
            .filter(npc => npc.factionId === houseId)
            .map(npc => npc.cultivation.realmOrdinal));
        let ordinal: number | null = null;
        for (let k = strongestOfTheHouseHere + 1; k < 44; k++) {
            if (whetherYouAreWorthTheTrouble({ theirOrdinal: strongestOfTheHouseHere, yourOrdinal: k }) !== 'beyond_them') continue;
            if (heightAloneWouldHideThem(k, listener.cultivation.realmOrdinal)) break;
            ordinal = k;
            break;
        }
        expect(ordinal, 'no rung is both past the house here and visible to the listener').not.toBeNull();
        await harness.game.act(`ADMIN set_realm ordinal=${ordinal}`);
        const turn = await harness.game.act(`I sit in on ${teacher.name}'s talk`) as Turn;
        const text = everythingSaid(turn);

        expect(text).not.toMatch(/puts you out|walks you out/);
        expect(text).toMatch(/sent for|asked to leave/);
        expect(harness.game.currentRun().cultivator.location).toBe(roomName);
        // Seen is still seen: the row is on the ledger either way.
        expect(ledgerAbout(harness.db, me.id).some(row => row.tags.includes('trespassed'))).toBe(true);
    }, 180_000);
});
