/**
 * The world can reach somebody who is in no house.
 *
 * MEASURED, BEFORE. Over 8 worlds x 10 sentences, played through the turn loop
 * (`scripts/probe-how-often-the-world-cuts-a-sentence-short.ts`):
 *
 *                                       rogue    in a house
 *   spans the world shortened            0.0%       41.7%
 *
 * The only world consequence that could reach a played cultivator was their own
 * house's business - a sect's grant on its vein coming up for renewal, which is
 * the entire seeded schedule: ten effects per world, `factionId` set,
 * `locationId` null, `interrupts` false. A rogue matched none of it, at any
 * place, ever, and the agency rule's first limiter - *the world interrupts you* -
 * was a membership benefit.
 *
 * WHAT THE WORLD ACTUALLY HAS ON THE BOOKS, measured on three fixture worlds
 * (`cut-short-world-0..2`): 49 opportunity windows each. 43 come round annually
 * or oftener; 6 come round every 46 to 116 years. There is NOTHING in between.
 * The annual ones are one ripening per region - the ordinary business of a
 * place. The rare ones are one sealed ground per region. That gap is why a
 * rarity rule here is a chasm rather than a knife edge, and it is what this
 * rule reads.
 *
 * THE RULE, and note which two things it is made of:
 *
 *   > A window that opens where somebody is standing, and does not come round
 *   > again before their span runs out, stops them.
 *
 * A fact about the world - how often this ground opens - read against a fact
 * about the body - how long there is left to wait with. No constant, no
 * taxonomy of verbs, and nothing about how a sentence may be shaped. It is also
 * why the three heights read differently rather than the same: sixty years is
 * the only chance a Qi Condensation cultivator gets, and it is weather to
 * somebody carrying thirty thousand. The one who can wait is not stood up.
 *
 * `onOpportunityOpens` is NOT what was flipped, and must not be. That flag is
 * about being told a door is open SOMEWHERE, and on these worlds every one of
 * 869 sites has an annual ripening in the chain of places containing it - 100%,
 * measured - so turning it on interrupts every span every year. This rule
 * enters by the door every other local event enters by: an explicit match on
 * where they are standing, which a shut door empties.
 *
 * RED-CHECKED by dropping `theOnlyOneTheyWillGet` from the condition (the
 * annual window then stops everybody) and by comparing from today rather than
 * from the day it opens (the late-opening case below goes green-to-red).
 */

import { describe, it, expect } from 'vitest';

import { advanceTime, whenTheWorldWouldInterrupt } from '../../../src/engine/world/time.js';
import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeOpportunity } from '../../../src/engine/world/opportunities.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import type { InterruptPolicy } from '../../../src/engine/world/time.js';

const YEAR = 365;

/**
 * A region, a site inside it, and one person standing on the site.
 *
 * `yearsLeft` is written onto the row rather than reached by playing a body to
 * the right age: the rule reads one number off the roster and this is that
 * number. The played half of this is the probe named in the header.
 */
function aWorldWithSomebodyStandingSomewhere(yearsLeft: number): WorldState {
    const bare = createWorld({ seed: 'window-fixture' });
    const day = Math.floor(bare.currentDay);
    const person = createNpc('window-fixture', {
        id: 'npc-standing', name: 'Shen Liefeng', bornOnDay: day - 20 * YEAR, onDay: day
    });
    return {
        ...bare,
        locations: [
            ...bare.locations,
            makeLocation({ id: 'loc-region', name: 'The Jade Gorge', kind: 'region' }),
            makeLocation({
                id: 'loc-site', name: 'Plum Village', kind: 'settlement', parentId: 'loc-region'
            })
        ],
        npcs: [
            ...bare.npcs,
            {
                ...person,
                locationId: 'loc-site',
                cultivation: { ...person.cultivation, lifespanEndsOnDay: day + yearsLeft * YEAR }
            }
        ]
    };
}

/** A window on the region above them, opening in `opensInYears` and repeating. */
function withAWindow(
    state: WorldState,
    opensInYears: number,
    everyYears: number | null
): WorldState {
    const day = Math.floor(state.currentDay);
    return {
        ...state,
        opportunities: [
            makeOpportunity({
                id: 'opp-sealed-ground',
                kind: 'realm_opening',
                name: 'the sealed ground under The Jade Gorge',
                summary: 'The ground under the gorge is open.',
                locationId: 'loc-region',
                opensOnDay: day + opensInYears * YEAR,
                durationDays: 30,
                recurrenceDays: everyYears === null ? null : everyYears * YEAR
            })
        ]
    };
}

/**
 * The policy production builds, restated here rather than imported.
 *
 * `whatReachesSomebodySpendingASpanHere` lives in `src/web/` and this is an
 * engine test; what matters to the rule is the two fields it sets, and the
 * played arm that proves the real policy reaches this code is
 * `the-world-can-cut-a-sentence-in-half.test.ts`.
 */
function standingHere(sealed = false): InterruptPolicy {
    return {
        actorId: 'npc-standing',
        locationIds: sealed ? [] : ['loc-site', 'loc-region'],
        factionIds: [],
        onScheduledInterrupt: true,
        onActorInvolved: true,
        onLocalEvents: !sealed,
        onOpportunityOpens: false,
        onOpportunityCloses: false
    };
}

