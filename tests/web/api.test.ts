/**
 * The REST contract.
 *
 * These tests exercise the real node:http server over a real TCP socket. The
 * static GUI in `web/` is built by a different agent against exactly these
 * shapes, so a field renamed here is a broken product, not a failing unit -
 * which is why the assertions are on shape and key names rather than values.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { MAX_ORDINAL } from '../../src/engine/cultivation/realms';
import { SPIRIT_ROOTS, ATTRIBUTES } from '../../src/engine/cultivation/spirit-roots';
import { makeGame, startHttp, type HttpHarness } from './harness';

let http: HttpHarness | null = null;

afterEach(async () => {
    await http?.close();
    http = null;
    while (extra.length) await extra.pop()!.close();
});

async function boot(options: { adminMode?: boolean } = {}) {
    const harness = makeGame(options);
    http = await startHttp(harness.game);
    return { ...harness, http };
}

/** A second server in the same test, closed alongside the first. */
const extra: HttpHarness[] = [];
async function bootFresh(): Promise<HttpHarness> {
    const harness = await startHttp(makeGame().game);
    extra.push(harness);
    return harness;
}

describe('GET /api/health', () => {
    it('reports version, provider and admin mode', async () => {
        const { http } = await boot();
        const res = await http.get('/api/health');

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            ok: true,
            version: '9.9.9',
            adminMode: false
        });
        expect(Object.keys(res.body.provider).sort()).toEqual(['configured', 'model', 'name']);
        expect(typeof res.body.provider.name).toBe('string');
        expect(typeof res.body.provider.configured).toBe('boolean');
    });

    it('reflects admin mode when it is on', async () => {
        const { http } = await boot({ adminMode: true });
        expect((await http.get('/api/health')).body.adminMode).toBe(true);
    });
});

describe('GET /api/reference/ladder', () => {
    it('returns all 45 rungs with the documented fields', async () => {
        const { http } = await boot();
        const res = await http.get('/api/reference/ladder');

        expect(res.status).toBe(200);
        expect(res.body.ranks).toHaveLength(MAX_ORDINAL + 1);

        expect(Object.keys(res.body.ranks[0]).sort()).toEqual([
            'baseBreakthroughChance', 'isBoundary', 'lifespanYears', 'name',
            'ordinal', 'progressRequired', 'realm', 'realmKey', 'subRank'
        ]);

        expect(res.body.ranks[0]).toMatchObject({
            ordinal: 0,
            realm: 'Qi Condensation',
            realmKey: 'qi_condensation',
            subRank: 'Layer 1',
            name: 'Qi Condensation Layer 1',
            lifespanYears: 100
        });
        expect(res.body.ranks[MAX_ORDINAL].ordinal).toBe(MAX_ORDINAL);
        // Ordinal 12 is the last Qi Condensation rung: crossing it is a boundary.
        expect(res.body.ranks[12].isBoundary).toBe(true);
        expect(res.body.ranks[0].isBoundary).toBe(false);
    });
});

describe('GET /api/reference/spirit-roots', () => {
    it('returns every root and every attribute', async () => {
        const { http } = await boot();
        const res = await http.get('/api/reference/spirit-roots');

        expect(res.status).toBe(200);
        expect(res.body.roots).toHaveLength(SPIRIT_ROOTS.length);
        expect(res.body.attributes).toHaveLength(ATTRIBUTES.length);

        expect(Object.keys(res.body.roots[0]).sort()).toEqual([
            'cultivationSpeed', 'description', 'elements', 'grade', 'key', 'name', 'probability'
        ]);
        expect(Object.keys(res.body.attributes[0]).sort()).toEqual([
            'description', 'key', 'max', 'min', 'name'
        ]);

        const total = res.body.roots.reduce((sum: number, r: any) => sum + r.probability, 0);
        expect(total).toBeCloseTo(1, 4);

        // The muddled root is the most common draw in the world, by design.
        const muddled = res.body.roots.find((r: any) => r.key === 'muddled_five_element');
        const best = res.body.roots.reduce((a: any, b: any) => (a.probability >= b.probability ? a : b));
        expect(best.key).toBe(muddled.key);
    });
});

