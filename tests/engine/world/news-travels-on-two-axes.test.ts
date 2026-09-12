/**
 * Gossip has two axes, and only one of them existed.
 *
 * `airtimeOf` scored a fact by how big it was, how far above the teller the
 * people in it stood, and how old it was. There was no term for WHERE it
 * happened - `TellerStanding` has carried `regionId` the whole time and
 * `airtimeOf` never read it - so a minor event was quiet EVERYWHERE rather than
 * known in the street it happened in and unknown a province away.
 *
 * Measured, and the measurement is in the header of
 * `a-fresh-world-has-somebody-to-tell.test.ts`: standing in the town where a
 * killing happened, next to the dead man's father, every discovery verb the game
 * has returned nothing, because a fact naming an apex house scored +2.2 for the
 * realm gap alone and a killing between two ordinary people in this street
 * scored +0.3.
 *
 * The ruling these assertions encode is that the two axes are INDEPENDENT:
 * important news travels far, unimportant news stays local, and how far away you
 * are decides WHEN you hear as well as whether. So a big thing that has just
 * happened is local and enormous - everybody here knows it, nobody a province
 * away does yet - and a small thing is known here and nowhere, however long you
 * wait.
 */

import { describe, it, expect } from 'vitest';

import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeFact, type HistoricalFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import {
    circulating,
    howFarOff,
    DAYS_NEWS_TAKES,
    type TellerStanding
} from '../../../src/engine/world/what-people-are-saying.js';

const DAY = 365 * 1_000;

