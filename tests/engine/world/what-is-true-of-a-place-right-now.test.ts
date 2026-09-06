/**
 * What is true of a place right now.
 *
 * Four design decisions live only as behaviour in this layer, and each one has
 * a test below named for it, because a decision that lives only as a number or
 * a shape gets silently reverted by the next person who finds it surprising.
 *
 * 1. **Statuses end.** A famine that never lifts is a worse bug than no famine,
 *    so an open-ended status is not representable: `makeAreaStatus` refuses one
 *    with no review date, and an unattended status expires at its review rather
 *    than persisting.
 * 2. **What a status does is not gated on knowing about it.** A famine stops
 *    the millet for a traveller who has never heard the word. Knowing buys the
 *    reason, the warning and the way out - never the effect.
 * 3. **A cause somebody chose and a cause nothing chose are the same row.** A
 *    war and a drought differ by one field carrying a value, and nothing
 *    branches on it. If a `kind` ever reaches a branch, this layer has failed.
 * 4. **A status is true of an area and everything under it, and nothing over
 *    it.** A worked-out district is not a worked-out province.
 * 5. **The price dial is per TYPE of good, and the scalar is what a type it has
 *    no opinion about costs.** A famine raises food and DROPS lodging, because
 *    the roads empty; one number cannot say that. The effect is carried by the
 *    status, so decision 3 survives it - a per-type dial under an invented kind
 *    behaves exactly like one under a famine.
 *
 * And one boundary: presence is read off `NpcRecord.locationId`. This module
 * stores no second copy of who is where, which is why `whoIsInArea` is tested
 * against NPCs the ordinary factory made and never against a roster of its own.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    STOPS_PASSAGE,
    areaChainOf,
    dangerDeltaInArea,
    daysStatusHasRun,
    daysUntilStatusReview,
    extendStatus,
    isStatusRunningOn,
    isStoppedInArea,
    liftStatus,
    localCeilingFor,
    makeAreaStatus,
    passageStoppedInArea,
    priceMultiplierInArea,
    readStatusAtStage,
    statusesInArea,
    stoppedInArea,
    whatIsGoingOnHere,
    whatTheGroundDoesToPrices,
    whoIsInArea,
    type AreaStatus
} from '../../../src/engine/world/what-is-true-of-a-place-right-now.js';
import { makeLocation, type LocationRecord } from '../../../src/engine/world/locations.js';
import { createNpc } from '../../../src/engine/world/npc-state.js';
import type { KnowingStage } from '../../../src/engine/social/discovery.js';

// ─────────────────────────────────────────────────────────────────────────
// A SMALL PROVINCE
// province -> town -> district, so containment has something to be wrong about
// ─────────────────────────────────────────────────────────────────────────

function places(): LocationRecord[] {
    return [
        makeLocation({ id: 'loc-province', name: 'The Jade Gorge', kind: 'region' }),
        makeLocation({
            id: 'loc-town', name: 'Iron Ridge', kind: 'settlement', parentId: 'loc-province'
        }),
        makeLocation({
            id: 'loc-prefecture', name: 'The Six Li Cut', kind: 'wilderness', parentId: 'loc-town'
        }),
        makeLocation({
            id: 'loc-elsewhere', name: 'Willow Village', kind: 'settlement', parentId: 'loc-province'
        }),
        makeLocation({ id: 'loc-far', name: 'The Silent Cliffs', kind: 'region' })
    ];
}

const FAMINE_BEGAN = 1000;

/** A cause nothing chose. The harvest failed; nobody decided it. */
function famine(over = 'loc-province'): AreaStatus {
    return makeAreaStatus({
        id: 'status-famine',
        areaId: over,
        kind: 'famine',
        statement: 'There is not enough food here and there will not be until the spring.',
        cause: {
            what: 'Two sowings failed on ground that had been cropped without rest for nine years.',
            decidedById: null,
            factId: null
        },
        signs: [
            'the grain price at the weigh house moved twice in a month and did not come back',
            'the carters who bring millet up the gorge stopped taking return loads'
        ],
        causeKnownLocally: false,
        beganOnDay: FAMINE_BEGAN,
        reviewOnDay: FAMINE_BEGAN + 200,
        stops: ['millet', 'bread'],
        priceMultiplier: 3,
        dangerDelta: 0.05
    });
}

