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
/**
 * The watchers' one sentence. Matched on the count and not on the clause: it
 * used to read "N other people here had no part in it", which the reading
 * beside it then said again in its own words.
 */
const THE_ROOM = /other (?:people are|person is) here/;

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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * A STRETCH OF YEARS IS NOT AN INCIDENT ANYBODY WATCHED
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FOUND BY PLAYING, seed `dm2-2`. A ten-year seclusion, cut short at 2.1 years
 * for want of food, in a village square. On the same screen as the years-long
 * digest:
 *
 *     Year 1000: Duan Wanlu, Qi Condensation Layer 11, reached the end of
 *     their lifespan and died of old age.
 *     ...
 *     6 other people are here. No part of this was theirs. They saw all of it,
 *     from close by. Every one of them answers, out loud.
 *
 * Six people watched somebody meditate for two years, from close by, and every
 * one of them spoke up about it.
 *
 * Everything in this module is priced against `sceneWeight` - "the largest
 * thing this turn did to anybody in it" - and on a digest turn that is the
 * player's own two years of cultivation, which prices out as an enormous
 * incident with an audience. But a stretch of years has no MOMENT in it. There
 * is nothing for anybody to have seen and nothing for them to answer.
 *
 * ONE CAUSE, AND IT REACHED FURTHER THAN THIS. `theFallenAmong` in
 * `turn-engine.ts` read "was here, is not here, is dead" and stopped, which is
 * a correct description of a roster and a wrong description of a scene: an NPC
 * who died somewhere inside those years was put on the ground at the player's
 * feet, dying now, in a square the player had their eyes shut in. The same
 * arithmetic did it, and the same distinction fixes both.
 *
 * PRESENCE SURVIVES, WITNESSING DOES NOT. Six people being there when you open
 * your eyes is true and perceivable. That they watched and reacted is neither.
 * The presence line has to be produced ABOVE the `read.length === 0` guard,
 * because a digest always trips it - at zero weight `readingFor` returns null
 * for everybody, and this module correctly has no reactions to report.
 */
