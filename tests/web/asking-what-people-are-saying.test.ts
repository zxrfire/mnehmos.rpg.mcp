/**
 * "What news is there?" - reaching the world's own ledger through a stranger.
 *
 * The defect these pin down is the one this project keeps rediscovering: an
 * engine module with no verb. `what-people-are-saying.ts` shipped one commit
 * before this file and was measured against a live server, where four of five
 * natural phrasings deflected into the `recall` listing - a confident,
 * well-composed inventory of what the player already held, in answer to a
 * question about the world.
 *
 * So half of this suite is about ROUTING, and it is the half that matters.
 */

import { describe, it, expect } from 'vitest';

import { parseIntent } from '../../src/web/actions';
import { askAround, factsForNews } from '../../src/web/asking-what-people-are-saying';
import { makeGame } from './harness';
import { createWorld, makeFaction, type WorldState } from '../../src/engine/world/world-state';
import { createNpc, setRealm } from '../../src/engine/world/npc-state';
import { makeLocation } from '../../src/engine/world/locations';
import { makeFact } from '../../src/engine/world/history';
import { appendWorldFact } from '../../src/engine/world/who-was-there-when-it-happened';
import type { Cultivator, Run } from '../../src/schema/cultivation';
import type { RosterEntry } from '../../src/storage/repos/cultivator.repo';

// ─────────────────────────────────────────────────────────────────────────
// ROUTING
// ─────────────────────────────────────────────────────────────────────────