/** A cause somebody chose. Same row, one field filled in. */
function war(over = 'loc-town'): AreaStatus {
    return makeAreaStatus({
        id: 'status-war',
        areaId: over,
        kind: 'war',
        statement: 'Two houses are fighting over the water here.',
        cause: {
            what: 'The Alliance called in a crossing debt it had held for sixty years.',
            decidedById: 'sect-clear-river-fordhall',
            factId: 'fact-the-debt-called'
        },
        signs: ['the ferries stopped running and nobody would say who told them to'],
        causeKnownLocally: true,
        beganOnDay: FAMINE_BEGAN,
        reviewOnDay: FAMINE_BEGAN + 90,
        stops: [STOPS_PASSAGE],
        priceMultiplier: 2,
        dangerDelta: 0.3
    });
}

const AT = FAMINE_BEGAN + 30;

// ─────────────────────────────────────────────────────────────────────────

describe('a status has to end, and the type will not let you write one that does not', () => {
    it('refuses a status with no review day, because that is the never-lifting bug', () => {
        expect(() => makeAreaStatus({
            id: 'status-bad', areaId: 'loc-town', kind: 'famine', statement: 'x',
            cause: { what: 'y', decidedById: null, factId: null },
            beganOnDay: 10, reviewOnDay: Number.NaN
        })).toThrow(/never lifts/);
    });

    it('refuses a status reviewed before it began', () => {
        expect(() => makeAreaStatus({
            id: 'status-bad', areaId: 'loc-town', kind: 'famine', statement: 'x',
            cause: { what: 'y', decidedById: null, factId: null },
            beganOnDay: 10, reviewOnDay: 10
        })).toThrow(/at least a day/);
    });

    it('expires an unattended status at its review rather than letting it run forever', () => {
        const f = famine();
        expect(isStatusRunningOn(f, FAMINE_BEGAN - 1)).toBe(false);
        expect(isStatusRunningOn(f, FAMINE_BEGAN)).toBe(true);
        expect(isStatusRunningOn(f, f.reviewOnDay - 1)).toBe(true);
        expect(isStatusRunningOn(f, f.reviewOnDay)).toBe(false);
        expect(isStatusRunningOn(f, f.reviewOnDay + 10_000)).toBe(false);
    });

    it('stops on the day it is lifted, whatever its review said', () => {
        const f = liftStatus(famine(), FAMINE_BEGAN + 50);
        expect(isStatusRunningOn(f, FAMINE_BEGAN + 49)).toBe(true);
        expect(isStatusRunningOn(f, FAMINE_BEGAN + 50)).toBe(false);
        expect(daysStatusHasRun(f, FAMINE_BEGAN + 400)).toBe(50);
    });

    it('extends forward and refuses to extend backward, because that is how one goes permanent', () => {
        const f = famine();
        const longer = extendStatus(f, f.reviewOnDay + 100);
        expect(isStatusRunningOn(longer, f.reviewOnDay + 10)).toBe(true);
        expect(() => extendStatus(f, f.reviewOnDay)).toThrow(/forward/);
        expect(() => extendStatus(f, f.beganOnDay + 1)).toThrow(/forward/);
    });

    it('counts the days it has run and the days to review without going negative', () => {
        const f = famine();
        expect(daysStatusHasRun(f, FAMINE_BEGAN - 5)).toBe(0);
        expect(daysStatusHasRun(f, AT)).toBe(30);
        // Past the review it stops accruing. It is not still running.
        expect(daysStatusHasRun(f, FAMINE_BEGAN + 10_000)).toBe(200);
        expect(daysUntilStatusReview(f, AT)).toBe(170);
        expect(daysUntilStatusReview(f, FAMINE_BEGAN + 10_000)).toBe(0);
    });
});