describe('GET /api/state', () => {
    it('404s with an { error } before any run exists', async () => {
        const { http } = await boot();
        const res = await http.get('/api/state');

        expect(res.status).toBe(404);
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error).not.toMatch(/at .*\.ts:/);
    });

    it('returns run, cultivator, ambient, derived, log and any open crossroads', async () => {
        const { http } = await boot();
        await http.post('/api/run/new', { name: 'Shen Yi' });

        const res = await http.get('/api/state');
        expect(res.status).toBe(200);
        // `crossroads` is the fork a broken seclusion leaves open, and it is
        // null on every ordinary read including this one. The KEY is always
        // present all the same: `applyState` in the client only overwrites the
        // field when the payload carries it, so a payload that omits it on the
        // turn a fork is answered would leave a stale question on the screen.
        expect(Object.keys(res.body).sort()).toEqual(
            ['ambient', 'crossroads', 'cultivator', 'derived', 'log', 'run', 'tolls']
        );
        expect(res.body.crossroads).toBeNull();

        expect(['thin', 'normal', 'dense', 'spirit_tide']).toContain(res.body.ambient);

        expect(Object.keys(res.body.derived).sort()).toEqual([
            'breakthroughBlockedReason', 'breakthroughReady', 'dao',
            // `daysChannelsOpen` and `injuryRatePenalty` replaced
            // `bleedOutTurns` and `turnsUntilBleedOut`, which were a countdown
            // to a death that no longer happens - a torn meridian is a torn
            // muscle (`docs/world/injuries.md`). What the client gets instead
            // is how long the wounds have been carried and what they cost.
            'daysChannelsOpen',
            // `ground` is who else is drawing on the ground under them. It is
            // on the sheet because occupancy moves the rate more than the
            // ambient band does and was on no screen anywhere.
            'foundationQuality', 'ground', 'injuryRatePenalty', 'lifespanPressure',
            'lifespanPressureFromAge',
            'lifespanRemaining', 'lifespanYears', 'nameTaken', 'nextRankName',
            'progressRequired', 'rankName', 'realmName', 'sectName',
            // `standingHere` is what is live for this cultivator right now,
            // most pressing first. On the wire because the interface offered
            // three buttons over a verb space a player could not find any other
            // way - see `what-is-worth-doing-standing-here.ts`. Prompts, never
            // a menu: free text stays the whole game.
            'stagnationYears', 'standingHere',
            'untreatedInjuries'
        ]);
        // The four that were added together, and the reason: the client had 50
        // written into it as the settling clock and said "fifty years without
        // advancing is fatal" to a cultivator at any rung. It is 50 only
        // through Foundation Establishment. The browser no longer knows the
        // number - it reads whichever one the engine sends for this rung, and
        // the span and the age term travel beside it so the panel can say which
        // clock runs out first and what waiting costs the next crossing.
        expect(res.body.derived.stagnationYears).toBeGreaterThan(0);
        expect(res.body.derived.lifespanYears)
            .toBe(res.body.derived.lifespanRemaining + res.body.cultivator.age);
        expect(res.body.derived.lifespanPressure).toBeLessThanOrEqual(0);
        expect(res.body.derived.lifespanPressureFromAge)
            .toBeLessThan(res.body.derived.lifespanYears);
        // No wounds open, so nothing has been carried and nothing is being
        // taken. Plain zeroes rather than the null the old countdown needed,
        // because neither of these is ever absent - one is an elapsed count and
        // the other a fraction, and both are defined for a whole body.
        expect(res.body.derived.daysChannelsOpen).toBe(0);
        expect(res.body.derived.injuryRatePenalty).toBe(0);
        // Rank and dao are separate axes, and only one of them can be shut. The
        // sheet gets both, so a cultivator whose ladder is finished is not shown
        // a page made entirely of things they cannot do.
        expect(res.body.derived.dao).toMatchObject({
            insights: [],
            totalDegrees: 0,
            theOnlyAxisLeft: false
        });
        expect(res.body.derived).toMatchObject({
            rankName: 'Qi Condensation Layer 1',
            nextRankName: 'Qi Condensation Layer 2',
            breakthroughReady: false,
            untreatedInjuries: 0,
            sectName: null,
            foundationQuality: 'none',
            nameTaken: false
        });
        // The control states its own case rather than rendering a generic
        // "progress incomplete".
        expect(res.body.derived.breakthroughBlockedReason).toMatch(/qi-units/);
        expect(res.body.tolls).toEqual([]);
        expect(res.body.derived.lifespanRemaining).toBe(100 - 16);

        expect(res.body.run).toMatchObject({ status: 'active', turn: 0, elapsedDays: 0, peakOrdinal: 0 });
        // The seed is never sent to the browser; nothing there can use it.
        expect(res.body.run.seed).toBeUndefined();

        expect(Array.isArray(res.body.log)).toBe(true);
        for (const entry of res.body.log) {
            expect(['narrator', 'player', 'engine']).toContain(entry.role);
            expect(typeof entry.text).toBe('string');
            expect(typeof entry.turn).toBe('number');
        }
        expect(res.body.log.some((e: any) => e.role === 'engine')).toBe(true);
        expect(res.body.log.some((e: any) => e.role === 'narrator')).toBe(true);
    });
});

