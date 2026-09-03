/**
 * SOMEBODY NINE RUNGS ABOVE YOU IS NOT IN YOUR COUNT.
 *
 * ── THE PLAYED DEFECT ────────────────────────────────────────────────────
 *
 * At the Azure Cloud Pavilion, at ordinal 25, asking who could teach:
 *
 *   1 stand above Deity Transformation First Turn (ordinal 25) on the roll and
 *   in the room. 0 can be named, 0 of those teach, and 1 are counted without a
 *   name because this cultivator has never met them.
 *
 * The person is Ru Anwei, at 41, who has not left her inner hall in three
 * hundred and eighty years. The name gate held and the COUNT went through, and
 * the narrator turned the count into *"a height sixteen rungs beyond the
 * deepest person you have ever encountered"* - a precise measurement of a
 * person the player has no way to perceive. The design owner: *"this you
 * shouldn't even know"*, *"you can only count those you know about (even if you
 * don't know their names)"*, *"a DT wouldn't even make himself visible to you
 * for no reason"*.
 *
 * ── AND WHAT MUST SURVIVE IT ─────────────────────────────────────────────
 *
 * Two things, and they are the reason this is a gate and not a subtraction:
 *
 *   THE UNNAMED-BUT-KNOWN CASE. *"even if you don't know their names"* is the
 *   owner ruling that this case is real. Somebody within reading distance is
 *   counted without a name, and the count and the altitude are things the
 *   player is entitled to.
 *
 *   THE KNOWN-AT-ANY-HEIGHT CASE. An elder holding court, somebody who has
 *   spoken to you, a figure whose presence is the whole point of a scene. Every
 *   one of those is a knowledge row, and a knowledge row wins outright. A fix
 *   that hid Ru Anwei from somebody who has met her would be blindness rather
 *   than discretion, and would be the mirror-image defect.
 *
 * The threshold is not this file's and not `presence-recognition.ts`'s either:
 * `REGARD_BANDS` already calls a gap of nine or more `unreachable` and already
 * says *"far enough above that it is not put in front of them"*. These tests
 * assert against that band rather than against the number 9, so retuning the
 * table moves them with it.
 */

import { describe, expect, it } from 'vitest';

import {
    heightAloneWouldHideThem,
    noticesThatTheyAreThere
} from '../../src/engine/social/presence-recognition';
import { regardFor } from '../../src/engine/cultivation/regard';
import { whoWouldTeach, type SomebodyAbove } from '../../src/web/who-would-teach-this-cultivator';

/** The played coordinates, kept together so the numbers are not scattered. */
const PLAYED = { player: 25, ruAnwei: 41 } as const;

const ABOVE = (over: Partial<SomebodyAbove> = {}): SomebodyAbove => ({
    name: null,
    realmOrdinal: 30,
    rankTitle: null,
    willTeach: false,
    knows: null,
    mayNotSay: null,
    costsThem: null,
    here: false,
    ...over
});

describe('what height alone hides', () => {
    it('hides the person the played read leaked', () => {
        expect(heightAloneWouldHideThem(PLAYED.ruAnwei, PLAYED.player)).toBe(true);
        // And it is the world's own band doing it, not a number chosen here.
        expect(regardFor(PLAYED.ruAnwei, PLAYED.player).band).toBe('unreachable');
    });

    it('leaves everybody the ladder still puts in front of you', () => {
        // One rung under the band boundary, wherever the table puts it. Found
        // by walking up from the player rather than by writing 8, so this test
        // does not have to be edited when REGARD_BANDS is retuned - it only has
        // to keep agreeing with it.
        const stillSeen = [];
        for (let them = PLAYED.player + 1; them <= 46; them++) {
            if (regardFor(them, PLAYED.player).band !== 'unreachable') stillSeen.push(them);
        }
        expect(stillSeen.length).toBeGreaterThan(0);
        for (const them of stillSeen) {
            expect(heightAloneWouldHideThem(them, PLAYED.player)).toBe(false);
        }
    });

    it('never hides anybody for being beneath you', () => {
        // The mirror-image bug: `regardFor(gate, asker)` reads asker minus gate,
        // so passing the two the wrong way round hides the whole world below.
        // It would read identically at the call site and would be caught by
        // nothing else here.
        for (let them = 0; them <= 25; them++) {
            expect(heightAloneWouldHideThem(them, 25)).toBe(false);
        }
    });
});

describe('knowledge wins over height', () => {
    it('drops somebody unreachable that this cultivator has never met', () => {
        expect(noticesThatTheyAreThere({
            theirOrdinal: PLAYED.ruAnwei,
            yourOrdinal: PLAYED.player,
            known: false
        })).toBe(false);
    });

    it('keeps the same person once there is a row for them', () => {
        // The whole "do not overcorrect into blindness" half. Having met
        // somebody, or having watched them hold a hall, is a knowledge row, and
        // no rung gap unmakes one.
        expect(noticesThatTheyAreThere({
            theirOrdinal: PLAYED.ruAnwei,
            yourOrdinal: PLAYED.player,
            known: true
        })).toBe(true);
    });

    it('keeps somebody within reading distance who is a stranger', () => {
        // The unnamed-but-known case the owner insisted stays.
        const near = PLAYED.player + 2;
        expect(regardFor(near, PLAYED.player).band).not.toBe('unreachable');
        expect(noticesThatTheyAreThere({
            theirOrdinal: near,
            yourOrdinal: PLAYED.player,
            known: false
        })).toBe(true);
    });
});

describe('the read the defect was found in', () => {
    it('says there is no teacher when the only person above is dropped', () => {
        // What the fixed read hands `whoWouldTeach`: an empty roll. The played
        // answer said "1 are counted without a name"; this one has to say
        // nothing at all about anybody.
        const read = whoWouldTeach({
            name: 'Probe',
            ordinal: PLAYED.player,
            placeName: 'the Azure Cloud Pavilion',
            sectName: 'the Azure Cloud Pavilion',
            above: [],
            manualState: 'teaching'
        });
        const whole = [read.headline, ...read.lines].join(' ');
        expect(whole).toContain('There is no teacher here to find.');
        // The two sentences the leak was made of. Neither may appear.
        expect(whole).not.toMatch(/rungs? (up|above)/);
        expect(whole).not.toMatch(/\bcounted\b/);
        expect(read.nameable).toBe(0);
    });

    it('still reports the shape of what is hidden for somebody in reach', () => {
        // And the other side of it, so this file cannot be satisfied by a read
        // that has simply gone quiet. A stranger two rungs up is still a count
        // and an altitude, which is what the player is owed.
        const read = whoWouldTeach({
            name: 'Probe',
            ordinal: PLAYED.player,
            placeName: 'the Azure Cloud Pavilion',
            sectName: 'the Azure Cloud Pavilion',
            above: [ABOVE({ realmOrdinal: PLAYED.player + 2 })],
            manualState: 'teaching'
        });
        expect(read.lines.join(' ')).toContain('2 rungs up');
    });
});