describe('a status is true of an area and of everything under it', () => {
    it('walks the chain innermost first', () => {
        expect(areaChainOf(places(), 'loc-prefecture'))
            .toEqual(['loc-prefecture', 'loc-town', 'loc-province']);
        expect(areaChainOf(places(), 'loc-province')).toEqual(['loc-province']);
        expect(areaChainOf(places(), null)).toEqual([]);
        expect(areaChainOf(places(), 'loc-nothing')).toEqual([]);
    });

    it('reaches down from a province into a town in it', () => {
        const found = statusesInArea([famine('loc-province')], places(), 'loc-prefecture', AT);
        expect(found.map(s => s.id)).toEqual(['status-famine']);
    });

    it('does not reach up: a district closed is not a province closed', () => {
        // Note what this status is and is not. Whether the ground still has
        // anything in it is a COUNT, and it lives in
        // `what-a-place-still-has-in-the-ground.ts`, whose `readingFor` answers
        // 'worked_out' off that number. What is here is the DECISION somebody
        // took in consequence, which no count recovers.
        const closed = makeAreaStatus({
            id: 'status-cut-closed',
            areaId: 'loc-prefecture',
            kind: 'closed_to_gathering',
            statement: 'The cut is closed and the crews have been called off it.',
            cause: {
                what: 'The house that holds the ground stopped issuing faces after the assay came back short.',
                decidedById: 'sect-azure-cloud',
                factId: null
            },
            beganOnDay: FAMINE_BEGAN,
            reviewOnDay: FAMINE_BEGAN + 3650
        });
        expect(statusesInArea([closed], places(), 'loc-prefecture', AT).map(s => s.id))
            .toEqual(['status-cut-closed']);
        expect(statusesInArea([closed], places(), 'loc-town', AT)).toEqual([]);
        expect(statusesInArea([closed], places(), 'loc-province', AT)).toEqual([]);
    });

    it('does not leak into another province', () => {
        expect(statusesInArea([famine('loc-province')], places(), 'loc-far', AT)).toEqual([]);
    });

    it('orders innermost first, so the most local answer is read first', () => {
        const found = statusesInArea([famine('loc-province'), war('loc-town')], places(), 'loc-prefecture', AT);
        expect(found.map(s => s.id)).toEqual(['status-war', 'status-famine']);
    });
});

describe('what a status does is not gated on knowing about it', () => {
    it('stops the millet for somebody who has never heard the word famine', () => {
        // No stage is passed anywhere in this test. That is the point.
        expect(stoppedInArea([famine()], places(), 'loc-town', AT)).toEqual(['bread', 'millet']);
        expect(isStoppedInArea([famine()], places(), 'loc-town', AT, 'millet')).toBe(true);
        expect(isStoppedInArea([famine()], places(), 'loc-town', AT, 'salt')).toBe(false);
    });

    it('reads the same whether the knower is unaware or has the cause', () => {
        const world = [famine(), war()];
        const stopped = stoppedInArea(world, places(), 'loc-town', AT);
        const price = priceMultiplierInArea(world, places(), 'loc-town', AT);
        for (const stage of ['unaware', 'whisper', 'named', 'placed', 'encountered', 'known'] as const) {
            // The reading changes with the stage; the effect does not.
            const said = whatIsGoingOnHere(world, places(), 'loc-town', AT, () => stage);
            expect(said.length, stage).toBe(stage === 'unaware' ? 0 : 2);
            expect(stoppedInArea(world, places(), 'loc-town', AT)).toEqual(stopped);
            expect(priceMultiplierInArea(world, places(), 'loc-town', AT)).toBe(price);
        }
    });

    /**
     * THESE FOUR FIGURES ARE THE DEGRADE-TO-YESTERDAY CASE, AND THEY ARE KEPT.
     *
     * `famine()` and `war()` above set a scalar and no per-type dial, which is
     * every writer that existed before types did - the world sim, a saved row
     * off an older database, a test. Asked with no category, they answer 3, 2,
     * 6 and 1 exactly as they always did. If any of these ever moves, a writer
     * somewhere has had a behaviour changed under it without being edited.
     */
    it('multiplies prices across statuses, so two things going wrong is worse than either', () => {
        expect(priceMultiplierInArea([famine()], places(), 'loc-town', AT)).toBe(3);
        expect(priceMultiplierInArea([war()], places(), 'loc-town', AT)).toBe(2);
        expect(priceMultiplierInArea([famine(), war()], places(), 'loc-town', AT)).toBe(6);
        expect(priceMultiplierInArea([], places(), 'loc-town', AT)).toBe(1);
        // And a scalar-only status answers the same for every type of good,
        // which is the sentence "it degrades to today's behaviour" said in code.
        for (const c of ['food', 'lodging', 'tool', 'medicine'] as const) {
            expect(priceMultiplierInArea([famine()], places(), 'loc-town', AT, c), c).toBe(3);
        }
    });

    it('adds danger rather than replacing it, and reports nothing when nothing is wrong', () => {
        expect(dangerDeltaInArea([famine(), war()], places(), 'loc-town', AT)).toBeCloseTo(0.35, 6);
        expect(dangerDeltaInArea([], places(), 'loc-town', AT)).toBe(0);
        // Lifted statuses do nothing at all.
        expect(dangerDeltaInArea([liftStatus(war(), AT)], places(), 'loc-town', AT)).toBe(0);
    });
});

