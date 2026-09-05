/**
 * The other door.
 *
 * A live five-year seclusion produced: "1 line reached this cultivator; 35
 * events reached them by no channel at all." Those thirty-five are the input
 * to this module, and the guard is that turning some of them into arrivals
 * never turns any of them into a name the player has not earned.
 */

import { describe, expect, it } from 'vitest';
import {
    ARRIVAL_MIN_MAGNITUDE,
    arrivableFromUnheard,
    rollEncounters,
    type EncounterPlace
} from '../../../src/engine/encounters/index.js';

const cave: EncounterPlace = { id: 'c', name: 'a cave', kind: 'cave', danger: 0.3 };

interface Fact {
    id: string;
    day: number;
    magnitude: number;
    kind: string;
    summary: string;
    consequence: string;
}

const facts: Fact[] = [
    { id: 'f1', day: 100, magnitude: 0.8, kind: 'war', summary: 'The Lantern Hall took the Jade Face vein from Ninefold.', consequence: 'The road past the ford has been shut for a season and nobody will say by whom.' },
    { id: 'f2', day: 300, magnitude: 0.4, kind: 'death', summary: 'Elder Shen of the Lantern Hall died.', consequence: 'A body was found on the low road and nobody is saying whose it was.' },
    { id: 'f3', day: 500, magnitude: 0.1, kind: 'trade', summary: 'A price moved.', consequence: 'Salt is a little dearer.' },
    { id: 'f4', day: 700, magnitude: 0.65, kind: 'collapse', summary: 'Ninefold Silent Cliffs folded its outer gate.', consequence: 'A village that used to pay a tithe has stopped, and the tithe collector has not come back.' }
];

function candidates(reported: string[] = []) {
    return arrivableFromUnheard({
        facts,
        reportedFactIds: reported,
        consequenceText: f => f.consequence
    });
}

describe('what may arrive', () => {
    it('takes only what no channel carried', () => {
        const all = candidates();
        expect(all.map(f => f.factId)).toEqual(['f1', 'f2', 'f4']);

        const someHeard = candidates(['f1']);
        expect(someHeard.map(f => f.factId)).toEqual(['f2', 'f4']);
    });

    it('drops anything too small to turn up on somebody', () => {
        // f3 is below the floor. Salt being dearer is not an event that
        // happens TO anybody.
        expect(candidates().some(f => f.factId === 'f3')).toBe(false);
        expect(ARRIVAL_MIN_MAGNITUDE).toBeGreaterThan(0);
        expect(ARRIVAL_MIN_MAGNITUDE).toBeLessThan(0.6);
    });

    it('carries the consequence and never the account', () => {
        for (const candidate of candidates()) {
            const fact = facts.find(f => f.id === candidate.factId)!;
            expect(candidate.text).toBe(fact.consequence);
            expect(candidate.text).not.toBe(fact.summary);
            // The name-free property, which is what makes an arrival legal for
            // a player who can name nobody involved.
            expect(candidate.text).not.toContain('Lantern Hall');
            expect(candidate.text).not.toContain('Ninefold');
        }
    });

    it('is chronological and stable', () => {
        expect(candidates()).toEqual(candidates());
        const days = candidates().map(f => f.day);
        expect(days).toEqual([...days].sort((a, b) => a - b));
    });
});