function build(): WorldState {
    const state = createWorld({ seed: 'two-axes', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;

    for (const [id, name] of [['loc-here', 'The Near Province'], ['loc-away', 'The Far Province']]) {
        state.locations.push(makeLocation({ id, name, kind: 'region', qiDensity: 0.4 }));
    }
    state.locations.push(makeLocation({
        id: 'town-near', name: 'The Near Town', kind: 'settlement',
        parentId: 'loc-here', qiDensity: 0.4
    }));
    state.locations.push(makeLocation({
        id: 'town-far', name: 'The Far Town', kind: 'settlement',
        parentId: 'loc-away', qiDensity: 0.4
    }));

    push(state, 'local-a', 'A Local', 4, 'town-near');
    push(state, 'local-b', 'Another Local', 4, 'town-near');
    push(state, 'stranger', 'A Stranger', 4, 'town-far');
    return state;
}

function push(state: WorldState, id: string, name: string, ordinal: number, at: string): void {
    let npc: NpcRecord = createNpc(state.seed, {
        id, name, bornOnDay: state.currentDay - 365 * 200,
        onDay: state.currentDay, locationId: at, occupation: 'disciple'
    });
    npc = setRealm(npc, ordinal, state.currentDay);
    state.npcs.push(npc);
}

/**
 * Somebody standing in the town it happened in, who did not see it.
 *
 * Not a witness on purpose: a witness is 'here' by the witness branch wherever
 * they stand, so a teller who saw it cannot prove anything about the distance
 * bands. Presence is pinned on every fact below for the same reason.
 */
const neighbour: TellerStanding = {
    id: 'local-b', name: 'Another Local', realmOrdinal: 4,
    locationId: 'town-near', regionId: 'loc-here', factionId: null
};

/** Somebody a province away, who is who the distance axis is about. */
const faraway: TellerStanding = {
    id: 'stranger', name: 'A Stranger', realmOrdinal: 4,
    locationId: 'town-far', regionId: 'loc-away', factionId: null
};

/** A sect declaring war: local, because it happened here, and enormous. */
function aSectDeclaredWar(state: WorldState, happenedOnDay: number): HistoricalFact {
    return appendWorldFact(state, makeFact({
        day: happenedOnDay,
        kind: 'war',
        scale: 'regional',
        magnitude: 0.9,
        visibility: 'public',
        locationId: 'town-near',
        witnessIds: ['local-a'],
        actors: [{ id: 'local-a', name: 'A Local', role: 'claimant' }],
        summary: 'A house declared war on another in the square at The Near Town.'
    }), { recur: false });
}

/** A quarrel in the street. Real, and nobody two provinces away will ever care. */
function aQuarrel(state: WorldState, happenedOnDay: number): HistoricalFact {
    return appendWorldFact(state, makeFact({
        day: happenedOnDay,
        kind: 'grudge_opened',
        scale: 'personal',
        magnitude: 0.2,
        visibility: 'public',
        locationId: 'town-near',
        witnessIds: ['local-a'],
        actors: [{ id: 'local-a', name: 'A Local', role: 'claimant' }],
        summary: 'A Local asked for something in the street and was refused.'
    }), { recur: false });
}

function inTheAir(state: WorldState, teller: TellerStanding, onDay: number): string[] {
    return circulating(state, teller, onDay).map(f => f.id);
}

// ─────────────────────────────────────────────────────────────────────────

describe('the distance axis', () => {
    it('knows how far off the teller is standing', () => {
        const state = build();
        const fact = aSectDeclaredWar(state, DAY - 10);
        expect(howFarOff(state, fact, neighbour)).toBe('here');
        expect(howFarOff(state, fact, { ...neighbour, locationId: null })).toBe('in the region');
        expect(howFarOff(state, fact, faraway)).toBe('a region away');
    });

    it('puts a big thing that just happened here and nowhere else yet', () => {
        const state = build();
        const war = aSectDeclaredWar(state, DAY - 10);
        expect(inTheAir(state, neighbour, DAY)).toContain(war.id);
        expect(inTheAir(state, faraway, DAY)).not.toContain(war.id);
    });

    it('lets the same big thing reach a province away once it has had time to', () => {
        const state = build();
        const war = aSectDeclaredWar(state, DAY - 10);
        const arrived = DAY - 10 + DAYS_NEWS_TAKES['a region away'];
        expect(inTheAir(state, faraway, arrived)).toContain(war.id);
    });

    it('carries it with somebody who was standing there, wherever they are now', () => {
        const state = build();
        const war = aSectDeclaredWar(state, DAY - 10);
        // The whole of what a witness is for: they did not hear the news, they
        // brought it, so the story is in a province it had not reached.
        const whoSawIt: TellerStanding = { ...faraway, id: 'local-a' };
        expect(war.witnessIds).toContain('local-a');
        expect(howFarOff(state, war, whoSawIt)).toBe('here');
        expect(inTheAir(state, whoSawIt, DAY)).toContain(war.id);
        expect(inTheAir(state, faraway, DAY)).not.toContain(war.id);
    });
});

describe('the importance axis', () => {
    it('keeps a small thing here and lets it reach nowhere, however long it waits', () => {
        const state = build();
        const quarrel = aQuarrel(state, DAY - 10);
        expect(inTheAir(state, neighbour, DAY)).toContain(quarrel.id);
        expect(inTheAir(state, faraway, DAY)).not.toContain(quarrel.id);
        // A century later. Time is not what was missing.
        expect(inTheAir(state, faraway, DAY + 365 * 100)).not.toContain(quarrel.id);
    });

    it('is the axis that decides which of two things here gets said first', () => {
        const state = build();
        const war = aSectDeclaredWar(state, DAY - 10);
        const quarrel = aQuarrel(state, DAY - 10);
        const here = inTheAir(state, neighbour, DAY);
        expect(here.indexOf(war.id)).toBeLessThan(here.indexOf(quarrel.id));
    });
});

describe('the two compose', () => {
    it('lets the big thing out of the province and keeps the small thing in it', () => {
        const state = build();
        const war = aSectDeclaredWar(state, DAY - 365);
        const quarrel = aQuarrel(state, DAY - 365);
        const abroad = inTheAir(state, faraway, DAY);
        expect(abroad).toContain(war.id);
        expect(abroad).not.toContain(quarrel.id);

        const here = inTheAir(state, neighbour, DAY);
        expect(here).toContain(war.id);
        expect(here).toContain(quarrel.id);
    });
});
