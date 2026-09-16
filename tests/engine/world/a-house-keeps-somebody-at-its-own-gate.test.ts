/**
 * What a house keeps at home when it puts a party on the road.
 *
 * ── THE DEFECT, AS IT WAS SEEN ───────────────────────────────────────────
 *
 * A party's size was bounded by the errand's `hands`, the conveyance's `heads`
 * and the purse, and by nothing about what the house could spare. The world's
 * own chronicle said so: *"Azure Cloud Pavilion sent 9 on looking for
 * disciples, a fair going at ordinal 38. The term is 22 days and they are not
 * back."* That house had eleven modelled people and the other two had died of
 * old age, so the gate then read that nobody could host a visitor - which is
 * what made an unrelated test fail and how this was found at all.
 *
 * And the second half, which is the same omission: `applySendings` built its
 * roster off `status` and `factionId` alone, so somebody still on the road when
 * the year turned was posted to a second errand while the first party's rows
 * went on naming them.
 *
 * ── MEASURED ─────────────────────────────────────────────────────────────
 *
 * `scripts/probe-what-a-house-keeps-at-home.ts`, seeds afford-a/b/c. Two arms
 * run in one process off one snapshot of the sending pass, because the live
 * file was being edited and an arm read off it caught somebody else's
 * red-check toggle.
 *
 *                                    after 1 year        at 100 years
 *   every member in one place        3/38 4/37 1/38  ->  0  0  0
 *   nobody at all at the seat        4    5    1     ->  0  0  0
 *   the gate could not be answered   6    7    1     ->  0  0  0
 *   a party out and can still host   0/6  0/7  0/1   ->  6/6 7/7 1/1
 *   party size, mean                 n/a             ->  4.67 4.89 4.85
 *                                                        -> 3.30 3.56 3.61
 *
 * At 300 years the gate figure barely moves - 44/45, 32/35, 42/44 before
 * against 39/41, 30/31, 32/40 after - because by then most houses have nobody
 * at the seat for reasons that are not errands at all. Measured on one seed:
 * 207 of 306 members stand at their own seat at world open, 64 of 321 at
 * twenty-five years and 42 of 363 at a hundred, the rest in settlements on
 * town postings and never recalled. That is a different defect in a different
 * pass and this rule cannot reach it.
 *
 * AND THE TWO BOUNDS COST DIFFERENT AMOUNTS. Party size at 100 years, mean
 * over three seeds: 4.80 with neither, 4.32 with the gate keep alone, 3.93
 * with the term check alone, 3.49 with both. Nearly all of the second figure
 * is town postings rather than parties: of 4,179/4,028/4,095 party places
 * filled in a century, 1,285/1,219/1,173 went to somebody holding a post in a
 * town and only 32/0/22 to somebody already out with a party.
 *
 * ── THE RULE THESE ASSERTIONS ENCODE ─────────────────────────────────────
 *
 * The bound is not a quota and not a number. `standingAtTheGateOf` is a reader
 * that already fails when a house is empty and it names what it needs -
 * somebody at hand who `couldHostAGuest` - so the errand's rule is that it may
 * not take the LAST of them. A house with four hosts at home sends three of
 * them; a house with one sends none. `runChallenge`'s courtyard and the kill
 * read on a house's own ground want the same person for their own reasons.
 *
 * What is deliberately NOT asserted here is a party size. The party-size ruling
 * is the design owner's - `reason.hands` is a floor, the conveyance fills it
 * out, the chest bounds it - and this adds a fourth bound rather than replacing
 * any of the three. `a-house-sends-what-it-can-carry.test.ts` holds that line.
 *
 * Red-checked: every assertion below was confirmed to fail with the keep
 * dropped (returning `free` unfiltered) or the term check dropped (ignoring
 * `committedUntilDay`).
 */

import { describe, expect, it } from 'vitest';

import {
    whatTheHouseCanSpare,
    whoTheHouseCanSend,
    type OnTheRollForAnErrand
} from '../../../src/engine/world/who-goes-out-for-a-house-and-what-comes-back.js';
import {
    couldHostAGuest,
    standingAtTheGateOf
} from '../../../src/engine/world/standing-at-the-gate-of-a-house.js';

const SEAT = 'loc-seat';
const RANKS = ['Outer Disciple', 'Inner Disciple', 'Core Disciple', 'Elder', 'Sect Master'];

function person(
    id: string,
    rankIndex: number,
    ordinal: number,
    over: Partial<OnTheRollForAnErrand> = {}
): OnTheRollForAnErrand {
    return {
        id,
        name: id,
        ordinal,
        rankIndex,
        locationId: SEAT,
        committedUntilDay: null,
        ...over
    };
}

/** The house's whole roll, home, with three who could host and three who could not. */
function aHouseAtHome(): OnTheRollForAnErrand[] {
    return [
        person('elder-high', 4, 30),
        person('elder-mid', 3, 24),
        person('elder-low', 3, 18),
        person('core', 2, 16),
        person('inner', 1, 12),
        person('outer', 0, 8)
    ];
}

const spare = (roster: readonly OnTheRollForAnErrand[], onDay = 100) =>
    whatTheHouseCanSpare({ roster, rankCount: RANKS.length, seatLocationId: SEAT, onDay });

