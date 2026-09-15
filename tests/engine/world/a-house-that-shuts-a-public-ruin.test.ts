/**
 * A ruin is public by agreement, so a house that shuts one angers everybody who
 * would have delved it.
 *
 * `controllingFactionId` on a ruin had no writer anywhere in the engine -
 * measured 0 of 144 at day 0 and 0 of 445 at two hundred years over twelve
 * pinned worlds - and a ruin is the one kind of ground where the column cannot
 * mean ordinary ownership, because having no owner is what made it a ruin. So
 * it means monopoly, and `whoTurnsYouAwayFrom` already reads it as somebody
 * standing at the door: that reading is the whole downstream consequence and
 * this file asserts against it rather than against the column.
 *
 * WHO IS ANGRY IS DERIVED. The houses seated in the ruin's own province - the
 * same bound `circleCandidatesFor` uses, minus its hostility filter, because
 * you do not have to be on speaking terms to lose access. Measured across the
 * same twelve worlds: at day 0, of 5,472 house-and-ruin pairs, 5,016 were
 * refused because nothing was open there at all, leaving 456 on open ground -
 * available on 41, refused 358 times for the province and 57 for want of
 * anybody who could stand at the door. Each one that lands opens a median of
 * 18 accounts. At two hundred years, 1,413 of 16,605 pairs, median 13.
 *
 * So a monopoly is rare and expensive, which is the shape it should have.
 *
 * The assertions are about the rule - a name goes on the door, an account per
 * house that lost access, held by them and against the monopolist - never about
 * those counts, which belong to the seed.
 */

import { describe, it, expect } from 'vitest';
import {
    applyLocationChange,
    makeLocation,
    makeThresholds,
    type LocationRecord
} from '../../../src/engine/world/locations.js';
import { makeFaction, type FactionRecord } from '../../../src/engine/world/world-state.js';
import { whoTurnsYouAwayFrom } from '../../../src/engine/world/ruin-gatekeepers.js';
import {
    howBadlyItIsTaken,
    isAMonopolyAccount,
    shutAPublicRuin,
    whatItTakesToHold,
    whoLosesAccessTo,
    type AHouseThatCouldShutIt
} from '../../../src/engine/world/a-house-that-shuts-a-public-ruin.js';

const DAY = 400 * 365;

function province(id: string): LocationRecord {
    return makeLocation({ id, name: `province ${id}`, kind: 'region' });
}

function ruinIn(provinceId: string, opts: Partial<LocationRecord> = {}): LocationRecord {
    return makeLocation({
        id: `loc-ruin-${provinceId}`,
        name: 'Cold Spring',
        kind: 'ruin',
        parentId: provinceId,
        qiDensity: 80,
        thresholds: makeThresholds(4, 8, 14, 20),
        sealed: false,
        ...opts
    });
}

function seatIn(provinceId: string, id: string): LocationRecord {
    return makeLocation({ id, name: id, kind: 'sect_seat', parentId: provinceId });
}

function houseAt(id: string, seatLocationId: string): FactionRecord {
    return makeFaction({ id, name: `house ${id}`, seatLocationId, foundedOnDay: 0 });
}

/** A roll deep enough to leave a party standing at a door of this depth. */
function rollOf(count: number, ordinal: number): AHouseThatCouldShutIt['roster'] {
    return Array.from({ length: count }, (_, i) => ({
        id: `npc-${i}`, name: `disciple ${i}`, ordinal
    }));
}

interface Board {
    locations: LocationRecord[];
    houses: FactionRecord[];
    ruin: LocationRecord;
    shutter: AHouseThatCouldShutIt;
}

/** One province, one open ruin, three houses seated in it and one far off. */
function board(opts: { elsewhereRuin?: boolean } = {}): Board {
    const here = province('loc-prov-here');
    const away = province('loc-prov-away');
    const ruin = ruinIn('loc-prov-here');
    const locations = [
        here, away, ruin,
        seatIn('loc-prov-here', 'loc-seat-a'),
        seatIn('loc-prov-here', 'loc-seat-b'),
        seatIn('loc-prov-here', 'loc-seat-c'),
        seatIn('loc-prov-away', 'loc-seat-far'),
        ...(opts.elsewhereRuin
            ? [ruinIn('loc-prov-here', { id: 'loc-ruin-other', name: 'Ash Hollow' })]
            : [])
    ];
    const houses = [
        houseAt('f-a', 'loc-seat-a'),
        houseAt('f-b', 'loc-seat-b'),
        houseAt('f-c', 'loc-seat-c'),
        houseAt('f-far', 'loc-seat-far')
    ];
    const takes = whatItTakesToHold(ruin);
    return {
        locations,
        houses,
        ruin,
        shutter: {
            id: 'f-a',
            name: 'house f-a',
            seatLocationId: 'loc-seat-a',
            roster: rollOf(takes.hands, takes.atOrdinal)
        }
    };
}

function shut(b: Board, over: Partial<Parameters<typeof shutAPublicRuin>[0]> = {}) {
    return shutAPublicRuin({
        ruin: b.ruin,
        house: b.shutter,
        locations: b.locations,
        houses: b.houses,
        onDay: DAY,
        ...over
    });
}

