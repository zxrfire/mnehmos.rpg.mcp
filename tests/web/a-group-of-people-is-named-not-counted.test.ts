/**
 * A COUNT IS STATE, NOT NARRATION.
 *
 * Shown this line, which the ENGINE composed and which reaches the player
 * verbatim with no model configured:
 *
 *     4 other people are here. They saw all of it, from close by. 2 of them
 *     answer, out loud.
 *
 * the design owner: *"reminder that this is not xianxia prose"*. Two defects in
 * one sentence, and the second is the expensive one.
 *
 * THE HEADCOUNT. Measured over the reference corpus, a group of people is
 * referred to by what it is and never by how many are in it: `everyone` 6744
 * times, `the others` 2461, `the surrounding` 1927, `the people` 1283, `the
 * group` 1093, `the crowd` 960, `a group` 543, `all around` 313, `the
 * onlookers` 266. Not one of the top constructions is a tally. And over 7,789
 * corpus paragraphs naming a group, the WORKHORSE is a named person with the
 * rest folded in - "the Joy Lord and the others", "The Sect Leader, Jin
 * Yunshan, and all the others" - which is exactly the shape this engine already
 * holds, `company.named` plus a nameless remainder.
 *
 * THE INSPECTOR'S VOICE. "from close by", "out loud", "where the others can see
 * it" report a vantage and a modality. The corpus has a group ACT: "The others
 * were appalled as they looked onto the chase below", "A cold voice echoed out
 * from the crowd". A string that says a group EXISTS rather than what it is
 * DOING is still the inspector with nicer words.
 *
 * AND IT REACHED THE PLAYER TWICE OVER. `facts.prose` is what a run with no
 * narrator prints, which AGENTS.md calls a shipping mode outright. `facts.lines`
 * is what the model reads - so the prompt forbade the model from writing
 * headcounts, *Never "three others are here besides"*, while the engine handed
 * it one to work from.
 *
 * WHERE THE NUMBER GOES. `facts.structure` is the machine-readable channel and
 * it keeps the exact figure. A number is not wrong in itself: the corpus counts
 * freely when the figure is a record somebody would cite. It is wrong for the
 * people standing around.
 *
 * RED FIRST, against the tree before the change: 12 of the 13 failed. The one
 * that passed was *keeps the census in the structure channel* - the split this
 * test is about was already half built, and only the player-facing half was
 * wrong.
 */

import { describe, expect, it } from 'vitest';

import type { Cultivator } from '../../src/schema/cultivation';
import type { RosterEntry } from '../../src/storage/repos/cultivator.repo';
import type { KnowledgeGate } from '../../src/web/knowledge';
import {
    whatThePeopleHereAreAnswering,
    A_THING_ENDED_IN_FRONT_OF_THEM,
    type SceneAsPeopleFoundIt
} from '../../src/web/scene-person-readings';
import {
    whatThisAsksOfThem,
    whetherTheySayIt,
    TOUCHED,
    WITNESS_SHARE,
    WORTH_A_SENTENCE
} from '../../src/engine/social-leverage/moved-to-speak';
import { factsForCompany, factsForLook, type Company } from '../../src/web/facts';
import { whoWasNeverReached } from '../../src/web/acts-over-a-set';
import { whatCameOfTryingIt } from '../../src/web/an-act-that-is-coherent-and-stupid';

/**
 * A digit standing next to a word for people.
 *
 * Deliberately not `/\d/`: a price, a span in days, a rung and a purse are all
 * numbers a player acts on and none of them are in scope. What is banned is
 * tallying the bodies in the room.
 */
const A_HEADCOUNT =
    /\b\d+\s+(?:other|others|more|people|person|of them|of these|of the|disciples?|cultivators?|elders?)\b/i;

/** Reporting a vantage or a modality instead of saying what happened. */
const THE_INSPECTOR = /from close by|out loud|where the others can see|is visible\b/i;

function person(over: Partial<RosterEntry> & { id: string }): RosterEntry {
    return {
        name: `Person ${over.id}`,
        kind: 'npc',
        spiritRoot: 'single_water',
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
        spiritRoot: 'single_water',
        foundationQuality: 'none',
        attributes: { might: 2, insight: 2, fortune: 2, charm: 2 },
        injuries: [],
        bleedingTurns: 0,
        starvationTurns: 0,
        satiety: 100,
        yearsAtCurrentRealm: 0,
        cultivationProgress: 0,
        age: 20,
        alive: true,
        location: 'Green Water City',
        ...over
    } as Cultivator;
}

