/**
 * An overqualified newcomer rises by merit, and fast.
 *
 * The design owner, on where a newcomer is seated: *"join as outer disciple or
 * external elder. if you're overqualified you promote FAST cuz you can take
 * merit missions and do them easily."* The seat is `entry-offer.ts`; this file
 * pins the second half, which is what makes the bottom rung fair to somebody
 * strong: the board quotes work by the strength of whoever reads it, and the
 * rung they stand on does not cap it.
 *
 * Measured, pricing every sending reason the board posts as `dutyTermsFor`
 * quotes it to an outer disciple, best rate a day, against the 4,000
 * contribution the rungs to a six-rung house's lowest elder seat cost
 * (100 + 300 + 900 + 2,700, `requiredContributionForRank`). The overqualified
 * newcomer here stands at the elder's bar and asked for the bottom rung, which
 * the owner ruled they may: the external-elder bar is the insider's
 * (*"the same bar as internal elder, just external"*), so anybody under it is
 * an ordinary newcomer.
 *
 *   house                     at its admission bar           at its elder bar
 *   Azure Cloud Pavilion      ordinal 3:  0.65/day, 6,154 days    ordinal 10: 1.20/day, 3,333 days
 *   Sweptground Temple        ordinal 0:  0.40/day, 10,000 days   ordinal 7:  0.97/day, 4,138 days
 *   Earth Vein Tower          ordinal 3:  0.65/day, 6,154 days    ordinal 6:  0.90/day, 4,444 days
 *
 * Measured before the bar moved, just under the old outsider's bar (14, 11,
 * 10): 2,759, 3,333 and 3,529 days. Either way somebody strong buys the climb
 * in well under the time somebody at the admission bar takes, and is never
 * held at a rung by its realm bar, which the other must also cultivate past
 * rung by rung. The figures are a property of the pricing; what is asserted is
 * the order.
 */

import { describe, expect, it } from 'vitest';

import { getSect } from '../../../src/data/cultivation/sects';
import { SENDING_REASONS } from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road';
import { aPostingAsAnOffer } from '../../../src/engine/encounters/what-a-house-has-on-its-board';
import { dutyTermsFor, summonable } from '../../../src/engine/encounters/duties';
import { requiredContributionForRank } from '../../../src/engine/cultivation/what-each-rung-of-a-house-ladder-requires';
import { theRealmARungAsks } from '../../../src/server/consolidated/sect-manage';
import { offerAtTheDoorOf } from '../../../src/engine/social-leverage/entry-offer';

const HOUSES = ['sect-azure-cloud-pavilion', 'sect-sweptground-temple', 'sect-earth-vein-tower'];

/** The best contribution a day the board quotes somebody at this ordinal and rung. */
function bestRate(houseId: string, ordinal: number, rankIndex: number): number {
    const sect = getSect(houseId)!;
    const membership = {
        factionId: houseId, factionName: sect.name, rankIndex, rankCount: sect.ranks.length, contribution: 0
    };
    let best = 0;
    for (const reason of SENDING_REASONS) {
        const terms = dutyTermsFor(
            aPostingAsAnOffer({ reason, house: { id: houseId, name: sect.name }, pitchOrdinal: ordinal }),
            ordinal, membership, 'commission'
        );
        if (!summonable(terms.regard.band)) continue;
        best = Math.max(best, terms.contribution / terms.days);
    }
    return best;
}

/** Where somebody at the elder's bar, asking for the bottom, stands. */
const atTheElderBar = (id: string): number => offerAtTheDoorOf(id, 0)!.elderBar!;

/** What the rungs from the bottom to the elder's seat cost. */
function theClimb(elderRung: number): number {
    let need = 0;
    for (let rank = 1; rank <= elderRung; rank++) need += requiredContributionForRank(rank);
    return need;
}

describe('an overqualified newcomer', () => {
    it('is seated at the bottom rung when they ask for it', () => {
        for (const id of HOUSES) {
            expect(offerAtTheDoorOf(id, atTheElderBar(id), 0, true)!.offered, id).toBe(0);
        }
    });

    it('is quoted work at their own strength, whatever rung they stand on', () => {
        for (const id of HOUSES) {
            const strong = atTheElderBar(id);
            // The rung does not cap the board: an outer disciple and somebody three
            // rungs up, at the same height, are quoted the same work.
            expect(bestRate(id, strong, 0), id).toBe(bestRate(id, strong, 3));
            expect(bestRate(id, strong, 0), id).toBeGreaterThan(0);
        }
    });

    it('buys the rungs to the elder\'s seat in well under the time somebody at the admission bar takes', () => {
        for (const id of HOUSES) {
            const sect = getSect(id)!;
            const door = offerAtTheDoorOf(id, 0)!;
            const need = theClimb(door.elderRung!);
            const strongDays = need / bestRate(id, atTheElderBar(id), 0);
            const weakDays = need / bestRate(id, sect.admissionOrdinal, 0);
            expect(strongDays, id).toBeLessThan(weakDays * 0.75);
        }
    });

    /**
     * `handlePromote` asks realm and contribution. It used to ask the realm by
     * its own rule - the admission bar and four ordinals a rung - which at the
     * Azure Cloud Pavilion asked 19 of a Sword Elder promoted from inside, while
     * the door took one in from outside at 14. Now it asks the world's own
     * (`theRealmARungAsks`), and the door's elder seat asks the same of the
     * elder rung, so somebody at the elder's bar who asked for the bottom has
     * already cleared every realm bar on the way, and the contribution is the
     * whole of what stands between. Under the old rule this fails at the
     * Pavilion's rungs 2, 3 and 4, which asked 11, 15 and 19 of somebody at 10.
     */
    it('is never held at a rung by its realm bar on the way to the elder\'s seat', () => {
        for (const id of HOUSES) {
            const sect = getSect(id)!;
            const door = offerAtTheDoorOf(id, 0)!;
            const strong = atTheElderBar(id);
            for (let rank = 1; rank <= door.elderRung!; rank++) {
                expect(strong, `${id} rank ${rank}`).toBeGreaterThanOrEqual(theRealmARungAsks(sect, rank));
            }
        }
    });
});
