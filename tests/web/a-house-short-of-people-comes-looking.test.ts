/**
 * The wall, played.
 *
 * `houses-that-have-to-advertise-for-disciples.ts` is tested as a derivation
 * next door. This file is the other half of the definition of done in
 * AGENTS.md: **somebody in the running world reaches it by doing something.**
 * A module with a passing unit test and no caller is documentation with a type
 * signature, and this repo's most-repeated defect is exactly that.
 *
 * So everything here goes through the real parser and the real `GameService`,
 * types the sentences a player would type, and checks the knowledge rows the
 * database actually holds afterwards rather than anything the narrator said.
 */

import { describe, it, expect } from 'vitest';
import { makeGame } from './harness.js';
import { parseIntent } from '../../src/web/actions.js';
import { KnowledgeGate } from '../../src/web/knowledge.js';
import {
    openDoorsInTheWorld,
    postingGroundOf,
    provinceOfPlace,
    readTheWall
} from '../../src/web/what-is-posted-on-the-wall-here.js';
import {
    billsOnTheWall,
    housesThatHaveToAdvertise
} from '../../src/engine/world/houses-that-have-to-advertise-for-disciples.js';
import { REGIONS } from '../../src/data/cultivation/regions.js';
import { demonicStandingOf } from '../../src/data/cultivation/demonic-sects-and-what-they-are-willing-to-do.js';
import { intakeRouteOf } from '../../src/data/cultivation/sects.js';

/** A town in the played province with a wall and traffic. */
const MARKET_TOWN = REGIONS
    .flatMap(r => r.places)
    .find(p => p.kind === 'market_town')!.name;

/** Somewhere with nine households and no through traffic. */
const HAMLET = REGIONS.flatMap(r => r.places).find(p => p.kind === 'hamlet')!.name;

async function standingIn(where: string) {
    const { db, game } = makeGame();
    const { cultivator } = await game.newRun('Reader');
    db.prepare('UPDATE cultivators SET location = ? WHERE id = ?').run(where, cultivator.id);
    return { db, game, cultivatorId: cultivator.id, gate: new KnowledgeGate(db) };
}

describe('the sentences reach the wall', () => {
    /**
     * `docs/world/` and AGENTS.md both say it: if a near-synonym works and the
     * phrasing that fails is the more natural one, that is a bug rather than a
     * parser preference. These are the ways somebody actually asks.
     */
    it('routes every ordinary phrasing to the same read', () => {
        for (const said of [
            'what is posted here',
            "what's posted on the wall",
            'I read the bills',
            'I look at the posters',
            'is anyone recruiting',
            'who is recruiting',
            'are there any sects recruiting',
            'is anyone taking disciples',
            'I check the wall'
        ]) {
            expect(parseIntent(said), said).toMatchObject({ action: 'look', intent: 'bills' });
        }
    });

    /**
     * And does not eat the neighbours. `SECT_DUTY_PATTERN` owns the member's
     * board and `sect_manage` owns the intake decree, and both were here
     * first; a verb that swallows the verb next door is a regression this repo
     * has a whole test file named after.
     */
    it('leaves the duty board and the intake decree where they were', () => {
        expect(parseIntent('I recruit two disciples')).toMatchObject({ action: 'sect', intent: 'recruit' });
        expect(parseIntent('recruit an elder')).toMatchObject({ action: 'sect', intent: 'recruit' });
        expect(parseIntent('what duties are there')).toMatchObject({ action: 'sect', intent: 'duty' });
        expect(parseIntent('I look at the sect mission board')).toMatchObject({ action: 'sect', intent: 'duty' });
        expect(parseIntent('I take a commission')).toMatchObject({ action: 'sect', intent: 'duty' });
        expect(parseIntent('I look around')).toMatchObject({ action: 'look' });
        expect(parseIntent('I look around')).not.toMatchObject({ intent: 'bills' });
    });
});