function gateOver(nameable: readonly string[]): KnowledgeGate {
    const known = new Set(nameable);
    return {
        isAwareOf: (_holder: string, _kind: string, id: string) => known.has(id)
    } as unknown as KnowledgeGate;
}

const A_CROWD = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => person({ id }));

/** A robbery in front of a square: one person it happened to, five watching. */
function aSceneWithACrowd(over: Partial<SceneAsPeopleFoundIt> = {}): string[] {
    const before = A_CROWD;
    const now = [person({ id: 'a', spiritStones: 5 }), ...A_CROWD.slice(1)];
    return whatThePeopleHereAreAnswering({
        before,
        now,
        playerBefore: player(),
        playerNow: player({ spiritStones: 195 }),
        gate: gateOver(['a', 'b', 'c', 'd', 'e', 'f']),
        declared: [{ personId: 'a', moved: -0.95, dealtWith: true }],
        ...over
    });
}

describe('the people standing around are never tallied', () => {
    it('says who is here without counting them, on a turn nobody watched', () => {
        // A seclusion in a village square. Presence survives a digest and
        // witnessing does not, so this is the one sentence the channel emits -
        // and it used to open "6 other people are here."
        const said = whatThePeopleHereAreAnswering({
            before: A_CROWD,
            now: A_CROWD,
            playerBefore: player({ realmOrdinal: 4, age: 16 } as never),
            playerNow: player({ realmOrdinal: 7, age: 18 } as never),
            gate: gateOver(['a', 'b', 'c', 'd', 'e', 'f']),
            wasAScene: false
        });
        expect(said).toHaveLength(1);
        expect(said[0]).not.toMatch(A_HEADCOUNT);
    });

    it('names one of them and folds the rest in, which is what the genre does', () => {
        const said = whatThePeopleHereAreAnswering({
            before: A_CROWD,
            now: A_CROWD,
            playerBefore: player({ realmOrdinal: 4, age: 16 } as never),
            playerNow: player({ realmOrdinal: 7, age: 18 } as never),
            // Only one face the player can place. The rest are still here.
            gate: gateOver(['b']),
            wasAScene: false
        });
        expect(said[0]).toContain('Person b');
        expect(said[0]).toContain('the others');
    });

    it('keeps the watchers out of arithmetic in a scene', () => {
        for (const line of aSceneWithACrowd()) {
            expect(line).not.toMatch(A_HEADCOUNT);
        }
    });

    it('does not report the room in an inspector\'s voice', () => {
        for (const line of aSceneWithACrowd()) {
            expect(line).not.toMatch(THE_INSPECTOR);
        }
    });

    it('still hands the exact figure to the machine-readable channel', () => {
        // The owner: *"the engine should still tell you exactly how many in the
        // engine ruling data ... but that's for the state itself ... not as part
        // of narration."*
        const counted: string[] = [];
        aSceneWithACrowd({ noteHowManyWereHere: said => counted.push(said) });
        expect(counted.join(' ')).toMatch(/\b5\b/);
    });

    it('says the ones an act pushed past the cap as a group, not as a figure', () => {
        // One act over a set leaves everybody in the same state. Three of them
        // get a sentence; the rest used to be "3 others here were in it too".
        const before = A_CROWD;
        const now = A_CROWD.map(row => ({ ...row, spiritStones: 5 }));
        const said = whatThePeopleHereAreAnswering({
            before,
            now,
            playerBefore: player(),
            playerNow: player({ spiritStones: 600 }),
            gate: gateOver(['a', 'b', 'c', 'd', 'e', 'f']),
            declared: A_CROWD.map(row => ({ personId: row.id, moved: -0.95, dealtWith: true }))
        });
        for (const line of said) expect(line).not.toMatch(A_HEADCOUNT);
        expect(said.join(' ')).toMatch(/(?:the others|the crowd) (?:were|was) in it too/i);
    });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * A TURN CAN BE AN EVENT RATHER THAN A TRANSFER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * MEASURED. A treasure smashed in a crowded square named five witnesses on the
 * world fact and produced no line from any of them. `sceneWeight` was the
 * largest distance any BODY moved - a purse, HP, a binding, a rung, or somebody
 * who stopped standing anywhere - and a destruction moves none of those, so it
 * priced at nought and every bystander correctly read as having nothing to
 * react to. The design owner: *"smashing your pill in the middle of an audience
 * should invite some reaction"*, and then *"that should fall out"*.
 *
 * Same defect as the headcount above, one layer down: the scene layer was
 * describing bodies instead of events.
 */
describe('something that happens without moving anybody', () => {
    const square = ['a', 'b', 'c', 'd'].map(id => person({ id }));
    const smashing = (deed: number | undefined) => whatThePeopleHereAreAnswering({
        before: square,
        now: square,
        playerBefore: player(),
        playerNow: player(),
        gate: gateOver(['a', 'b', 'c', 'd']),
        theDeedItself: deed
    });

    it('is watched, where nothing moving at all is not', () => {
        expect(smashing(undefined)).toEqual([]);
        const said = smashing(A_THING_ENDED_IN_FRONT_OF_THEM);
        expect(said.length).toBeGreaterThan(0);
        expect(said.join(' ')).toMatch(/watched/);
    });

    it('reads as watched and not as something that happened to them', () => {
        // The derivation of the constant, so a later reader can see what it was
        // set against rather than assuming it was picked: a bystander carries
        // WITNESS_SHARE of the scene, and that share has to clear the bar for a
        // sentence at all and stay under the band that means they lost
        // something.
        const carried = A_THING_ENDED_IN_FRONT_OF_THEM * WITNESS_SHARE;
        expect(carried).toBeGreaterThanOrEqual(WORTH_A_SENTENCE);
        expect(carried).toBeLessThan(TOUCHED);
    });

    it('is still nothing on a stretch of years, which nobody watched', () => {
        expect(whatThePeopleHereAreAnswering({
            before: square,
            now: square,
            playerBefore: player(),
            playerNow: player(),
            gate: gateOver(['a', 'b', 'c', 'd']),
            theDeedItself: A_THING_ENDED_IN_FRONT_OF_THEM,
            wasAScene: false
        }).join(' ')).not.toMatch(/watched/);
    });
});

describe('a person in a scene is described by what happened, not by a vantage', () => {
    it('does not tell the narrator where somebody was standing to see it', () => {
        // "No part of this was theirs. They saw all of it, from close by."
        for (const sceneWeight of [0.3, 0.6, 0.9, 1]) {
            const reading = whatThisAsksOfThem({
                moved: 0,
                bodyLeft: 1,
                rungsOverTheOther: 0,
                backed: false,
                sceneWeight,
                dealtWith: false,
                reticence: 0
            }).reading;
            expect(reading).not.toBeNull();
            expect(reading!).not.toMatch(THE_INSPECTOR);
        }
    });

    it('says whether somebody spoke without narrating the modality', () => {
        expect(whetherTheySayIt(true)).not.toMatch(THE_INSPECTOR);
        expect(whetherTheySayIt(false)).not.toMatch(THE_INSPECTOR);
    });
});

describe('a square a player looks at', () => {
    const strangers = (howMany: number) =>
        Array.from({ length: howMany }, () => ({ ordinal: 4 }));

    const company = (howMany: number): Company => ({
        named: [],
        strangers: strangers(howMany),
        total: howMany
    });

    it('does not print a tally of the people in it', () => {
        for (const howMany of [2, 3, 7, 30]) {
            const facts = factsForLook(player(), 'normal', company(howMany));
            expect(facts.prose).not.toMatch(A_HEADCOUNT);
            for (const line of facts.lines) expect(line).not.toMatch(A_HEADCOUNT);
        }
    });

    it('keeps the census in the structure channel, where a count belongs', () => {
        const facts = factsForLook(player(), 'normal', company(30));
        expect(facts.structure.join(' ')).toMatch(/\b30\b/);
    });

    it('answers who is about without a headline that counts them', () => {
        const facts = factsForCompany(player(), company(30));
        expect(facts.headline).not.toMatch(A_HEADCOUNT);
        expect(facts.prose).not.toMatch(A_HEADCOUNT);
        expect(facts.structure.join(' ')).toMatch(/\b30\b/);
    });
});

describe('the same rule wherever the engine reaches for a crowd', () => {
    it('says who an act never got to by name, with the rest folded in', () => {
        expect(whoWasNeverReached(['A', 'B', 'C', 'D', 'E'])).not.toMatch(A_HEADCOUNT);
        expect(whoWasNeverReached(['A', 'B', 'C', 'D', 'E'])).toContain('A');
        expect(whoWasNeverReached(['A', 'B', 'C', 'D', 'E'])).toContain('the others');
    });

    it('says who watched a foolish act without counting the rest of them', () => {
        const said = whatCameOfTryingIt('steal', ['A', 'B', 'C', 'D', 'E']);
        expect(said).not.toMatch(A_HEADCOUNT);
        expect(said).toContain('the others');
    });
});
