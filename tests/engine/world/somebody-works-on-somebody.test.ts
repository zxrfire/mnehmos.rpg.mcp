/**
 * Native manoeuvres must fire, build a one-sided tie and be discoverable.
 *
 * The original walk guarded four caller defects: never revisiting a pair,
 * writing bought ties symmetrically, requiring a living actor for discovery,
 * and pricing a first request from faction hostility instead of the actual tie.
 * None needs centuries of history. The old guard walked eight 500-year worlds
 * and two 300-year controls, and could retain eight serialized worlds. Certification
 * exhausted the roughly 4 GiB worker heap before this file reported a result.
 *
 * These are focused caller regressions under the no-history exception: native writers
 * produce the campaign, rather than an arranged relationship claiming that one
 * happened. Fixed fresh scenes exercise eight opportunities over one week.
 * Thirty-two ordinary
 * one-year windows also use the real weighted yearly caller, with intensity128
 * and at most32 events each; the floor of five firings remains a guard against
 * zero, not an estimate of the old five-per-500-year ambient rate. Exploration
 * measures that distribution. No claim about an ambient rate is relabelled.
 *
 * Actual native campaigns must still land, exceed0.45 and stay one-sided.
 * The same native campaign then faces many other possible targets: most visits
 * must return to it. Discovery must also work after its actor dies. Both cases
 * consume the real writer's state; no mock resolver or forced outcome is used.
 * The equal-seed control now compares two complete one-year windows, and every
 * stranger-facing manoeuvre line remains anonymous.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { setImmediate as yieldToIo } from 'node:timers/promises';
import { forStream } from '../../../src/engine/cultivation/rng.js';
import { fixtureCatalog } from './fixtures.js';
import { seedWorld } from '../../../src/engine/world/seeding.js';
import { applyPressure, PRESSURE_TEMPLATES } from '../../../src/engine/world/pressure.js';
import { createWorld, cloneWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { createNpc, markDead, relationshipWith } from '../../../src/engine/world/npc-state.js';

const YEAR = 365;
const applied = PRESSURE_TEMPLATES.find(row => row.kind === 'leverage_applied')!;
const understood = PRESSURE_TEMPLATES.find(row => row.kind === 'leverage_understood')!;

function nativeWindow(seed: string) {
    const state = seedWorld({ seed, catalog: fixtureCatalog(), presentYear: 1000, population: 250 }).state;
    const result = applyPressure(state, state.currentDay, state.currentDay + YEAR,
        { intensity: 128, maxEvents: 32 });
    const counts = new Map<string, number>();
    for (const event of result.events) counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
    return { state, counts };
}

function freshScene(seed: string) {
    const state = createWorld({ seed, skipPriorAges: true, regionCount: 0 });
    state.locations.push(makeLocation({ id: 'loc-market', name: 'The Market', kind: 'settlement' }));
    for (const id of ['house-north', 'house-south']) state.factions.push(makeFaction({ id,
        name: id === 'house-north' ? 'North Hall' : 'South Hall' }));
    for (let person = 0; person < 2; person++) state.npcs.push(createNpc(seed, {
        id: 'npc-' + person, locationId: 'loc-market', onDay: state.currentDay,
        bornOnDay: state.currentDay - 30 * YEAR, factionId: state.factions[person]!.id,
        factionRankIndex: 1, spiritStones: 0
    }));
    return state;
}

interface Campaign { state: WorldState; actorId: string; subjectId: string }

/** An actual native attachment with its original cause and an unreturned tie. */
function isAnUnreturnedCampaign({ state, actorId, subjectId }: Campaign): boolean {
    const actor = state.npcs.find(row => row.id === actorId);
    const subject = state.npcs.find(row => row.id === subjectId);
    if (!actor || !subject || subject.status !== 'alive') return false;
    const tie = relationshipWith(subject, actorId, 'ally');
    const back = relationshipWith(actor, subjectId);
    return tie !== null && tie.standing > 0.45 && (back === null || back.standing < 0.3)
        && tie.factIds.some(id => state.history.facts.some(fact => fact.id === id
            && fact.data.pressure === 'leverage_applied'));
}

function anonymousLinesIn(state: WorldState): string[] {
    const names = state.npcs.slice(0, 200).map(row => row.name).concat(state.factions.map(row => row.name));
    const errors: string[] = [];
    for (const fact of state.history.facts) {
        if (fact.data.pressure !== 'leverage_applied' && fact.data.pressure !== 'leverage_understood') continue;
        const line = String(fact.data.unattributed ?? '');
        if (line.length <= 10 || names.some(name => line.includes(name))) errors.push(fact.id + ': ' + line);
    }
    return errors;
}

