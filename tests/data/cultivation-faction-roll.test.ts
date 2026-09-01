/**
 * The roll, and the one house that had nobody on it.
 *
 * Two things are asserted here. That a faction's membership can be ASKED FOR
 * rather than reconstructed by scanning, and that the union is honest - every
 * row on a roll is a row that exists in some other catalog, and nothing has
 * been invented at the join.
 */

import { describe, it, expect } from 'vitest';

import {
    rollOf,
    rollSizeOf,
    everybodyOnARoll
} from '../../src/data/cultivation/faction-roll.js';
import {
    HOLLOW_COURT_ROSTER,
    HollowCourtMemberSchema,
    HOW_THE_COURT_IS_SEEN,
    hollowCourtTier,
    workingNamesInCirculation,
    getHollowCourtMember
} from '../../src/data/cultivation/hollow-court-roster.js';
import { MEMBERS } from '../../src/data/cultivation/members.js';
import { SECTS, requireSect, WITHDRAWN_POWERS } from '../../src/data/cultivation/sects.js';
import { COURTS, idsForFaction } from '../../src/data/cultivation/governance-and-water-rights.js';
import { REALM_TIERS, lifespanForOrdinal } from '../../src/engine/cultivation/realms.js';

const HOLLOW = 'sect-hollow-court';

describe('the roll - one question, one answer', () => {
    it('gives every id on a roll a row in the catalog it names', () => {
        for (const entry of everybodyOnARoll()) {
            const found = entry.source === 'members'
                ? MEMBERS.some(m => m.id === entry.id)
                : entry.source === 'court officers'
                    ? COURTS.some(c => c.roster.some(o => o.id === entry.id))
                    : HOLLOW_COURT_ROSTER.some(m => m.id === entry.id);
            expect(found, `${entry.id} claims ${entry.source} and is not in it`).toBe(true);
        }
    });

    it('never puts one person on two rolls', () => {
        const ids = everybodyOnARoll().map(e => e.id);
        expect(new Set(ids).size, 'somebody is on two rolls').toBe(ids.length);
    });

    it('answers with the same roll whichever of a body\'s ids you ask with', () => {
        // The Azure Mist is a court in one table and a sect in another, and its
        // people were written against one of those two ids.
        for (const court of COURTS) {
            const ids = idsForFaction(court.id);
            if (ids.length < 2) continue;
            const first = rollOf(ids[0]).map(e => e.id).sort();
            const second = rollOf(ids[1]).map(e => e.id).sort();
            expect(first, `${court.id} answers differently under its two ids`).toEqual(second);
        }
    });

    it('returns the roll strongest first', () => {
        for (const sect of SECTS) {
            const roll = rollOf(sect.id);
            for (let i = 1; i < roll.length; i++) {
                expect(roll[i - 1].realmOrdinal, sect.id)
                    .toBeGreaterThanOrEqual(roll[i].realmOrdinal);
            }
        }
    });

    it('agrees with the member catalog wherever the member catalog is the source', () => {
        for (const sect of SECTS) {
            const fromRoll = rollOf(sect.id).filter(e => e.source === 'members').map(e => e.id).sort();
            const fromMembers = MEMBERS.filter(m => m.factionId === sect.id).map(m => m.id).sort();
            expect(fromRoll, sect.id).toEqual(fromMembers);
        }
    });

    it('leaves no recruiting house with an empty roll', () => {
        const bare = SECTS.filter(s => s.recruits && rollSizeOf(s.id) === 0).map(s => s.id);
        expect(bare, 'houses that take people and have nobody on the roll').toEqual([]);
    });
});