describe('a house keeps somebody at its own gate', () => {
    it('holds back one who could host, and only one', () => {
        const roster = aHouseAtHome();
        const answer = spare(roster);
        expect(answer.keptAtTheGate).not.toBeNull();
        expect(answer.free).toHaveLength(roster.length - 1);
        expect(couldHostAGuest(
            roster.find(p => p.id === answer.keptAtTheGate!.id)!.rankIndex,
            RANKS.length
        )).toBe(true);
    });

    it('keeps the one it can most afford to keep, so the party loses its last pick', () => {
        const answer = spare(aHouseAtHome());
        // `whoTheHouseCanSend` takes the strongest first, so the cheapest host
        // is the head the party would have taken last or not at all.
        expect(answer.keptAtTheGate!.id).toBe('core');
    });

    it('keeps nobody where nobody who could host was standing there', () => {
        const roster = aHouseAtHome().map(p => ({ ...p, locationId: 'loc-elsewhere' }));
        const answer = spare(roster);
        expect(answer.keptAtTheGate).toBeNull();
        expect(answer.free).toHaveLength(roster.length);
    });

    it('will not send its only host, whatever the errand asks for', () => {
        const roster = [person('the-only-elder', 4, 30), person('outer', 0, 8)];
        const answer = spare(roster);
        expect(answer.keptAtTheGate!.id).toBe('the-only-elder');
        expect(answer.free.map(p => p.id)).toEqual(['outer']);
    });

    it('leaves the gate answerable after the party has gone', () => {
        const roster = aHouseAtHome();
        const answer = spare(roster);
        const going = new Set(whoTheHouseCanSend(
            { ceilingOrdinal: null, hands: Number.MAX_SAFE_INTEGER },
            answer.free
        ).map(p => p.id));
        const stillHere = roster.filter(p => !going.has(p.id));

        const gate = standingAtTheGateOf({
            factionId: 'house-a',
            factionName: 'The Azure Cloud Pavilion',
            ranks: RANKS,
            recruits: true,
            admissionOrdinal: 1,
            standing: null,
            theirPeopleHere: stillHere.map(
                p => ({ id: p.id, name: p.name, rankIndex: p.rankIndex }))
        });
        expect(gate.couldHost.length).toBeGreaterThan(0);
        expect(gate.facts.join(' ')).not.toContain('Nobody of the house is out here to ask');
    });

    it('is what the gate says without it: an errand that took everybody', () => {
        // The before arm, in one assertion. The same roll, nobody held back.
        const roster = aHouseAtHome();
        const everybody = new Set(whoTheHouseCanSend(
            { ceilingOrdinal: null, hands: Number.MAX_SAFE_INTEGER },
            roster
        ).map(p => p.id));
        const stillHere = roster.filter(p => !everybody.has(p.id));
        expect(stillHere).toHaveLength(0);

        const gate = standingAtTheGateOf({
            factionId: 'house-a',
            factionName: 'The Azure Cloud Pavilion',
            ranks: RANKS,
            recruits: true,
            admissionOrdinal: 1,
            standing: null,
            theirPeopleHere: []
        });
        expect(gate.couldHost).toHaveLength(0);
        expect(gate.facts.join(' ')).toContain('Nobody of the house is out here to ask');
    });

    describe('nobody is in two parties at once', () => {
        it('drops whoever is still out on a term that has not run', () => {
            const roster = aHouseAtHome().map(p => p.id === 'outer' || p.id === 'inner'
                ? { ...p, committedUntilDay: 140, locationId: 'loc-a-ruin' }
                : p);
            const answer = spare(roster, 100);
            const free = answer.free.map(p => p.id);
            expect(free).not.toContain('outer');
            expect(free).not.toContain('inner');
            expect(answer.alreadySpent).toBe(2);
        });

        it('takes back somebody whose term is up on the day being asked about', () => {
            const roster = aHouseAtHome().map(p => p.id === 'outer'
                ? { ...p, committedUntilDay: 100, locationId: 'loc-a-ruin' }
                : p);
            const answer = spare(roster, 100);
            expect(answer.alreadySpent).toBe(0);
            expect(answer.free.map(p => p.id)).toContain('outer');
        });

        it('does not keep somebody at the gate who is not at the gate', () => {
            // The one who could host is away on a term, so the house has no
            // host at home and holds nobody back. Being out is the stronger
            // fact and the two rules compose in that order.
            const roster = [
                person('the-only-elder', 4, 30, { committedUntilDay: 200, locationId: 'loc-far' }),
                person('outer', 0, 8)
            ];
            const answer = spare(roster, 100);
            expect(answer.alreadySpent).toBe(1);
            expect(answer.keptAtTheGate).toBeNull();
            expect(answer.free.map(p => p.id)).toEqual(['outer']);
        });
    });

    it('holds nobody for a house with no hall', () => {
        const answer = whatTheHouseCanSpare({
            roster: aHouseAtHome(),
            rankCount: RANKS.length,
            seatLocationId: null,
            onDay: 100
        });
        expect(answer.keptAtTheGate).toBeNull();
        expect(answer.free).toHaveLength(6);
    });
});