describe('a turn that was a digest rather than a scene', () => {
    const square = [person({ id: 'a' }), person({ id: 'b' }), person({ id: 'c' })];
    // A seclusion: the player is years older and a rung further on. On a scene
    // turn that is a large thing to have happened in front of people.
    const digest = (over: Partial<Parameters<typeof whatThePeopleHereAreAnswering>[0]> = {}) =>
        whatThePeopleHereAreAnswering({
            before: square,
            now: square,
            playerBefore: player({ realmOrdinal: 4, age: 16 } as never),
            playerNow: player({ realmOrdinal: 7, age: 18 } as never),
            gate: gateOver(['a', 'b', 'c']),
            wasAScene: false,
            ...over
        });

    it('says who is standing there and stops', () => {
        const lines = digest();
        expect(lines).toEqual(['3 other people are here.']);
    });

    it('does not claim anybody watched it', () => {
        const said = digest().join(' ');
        expect(said).not.toMatch(/saw it|saw all of it|from close by|near enough/);
        expect(said).not.toMatch(/No part of this was theirs/);
    });

    it('does not have anybody speak up about it', () => {
        const said = digest().join(' ');
        expect(said).not.toMatch(/answers?, out loud|says? nothing|say something/);
    });

    /**
     * THE DEAD MAN STANDING THERE DYING. Somebody who died inside the years is
     * not somebody who fell in front of you, and the turn must not narrate them
     * doing it. `theFallenAmong` now returns nothing on a digest, so this is
     * belt and braces on the module that would print it.
     */
    it('puts nobody on the ground at the player feet', () => {
        const said = digest({ fallen: [person({ id: 'd', name: 'Duan Wanlu' })] }).join(' ');
        expect(said).not.toContain('Duan Wanlu');
        expect(said).not.toMatch(/dying|on the ground|falls/i);
    });

    it('says nothing at all when the square is empty', () => {
        expect(digest({ now: [] })).toEqual([]);
    });

    /**
     * AND A SCENE IS UNCHANGED. The flag defaults to a scene, so every existing
     * caller and every test above and below this one is unaffected - which is
     * the whole reason it is a flag rather than a rewrite of the pricing.
     */
    it('leaves an actual scene reading everything it read before', () => {
        const asAScene = digest({ wasAScene: true });
        expect(asAScene.join(' ')).toMatch(/No part of this was theirs/);
        expect(asAScene.length).toBeGreaterThan(0);
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
        expect(lines[0]).toMatch(/3 other people are here/);
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
        // THE HEAVIEST LOSS BAND, in whatever words. This pinned the clause
        // "What they had is gone", which was one of twelve written-out
        // sentences the reading used to return; the rule is that a total loss
        // reads as one.
        expect(lines[0]).toMatch(/lost all of it/i);
        expect(lines.some(line => /One other person is here/.test(line)))
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
        // A GAIN READS AS A GAIN. Same rule, other direction.
        expect(given).toMatch(/gained/i);
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
        // The rule, not the sentence: a stranger is given a standing and no
        // name. `this cultivator` used to be the engine's word for the reader
        // here, in a channel that says `you` everywhere else.
        expect(lines[0]).toMatch(/whose name you do not have/);
        // And they still answer it, which is the point of the sentence.
        expect(lines[0]).toMatch(/lost all of it/i);
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
            /whose name you do not have/.test(line)).length;
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
        expect(lines.join(' ')).toMatch(/2 other people are here/);
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
        // THE CAP IS ON PEOPLE, NOT ON LINES. It used to be asserted by
        // counting lines that open with a name, which was the same number
        // until readings that say the same thing about different people
        // started being said once - twelve identical strangers now share one
        // sentence rather than getting three.
        const named = new Set(
            [...lines.join(' ').matchAll(/Person p\d+/g)].map(hit => hit[0])
        );
        expect(named.size).toBeLessThanOrEqual(PEOPLE_WORTH_A_SENTENCE);
        expect(named.size).toBeGreaterThan(0);
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

describe('what they feel about the person in front of them', () => {
    /**
     * The design owner: *emotion needs to be tracked ... for every npc you do
     * stuff to, of course. and emotions can change - like if i rob her, she's
     * sad. if i kill her father she's despondent (and acts that way).*
     *
     * ACTS THAT WAY is why it is rendered here rather than kept on a sheet:
     * this is the channel that puts a person in front of the narrator, and
     * somebody who was robbed by whoever is standing in front of them is not
     * the same person as one who was not.
     */
    it('carries the feeling into the sentence about them', () => {
        const her = person({ id: 'her', name: 'Ning Ronghe' });
        const lines = whatThePeopleHereAreAnswering({
            before: [her],
            now: [her],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['her']),
            declared: [{ personId: 'her', dealtWith: true }],
            feels: id => (id === 'her'
                ? 'They are carrying what this one took out of them.'
                : null)
        }).join(' ');

        expect(lines).toContain('carrying what this one took out of them');
    });

    /** And says nothing where nothing has passed, which is nearly everybody. */
    it('says nothing about somebody nothing has passed with', () => {
        const them = person({ id: 'them', name: 'A Stranger' });
        const lines = whatThePeopleHereAreAnswering({
            before: [them],
            now: [them],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['them']),
            declared: [{ personId: 'them', dealtWith: true }],
            feels: () => null
        }).join(' ');

        expect(lines).toContain('A Stranger');
        expect(lines).not.toContain('carrying what');
    });
});

describe('a reading that has not changed is not read out again', () => {
    /**
     * PLAYED, THROUGH A BOUT OF FOUR EXCHANGES:
     *
     *     Kong Zhaoshan, a little beneath you. They lost a little of what they
     *     had. They answer, out loud. Nothing they hold reaches. They ask.
     *
     * Word for word, five turns running. The last three sentences never once
     * changed, because what somebody reaches for does not change while the
     * fight they are in does not - and this channel runs on every turn, and the
     * deterministic renderer prints it verbatim. A sentence read five times has
     * stopped being a reading of anybody.
     *
     * The caller owns the memory. This module holds no state between turns.
     */
    function turnFor(
        remembered: Map<string, ReadonlySet<string>>,
        them: RosterEntry,
        dealtWith = true
    ): string[] {
        const thisTurn = new Map<string, Set<string>>();
        const lines = whatThePeopleHereAreAnswering({
            before: [them],
            now: [them],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver([them.id]),
            declared: [{ personId: them.id, dealtWith }],
            saidLastTurn: id => remembered.get(id) ?? new Set<string>(),
            noteWhatWasSaid: (id, parts) => thisTurn.set(id, new Set(parts))
        });
        remembered.clear();
        for (const [id, parts] of thisTurn) remembered.set(id, parts);
        return lines;
    }

    it('says it the first time and not the second', () => {
        const them = person({ id: 'them', name: 'Kong Zhaoshan' });
        const remembered = new Map<string, ReadonlySet<string>>();

        expect(turnFor(remembered, them).join(' ')).toContain('Kong Zhaoshan');
        expect(turnFor(remembered, them)).toEqual([]);
    });

    it('says the part that changed, and only that part', () => {
        const before = person({ id: 'them', name: 'Kong Zhaoshan', spiritStones: 100 });
        const remembered = new Map<string, ReadonlySet<string>>();

        const first = turnFor(remembered, before).join(' ');
        expect(first).toContain('Kong Zhaoshan');

        // The same person, now down most of what they were carrying. What that
        // costs them is newly true; what they reach for is not.
        const poorer = person({ id: 'them', name: 'Kong Zhaoshan', spiritStones: 5 });
        const thisTurn = new Map<string, Set<string>>();
        const second = whatThePeopleHereAreAnswering({
            before: [before],
            now: [poorer],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['them']),
            declared: [{ personId: 'them', dealtWith: true }],
            saidLastTurn: id => remembered.get(id) ?? new Set<string>(),
            noteWhatWasSaid: (id, parts) => thisTurn.set(id, new Set(parts))
        }).join(' ');

        expect(second).toContain('Kong Zhaoshan');
        // Everything it says is something the first reading did not say.
        for (const sentence of second.split('. ').slice(1)) {
            expect(first, sentence).not.toContain(sentence);
        }
    });

    it('remembers what was true, not what was printed', () => {
        const them = person({ id: 'them', name: 'Kong Zhaoshan' });
        const remembered = new Map<string, ReadonlySet<string>>();

        turnFor(remembered, them);
        // Suppressed, and the memory must survive it: a person who read the
        // same way still reads that way, so the turn after stays silent too.
        expect(turnFor(remembered, them)).toEqual([]);
        expect(turnFor(remembered, them)).toEqual([]);
    });

    it('says everything when the caller keeps no memory at all', () => {
        const them = person({ id: 'them', name: 'Kong Zhaoshan' });
        const said = () => whatThePeopleHereAreAnswering({
            before: [them],
            now: [them],
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['them']),
            declared: [{ personId: 'them', dealtWith: true }]
        }).join(' ');

        expect(said()).toContain('Kong Zhaoshan');
        expect(said()).toBe(said());
    });
});