describe('the price dial is per type of good, because one number cannot say famine', () => {
    /**
     * The same failed harvest, written the way the world writes one now.
     *
     * The design owner, on what a single dial could not express: *also why
     * would the famine move the cost of an inn bed. it should DROP it.*
     */
    function harvestFailed(over = 'loc-province'): AreaStatus {
        return makeAreaStatus({
            ...famine(over),
            id: 'status-harvest',
            priceMultiplier: 1,
            priceMultiplierByCategory: { food: 4, lodging: 0.5, transport: 1.6 }
        });
    }

    it('raises the food and drops the beds, on the same ground on the same day', () => {
        const here = [harvestFailed()];
        expect(priceMultiplierInArea(here, places(), 'loc-town', AT, 'food')).toBe(4);
        expect(priceMultiplierInArea(here, places(), 'loc-town', AT, 'lodging')).toBe(0.5);
        expect(priceMultiplierInArea(here, places(), 'loc-town', AT, 'transport')).toBe(1.6);
    });

    it('leaves a type it has no opinion about at the scalar, which is the whole of the fallback', () => {
        const here = [harvestFailed()];
        // A chisel and a letter written are not a famine's business.
        expect(priceMultiplierInArea(here, places(), 'loc-town', AT, 'tool')).toBe(1);
        expect(priceMultiplierInArea(here, places(), 'loc-town', AT, 'service')).toBe(1);
        // And asked with no category at all, which is what every caller written
        // before this existed does.
        expect(priceMultiplierInArea(here, places(), 'loc-town', AT)).toBe(1);
    });

    /**
     * The stacking rule, and it is the one that is easy to get wrong: a type
     * one status named is still multiplied by every OTHER status's scalar.
     */
    it('stacks a typed status onto an untyped one rather than letting either win', () => {
        const both = [harvestFailed(), war('loc-town')];
        // The war doubles the whole board; the famine quadruples the food.
        expect(priceMultiplierInArea(both, places(), 'loc-town', AT, 'food')).toBe(8);
        // And the beds are half of double, which is where they started. A war
        // fills the inns and a famine empties them, and nothing here decided
        // which of the two is more important.
        expect(priceMultiplierInArea(both, places(), 'loc-town', AT, 'lodging')).toBe(1);
        expect(priceMultiplierInArea(both, places(), 'loc-town', AT, 'tool')).toBe(2);
    });

    it('reads backwards too: what has this ground moved, and by how much', () => {
        const read = whatTheGroundDoesToPrices(
            [harvestFailed(), war('loc-town')], places(), 'loc-town', AT
        );
        expect(read.everythingElse).toBe(2);
        expect(read.byCategory).toEqual({ food: 8, lodging: 1, transport: 3.2 });
        // Nothing going on is an empty map rather than eight ones, so a caller
        // can tell "quiet" from "moved and came back to 1".
        expect(whatTheGroundDoesToPrices([], places(), 'loc-town', AT))
            .toEqual({ everythingElse: 1, byCategory: {} });
    });

    it('carries the effect on the status rather than reading it off the kind', () => {
        // The same per-type dial under a kind nothing has ever seen. If this
        // ever needed a `kind` anywhere, the design has failed - see the fourth
        // decision at the top of this file.
        const invented = makeAreaStatus({
            id: 'status-salt-road',
            areaId: 'loc-town',
            kind: 'the-salt-road-has-been-cut-for-a-season',
            statement: 'Nothing is coming up from the flats.',
            cause: { what: 'A washout nobody has money to clear.', decidedById: null, factId: null },
            beganOnDay: FAMINE_BEGAN,
            reviewOnDay: FAMINE_BEGAN + 90,
            priceMultiplierByCategory: { food: 2.5, lodging: 0.7 }
        });
        expect(priceMultiplierInArea([invented], places(), 'loc-town', AT, 'food')).toBe(2.5);
        expect(priceMultiplierInArea([invented], places(), 'loc-town', AT, 'lodging')).toBe(0.7);
        expect(priceMultiplierInArea([invented], places(), 'loc-town', AT, 'tool')).toBe(1);
    });

    it('does not gate any of it on knowing, same as everything else in this layer', () => {
        const here = [harvestFailed()];
        for (const stage of ['unaware', 'known'] as const) {
            whatIsGoingOnHere(here, places(), 'loc-town', AT, () => stage);
            expect(priceMultiplierInArea(here, places(), 'loc-town', AT, 'food'), stage).toBe(4);
        }
    });

    it('reaches down from a province into a town, the same as the scalar does', () => {
        expect(priceMultiplierInArea(
            [harvestFailed('loc-province')], places(), 'loc-prefecture', AT, 'food'
        )).toBe(4);
        // And does not leak into a province it is not true of.
        expect(priceMultiplierInArea(
            [harvestFailed('loc-province')], places(), 'loc-far', AT, 'food'
        )).toBe(1);
    });

    it('does not let a caller mutate a status through the map it handed over', () => {
        const dial = { food: 4 };
        const status = makeAreaStatus({ ...famine(), priceMultiplierByCategory: dial });
        dial.food = 99;
        expect(priceMultiplierInArea([status], places(), 'loc-town', AT, 'food')).toBe(4);
    });
});