describe('the world runs manoeuvres on people, and not at zero', () => {
    let firings = 0, landed = 0, strongest = 0, oneWay = 0;
    const anonymityErrors: string[] = [];
    let realCampaign: Campaign | null = null;

    beforeAll(async () => {
        for (let sample = 0; sample < 32; sample++) {
            await yieldToIo();
            const window = nativeWindow('lev-window-' + sample);
            firings += window.counts.get('leverage_applied') ?? 0;
            anonymityErrors.push(...anonymousLinesIn(window.state));
        }
        // Retain only one small, actually produced campaign, never walked worlds.
        for (let sample = 0; sample < 256; sample++) {
            if (sample % 32 === 0) await yieldToIo();
            const state = freshScene('lev-scene-' + sample);
            for (let opportunity = 0; opportunity < 8; opportunity++) {
                applied.apply(state, state.currentDay + opportunity,
                    forStream(state.seed, 'native-manoeuvre', opportunity));
            }
            state.currentDay += 7;
            anonymityErrors.push(...anonymousLinesIn(state));
            for (const subject of state.npcs) for (const tie of subject.relationships) {
                if (!tie.factIds.some(id => state.history.facts.some(fact => fact.id === id
                    && fact.data.pressure === 'leverage_applied'))) continue;
                strongest = Math.max(strongest, tie.standing);
                if (tie.kind === 'ally') landed++;
                const actor = state.npcs.find(row => row.id === tie.targetId);
                const back = actor ? relationshipWith(actor, subject.id) : null;
                if (tie.standing >= 0.45 && (back === null || back.standing < 0.3)) oneWay++;
                const candidate = { state, actorId: tie.targetId, subjectId: subject.id };
                if (realCampaign === null && isAnUnreturnedCampaign(candidate)) realCampaign = candidate;
            }
        }
        console.info('[native leverage sample]', { windows: 32, yearsPerWindow: 1, intensity: 128,
            maxEvents: 32, freshScenes: 256, opportunitiesPerScene: 8, firings, landed, strongest, oneWay });
    }, 600_000);

    it('has both templates in the actual weighted table', () => {
        expect(applied).toBeDefined();
        expect(understood).toBeDefined();
        expect(applied.weight).toBeGreaterThan(0);
        expect(understood.weight).toBeGreaterThan(0);
    });

    it('fires through the native yearly caller, above the old floor against zero', () => {
        expect(firings).toBeGreaterThanOrEqual(5);
    });

    it('lets native attachments land and build', () => {
        expect(landed).toBeGreaterThan(0);
        expect(strongest).toBeGreaterThan(0.45);
        expect(realCampaign).not.toBeNull();
        expect(isAnUnreturnedCampaign(realCampaign!)).toBe(true);
    });

    it('produces one-sided ties rather than symmetric transactions', () => {
        expect(oneWay).toBeGreaterThan(0);
    });

    it('usually revisits the actual campaign instead of choosing uniformly from everybody', () => {
        expect(realCampaign).not.toBeNull();
        const starting = realCampaign!;
        expect(isAnUnreturnedCampaign(starting)).toBe(true);
        const withOthers = cloneWorld(starting.state);
        for (let person = 2; person < 34; person++) withOthers.npcs.push(createNpc(withOthers.seed, {
            id: 'npc-' + person, locationId: 'loc-market', onDay: withOthers.currentDay,
            bornOnDay: withOthers.currentDay - 30 * YEAR, spiritStones: 0
        }));
        let repeated = 0;
        for (let sample = 0; sample < 64; sample++) {
            const state = cloneWorld(withOthers);
            const event = applied.apply(state, state.currentDay, forStream(state.seed, 'native-revisit', sample));
            if (event?.fact.actors.some(row => row.id === starting.actorId && row.role === 'asked')
                && event.fact.actors.some(row => row.id === starting.subjectId && row.role === 'was asked')) repeated++;
        }
        expect(repeated, 'most opportunities ignored the campaign already running').toBeGreaterThan(32);
    });

    it('discovers an unreturned native attachment even after the actor dies', () => {
        expect(realCampaign).not.toBeNull();
        const campaign = { ...realCampaign!, state: cloneWorld(realCampaign!.state) };
        expect(isAnUnreturnedCampaign(campaign)).toBe(true);
        const at = campaign.state.npcs.findIndex(row => row.id === campaign.actorId);
        campaign.state.npcs[at] = markDead(campaign.state.npcs[at]!, campaign.state.currentDay, 'Died.');
        expect(campaign.state.npcs[at]!.status).toBe('physically_dead');
        expect(isAnUnreturnedCampaign(campaign)).toBe(true);
        // Read an older attachment directly; no other person's years are walked.
        const day = campaign.state.currentDay + 5 * YEAR;
        let discoveries = 0;
        for (let sample = 0; sample < 64; sample++) {
            const state = cloneWorld(campaign.state);
            const event = understood.apply(state, day, forStream(state.seed, 'native-discovery', sample));
            if (!event) continue;
            discoveries++;
            expect(event.fact.actors.some(row => row.id === campaign.actorId && row.role === 'used them')).toBe(true);
            expect(event.fact.actors.some(row => row.id === campaign.subjectId && row.role === 'used')).toBe(true);
            expect(relationshipWith(state.npcs.find(row => row.id === campaign.subjectId)!, campaign.actorId, 'enemy')).not.toBeNull();
            expect(anonymousLinesIn(state)).toEqual([]);
        }
        expect(discoveries).toBeGreaterThan(0);
    });

    it('is deterministic for the same native one-year window', async () => {
        const first = nativeWindow('lev-det');
        await yieldToIo();
        const second = nativeWindow('lev-det');
        expect([...first.counts].sort()).toEqual([...second.counts].sort());
    }, 600_000);

    it('never names anybody in the line a stranger would hear', () => {
        expect(firings).toBeGreaterThan(0);
        expect(anonymityErrors).toEqual([]);
    });
});
