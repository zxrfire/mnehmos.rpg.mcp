/**
 * A leader's question must include every real member, with the player as one
 * voice. The initial follower adapter had no question or decision path at all.
 * These controls arrange an actual stopped party, use the ordinary person odds,
 * and prove that a player's reply need not be the course the leader settles on.
 * A decided question cannot be replayed to fish for a different answer.
 * Waiting in a held discussion does not complete the work it interrupted;
 * the cost of abandoning that work must still reach the ordinary decision.
 */
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../src/engine/world/world-state';
import { createNpc } from '../../../src/engine/world/npc-state';
import { linkLocations, makeLocation } from '../../../src/engine/world/locations';
import { makeFact } from '../../../src/engine/world/history';
import { appendWorldFact } from '../../../src/engine/world/who-was-there-when-it-happened';
import { putTheRouteToTheParty, pendingPartyQuestion, thePartyAnswers }
    from '../../../src/engine/world/a-party-answers-its-leader';
import { applyPartyCourseDecision } from '../../../src/engine/world/capital-missions-and-calendar';
import { roadPositionOfNpc, locationOfNpcOnItsJourney } from '../../../src/engine/world/places-on-the-way';
import type { Party } from '../../../src/engine/social-leverage/an-attempt-to-move-somebody';

function prepared(seed = 'all-the-party-answers', work: boolean | 'road' = false) {
    const world = createWorld({ seed, regionCount: 0, skipPriorAges: true });
    world.currentDay = 100;
    const place = makeLocation({ id: 'party-stop', name: 'Reed Clearing', kind: 'wilderness' });
    world.locations = [place];
    const player: Party = { id: 'actual-player', name: 'Traveller', ordinal: 0, factionId: null, alignment: null };
    const people = ['leader', 'companion-a', 'companion-b'].map(id => createNpc(seed, {
        id, locationId: place.id, onDay: 100, bornOnDay: 0 }));
    const ids = [player.id, ...people.map(person => person.id)];
    for (const person of people) person.activity = { kind: 'out_with_a_party',
        note: 'Stopped with the party.', withIds: ids.filter(id => id !== person.id),
        sinceDay: 99, untilDay: 110 };
    world.npcs = people;
    if (work) {
        const home = makeLocation({ id: 'party-home', name: 'Reed Court', kind: 'settlement' });
        world.locations.push(home);
        linkLocations(home, place, 'road', 2);
        const mission = appendWorldFact(world, makeFact({ day: 99, kind: 'gathering', locationId: home.id,
            visibility: 'secret', summary: 'The party arranged a ten-day visit.',
            actors: [player, ...people].map(person => ({ id: person.id, name: person.name, role: 'party_member' })),
            data: { publicMission: true, publicRoute: JSON.stringify([{ fromId: home.id, toId: place.id, by: 'land' }]),
                publicServiceDays: 10, destinationId: place.id } }), { bystanders: false, recur: false });
        for (const person of people) person.activity = work === 'road'
            ? { ...person.activity!, kind: 'travelling', capitalMissionId: mission.id, capitalMissionLeg: 0,
                fromLocationId: home.id, returnTo: place.id, sinceDay: 99, untilDay: 101 }
            : { ...person.activity!, capitalMissionId: mission.id, capitalMissionLeg: 1, sinceDay: 100, untilDay: 110 };
    }
    const question = putTheRouteToTheParty(world, people[0]!.id, player.id, 100, 'actual-stop', 'The party reached its stop.')!;
    expect(question).not.toBeNull();
    return { world, people, player, question };
}