describe('a cause somebody chose and a cause nothing chose are the same row', () => {
    it('separates them by a field carrying a value and by nothing else', () => {
        expect(famine().cause.decidedById).toBeNull();
        expect(war().cause.decidedById).toBe('sect-clear-river-fordhall');
        // Same shape, same treatment: both run, both stop things, both are read
        // the same way at the same stage.
        const both = [famine(), war()];
        expect(statusesInArea(both, places(), 'loc-town', AT)).toHaveLength(2);
        const readings = both.map(s => readStatusAtStage(s, 'known', AT));
        expect(readings.every(r => r.knowsCause)).toBe(true);
        expect(readings.every(r => r.lines.length > 0)).toBe(true);
    });

    it('never branches on kind, which is why kind is free-form content', () => {
        const invented = makeAreaStatus({
            id: 'status-invented',
            areaId: 'loc-town',
            kind: 'the-ferrymen-have-all-gone-north',
            statement: 'Nobody will take you across.',
            cause: { what: 'A better wage upriver.', decidedById: 'npc-somebody', factId: null },
            beganOnDay: FAMINE_BEGAN,
            reviewOnDay: FAMINE_BEGAN + 40,
            stops: [STOPS_PASSAGE],
            priceMultiplier: 1.5
        });
        // A kind nothing has ever seen behaves exactly like a famine.
        expect(statusesInArea([invented], places(), 'loc-town', AT).map(s => s.id))
            .toEqual(['status-invented']);
        expect(isStoppedInArea([invented], places(), 'loc-town', AT, STOPS_PASSAGE)).toBe(true);
        expect(priceMultiplierInArea([invented], places(), 'loc-town', AT)).toBe(1.5);
    });
});

