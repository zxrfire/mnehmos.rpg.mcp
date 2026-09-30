/**
 * World ruins were permanently exterior-only: enter returned the outside view,
 * and waiting inside could never meet a closing window. The live site verb now
 * spends navigation days, records chambers without edges, and keeps the body
 * inside when the window closes. Stock is an object row, never a fresh prize roll.
 *
 * These arrangements pin both world and run. The assertions cover facts the
 * player can learn and persistent consequences; no NPC name or seeded room
 * assignment is presumed.
 */
import { describe, expect, it } from 'vitest';
import { makeGameInWorld, ScriptedProvider } from './harness';
import { makeLocation, makeThresholds, type LocationRecord } from '../../src/engine/world/locations';
import { withWings, wingsOf, knownAxes, workWing } from '../../src/engine/world/provenance';
import { makeObject } from '../../src/engine/world/possessions';
import { ruinChamberHere } from '../../src/web/ruin-delving';
import { whatIsStandingFreeAt } from '../../src/web/a-taking-is-decided-by-ownership';
import { integrateInsight, recordAchievement } from '../../src/engine/cultivation/understanding';
import { forStream } from '../../src/engine/cultivation/rng';
import { lifespanForOrdinal } from '../../src/engine/cultivation/realms';
import { siteStep } from '../../src/web/site-phrasings';

async function setup(plans: object[], patch: Partial<LocationRecord> = {}) {
    const h = await makeGameInWorld({ seed: 'ruin-delver', worldSeed: 'ruin-chambers-world',
        provider: new ScriptedProvider({ plans: plans.map(plan => JSON.stringify(plan)) }) });
    const { cultivator } = await h.game.newRun('Delver');
    const world = (await h.game.loadWorld())!;
    const day = Math.floor(world.currentDay);
    const site = withWings(makeLocation({ id: 'loc-test-delve', name: 'Test Ruin', kind: 'ruin',
        discovered: true, thresholds: makeThresholds(0, 0, 0, 0),
        data: { sealedYear: Math.floor(day / 365) - 3_000 }, ...patch }), [
        { id: 'test-outer', name: 'the outer hall', depthDays: 1, sealed: false,
            state: 'untouched', workings: 0, lastWorkedOnDay: null },
        { id: 'test-archive', name: 'the archive', depthDays: 2, sealed: false,
            state: 'untouched', workings: 0, lastWorkedOnDay: null },
        { id: 'test-vault', name: 'the vault', depthDays: 3, sealed: false,
            state: 'untouched', workings: 0, lastWorkedOnDay: null }
    ]);
    world.locations.push(site);
    h.game.atHand = world;
    h.repos.cultivators.update(cultivator.id, { realmOrdinal: 30, location: site.name,
        maxHp: 1_000, hp: 1_000, maxQi: 1_000, qi: 1_000 });
    return { ...h, world, site, id: cultivator.id, day };
}

