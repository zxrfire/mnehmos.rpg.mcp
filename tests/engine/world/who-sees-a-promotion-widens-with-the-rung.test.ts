/**
 * Who sees a promotion, and how far "there" reaches.
 *
 * The design owner, asked who witnesses one: *"whoever happens to be in the
 * area? for ordinal promotions. a tribulation transcendent, the whole region can
 * see. for foundation establishment maybe not even your town can see."*
 *
 * Two defects, both measured on this tree before this file existed.
 *
 * ── ONE QUESTION, TWO ANSWERS ────────────────────────────────────────────
 *
 * A crossing reaches the ledger down two doors - `aCrossingEntersTheWorld` for
 * the player, `recordCrossing` for everybody the world advances - and each
 * derived the row's `scale` for itself. One read the realm the rung sits in; the
 * other carried raw ordinal cutoffs of 45, 34 and 20. Measured with
 * `scripts/probe-who-sees-a-crossing.ts`, across the nine realms a crossing can
 * land in:
 *
 *     realms where the two doors disagreed      7 of 9
 *     Core Formation                            personal  vs  local
 *     Nascent Soul                              local     vs  regional
 *     Grand Ascension                           regional  vs  continental
 *
 * So the same wall filed a different row depending on whose attempt it was, and
 * `airtimeOf` then spent a different distance budget on each. That is the second
 * copy of a fact AGENTS.md names, and it had already drifted.
 *
 * ── AND "THERE" WAS ONE SQUARE, AT EVERY RUNG ────────────────────────────
 *
 * `whoWasThere` drew every witness from the single `locationId`, so who could
 * have seen a crossing did not move between Foundation Establishment and going
 * through the Lid. Measured in the same run, in a 613-person world:
 *
 *     rung                        people who could have seen it, before / after
 *     Foundation Establishment                    24 / 24
 *     Grand Ascension                             24 / 122
 *     Tribulation Transcendence                   24 / 613
 *
 * The fix adds no vocabulary: `EventScale` already says how far the consequence
 * physically reached, and how far it reached is how far it could be seen from.
 *
 * ── What these assertions pin, and what they deliberately do not ─────────
 *
 * They pin that the two doors agree, and that the area widens. They do NOT pin
 * which scale any particular realm is at - that is the ruling in `ARRIVING_IN`
 * and the sibling test `a-crossing-enters-the-world-as-news.test.ts` holds it.
 * Pinning it twice is how the second copy got here in the first place.
 *
 * RED-CHECKED. Restoring the ordinal cutoffs in `recordCrossing` fails the first
 * describe; making `howFarASeeingReaches` answer 'where it happened' for every
 * scale fails the other two.
 */

import { describe, it, expect } from 'vitest';

import { createWorld, type WorldState } from '../../../src/engine/world/world-state.js';
import { createNpc, setRealm, type NpcRecord } from '../../../src/engine/world/npc-state.js';
import { makeLocation } from '../../../src/engine/world/locations.js';
import { REALM_TIERS } from '../../../src/engine/cultivation/realms.js';
import { BreakthroughResultSchema } from '../../../src/schema/cultivation.js';
import { aCrossingEntersTheWorld } from '../../../src/engine/world/a-crossing-enters-the-world-as-news.js';
import { recordCrossing } from '../../../src/engine/world/recording-what-a-crossing-did.js';
import {
    howFarASeeingReaches,
    whoCouldHaveSeenIt
} from '../../../src/engine/world/how-far-a-seeing-reaches.js';
import { whoWasThere } from '../../../src/engine/world/who-was-there-when-it-happened.js';

const DAY = 365 * 1_000;

/**
 * Every realm boundary on the ladder, read off `REALM_TIERS` rather than typed
 * out, so adding a realm needs no change here.
 */
const EVERY_WALL = REALM_TIERS.slice(1).map((realm, at) => ({
    name: realm.name,
    from: REALM_TIERS[at].ordinalEnd,
    to: realm.ordinalStart
}));