describe('what is true, what is visible, and what anybody has worked out', () => {
    it('gives each KnowingStage exactly what that stage means and no more', () => {
        const f = famine();
        const at = (stage: KnowingStage) => readStatusAtStage(f, stage, AT);

        expect(at('unaware').lines).toEqual([]);

        const whisper = at('whisper');
        expect(whisper.lines).toHaveLength(1);
        expect(whisper.lines[0]).not.toContain('food');
        expect(whisper.knowsCause).toBe(false);

        // named: it exists and roughly what it is.
        expect(at('named').lines).toContain(f.statement);
        expect(at('named').lines.some(l => l.includes('30'))).toBe(false);

        // placed: they know when.
        expect(at('placed').lines.some(l => l.includes('30 days'))).toBe(true);
        expect(at('placed').lines).not.toContain(f.signs[0]);

        // encountered: they have been in it, so they have the signs.
        expect(at('encountered').lines).toContain(f.signs[0]);
        expect(at('encountered').lines).toContain(f.signs[1]);
        expect(at('encountered').knowsCause).toBe(false);
        expect(at('encountered').lines).not.toContain(f.cause.what);

        // known: they have the cause.
        expect(at('known').knowsCause).toBe(true);
        expect(at('known').lines).toContain(f.cause.what);
    });

    it('caps what asking around gets you when nobody local has worked the cause out', () => {
        // Generalises BeastTide.causeKnownLocally: a tide is a survey problem,
        // and a place that has not done the survey cannot hand you the answer.
        expect(localCeilingFor(famine())).toBe('encountered');
        expect(localCeilingFor(war())).toBe('known');
    });

    it('says nothing at all about a status nobody has heard of, which is the ordinary case', () => {
        // The default stage function is `unaware`, so a world full of statuses
        // is silent until somebody knows something.
        expect(whatIsGoingOnHere([famine(), war()], places(), 'loc-town', AT)).toEqual([]);
    });

    it('answers the standing question with the prose of every status true here', () => {
        const said = whatIsGoingOnHere(
            [famine(), war()], places(), 'loc-prefecture', AT,
            id => (id === 'status-war' ? 'known' : 'named')
        );
        expect(said.map(r => r.statusId)).toEqual(['status-war', 'status-famine']);
        expect(said[0].lines).toContain(war().cause.what);
        expect(said[1].lines).toEqual([famine().statement]);
    });
});

describe('passage: the season and somebody deciding are reported apart', () => {
    /** A pass shut five months a year. `LocationRecord.cycle`, not a status. */
    function pass(): LocationRecord {
        return makeLocation({
            id: 'loc-pass',
            name: 'The Cold Peak Pass',
            kind: 'wilderness',
            parentId: 'loc-province',
            // Open seven months of the year, from day 0.
            cycle: { periodDays: 360, openDays: 210, phaseDay: 0 }
        });
    }

    function withPass(): LocationRecord[] {
        return places().concat(pass());
    }

    it('reports the season shutting a pass without inventing a status for it', () => {
        const shut = passageStoppedInArea([], withPass(), pass(), 3600 + 250);
        expect(shut.bySeason).toBe(true);
        expect(shut.stopped).toBe(true);
        expect(shut.byStatus).toEqual([]);
        expect(shut.seasonOpensOnDay).toBe(3600 + 360);

        const open = passageStoppedInArea([], withPass(), pass(), 3600 + 10);
        expect(open.stopped).toBe(false);
        expect(open.bySeason).toBe(false);
        expect(open.seasonOpensOnDay).toBeNull();
    });

    it('reports a blockade separately, because only one of the two changes its mind', () => {
        const blockade = makeAreaStatus({
            id: 'status-blockade',
            areaId: 'loc-pass',
            kind: 'blockade',
            statement: 'The head of the pass is held and nothing is going over it.',
            cause: {
                what: 'A house put people on the stakes to stop a rival provisioning through.',
                decidedById: 'sect-crimson-abyss',
                factId: null
            },
            beganOnDay: 3600,
            reviewOnDay: 3600 + 120,
            stops: [STOPS_PASSAGE]
        });
        // Open season, so the only thing in the way is the decision.
        const reading = passageStoppedInArea([blockade], withPass(), pass(), 3600 + 10);
        expect(reading.stopped).toBe(true);
        expect(reading.bySeason).toBe(false);
        expect(reading.byStatus.map(s => s.id)).toEqual(['status-blockade']);
    });
});

