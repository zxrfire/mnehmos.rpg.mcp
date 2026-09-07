/**
 * Somebody dies at a friendly bout, and the elders decide what happens next.
 *
 * The design owner, told that a gathering could wound people but never kill
 * one: *"it's not that nothing dies"*, *"someone dies and the thing is
 * cancelled (or goes on, idk, depends on the elders)"*, *"nobody is
 * invincible"*, and *"the killer does get negative rep tho."*
 *
 * WHAT MADE PEOPLE INVINCIBLE WAS NOT A RULE. `ConfrontationResult` documents
 * its `hp` as "the caller writes these", and the gathering never wrote them -
 * so every bout in the world's history was fought by people whose bodies could
 * not be emptied. Replayed over 600 friendly bouts before the change: 1 ended
 * with a bar at zero and 508 of 1200 combatants came out under a quarter. The
 * combat layer had never agreed that anybody was invincible.
 *
 * AND WHAT KEEPS IT RARE IS ALSO NOT A RULE ABOUT FRIENDLY BOUTS. Replaying
 * 3000 of them, every single bout that emptied a bar took 7 to 11 exchanges
 * against 6.5 for the rest. Not one death came from a blow nobody saw coming -
 * they were long grinding bouts in a full courtyard, which is the bout somebody
 * standing there stops. So a death is a bout nobody could stop.
 *
 * Everything below reads what the engine RETURNS: `holdGathering` hands back
 * the `Gathering`, and the three readings are called directly. Nothing here
 * iterates a field that does not exist.
 */

import { describe, expect, it } from 'vitest';
import { createWorld, makeFaction, type WorldState } from '../../../src/engine/world/world-state';
import { makeLocation } from '../../../src/engine/world/locations';
import {
    createNpc, setRealm, maxBodyOf, upsertRelationship
} from '../../../src/engine/world/npc-state';
import { forStream } from '../../../src/engine/cultivation/rng';
import { realmIndexOf } from '../../../src/engine/cultivation/realms';
import { DISPOSITION_BANDS } from '../../../src/engine/social-leverage/how-freely-somebody-parts-with-what-they-have';
import { seedWorld } from '../../../src/engine/world/seeding';
import { loadCultivationCatalog } from '../../../src/engine/world/catalog';
import { advanceWorldForPlay } from '../../../src/engine/world/driver';
import { circlesOf, holdGathering } from '../../../src/engine/world/gatherings';
import {
    whetherItGoesOn,
    whetherTheyGotUp,
    whoCouldHaveStoppedIt,
    whyTheyStoodUp,
    NOTHING_LEFT_BUT_TO_END_IT,
    WHAT_A_DEATH_MOVES_A_ROOM,
    type HowItLooked,
    type WhoWentDown
} from '../../../src/engine/world/nobody-is-invincible';

// ─────────────────────────────────────────────────────────────────────────
// A YARD BUILT TO THE CONDITIONS THE RULE NAMES
//
// Lived worlds produce a death about once in 280 challenges - measured at 1
// across four seeds and 4,800 gathering years - which is the right rate for
// the world and far too thin to rest an assertion on. So the fixture builds
// the case instead: three houses of near-matched juniors, and nobody in the
// yard standing above them. Measured at 3 deaths in 52 challenges.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Qi Condensation is 0..12, Foundation Establishment 13..16, and Core Formation
 * the realm above both. The two who stand up are DELIBERATELY MISMATCHED: an
 * even bout ends with both of them still standing, and it is the lopsided one
 * that grinds a bar down to nothing. Nobody in this yard is above either of
 * them, which is the whole condition being built.
 */
const A_JUNIOR = 12;
const A_PEER = 15;
const A_REALM_ABOVE = 19;

