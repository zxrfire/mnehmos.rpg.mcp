/**
 * A thing ending is an event, and how far the news goes is the thing's own size.
 *
 * FOUND BY READING THE CALL SITES. `ruin` takes a `factId` and has seven
 * callers. NOT ONE OF THEM SUPPLIES ONE. So every destruction in this engine -
 * a blade broken in a fight, a compound burned in a war, what was on a body
 * when it was stripped - wrote `factId: null` and appended nothing to
 * `state.history.facts`. `circulating` and `buildPlayerDigest` both read that
 * table and nothing else, which means destruction was, to every person in the
 * world who was not standing there, something that had not happened.
 *
 * THE RULING, and it is two-sided rather than one:
 *
 *     earth and below    people nearby still talk. Counted, not tracked: there
 *                        is no per-item row anybody can name back at you, and
 *                        it does not travel.
 *     heaven and above   individually known and named, and it reaches somebody
 *                        who was not there.
 *
 * NOTHING NEW SCORES THAT. `howBadlyThisIsMissed` already turns an object's own
 * `significance` into a severity and its header says it reads both ways on
 * purpose. An ending is the same question a third time, one band heavier for
 * the one reason `whatItWasWorth` already counts as a step - it does not come
 * back. From there the existing machine does the rest: `aDeedEntersTheWorld`
 * turns a severity into a magnitude and a visibility, and `channelFor` in
 * `digest.ts` lets `market` through at `MARKET_MAGNITUDE` and nothing below it.
 * The cut lands exactly where the ruling put it, and it was already drawn.
 *
 * THE MEASUREMENT THIS PINS: a stranger - no faction, nobody known, standing
 * somewhere else - hears about the spirit boat and does not hear about the
 * pill, and the square that watched the pill break still has it on its record.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld } from './harness.js';
import { addToPouch } from '../../src/server/consolidated/cultivation-support.js';
import { mintCraft } from '../../src/engine/world/building-a-conveyance-out-of-what-a-hunt-brings-back.js';
import { getConveyanceRecipe } from '../../src/data/cultivation/what-a-house-moves-its-people-on.js';
import { buildPlayerDigest, MARKET_MAGNITUDE } from '../../src/engine/world/digest.js';
import { isRuined } from '../../src/engine/world/possessions.js';
import { getPill } from '../../src/data/cultivation/pills.js';
import { howBadlyItsEndingIsTaken } from '../../src/engine/world/what-a-change-of-hands-leaves.js';

const WORLD = 'a-breaking-is-repeated';
const A_PILL_YOU_CAN_REFINE = 'pill-minor-healing';
/** Typed back exactly as the catalog prints it: a name the game prints, it takes. */
const ITS_NAME = getPill(A_PILL_YOU_CAN_REFINE)!.name;

/** Somebody with no standing, no house and no acquaintance, somewhere else. */
function aStranger(actorId: string) {
    return {
        actorId,
        locationId: 'nowhere-in-particular',
        visibleLocationIds: [] as string[],
        factionId: null,
        knowsFaction: () => false,
        knowsNpc: () => false,
        knowsPlace: () => false,
        confidantIds: [] as string[]
    };
}

describe('the scale is read off the thing and not written twice', () => {
    it('puts an ending one band above losing the same thing to a thief', () => {
        // `howBadlyThisIsMissed`: legendary grave, significant serious, else
        // slight. An ending is one step up from each, and the step is the one
        // `whatItWasWorth` already spends on `irreversible`.
        expect(howBadlyItsEndingIsTaken({ significance: 'mundane' })).toBe('serious');
        expect(howBadlyItsEndingIsTaken({ significance: 'notable' })).toBe('serious');
        expect(howBadlyItsEndingIsTaken({ significance: 'significant' })).toBe('grave');
        expect(howBadlyItsEndingIsTaken({ significance: 'legendary' })).toBe('unforgivable');
    });
});

