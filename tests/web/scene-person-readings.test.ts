/**
 * The people in a scene, as the narrator is handed them.
 *
 * Two things this pins that a played run cannot pin cheaply. The first is the
 * TIC: measured, being admitted to a house in front of three people produced
 * three lines that were word for word identical except for the name, which is
 * the failure the whole channel was written to avoid. The second is the
 * discovery gate, which has to hold in a channel that exists to put people in
 * front of the player.
 */

import { describe, expect, it } from 'vitest';

import type { Cultivator } from '../../src/schema/cultivation';
import type { RosterEntry } from '../../src/storage/repos/cultivator.repo';
import type { KnowledgeGate } from '../../src/web/knowledge';
import {
    whatTheFightDidToThem,
    whatThePeopleHereAreAnswering,
    whatTheTurnDidToThePlayer,
    whoThePlanPointedAt,
    theBearingsThisTurnCanRead,
    A_BINDING_MOVED,
    PEOPLE_WORTH_A_SENTENCE
} from '../../src/web/scene-person-readings';

function person(over: Partial<RosterEntry> & { id: string }): RosterEntry {
    return {
        name: `Person ${over.id}`,
        kind: 'npc',
        spiritRoot: 'single',
        sex: 'female',
        realmOrdinal: 4,
        location: 'Somewhere',
        sectId: null,
        sectName: null,
        sectRank: null,
        age: 30,
        alive: true,
        existenceState: 'alive',
        soulState: 'whole',
        identityContinuity: 1,
        deathCause: null,
        spiritStones: 100,
        untreatedInjuries: 0,
        feuds: [],
        ...over
    } as RosterEntry;
}

function player(over: Partial<Cultivator> = {}): Cultivator {
    return {
        id: 'player',
        name: 'The Player',
        realmOrdinal: 4,
        hp: 40,
        maxHp: 40,
        spiritStones: 100,
        sectId: null,
        ...over
    } as Cultivator;
}

/** Everybody named is nameable; nobody else is. */
function gateOver(nameable: readonly string[]): KnowledgeGate {
    const known = new Set(nameable);
    return {
        isAwareOf: (_holder: string, _kind: string, id: string) => known.has(id)
    } as unknown as KnowledgeGate;
}

const NOBODY_KNOWN = gateOver([]);
const THE_ROOM = /other (people|person) here had no part in it/;

describe('a scene nothing happened in', () => {
    it('says nothing about anybody', () => {
        const square = [person({ id: 'a' }), person({ id: 'b' })];
        expect(whatThePeopleHereAreAnswering({
            before: square,
            now: square,
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['a', 'b'])
        })).toEqual([]);
    });
});

describe('three people watching one thing happen', () => {
    const square = [person({ id: 'a' }), person({ id: 'b' }), person({ id: 'c' })];
    const said = () => whatThePeopleHereAreAnswering({
        before: square,
        now: square,
        playerBefore: player({ sectId: null }),
        playerNow: player({ sectId: 'a-house' }),
        gate: gateOver(['a', 'b', 'c'])
    });

    it('are said once, with a count, rather than three times over', () => {
        const lines = said();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/3 other people here had no part in it/);
    });

    it('do not have their names spent on a sentence that does not need one', () => {
        for (const line of said()) {
            expect(line).not.toMatch(/Person [abc]/);
        }
    });

    it('are only worth a line at all because something happened to somebody', () => {
        expect(whatTheTurnDidToThePlayer(
            player({ sectId: null }), player({ sectId: 'a-house' })
        )).toBe(A_BINDING_MOVED);
    });
});

describe('the person the turn actually happened to', () => {
    const square = [person({ id: 'a', name: 'Yan Shuling' }), person({ id: 'b' })];

    it('gets a sentence of their own, and the watchers get one between them', () => {
        const lines = whatThePeopleHereAreAnswering({
            before: square,
            now: [person({ id: 'a', name: 'Yan Shuling', spiritStones: 4 }), person({ id: 'b' })],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['a', 'b'])
        });
        expect(lines[0]).toMatch(/^Yan Shuling, /);
        expect(lines[0]).toMatch(/What they had is gone/);
        expect(lines.some(line => /One other person here had no part in it/.test(line)))
            .toBe(true);
    });

    it('reads the same size of gift as the same size of loss', () => {
        const scene = (stones: number) => whatThePeopleHereAreAnswering({
            before: [person({ id: 'a', spiritStones: 100 })],
            now: [person({ id: 'a', spiritStones: stones })],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['a'])
        })[0];

        const robbed = scene(20);
        const given = scene(180);
        expect(robbed).not.toBe(given);
        // The same band, said the other way round, and neither is longer than
        // the other by a sentence.
        expect(robbed.split('.').length).toBe(given.split('.').length);
        expect(given).toMatch(/has come to them|is theirs|More has come to them/);
    });
});