function aYard(opts: { andOneSenior?: boolean; withAGrudge?: boolean } = {}): WorldState {
    const state = createWorld({ seed: 'yard', skipPriorAges: true, regionCount: 0 });
    state.locations.push(makeLocation({
        id: 'loc-region', name: 'The Province', kind: 'region', qiDensity: 0.4
    }));
    for (const id of ['house-a', 'house-b', 'house-c']) {
        state.locations.push(makeLocation({
            id: `seat-${id}`, name: `${id} seat`, kind: 'sect_seat',
            parentId: 'loc-region', qiDensity: 0.4
        }));
        state.factions.push(makeFaction({
            id, name: id, seatLocationId: `seat-${id}`,
            resources: { spirit_stones: 100_000, power_ordinal: 25 }
        }));
    }
    state.factions.find(f => f.id === 'house-b')!.standing['house-a'] = 0.4;
    state.factions.find(f => f.id === 'house-c')!.standing['house-a'] = 0.4;

    let seq = 0;
    const put = (
        factionId: string, ordinal: number, rankIndex: number,
        opts: { competes?: boolean } = {}
    ) => {
        let npc = createNpc(state.seed, {
            id: `npc-${seq++}`,
            bornOnDay: state.currentDay - 365 * 60,
            onDay: state.currentDay,
            locationId: `seat-${factionId}`,
            occupation: 'disciple',
            // The senior WATCHES. Tagging them chosen would put them in the
            // draw, and an elder fighting a junior is a different test.
            tags: opts.competes === false ? [] : ['chosen']
        });
        npc = setRealm(npc, ordinal, state.currentDay);
        state.npcs.push({ ...npc, factionId, factionRankIndex: rankIndex });
    };
    for (const factionId of ['house-a', 'house-b', 'house-c']) {
        put(factionId, A_JUNIOR, 1);
        put(factionId, A_PEER, 1);
    }
    // The only difference between the two halves of this file.
    if (opts.andOneSenior) put('house-a', A_REALM_ABOVE, 4, { competes: false });

    // AND SOMEBODY WHO DID NOT COME FOR A BOUT. Cross-house, because that is
    // who gets drawn, and written onto the row the same way two centuries of
    // gatherings would have written it.
    if (opts.withAGrudge) {
        // BETWEEN THE TWO BEST IN THE YARD, which is the only place a bout can
        // reach a body: put it on a junior instead and one of the seniors
        // standing there steps in every time, which is the rule working and is
        // asserted below on its own.
        const holder = state.npcs.find(
            n => n.factionId === 'house-a' && n.cultivation.realmOrdinal === A_PEER)!;
        const against = state.npcs.find(
            n => n.factionId === 'house-b' && n.cultivation.realmOrdinal === A_PEER)!;
        const at = state.npcs.indexOf(holder);
        state.npcs[at] = upsertRelationship(holder, {
            targetId: against.id,
            targetName: against.name,
            kind: 'enemy',
            standing: -0.95,
            note: 'There is nothing left between them.',
            factIds: [],
            inheritedFromId: null
        }, state.currentDay);
    }
    return state;
}

/** Every challenge the yard produced over 200 draws. */
function cardsFought(opts: { andOneSenior?: boolean; withAGrudge?: boolean } = {}) {
    const out: { state: WorldState; summary: string }[] = [];
    for (let i = 0; i < 200; i++) {
        const state = aYard(opts);
        const held = holdGathering(
            state, circlesOf(state)[0]!, state.currentDay,
            forStream('unstoppable', String(i))
        );
        if (!held || held.kind !== 'challenge') continue;
        out.push({ state, summary: held.fact.summary });
    }
    return out;
}

const deadIn = (state: WorldState) => state.npcs.filter(n => n.status !== 'alive');

describe('a bout is fought with a body', () => {
    it('and somebody nobody could stop does not get up from one', () => {
        const cards = cardsFought({ withAGrudge: true });
        expect(cards.length).toBeGreaterThan(0);
        const died = cards.reduce((n, c) => n + deadIn(c.state).length, 0);
        expect(died).toBeGreaterThan(0);
    });

    it('and does NOT, in the same yard, with one senior standing there', () => {
        // The half that makes the other half mean something. Same fixture,
        // same draws, same bouts - one person a realm above them in the yard.
        // If this ever goes non-zero, somebody stopped reading the room.
        const cards = cardsFought({ withAGrudge: true, andOneSenior: true });
        expect(cards.length).toBeGreaterThan(0);
        expect(cards.reduce((n, c) => n + deadIn(c.state).length, 0)).toBe(0);
    });

    it('and the one who stepped in is named on the record', () => {
        const cards = cardsFought({ withAGrudge: true, andOneSenior: true });
        expect(cards.filter(c => /put a stop to it/.test(c.summary)).length)
            .toBeGreaterThan(0);
    });

    it('and the dead are dead on the record, not just in the sentence', () => {
        // A summary saying somebody died while the row still reads alive is a
        // narration bug wearing a mechanic's coat. `settleNpcDeath` is the same
        // handoff every other death in the world gets.
        let checked = 0;
        for (const card of cardsFought({ withAGrudge: true })) {
            for (const npc of deadIn(card.state)) {
                checked++;
                expect(npc.diedOnDay).not.toBeNull();
                expect(npc.endNote).toMatch(/friendly bout/);
                expect(card.summary).toContain('did not get up');
            }
        }
        expect(checked).toBeGreaterThan(0);
    });

    it('and nobody who walked away is left holding a zero', () => {
        // A living row at zero is a corpse to the next pass that reads it. The
        // stopped bout floors them at one, deliberately.
        for (const card of cardsFought({ withAGrudge: true, andOneSenior: true })) {
            for (const npc of card.state.npcs) {
                if (npc.status !== 'alive') continue;
                expect(npc.cultivation.hp).toBeGreaterThan(0);
            }
        }
    });

    it('and only the person who could not stop it decides that', () => {
        // The reading itself, at the boundary. A peer cannot get a hand between
        // two people as fast as they are; a realm above them can.
        const state = aYard({ andOneSenior: true });
        const fighters = state.npcs.filter(n => n.cultivation.realmOrdinal === A_PEER);
        expect(fighters.length).toBeGreaterThan(1);
        const top = realmIndexOf(A_PEER);
        const could = whoCouldHaveStoppedIt({
            present: state.npcs,
            fighting: [fighters[0]!.id, fighters[1]!.id],
            reachedRealm: top
        });
        expect(could.length).toBe(1);
        expect(could[0]!.cultivation.realmOrdinal).toBe(A_REALM_ABOVE);

        const peersOnly = aYard();
        const twoOfThem = peersOnly.npcs.filter(n => n.cultivation.realmOrdinal === A_PEER);
        expect(twoOfThem.length).toBeGreaterThan(1);
        expect(whoCouldHaveStoppedIt({
            present: peersOnly.npcs,
            fighting: [twoOfThem[0]!.id, twoOfThem[1]!.id],
            reachedRealm: top
        })).toEqual([]);
    });
});