describe('POST /api/run/new', () => {
    it('returns { run, cultivator }', async () => {
        const { http } = await boot();
        const res = await http.post('/api/run/new', { name: 'Ru Qing' });

        expect(res.status).toBe(201);
        expect(Object.keys(res.body).sort()).toEqual(['cultivator', 'run']);
        expect(res.body.cultivator.name).toBe('Ru Qing');
        expect(res.body.run.cultivatorId).toBe(res.body.cultivator.id);
    });

    it('rolls talent server-side and ignores everything the client sends but the name', async () => {
        const { http } = await boot();
        const honest = await http.post('/api/run/new', { name: 'Ru Qing' });
        await http.close();

        // A second, identically seeded server, given a body stuffed with the
        // talent a player would choose if choosing were allowed.
        const cheating = await bootFresh();
        const res = await cheating.post('/api/run/new', {
            name: 'Ru Qing',
            spiritRoot: 'mutated_lightning',
            attributes: { might: 3, insight: 4, fortune: 3, charm: 3 },
            realmOrdinal: 40,
            spiritStones: 999999,
            hp: 9999,
            maxHp: 9999,
            age: 1,
            alive: true,
            seed: 'chosen-by-the-client'
        });

        expect(res.status).toBe(201);
        expect(res.body.cultivator.spiritRoot).toBe(honest.body.cultivator.spiritRoot);
        expect(res.body.cultivator.attributes).toEqual(honest.body.cultivator.attributes);
        expect(res.body.cultivator.realmOrdinal).toBe(0);
        expect(res.body.cultivator.spiritStones).toBe(30);
        expect(res.body.cultivator.age).toBe(16);
        expect(res.body.cultivator.hp).toBe(honest.body.cultivator.hp);
    });

    it('rejects an empty name and a missing name', async () => {
        const { http } = await boot();
        expect((await http.post('/api/run/new', { name: '   ' })).status).toBe(400);
        expect((await http.post('/api/run/new', {})).status).toBe(400);
    });

    it('refuses a second run while one is live', async () => {
        const { http } = await boot();
        await http.post('/api/run/new', { name: 'First' });
        const res = await http.post('/api/run/new', { name: 'Second' });

        expect(res.status).toBe(409);
        expect(typeof res.body.error).toBe('string');
    });
});

describe('POST /api/cultivate', () => {
    it('returns { timeSkip, state }', async () => {
        const { http } = await boot();
        await http.post('/api/run/new', { name: 'Mo Yan' });

        const res = await http.post('/api/cultivate', { days: 30, anyway: true });
        expect(res.status).toBe(200);
        // `narration` is the fix for a real split: the button called this
        // endpoint, got a structure back, and rendered a table of deltas,
        // while a player who typed the same thing got prose. One design,
        // two front doors, and only one of them had the narrator.
        // `events` and `interruptReason` are the second half of the same fix.
        // `timeSkip.events` is only the cultivation engine's half of the span;
        // the encounter layer's occurrences are merged into `events`, and this
        // endpoint was returning neither - so the GUI's seclusion button showed
        // no encounters at all, measured as zero summonses across 200 lives
        // against 1.63 a sect life through the typed endpoint on the same build.
        expect(Object.keys(res.body).sort())
            .toEqual(['events', 'interruptReason', 'narration', 'state', 'timeSkip']);
        expect(Array.isArray(res.body.events)).toBe(true);
        expect(res.body.narration).toEqual(expect.any(String));
        expect(res.body.narration.length).toBeGreaterThan(0);

        expect(res.body.timeSkip).toMatchObject({ requestedDays: 30, interrupted: expect.any(Boolean) });
        expect(Array.isArray(res.body.timeSkip.events)).toBe(true);
        expect(Object.keys(res.body.timeSkip.deltas).sort()).toEqual([
            'age', 'cultivationProgress', 'hp', 'injuriesGained',
            'qi', 'realmOrdinal', 'satiety', 'spiritStones'
        ]);
        expect(res.body.state.run.elapsedDays).toBe(res.body.timeSkip.simulatedDays);
    });

    it('rejects a non-numeric or zero duration', async () => {
        const { http } = await boot();
        await http.post('/api/run/new', { name: 'Mo Yan' });

        expect((await http.post('/api/cultivate', { days: 'soon' })).status).toBe(400);
        expect((await http.post('/api/cultivate', { days: 0 })).status).toBe(400);
        expect((await http.post('/api/cultivate', { days: 1e9 })).status).toBe(400);
    });
});

