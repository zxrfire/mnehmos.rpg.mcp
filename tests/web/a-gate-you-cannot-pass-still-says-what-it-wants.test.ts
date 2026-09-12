/**
 * NOT HAVING THE STANDING TO DO SOMETHING IS NOT THE SAME AS SEEING NOTHING.
 *
 * Held dao ground answered every outsider *"you are not one of theirs"* - 1998
 * times across 1702 reads in a two-world, three-band sweep - and that sentence
 * carries nothing a player can act on. A refusal is content when it says what is
 * actually there, why it is not yours, and what would change that; a refusal
 * that hides the thing is an empty hillside.
 *
 * So each of the three restricted terms has to reach the player as a PRICE. The
 * fee has to be a figure, the copy has to say what kind of thing would do, and
 * the relations one has to say plainly that money is not the answer - otherwise
 * a player pays at the wrong gate and learns nothing from being turned away.
 *
 * Pinned on what the sentence CLAIMS rather than on its wording, except the
 * figure, which is the one thing that has to be exact: a refusal quoting a price
 * nobody could pay would be worse than no price at all.
 */

import { describe, it, expect } from 'vitest';

import {
    PLACES_THAT_TEACH_A_DAO,
    type PlaceThatTeachesADao,
    type WhoMaySit
} from '../../src/data/cultivation/places-that-teach-a-dao';
import { groundFromCatalogRow, howSomebodyStandsToAGround }
    from '../../src/engine/world/how-a-cultivator-comes-by-a-road';
import { feeForSittingOn } from '../../src/engine/world/what-a-house-asks-of-somebody-not-of-it';
import { whatThisGroundWants, type GroundNearby } from '../../src/web/ground-that-teaches-a-road';
import { getSect } from '../../src/data/cultivation/sects';

const heldWith = (admits: WhoMaySit): PlaceThatTeachesADao =>
    PLACES_THAT_TEACH_A_DAO.find(p => p.access === 'held' && p.admits === admits)!;

/** A stranger standing in the province, high enough to read it, carrying nothing. */
function turnedAwayFrom(row: PlaceThatTeachesADao) {
    const who = {
        ordinal: row.fromOrdinal,
        regionCatalogId: row.regionId,
        factionId: null,
        factionRankIndex: -1,
        couldPutUp: { spiritStones: 0, holds: [], onGoodTermsWith: [] }
    };
    const ground = groundFromCatalogRow(row);
    const nearby: GroundNearby = {
        id: `loc-${row.id}`,
        name: row.name,
        domain: row.domain,
        subject: row.subject,
        ground,
        standing: howSomebodyStandsToAGround(ground, who),
        underfoot: true
    };
    return { who, wants: whatThisGroundWants(nearby, who)! };
}

describe('a gate an outsider cannot pass still says what it wants', () => {
    it('quotes the fee, and quotes the figure the gate would actually take', () => {
        const row = heldWith('a fee');
        const { wants } = turnedAwayFrom(row);
        const fee = feeForSittingOn(row.fromOrdinal)!;
        expect(wants.shortBy).toBe('the_fee');
        expect(`${wants.because} ${wants.wouldWork}`).toContain(String(fee));
        // Whose it is, which is the half a player needs to go and find them.
        expect(wants.because).toContain(getSect(row.heldBy!)!.name);
    });

    it('says what a copy has to be, since the wrong one is not payment', () => {
        const { wants } = turnedAwayFrom(heldWith('a copy'));
        expect(wants.shortBy).toBe('nothing_to_write_out');
        expect(wants.wouldWork.toLowerCase()).toContain('write it out');
        expect(wants.wouldWork.toLowerCase()).toContain('does not already hold');
    });

    it('says outright that money does not answer the house that wants to know you', () => {
        const { wants } = turnedAwayFrom(heldWith('good relations'));
        expect(wants.shortBy).toBe('a_stranger_to_them');
        expect(wants.wouldWork.toLowerCase()).toContain('money does not answer');
    });

    it('still tells somebody turned away from a private ground whose it is', () => {
        const row = heldWith('its own');
        const { wants } = turnedAwayFrom(row);
        expect(wants.shortBy).toBe('not_of_the_house');
        expect(wants.because).toContain(getSect(row.heldBy!)!.name);
        // And the honest part: there is no price, rather than a price withheld.
        expect(wants.because.toLowerCase()).toContain('no price');
    });

    it('never refuses without saying what would change it', () => {
        // Ground a house holds open refuses nobody standing on it, so there is
        // no refusal to read. That is the case this axis was built to make
        // possible and it is not an omission here.
        for (const row of PLACES_THAT_TEACH_A_DAO.filter(
            p => p.access === 'held' && p.admits !== 'anybody'
        )) {
            const { wants } = turnedAwayFrom(row);
            expect(wants.wouldWork.length, row.id).toBeGreaterThan(20);
            expect(wants.because, row.id).toContain(row.name);
        }
    });
});