describe('the Hollow Court - the house that had nobody', () => {
    it('parses, and is small on purpose', () => {
        for (const m of HOLLOW_COURT_ROSTER) {
            expect(() => HollowCourtMemberSchema.parse(m), m.id).not.toThrow();
        }
        // One or two at each rung, plus the Guest. A roster of dozens would
        // contradict everything else said about the place.
        for (const tier of ['Outer Disciple', 'Inner Disciple', 'Elder'] as const) {
            const n = hollowCourtTier(tier).length;
            expect(n, `${tier} has ${n}`).toBeGreaterThanOrEqual(1);
            expect(n, `${tier} has ${n}`).toBeLessThanOrEqual(2);
        }
        expect(rollSizeOf(HOLLOW), 'the Court has nobody on it').toBeGreaterThan(0);
    });

    it('has all four Seats on the roll, and none of them named', () => {
        // Both halves matter and they used to be confused for each other. The
        // Seats ARE members and the roll has to show them - a roster that omits
        // the four people the whole house is about is a hole, and the entry was
        // saying "four of its seats are out of the world entirely" over a list
        // with no seats on it. But they stay UNNAMED, which the catalog has done
        // deliberately since it was written: the name field carries the OFFICE,
        // because that is all anybody has ever had for these people.
        const seats = HOLLOW_COURT_ROSTER.filter(m => m.tier === 'Seat');
        expect(seats).toHaveLength(4);
        for (const seat of seats) {
            expect(seat.name, `${seat.id} has acquired a personal name`)
                .toMatch(/^(First|Second|Third|Fourth) Seat$/);
            expect(seat.worksOutsideAs, `${seat.id} works outside`).toBeNull();
        }

        // And the ordinals are the withdrawn record's, not a second copy of it.
        const withdrawn = WITHDRAWN_POWERS[HOLLOW].seats;
        expect(withdrawn).toHaveLength(4);
        for (const seat of withdrawn) {
            const onRoll = seats.find(m => m.name === seat.position);
            expect(onRoll, `${seat.position} is withdrawn and not on the roll`).toBeDefined();
            expect(onRoll!.realmOrdinal, seat.position).toBe(seat.ordinal);
        }

        // The ordering rule that record states, applied: by ordinal descending,
        // then by youth. So the Second is younger than the Third it stands level
        // with, and the Fourth is the youngest of the four.
        const byName = new Map(seats.map(m => [m.name, m]));
        expect(byName.get('Second Seat')!.realmOrdinal)
            .toBe(byName.get('Third Seat')!.realmOrdinal);
        expect(byName.get('Second Seat')!.ageYears)
            .toBeLessThan(byName.get('Third Seat')!.ageYears);
        expect(Math.min(...seats.map(m => m.ageYears)))
            .toBe(byName.get('Fourth Seat')!.ageYears);
    });

    it('stands everybody in the realm band their own rung gives them', () => {
        const court = requireSect(HOLLOW);
        for (const m of HOLLOW_COURT_ROSTER) {
            if (m.rankIndex === null) continue;
            expect(court.ranks[m.rankIndex], `${m.id} rank index does not match the ladder`)
                .toBe(m.tier);
            // Admission at 29, four rungs per rank: 29-32, 33-36, 37-40, 41-44.
            const floor = court.admissionOrdinal + m.rankIndex * 4;
            expect(m.realmOrdinal, `${m.id} is under its own rung`).toBeGreaterThanOrEqual(floor);
            expect(m.realmOrdinal, `${m.id} is over its own rung`).toBeLessThanOrEqual(floor + 3);
        }
    });

    it('gives nobody an age their rung cannot account for, or that it would not permit', () => {
        for (const m of HOLLOW_COURT_ROSTER) {
            const tier = REALM_TIERS.find(t =>
                m.realmOrdinal >= t.ordinalStart && m.realmOrdinal <= t.ordinalEnd)!;
            // Under the lifespan the rung grants, by a wide margin. Age is
            // never what stops anybody here, which is exactly why the road is
            // the only question they have.
            expect(m.ageYears, `${m.id} is older than ${tier.name} permits`)
                .toBeLessThan(lifespanForOrdinal(m.realmOrdinal));
            // And old enough for the climb. Nobody reaches Void Refinement in
            // a century, whatever their root.
            expect(m.ageYears, `${m.id} is too young for rung ${m.realmOrdinal}`)
                .toBeGreaterThan(m.realmOrdinal * 8);
        }
    });

    it('keeps the working name off the ladder', () => {
        // The public title is what strangers call somebody of evident standing
        // they cannot place. It is not this Court's word for a rank, and the
        // roster must not let the two line up neatly - somebody the world calls
        // Elder is not necessarily an Elder here, and that is the whole reason
        // nobody outside can work out who is which.
        const misleading = HOLLOW_COURT_ROSTER.filter(m =>
            m.worksOutsideAs !== null && !m.worksOutsideAs.startsWith(m.tier));
        expect(misleading.length, 'every public title matches its holder\'s real rung')
            .toBeGreaterThan(0);
    });

    it('gives a working name only to people who go out, and the world only hears those', () => {
        const circulating = workingNamesInCirculation();
        expect(circulating.length).toBeGreaterThan(0);
        expect(circulating.length).toBeLessThan(HOLLOW_COURT_ROSTER.length);
        for (const name of circulating) {
            const holder = HOLLOW_COURT_ROSTER.find(m => m.worksOutsideAs === name)!;
            // A title and a bare surname, and nothing else. A longer name would
            // identify somebody, which is the one thing it must not do.
            expect(name.split(' ').length, `${name} is too specific`).toBeLessThanOrEqual(3);
            expect(holder.knownForBefore.length, `${holder.id} has no public history`)
                .toBeGreaterThan(0);
        }
    });

    it('says what is asked of everybody, and asks the Guest for nothing', () => {
        const guest = HOLLOW_COURT_ROSTER.find(m => m.tier === 'Guest of the Court')!;
        expect(guest, 'the Guest is not on the roll').toBeDefined();
        expect(guest.rankIndex, 'the Guest has been put on the ladder').toBeNull();
        expect(guest.realmOrdinal, 'the Guest is not above the ladder').toBe(45);
        expect(guest.whatIsAskedOfThem, 'the Court has acquired a claim on him')
            .toMatch(/^Nothing/);
        for (const m of HOLLOW_COURT_ROSTER) {
            expect(m.whatIsAskedOfThem.length, m.id).toBeGreaterThan(0);
        }
    });

    it('puts the Guest at the top of the Court\'s own roll', () => {
        const roll = rollOf(HOLLOW);
        expect(roll[0].name).toBe('Lu Sheng');
        expect(roll[0].rank).toBe('Guest of the Court');
        // And he stands above the figure the house answers with, which is the
        // one place on the sheet where somebody on a roll outranks their own
        // house. It is correct: he is not of them and does not answer for them.
        expect(roll[0].realmOrdinal).toBeGreaterThan(requireSect(HOLLOW).powerOrdinal);
        expect(roll[1].rank).toBe('Seat');
    });

    it('describes how they are seen without claiming anybody can be sure', () => {
        // The load-bearing sentence. Two lists the province cannot join, and
        // the reason is the absence of evidence rather than a concealment
        // mechanism - which is why the identifications never close.
        expect(HOW_THE_COURT_IS_SEEN.andWhyNobodyCanBeSure).toMatch(/cannot|no way/i);
        expect(HOW_THE_COURT_IS_SEEN.masked).toMatch(/mask|masked/i);
        expect(HOW_THE_COURT_IS_SEEN.andSometimesTheyDo,
            'they are modelled as a wall rather than as people').toMatch(/rarely|sometimes/i);
    });

    it('resolves everybody by id', () => {
        for (const m of HOLLOW_COURT_ROSTER) {
            expect(getHollowCourtMember(m.id), m.id).toBeDefined();
        }
    });
});