describe('a player can actually ask', () => {
    /**
     * Measured against a live server at 83bf514, before the verb existed. The
     * first four came back as the known-names listing and the fifth as a
     * graceful nothing.
     */
    const MEASURED_DEAD = [
        'what news is there',
        'I listen for rumours',
        'what are people saying',
        'what is happening in the world',
        'I ask around for gossip'
    ];

    it('reaches news from every phrasing that was measured dead', () => {
        for (const line of MEASURED_DEAD) {
            expect(parseIntent(line)?.action, line).toBe('news');
        }
    });

    it('reaches it from the phrasings that contain no word for news at all', () => {
        // The lesson this repo relearns: the failing half is usually the more
        // natural phrasing. Neither of these says "news" or "rumour".
        for (const line of ['what is the word', 'what is the talk', 'what have you heard']) {
            expect(parseIntent(line)?.action, line).toBe('news');
        }
    });

    it('does not swallow the ground its own words also match', () => {
        // `NEWS_AND_RUMOUR` carries a bare "what do people say" from before this
        // verb existed, and `PLACE_HISTORY_PATTERNS` carries the same words. The
        // split is by what the question POINTS AT.
        const asked = parseIntent('what do people say about this place');
        expect(asked?.action).toBe('look');
        expect(asked?.intent).toBe('history');
    });

    it('does not swallow the question about the holder\'s own head', () => {
        expect(parseIntent('what do I know of Lu Sheng')?.action).toBe('recall');
        expect(parseIntent('what do I know')?.action).toBe('recall');
        expect(parseIntent('what is my dao')?.action).toBe('recall');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// WHAT COMES BACK
// ─────────────────────────────────────────────────────────────────────────

const DAY = 365 * 1_000;

function worldWithSomethingWorthSaying(): WorldState {
    const state = createWorld({ seed: 'news-test', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    state.locations.push(makeLocation({
        id: 'loc-here', name: 'The Province', kind: 'region', qiDensity: 0.4
    }));
    state.locations.push(makeLocation({
        id: 'square', name: 'Sixmile', kind: 'settlement', parentId: 'loc-here', qiDensity: 0.4
    }));
    state.factions.push(makeFaction({
        id: 'house-high', name: 'The High House', seatLocationId: 'square',
        resources: { power_ordinal: 44 }
    }));
    for (const [id, name, ordinal] of [['apex-a', 'Apex A', 44], ['apex-b', 'Apex B', 43]] as const) {
        let npc = createNpc(state.seed, {
            id, name, bornOnDay: DAY - 365 * 300, onDay: DAY,
            locationId: 'square', occupation: 'disciple'
        });
        npc = setRealm(npc, ordinal, DAY);
        state.npcs.push(npc);
    }
    appendWorldFact(state, makeFact({
        day: DAY - 365 * 5,
        kind: 'grudge_opened',
        scale: 'continental',
        magnitude: 0.9,
        visibility: 'public',
        locationId: 'square',
        factionIds: ['house-high'],
        actors: [
            { id: 'apex-a', name: 'Apex A', role: 'claimant' },
            { id: 'apex-b', name: 'Apex B', role: 'refuser' }
        ],
        summary: 'Apex A asked and Apex B refused in front of witnesses.'
    }));
    return state;
}

function carter(id: string, ordinal: number): RosterEntry {
    return {
        id, name: `Teller ${id}`, kind: 'npc', spiritRoot: 'single_water',
        realmOrdinal: ordinal, location: 'Sixmile', sectId: null, sectName: null,
        sectRank: null, age: 40, alive: true, existenceState: 'alive',
        soulState: 'intact', identityContinuity: 1, deathCause: null,
        spiritStones: 0, untreatedInjuries: 0, feuds: []
    };
}

async function player(): Promise<{ cultivator: Cultivator; run: Run }> {
    const { game } = makeGame({ seed: 'news-test' });
    const { cultivator } = await game.newRun('Listener');
    return { cultivator, run: game.state().run as Run };
}

describe('what the square says', () => {
    it('refuses when there is nobody to ask, and says why', async () => {
        const { cultivator, run } = await player();
        const asked = askAround({
            cultivator, run, present: [], world: worldWithSomethingWorthSaying(),
            occasion: 'news'
        });
        expect(asked.heard).toHaveLength(0);
        expect(asked.prose).toContain('nobody here');
    });

    it('refuses with no world at all rather than inventing a wire service', async () => {
        const { cultivator, run } = await player();
        const asked = askAround({
            cultivator, run, present: [carter('a', 4)], world: null, occasion: 'news'
        });
        expect(asked.heard).toHaveLength(0);
    });

    it('attributes every line to somebody who said it', async () => {
        const { cultivator, run } = await player();
        const world = worldWithSomethingWorthSaying();
        const asked = askAround({
            cultivator, run, world, occasion: 'news',
            present: [carter('a', 4), carter('b', 6)]
        });
        expect(asked.heard.length).toBeGreaterThan(0);
        for (const told of asked.heard) {
            expect(told.speaker.length).toBeGreaterThan(0);
            expect(asked.prose).toContain(told.speaker);
        }
    });

    it('never hands the narrator the distortion, and always hands the operator it', async () => {
        const { cultivator, run } = await player();
        const world = worldWithSomethingWorthSaying();
        const asked = askAround({
            cultivator, run, world, occasion: 'news', present: [carter('a', 4)]
        });
        const facts = factsForNews(asked);
        for (const line of facts.lines) {
            for (const tell of ['intact', 'inflated', 'misattributed', 'misplaced', 'fidelity']) {
                expect(line.toLowerCase()).not.toContain(tell);
            }
        }
        expect(facts.structure.join(' ')).toContain('fidelity');
    });

    it('writes what was said, not what happened, as the record for a name', async () => {
        const { cultivator, run } = await player();
        const world = worldWithSomethingWorthSaying();
        const asked = askAround({
            cultivator, run, world, occasion: 'news', present: [carter('a', 4)]
        });
        // The whole of checkability. The statement carried onto a knowledge
        // record is the RUMOUR'S sentence, so two tellings of one night land as
        // two records on the same name and `recall` hands back both.
        for (const hearing of asked.hearings) {
            for (const name of hearing.names) {
                expect(name.statement).toBe(hearing.prose?.split(' says: ')[1]);
                expect(name.stage).toBe('whisper');
            }
        }
    });

    it('is the same answer on the same day, and asking twice is not two draws', async () => {
        const { cultivator, run } = await player();
        const world = worldWithSomethingWorthSaying();
        const input = {
            cultivator, run, world, occasion: 'news',
            present: [carter('a', 4), carter('b', 6)]
        };
        expect(askAround(input).prose).toBe(askAround(input).prose);
    });
});