describe('the discovery gate holds', () => {
    it('gives somebody the player cannot name a standing instead of a name', () => {
        const lines = whatThePeopleHereAreAnswering({
            before: [person({ id: 'a', name: 'Yan Shuling', spiritStones: 100 })],
            now: [person({ id: 'a', name: 'Yan Shuling', spiritStones: 4 })],
            playerBefore: player(),
            playerNow: player(),
            gate: NOBODY_KNOWN
        });
        expect(lines[0]).not.toMatch(/Yan Shuling/);
        expect(lines[0]).toMatch(/whose name this cultivator does not have/);
        // And they still answer it, which is the point of the sentence.
        expect(lines[0]).toMatch(/What they had is gone/);
    });

    it('lifts at most one stranger out, however many there are', () => {
        const before = ['a', 'b', 'c'].map(id => person({ id, spiritStones: 100 }));
        const now = ['a', 'b', 'c'].map(id => person({ id, spiritStones: 4 }));
        const lines = whatThePeopleHereAreAnswering({
            before, now,
            playerBefore: player(),
            playerNow: player(),
            gate: NOBODY_KNOWN
        });
        const strangers = lines.filter(line =>
            /whose name this cultivator does not have/.test(line)).length;
        expect(strangers).toBe(1);
        expect(lines.some(line => /2 others here were in it too/.test(line))).toBe(true);
    });
});

describe('somebody who is no longer standing here', () => {
    /**
     * This used to assert the opposite - that the dead were priced into the
     * room and given no sentence of their own. The design owner overruled it:
     * *the dude should die with a message (unless you're so strong you just one
     * shot them)*. The pricing was never the wrong half; the silence was.
     */
    it('is priced into what the room saw, and gets the sentence as well', () => {
        const dead = person({ id: 'dead', name: 'The Killed' });
        const lines = whatThePeopleHereAreAnswering({
            before: [dead, person({ id: 'a' }), person({ id: 'b' })],
            now: [person({ id: 'a' }), person({ id: 'b' })],
            fallen: [dead],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['dead', 'a', 'b'])
        });
        expect(lines.join(' ')).toMatch(/The Killed/);
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.join(' ')).toMatch(/2 other people here had no part in it/);
    });

    it('and somebody who merely walked off is not a scene at all', () => {
        expect(whatThePeopleHereAreAnswering({
            before: [person({ id: 'gone' }), person({ id: 'a' })],
            now: [person({ id: 'a' })],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['gone', 'a'])
        })).toEqual([]);
    });
});

describe('a watcher who is one of theirs', () => {
    it('is counted, because whose people they are is the one thing that separates them', () => {
        const lines = whatThePeopleHereAreAnswering({
            before: [
                person({ id: 'a', sectId: 'house', spiritStones: 100 }),
                person({ id: 'b', sectId: 'house' }),
                person({ id: 'c', sectId: null })
            ],
            now: [
                person({ id: 'a', sectId: 'house', spiritStones: 4 }),
                person({ id: 'b', sectId: 'house' }),
                person({ id: 'c', sectId: null })
            ],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['a', 'b', 'c'])
        });
        const room = lines.find(line => THE_ROOM.test(line))!;
        expect(room).toMatch(/One of them is of the same house as the person it happened to/);
    });

    it('is not counted where the person it happened to answers to nobody', () => {
        const lines = whatThePeopleHereAreAnswering({
            before: [
                person({ id: 'a', sectId: null, spiritStones: 100 }),
                person({ id: 'b', sectId: 'house' })
            ],
            now: [
                person({ id: 'a', sectId: null, spiritStones: 4 }),
                person({ id: 'b', sectId: 'house' })
            ],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['a', 'b'])
        });
        const room = lines.find(line => THE_ROOM.test(line))!;
        expect(room).not.toMatch(/same house/);
    });
});

