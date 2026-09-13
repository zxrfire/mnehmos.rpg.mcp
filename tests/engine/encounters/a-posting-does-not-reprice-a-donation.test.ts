/**
 * Adding a posting to a house's board repriced money, and nothing said so.
 *
 * `donate` credited contribution at the board's own exchange rate, read off the
 * MEDIAN SPAN of whatever was pinned up for the reader. The RULE was right - you
 * pay a discount on what the house would have paid you for the work - and the
 * ANCHOR was not: a board's contents move with the catalog, so three new sending
 * reasons, two of them `regional`, moved every median from 60 days to 90 and
 * took a hundred spirit stones from 71 contribution to 107, against a first
 * promotion that costs 100. Content that was correct in itself repriced the
 * whole economy, and whoever added it had no way to know.
 *
 * MEASURED, three seeded worlds, 342 readers at three bands, both arms in one
 * run (`scripts/probe-what-a-donation-buys.ts`):
 *
 *                   median span    100 stones bought    against the promotion
 *     bottom        30-90 (60)       36-107 (71)          0.36-1.07
 *     middle        30-90 (90)       36-107 (107)         0.01-1.07
 *     top           90    (90)      107     (107)         0.00-0.04
 *
 * 31 of the 114 readers at the bottom band could buy their next rung OUTRIGHT
 * with a hundred stones. And the anchor was not only drifting with the catalog:
 * at one rung it already came out 30, 60 or 90 days depending on the house - 27,
 * 56 and 31 readers - for no reason anybody could see or state.
 *
 * THE ANCHOR IS THE ORDINARY ERRAND, the span the contribution line is already
 * measured in, and the same sweep then reads a flat 24 contribution for a
 * hundred stones at every house and every rung: 0.24 of a first promotion, and
 * nobody buying a rung anywhere.
 *
 * WHAT IS PINNED HERE IS THE PROPERTY AND NOT THE NUMBER. The falsifiable half
 * of it is that the boards really do differ and really do move when a reason is
 * added - without that the invariance below would be a claim about a quiet
 * world - and that the rate stays the board's own errand rate, discounted, short
 * of every promotion in the catalog.
 *
 * The other half is in `tests/web/paying-into-the-ledger.test.ts`: that the
 * ledger credits THIS rate and not the board's, played. That is the assertion
 * that goes red if the median comes back, and it was red-checked by putting it
 * back.
 *
 * ONE RESIDUAL, WRITTEN DOWN RATHER THAN LICENSED. The FLOOR under a donation is
 * the house's own lowest stipend - a clerk does not open the book for less than
 * the house pays its least important member in a month - and it is per house and
 * right. At one house of 38 it is large enough that the SMALLEST donation the
 * house will take buys a first rung's worth of contribution: The Hollow Court
 * pays 500 a month at its bottom rank, and 500 stones is 119 contribution
 * against a rung of 100. Nothing here asserts against that, because the fix is
 * either a stipend or a floor and both are somebody's call rather than a
 * consequence of this anchor.
 */

import { SECTS } from '../../../src/data/cultivation/sects';
import type { SendingReason } from '../../../src/data/cultivation/why-a-house-puts-a-party-on-the-road';
import {
    commissionBoard,
    contributionPerStoneDonated,
    contributionPerStoneOnAnOrdinaryErrand,
    contributionPerStoneOverDays,
    dutyTermsFor,
    takeableOffAWall,
    DONATION_DISCOUNT,
    ORDINARY_DUTY_DAYS
} from '../../../src/engine/encounters/duties';
import {
    aPostingAsAnOffer,
    whatAHouseHasOnItsBoard
} from '../../../src/engine/encounters/what-a-house-has-on-its-board';
import { howAnAskReaches } from '../../../src/engine/encounters/how-an-ask-reaches-somebody';
import {
    requiredContributionForRank,
    requiredOrdinalForRank
} from '../../../src/engine/cultivation/what-each-rung-of-a-house-ladder-requires';
import type { HouseAsItStands } from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back';
import type { Membership } from '../../../src/engine/encounters/types';