function build(): WorldState {
    const state = createWorld({ seed: 'who-sees-a-promotion', skipPriorAges: true, regionCount: 0 });
    state.currentDay = DAY;
    for (const [id, name] of [['loc-here', 'The Near Province'], ['loc-away', 'The Far Province']]) {
        state.locations.push(makeLocation({ id, name, kind: 'region', qiDensity: 0.4 }));
    }
    for (const [id, name, parentId] of [
        ['town-near', 'The Near Town', 'loc-here'],
        ['town-next', 'The Next Town', 'loc-here'],
        ['town-far', 'The Far Town', 'loc-away']
    ]) {
        state.locations.push(makeLocation({ id, name, kind: 'settlement', parentId, qiDensity: 0.4 }));
    }
    push(state, 'climber', 'The Climber', 12, 'town-near');
    push(state, 'neighbour', 'A Neighbour', 4, 'town-near');
    push(state, 'next-town', 'Somebody In The Next Town', 4, 'town-next');
    push(state, 'stranger', 'A Stranger', 4, 'town-far');
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

/** The row the world's own advancement files, through `recordCrossing`. */
function theNpcDoor(state: WorldState, from: number, to: number): string {
    const npc = state.npcs.find(n => n.id === 'climber')!;
    const filed = recordCrossing(state, { ...npc, locationId: 'town-near' }, BreakthroughResultSchema.parse({
        outcome: 'success', fromOrdinal: from, toOrdinal: to, finalChance: 0.5, roll: 0.1
    }), DAY - 365);
    return filed!.scale;
}

/** The row a played crossing files, through `aCrossingEntersTheWorld`. */
function thePlayerDoor(state: WorldState, from: number, to: number): string {
    const filed = aCrossingEntersTheWorld(state, {
        who: { id: 'climber', name: 'The Climber', role: 'crossed' },
        fromOrdinal: from, toOrdinal: to, day: DAY - 365, locationId: 'town-near'
    });
    return filed!.fact.scale;
}

// ─────────────────────────────────────────────────────────────────────────

describe('one wall, one reach, whichever door the attempt came through', () => {
    it('files the same scale for the player and for anybody the world advances', () => {
        for (const wall of EVERY_WALL) {
            expect([wall.name, theNpcDoor(build(), wall.from, wall.to)])
                .toEqual([wall.name, thePlayerDoor(build(), wall.from, wall.to)]);
        }
    });
});

describe('how far "there" reaches', () => {
    it('keeps a crossing at the bottom of the ladder inside the place it happened', () => {
        const state = build();
        const bottom = EVERY_WALL[0];
        const scale = thePlayerDoor(state, bottom.from, bottom.to);
        expect(howFarASeeingReaches(scale as never)).toBe('where it happened');
        const seen = (at: string) => whoCouldHaveSeenIt(state, {
            scale: scale as never, locationId: 'town-near', whoWasStandingAt: at
        });
        expect(seen('town-near')).toBe(true);
        expect(seen('town-next')).toBe(false);
        expect(seen('town-far')).toBe(false);
    });

    it('lets the province see a crossing at the top of the ladder', () => {
        const state = build();
        const top = EVERY_WALL[EVERY_WALL.length - 3];
        const scale = thePlayerDoor(state, top.from, top.to);
        const seen = (at: string) => whoCouldHaveSeenIt(state, {
            scale: scale as never, locationId: 'town-near', whoWasStandingAt: at
        });
        expect(seen('town-near')).toBe(true);
        expect(seen('town-next')).toBe(true);
    });

    it('never narrows as the rung climbs', () => {
        const state = build();
        let before = 0;
        for (const wall of EVERY_WALL) {
            const scale = thePlayerDoor(build(), wall.from, wall.to);
            const could = state.npcs.filter(n => whoCouldHaveSeenIt(state, {
                scale: scale as never, locationId: 'town-near', whoWasStandingAt: n.locationId
            })).length;
            expect([wall.name, could >= before]).toEqual([wall.name, true]);
            before = could;
        }
        // And it genuinely moved, rather than being flat and non-decreasing.
        expect(before).toBeGreaterThan(state.npcs.filter(n => n.locationId === 'town-near').length);
    });
});

describe('the people the ledger actually names', () => {
    it('draws them from the area rather than always from the one square', () => {
        const state = build();
        const wide = whoWasThere(state, {
            day: DAY, locationId: 'town-near', actorIds: [], visibility: 'public', scale: 'world'
        });
        const narrow = whoWasThere(state, {
            day: DAY, locationId: 'town-near', actorIds: [], visibility: 'public', scale: 'personal'
        });
        expect(narrow.every(id => state.npcs.find(n => n.id === id)!.locationId === 'town-near'))
            .toBe(true);
        expect(wide.some(id => state.npcs.find(n => n.id === id)!.locationId !== 'town-near'))
            .toBe(true);
    });
});