describe('and why they stood up is what decides it', () => {
    it('a yard with nothing between anybody kills nobody, however long it runs', () => {
        // The control. Same six people, same 200 draws, no grudge written -
        // every bout is a test and a test cannot kill you, because the resolver
        // returns `capture` for a subdue whatever the damage did. Measured over
        // 2,666 replays: 115 emptied bars, 115 of them captures, no deaths.
        const cards = cardsFought();
        expect(cards.length).toBeGreaterThan(0);
        expect(cards.reduce((n, c) => n + deadIn(c.state).length, 0)).toBe(0);
    });

    it('and reads off the standing the world already wrote', () => {
        const state = aYard();
        const one = state.npcs[0]!;
        const other = state.npcs[2]!;
        const holding = (standing: number) => upsertRelationship(one, {
            targetId: other.id, targetName: other.name, kind: 'enemy',
            standing, note: '', factIds: [], inheritedFromId: null
        }, state.currentDay);

        // Nobody is owed anything, so it is a bout.
        expect(whyTheyStoodUp({ who: one, against: other.id })).toBe('a_test');
        expect(whyTheyStoodUp({ who: holding(0.5), against: other.id })).toBe('a_test');
        // An account is still a bout. There is no middle state: somebody who
        // merely dislikes you stands up to test you like everybody else.
        expect(whyTheyStoodUp({ who: holding(-0.5), against: other.id })).toBe('a_test');
        expect(whyTheyStoodUp({
            who: holding(NOTHING_LEFT_BUT_TO_END_IT + 0.01), against: other.id
        })).toBe('a_test');
        // And the end of it.
        expect(whyTheyStoodUp({ who: holding(NOTHING_LEFT_BUT_TO_END_IT), against: other.id }))
            .toBe('to_end_them');
        expect(whyTheyStoodUp({ who: holding(-1), against: other.id })).toBe('to_end_them');
    });

    it('and somebody nobody holds anything against is a stranger, not a friend', () => {
        // A missing row reads as nothing between them, which is a bout. It must
        // never read as zero-and-therefore-hostile.
        const state = aYard();
        expect(whyTheyStoodUp({ who: state.npcs[0]!, against: 'npc-nobody' })).toBe('a_test');
    });

    it('and the one threshold is borrowed, and it is a hatred rather than a dislike', () => {
        // Borrowed from the band the world reads every other disposition
        // against, and hard enough that it is not somewhere two bad afternoons
        // put you. A lighter bar here was measured moving what houses decided
        // about their treasuries, three files away.
        expect(NOTHING_LEFT_BUT_TO_END_IT).toBe(-DISPOSITION_BANDS.MARKED);
        expect(NOTHING_LEFT_BUT_TO_END_IT).toBeLessThan(-DISPOSITION_BANDS.WORTH_SAYING);
        expect(NOTHING_LEFT_BUT_TO_END_IT).toBeGreaterThan(-1);
    });
});

