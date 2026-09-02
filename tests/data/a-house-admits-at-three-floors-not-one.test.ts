import { describe, it, expect } from 'vitest';
import { SECTS, SECT_ADMISSION } from '../../src/data/cultivation/sects.js';
import { MEMBERS, rankRealmBand } from '../../src/data/cultivation/members.js';
import {
    houseFloorsOf,
    servantBarOf,
    discipleBarOf,
    guestFloorOf,
    groundReachOf,
    A_SERVANT_STANDS_THIS_FAR_BELOW_WHAT_THE_GROUND_REACHES
} from '../../src/data/cultivation/the-three-floors-a-house-admits-at.js';

/**
 * A house does not have one door, and the bar for a servant's place is not
 * zero.
 *
 * What this protects, in one sentence each:
 *
 *   - Nobody can be taken on as a servant of any house in the catalog at
 *     ordinal 0 unless that house's own bar is at ordinal 0. `69ed216` floored
 *     rank 0 at the bottom of the ladder to say servants have no bar; measured,
 *     that moved no band at any of the 34 houses, because at rank 0 the other
 *     arm of the same `max` is already the admission ordinal. What it did move
 *     was the guard - the catalog check was narrowed to `rankIndex > 0` and
 *     rank 0 stopped being checked from below by anything. This file is that
 *     guard, put back under its own name. `rankRealmBand(...).minOrdinal` is
 *     read as a live bar by `sect-leadership.ts`, so an unguarded floor there
 *     is the door of every house in the world with nothing standing in it.
 *   - The three floors stay three separate numbers and keep their order:
 *     a guest door, where a house has one, is at or below the servant bar; the
 *     servant bar never falls below the disciple bar, because a servant is
 *     bought for the qi they already carry and a disciple for what they might
 *     become.
 *   - `admissionOrdinal` is not moved by any of it. Every band in the catalog
 *     is derived from that number.
 */
describe('a house admits at three floors, not one', () => {
    it('never lets a house be entered at ordinal 0 unless its own bar is there', () => {
        const openAtTheBottom: string[] = [];
        for (const sect of SECTS) {
            const bar = rankRealmBand(sect.id, 0)!.minOrdinal;
            if (bar === 0 && sect.admissionOrdinal > 0) openAtTheBottom.push(sect.id);
        }
        expect(openAtTheBottom, openAtTheBottom.join(', ')).toEqual([]);
    });

    it('floors rank 0 at the servant bar and every other rank at the disciple bar', () => {
        for (const sect of SECTS) {
            expect(rankRealmBand(sect.id, 0)!.minOrdinal, sect.id).toBe(servantBarOf(sect.id));
            for (let rank = 1; rank < sect.ranks.length; rank += 1) {
                expect(
                    rankRealmBand(sect.id, rank)!.minOrdinal,
                    `${sect.id} rank ${rank}`
                ).toBeGreaterThanOrEqual(discipleBarOf(sect.id)!);
            }
        }
    });

    it('keeps the three floors in order at every house', () => {
        for (const sect of SECTS) {
            const floors = houseFloorsOf(sect.id)!;
            expect(floors.disciple, sect.id).toBe(sect.admissionOrdinal);
            if (floors.servant !== null) {
                // A servant's bar is never cheaper than a disciple's, because
                // nothing is taught to a servant and the house is buying the
                // qi in the room today.
                expect(floors.servant, `${sect.id} servant bar`).toBeGreaterThanOrEqual(floors.disciple);
            }
            if (floors.guest !== null) {
                expect(floors.guest, `${sect.id} guest floor`).toBeLessThanOrEqual(
                    floors.servant ?? floors.disciple
                );
            }
        }
    });

    it('seats every authored rank-0 member at or above their house servant bar', () => {
        const offences: string[] = [];
        for (const member of MEMBERS.filter(m => m.rankIndex === 0 && !m.outlier)) {
            const bar = servantBarOf(member.factionId)!;
            if (member.realmOrdinal < bar) {
                offences.push(`${member.id} at ${member.realmOrdinal} is below ${member.factionId}'s servant bar of ${bar}`);
            }
        }
        expect(offences, offences.join('\n')).toEqual([]);
    });

    it('gives the two houses that admit above Core Formation no menial tier at all', () => {
        // Derived, not listed: a house whose door already stands where sects
        // stop recruiting and start negotiating has nobody who would sweep its
        // yards. Both confirm it in their own rank-0 title.
        const withoutOne = SECTS.filter(s => !houseFloorsOf(s.id)!.hasMenialTier);
        expect(withoutOne.map(s => s.id).sort()).toEqual(['sect-hollow-court', 'sect-kiln-wardens']);
        for (const sect of withoutOne) {
            expect(servantBarOf(sect.id), sect.id).toBe(sect.admissionOrdinal);
            expect(sect.ranks[0]).toMatch(/Disciple|Warden/);
        }
    });

    it('lifts the servant bar above the disciple bar exactly where the ground outruns the door', () => {
        // The lift is the whole design claim - serving a strong house is worth
        // more than rank at a weak one, so its servants' bar is higher than its
        // door asks. It has to bind on somebody or it is decoration.
        const lifted = SECTS.filter(s => servantBarOf(s.id)! > s.admissionOrdinal).map(s => s.id).sort();
        expect(lifted.length).toBeGreaterThan(0);
        for (const id of lifted) {
            expect(
                groundReachOf(id)! - A_SERVANT_STANDS_THIS_FAR_BELOW_WHAT_THE_GROUND_REACHES,
                id
            ).toBe(servantBarOf(id));
        }
    });

    it('leaves the Azure Cloud Pavilion its guest door at the floor and a real servant bar above it', () => {
        // The one open apex. Its guest floor is the front gate that takes
        // uncultivated mortals off the road; its servant bar is a different
        // number and is not zero. The two were conflated once and it cost a
        // commit.
        expect(guestFloorOf('sect-azure-cloud-pavilion')).toBe(0);
        expect(SECT_ADMISSION['sect-azure-cloud-pavilion']!.guestFromOrdinal).toBe(0);
        expect(servantBarOf('sect-azure-cloud-pavilion')).toBeGreaterThan(0);
        expect(discipleBarOf('sect-azure-cloud-pavilion')).toBe(3);
    });

    it('answers for an unknown faction rather than guessing', () => {
        expect(houseFloorsOf('sect-does-not-exist')).toBeUndefined();
        expect(servantBarOf('sect-does-not-exist')).toBeUndefined();
        expect(guestFloorOf('sect-does-not-exist')).toBeUndefined();
        expect(groundReachOf('sect-does-not-exist')).toBeUndefined();
    });
});
