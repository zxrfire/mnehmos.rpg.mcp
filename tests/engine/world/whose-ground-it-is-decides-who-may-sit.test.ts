/**
 * Ground a house holds is not one answer, and `not_of_the_house` is only one of
 * them.
 *
 * Measured by `scripts/probe-is-there-enough-to-do-and-can-it-be-reached.ts`
 * over 222 squares (37 places x 3 bands x 2 pinned worlds): dao ground was
 * reachable 0% at the bottom band, 2% through the middle and 6% at the top, and
 * the refusal was `not_of_the_house` 666 times. Membership was the whole gate,
 * so every held terrace in the world was a wall to everybody who had not joined
 * that house, and the wall said the same sentence every time.
 *
 * The ruling: ground has an ACCESS KIND rather than a membership test. Public
 * ground anybody may sit on. Private ground is the house's own, and there
 * `not_of_the_house` is exactly right. Restricted is the middle that did not
 * exist - the house lets an outsider on, on terms it sets, and the terms are
 * priced off what the engine already prices rather than off a new currency:
 *
 *   a fee            spirit stones, off what somebody at the ground's own floor
 *                    is paid for a season of work.
 *   a copy           an art written out and left behind, gated by
 *                    `couldWriteOutACopy`, over something the house has not got.
 *   good relations   somebody the house has reason to be glad to see, read off
 *                    the obligation ledger by the caller.
 *
 * What these pin is the AXIS, never which house sits on which rung of it: every
 * case below finds its row by asking the catalog for a held ground that admits
 * on those terms, so a house changing its mind moves no assertion here.
 */

import { describe, it, expect } from 'vitest';

import {
    PLACES_THAT_TEACH_A_DAO,
    type PlaceThatTeachesADao,
    type WhoMaySit
} from '../../../src/data/cultivation/places-that-teach-a-dao';
import {
    groundFromCatalogRow,
    howSomebodyStandsToAGround,
    type SomebodyStanding
} from '../../../src/engine/world/how-a-cultivator-comes-by-a-road';
import {
    accessKindOf,
    feeForSittingOn
} from '../../../src/engine/world/what-a-house-asks-of-somebody-not-of-it';
import { isCommonlyHeld, manualsOf } from '../../../src/engine/world/manuals';
import { getSect } from '../../../src/data/cultivation/sects';
import { TECHNIQUES } from '../../../src/data/cultivation/techniques';

const heldGrounds = PLACES_THAT_TEACH_A_DAO.filter(p => p.access === 'held');

/** A held row that admits outsiders on these terms, or undefined if none does. */
const heldWith = (admits: WhoMaySit): PlaceThatTeachesADao | undefined =>
    heldGrounds.find(p => p.admits === admits);

const stranger = (over: Partial<SomebodyStanding> = {}): SomebodyStanding => ({
    ordinal: 0,
    regionCatalogId: null,
    factionId: null,
    factionRankIndex: -1,
    ...over
});

/** Somebody of no house, standing in the province, high enough to read it. */
const anOutsiderAt = (row: PlaceThatTeachesADao, over: Partial<SomebodyStanding> = {}) =>
    stranger({ ordinal: row.fromOrdinal, regionCatalogId: row.regionId, ...over });

/** An art this house has not got, that anybody could write out. */
function somethingTheHouseHasNot(factionId: string): string {
    const theirs = new Set([
        ...(getSect(factionId)?.teaches ?? []),
        ...manualsOf(factionId).map(m => m.id)
    ]);
    const art = TECHNIQUES.find(t => !theirs.has(t.id) && isCommonlyHeld(t.id));
    if (!art) throw new Error('no commonly held art outside this house to offer');
    return art.id;
}