describe('the whole party answers its actual leader', () => {
    it('ordinary decisions continue, rest or reverse from the actual partial road', () => {
        const found = new Set<string>();
        for (let sample = 0; sample < 48 && found.size < 3; sample++) {
            const h = prepared(`real-road-party-course-${sample}`, 'road');
            const leader = h.world.npcs.find(person => person.id === h.people[0]!.id)!;
            const point = roadPositionOfNpc(h.world.locations, leader, 100)!;
            expect(point.kind).toBe('edge');
            if (point.kind === 'edge') expect(point.fraction).toBeCloseTo(0.5);
            const decision = thePartyAnswers(h.world, h.question, h.player, 'continue', 100)!;
            found.add(decision.chosen);
            const applied = applyPartyCourseDecision(h.world, leader.id, 100);
            let current = h.world.npcs.find(person => person.id === leader.id)!;
            if (decision.chosen === 'rest') {
                expect(applied).toBe(false);
                expect(current.activity!.untilDay).toBe(100.25);
                expect(locationOfNpcOnItsJourney(h.world, current, 100.2)).toBe(h.question.locationId);
                expect(applyPartyCourseDecision(h.world, leader.id, 100.25)).toBe(true);
                current = h.world.npcs.find(person => person.id === leader.id)!;
                expect(current.activity!.sinceDay).toBe(99.25);
                expect(current.activity!.untilDay).toBe(101.25);
            } else if (decision.chosen === 'turn_back') {
                expect(applied).toBe(true);
                expect(current.activity!.returnTo).toBe('party-home');
                expect(current.activity!.untilDay).toBe(101);
                expect(locationOfNpcOnItsJourney(h.world, current, 101)).toBe('party-home');
                expect(current.activity!.capitalMissionLeg).toBe(2);
            } else {
                expect(applied).toBe(true);
                expect(current.activity!.sinceDay).toBe(99);
                expect(current.activity!.untilDay).toBe(101);
                expect(locationOfNpcOnItsJourney(h.world, current, 101)).toBe('party-stop');
            }
            expect(current.activity!.partyQuestionId).toBeUndefined();
            expect(applyPartyCourseDecision(h.world, leader.id, 102)).toBe(false);
        }
        expect([...found].sort()).toEqual(['continue', 'rest', 'turn_back']);
    });

    it('time spent in a held discussion does not make its unfinished work disappear', () => {
        for (let sample = 0; sample < 24; sample++) {
            const h = prepared(`held-party-work-${sample}`, true);
            const later = structuredClone(h.world);
            later.currentDay = 111;
            const original = thePartyAnswers(h.world, h.question, h.player, 'continue', 100)!;
            const afterWaiting = thePartyAnswers(later,
                later.history.facts.find(fact => fact.id === h.question.id)!, h.player, 'continue', 111)!;
            expect(afterWaiting.voices).toEqual(original.voices);
            expect(afterWaiting.chosen).toBe(original.chosen);
        }
    });

    it('records one answer from each living member and the actual player', () => {
        const h = prepared();
        const result = thePartyAnswers(h.world, h.question, h.player, 'continue', 100)!;
        expect(result).not.toBeNull();
        expect(result.voices.map(voice => voice.personId).sort())
            .toEqual([h.player.id, ...h.people.map(person => person.id)].sort());
        expect(result.voices.find(voice => voice.personId === h.player.id)!.choice).toBe('continue');
        expect(pendingPartyQuestion(h.world, h.people[0]!.id)).toBeNull();
        expect(result.decision.causes).toContain(h.question.id);
    });

    it('the player can be overruled without changing anyone into a scripted opponent', () => {
        let overruled = 0;
        for (let sample = 0; sample < 24; sample++) {
            const h = prepared(`ordinary-party-voices-${sample}`);
            const result = thePartyAnswers(h.world, h.question, h.player, 'turn_back', 100)!;
            expect(result).not.toBeNull();
            if (result.chosen !== 'turn_back') overruled++;
        }
        expect(overruled).toBeGreaterThan(0);
    });

    it('an answered question returns its original decision rather than another draw', () => {
        const h = prepared();
        const first = thePartyAnswers(h.world, h.question, h.player, 'continue', 100)!;
        const facts = h.world.history.facts.length;
        expect(thePartyAnswers(h.world, h.question, h.player, 'turn_back', 100)).toEqual(first);
        expect(h.world.history.facts.length).toBe(facts);
        expect(putTheRouteToTheParty(h.world, h.people[0]!.id, h.player.id,
            100, 'actual-stop', 'The same actual stop.')).toBe(h.question);
    });

    it('an absent or dead member does not answer for a person who is not there', () => {
        const h = prepared();
        h.world.npcs.find(person => person.id === h.people[1]!.id)!.status = 'dead';
        const last = h.world.npcs.find(person => person.id === h.people[2]!.id)!;
        last.locationId = 'elsewhere';
        last.activity = null;
        expect(thePartyAnswers(h.world, h.question, h.player, 'rest', 100)).toBeNull();
        last.locationId = 'party-stop';
        const result = thePartyAnswers(h.world, h.question, h.player, 'rest', 100)!;
        expect(result.voices.map(voice => voice.personId)).not.toContain(h.people[1]!.id);
        expect(result.voices.map(voice => voice.personId)).toContain(last.id);
    });
});