describe('a house that shuts a public ruin', () => {
    it('puts a name on a door that had nobody at it', () => {
        const b = board();
        // Before: nobody is turning anybody away, which is what a ruin is.
        expect(whoTurnsYouAwayFrom(b.ruin).barApplies).toBe(false);

        const act = shut(b);
        expect(act.shut).toBe(true);
        const held = applyLocationChange(b.ruin, {
            onDay: DAY,
            kind: 'conquered',
            summary: act.reason,
            causeKnown: true,
            witnessed: false,
            patch: act.patch!
        }).location;

        const gate = whoTurnsYouAwayFrom(held);
        expect(gate.barApplies).toBe(true);
        expect(gate.factionId).toBe('f-a');
    });

    it('opens one account per house that lost access, held by them, against the shutter', () => {
        const b = board();
        const act = shut(b);

        expect(act.angered).toEqual(['f-b', 'f-c']);
        expect(act.accounts).toHaveLength(2);
        for (const account of act.accounts) {
            expect(account.kind).toBe('grudge');
            expect(account.subjectId).toBe('f-a');
            expect(act.angered).toContain(account.holderId);
            expect(isAMonopolyAccount(account)).toBe(true);
        }
        // And nobody holds one against themselves.
        expect(act.accounts.map(a => a.holderId)).not.toContain('f-a');
    });

    it('a house seated in another province loses nothing and holds nothing', () => {
        const b = board();
        const angry = whoLosesAccessTo(b.ruin, b.locations, b.houses, 'f-a').map(h => h.id);
        expect(angry).not.toContain('f-far');
        expect(shut(b).accounts.map(a => a.holderId)).not.toContain('f-far');
    });

    it('and cannot shut it either, because a watch a province away is not a watch', () => {
        const b = board();
        const far = shut(b, {
            house: {
                id: 'f-far', name: 'house f-far', seatLocationId: 'loc-seat-far',
                roster: b.shutter.roster
            }
        });
        expect(far.shut).toBe(false);
        expect(far.refusedBecause).toBe('it_is_not_in_your_province');
    });

    it('refuses a house with nobody who can stand there, and says what it takes', () => {
        const b = board();
        const takes = whatItTakesToHold(b.ruin);
        const thin = shut(b, {
            house: { ...b.shutter, roster: rollOf(takes.hands - 1, takes.atOrdinal) }
        });
        expect(thin.shut).toBe(false);
        expect(thin.refusedBecause).toBe('nobody_who_can_stand_there');
        expect(thin.reason).toContain(String(takes.hands));
        expect(thin.takes.hands).toBe(takes.hands);

        // And a full party of people who cannot live at the door is no party.
        const weak = shut(b, {
            house: { ...b.shutter, roster: rollOf(takes.hands, takes.atOrdinal - 1) }
        });
        expect(weak.refusedBecause).toBe('nobody_who_can_stand_there');
    });

    it('refuses ground somebody is already standing on, and shut ground', () => {
        const b = board();
        expect(shut(b, { ruin: { ...b.ruin, controllingFactionId: 'f-b' } }).refusedBecause)
            .toBe('somebody_already_holds_it');
        expect(shut(b, { ruin: { ...b.ruin, sealed: true } }).refusedBecause)
            .toBe('nothing_here_is_open');
    });

    /**
     * THE SCHEDULE IS THE FACT AND `sealed` IS A READING OF IT, which is the
     * rule `locations.ts` states and this refusal used to break.
     *
     * Every seeded cycled ruin carries `sealed: true` from the day it is
     * written, and a door on a season opens itself every sixty to six hundred
     * years whatever that column says. So the one kind of ground a house most
     * wants to stand at - the kind whose opening date the whole province knows,
     * and the only kind that admits a COUNT of people - refused every asker as
     * already shut. Measured on a pinned world at two hundred years: all 79
     * asks against its seven counted doors came back `nothing_here_is_open`,
     * and not one door in that world was ever held by anybody.
     */
    it('does not read a season as a door already shut', () => {
        const b = board();
        const onASeason = {
            ...b.ruin,
            sealed: true,
            cycle: { periodDays: 60 * 365, openDays: 21, phaseDay: 0 }
        };
        expect(shut(b, { ruin: onASeason }).refusedBecause).not.toBe('nothing_here_is_open');
        expect(shut(b, { ruin: onASeason }).shut).toBe(true);
    });

    it('a province with somewhere else to go takes it as the lesser thing', () => {
        const alone = board();
        const spoiltForChoice = board({ elsewhereRuin: true });

        const heavy = howBadlyItIsTaken(alone.ruin, alone.locations);
        const light = howBadlyItIsTaken(spoiltForChoice.ruin, spoiltForChoice.locations);
        expect(light).toBe('slight');
        expect(heavy).not.toBe('slight');
        expect(shut(alone).accounts[0].severity).toBe(heavy);
    });

    it('says it in public, because a monopoly nobody knows about costs nothing', () => {
        const act = shut(board());
        expect(act.fact!.visibility).toBe('public');
        expect(act.fact!.factionIds).toContain('f-a');
        expect(act.fact!.factionIds).toContain('f-b');
    });

    it('writes nothing: the record it was handed is unchanged', () => {
        const b = board();
        const before = JSON.stringify(b.ruin);
        shut(b);
        expect(JSON.stringify(b.ruin)).toBe(before);
    });
});
