/**
 * "Does anyone know a sect I may visit?" is put to the people here, and each
 * answers with the houses THEY can place. The player's own list is never the
 * answer.
 *
 * Played at a crowded square: the model read it as `request`, the guard fell
 * back to the sect listing, and the player was read their own 38 known houses
 * while nobody in the crowd was asked.
 */

import { describe, expect, it } from 'vitest';

import { makeGameInWorld, ScriptedProvider } from './harness';
import { parseIntent } from '../../src/web/actions';
import {
    A_TOPIC_ABOUT_THE_HOUSES_THEY_KNOW,
    asksWhichHousesTheyKnow,
    theHousesTheyWouldName
} from '../../src/web/which-houses-somebody-could-name';

type Played = { narration?: string; toolCalls: { name: string; action: string; summary: string }[] };

const THE_PLAYERS_OWN_LIST = 'The names you have for this are';

describe('the words', () => {
    it('puts a question about houses to the room', () => {
        for (const said of [
            'Does anyone know the strongest sect i may visit?',
            'i ask about a sect',
            'does anyone here know of a sect nearby?',
            'can anybody tell me which sects are around here?'
        ]) {
            expect(parseIntent(said), said).toMatchObject({
                action: 'interact', target: 'everyone here', topic: A_TOPIC_ABOUT_THE_HOUSES_THEY_KNOW
            });
        }
    });

    it('tells a kind of house from one house and from a thing of a house', () => {
        expect(asksWhichHousesTheyKnow('the strongest sect i may visit')).toBe(true);
        expect(asksWhichHousesTheyKnow('a sect')).toBe(true);
        expect(asksWhichHousesTheyKnow('sects around here')).toBe(true);
        expect(asksWhichHousesTheyKnow('the sect library')).toBe(false);
        expect(asksWhichHousesTheyKnow('the Azure Dew Sect')).toBe(false);
    });

    it('names their own house first, then who holds the ground, and three at most', () => {
        const house = (id: string, seat: string | null = null) =>
            ({ id, name: id, seatLocationId: seat, controlledLocationIds: [] });
        const named = theHousesTheyWouldName({
            houses: [house('far'), house('apex'), house('local', 'here'), house('mine'), house('other')],
            theirHouseId: 'mine',
            standingOn: 'here',
            whatTheyKnow: id => id === 'apex' ? null : id === 'other' ? 'placed' : 'named'
        });
        expect(named.map(h => h.id)).toEqual(['mine', 'local', 'other']);
    });
});

async function aCrowdedSquare(seed: string, provider?: ScriptedProvider) {
    const harness = await makeGameInWorld({ seed, worldSeed: 'road-world', ...(provider ? { provider } : {}) });
    const { cultivator } = await harness.game.newRun('Probe');
    expect(harness.game.present(cultivator).length).toBeGreaterThanOrEqual(2);
    return { ...harness, cultivator };
}

function theyWereAsked(done: Played, game: Awaited<ReturnType<typeof aCrowdedSquare>>) {
    const answers = done.toolCalls.filter(call => call.name === 'engine.theHousesTheyCouldName');
    expect(answers.length).toBeGreaterThanOrEqual(1);
    expect(answers.length).toBeLessThanOrEqual(3);
    expect(done.toolCalls.some(call => call.name.startsWith('sect_manage'))).toBe(false);
    expect(done.narration ?? '').not.toContain(THE_PLAYERS_OWN_LIST);
    // Whatever was named is the player's now, told by the one who named it.
    for (const call of done.toolCalls.filter(c => c.action === 'house_told')) {
        const id = /\(([^)]+)\)/.exec(call.summary)?.[1] ?? '';
        expect(game.game.knowledge.isAwareOf(game.cultivator.id, 'sect', id), call.summary).toBe(true);
    }
    return answers;
}

describe('played', () => {
    it('is answered by the people here, with no model', async () => {
        const game = await aCrowdedSquare('houses-table');
        const done = await game.game.act('Does anyone know the strongest sect i may visit?') as Played;
        theyWereAsked(done, game);
    }, 300_000);

    it('is answered by the people here when the model read it as a request', async () => {
        const plans = [JSON.stringify({
            action: 'request', intent: 'telling', topic: 'the strongest sect i may visit'
        })];
        const provider = new ScriptedProvider({ plans, narrations: ['(scripted)'] });
        const game = await aCrowdedSquare('houses-model', provider);
        const done = await game.game.act('Does anyone know the strongest sect i may visit?') as Played;
        theyWereAsked(done, game);
    }, 300_000);
});