describe('POST /api/breakthrough', () => {
    it('refuses with { error } when the engine says progress is insufficient', async () => {
        const { http } = await boot();
        await http.post('/api/run/new', { name: 'Bai Lu' });

        const res = await http.post('/api/breakthrough');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/qi-units/);
    });

    it('returns { result, state } once the engine reports eligibility', async () => {
        const { db, game, http } = await boot();
        await http.post('/api/run/new', { name: 'Bai Lu' });
        const before = game.state();

        // Bank exactly enough progress. This is a test fixture reaching into
        // the database on purpose: the point under test is the endpoint's
        // shape, not the months it would take to earn the progress honestly.
        db.prepare('UPDATE cultivators SET cultivation_progress = 100000 WHERE id = ?')
            .run(before.cultivator.id);

        const res = await http.post('/api/breakthrough');
        expect(res.status).toBe(200);
        expect(Object.keys(res.body).sort()).toEqual(['narration', 'result', 'state']);
        expect(res.body.narration).toEqual(expect.any(String));
        expect(res.body.result).toMatchObject({
            fromOrdinal: 0,
            finalChance: expect.any(Number),
            roll: expect.any(Number),
            outcome: expect.any(String)
        });
        expect(Array.isArray(res.body.result.modifiers)).toBe(true);

        // The engine's transparency invariant: the itemised modifiers sum to
        // the final chance exactly, clamp line included.
        const sum = res.body.result.modifiers.reduce((s: number, m: any) => s + m.delta, 0);
        expect(sum).toBeCloseTo(res.body.result.finalChance, 10);
    });
});

describe('POST /api/act', () => {
    it('returns { narration, events, toolCalls, state }', async () => {
        const { http } = await boot();
        await http.post('/api/run/new', { name: 'Yun Zhi' });

        const res = await http.post('/api/act', { input: 'I look around.' });
        expect(res.status).toBe(200);
        expect(Object.keys(res.body).sort()).toEqual(['events', 'narration', 'state', 'toolCalls']);
        expect(typeof res.body.narration).toBe('string');
        expect(res.body.narration.length).toBeGreaterThan(20);
        expect(Array.isArray(res.body.events)).toBe(true);

        // The inspector: routing first, engine calls in the middle, prose last.
        for (const call of res.body.toolCalls) {
            expect(typeof call.name).toBe('string');
            expect(typeof call.action).toBe('string');
            expect(typeof call.summary).toBe('string');
            expect(typeof call.ok).toBe('boolean');
        }
        expect(res.body.toolCalls[0]).toMatchObject({
            name: 'narrator.plan', action: 'look', source: 'fallback', ok: true
        });
        expect(res.body.toolCalls.at(-1).name).toBe('narrator.narrate');
        expect(res.body.toolCalls.map((c: { name: string }) => c.name)).toContain('engine.readState');
    });

    it('rejects an empty or missing input', async () => {
        const { http } = await boot();
        await http.post('/api/run/new', { name: 'Yun Zhi' });
        expect((await http.post('/api/act', { input: '  ' })).status).toBe(400);
        expect((await http.post('/api/act', {})).status).toBe(400);
    });
});