describe('a heaven-grade thing ending is something people know about', () => {
    it('reaches somebody who was not there, through the market and nothing else', async () => {
        const harness = await makeGameInWorld({ seed: 'boat-news', worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Wright');
        const world = await harness.game.loadWorld();
        const recipe = getConveyanceRecipe('build-spirit-boat')!;
        world.objects.push(mintCraft(recipe, {
            id: 'obj-craft-loud-boat',
            name: recipe.name,
            ownerId: cultivator.id,
            ownerName: cultivator.name,
            wrightId: cultivator.id,
            wrightName: cultivator.name,
            bestHandOrdinal: 30,
            onDay: Math.floor(world.currentDay),
            mooredAt: cultivator.location
        })!);

        await harness.game.act('I smash the spirit boat');

        const after = await harness.game.loadWorld();
        const written = after.history.facts.filter(
            fact => fact.data?.brokeObjectId === 'obj-craft-loud-boat'
        );
        expect(written).toHaveLength(1);
        expect(written[0].magnitude).toBeGreaterThanOrEqual(MARKET_MAGNITUDE);
        expect(written[0].visibility).toBe('public');

        const digest = buildPlayerDigest(
            after.history.facts, aStranger('npc-nobody-at-all'), 0, after.currentDay + 1
        );
        const reached = digest.lines.find(line => line.factId === written[0].id);
        expect(reached).toBeDefined();
        expect(reached!.channel).toBe('market');
    });

    it('leaves a row the news can be checked against', async () => {
        const harness = await makeGameInWorld({ seed: 'boat-row', worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Wright');
        const world = await harness.game.loadWorld();
        const recipe = getConveyanceRecipe('build-spirit-boat')!;
        world.objects.push(mintCraft(recipe, {
            id: 'obj-craft-checked-boat',
            name: recipe.name,
            ownerId: cultivator.id,
            ownerName: cultivator.name,
            wrightId: cultivator.id,
            wrightName: cultivator.name,
            bestHandOrdinal: 30,
            onDay: Math.floor(world.currentDay),
            mooredAt: cultivator.location
        })!);

        await harness.game.act('I smash the spirit boat');

        const after = await harness.game.loadWorld();
        const row = after.objects.find(object => object.id === 'obj-craft-checked-boat')!;
        expect(isRuined(row)).toBe(true);
        // THE FIELD NOBODY SUPPLIED. The last provenance entry now carries the
        // id of the fact the world is repeating, so the row and the rumour are
        // one event seen from two ends rather than two memories of it.
        const last = row.provenance[row.provenance.length - 1];
        expect(last.how).toBe('lost');
        expect(last.factId).toBeTruthy();
        expect(after.history.facts.some(fact => fact.id === last.factId)).toBe(true);
    });
});

describe('a cheap thing ending is still talk, and it is small talk', () => {
    it('writes a fact the square holds and a stranger never hears', async () => {
        const harness = await makeGameInWorld({ seed: 'pill-news', worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Breaker');
        addToPouch(harness.db, cultivator.id, A_PILL_YOU_CAN_REFINE, 'pill', 1);

        await harness.game.act(`I smash the ${ITS_NAME}`);

        const after = await harness.game.loadWorld();
        const written = after.history.facts.filter(
            fact => fact.data?.brokeItemId === A_PILL_YOU_CAN_REFINE
        );
        // EARTH PEOPLE STILL GOSSIP. The floor is no durable individually
        // addressable record, never silence.
        expect(written).toHaveLength(1);
        expect(written[0].visibility).not.toBe('secret');
        expect(written[0].magnitude).toBeLessThan(MARKET_MAGNITUDE);

        const digest = buildPlayerDigest(
            after.history.facts, aStranger('npc-nobody-at-all'), 0, after.currentDay + 1
        );
        expect(digest.lines.some(line => line.factId === written[0].id)).toBe(false);
    });

    /**
     * THE SQUARE NOTICED, and this is how far that currently goes.
     *
     * The design owner: *"smashing your pill in the middle of an audience
     * should invite some reaction"*, and *"that should fall out"*. What falls
     * out is the witness list: `appendWorldFact` draws whoever was standing at
     * the place and stores them on the fact, so the people who saw it are named
     * and the record can be walked from any of them.
     *
     * WHAT DOES NOT FALL OUT, written down rather than faked. There is no
     * same-turn line from those people. `sceneWeight` in
     * `scene-person-readings.ts` is the maximum of how far any BODY in the
     * square moved, and a destruction moves nobody - so a breaking prices out
     * at zero and every bystander reads as having nothing to react to. That is
     * a real gap in the scene layer rather than one in this verb.
     */
    it('names the people who were standing there', async () => {
        const harness = await makeGameInWorld({ seed: 'pill-seen', worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Breaker');
        addToPouch(harness.db, cultivator.id, A_PILL_YOU_CAN_REFINE, 'pill', 1);

        await harness.game.act(`I smash the ${ITS_NAME}`);

        const after = await harness.game.loadWorld();
        const written = after.history.facts.find(
            fact => fact.data?.brokeItemId === A_PILL_YOU_CAN_REFINE
        )!;
        // The breaker plus whoever was in the street. Asserted as "more than
        // the one person", because who exactly is a draw off the world seed and
        // pinning a name is pinning a coincidence.
        expect(written.witnessIds.length).toBeGreaterThan(1);
        expect(written.witnessIds).toContain(cultivator.id);
    });

    it('leaves no object row anybody could name it back from', async () => {
        const harness = await makeGameInWorld({ seed: 'pill-row', worldSeed: WORLD });
        const { cultivator } = await harness.game.newRun('Breaker');
        addToPouch(harness.db, cultivator.id, A_PILL_YOU_CAN_REFINE, 'pill', 1);
        const before = (await harness.game.loadWorld()).objects.length;

        await harness.game.act(`I smash the ${ITS_NAME}`);

        const after = await harness.game.loadWorld();
        // Counted, not tracked: a pill is an amount, and an amount that went
        // down by one is not a thing with a history.
        expect(after.objects).toHaveLength(before);
    });
});