describe('presence is read off locationId and stored nowhere else', () => {
    it('finds who is in an area through the ordinary NPC record', () => {
        const world = places();
        const day = 3600;
        const inPrefecture = createNpc('seed-status-test', {
            id: 'npc-in-prefecture', bornOnDay: 0, onDay: day, locationId: 'loc-prefecture'
        });
        const inTown = createNpc('seed-status-test', {
            id: 'npc-in-town', bornOnDay: 0, onDay: day, locationId: 'loc-town'
        });
        const elsewhere = createNpc('seed-status-test', {
            id: 'npc-elsewhere', bornOnDay: 0, onDay: day, locationId: 'loc-elsewhere'
        });
        const nowhere = createNpc('seed-status-test', {
            id: 'npc-nowhere', bornOnDay: 0, onDay: day, locationId: null
        });
        const npcs = [inPrefecture, inTown, elsewhere, nowhere];

        expect(whoIsInArea(npcs, world, 'loc-prefecture').map(n => n.id)).toEqual(['npc-in-prefecture']);
        expect(whoIsInArea(npcs, world, 'loc-town').map(n => n.id).sort())
            .toEqual(['npc-in-prefecture', 'npc-in-town']);
        expect(whoIsInArea(npcs, world, 'loc-province').map(n => n.id).sort())
            .toEqual(['npc-elsewhere', 'npc-in-prefecture', 'npc-in-town']);
        // Somebody whose location is unknown is in no area. `layers.ts` already
        // reasons about this person; they are not quietly assigned anywhere.
        expect(whoIsInArea(npcs, world, 'loc-far')).toEqual([]);
    });

    it('meshes: who is standing in the area a war is true of', () => {
        const world = places();
        const day = FAMINE_BEGAN + 30;
        const npcs = [
            createNpc('seed-status-test', {
                id: 'npc-a', bornOnDay: 0, onDay: day, locationId: 'loc-prefecture'
            }),
            createNpc('seed-status-test', {
                id: 'npc-b', bornOnDay: 0, onDay: day, locationId: 'loc-elsewhere'
            })
        ];
        const running = statusesInArea([war('loc-town')], world, 'loc-prefecture', day);
        expect(running).toHaveLength(1);
        expect(whoIsInArea(npcs, world, running[0].areaId).map(n => n.id)).toEqual(['npc-a']);
    });
});

describe('nothing here is stochastic', () => {
    it('draws nothing, so no seeded world moves because this file exists', () => {
        const source = readFileSync(
            fileURLToPath(new URL(
                '../../../src/engine/world/what-is-true-of-a-place-right-now.ts',
                import.meta.url
            )),
            'utf8'
        );
        expect(source).not.toMatch(/Math\.random/);
        expect(source).not.toMatch(/from '\.\.\/cultivation\/rng\.js'/);
        expect(source).not.toMatch(/\bforStream\b/);
    });

    it('is a pure function of its arguments', () => {
        const world = [famine(), war()];
        const once = whatIsGoingOnHere(world, places(), 'loc-prefecture', AT, () => 'known');
        const again = whatIsGoingOnHere(world, places(), 'loc-prefecture', AT, () => 'known');
        expect(again).toEqual(once);
        // And it does not mutate what it was handed.
        expect(world[0]).toEqual(famine());
        expect(world[1]).toEqual(war());
    });
});