/** The sum the finding was reported in. */
const PURSE = 100;

/**
 * The rule as it was, kept in the test that retired it.
 *
 * The property below is only worth something if the input the old rule read
 * genuinely varies, so the old rule is applied to the same boards and its
 * answers counted.
 */
function theOldAnchor(spans: readonly number[]): number {
    const sorted = [...spans].sort((a, b) => a - b);
    return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)]! : ORDINARY_DUTY_DAYS;
}

function whatTheOldRuleWouldBuy(spans: readonly number[]): number {
    return Math.round(PURSE * contributionPerStoneOverDays(theOldAnchor(spans)) * DONATION_DISCOUNT);
}

function whatADonationBuys(): number {
    return Math.round(PURSE * contributionPerStoneDonated());
}

interface Reader {
    house: HouseAsItStands;
    ordinal: number;
    rankIndex: number;
    membership: Membership;
    reach: number;
}

/**
 * A spread of houses and rungs, off the catalog.
 *
 * The house's reach is its own top rank's requirement rather than a number
 * chosen here - a house can send somebody as far as its own ladder goes - and
 * the reader stands where each rank of that ladder puts them. The two world
 * facts a catalog cannot answer are varied across the spread rather than
 * guessed at, because a house with a find and a house without have different
 * boards and that is the whole subject here.
 */
function readers(): Reader[] {
    const out: Reader[] = [];
    for (const sect of SECTS) {
        const top = Math.max(1, sect.ranks.length - 1);
        const reach = requiredOrdinalForRank(sect.admissionOrdinal, top);
        for (const rankIndex of [0, Math.floor(top / 2), top]) {
            const house: HouseAsItStands = {
                id: sect.id,
                name: sect.name,
                holdsGround: true,
                standing: {},
                hasAFind: rankIndex % 2 === 0,
                standsNearForbiddenGround: rankIndex === 0
            };
            out.push({
                house,
                ordinal: requiredOrdinalForRank(sect.admissionOrdinal, rankIndex),
                rankIndex,
                reach,
                membership: {
                    factionId: sect.id,
                    factionName: sect.name,
                    rankIndex,
                    rankCount: Math.max(2, sect.ranks.length),
                    contribution: 0
                }
            });
        }
    }
    return out;
}

/**
 * The spans on the board this reader would see, composed the way `sectBoardFor`
 * composes it: the catalogue pool plus the house's own postings, minus what
 * reaches by word of mouth and what this reader could not take off a wall.
 */
function spansOnTheBoard(reader: Reader, alsoPosted: readonly SendingReason[] = []): number[] {
    const spans = commissionBoard(reader.ordinal, reader.membership).map(o => o.terms.days);
    const posted = [
        ...whatAHouseHasOnItsBoard({
            house: reader.house,
            ordinal: reader.ordinal,
            reachOfTheHouse: reader.reach,
            reachOfTheRest: reader.reach
        }),
        ...alsoPosted.map(reason => aPostingAsAnOffer({
            reason,
            house: { id: reader.house.id, name: reader.house.name },
            pitchOrdinal: reader.ordinal
        }))
    ];
    for (const entry of posted) {
        const terms = dutyTermsFor(entry, reader.ordinal, reader.membership, 'commission');
        const reaches = howAnAskReaches({
            pitchOrdinal: terms.pitchOrdinal,
            reachOfTheHouse: reader.reach
        });
        if (reaches === 'word_of_mouth') continue;
        if (!takeableOffAWall(terms.regard.band)) continue;
        spans.push(terms.days);
    }
    return spans;
}

/**
 * A duty reason somebody adds tomorrow, in the shape of the two that caused
 * this: `daysFor` gives a regional sending 90 days, the long end of what a board
 * carries.
 */