describe('a window that does not come round again', () => {
    it('stops somebody standing where it opens', () => {
        // Eighty-four years left, a ground that opens in twelve and then not for
        // another ninety-eight. There is no second one for this person.
        const state = withAWindow(aWorldWithSomebodyStandingSomewhere(84), 12, 98);
        const from = Math.floor(state.currentDay);

        const found = whenTheWorldWouldInterrupt(state, standingHere(), from, 30 * YEAR);
        expect(found, 'the ground under them opened inside the span').not.toBeNull();
        expect(found!.onDay - from).toBe(12 * YEAR);
        expect(found!.cause).toBe('window_not_coming_again');
        expect(found!.locationId).toBe('loc-region');
    });

    it('does not stop them for the ordinary business of the place', () => {
        // The same ground, opening on the same day, coming round every year.
        // This is the one that must not fire: every site in these worlds has an
        // annual window in the chain above it.
        const state = withAWindow(aWorldWithSomebodyStandingSomewhere(84), 12, 1);
        expect(
            whenTheWorldWouldInterrupt(
                state, standingHere(), Math.floor(state.currentDay), 30 * YEAR
            )
        ).toBeNull();
    });

    it('does not stop somebody who can wait for the next one', () => {
        // Thirty thousand years left. A ninety-eight year cycle is weather.
        const state = withAWindow(aWorldWithSomebodyStandingSomewhere(30_000), 12, 98);
        expect(
            whenTheWorldWouldInterrupt(
                state, standingHere(), Math.floor(state.currentDay), 30 * YEAR
            ),
            'the same ground, the same day, a body that outlasts the cycle'
        ).toBeNull();
    });

    it('asks from the day it opens, not from today', () => {
        // Eighty-four years left and a sixty-seven year cycle: from today the
        // cycle is shorter than the span left, so a naive reading says they get
        // another. They do not - this one opens in year twenty-five, and the
        // next falls in year ninety-two, past the end. This is the case the
        // first cut of the rule got wrong, and it is the case that matters:
        // somebody with exactly one chance left.
        const state = withAWindow(aWorldWithSomebodyStandingSomewhere(84), 25, 67);
        const found = whenTheWorldWouldInterrupt(
            state, standingHere(), Math.floor(state.currentDay), 30 * YEAR
        );
        expect(found, '25 + 67 is past 84').not.toBeNull();
        expect(found!.cause).toBe('window_not_coming_again');
    });

    it('is kept out by a shut door', () => {
        // The door empties `locationIds`, which is the one fact this rule reads
        // about where they are. Sealing yourself in costs you the ruin opening,
        // and that is the trade a seal is.
        const state = withAWindow(aWorldWithSomebodyStandingSomewhere(84), 12, 98);
        expect(
            whenTheWorldWouldInterrupt(
                state, standingHere(true), Math.floor(state.currentDay), 30 * YEAR
            )
        ).toBeNull();
    });

    it('claims nothing about somebody the world has no row for', () => {
        // The rule is half a fact about a body. With no body there is no rule -
        // not a default, and not a guess at one.
        const state = withAWindow(aWorldWithSomebodyStandingSomewhere(84), 12, 98);
        expect(
            whenTheWorldWouldInterrupt(
                state,
                { ...standingHere(), actorId: 'npc-nobody-has-heard-of' },
                Math.floor(state.currentDay),
                30 * YEAR
            )
        ).toBeNull();
    });

    it('does not fire for a window already standing open when they sat down', () => {
        // Something they walked past is not the world cutting in.
        const state = withAWindow(aWorldWithSomebodyStandingSomewhere(84), 0, 98);
        expect(
            whenTheWorldWouldInterrupt(
                state, standingHere(), Math.floor(state.currentDay), 30 * YEAR
            )
        ).toBeNull();
    });

    it('agrees with the advance it is a forecast of', () => {
        // The property the whole lookahead rests on: it is a READ, and a read
        // that disagreed with the advance would cut a span short for a reason
        // the world then never produced. Both go through the same rule.
        const state = withAWindow(aWorldWithSomebodyStandingSomewhere(84), 12, 98);
        const from = Math.floor(state.currentDay);
        const policy = standingHere();

        const forecast = whenTheWorldWouldInterrupt(state, policy, from, 30 * YEAR);
        const moved = advanceTime(state, 30 * YEAR, {
            interruptPolicy: policy, stopOnInterrupt: true
        });

        expect(moved.interrupted).toBe(true);
        expect(moved.interrupts[0]!.onDay).toBe(forecast!.onDay);
        expect(moved.interrupts[0]!.sourceId).toBe(forecast!.sourceId);
        expect(moved.daysAdvanced).toBe(forecast!.onDay - from);
    });

    it('gives the same answer however the span is chopped', () => {
        // The driver advances a year at a time. A rule whose answer depended on
        // the size of the slice would make a played span a property of how the
        // caller chopped it - which is why the comparison is against a lifespan
        // and never against the span being asked for.
        const state = withAWindow(aWorldWithSomebodyStandingSomewhere(84), 12, 98);
        const from = Math.floor(state.currentDay);
        const whole = whenTheWorldWouldInterrupt(state, standingHere(), from, 30 * YEAR);

        let found: number | null = null;
        for (let y = 0; y < 30 && found === null; y++) {
            const slice = whenTheWorldWouldInterrupt(
                state, standingHere(), from + y * YEAR, YEAR
            );
            if (slice) found = slice.onDay;
        }
        expect(found).toBe(whole!.onDay);
    });
});