describe('and then the elders decide', () => {
    it('never carries on over one of their own killed on purpose', async () => {
        // The one entry in the table that is absolute. There is no version of a
        // room watching its own disciple killed deliberately and then calling
        // the next pair up.
        for (const house of (await aLivedWorld()).factions) {
            const ruling = whetherItGoesOn({
                who: 'the_hosts_own',
                how: 'past_the_mark',
                roll: rollFor(await aLivedWorld(), house.id),
                rankCount: house.ranks.length
            });
            expect(ruling.goesOn).toBe(false);
        }
    });

    it('and genuinely splits over a guest who died by accident', async () => {
        // *"cancelled (or goes on, idk, depends on the elders)"* - so both
        // answers have to be ordinary. A table that always says one thing is a
        // constant with a room drawn around it. Measured at 19 of 43 houses.
        const world = await aLivedWorld();
        let asked = 0;
        let on = 0;
        for (const house of world.factions) {
            const ruling = whetherItGoesOn({
                who: 'a_guest',
                how: 'an_accident',
                roll: rollFor(world, house.id),
                rankCount: house.ranks.length
            });
            asked++;
            if (ruling.goesOn) on++;
        }
        expect(asked).toBeGreaterThan(0);
        expect(on).toBeGreaterThan(0);
        expect(on).toBeLessThan(asked);
    });

    it('and a house with nobody senior enough to rule does not carry on', () => {
        // Not squeamishness. There is no room, and a thing nobody is running
        // has already stopped.
        const ruling = whetherItGoesOn({
            who: 'a_guest', how: 'an_accident', roll: [], rankCount: 5
        });
        expect(ruling.answer.leaning).toBeNull();
        expect(ruling.goesOn).toBe(false);
    });

    it('and reads every case off one table, in the right order', () => {
        // Deliberate is worse than accident, and their own is worse than a
        // guest's. Asserted on the table so a later edit that inverts a row is
        // caught here rather than in a world two hours later.
        for (const how of ['an_accident', 'past_the_mark'] as HowItLooked[]) {
            expect(WHAT_A_DEATH_MOVES_A_ROOM.the_hosts_own[how])
                .toBeLessThan(WHAT_A_DEATH_MOVES_A_ROOM.a_guest[how]);
        }
        for (const who of ['the_hosts_own', 'a_guest'] as WhoWentDown[]) {
            expect(WHAT_A_DEATH_MOVES_A_ROOM[who].past_the_mark)
                .toBeLessThan(WHAT_A_DEATH_MOVES_A_ROOM[who].an_accident);
        }
    });
});

describe('the single death gate is the one that answers', () => {
    it('an empty bar is a combat defeat and a bar with anything in it is not', () => {
        const someone = aYard().npcs[0]!;
        expect(whetherTheyGotUp({ npc: someone, hp: 0, onDay: 100 }).cause)
            .toBe('combat_defeat');
        expect(whetherTheyGotUp({ npc: someone, hp: 1, onDay: 100 }).cause).toBeNull();
        expect(whetherTheyGotUp({ npc: someone, hp: maxBodyOf(someone), onDay: 100 }).cause)
            .toBeNull();
    });

    it('and it never kills somebody of hunger at a gathering', () => {
        // The gate reads the whole person. A caller that invented a belly to
        // satisfy the signature would let a courtyard bout kill somebody of
        // starvation, so the fields this caller did not watch go in neutral.
        const cause = whetherTheyGotUp({ npc: aYard().npcs[0]!, hp: 0, onDay: 100 }).cause;
        expect(cause).not.toBe('starvation');
        expect(cause).not.toBe('lifespan_exhausted');
        expect(cause).not.toBe('stagnation_aging');
    });
});

describe('and the killer wears it', () => {
    it('is held against them by people who were not in the bout', () => {
        // *"the killer does get negative rep tho."* Which is not a field. A
        // reputation in this world is what the people who watched hold about
        // you, so the check is that the watchers' rows moved - and that they
        // are people who were standing there rather than the two fighting.
        let held = 0;
        for (const card of cardsFought({ withAGrudge: true })) {
            const dead = deadIn(card.state);
            if (dead.length === 0) continue;
            for (const witness of card.state.npcs) {
                if (witness.status !== 'alive') continue;
                for (const tie of witness.relationships) {
                    if (tie.standing <= -0.3 && /friendly bout/.test(tie.note ?? '')) held++;
                }
            }
        }
        expect(held).toBeGreaterThan(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────

let lived: WorldState | null = null;
async function aLivedWorld(): Promise<WorldState> {
    if (lived) return lived;
    const catalog = await loadCultivationCatalog();
    const { state } = seedWorld({ seed: 'inv-rooms', catalog });
    advanceWorldForPlay(state, { days: 150 * 365, stopOnInterrupt: false });
    lived = state;
    return lived;
}

function rollFor(state: WorldState, factionId: string) {
    return state.npcs
        .filter(n => n.factionId === factionId && n.status === 'alive')
        .map(n => ({ id: n.id, rankIndex: n.factionRankIndex }));
}
