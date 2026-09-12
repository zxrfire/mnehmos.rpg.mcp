/**
 * A breakthrough was not news, and in this genre it is the biggest news there is.
 *
 * `aDeedEntersTheWorld` is called from fights and from sites and was never called
 * from the crossing path, so a player could cross a realm and nothing in the
 * world's own ledger recorded it: `circulating`, `retell` and `buildPlayerDigest`
 * all read `state.history.facts` and there was no row for them to read. Nobody
 * ever heard.
 *
 * The genre is loud about this - people react out loud, the boast is the SPEED of
 * it, houses forbid internal fighting during one because that is when somebody is
 * open, and it draws tribulation - so the question was never whether it is news
 * but how far it goes. The ruling: a Qi Condensation to Foundation Establishment
 * crossing spreads among people near that rung and stays local; somebody hitting
 * Tribulation Transcendence spreads across the land.
 *
 * These assertions encode that through the axes that already exist rather than a
 * scheme of its own:
 *
 *   how far it physically reached   `scale`, which is what `EventScale` means.
 *                                   A Foundation Establishment crossing happens
 *                                   inside one body; a tribulation crossing puts
 *                                   weather over a mountain.
 *   how heavily it is taken         `weight`, which `aDeedEntersTheWorld` turns
 *                                   into the magnitude the digest filters on.
 *   who it means something to       the realm-gap term already in `airtimeOf`,
 *                                   which is why the last test here is two
 *                                   tellers ordering the same two events
 *                                   differently.
 */

import { describe, it, expect } from 'vitest';

import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { makeFact } from '../../../src/engine/world/history.js';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened.js';
import {
    aCrossingEntersTheWorld,
    howFarACrossingCarries
} from '../../../src/engine/world/a-crossing-enters-the-world-as-news.js';
import {
    circulating,
    type TellerStanding
} from '../../../src/engine/world/what-people-are-saying.js';

const DAY = 365 * 1_000;

/** The rungs the ruling names, read off the ladder rather than retyped. */
const QI_CONDENSATION_TOP = 12;
const FOUNDATION_ESTABLISHMENT = 13;
const TRIBULATION_TRANSCENDENCE = 41;

function build(): WorldState {
    const state = createWorld({ seed: 'crossing-news', skipPriorAges: true, regionCount: 0 });
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
    push(state, 'climber', 'The Climber', QI_CONDENSATION_TOP, 'town-near');
    push(state, 'quarreller', 'A Quarreller', 4, 'town-near');
    return state;
}

function push(state: WorldState, id: string, name: string, ordinal: number, at: string): void {
    let npc: NpcRecord = createNpc(state.seed, {
        id, name, bornOnDay: DAY - 365 * 200, onDay: DAY - 365 * 50,
        locationId: at, occupation: 'disciple'
    });
    npc = setRealm(npc, ordinal, DAY - 365 * 50);
    state.npcs.push(npc);
}

function cross(state: WorldState, from: number, to: number, onDay = DAY - 365) {
    return aCrossingEntersTheWorld(state, {
        who: { id: 'climber', name: 'The Climber', role: 'crossed' },
        fromOrdinal: from,
        toOrdinal: to,
        day: onDay,
        locationId: 'town-near'
    });
}

/** Somebody at the rung a Foundation Establishment crossing means something to. */
const nearThatRung: TellerStanding = {
    id: 'peer', name: 'A Peer', realmOrdinal: 3,
    locationId: 'town-near', regionId: 'loc-here', factionId: null
};

/** The same person, a province away. */
const aProvinceAway: TellerStanding = { ...nearThatRung, locationId: 'town-far', regionId: 'loc-away' };

/** Somebody for whom a Foundation Establishment crossing is not an event. */
const farAbove: TellerStanding = { ...nearThatRung, id: 'apex', realmOrdinal: 42 };

function inTheAir(state: WorldState, teller: TellerStanding): string[] {
    return circulating(state, teller, DAY).map(f => f.id);
}

// ─────────────────────────────────────────────────────────────────────────

describe('what a crossing is worth as news', () => {
    it('files nothing for a rung inside a realm, because a layer is not news', () => {
        expect(howFarACrossingCarries(3, 4)).toBeNull();
        const state = build();
        expect(cross(state, 3, 4)).toBeNull();
        expect(state.history.facts).toEqual([]);
    });

    it('grades the reach by the rung crossed and nothing else', () => {
        const low = howFarACrossingCarries(QI_CONDENSATION_TOP, FOUNDATION_ESTABLISHMENT);
        const top = howFarACrossingCarries(
            TRIBULATION_TRANSCENDENCE - 1, TRIBULATION_TRANSCENDENCE
        );
        expect(low).not.toBeNull();
        expect(top).not.toBeNull();
        expect(low!.weight).toBe('slight');
        expect(low!.scale).toBe('personal');
        expect(top!.scale).toBe('continental');
        expect(top!.weight).toBe('unforgivable');
    });

    it('writes a row the rumour layer and the digest can both read', () => {
        const state = build();
        const filed = cross(state, QI_CONDENSATION_TOP, FOUNDATION_ESTABLISHMENT);
        expect(filed).not.toBeNull();
        expect(filed!.fact.kind).toBe('realm_crossing');
        expect(filed!.fact.actors.map(a => a.id)).toEqual(['climber']);
        expect(state.history.facts.map(f => f.id)).toContain(filed!.fact.id);
        // Authored, so a stranger who cannot name them is not handed a shrug.
        expect(String(filed!.fact.data.unattributed).length).toBeGreaterThan(20);
        expect(String(filed!.fact.data.unattributed)).not.toContain('The Climber');
    });
});

describe('how far it goes', () => {
    it('keeps a foundation crossing among the people near it and in the province', () => {
        const state = build();
        const filed = cross(state, QI_CONDENSATION_TOP, FOUNDATION_ESTABLISHMENT)!;
        expect(inTheAir(state, nearThatRung)).toContain(filed.fact.id);
        expect(inTheAir(state, aProvinceAway)).not.toContain(filed.fact.id);
    });

    it('sends a tribulation crossing across the land', () => {
        const state = build();
        const filed = cross(state, TRIBULATION_TRANSCENDENCE - 1, TRIBULATION_TRANSCENDENCE)!;
        expect(inTheAir(state, nearThatRung)).toContain(filed.fact.id);
        expect(inTheAir(state, aProvinceAway)).toContain(filed.fact.id);
    });
});

describe('who it means something to', () => {
    it('is repeated first by somebody near that rung and last by somebody far above it', () => {
        const state = build();
        const filed = cross(state, QI_CONDENSATION_TOP, FOUNDATION_ESTABLISHMENT)!;
        // A bigger thing on its own terms, standing in the same street on the
        // same day, whose people are nobody in particular.
        const quarrel = appendWorldFact(state, makeFact({
            day: DAY - 365, kind: 'grudge_opened', scale: 'personal', magnitude: 0.5,
            visibility: 'public', locationId: 'town-near', witnessIds: ['quarreller'],
            actors: [{ id: 'quarreller', name: 'A Quarreller', role: 'claimant' }],
            summary: 'A Quarreller asked for something in the street and was refused.'
        }), { recur: false });

        const peer = inTheAir(state, nearThatRung);
        const apex = inTheAir(state, farAbove);
        expect(peer.indexOf(filed.fact.id)).toBeLessThan(peer.indexOf(quarrel.id));
        expect(apex.indexOf(filed.fact.id)).toBeGreaterThan(apex.indexOf(quarrel.id));
    });
});