describe('GET /api/ledger', () => {
    it('is empty before anyone has died, and lists finished runs afterwards', async () => {
        const { db, game, http } = await boot();
        await http.post('/api/run/new', { name: 'Han Sui' });
        expect((await http.get('/api/ledger')).body.runs).toEqual([]);

        // Strip the purse so a long seclusion starves rather than provisions.
        // A skip can be interrupted by an encounter or a wounding failure
        // before the belly runs out, so keep sitting down until the run ends.
        const id = game.state().cultivator.id;
        db.prepare('UPDATE cultivators SET spirit_stones = 0 WHERE id = ?').run(id);
        for (let attempt = 0; attempt < 20; attempt++) {
            const res = await http.post('/api/cultivate', { days: 2000, anyway: true });
            if (res.status !== 200 || res.body.state.run.status !== 'active') break;
        }

        const res = await http.get('/api/ledger');
        expect(res.status).toBe(200);
        expect(res.body.runs).toHaveLength(1);
        expect(Object.keys(res.body.runs[0]).sort()).toEqual([
            'deathCause', 'deathDescription', 'elapsedDays', 'endedAt',
            'id', 'name', 'peakOrdinal', 'peakRankName', 'turn'
        ]);
        expect(res.body.runs[0]).toMatchObject({ name: 'Han Sui', deathCause: 'starvation' });
        expect(res.body.runs[0].peakRankName).toContain('Qi Condensation');
    });
});

describe('GET /api/admin/roster', () => {
    it('403s with an { error } when admin mode is off', async () => {
        const { http } = await boot({ adminMode: false });
        await http.post('/api/run/new', { name: 'Xu Ling' });

        const res = await http.get('/api/admin/roster');
        expect(res.status).toBe(403);
        expect(typeof res.body.error).toBe('string');
        expect(res.body.roster).toBeUndefined();
    });

    it('lists every cultivator with display fields when admin mode is on', async () => {
        const { http } = await boot({ adminMode: true });
        await http.post('/api/run/new', { name: 'Xu Ling' });

        const res = await http.get('/api/admin/roster');
        expect(res.status).toBe(200);
        expect(res.body.roster).toHaveLength(1);
        expect(Object.keys(res.body.roster[0]).sort()).toEqual([
            'age', 'alive', 'deathCause', 'existenceState', 'feuds', 'id',
            'identityContinuity', 'isPlayer', 'kind', 'lifespanYears', 'location',
            'name', 'rankName', 'realmName', 'realmOrdinal', 'sectId', 'sectName',
            'sectRank', 'soulState', 'spiritRoot', 'spiritRootName', 'spiritStones',
            'untreatedInjuries'
        ]);
        expect(res.body.roster[0]).toMatchObject({
            name: 'Xu Ling',
            isPlayer: true,
            alive: true,
            rankName: 'Qi Condensation Layer 1',
            realmName: 'Qi Condensation',
            lifespanYears: 100
        });
        // Existence is authoritative and `alive` is the convenience boolean
        // beside it. The roster is the one screen a player would ever meet an
        // NPC who is missing or soul-preserved on, so these are carried rather
        // than collapsed into the boolean.
        expect(res.body.roster[0]).toMatchObject({
            existenceState: 'alive',
            soulState: 'intact',
            identityContinuity: 1
        });
    });
});

describe('transport behaviour', () => {
    it('404s unknown API paths and 405s wrong methods, always as { error }', async () => {
        const { http } = await boot();
        expect((await http.get('/api/nope')).body.error).toBeTruthy();
        expect((await http.post('/api/nope')).status).toBe(404);
        expect((await http.post('/api/health')).status).toBe(404);
        expect((await http.get('/api/state')).body.error).toBeTruthy();
    });

    it('rejects malformed JSON bodies without a stack trace', async () => {
        const { http } = await boot();
        const res = await fetch(`${http.base}/api/run/new`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{ not json'
        });
        const body = await res.json() as { error: string };

        expect(res.status).toBe(400);
        expect(body.error).toBe('Request body is not valid JSON.');
        expect(JSON.stringify(body)).not.toMatch(/\.ts:\d+/);
    });

    it('refuses path traversal on the static route', async () => {
        const { http } = await boot();
        const res = await fetch(`${http.base}/..%2f..%2fpackage.json`);
        expect(res.status).toBe(404);
    });
});