describe('a ruin has chambers and a closing door', () => {
    it('the deterministic reader accepts delving, notes, wearing and leaving', () => {
        for (const [sentence, intent] of [
            ['I delve into the ruin', 'delve'], ['I read the ruin map', 'survey'],
            ['I wear an old identity', 'wear'], ['I leave the ruins', 'leave']
        ]) expect(siteStep(sentence.toLowerCase(), sentence)?.intent).toBe(intent);
    });

    it('enters through the live verb, spends light, and reads no unseen chambers', async () => {
        const h = await setup([{ action: 'site', intent: 'outside' },
            { action: 'site', intent: 'enter' }, { action: 'site', intent: 'survey', target: 'ruin map' }],
        { environment: { spiritualDensity: 0.4, danger: 0, resources: [], climate: 'sunless',
            politicalControl: '', specialRules: [], knownSecrets: [], historicalScars: [] } });
        const before = h.game.currentRun();
        const outside = await h.game.act('I read the ruin from outside');
        expect(outside.narration).not.toContain('Everything by the door');
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
        const entered = await h.game.act('I go inside');
        expect(entered.narration).toContain('Everything by the door');
        expect(entered.narration).not.toContain('nobody who went in has returned');
        expect(ruinChamberHere(h.game, h.game.currentRun().cultivator)).toBe(wingsOf(h.site)[0].id);
        expect(h.game.currentRun().cultivator.qi).toBeLessThan(before.cultivator.qi);
        expect(h.world.currentDay).toBeGreaterThan(h.day);
        expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(before.run.elapsedDays);
        const at = h.game.currentRun().run.elapsedDays;
        const read = await h.game.act('I survey the ruin chambers');
        expect(read.narration).toContain('They record no routes');
        expect(read.narration).not.toContain('the archive');
        expect(h.game.currentRun().run.elapsedDays).toBe(at);
    }, 180_000);

    it('works real stock, learns a room map, and accepts the chamber name as a move', async () => {
        const h = await setup([{ action: 'site', intent: 'enter' },
            { action: 'site', intent: 'take' }, { action: 'site', intent: 'take' },
            { action: 'site', intent: 'take' }, { action: 'site', intent: 'survey' },
            { action: 'move', target: 'the archive' }, { action: 'site', intent: 'take' }]);
        const book = makeObject({ id: 'test-ruin-book', name: 'Test Manual', kind: 'manual',
            significance: 'notable', locationId: h.site.id, data: { chamberId: wingsOf(h.site)[1].id } });
        h.world.objects.push(book);
        expect(whatIsStandingFreeAt(h.world, h.site.id)).not.toContainEqual(book);
        await h.game.act('I go inside');
        for (let i = 0; i < 3; i++) await h.game.act('I take the contents');
        expect(h.world.objects.find(row => row.id === book.id)!.possessorId).toBeNull();
        const map = await h.game.act('I read the ruin map');
        expect(map.narration).toContain(wingsOf(h.site)[1].name);
        expect(map.narration).toContain('They record no routes');
        const before = h.game.currentRun().run.elapsedDays;
        await h.game.act(`I go to ${wingsOf(h.site)[1].name}`);
        expect(ruinChamberHere(h.game, h.game.currentRun().cultivator)).toBe(wingsOf(h.site)[1].id);
        expect(h.game.currentRun().run.elapsedDays).toBeGreaterThan(before);
        await h.game.act('I take the contents');
        expect(h.world.objects.find(row => row.id === book.id)!.possessorId).toBe(h.id);
        expect(h.world.objects.filter(row => row.id === book.id)).toHaveLength(1);
    }, 180_000);

    it('a formation keeps its round and wearing its past costs continuity, with no objects granted', async () => {
        const h = await setup([{ action: 'site', intent: 'enter' },
            { action: 'site', intent: 'take' }, { action: 'site', intent: 'wear' }]);
        await h.game.act('I go inside');
        const wing = wingsOf(h.site)[0];
        const index = h.world.locations.findIndex(row => row.id === h.site.id);
        h.world.locations[index] = withWings({ ...h.site, hazards: ['formation'] }, [wing]);
        const prior = recordAchievement({ kind: 'profound_principle', onDay: h.day,
            turn: 0, summary: 'Previously read a formation.' }, forStream('ruin-delver', 'prior-formation'));
        const insight = integrateInsight([], { domain: 'formation', subject: 'formation',
            access: { kind: 'site', label: 'an earlier formation' }, opening: 'previously observed a formation' }, prior).insight;
        h.repos.cultivators.update(h.id, { insights: [insight], achievements: [prior] });
        const blocked = await h.game.act('I take the contents');
        expect(blocked.narration).toContain('round is being kept');
        expect(wingsOf(h.world.locations[index])[0].workings).toBe(0);
        const before = h.game.currentRun().cultivator;
        const stock = h.world.objects.map(row => ({ id: row.id, held: row.possessorId }));
        const worn = await h.game.act('I wear an old identity');
        const after = h.game.currentRun().cultivator;
        expect(after.identityContinuity).toBeLessThan(before.identityContinuity);
        expect(after.insights.find(row => row.domain === 'formation')!.degree).toBeGreaterThan(insight.degree);
        expect(worn.narration).toContain('No objects crossed back');
        expect(h.world.objects.map(row => ({ id: row.id, held: row.possessorId }))).toEqual(stock);
    }, 180_000);

    it('ordinary inspection and pickup reach only the occupied chamber, by site name or id', async () => {
        const h = await setup([{ action: 'site', intent: 'enter' },
            { action: 'investigate', target: 'Test Manual' },
            { action: 'interact', intent: 'take', topic: 'Test Manual' },
            { action: 'move', target: 'the archive' },
            { action: 'interact', intent: 'take', topic: 'Test Manual' }]);
        h.world.locations[h.world.locations.findIndex(row => row.id === h.site.id)] =
            withWings(h.site, wingsOf(h.site).slice(0, 2));
        const book = makeObject({ id: 'test-ruin-pickup', name: 'Test Manual', kind: 'manual',
            significance: 'notable', description: 'The lettering on its cover is blue.',
            locationId: h.site.id, data: { chamberId: wingsOf(h.site)[1].id } });
        h.world.objects.push(book);
        await h.game.act('I go inside');
        const inspected = await h.game.act('I examine Test Manual');
        expect(inspected.narration).not.toContain(book.description);
        await h.game.act('I pick up Test Manual');
        expect(h.world.objects.find(row => row.id === book.id)!.possessorId).toBeNull();
        await h.game.act('I walk to the archive');
        expect(whatIsStandingFreeAt(h.world, h.site.name,
            ruinChamberHere(h.game, h.game.currentRun().cultivator)).map(row => row.id)).toContain(book.id);
        await h.game.act('I pick up Test Manual');
        expect(h.world.objects.find(row => row.id === book.id)!.possessorId).toBe(h.id);
    }, 180_000);

    it('an empty qi pool refuses a sunless walk with its light budget and spends no day', async () => {
        const h = await setup([{ action: 'site', intent: 'enter' }],
        { environment: { spiritualDensity: 0.4, danger: 0, resources: [], climate: 'sunless',
            politicalControl: '', specialRules: [], knownSecrets: [], historicalScars: [] } });
        h.repos.cultivators.update(h.id, { qi: 0 });
        const before = h.game.currentRun().run.elapsedDays;
        const refused = await h.game.act('I go inside');
        expect(refused.narration).toContain('0 days of light');
        expect(h.game.currentRun().run.elapsedDays).toBe(before);
        expect(ruinChamberHere(h.game, h.game.currentRun().cultivator)).toBeNull();
    }, 180_000);

    it('a sealed inner wing refuses entry below its mastery and spends no day', async () => {
        const h = await setup([{ action: 'site', intent: 'enter' },
            { action: 'site', intent: 'delve', target: 'the archive' }],
        { thresholds: makeThresholds(0, 0, 0, 40) });
        h.world.locations[h.world.locations.findIndex(row => row.id === h.site.id)] =
            withWings(h.site, wingsOf(h.site).map((wing, index) => ({ ...wing, sealed: index === 1 })));
        await h.game.act('I go inside');
        const before = h.game.currentRun().run.elapsedDays;
        const blocked = await h.game.act('I delve toward the archive');
        expect(blocked.narration).toContain('sealed against your cultivation');
        expect(h.game.currentRun().run.elapsedDays).toBe(before);
        expect(ruinChamberHere(h.game, h.game.currentRun().cultivator)).toBe(wingsOf(h.site)[0].id);
    }, 180_000);

    it('a recent formation has no old identity to wear and spends no continuity', async () => {
        const h = await setup([{ action: 'site', intent: 'enter' }, { action: 'site', intent: 'wear' }],
            { hazards: ['formation'] });
        const index = h.world.locations.findIndex(row => row.id === h.site.id);
        h.world.locations[index] = { ...h.site,
            data: { ...h.site.data, sealedYear: Math.floor(h.day / 365) } };
        await h.game.act('I go inside');
        const before = h.game.currentRun();
        const refused = await h.game.act('I wear an old identity');
        expect(refused.narration).toContain('nothing here old enough');
        expect(h.game.currentRun().cultivator.identityContinuity).toBe(before.cultivator.identityContinuity);
        expect(h.game.currentRun().run.elapsedDays).toBe(before.run.elapsedDays);
    }, 180_000);

    it('waiting through the closing catches the body, blocks movement, and permits the next opening', async () => {
        const h = await setup([{ action: 'site', intent: 'enter' },
            { action: 'wait', days: 1 }, { action: 'move', target: 'elsewhere' },
            { action: 'site', intent: 'leave' }]);
        const index = h.world.locations.findIndex(row => row.id === h.site.id);
        h.world.locations[index] = { ...h.site, cycle: { periodDays: 1_000 * 365,
            openDays: 2, phaseDay: h.day } };
        await h.game.act('I go inside');
        const caught = await h.game.act('I wait for one day');
        expect(caught.narration).toContain('closed with you inside');
        expect(h.game.currentRun().cultivator.alive).toBe(true);
        const at = h.game.currentRun().run.elapsedDays;
        const blocked = await h.game.act('I walk elsewhere');
        expect(blocked.narration).toContain('closed with you inside');
        expect(h.game.currentRun().run.elapsedDays).toBe(at);
        expect(h.game.currentRun().cultivator.location).toBe(h.site.name);
        // Advance the world's schedule to test the exit gate independently of survival.
        h.world.currentDay = h.day + 1_000 * 365;
        const left = await h.game.act('I leave the ruin');
        expect(left.narration).toContain('You left');
        expect(ruinChamberHere(h.game, h.game.currentRun().cultivator)).toBeNull();
    }, 180_000);

    it('a trapped body still reaches its ordinary lifespan death', async () => {
        const h = await setup([{ action: 'site', intent: 'enter' }, { action: 'wait', days: 3 }]);
        const index = h.world.locations.findIndex(row => row.id === h.site.id);
        h.world.locations[index] = { ...h.site, cycle: { periodDays: 1_000 * 365,
            openDays: 2, phaseDay: h.day } };
        await h.game.act('I go inside');
        h.repos.cultivators.update(h.id, { age: lifespanForOrdinal(30) - 1 / 365, physique: null });
        await h.game.act('I wait for three days');
        expect(h.game.currentRun().cultivator.alive).toBe(false);
    }, 180_000);

    it('the worker id survives renaming and another matching name earns no map', () => {
        const site = makeLocation({ id: 'site-id-reader', name: 'Test Ruin', kind: 'ruin' });
        const worked = workWing(site, { wingId: wingsOf(site)[0].id, onDay: 1,
            byName: 'Former Name', byId: 'worker' })!;
        expect(knownAxes(worked.location, { id: 'worker', name: 'New Name' }).engagements).toBe(1);
        expect(knownAxes(worked.location, { id: 'other-worker', name: 'Former Name' }).engagements).toBe(0);
    });
});