describe('arriving', () => {
    function secludeWith(seed: string, arrivable: ReturnType<typeof candidates>) {
        return rollEncounters({
            seed,
            startDay: 0,
            days: 20 * 360,
            activity: 'seclusion',
            cultivator: { id: 'c1', realmOrdinal: 12, fortune: 1, maxHp: 60, hp: 60, spiritStones: 40 },
            place: cave,
            limit: 32,
            arrivable
        });
    }

    it('brings the world to a cave, and names nothing when it does', () => {
        const arrivals = [];
        for (let s = 0; s < 200; s++) {
            arrivals.push(...secludeWith(`arr-${s}`, candidates()).occurrences.filter(o => o.source === 'digest'));
        }
        expect(arrivals.length).toBeGreaterThan(0);

        for (const arrival of arrivals) {
            expect(arrival.grants).toHaveLength(0);
            expect(arrival.castIds).toHaveLength(0);
            expect(arrival.event.summary).not.toContain('Lantern Hall');
            expect(arrival.event.summary).not.toContain('Ninefold');
            expect(arrival.event.data.arrival).toBe(true);
            expect(arrival.deltas).toEqual({ hp: 0, spiritStones: 0, satiety: 0, rations: 0 });
        }
    });

    it('stops the sit for a big thing and reports a middling one', () => {
        const arrivals = [];
        for (let s = 0; s < 300; s++) {
            arrivals.push(...secludeWith(`cut-${s}`, candidates()).occurrences.filter(o => o.source === 'digest'));
        }
        const big = arrivals.filter(a => a.event.data.factId === 'f1');
        const middling = arrivals.filter(a => a.event.data.factId === 'f2');
        expect(big.length).toBeGreaterThan(0);
        expect(middling.length).toBeGreaterThan(0);
        for (const a of big) expect(a.interrupts).toBe(true);
        for (const a of middling) expect(a.interrupts).toBe(false);
    });

    it('brings each thing at most once', () => {
        for (let s = 0; s < 60; s++) {
            const seen = secludeWith(`once-${s}`, candidates()).occurrences
                .filter(o => o.source === 'digest')
                .map(o => o.id);
            expect(new Set(seen).size).toBe(seen.length);
        }
    });

    it('scales with how much the world actually did', () => {
        // The whole reason arrival is rolled per fact rather than per day: a
        // quiet span reaches nobody, a loud one reaches somebody.
        const quiet = candidates().slice(0, 1);
        const loud = Array.from({ length: 140 }, (_, i) => ({
            factId: `g${i}`, day: i * 50,
            text: 'Something happened and nobody is saying whose doing it was.',
            magnitude: 0.4
        }));

        let quietCount = 0;
        let loudCount = 0;
        for (let s = 0; s < 60; s++) {
            quietCount += secludeWith(`q-${s}`, quiet).occurrences.filter(o => o.source === 'digest').length;
            loudCount += secludeWith(`l-${s}`, loud).occurrences.filter(o => o.source === 'digest').length;
        }
        expect(loudCount).toBeGreaterThan(quietCount * 3);
    });

    /**
     * A door is not a ward, and it is still a door.
     *
     * The old assertion was zero over twenty years on every seed. What that
     * bought at the table was a strategy with no cost: seal, skip decades,
     * and nothing in the game can reach you. So the contract is now about
     * SCALE rather than absolutes - the length you sit decides whether the
     * door was enough.
     */
    const sealFor = (seed: string, years: number) => rollEncounters({
        seed,
        startDay: 0,
        days: years * 360,
        activity: 'sealed',
        cultivator: { id: 'c1', realmOrdinal: 12, fortune: 1, maxHp: 60, hp: 60, spiritStones: 40 },
        place: cave,
        arrivable: candidates()
    });

    it('keeps a short seclusion quiet behind a sealed door', () => {
        // A season, and then a year. Shutting the door to finish one thing is
        // what it is for, and it should reliably work.
        let reached = 0;
        for (let s = 0; s < 20; s++) if (sealFor(`short-${s}`, 1).occurrences.length > 0) reached++;
        expect(reached, 'a year behind a shut door should almost always be quiet')
            .toBeLessThanOrEqual(3);
    });

    it('does not hold for decades, because nothing does', () => {
        // Thirty years is the length people actually seal for, and over that
        // span somebody gets in. Not everybody, and not nobody.
        let reached = 0;
        for (let s = 0; s < 20; s++) if (sealFor(`long-${s}`, 30).occurrences.length > 0) reached++;
        expect(reached, 'thirty years and nothing ever reached anyone').toBeGreaterThan(0);
        expect(reached, 'the door should still be doing most of the work').toBeLessThan(20);
    });
});