describe('the cap on how many people get a sentence', () => {
    it('never writes a paragraph about a crowd', () => {
        const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
        const lines = whatThePeopleHereAreAnswering({
            before: ids.map(id => person({ id, spiritStones: 100 })),
            now: ids.map(id => person({ id, spiritStones: 4 })),
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(ids)
        });
        const named = lines.filter(line => /^Person p/.test(line)).length;
        expect(named).toBe(PEOPLE_WORTH_A_SENTENCE);
        expect(lines.some(line => /9 others here were in it too/.test(line))).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE TWO READINGS THE TURN TAKES FOR ITSELF
// ─────────────────────────────────────────────────────────────────────────

describe('what a fight did to the person on the other side of it', () => {
    it('reads a round as a fraction of the pool it came out of', () => {
        const read = whatTheFightDidToThem(
            { personId: 'them', hp: 40, maxHp: 40 },
            { personId: 'them', hp: 30, maxHp: 40 }
        );
        expect(read).toEqual({
            personId: 'them', moved: -0.25, bodyLeft: 0.75, dealtWith: true
        });
    });

    it('prices the opening round against the whole body', () => {
        const read = whatTheFightDidToThem(null, { personId: 'them', hp: 36, maxHp: 40 });
        expect(read?.moved).toBeCloseTo(-0.1, 5);
        expect(read?.dealtWith).toBe(true);
    });

    it('says only that they dealt with each other once the fight has settled', () => {
        expect(whatTheFightDidToThem({ personId: 'them', hp: 3, maxHp: 40 }, null))
            .toEqual({ personId: 'them', dealtWith: true });
    });

    it('is nothing at all when there was no fight', () => {
        expect(whatTheFightDidToThem(null, null)).toBeNull();
    });
});

describe('who the plan pointed at', () => {
    const square = [
        person({ id: 'a', name: 'Han Peiru' }),
        person({ id: 'b', name: 'Kong Liekuan' })
    ];

    it('finds the person a target names', () => {
        expect(whoThePlanPointedAt(['Kong Liekuan'], square)).toEqual(['b']);
    });

    it('finds them inside whatever the sentence wrapped them in', () => {
        expect(whoThePlanPointedAt(
            ['Han Peiru with 60 spirit stones to introduce me'], square
        )).toEqual(['a']);
    });

    it('finds nobody when the target is not standing here', () => {
        expect(whoThePlanPointedAt(['somebody else entirely'], square)).toEqual([]);
        expect(whoThePlanPointedAt([null, undefined, '', 'x'], square)).toEqual([]);
    });

    it('reads every step of a plan, not only the verb the turn was about', () => {
        expect(whoThePlanPointedAt(['Han Peiru', 'Kong Liekuan'], square).sort())
            .toEqual(['a', 'b']);
    });

    it('lets the fight win over the bare fact of having been addressed', () => {
        const merged = theBearingsThisTurnCanRead(
            { personId: 'b', hp: 40, maxHp: 40 },
            { personId: 'b', hp: 20, maxHp: 40 },
            ['a', 'b']
        );
        expect(merged).toHaveLength(2);
        expect(merged.find(row => row.personId === 'b')?.moved).toBe(-0.5);
        expect(merged.find(row => row.personId === 'a')).toEqual({
            personId: 'a', dealtWith: true
        });
    });
});

describe('the person it happened to hardest', () => {
    /**
     * The design owner: *the dude should die with a message (unless you're so
     * strong you just one shot them). some sorta dying breath or before that* -
     * and *that falls out of npc's talking*.
     *
     * It did not. The dead were priced INTO the scene, raising what the moment
     * asked of everybody who merely watched, and were never given a line of
     * their own - so a killing was the one thing that could happen in this game
     * where the person it happened to had nothing to say about it.
     */
    it('gives the dying a last line, and the one-shot none', () => {
        const dead = person({ id: 'dead', realmOrdinal: 4 });
        const scene = (killersOrdinal: number) => whatThePeopleHereAreAnswering({
            before: [dead],
            now: [],
            fallen: [dead],
            playerBefore: player({ realmOrdinal: killersOrdinal }),
            playerNow: player({ realmOrdinal: killersOrdinal }),
            gate: gateOver(['dead'])
        }).join(' ');

        // Level with them: it was a fight, and a fight has rounds in it.
        expect(scene(4)).toContain('They are dying');
        expect(scene(4)).toContain('the last thing they are going to say');

        // And two major realms up it is not a fight at all. `HELPLESS_REALM_GAP`
        // is the combat module's own line, and this reads it rather than
        // choosing a second number.
        const oneShot = scene(30);
        expect(oneShot).toContain('It took one action');
        expect(oneShot).not.toContain('They are dying');
    });

    /** Whoever it happened to hardest goes first, and the dead outweigh anybody. */
    it('puts the dead ahead of the people who watched it', () => {
        const dead = person({ id: 'dead', name: 'The Dead' });
        const watcher = person({ id: 'watcher', name: 'The Watcher' });
        const [first] = whatThePeopleHereAreAnswering({
            before: [dead, watcher],
            now: [watcher],
            fallen: [dead],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['dead', 'watcher'])
        });
        expect(first).toContain('The Dead');
    });
});