describe('a house short of people comes looking', () => {
    it('puts a name into the player world that was not there before', async () => {
        const { game, cultivatorId, gate } = await standingIn(MARKET_TOWN);

        const before = new Set(gate.awareness(cultivatorId, 'sect').map(r => r.id));
        await game.act('what is posted here');
        const after = gate.awareness(cultivatorId, 'sect').map(r => r.id);

        const learned = after.filter(id => !before.has(id));
        expect(learned.length).toBeGreaterThan(0);

        // And every one of them is a house the derivation actually chose,
        // rather than whatever happened to be nearby in a catalog.
        const advertising = new Set(
            housesThatHaveToAdvertise(openDoorsInTheWorld()).map(h => h.id)
        );
        for (const id of learned) expect(advertising.has(id)).toBe(true);
    });

    /**
     * The stage is the whole of what a poster is worth. `placed` licenses
     * travelling there and applying; it is not an introduction, and nothing
     * about standing, membership or a favour comes with it.
     */
    it('grants a name and a place, and no more than that', async () => {
        const { game, cultivatorId, gate } = await standingIn(MARKET_TOWN);
        await game.act('what is posted here');

        const fromAWall = gate.awareness(cultivatorId, 'sect')
            .filter(r => r.sourceNote.includes('recruiting bill'));
        expect(fromAWall.length).toBeGreaterThan(0);
        for (const row of fromAWall) {
            expect(row.sourceKind).toBe('read');
            expect(row.stage).toBe('placed');
            // `placed` is what licenses setting out for it, and it is the
            // ceiling a read source can carry. Nothing above it is claimed.
            expect(gate.canPointAt(cultivatorId, 'sect', row.id)).toBe(true);
        }
    });

    it('says so plainly where there is no wall', async () => {
        const { game } = await standingIn(HAMLET);
        const answer = await game.act('what is posted here');
        expect(JSON.stringify(answer)).toContain('Nothing is posted here');
    });

    /**
     * Looking round a market town every day for a season must not reprint the
     * same two posters. Nothing remembers that the player stood here before -
     * the signal is `learnIfNew` returning false, which it does for free.
     */
    it('goes quiet on a wall it has already read', async () => {
        const { game, cultivatorId, gate } = await standingIn(MARKET_TOWN);

        await game.act('I look around');
        const afterFirst = gate.awareness(cultivatorId, 'sect').length;
        const second = await game.act('I look around');
        const afterSecond = gate.awareness(cultivatorId, 'sect').length;

        expect(afterSecond).toBe(afterFirst);
        // The narration of THIS turn, not the transcript - the log carries the
        // first look's posters forever, and quoting it would assert nothing.
        expect(second.narration).not.toContain('is holding an intake at');
    });

    /**
     * A read is a read. Deliberately walking over to the wall shows what is on
     * it whether or not the names are new, which is the half `look` drops.
     */
    it('shows the whole wall when the player asks for it, new or not', async () => {
        const { game } = await standingIn(MARKET_TOWN);
        await game.act('what is posted here');
        const again = await game.act('what is posted here');
        expect(JSON.stringify(again)).toContain('is holding an intake at');
    });

    it('costs nothing, because reading a wall costs nothing', async () => {
        const { db, game, cultivatorId } = await standingIn(MARKET_TOWN);
        const read = () => db
            .prepare('SELECT satiety, spirit_stones FROM cultivators WHERE id = ?')
            .get(cultivatorId) as { satiety: number; spirit_stones: number };

        const before = read();
        await game.act('what is posted here');
        expect(read()).toEqual(before);
    });
});

describe('the shipped catalog holds up under the derivation', () => {
    /**
     * The measurement in the brief, re-taken as an assertion. If a content
     * pass ever leaves one house doing all the advertising, this goes red -
     * which is the failure mode the whole feature exists to prevent.
     */
    it('gives a new life more than one door to read about', () => {
        const advertisers = housesThatHaveToAdvertise(openDoorsInTheWorld());
        expect(advertisers.length).toBeGreaterThan(3);
        expect(new Set(advertisers.map(h => h.why)).size).toBeGreaterThan(1);
    });

    it('reaches most of the settled map', () => {
        const withPaper = REGIONS.flatMap(r => r.places).filter(p =>
            billsOnTheWall({
                field: openDoorsInTheWorld(),
                placeName: p.name,
                ground: postingGroundOf(p.name),
                placeProvinceId: provinceOfPlace(p.name),
                onDay: 1000,
                seed: 'catalog-check'
            }).length > 0);

        const settled = REGIONS.flatMap(r => r.places).filter(p => p.kind !== 'site');
        expect(withPaper.length).toBeGreaterThanOrEqual(settled.length - 2);
    });

    /**
     * Not one of the six bodies in `DEMONIC_STANDINGS` recruits by public
     * notice, and the catalog says so body by body. This is the assertion that
     * stops the wall from quietly acquiring one when somebody adds a house.
     */
    it('keeps every body with a documented private route off every wall', () => {
        for (const region of REGIONS) {
            for (const place of region.places) {
                const bills = billsOnTheWall({
                    field: openDoorsInTheWorld(),
                    placeName: place.name,
                    ground: postingGroundOf(place.name),
                    placeProvinceId: provinceOfPlace(place.name),
                    onDay: 1000,
                    seed: 'catalog-check'
                });
                for (const bill of bills) {
                    expect(demonicStandingOf(bill.houseId), bill.houseName).toBeUndefined();
                    expect(intakeRouteOf(bill.houseId), bill.houseName).toBe('open');
                }
            }
        }
    });
});

describe('the reading is a pure read of state', () => {
    it('reports the same wall twice for the same cultivator on the same day', async () => {
        const { db, game, cultivatorId, gate } = await standingIn(MARKET_TOWN);
        const run = game.currentRun().run;
        const cultivator = db
            .prepare('SELECT * FROM cultivators WHERE id = ?')
            .get(cultivatorId) as never;

        const first = readTheWall(gate, cultivator, run);
        const second = readTheWall(gate, cultivator, run);
        expect(second.bills).toEqual(first.bills);
        // Second time round nothing is new, which is the idempotence that
        // matters: the grants were already written.
        expect(second.learned).toEqual([]);
    });
});