const ONE_MORE_REASON: SendingReason = {
    id: 'sending-to-a-thing-somebody-added-later',
    name: 'A reason added later',
    what: 'A perfectly ordinary errand added to the catalog by somebody working on '
        + 'something else entirely, which is the whole point of it.',
    needs: 'nothing',
    ceilingOrdinal: null,
    days: 90,
    hands: 4,
    atStake: 'stones',
    factKind: 'treasure_found',
    scale: 'regional',
    weight: 20
};

describe('the board\'s contents do not price money', () => {
    it('priced it three ways at one rung, and now prices it one way at every rung', () => {
        const spread = readers();
        expect(spread.length).toBeGreaterThan(50);

        const oldAnswers = new Set<number>();
        const answers = new Set<number>();
        for (const reader of spread) {
            oldAnswers.add(whatTheOldRuleWouldBuy(spansOnTheBoard(reader)));
            answers.add(whatADonationBuys());
        }

        // The board is a live input and always was: the same hundred stones met
        // several different answers across the catalog, by house and by rung.
        expect(oldAnswers.size, 'the boards no longer differ, so this proves nothing')
            .toBeGreaterThan(1);
        expect(answers.size).toBe(1);
    });

    it('does not move when a duty reason is added', () => {
        let boardsThatCarriedIt = 0;
        let boardsThatMoved = 0;
        for (const reader of readers()) {
            const before = spansOnTheBoard(reader);
            const after = spansOnTheBoard(reader, [ONE_MORE_REASON]);
            // A notice pitched at a reader standing at their house's own reach
            // is carried by a person rather than nailed up, so the new row does
            // not reach every board. Where it does, the board is one longer.
            expect(after.length).toBeGreaterThanOrEqual(before.length);
            if (after.length > before.length) boardsThatCarriedIt++;
            if (whatTheOldRuleWouldBuy(before) !== whatTheOldRuleWouldBuy(after)) {
                boardsThatMoved++;
            }
        }
        expect(boardsThatCarriedIt, 'the new reason reached no board at all').toBeGreaterThan(0);

        // One posting, and what money was worth moved under the old rule. That
        // is the defect stated as a measurement rather than as a story.
        expect(boardsThatMoved, 'a 90 day reason moved no board, so nothing is being guarded')
            .toBeGreaterThan(0);
    });

    it('is the board\'s own rate for an ordinary errand, discounted', () => {
        // Nothing invented. `dutyTermsFor` prices a duty as
        //     contribution = base * yieldScale * (days / ORDINARY_DUTY_DAYS)
        //     stones       = base * yieldScale * STONES_PER_ERRAND_OF_CONTRIBUTION
        // so at the ordinary span the base, the pitch and the regard all cancel
        // and what is left is the one exchange rate the board has.
        expect(contributionPerStoneDonated())
            .toBeCloseTo(contributionPerStoneOnAnOrdinaryErrand() * DONATION_DISCOUNT, 12);
        expect(contributionPerStoneDonated())
            .toBeLessThan(contributionPerStoneOnAnOrdinaryErrand());
        // And buying stays strictly worse than serving whatever is posted: the
        // shortest span a board can carry is a timed row at 12 days.
        expect(contributionPerStoneDonated()).toBeLessThan(contributionPerStoneOverDays(12));
    });
});

describe('and a rung is not bought by accident', () => {
    /**
     * The symptom that made the coupling visible: a hundred stones buying 107
     * contribution against a first promotion of 100.
     */
    it('leaves a hundred stones short of every promotion in the catalog', () => {
        for (const reader of readers()) {
            const rung = requiredContributionForRank(reader.rankIndex + 1);
            expect(whatADonationBuys(), `${reader.house.name} rank ${reader.rankIndex}`)
                .toBeLessThan(rung);
        }
        // Against the cheapest rung in the game, which is the tightest case.
        expect(whatADonationBuys() / requiredContributionForRank(1)).toBeLessThan(0.5);
    });
});
