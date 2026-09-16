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
 *     Blending in is read off the recognition the engine already has
 *     (`noticesThatTheyAreThere`, `whatTheyCanPlaceAbout`), and a stranger who
 *     has put their weight away among weaker disciples gets the rate like anybody.
 *   - Being seen opens the ordinary row. `trespassed` is a kind of wrong whose
 *     shape is nothing taken and nobody harmed, so `severityOfTheWrong` reads it
 *     as slight without being told to.
 *   - *"An intruder is obviously treated differently from a disciple who broke a
 *     rule, and how strong the intruder is matters too."* The same ladder in
 *     `whatTheRoomDecides`, read through what each rung NEEDS; and a house that
 *     has nobody who could hold the stranger does not hand down a sentence it
 *     cannot lay on them.
 *
 * WHAT WENT RED FIRST: every `whatTheRoomDecides` case below that passes
 * `oneOfTheirOwn` or `hands` was a type error, and `trespassed` was not a wrong.
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
import { ledgerAbout } from '../../src/storage/repos/obligation.repo';
import type { Cultivator } from '../../src/schema/cultivation';

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
        hands: { strongest: 20, theirs: 3 },
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
        // Nothing was given, so nothing is taken back: the rung below stands.
        expect(demonic.sentence).not.toBe('what the house gave is taken back');
    });

    it('does not simply sentence a stranger who stands above everybody the house could send', () => {
        const heldDown = whatTheRoomDecides(aStranger({ alignment: 'demonic' }));
        const tooStrong = whatTheRoomDecides(aStranger({
            alignment: 'demonic', hands: { strongest: 5, theirs: 30 }
        }));
        expect(heldDown.nobodyCanHoldThem).toBe(false);
        expect(tooStrong.nobodyCanHoldThem).toBe(true);
        expect(rung(tooStrong.sentence)).toBeLessThan(rung(heldDown.sentence));
        expect(tooStrong.line).toMatch(/confrontation rather than a sentence/);
        // And a house with nobody to send at all holds nobody either.
        expect(whatTheRoomDecides(aStranger({
            alignment: 'demonic', hands: { strongest: null, theirs: 1 }
        })).nobodyCanHoldThem).toBe(true);
    });

    it('leaves the member ladder exactly where it was', () => {
        const member = (alignment: WhatWasBrought['alignment']) => whatTheRoomDecides({
            what: { does: 'reports', toId: 'a-house', line: '' },
            theirsToPunish: true, alignment, severity: 'slight', houseId: null
        });
        expect(member('righteous').sentence).toBe('a rebuke');
        expect(member('neutral').sentence).toBe('a fine');
        expect(member('demonic').sentence).toBe('a fine');
        expect(member('demonic').nobodyCanHoldThem).toBe(false);
    });
});

/** A house's own ground with a teacher on it and one of the house listening. */
async function insideAHouse(seed: string) {
    const harness = await makeGameInWorld({ seed, worldSeed: WORLD, adminMode: true });
    await harness.game.newRun('Prober');
    await harness.game.act('I buy a year of provisions');
    await harness.game.act('I buy the Lesser Qi-Gathering Manual');
    await harness.game.act('I learn Lesser Qi-Gathering Manual');
    const world = (await harness.game.loadWorld())!;
    const me = harness.game.currentRun().cultivator;

    let found: { placeId: string; placeName: string; teacherId: string; listenerId: string } | null = null;
    for (const place of [...world.locations].sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const ground = whoHoldsTheGround(world.locations, place.id);
        if (ground.holding !== 'held' || !ground.holderFactionId) continue;
        const ofTheHouse = world.npcs
            .filter(npc => npc.locationId === place.id && npc.status === 'alive'
                && npc.factionId === ground.holderFactionId)
            .sort((a, b) => b.cultivation.realmOrdinal - a.cultivation.realmOrdinal
                || (a.id < b.id ? -1 : 1));
        const teacher = ofTheHouse[0];
        const listener = ofTheHouse.find(npc => npc.id !== teacher?.id
            && teacher !== undefined
            && npc.cultivation.realmOrdinal + 2 <= teacher.cultivation.realmOrdinal);
        if (!teacher || !listener) continue;
        found = { placeId: place.id, placeName: place.name, teacherId: teacher.id, listenerId: listener.id };
        break;
    }
    expect(found, 'no house ground in this world has a teacher and a weaker listener on it').not.toBeNull();

    harness.repos.cultivators.update(me.id, { location: found!.placeName });
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
    const teacher = world.npcs.find(npc => npc.id === found!.teacherId)!;
    const listener = world.npcs.find(npc => npc.id === found!.listenerId)!;
    const here = harness.game.present(harness.game.currentRun().cultivator).map(row => row.id);
    expect(here, 'moving the player did not put the teacher in front of them').toContain(teacher.id);
    return { harness, me, teacher, listener };
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
    it('is seen, put out, and the row is opened, when nothing is hidden', async () => {
        const { harness, me, teacher } = await insideAHouse('seen-inside');
        const before = harness.game.currentRun().run.elapsedDays;

        const turn = await harness.game.act(`I sit in on ${teacher.name}'s talk`) as Turn;
        const text = everythingSaid(turn);

        expect(turn.toolCalls.map(call => call.name), text).toContain('engine.whatTheRoomDecides');
        expect(turn.toolCalls.map(call => call.name)).not.toContain('world.theyGiveTheirAttention');
        expect(text).toMatch(/you are not one of/);
        expect(ledgerAbout(harness.db, me.id).some(row => row.tags.includes('trespassed')), text)
            .toBe(true);
        // No span: being put out ends the attention before it began.
        expect(harness.game.currentRun().run.elapsedDays).toBe(before);
    }, 180_000);

    it('gets the rate like anybody, when their weight is put away among weaker disciples', async () => {
        const { harness, me, teacher, listener } = await insideAHouse('blends-in');
        // Above the one sitting beside them, below the one talking: a concealment
        // holds against the first and the second has something to give.
        const between = listener.cultivation.realmOrdinal + 1;
        expect(between).toBeLessThan(teacher.cultivation.realmOrdinal);
        harness.db.prepare('UPDATE cultivators SET realm_ordinal = ? WHERE id = ?').run(between, me.id);
        const seen = watchTheRate(harness.game);

        const turn = await harness.game.act(`I sit in on ${teacher.name}'s talk, hiding my cultivation`) as Turn;
        const text = everythingSaid(turn);

        expect(turn.toolCalls.map(call => call.name), text).toContain('world.theyGiveTheirAttention');
        expect(seen.some(g => g !== null && g > between), text).toBe(true);
        expect(ledgerAbout(harness.db, me.id).some(row => row.tags.includes('trespassed'))).toBe(false);
    }, 180_000);
});