describe('whose ground it is decides who may sit on it', () => {
    it('has every held ground say who may sit, and reads three kinds off it', () => {
        expect(heldGrounds.length).toBeGreaterThan(0);
        for (const row of heldGrounds) {
            expect(['public', 'private', 'restricted']).toContain(accessKindOf(row.admits));
        }
        // The middle exists. Before this it did not, which is the whole defect.
        expect(heldGrounds.some(r => accessKindOf(r.admits) === 'restricted')).toBe(true);
        expect(heldGrounds.some(r => accessKindOf(r.admits) === 'public')).toBe(true);
        expect(heldGrounds.some(r => accessKindOf(r.admits) === 'private')).toBe(true);
    });

    it('lets anybody sit on ground a house holds open', () => {
        const row = heldWith('anybody');
        expect(row).toBeDefined();
        const sat = howSomebodyStandsToAGround(groundFromCatalogRow(row!), anOutsiderAt(row!));
        expect(sat.shortBy).toBe(null);
        expect(sat.inReach).toBe(true);
    });

    it('keeps `not_of_the_house` for the ground a house keeps to its own', () => {
        const row = heldWith('its own');
        expect(row).toBeDefined();
        const sat = howSomebodyStandsToAGround(groundFromCatalogRow(row!), anOutsiderAt(row!));
        expect(sat.shortBy).toBe('not_of_the_house');
        expect(sat.inReach).toBe(false);
    });

    it('names the fee, refuses somebody short of it, and admits somebody carrying it', () => {
        const row = heldWith('a fee');
        expect(row).toBeDefined();
        const fee = feeForSittingOn(row!.fromOrdinal);
        expect(fee).not.toBe(null);
        expect(fee!).toBeGreaterThan(0);

        const short = howSomebodyStandsToAGround(
            groundFromCatalogRow(row!),
            anOutsiderAt(row!, {
                couldPutUp: { spiritStones: fee! - 1, holds: [], onGoodTermsWith: [] }
            })
        );
        expect(short.shortBy).toBe('the_fee');
        // They know where it is. A gate you can be turned away from is a gate
        // you were standing at.
        expect(short.knowsWhereItIs).toBe(true);

        const paid = howSomebodyStandsToAGround(
            groundFromCatalogRow(row!),
            anOutsiderAt(row!, {
                couldPutUp: { spiritStones: fee!, holds: [], onGoodTermsWith: [] }
            })
        );
        expect(paid.shortBy).toBe(null);
        expect(paid.inReach).toBe(true);
    });

    it('takes an art written out, and only one the house has not got', () => {
        const row = heldWith('a copy');
        expect(row).toBeDefined();
        const empty = howSomebodyStandsToAGround(
            groundFromCatalogRow(row!),
            anOutsiderAt(row!, {
                couldPutUp: { spiritStones: 0, holds: [], onGoodTermsWith: [] }
            })
        );
        expect(empty.shortBy).toBe('nothing_to_write_out');

        const theirOwn = manualsOf(row!.heldBy!)[0]?.id
            ?? getSect(row!.heldBy!)?.teaches[0];
        if (theirOwn) {
            const offeringTheirs = howSomebodyStandsToAGround(
                groundFromCatalogRow(row!),
                anOutsiderAt(row!, {
                    couldPutUp: { spiritStones: 0, holds: [theirOwn], onGoodTermsWith: [] }
                })
            );
            expect(offeringTheirs.shortBy).toBe('nothing_to_write_out');
        }

        const carried = somethingTheHouseHasNot(row!.heldBy!);
        const admitted = howSomebodyStandsToAGround(
            groundFromCatalogRow(row!),
            anOutsiderAt(row!, {
                couldPutUp: { spiritStones: 0, holds: [carried], onGoodTermsWith: [] }
            })
        );
        expect(admitted.shortBy).toBe(null);
        expect(admitted.inReach).toBe(true);
    });

    it('turns away a stranger where the house wants somebody it knows', () => {
        const row = heldWith('good relations');
        expect(row).toBeDefined();
        const unknown = howSomebodyStandsToAGround(
            groundFromCatalogRow(row!),
            anOutsiderAt(row!, {
                couldPutUp: { spiritStones: 10_000, holds: [], onGoodTermsWith: [] }
            })
        );
        // Money does not answer this one, which is the point of it being a
        // separate term rather than a steeper fee.
        expect(unknown.shortBy).toBe('a_stranger_to_them');

        const known = howSomebodyStandsToAGround(
            groundFromCatalogRow(row!),
            anOutsiderAt(row!, {
                couldPutUp: { spiritStones: 0, holds: [], onGoodTermsWith: [row!.heldBy!] }
            })
        );
        expect(known.shortBy).toBe(null);
    });

    it('still asks an outsider to be in the province, and to be able to read it', () => {
        const row = heldWith('anybody');
        expect(row).toBeDefined();
        const elsewhere = howSomebodyStandsToAGround(
            groundFromCatalogRow(row!),
            stranger({ ordinal: row!.fromOrdinal, regionCatalogId: 'region-white-stair' })
        );
        expect(elsewhere.shortBy).toBe('somewhere_else');

        const tooLow = howSomebodyStandsToAGround(
            groundFromCatalogRow(row!),
            stranger({ ordinal: 0, regionCatalogId: row!.regionId })
        );
        expect(tooLow.shortBy).toBe('below_the_floor');
    });

    it('does not let terms stand in for standing where the sitter is of the house', () => {
        // A house's own people are rationed by the ladder, whatever it asks of
        // strangers. Carrying the fee is not a way around your own house.
        for (const row of heldGrounds.filter(r => r.standingRequired > 0)) {
            const junior = howSomebodyStandsToAGround(
                groundFromCatalogRow(row),
                stranger({
                    ordinal: row.fromOrdinal,
                    regionCatalogId: row.regionId,
                    factionId: row.heldBy,
                    factionRankIndex: row.standingRequired - 1,
                    couldPutUp: {
                        spiritStones: 1_000_000,
                        holds: [somethingTheHouseHasNot(row.heldBy!)],
                        onGoodTermsWith: [row.heldBy!]
                    }
                })
            );
            expect(junior.shortBy).toBe('standing');
        }
    });

    it('asks nothing of anybody where nobody is on the door', () => {
        for (const row of PLACES_THAT_TEACH_A_DAO.filter(p => p.access !== 'held')) {
            expect(row.admits).toBe('anybody');
            expect(accessKindOf(row.admits)).toBe('public');
        }
    });
});
